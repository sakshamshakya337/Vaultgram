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
    if (!item) return res.status(404).json({ message: 'File not found' });

    if (item.isFolder) {
      return res.status(400).json({ message: 'Cannot stream a folder' });
    }

    // 1. Resolve direct Telegram CDN URL
    let telegramUrl = null;
    try {
      telegramUrl = await resolveFileUrl(item.telegramFileId);
    } catch (err) {
      console.warn('[streamMedia] resolveFileUrl note:', err.message);
    }

    if (!telegramUrl || !telegramUrl.startsWith('http')) {
      return res.status(404).json({ message: 'File source not reachable in Telegram cloud channel' });
    }

    const isVideo = item.fileCategory === 'video' || item.mediaType === 'video';
    const isAudio = item.fileCategory === 'audio' || item.mediaType === 'audio';
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

    const isDownload = req.query.download === '1';
    const safeFilename = encodeURIComponent(item.title || 'file');

    // Dynamic origin matching for streaming media
    const reqOrigin = req.headers.origin;
    const allowedOriginEnv = process.env.ALLOWED_ORIGIN || '*';
    const allowedOrigins = allowedOriginEnv.split(',').map((o) => o.trim());
    let allowOrigin = '*';
    if (reqOrigin && (allowedOriginEnv === '*' || allowedOrigins.includes('*') || allowedOrigins.includes(reqOrigin))) {
      allowOrigin = reqOrigin;
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

    // Fallback & guarantee valid video/audio mime types for browser <video> tags
    let contentType = tgResponse.headers['content-type'];
    if (!contentType || contentType === 'application/octet-stream' || contentType === 'text/plain') {
      if (isVideo) {
        const ext = (item.extension || '').toLowerCase().replace('.', '');
        if (ext === 'webm') contentType = 'video/webm';
        else if (ext === 'mov') contentType = 'video/quicktime';
        else if (ext === 'ogg' || ext === 'ogv') contentType = 'video/ogg';
        else contentType = item.mimeType || 'video/mp4';
      } else if (isAudio) {
        const ext = (item.extension || '').toLowerCase().replace('.', '');
        if (ext === 'mp3') contentType = 'audio/mpeg';
        else if (ext === 'wav') contentType = 'audio/wav';
        else if (ext === 'ogg' || ext === 'oga') contentType = 'audio/ogg';
        else contentType = item.mimeType || 'audio/mpeg';
      } else {
        contentType = item.mimeType || 'application/octet-stream';
      }
    }

    const statusCode = tgResponse.status === 200 && range && isStreamable ? 206 : tgResponse.status;
    const responseHeaders = {
      ...corsHeaders,
      'Content-Type': contentType,
    };

    if (isDownload) {
      responseHeaders['Content-Disposition'] = `attachment; filename="${safeFilename}"`;
    }

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
      res.status(500).json({ message: 'Streaming failed' });
    }
  }
};

exports.streamVideo = exports.streamMedia;
