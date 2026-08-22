'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Media = require('../models/Media');
const { uploadMedia } = require('../controllers/mediaController');

async function testVideoUpload() {
  console.log('--- Testing Video Upload Pipeline & MAX_TARGET_BYTES Fix ---');
  await mongoose.connect(process.env.MONGODB_URI);

  // Generate a minimal valid MP4 video buffer
  // We can create a dummy 2MB video buffer
  const dummyVideoBuffer = Buffer.alloc(2 * 1024 * 1024, 0x00);
  // Give it an MP4 ftyp box signature so it has valid video magic bytes
  dummyVideoBuffer.write('ftypmp42', 4, 'ascii');

  const req = {
    files: {
      file: [
        {
          originalname: 'Test_Comedy_Clip.mp4',
          mimetype: 'video/mp4',
          buffer: dummyVideoBuffer,
          size: dummyVideoBuffer.length,
        },
      ],
    },
    body: {
      title: 'Test Comedy Clip',
      category: 'Comedy',
    },
    user: null,
  };

  await new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        if (this.statusCode >= 400) {
          return reject(new Error(data?.message || `Upload failed with status ${this.statusCode}`));
        }
        console.log('✓ Upload succeeded!', {
          id: data._id,
          title: data.title,
          category: data.category,
          fileType: data.fileType,
          telegramFileId: !!data.telegramFileId,
        });
        resolve(data);
      },
    };

    uploadMedia(req, res).catch(reject);
  });

  // Clean up
  await Media.deleteMany({ title: 'Test Comedy Clip' });
  console.log('\n========================================');
  console.log('VIDEO UPLOAD TEST PASSED 100%!');
  console.log('========================================');

  await mongoose.disconnect();
}

testVideoUpload().catch((err) => {
  console.error('Video upload test failed:', err);
  process.exit(1);
});
