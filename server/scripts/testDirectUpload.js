'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const sharp = require('sharp');
const path = require('path');
const Media = require('../models/Media');
const { uploadMedia } = require('../controllers/mediaController');

async function testPipeline() {
  console.log('Testing uploadMedia controller directly...');
  await mongoose.connect(process.env.MONGODB_URI);

  // 1. Test Standard JPEG Image
  const jpegBuffer = await sharp({
    create: { width: 120, height: 120, channels: 3, background: { r: 0, g: 150, b: 255 } },
  }).jpeg().toBuffer();

  console.log('\n--- 1. Testing Standard JPEG Upload ---');
  const reqJpeg = {
    files: {
      file: [
        {
          originalname: 'test_sample.jpg',
          mimetype: 'image/jpeg',
          buffer: jpegBuffer,
          size: jpegBuffer.length,
        },
      ],
    },
    body: {
      title: 'DirectTest JPEG',
      category: 'Tutorials',
    },
    user: null,
  };

  await new Promise((resolve, reject) => {
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        if (this.statusCode && this.statusCode >= 400) {
          console.error('Upload returned error status:', this.statusCode, data);
          return reject(new Error(data?.message || 'Upload failed'));
        }
        console.log('✓ JPEG Upload Succeeded! Doc:', {
          _id: data._id,
          title: data.title,
          fileType: data.fileType,
          fileCategory: data.fileCategory,
          mimeType: data.mimeType,
          telegramFileId: !!data.telegramFileId,
        });
        resolve(data);
      },
    };
    uploadMedia(reqJpeg, res).catch(reject);
  });

  // 2. Test Standard PNG Image
  const pngBuffer = await sharp({
    create: { width: 120, height: 120, channels: 4, background: { r: 255, g: 50, b: 150, alpha: 1 } },
  }).png().toBuffer();

  console.log('\n--- 2. Testing Standard PNG Upload ---');
  const reqPng = {
    files: {
      file: [
        {
          originalname: 'test_sample.png',
          mimetype: 'image/png',
          buffer: pngBuffer,
          size: pngBuffer.length,
        },
      ],
    },
    body: {
      title: 'DirectTest PNG',
      category: 'Tutorials',
    },
    user: null,
  };

  await new Promise((resolve, reject) => {
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        if (this.statusCode && this.statusCode >= 400) {
          console.error('Upload returned error status:', this.statusCode, data);
          return reject(new Error(data?.message || 'Upload failed'));
        }
        console.log('✓ PNG Upload Succeeded! Doc:', {
          _id: data._id,
          title: data.title,
          fileType: data.fileType,
          fileCategory: data.fileCategory,
          mimeType: data.mimeType,
        });
        resolve(data);
      },
    };
    uploadMedia(reqPng, res).catch(reject);
  });

  // 3. Test WebP Image
  const webpBuffer = await sharp({
    create: { width: 120, height: 120, channels: 3, background: { r: 100, g: 255, b: 50 } },
  }).webp().toBuffer();

  console.log('\n--- 3. Testing WebP Image Upload ---');
  const reqWebp = {
    files: {
      file: [
        {
          originalname: 'test_sample.webp',
          mimetype: 'image/webp',
          buffer: webpBuffer,
          size: webpBuffer.length,
        },
      ],
    },
    body: {
      title: 'DirectTest WebP',
      category: 'Tutorials',
    },
    user: null,
  };

  await new Promise((resolve, reject) => {
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        if (this.statusCode && this.statusCode >= 400) {
          console.error('Upload returned error status:', this.statusCode, data);
          return reject(new Error(data?.message || 'Upload failed'));
        }
        console.log('✓ WebP Upload Succeeded! Doc:', {
          _id: data._id,
          title: data.title,
          fileType: data.fileType,
          fileCategory: data.fileCategory,
          mimeType: data.mimeType,
        });
        resolve(data);
      },
    };
    uploadMedia(reqWebp, res).catch(reject);
  });

  // 4. Test Plain Text / Document Upload
  const docBuffer = Buffer.from('Testing document upload pipeline.');
  console.log('\n--- 4. Testing Document Upload ---');
  const reqDoc = {
    files: {
      file: [
        {
          originalname: 'test_notes.txt',
          mimetype: 'text/plain',
          buffer: docBuffer,
          size: docBuffer.length,
        },
      ],
    },
    body: {
      title: 'DirectTest Document',
      category: 'Tutorials',
    },
    user: null,
  };

  await new Promise((resolve, reject) => {
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        if (this.statusCode && this.statusCode >= 400) {
          console.error('Upload returned error status:', this.statusCode, data);
          return reject(new Error(data?.message || 'Upload failed'));
        }
        console.log('✓ Document Upload Succeeded! Doc:', {
          _id: data._id,
          title: data.title,
          fileType: data.fileType,
          fileCategory: data.fileCategory,
        });
        resolve(data);
      },
    };
    uploadMedia(reqDoc, res).catch(reject);
  });

  // Clean up direct test documents
  await Media.deleteMany({ title: /^DirectTest/ });
  console.log('\n========================================');
  console.log('ALL DIRECT PIPELINE UPLOAD TESTS PASSED WITH 0 ERRORS!');
  console.log('========================================');

  await mongoose.disconnect();
}

testPipeline().catch((err) => {
  console.error('Pipeline test failed:', err);
  process.exit(1);
});
