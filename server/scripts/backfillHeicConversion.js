'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
const Media = require('../models/Media');
const { resolveFileUrl, uploadDocumentToTelegram } = require('../services/telegramService');
const { isHeicFormat, convertHeicToJpeg, generateImageThumbnail, getImageMetadata } = require('../services/imageService');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runBackfill() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/streamvault';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB successfully.\n');

  try {
    // 1. Find all HEIC/HEIF image candidates
    const heicQuery = {
      $or: [
        { mimeType: /heic|heif/i },
        { extension: /heic|heif/i },
        { title: /\.(heic|heif)$/i },
        { originalFormat: 'heic' },
      ],
      isConverted: { $ne: true },
      isFolder: false,
      telegramFileId: { $exists: true, $ne: '' },
    };

    const heicCandidates = await Media.find(heicQuery);
    console.log(`Found ${heicCandidates.length} candidate HEIC/HEIF files requiring conversion.`);

    let convertedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < heicCandidates.length; i++) {
      const doc = heicCandidates[i];
      const indexStr = `[${i + 1}/${heicCandidates.length}]`;
      console.log(`\n${indexStr} Processing: "${doc.title}" (ID: ${doc._id})...`);

      try {
        // Resolve Telegram file URL
        const tgUrl = await resolveFileUrl(doc.telegramFileId);
        console.log(`  Downloading from Telegram CDN...`);
        const resp = await axios.get(tgUrl, {
          responseType: 'arraybuffer',
          timeout: 60000,
        });

        const rawBuffer = Buffer.from(resp.data);
        console.log(`  Original size: ${(rawBuffer.length / 1024).toFixed(1)} KB`);

        // Convert HEIC to JPEG
        console.log(`  Converting HEIC to JPEG...`);
        const jpegBuffer = await convertHeicToJpeg(rawBuffer, 0.92);
        console.log(`  Converted JPEG size: ${(jpegBuffer.length / 1024).toFixed(1)} KB`);

        // Generate thumbnail
        const thumbBuffer = await generateImageThumbnail(jpegBuffer, 360, 360);
        const base64Thumb = thumbBuffer ? `data:image/jpeg;base64,${thumbBuffer.toString('base64')}` : doc.thumbnail;

        // Upload converted JPEG back to Telegram Cloud
        const safeJpegName = `${path.parse(doc.title).name}.jpg`;
        console.log(`  Uploading converted JPEG to Telegram as "${safeJpegName}"...`);
        const uploadResult = await uploadDocumentToTelegram(jpegBuffer, safeJpegName, 'image/jpeg', thumbBuffer);

        const meta = await getImageMetadata(jpegBuffer);

        // Update MongoDB document
        doc.telegramFileId = uploadResult.fileId;
        doc.telegramMessageId = uploadResult.messageId;
        doc.extension = 'jpg';
        doc.mimeType = 'image/jpeg';
        doc.originalFormat = 'heic';
        doc.servedFormat = 'jpeg';
        doc.isConverted = true;
        doc.fileType = 'image';
        doc.fileCategory = 'image';
        doc.fileSizeBytes = jpegBuffer.length;
        if (base64Thumb) doc.thumbnail = base64Thumb;
        if (meta.width) doc.width = meta.width;
        if (meta.height) doc.height = meta.height;

        await doc.save();
        convertedCount++;
        console.log(`  ✓ Successfully converted and updated doc: ${doc._id}`);

        // Rate-limiting delay between Telegram calls
        await sleep(1200);
      } catch (fileErr) {
        failedCount++;
        console.error(`  ✗ Error converting file "${doc.title}":`, fileErr.message);
        await sleep(1000);
      }
    }

    // 2. Normalize and check WebP and general image records
    console.log('\n--- Checking WebP & General Image Records ---');
    const webpQuery = {
      $or: [
        { extension: 'webp' },
        { title: /\.webp$/i },
        { mimeType: 'image/webp' },
      ],
      isFolder: false,
    };

    const webpCandidates = await Media.find(webpQuery);
    console.log(`Found ${webpCandidates.length} WebP image records.`);
    let webpNormalized = 0;

    for (const wDoc of webpCandidates) {
      let needsSave = false;
      if (wDoc.fileType !== 'image') {
        wDoc.fileType = 'image';
        needsSave = true;
      }
      if (wDoc.fileCategory !== 'image') {
        wDoc.fileCategory = 'image';
        needsSave = true;
      }
      if (wDoc.mimeType !== 'image/webp') {
        wDoc.mimeType = 'image/webp';
        needsSave = true;
      }
      if (wDoc.extension !== 'webp') {
        wDoc.extension = 'webp';
        needsSave = true;
      }
      if (needsSave) {
        await wDoc.save();
        webpNormalized++;
      }
    }
    console.log(`Normalized ${webpNormalized} WebP records with valid image metadata.`);

    console.log('\n========================================');
    console.log(`Backfill Complete!`);
    console.log(`HEIC Converted: ${convertedCount}`);
    console.log(`HEIC Failed:    ${failedCount}`);
    console.log(`WebP Checked:   ${webpCandidates.length} (${webpNormalized} updated)`);
    console.log('========================================\n');
  } catch (err) {
    console.error('Backfill error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
  }
}

runBackfill();
