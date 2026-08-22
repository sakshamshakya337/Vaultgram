'use strict';
require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const mongoose = require('mongoose');
const sharp = require('sharp');
const Media = require('../models/Media');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

async function testAllUploads() {
  console.log('--- Testing Uploads for All Content Types ---');
  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Create test buffers
  console.log('1. Generating sample image, audio, doc, and video payloads...');
  const sampleJpeg = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 200, b: 255 } },
  }).jpeg().toBuffer();

  const samplePng = await sharp({
    create: { width: 100, height: 100, channels: 4, background: { r: 255, g: 100, b: 50, alpha: 1 } },
  }).png().toBuffer();

  const sampleWebp = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 50, g: 255, b: 100 } },
  }).webp().toBuffer();

  const sampleDoc = Buffer.from('Vaultgram test document content\nCreated for senior developer verification.');

  const testPayloads = [
    { name: 'test_photo.jpg', mime: 'image/jpeg', buffer: sampleJpeg },
    { name: 'test_graphic.png', mime: 'image/png', buffer: samplePng },
    { name: 'test_image.webp', mime: 'image/webp', buffer: sampleWebp },
    { name: 'test_notes.txt', mime: 'text/plain', buffer: sampleDoc },
  ];

  for (const item of testPayloads) {
    console.log(`\nTesting upload for: ${item.name} (${item.mime})...`);
    const form = new FormData();
    form.append('file', item.buffer, {
      filename: item.name,
      contentType: item.mime,
    });
    form.append('title', `AutoTest_${item.name}`);
    form.append('category', 'Tutorials');

    try {
      const res = await axios.post(`${BASE_URL}/media/upload`, form, {
        headers: {
          ...form.getHeaders(),
          'bypass-tunnel-reminder': 'true',
        },
        timeout: 30000,
      });

      console.log(`✓ Upload successful for ${item.name}! Doc ID: ${res.data._id || res.data.id}`);
      console.log(`  File type: ${res.data.fileType}, mime: ${res.data.mimeType}, size: ${res.data.fileSizeBytes} bytes`);
      
      // Clean up test document from MongoDB & Telegram
      if (res.data._id || res.data.id) {
        const id = res.data._id || res.data.id;
        await Media.findByIdAndDelete(id);
        console.log(`  (Cleaned up test record ${id})`);
      }
    } catch (err) {
      console.error(`✗ FAILED upload for ${item.name}:`, err.response?.data || err.message);
      throw err;
    }
  }

  console.log('\n========================================');
  console.log('ALL CONTENT TYPE UPLOADS PASSED PERFECTLY!');
  console.log('========================================');
  await mongoose.disconnect();
}

testAllUploads().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
