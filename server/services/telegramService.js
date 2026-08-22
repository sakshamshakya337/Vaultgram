'use strict';
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const { TELEGRAM_API_BASE, TELEGRAM_FILE_BASE } = require('../config/telegram');

/**
 * Detects general fileType from filename and MIME type
 */
function detectFileType(filename = '', mimetype = '') {
  const ext = path.extname(filename).toLowerCase().replace('.', '');

  if (mimetype.startsWith('video/') || ['mp4', 'mkv', 'mov', 'webm', 'avi', '3gp', 'flv', 'wmv', 'm4v', 'ts'].includes(ext)) {
    return 'video';
  }
  if (
    mimetype.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'avif', 'heic', 'heif', 'ico', 'tiff', 'apng', 'jfif', 'pjpeg', 'pjp'].includes(ext)
  ) {
    return 'image';
  }
  if (mimetype.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma', 'opus'].includes(ext)) {
    return 'audio';
  }
  if (
    mimetype === 'application/pdf' ||
    mimetype.includes('word') ||
    mimetype.includes('sheet') ||
    mimetype.includes('presentation') ||
    mimetype.startsWith('text/') ||
    ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp', 'csv', 'md'].includes(ext)
  ) {
    return 'document';
  }
  return 'other';
}

/**
 * Detects detailed file category
 */
function detectFileCategory(filename = '', mimetype = '') {
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  const type = detectFileType(filename, mimetype);

  if (type === 'video') return 'video';
  if (type === 'image') return 'image';
  if (type === 'audio') return 'audio';
  if (mimetype === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (type === 'document') return 'document';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'dmg'].includes(ext)) return 'archive';
  if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rs', 'php', 'rb', 'sql', 'sh', 'yaml', 'yml', 'xml'].includes(ext)) return 'code';
  return 'other';
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Execute Telegram API calls with automatic HTTP 429 rate limit backoff and transient retry
 */
async function executeWithTelegramRetry(apiCallFn, operationName = 'Telegram API', maxRetries = 3) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await apiCallFn();
    } catch (err) {
      attempt++;
      const statusCode = err.response?.status || err.response?.data?.error_code;
      const tgData = err.response?.data;
      const is429 = statusCode === 429 || tgData?.error_code === 429;

      if (is429 && attempt <= maxRetries) {
        const retryAfterSec = Number(tgData?.parameters?.retry_after) || 3;
        const waitMs = (retryAfterSec * 1000) + 300;
        console.warn(`[${operationName}] Telegram 429 rate limit hit. Waiting ${retryAfterSec}s before attempt ${attempt}/${maxRetries}...`);
        await sleep(waitMs);
        continue;
      }

      // If temporary network abort/timeout or 5xx server error, backoff and retry
      if ((err.code === 'ECONNABORTED' || statusCode >= 500) && attempt <= maxRetries) {
        const backoffMs = attempt * 2000;
        console.warn(`[${operationName}] Temporary Telegram error (${err.message}). Retrying in ${backoffMs / 1000}s (attempt ${attempt}/${maxRetries})...`);
        await sleep(backoffMs);
        continue;
      }

      throw err;
    }
  }
}

/**
 * Uploads video to Telegram with streaming support
 */
async function uploadVideoToTelegram(fileBuffer, filename, mimetype = 'video/mp4', thumbBuffer = null) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const safeFilename = filename || 'video.mp4';
  const ext = path.extname(safeFilename).toLowerCase().replace('.', '');

  if (!chatId || !botToken) {
    throw new Error('TELEGRAM_CHAT_ID or TELEGRAM_BOT_TOKEN is not configured in .env');
  }

  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('video', fileBuffer, { filename: safeFilename, contentType: mimetype || 'video/mp4' });
  if (thumbBuffer) {
    form.append('thumbnail', thumbBuffer, { filename: 'thumbnail.jpg', contentType: 'image/jpeg' });
  }
  form.append('caption', `🎬 StreamVault Video: ${safeFilename}`);
  form.append('supports_streaming', 'true');

  const { data } = await executeWithTelegramRetry(
    () =>
      axios.post(`${TELEGRAM_API_BASE()}/sendVideo`, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 180000,
      }),
    'sendVideo'
  );

  if (!data.ok || !data.result) {
    throw new Error(`Telegram video upload failed: ${data.description || 'Unknown error'}`);
  }

  const videoMeta = data.result.video || {};

  return {
    fileId: videoMeta.file_id || data.result.document?.file_id || '',
    messageId: data.result.message_id,
    duration: videoMeta.duration || 0,
    width: videoMeta.width || 0,
    height: videoMeta.height || 0,
    fileSizeBytes: fileBuffer.length,
    fileType: 'video',
    mediaType: 'video',
    fileCategory: 'video',
    extension: ext || 'mp4',
  };
}

