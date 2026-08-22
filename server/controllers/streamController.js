'use strict';
const axios = require('axios');
const Media = require('../models/Media');
const { resolveFileUrl } = require('../services/telegramService');

/**
 * GET /api/v1/stream/:id
 * Streams/proxies any file (Videos, Audio, PDFs, Images, Archives, Code) directly from Telegram CDN.
 */
exports.streamMedia = async (req, res) => {
  try {
    const item = await Media.findById(req.params.id).lean();
    if (!item) {
      console.error(`[streamMedia] File not found: ${req.params.id}`);
      return res.status(404).json({
        error: 'FILE_NOT_FOUND',
        message: 'File record not found in database',
      });
    }

    if (item.isFolder) {
      return res.status(400).json({
        error: 'CANNOT_STREAM_FOLDER',
        message: 'Cannot stream a folder',
      });
    }

    if (!item.telegramFileId) {
      console.error(`[streamMedia] Missing telegramFileId for item: ${item._id}`);
      return res.status(404).json({
        error: 'MISSING_FILE_ID',
        message: 'File record is missing a Telegram file ID',
      });
    }

    // Check environment configuration
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('[streamMedia] TELEGRAM_BOT_TOKEN environment variable is not defined!');
      return res.status(500).json({
        error: 'MISSING_ENV_CONFIG',
        message: 'TELEGRAM_BOT_TOKEN is not configured on the backend server',
      });
    }

    // Check Telegram 20MB download ceiling on standard hosted bot API
    const MAX_TELEGRAM_HOSTED_BYTES = 20 * 1024 * 1024;
    if (item.fileSizeBytes && item.fileSizeBytes > MAX_TELEGRAM_HOSTED_BYTES) {
      const sizeMb = (item.fileSizeBytes / (1024 * 1024)).toFixed(1);
      console.error(`[streamMedia] File exceeds 20MB Telegram limit: ${sizeMb} MB (ID: ${item._id})`);
      return res.status(413).json({
        error: 'FILE_TOO_LARGE_FOR_HOSTED_API',
        message: `Video size (${sizeMb} MB) exceeds Telegram's 20MB download limit for standard bot servers`,
        fileSizeBytes: item.fileSizeBytes,
      });
    }

    // 1. Resolve direct Telegram CDN URL
    let telegramUrl = null;
    try {
      telegramUrl = await resolveFileUrl(item.telegramFileId);
    } catch (err) {
      console.error(`[streamMedia] Telegram getFile failed for file_id "${item.telegramFileId}":`, err.response?.data || err.message);
      const tgErrorDesc = err.response?.data?.description || err.message;
      return res.status(502).json({
        error: 'TELEGRAM_UPSTREAM_FAILED',
        message: `Telegram upstream error: ${tgErrorDesc}`,
      });
    }

    if (!telegramUrl || !telegramUrl.startsWith('http')) {
      console.error(`[streamMedia] Unreachable telegramUrl: ${telegramUrl}`);
      return res.status(502).json({
        error: 'INVALID_STREAM_URL',
        message: 'File source not reachable in Telegram cloud CDN',
      });
    }

    const isVideo = item.fileCategory === 'video' || item.mediaType === 'video' || item.fileType === 'video';
    const isAudio = item.fileCategory === 'audio' || item.mediaType === 'audio' || item.fileType === 'audio';
    const isStreamable = isVideo || isAudio;

    const range = req.headers.range;
    const reqHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    if (range && isStreamable) {
      reqHeaders.Range = range;
    }

    // 2. Stream proxy response from Telegram CDN
    const tgResponse = await axios.get(telegramUrl, {
      responseType: 'stream',
      headers: reqHeaders,
      validateStatus: () => true,
      timeout: 60000,
    });

    if (tgResponse.status >= 400) {
      console.error(`[streamMedia] Telegram CDN responded with HTTP ${tgResponse.status}`);
      return res.status(502).json({
        error: 'TELEGRAM_CDN_ERROR',
        message: `Telegram CDN returned status ${tgResponse.status}`,
      });
    }

const MIME_EXTENSION_MAP = {
  // Images
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/x-icon': 'ico',
  'image/tiff': 'tiff',

  // Videos
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
  'video/x-msvideo': 'avi',
  'video/3gpp': '3gp',
  'video/ogg': 'ogv',

  // Audio
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'audio/webm': 'weba',

  // Documents & Archives
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/json': 'json',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/x-rar-compressed': 'rar',
  'application/x-7z-compressed': '7z',
  'application/x-tar': 'tar',
  'application/gzip': 'gz',
};

function resolveFileExtension(item, contentType) {
  // 1. From item.extension (if explicitly stored)
  if (item.extension) {
    const clean = String(item.extension).toLowerCase().replace(/^\./, '').trim();
    if (clean && clean.length <= 8) return clean;
  }

  // 2. From Content-Type / MIME
  const effectiveMime = (contentType || item.mimeType || '').toLowerCase().split(';')[0].trim();
  if (MIME_EXTENSION_MAP[effectiveMime]) {
    return MIME_EXTENSION_MAP[effectiveMime];
  }

  // 3. From item.fileType / item.fileCategory fallbacks
  const cat = (item.fileCategory || item.mediaType || item.fileType || '').toLowerCase();
  if (cat === 'video') return 'mp4';
  if (cat === 'image') return 'jpg';
  if (cat === 'audio') return 'mp3';
  if (cat === 'pdf') return 'pdf';
  if (cat === 'document') return 'pdf';

  return 'bin';
}

function getSanitizedFilename(rawTitle, extension) {
  let title = (rawTitle || 'file').trim();

  // Strip invalid characters across Windows/macOS/Linux: \ / : * ? " < > | and control characters
  title = title.replace(/[\\/:*?"<>|\x00-\x1F]/g, '_').trim();

  // If title already ends with the target extension (case-insensitive), keep it
  const extRegex = new RegExp(`\\.${extension}$`, 'i');
  if (extRegex.test(title)) {
    return title;
  }

  // If title already ends with a 2-6 char extension, keep it
  if (/\.[a-zA-Z0-9]{2,6}$/.test(title)) {
    return title;
  }

  return `${title || 'file'}.${extension}`;
}

    const isDownload = req.query.download === '1';

    // Dynamic origin matching for streaming media
    const reqOrigin = req.headers.origin;
    const allowedOriginEnv = process.env.ALLOWED_ORIGIN || '*';
    const allowedOrigins = allowedOriginEnv.split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean);
    let allowOrigin = '*';
    if (reqOrigin) {
      const cleanOrigin = reqOrigin.replace(/\/+$/, '');
      if (allowedOriginEnv === '*' || allowedOrigins.includes('*') || allowedOrigins.includes(cleanOrigin) || cleanOrigin.endsWith('.vercel.app')) {
        allowOrigin = reqOrigin;
      }
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Authorization, Content-Type, bypass-tunnel-reminder',
      'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type, Content-Disposition',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    };

    const isImage =
      item.fileCategory === 'image' ||
      item.mediaType === 'image' ||
      item.fileType === 'image' ||
      (item.mimeType && item.mimeType.startsWith('image/')) ||
      ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'avif', 'heic', 'heif', 'ico', 'tiff'].includes((item.extension || '').toLowerCase().replace('.', ''));

    // Fallback & guarantee valid mime types for browsers
    let contentType = tgResponse.headers['content-type'];
    const ext = (item.extension || '').toLowerCase().replace('.', '');

    if (!contentType || contentType === 'application/octet-stream' || contentType === 'text/plain' || (isImage && !contentType.startsWith('image/'))) {
      if (isVideo) {
        if (ext === 'webm') contentType = 'video/webm';
        else if (ext === 'mov') contentType = 'video/quicktime';
        else if (ext === 'ogg' || ext === 'ogv') contentType = 'video/ogg';
        else contentType = item.mimeType || 'video/mp4';
      } else if (isAudio) {
        if (ext === 'mp3') contentType = 'audio/mpeg';
        else if (ext === 'wav') contentType = 'audio/wav';
        else if (ext === 'ogg' || ext === 'oga') contentType = 'audio/ogg';
        else contentType = item.mimeType || 'audio/mpeg';
      } else if (isImage) {
        if (ext === 'webp') contentType = 'image/webp';
        else if (ext === 'png') contentType = 'image/png';
        else if (ext === 'gif') contentType = 'image/gif';
        else if (ext === 'svg') contentType = 'image/svg+xml';
        else if (ext === 'avif') contentType = 'image/avif';
        else if (ext === 'bmp') contentType = 'image/bmp';
        else if (ext === 'ico') contentType = 'image/x-icon';
        else if (ext === 'heic' || ext === 'heif') contentType = item.servedFormat === 'jpeg' ? 'image/jpeg' : 'image/heic';
        else contentType = item.mimeType && item.mimeType.startsWith('image/') ? item.mimeType : 'image/jpeg';
      } else if (ext === 'pdf' || item.fileCategory === 'pdf' || item.mimeType === 'application/pdf') {
        contentType = 'application/pdf';
      } else {
        contentType = item.mimeType || 'application/octet-stream';
      }
    }

    const statusCode = tgResponse.status === 200 && range && isStreamable ? 206 : tgResponse.status;
    const responseHeaders = {
      ...corsHeaders,
      'Content-Type': contentType,
    };

    // Construct filename and RFC-compliant Content-Disposition
    const targetExt = resolveFileExtension(item, contentType);
    const sanitizedFilename = getSanitizedFilename(item.title, targetExt);
    const asciiFilename = sanitizedFilename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
    const utf8Filename = encodeURIComponent(sanitizedFilename);
    const dispositionType = isDownload ? 'attachment' : 'inline';

    responseHeaders['Content-Disposition'] = `${dispositionType}; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`;

    if (tgResponse.headers['content-length']) {
      responseHeaders['Content-Length'] = tgResponse.headers['content-length'];
    }
    if (tgResponse.headers['content-range']) {
      responseHeaders['Content-Range'] = tgResponse.headers['content-range'];
    }

    res.writeHead(statusCode, responseHeaders);
    return tgResponse.data.pipe(res);
  } catch (err) {
    console.error('[streamMedia proxy error]:', err.message);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'STREAM_INTERNAL_ERROR',
        message: err.message || 'Streaming failed',
      });
    }
  }
};

exports.streamVideo = exports.streamMedia;
