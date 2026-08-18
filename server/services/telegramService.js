'use strict';
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const { TELEGRAM_API_BASE, TELEGRAM_FILE_BASE } = require('../config/telegram');

/**
 * Detects file category based on extension and MIME type
 */
function detectFileCategory(filename = '', mimetype = '') {
  const ext = path.extname(filename).toLowerCase().replace('.', '');

  if (mimetype.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'avif', 'ico', 'tiff'].includes(ext)) {
    return 'image';
  }
  if (mimetype.startsWith('video/') || ['mp4', 'mkv', 'mov', 'webm', 'avi', '3gp', 'flv', 'wmv', 'm4v', 'ts'].includes(ext)) {
    return 'video';
  }
  if (mimetype.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma', 'opus'].includes(ext)) {
    return 'audio';
  }
  if (mimetype === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (
    ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp', 'csv'].includes(ext) ||
    mimetype.includes('word') ||
    mimetype.includes('sheet') ||
    mimetype.includes('presentation')
  ) {
    return 'document';
  }
  if (
    ['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rs', 'php', 'rb', 'sql', 'sh', 'yaml', 'yml', 'xml', 'md'].includes(ext)
  ) {
    return 'code';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'dmg'].includes(ext)) {
    return 'archive';
  }
  return 'other';
}

/**
 * Uploads any file directly into Telegram Channel cloud storage (0 disk used).
 */
async function uploadMediaToTelegram(fileBuffer, filename, mimetype = '', thumbBuffer = null) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const safeFilename = filename || 'file';
  const ext = path.extname(safeFilename).toLowerCase().replace('.', '');
  const fileCategory = detectFileCategory(safeFilename, mimetype);

  if (!chatId || !botToken) {
    throw new Error('TELEGRAM_CHAT_ID or TELEGRAM_BOT_TOKEN is not configured in .env');
  }

  const form = new FormData();
  form.append('chat_id', chatId);

  let endpoint = 'sendDocument';
  let mediaType = fileCategory;

  if (fileCategory === 'video') {
    endpoint = 'sendVideo';
    form.append('video', fileBuffer, { filename: safeFilename, contentType: mimetype || 'video/mp4' });
    if (thumbBuffer) {
      form.append('thumbnail', thumbBuffer, { filename: 'thumbnail.jpg', contentType: 'image/jpeg' });
    }
    form.append('caption', `🎬 Google Drive Video: ${safeFilename}`);
    form.append('supports_streaming', 'true');
  } else if (fileCategory === 'audio') {
    endpoint = 'sendAudio';
    form.append('audio', fileBuffer, { filename: safeFilename, contentType: mimetype || 'audio/mpeg' });
    form.append('caption', `🎵 Google Drive Audio: ${safeFilename}`);
  } else if (fileCategory === 'image' && fileBuffer.length <= 10 * 1024 * 1024) {
    endpoint = 'sendPhoto';
    form.append('photo', fileBuffer, { filename: safeFilename, contentType: mimetype || 'image/jpeg' });
    form.append('caption', `🖼️ Google Drive Image: ${safeFilename}`);
  } else {
    // Documents, PDFs, Archives, Code, Large Images, Executables
    endpoint = 'sendDocument';
    form.append('document', fileBuffer, { filename: safeFilename, contentType: mimetype || 'application/octet-stream' });
    if (thumbBuffer) {
      form.append('thumbnail', thumbBuffer, { filename: 'thumbnail.jpg', contentType: 'image/jpeg' });
    }
    form.append('caption', `📁 Google Drive File: ${safeFilename}`);
  }

  const { data } = await axios.post(
    `${TELEGRAM_API_BASE()}/${endpoint}`,
    form,
    {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 180000,
    }
  );

  if (!data.ok || !data.result) {
    throw new Error(`Telegram upload failed: ${data.description || 'Unknown error'}`);
  }

  let fileId = '';
  let duration = 0;
  let width = 0;
  let height = 0;

  if (data.result.video) {
    fileId = data.result.video.file_id;
    duration = data.result.video.duration || 0;
    width = data.result.video.width || 0;
    height = data.result.video.height || 0;
  } else if (data.result.audio) {
    fileId = data.result.audio.file_id;
    duration = data.result.audio.duration || 0;
  } else if (data.result.photo && Array.isArray(data.result.photo)) {
    const largestPhoto = data.result.photo[data.result.photo.length - 1];
    fileId = largestPhoto.file_id;
    width = largestPhoto.width || 0;
    height = largestPhoto.height || 0;
  } else if (data.result.document) {
    fileId = data.result.document.file_id;
  }

  console.log(`✅ [Telegram Drive Cloud] ${fileCategory} (${safeFilename}) uploaded (Msg ID: ${data.result.message_id})`);

  return {
    fileId,
    messageId: data.result.message_id,
    duration,
    width,
    height,
    fileSizeBytes: fileBuffer.length,
    mediaType,
    fileCategory,
    extension: ext,
  };
}

/**
 * Resolves a Telegram file_id into a direct streaming Telegram CDN URL.
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
 * Deletes a file message from Telegram.
 */
async function deleteMediaFromTelegram(messageId) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId || !messageId) return;

  await axios.post(`${TELEGRAM_API_BASE()}/deleteMessage`, {
    chat_id: chatId,
    message_id: messageId,
  }).catch((err) => {
    console.warn('[deleteMediaFromTelegram] Note:', err.response?.data || err.message);
  });
}

module.exports = {
  uploadMediaToTelegram,
  uploadVideoToTelegram: uploadMediaToTelegram,
  resolveFileUrl,
  deleteMediaFromTelegram,
  deleteVideoFromTelegram: deleteMediaFromTelegram,
  detectFileCategory,
};