/**
 * Uploads any document/file (PDF, DOCX, image, zip, etc.) to Telegram cloud
 */
async function uploadDocumentToTelegram(fileBuffer, filename, mimetype = 'application/octet-stream', thumbBuffer = null) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const safeFilename = filename || 'file';
  const ext = path.extname(safeFilename).toLowerCase().replace('.', '');
  const fileType = detectFileType(safeFilename, mimetype);
  const fileCategory = detectFileCategory(safeFilename, mimetype);

  if (!chatId || !botToken) {
    throw new Error('TELEGRAM_CHAT_ID or TELEGRAM_BOT_TOKEN is not configured in .env');
  }

  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('document', fileBuffer, { filename: safeFilename, contentType: mimetype || 'application/octet-stream' });
  if (thumbBuffer) {
    form.append('thumbnail', thumbBuffer, { filename: 'thumbnail.jpg', contentType: 'image/jpeg' });
  }
  form.append('caption', `📁 StreamVault File: ${safeFilename}`);

  const { data } = await executeWithTelegramRetry(
    () =>
      axios.post(`${TELEGRAM_API_BASE()}/sendDocument`, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 180000,
      }),
    'sendDocument'
  );

  if (!data.ok || !data.result) {
    throw new Error(`Telegram document upload failed: ${data.description || 'Unknown error'}`);
  }

  const docMeta = data.result.document || {};

  return {
    fileId: docMeta.file_id || '',
    messageId: data.result.message_id,
    duration: 0,
    width: 0,
    height: 0,
    fileSizeBytes: fileBuffer.length,
    fileType,
    mediaType: fileCategory,
    fileCategory,
    extension: ext,
  };
}

/**
 * Uploads media according to auto-detected type
 */
async function uploadMediaToTelegram(fileBuffer, filename, mimetype = '', thumbBuffer = null) {
  const fileType = detectFileType(filename, mimetype);
  if (fileType === 'video') {
    try {
      return await uploadVideoToTelegram(fileBuffer, filename, mimetype, thumbBuffer);
    } catch (err) {
      console.warn('sendVideo fallback to sendDocument:', err.message);
      return await uploadDocumentToTelegram(fileBuffer, filename, mimetype, thumbBuffer);
    }
  }
  return await uploadDocumentToTelegram(fileBuffer, filename, mimetype, thumbBuffer);
}

/**
 * Resolves Telegram file_id into direct CDN URL
 */
async function resolveFileUrl(fileId) {
  if (!fileId) throw new Error('fileId is missing');

  const { data } = await executeWithTelegramRetry(
    () =>
      axios.get(`${TELEGRAM_API_BASE()}/getFile`, {
        params: { file_id: fileId },
      }),
    'getFile'
  );

  if (data.ok && data.result?.file_path) {
    return `${TELEGRAM_FILE_BASE()}/${data.result.file_path}`;
  }

  throw new Error(`Could not resolve Telegram file: ${data.description || 'File not found'}`);
}

/**
 * Deletes video/file message from Telegram cloud channel
 * POST https://api.telegram.org/bot<TOKEN>/deleteMessage
 */
async function deleteVideoFromTelegram(messageId) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!chatId || !botToken) {
    console.warn('[deleteVideoFromTelegram] Telegram credentials not configured in .env');
    return { success: false, error: 'Telegram credentials missing' };
  }

  if (!messageId) {
    return { success: false, error: 'No telegramMessageId provided' };
  }

  try {
    const { data } = await executeWithTelegramRetry(
      () =>
        axios.post(`${TELEGRAM_API_BASE()}/deleteMessage`, {
          chat_id: chatId,
          message_id: messageId,
        }),
      'deleteMessage'
    );

    if (data.ok) {
      console.log(`[deleteVideoFromTelegram] Successfully deleted Telegram message ${messageId} from channel ${chatId}`);
      return { success: true, data };
    } else {
      console.warn(`[deleteVideoFromTelegram] Telegram deleteMessage returned not ok: ${data.description}`);
      return { success: false, error: data.description || 'Unknown Telegram delete error' };
    }
  } catch (err) {
    const errMsg = err.response?.data?.description || err.message;
    console.warn(`[deleteVideoFromTelegram] Telegram deleteMessage failed for messageId ${messageId}:`, errMsg);
    return { success: false, error: errMsg };
  }
}

const deleteMediaFromTelegram = deleteVideoFromTelegram;

module.exports = {
  uploadMediaToTelegram,
  uploadVideoToTelegram,
  uploadDocumentToTelegram,
  resolveFileUrl,
  deleteMediaFromTelegram,
  deleteVideoFromTelegram,
  detectFileCategory,
  detectFileType,
};
