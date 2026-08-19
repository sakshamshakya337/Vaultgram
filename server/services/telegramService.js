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
  if (mimetype.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'avif', 'ico', 'tiff'].includes(ext)) {
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

  const { data } = await axios.post(
    `${TELEGRAM_API_BASE()}/sendVideo`,
    form,
    {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 180000,
    }
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

  const { data } = await axios.post(
    `${TELEGRAM_API_BASE()}/sendDocument`,
    form,
    {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 180000,
    }
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

  const { data } = await axios.get(`${TELEGRAM_API_BASE()}/getFile`, {
    params: { file_id: fileId },
  });

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
    const { data } = await axios.post(`${TELEGRAM_API_BASE()}/deleteMessage`, {
      chat_id: chatId,
      message_id: messageId,
    });

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
