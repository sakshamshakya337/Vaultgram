'use strict';
const heicConvert = require('heic-convert');
const sharp = require('sharp');
const path = require('path');

const FORMAT_MIME_MAP = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  heic: 'image/heic',
  heif: 'image/heif',
  apng: 'image/apng',
  jxl: 'image/jxl',
  jp2: 'image/jp2',
};

const SUPPORTED_IMAGE_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg', 'bmp', 'ico',
  'tiff', 'tif', 'heic', 'heif', 'apng', 'jxl', 'jp2', 'jfif', 'pjpeg', 'pjp',
  'raw', 'cr2', 'nef', 'dng'
]);

/**
 * Checks if a file extension is a recognized image format
 */
function isSupportedImageExtension(ext = '') {
  const clean = String(ext || '').toLowerCase().replace(/^\./, '').trim();
  return SUPPORTED_IMAGE_EXTENSIONS.has(clean);
}

/**
 * Maps extension or format name to canonical MIME type
 */
function getMimeForFormat(formatOrExt = '') {
  if (!formatOrExt) return 'application/octet-stream';
  const clean = String(formatOrExt).toLowerCase().replace(/^\./, '').trim();
  return FORMAT_MIME_MAP[clean] || (clean.startsWith('image/') ? clean : `image/${clean}`);
}

/**
 * Detects image format from Buffer magic bytes
 */
function detectImageFormatFromBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpeg';
  }

  // PNG / APNG: 89 50 4E 47
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    if (buffer.indexOf(Buffer.from('acTL')) !== -1) {
      return 'apng';
    }
    return 'png';
  }

  // WebP: RIFF .... WEBP
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }

  // GIF: GIF87a or GIF89a
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 4) === 'GIF8') {
    return 'gif';
  }

  // BMP: BM (42 4D)
  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4D) {
    return 'bmp';
  }

  // TIFF: II*\0 (little endian) or MM\0* (big endian)
  if (buffer.length >= 4) {
    if (
      (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2A && buffer[3] === 0x00) ||
      (buffer[0] === 0x4D && buffer[1] === 0x4D && buffer[2] === 0x00 && buffer[3] === 0x2A)
    ) {
      return 'tiff';
    }
  }

  // ISOBMFF containers (AVIF, HEIC, HEIF)
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buffer.toString('ascii', 8, 12).toLowerCase();
    if (brand === 'avif' || brand === 'avis') {
      return 'avif';
    }
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) {
      return 'heic';
    }
  }

  // ICO: 00 00 01 00
  if (buffer.length >= 4 && buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) {
    return 'ico';
  }

  // SVG: starts with or contains <svg
  if (buffer.length >= 5) {
    const headStr = buffer.slice(0, Math.min(buffer.length, 1024)).toString('utf8').trim().toLowerCase();
    if (headStr.includes('<svg') || (headStr.includes('<?xml') && headStr.includes('<svg'))) {
      return 'svg';
    }
  }

  return null;
}

/**
 * Checks if a file is an Apple HEIC / HEIF image (by name, MIME, or buffer magic bytes)
 */
function isHeicFormat(filename = '', mimetype = '', buffer = null) {
  const ext = path.extname(filename || '').toLowerCase().replace('.', '');
  const mime = (mimetype || '').toLowerCase();

  if (
    ext === 'heic' ||
    ext === 'heif' ||
    mime === 'image/heic' ||
    mime === 'image/heif' ||
    mime === 'image/heic-sequence' ||
    mime === 'image/heif-sequence'
  ) {
    return true;
  }

  if (buffer && Buffer.isBuffer(buffer) && buffer.length >= 12) {
    if (buffer.toString('ascii', 4, 8) === 'ftyp') {
      const brand = buffer.toString('ascii', 8, 12).toLowerCase();
      if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) {
        return true;
      }
    }
  }

  return false;
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
 * Lightweight BMP decoder: converts uncompressed 24-bit/32-bit BMP to raw RGBA buffer
 */
