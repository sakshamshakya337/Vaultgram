# StreamVault — System Design Document

**Version:** 1.0
**Status:** Draft — Phase 1 implementation spec
**Related:** [`README.md`](./README.md)

---

## 1. Purpose & Scope

StreamVault is a private video streaming platform. The design goal is a YouTube-like experience (browse, search, play, track progress) without paying for video storage/bandwidth, by using a Telegram private channel as the media layer while keeping every product feature (auth, metadata, search, history) in a system you fully control.

This document covers system architecture, data modeling, API contracts, the streaming design (the hardest part), and non-functional constraints (security, scaling limits).

---

## 2. Goals & Non-Goals

**Goals**
- Admin can upload a video and have it browsable/searchable/playable within seconds
- Users can register, log in, browse, search, play, like, and resume videos
- Video bytes are never exposed via a raw Telegram URL to the client
- System works within Telegram's free hosted Bot API limits for Phase 1

**Non-goals (for now)**
- Public multi-tenant hosting at YouTube scale
- Transcoding / adaptive bitrate streaming
- Live streaming
- Videos over 50MB (deferred to Phase 3, see [§8](#8-scaling-path-phase-3))

---

## 3. High-Level Architecture

```
┌─────────────────────┐
│  React Native App    │
│  (Expo)               │
└──────────┬───────────┘
           │ HTTPS, JWT Bearer auth
           ▼
┌───────────────────────────┐
│  Express API (Node.js)     │
│  ─ auth                    │
│  ─ video metadata CRUD     │
│  ─ search                  │
│  ─ streaming proxy         │
└───────┬───────────┬────────┘
        │            │
        ▼            ▼
┌──────────────┐  ┌────────────────────────┐
│  MongoDB      │  │  Telegram Bot API        │
│  (metadata)   │  │  ─ sendVideo (upload)    │
│               │  │  ─ getFile (resolve)     │
└──────────────┘  └───────────┬─────────────┘
                               ▼
                    ┌────────────────────┐
                    │ Private Channel      │
                    │ (video file storage) │
                    └────────────────────┘
```

**Design principle:** MongoDB is the source of truth for everything *about* a video. Telegram is a dumb, durable blob store the backend talks to on the video's behalf. The client only ever knows about your API.

---

## 4. Data Model (MongoDB)

Mongoose is used as the ODM for schema validation and query building. Collections below.

### 4.1 `users`

```js
{
  _id: ObjectId,
  name: String,
  email: { type: String, unique: true, required: true },
  passwordHash: String,
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  createdAt: { type: Date, default: Date.now }
}
```
Index: unique index on `email`.

### 4.2 `videos`

```js
{
  _id: ObjectId,
  title: { type: String, required: true },
  description: String,
  telegramFileId: { type: String, required: true },   // Telegram file_id, reusable
  telegramMessageId: Number,                            // for deletion
  thumbnail: String,                                     // URL or generated
  duration: Number,                                      // seconds
  category: String,
  fileSizeBytes: Number,
  views: { type: Number, default: 0 },
  uploadedBy: { type: ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
}
```
Index: text index on `title`, `description`, `category` (powers `/search`). Index on `category` for filtered browsing.

### 4.3 `watchHistory`

```js
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'User', required: true },
  videoId: { type: ObjectId, ref: 'Video', required: true },
  progressSeconds: Number,
  completed: { type: Boolean, default: false },
  lastWatchedAt: { type: Date, default: Date.now }
}
```
Index: compound unique index on `{ userId, videoId }` — enables upsert-on-write for "continue watching."

### 4.4 `playlists`

```js
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'User', required: true },
  title: String,
  videoIds: [{ type: ObjectId, ref: 'Video' }],
  createdAt: { type: Date, default: Date.now }
}
```

### 4.5 `likes`

```js
{
  _id: ObjectId,
  userId: { type: ObjectId, ref: 'User', required: true },
  videoId: { type: ObjectId, ref: 'Video', required: true },
  createdAt: { type: Date, default: Date.now }
}
```
Index: compound unique index on `{ userId, videoId }` — prevents duplicate likes, makes toggle a single query.

### 4.6 Why MongoDB (design rationale)

- **Schema flexibility:** Phase 2/3 will add fields (thumbnails, transcoding status, offline-cache flags) without formal migrations — a real cost saver on a solo/small-team timeline.
- **Document shape fits the domain:** a video's metadata, a playlist's video list, and a user's watch history are all naturally nested/array-shaped rather than heavily relational.
- **Atlas free tier** is sufficient for Phase 1/2 scale (a personal or small-community video library), keeping infra cost at zero alongside Telegram storage.
- **Text search built-in:** Mongo's text indexes cover the `/search` requirement without adding Elasticsearch as a dependency at this scale.

---

## 5. API Contracts

Base URL: `/api/v1`

### `POST /auth/register`
```json
// Request
{ "name": "Saksham", "email": "s@example.com", "password": "..." }
// Response 201
{ "id": "...", "name": "...", "email": "...", "token": "<jwt>" }
```

### `POST /auth/login`
```json
// Request
{ "email": "s@example.com", "password": "..." }
// Response 200
{ "token": "<jwt>", "user": { "id": "...", "role": "admin" } }
```

### `GET /videos?page=1&limit=20&category=Programming`
```json
// Response 200
{ "items": [ { "id": "...", "title": "...", "thumbnail": "...", "duration": 620 } ], "page": 1, "totalPages": 4 }
```

### `POST /videos/upload` (Admin, `multipart/form-data`)
Fields: `title`, `description`, `category`, `video` (file, ≤50MB)
```json
// Response 201
{ "id": "...", "title": "...", "telegramFileId": "BAACAg..." }
```

### `GET /stream/:id`
- Supports `Range` header; responds `206 Partial Content` with matching `Content-Range`.
- No JSON body — raw video byte stream.

### `GET /search?q=react&category=Programming`
```json
// Response 200
{ "items": [ { "id": "...", "title": "..." } ] }
```

### `POST /history`
```json
// Request
{ "videoId": "...", "progressSeconds": 340 }
// Response 200 — upserted
{ "videoId": "...", "progressSeconds": 340, "completed": false }
```

---

## 6. Streaming Design (critical path)

This is the part most likely to break under real usage, so it gets its own section.

### 6.1 Constraints
- Hosted Telegram Bot API: `getFile` download cap **20MB**, resolved file URLs valid for **~1 hour**.
- `sendVideo` upload cap: **50MB**.
- The client must be able to **seek** (scrub the progress bar), which requires HTTP Range support end-to-end.

### 6.2 Flow

```
RN Player                Express /stream/:id             Telegram
    │  GET with Range header      │                          │
    ├─────────────────────────────►                          │
    │                              │  getFile(file_id)        │
    │                              ├──────────────────────────►
    │                              │  ◄── file_path            │
    │                              │  GET file_path w/ Range   │
    │                              ├──────────────────────────►
    │                              │  ◄── 206 + byte range      │
    │  ◄── 206 + byte range         │                          │
```

The Express handler forwards the client's `Range` header on to Telegram's file URL and pipes the response straight back, preserving status code and headers — this is what lets the mobile player scrub without downloading the whole file first.

### 6.3 Known limitation & mitigation

Because `getFile` caps at 20MB on the hosted API, any video whose *requested byte range* would exceed that cap fails. In practice this means:

- Phase 1: cap uploads well under the effective streaming limit, or accept that scrubbing near the end of longer files may fail.
- Phase 3: migrate to a self-hosted **Local Bot API Server**, which removes this cap entirely and is a drop-in replacement for the same `/stream/:id` handler (only the upstream base URL changes).

### 6.4 Caching consideration

`getFile` results are valid ~1 hour; re-resolving on every request is wasteful under load. A short-TTL in-memory or Redis cache keyed on `telegramFileId` is worth adding once traffic exceeds trivial levels — not required for Phase 1 correctness.

---

## 7. Security Design

| Concern | Mitigation |
|---|---|
| Bot token exposure | Token lives only in backend `.env`, never shipped to client |
| Auth | JWT (short-lived) + bcrypt password hashing |
| Authorization | `role` field on `User`; `requireAdmin` middleware on upload/delete routes |
| Brute force | `express-rate-limit` on `/auth/*` |
| File validation | Multer file-type + size filter before any Telegram call |
| Transport | HTTPS enforced in production (reverse proxy / hosting platform) |
| Headers | `helmet` for baseline HTTP security headers |
| Logging | Never log JWT secret, bot token, or full JWTs |

---

## 8. Scaling Path (Phase 3)

| Limitation today | Phase 3 fix |
|---|---|
| 50MB upload cap | Self-hosted Local Bot API Server (supports up to 2GB) |
| 20MB streaming cap | Same — Local Bot API Server removes this |
| `getFile` URL re-resolved every request | Redis cache with TTL slightly under Telegram's expiry |
| No offline playback | Client-side download + local file cache (Expo FileSystem) |
| No usage insight | Admin analytics dashboard (views, watch-through rate) sourced from `videos.views` + `watchHistory` |

---

## 9. Open Questions

- Thumbnail generation: client-provided at upload time, or server-side extraction (would require ffmpeg on the backend)?
- Should `views` increment on stream start, or after N seconds watched (to avoid inflation from accidental taps)?
- Multi-admin support, or single-admin for Phase 1?

---

## 10. Appendix — Reference Diagram (upload flow)

```
Admin (RN App)
      │  POST /videos/upload (multipart)
      ▼
Express Backend
      │  multer parses file into memory buffer
      ▼
telegramService.uploadVideoToTelegram()
      │  axios POST sendVideo
      ▼
Telegram Private Channel
      │  returns { file_id, message_id }
      ▼
MongoDB — Video.create({ ...metadata, telegramFileId, telegramMessageId })
      │
      ▼
201 Created → video now visible in /videos and /search
```
