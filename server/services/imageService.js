'use strict';
const heicConvert = require('heic-convert');
const sharp = require('sharp');
const path = require('path');

/**
 * Checks if a file is an Apple HEIC / HEIF image
 */
function isHeicFormat(filename = '', mimetype = '') {
  const ext = path.extname(filename || '').toLowerCase().replace('.', '');
  const mime = (mimetype || '').toLowerCase();

  return (
    ext === 'heic' ||
    ext === 'heif' ||
    mime === 'image/heic' ||
    mime === 'image/heif' ||
    mime === 'image/heic-sequence' ||
    mime === 'image/heif-sequence'
  );
}

/**
 * Converts HEIC/HEIF image buffer to a universal browser-compatible JPEG buffer
 * @param {Buffer} buffer - Original HEIC/HEIF file buffer
 * @param {number} quality - JPEG quality from 0 to 1 (default 0.92)
 * @returns {Promise<Buffer>} - Converted JPEG buffer
 */
async function convertHeicToJpeg(buffer, quality = 0.92) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid image buffer provided for HEIC conversion');
  }

  try {
    const outputBuffer = await heicConvert({
      buffer,
      format: 'JPEG',
      quality,
    });
    return Buffer.from(outputBuffer);
  } catch (err) {
    console.error('[imageService] heic-convert failed:', err.message);
    // Fallback attempt via sharp in case libheif is available in sharp build
    try {
      return await sharp(buffer).jpeg({ quality: Math.round(quality * 100) }).toBuffer();
    } catch (sharpErr) {
      throw new Error(`HEIC to JPEG conversion failed: ${err.message}`);
    }
  }
}

/**
 * Generates a thumbnail JPEG buffer from an image buffer
 * @param {Buffer} buffer - Image file buffer (JPEG, PNG, WebP, AVIF, TIFF, etc.)
 * @param {number} width - Max thumbnail width (default 360)
 * @param {number} height - Max thumbnail height (default 360)
 * @returns {Promise<Buffer|null>} - JPEG thumbnail buffer
 */
async function generateImageThumbnail(buffer, width = 360, height = 360) {
  if (!buffer || !Buffer.isBuffer(buffer)) return null;

  try {
    let imgBuffer = buffer;
    if (isHeicFormat('', '') && buffer.slice(4, 12).toString().includes('ftypheic')) {
      imgBuffer = await convertHeicToJpeg(buffer, 0.85);
    }

    const thumb = await sharp(imgBuffer)
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    return thumb;
  } catch (err) {
    console.warn('[imageService] generateImageThumbnail note:', err.message);
    return null;
  }
}

/**
 * Extracts width and height metadata from image buffer
 */
async function getImageMetadata(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) return { width: 0, height: 0 };
  try {
    const meta = await sharp(buffer).metadata();
    return {
      width: meta.width || 0,
      height: meta.height || 0,
      format: meta.format || '',
    };
  } catch (err) {
    return { width: 0, height: 0 };
  }
}

module.exports = {
  isHeicFormat,
  convertHeicToJpeg,
  generateImageThumbnail,
  getImageMetadata,
};
