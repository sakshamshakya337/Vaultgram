# Personal Storage 🚀

**Personal Storage** is a modern, high-performance Private Cloud Media Vault & Streaming PWA built with React, Express, MongoDB Atlas, and Telegram Cloud Storage.

---

## ✨ Features

- 📸 **Full Photo & Video Support**: Upload, preview, and organize high-resolution photos (JPEG, PNG, WEBP, GIF, SVG) and videos (MP4, MKV, MOV, WEBM).
- ☁️ **100% Free Unlimited Cloud Storage**: Files are streamed directly to/from your private Telegram Channel with **zero** local server disk consumption.
- 📱 **Installable Progressive Web App (PWA)**: Works as a standalone app on iOS, Android, macOS, and Windows.
- ⚡ **Real-Time Upload Progress**: Live 0% to 100% progress tracking with drag-and-drop support.
- 🎥 **Streaming Video Player**: Native video streaming with keyboard shortcuts, resume playback, and watch history.
- 🖼️ **High-Res Lightbox**: Fullscreen photo viewer with zoom, pan, and direct download.
- 🔒 **Secure Authentication**: JWT-based user authentication and private personal vaults.
- 📁 **Collections & Folders**: Organize media into custom playlists and folders.
- 🔍 **Instant Search & Filters**: Search titles, descriptions, and filter by media type (Photos/Videos) or categories.
- 🚀 **Vercel Serverless Ready**: Deploy as a single project to Vercel with zero extra configuration.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Lucide Icons, Vanilla CSS Design System, Service Worker (PWA)
- **Backend / API**: Express 4, Node.js (Vercel Serverless Function compatible)
- **Database**: MongoDB Atlas via Mongoose
- **Cloud Media Storage**: Telegram Bot API (SendVideo / SendPhoto / SendDocument / Range Streaming CDN)

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` (or verify your `.env` file):
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=-100xxxxxxxxxx
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_secret_key
PORT=5000
NODE_ENV=development
```

### 3. Run Development Server
```bash
npm run dev
```
- Frontend UI: `http://localhost:3000`
- Backend API: `http://localhost:5000`

---

## 📦 Production Build & Local Server

To test the production build locally:
```bash
npm run build
npm start
```

---

## ☁️ Deploying to Vercel

1. Push this repository to GitHub or GitLab.
2. Go to [Vercel Dashboard](https://vercel.com/new) and import your repository.
3. Add the following **Environment Variables** in your Vercel Project Settings:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `MONGODB_URI`
   - `JWT_SECRET`
4. Click **Deploy**. Vercel will automatically run `npm run build` and route API requests through `api/index.js`!