function bmpToRgba(buf) {
  if (!buf || buf.length < 54 || buf.toString('ascii', 0, 2) !== 'BM') return null;
  try {
    const offset = buf.readUInt32LE(10);
    const w = buf.readInt32LE(18);
    const h = buf.readInt32LE(22);
    const bpp = buf.readUInt16LE(28);
    const compression = buf.readUInt32LE(30);

    // Only uncompressed 24-bit or 32-bit BMP
    if (compression !== 0 && compression !== 3) return null;
    if (bpp !== 24 && bpp !== 32) return null;

    const absH = Math.abs(h);
    const isTopDown = h < 0;
    const rowLen = Math.floor((bpp * w + 31) / 32) * 4;
    const rgba = Buffer.alloc(w * absH * 4);
    const bytesPerPixel = bpp / 8;

    for (let y = 0; y < absH; y++) {
      const srcRow = isTopDown ? y : (absH - 1 - y);
      const rowOffset = offset + srcRow * rowLen;
      if (rowOffset >= buf.length) break;

      for (let x = 0; x < w; x++) {
        const pxOffset = rowOffset + x * bytesPerPixel;
        if (pxOffset + 2 >= buf.length) break;

        const b = buf[pxOffset];
        const g = buf[pxOffset + 1];
        const r = buf[pxOffset + 2];
        const a = bytesPerPixel === 4 ? buf[pxOffset + 3] : 255;
        const dest = (y * w + x) * 4;
        rgba[dest] = r;
        rgba[dest + 1] = g;
        rgba[dest + 2] = b;
        rgba[dest + 3] = a;
      }
    }
    return { width: w, height: absH, data: rgba };
  } catch (err) {
    return null;
  }
}

/**
 * Generates a thumbnail JPEG buffer from an image buffer
 * Supports JPEG, PNG, WebP, AVIF, TIFF, GIF, SVG, BMP, and HEIC
 * @param {Buffer} buffer - Image file buffer
 * @param {number} width - Max thumbnail width (default 360)
 * @param {number} height - Max thumbnail height (default 360)
 * @param {string} filename - Optional original filename for format hint
 * @param {string} mimetype - Optional MIME type hint
 * @returns {Promise<Buffer|null>} - JPEG thumbnail buffer
 */
async function generateImageThumbnail(buffer, width = 360, height = 360, filename = '', mimetype = '') {
  if (!buffer || !Buffer.isBuffer(buffer)) return null;

  try {
    let imgBuffer = buffer;

    // 1. Handle HEIC / HEIF format conversion first
    if (isHeicFormat(filename, mimetype, buffer)) {
      try {
        imgBuffer = await convertHeicToJpeg(buffer, 0.85);
      } catch (heicErr) {
        console.warn('[imageService] HEIC thumbnail conversion fallback note:', heicErr.message);
      }
    }

    // 2. Handle BMP format (decode raw RGBA if sharp cannot decode BMP directly)
    const detectedFormat = detectImageFormatFromBuffer(imgBuffer);
    const ext = path.extname(filename || '').toLowerCase().replace('.', '');
    if (detectedFormat === 'bmp' || ext === 'bmp') {
      const decodedBmp = bmpToRgba(imgBuffer);
      if (decodedBmp) {
        return await sharp(decodedBmp.data, {
          raw: { width: decodedBmp.width, height: decodedBmp.height, channels: 4 },
        })
          .resize(width, height, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .jpeg({ quality: 80 })
          .toBuffer();
      }
    }

    // 3. Native Sharp processing (handles JPEG, PNG, WebP, AVIF, TIFF, GIF, SVG)
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
async function getImageMetadata(buffer, filename = '', mimetype = '') {
  if (!buffer || !Buffer.isBuffer(buffer)) return { width: 0, height: 0, format: '' };

  // Detect format from buffer magic bytes
  const magicFormat = detectImageFormatFromBuffer(buffer);

  try {
    let imgBuffer = buffer;
    if (isHeicFormat(filename, mimetype, buffer)) {
      try {
        imgBuffer = await convertHeicToJpeg(buffer, 0.5);
      } catch {}
    } else if (magicFormat === 'bmp') {
      const decodedBmp = bmpToRgba(buffer);
      if (decodedBmp) {
        return {
          width: decodedBmp.width,
          height: decodedBmp.height,
          format: 'bmp',
        };
      }
    }

    const meta = await sharp(imgBuffer).metadata();
    return {
      width: meta.width || 0,
      height: meta.height || 0,
      format: meta.format || magicFormat || '',
    };
  } catch (err) {
    return { width: 0, height: 0, format: magicFormat || '' };
  }
}

module.exports = {
  FORMAT_MIME_MAP,
  SUPPORTED_IMAGE_EXTENSIONS,
  isSupportedImageExtension,
  getMimeForFormat,
  detectImageFormatFromBuffer,
  isHeicFormat,
  convertHeicToJpeg,
  bmpToRgba,
  generateImageThumbnail,
  getImageMetadata,
};
