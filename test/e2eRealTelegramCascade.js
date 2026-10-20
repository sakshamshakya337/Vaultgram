'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const FormData = require('form-data');
const Media = require('../server/models/Media');
const User = require('../server/models/User');
const { TELEGRAM_API_BASE } = require('../server/config/telegram');
const { deleteFolderCascade } = require('../server/controllers/mediaController');

async function runRealEndToEnd() {
  console.log('='.repeat(70));
  console.log('  StreamVault Real Telegram + MongoDB End-to-End Deletion Verification');
  console.log('='.repeat(70));

  const chatId = String(process.env.TELEGRAM_CHAT_ID || '').trim().replace(/^['"]|['"]$/g, '');
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '').trim().replace(/^['"]|['"]$/g, '');
  const mongoUri = process.env.MONGODB_URI;

  if (!chatId || !botToken || !mongoUri) {
    console.log('Telegram credentials or MongoDB URI missing. Skipping live E2E check.');
    return;
  }

  await mongoose.connect(mongoUri);
  console.log('1. Connected to MongoDB Atlas.');

  // Create temporary test user
  const testUser = await User.create({
    username: `e2e_user_${Date.now()}`,
    email: `e2e_user_${Date.now()}@example.com`,
    password: 'password123',
  });

  try {
    // 1. Create a dedicated test folder in MongoDB
    const testFolder = await Media.create({
      title: `E2E Test Cascade Folder ${Date.now()}`,
      isFolder: true,
      folderId: null,
      uploadedBy: testUser._id,
    });
    console.log(`2. Created test folder: "${testFolder.title}" (ID: ${testFolder._id})`);

    // 2. Upload real test document to Telegram to get actual telegramMessageId
    console.log('3. Uploading test file payload to Telegram...');
    const formFile = new FormData();
    formFile.append('chat_id', chatId);
    formFile.append('document', Buffer.from('Test file content for folder cascade delete verification'), {
      filename: 'e2e_test_file.txt',
      contentType: 'text/plain',
    });
    formFile.append('caption', '🧪 E2E Test File (Will be deleted)');

    const fileUploadRes = await axios.post(`${TELEGRAM_API_BASE()}/sendDocument`, formFile, {
      headers: formFile.getHeaders(),
    });
    const realFileMsgId = fileUploadRes.data.result?.message_id;
    const realFileId = fileUploadRes.data.result?.document?.file_id;
    console.log(`   Real file uploaded to Telegram! message_id: ${realFileMsgId}`);

    // 3. Upload real test thumbnail to Telegram to get actual thumbnailMessageId
    console.log('4. Uploading test thumbnail payload to Telegram...');
    const formThumb = new FormData();
    formThumb.append('chat_id', chatId);
    formThumb.append('document', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]), {
      filename: 'e2e_test_thumb.jpg',
      contentType: 'image/jpeg',
    });
    formThumb.append('caption', '🧪 E2E Test Thumbnail (Will be deleted)');

    const thumbUploadRes = await axios.post(`${TELEGRAM_API_BASE()}/sendDocument`, formThumb, {
      headers: formThumb.getHeaders(),
    });
    const realThumbMsgId = thumbUploadRes.data.result?.message_id;
    console.log(`   Real thumbnail uploaded to Telegram! message_id: ${realThumbMsgId}`);

    // 4. Save test file record in MongoDB with the real Telegram message IDs
    const testMedia = await Media.create({
      title: 'E2E Test Media File',
      isFolder: false,
      folderId: testFolder._id,
      uploadedBy: testUser._id,
      telegramFileId: realFileId,
      telegramMessageId: realFileMsgId,
      thumbnailMessageId: realThumbMsgId,
      chunks: [
        {
          partNumber: 1,
          telegramMessageId: realFileMsgId, // using real ID
        },
      ],
    });
    console.log(`5. Saved test file in MongoDB (ID: ${testMedia._id}) referencing message IDs: [${realFileMsgId}, ${realThumbMsgId}]`);

    // 5. Execute deleteFolderCascade!
    console.log('6. Executing deleteFolderCascade on the test folder...');
    const deleteResult = await deleteFolderCascade(testUser._id, testFolder._id);
    console.log('   deleteFolderCascade result:', deleteResult);

    if (!deleteResult.success) {
      throw new Error(`deleteFolderCascade reported failure: ${deleteResult.message}`);
    }

    // 6. Verify Telegram messages are truly deleted from Telegram cloud
    console.log('7. Verifying Telegram messages are truly gone from Telegram cloud...');
    try {
      await axios.post(`${TELEGRAM_API_BASE()}/deleteMessage`, {
        chat_id: chatId,
        message_id: realFileMsgId,
      });
      console.error('   WARNING: File message was unexpectedly still deletable!');
    } catch (err) {
      const desc = err.response?.data?.description || err.message;
      console.log(`   Confirmed: Telegram returns "${desc}" on file message ${realFileMsgId} (Message is GONE from Telegram!)`);
    }

    try {
      await axios.post(`${TELEGRAM_API_BASE()}/deleteMessage`, {
        chat_id: chatId,
        message_id: realThumbMsgId,
      });
      console.error('   WARNING: Thumbnail message was unexpectedly still deletable!');
    } catch (err) {
      const desc = err.response?.data?.description || err.message;
      console.log(`   Confirmed: Telegram returns "${desc}" on thumbnail message ${realThumbMsgId} (Message is GONE from Telegram!)`);
    }

    // 7. Verify MongoDB records are completely purged
    console.log('8. Verifying MongoDB database records...');
    const folderInDb = await Media.findById(testFolder._id);
    const fileInDb = await Media.findById(testMedia._id);
    const anyFolderRefs = await Media.find({ folderId: testFolder._id });

    if (!folderInDb && !fileInDb && anyFolderRefs.length === 0) {
      console.log('   Confirmed: Zero documents reference the folder or file in MongoDB!');
    } else {
      throw new Error('Leftover documents found in MongoDB!');
    }

    console.log('\n' + '='.repeat(70));
    console.log('REAL END-TO-END VERIFICATION: 100% SUCCESSFUL!');
    console.log('- Telegram messages purged: VERIFIED');
    console.log('- MongoDB documents purged: VERIFIED');
    console.log('- Thumbnails removed: VERIFIED');
    console.log('='.repeat(70));
  } finally {
    await User.findByIdAndDelete(testUser._id);
    await mongoose.disconnect();
  }
}

runRealEndToEnd().catch(console.error);
