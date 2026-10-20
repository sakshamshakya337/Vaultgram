'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Media = require('../server/models/Media');
const User = require('../server/models/User');
const Like = require('../server/models/Like');
const WatchHistory = require('../server/models/WatchHistory');
const Playlist = require('../server/models/Playlist');
const ShareLink = require('../server/models/ShareLink');
const telegramService = require('../server/services/telegramService');
const { deleteFolderCascade } = require('../server/controllers/mediaController');

async function runTests() {
  console.log('='.repeat(70));
  console.log('     StreamVault Folder Cascade Deletion Test Suite');
  console.log('='.repeat(70));

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Error: MONGODB_URI is required to run tests');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to test MongoDB database.');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`[PASS] Test ${totalTests}: ${testName}`);
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${testName}`);
      throw new Error(`Assertion failed in: ${testName}`);
    }
  }

  // Backup original deleteTelegramMessages function for mocking
  const originalDeleteTelegramMessages = telegramService.deleteTelegramMessages;

  try {
    // Setup test users
    const testOwnerId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();

    const bcrypt = require('bcryptjs');
    const validPinHash = await bcrypt.hash('1234', 10);

    const testUser = await User.create({
      username: `cascade_test_${Date.now()}`,
      email: `cascade_test_${Date.now()}@example.com`,
      password: 'password123',
      pinHash: validPinHash,
      lockedCategories: [],
    });

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 1: Wrong-user access must be refused
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 1: Wrong-user access authorization ---');
    const folder1 = await Media.create({
      title: 'Private User Folder',
      isFolder: true,
      folderId: null,
      uploadedBy: testOwnerId,
    });

    let wrongUserError = null;
    try {
      await deleteFolderCascade(otherUserId, folder1._id);
    } catch (err) {
      wrongUserError = err;
    }
    assert(wrongUserError && wrongUserError.status === 403, 'Refuses deletion when caller is not the owner (403)');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 2: Locked folder without verification must be refused
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 2: Biometric/PIN locked folder without verification ---');
    const lockedFolder = await Media.create({
      title: 'Secret Locked Vault Folder',
      isFolder: true,
      folderId: null,
      isLocked: true,
      uploadedBy: testUser._id,
    });
    testUser.lockedCategories.push('Secret Locked Vault Folder');
    await testUser.save();

    let lockError = null;
    try {
      await deleteFolderCascade(testUser._id, lockedFolder._id, {});
    } catch (err) {
      lockError = err;
    }
    assert(lockError && lockError.status === 403, 'Refuses locked folder deletion without PIN or unlock session (403)');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 3: Locked folder with incorrect PIN must be refused
    // ──────────────────────────────────────────────────────────────────────────
    let wrongPinError = null;
    try {
      await deleteFolderCascade(testUser._id, lockedFolder._id, { pin: '9999' });
    } catch (err) {
      wrongPinError = err;
    }
    assert(wrongPinError && wrongPinError.status === 403, 'Refuses locked folder deletion with wrong PIN (403)');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 4: Locked folder with valid verification succeeds and cleans User locks
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 3: Locked folder with valid PIN unlock ---');
    // Mock telegram delete for unit test
    let deletedTgIds = [];
    telegramService.deleteTelegramMessages = async (ids) => {
      deletedTgIds.push(...ids);
      return { success: true, deletedCount: ids.length, failedIds: [], errors: [] };
    };

    const unlockRes = await deleteFolderCascade(testUser._id, lockedFolder._id, { pin: '1234' });
    assert(unlockRes.success === true, 'Locked folder successfully deletes with valid PIN');

    const updatedUser = await User.findById(testUser._id);
    assert(
      !updatedUser.lockedCategories.includes('Secret Locked Vault Folder'),
      'Folder title automatically removed from user.lockedCategories'
    );

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5: Full Cascade Deletion (folder + files + thumbnails + chunks + relations)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 4: Full cascade deletion (files, thumbnails, chunks, relations) ---');
    deletedTgIds = [];

    const parentFolder = await Media.create({
      title: 'My Project Media',
      isFolder: true,
      folderId: null,
      uploadedBy: testUser._id,
    });

    const file1 = await Media.create({
      title: 'Clip 1.mp4',
      isFolder: false,
      folderId: parentFolder._id,
      uploadedBy: testUser._id,
      telegramMessageId: 101,
      thumbnailMessageId: 102,
      chunks: [
        { partNumber: 1, telegramMessageId: 103 },
        { partNumber: 2, telegramMessageId: 104 },
      ],
    });

    const file2 = await Media.create({
      title: 'Cover Image.jpg',
      isFolder: false,
      folderId: parentFolder._id,
      uploadedBy: testUser._id,
      telegramMessageId: 105,
      thumbnailMessageId: 106,
    });

    // Create external references to test cross-collection cleanup
    const likeDoc = await Like.create({ userId: testUser._id, mediaId: file1._id });
    const watchDoc = await WatchHistory.create({ userId: testUser._id, mediaId: file1._id, progressSeconds: 45 });
    const playlistDoc = await Playlist.create({
      title: 'Favorites',
      userId: testUser._id,
      mediaIds: [file1._id, file2._id],
    });
    const shareDoc = await ShareLink.create({
      scope: 'file',
      fileId: file1._id,
      token: `token_${Date.now()}_1`,
    });
    const folderShareDoc = await ShareLink.create({
      scope: 'folder',
      folderTitle: 'My Project Media',
      category: 'My Project Media',
      token: `token_${Date.now()}_2`,
    });

    // Separate folder to verify isolation (must NOT be touched)
    const unrelatedFolder = await Media.create({
      title: 'Untouched Folder',
      isFolder: true,
      folderId: null,
      uploadedBy: testUser._id,
    });
    const unrelatedFile = await Media.create({
      title: 'Keep Me.mp4',
      isFolder: false,
      folderId: unrelatedFolder._id,
      uploadedBy: testUser._id,
      telegramMessageId: 999,
    });

    const cascadeResult = await deleteFolderCascade(testUser._id, parentFolder._id, {
      deleteTelegramMessages: async (ids) => {
        deletedTgIds.push(...ids);
        return { success: true, deletedCount: ids.length, failedIds: [], errors: [] };
      },
    });
    assert(cascadeResult.success === true, 'Cascade delete reports success');
    assert(cascadeResult.deletedFilesCount === 2, 'Reports exactly 2 files deleted');
    assert(cascadeResult.deletedFoldersCount === 1, 'Reports exactly 1 folder deleted');

    // Verify all Telegram message IDs were sent for deletion
    // file1 msg 101, thumb 102, chunks 103, 104; file2 msg 105, thumb 106 => [101, 102, 103, 104, 105, 106]
    const expectedIds = [101, 102, 103, 104, 105, 106];
    const allExpectedPresent = expectedIds.every((id) => deletedTgIds.includes(id));
    assert(allExpectedPresent, 'All file, thumbnail, and chunk message IDs were dispatched to Telegram');
    assert(!deletedTgIds.includes(999), 'Never dispatches message IDs belonging to unrelated folders');

    // Verify MongoDB documents are purged
    const dbFolder = await Media.findById(parentFolder._id);
    const dbFile1 = await Media.findById(file1._id);
    const dbFile2 = await Media.findById(file2._id);
    assert(!dbFolder && !dbFile1 && !dbFile2, 'All Media records (folder & files) purged from MongoDB');

    // Verify cross-collection cleanups
    const dbLike = await Like.findById(likeDoc._id);
    const dbWatch = await WatchHistory.findById(watchDoc._id);
    const dbShare = await ShareLink.findById(shareDoc._id);
    const dbFolderShare = await ShareLink.findById(folderShareDoc._id);
    const dbPlaylist = await Playlist.findById(playlistDoc._id);

    assert(!dbLike, 'Related Likes document purged');
    assert(!dbWatch, 'Related WatchHistory document purged');
    assert(!dbShare, 'Related file ShareLink document purged');
    assert(!dbFolderShare, 'Related folder ShareLink document purged');
    assert(dbPlaylist && dbPlaylist.mediaIds.length === 0, 'File IDs pulled from Playlist mediaIds');

    // Verify unrelated data remains intact
    const dbUnrelatedFolder = await Media.findById(unrelatedFolder._id);
    const dbUnrelatedFile = await Media.findById(unrelatedFile._id);
    assert(dbUnrelatedFolder && dbUnrelatedFile, 'Unrelated folder and file completely preserved');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 6: Nested Subfolder Tree Cascade
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 5: Nested subfolder tree cascade ---');
    const rootFolder = await Media.create({ title: 'Root Tree', isFolder: true, uploadedBy: testUser._id });
    const subFolder1 = await Media.create({ title: 'Sub 1', isFolder: true, folderId: rootFolder._id, uploadedBy: testUser._id });
    const subSubFolder = await Media.create({ title: 'Deep Sub 2', isFolder: true, folderId: subFolder1._id, uploadedBy: testUser._id });

    const deepFile = await Media.create({
      title: 'Deep File.pdf',
      isFolder: false,
      folderId: subSubFolder._id,
      uploadedBy: testUser._id,
      telegramMessageId: 301,
    });

    const treeRes = await deleteFolderCascade(testUser._id, rootFolder._id, {
      deleteTelegramMessages: async (ids) => ({ success: true, deletedCount: ids.length, failedIds: [], errors: [] }),
    });
    assert(treeRes.success === true, 'Tree cascade delete succeeds');
    assert(treeRes.deletedFoldersCount === 3, 'All 3 levels of folders counted in deletion');
    assert(treeRes.deletedFilesCount === 1, 'Deep nested file counted in deletion');

    const checkDeepFile = await Media.findById(deepFile._id);
    const checkSubSub = await Media.findById(subSubFolder._id);
    const checkSub1 = await Media.findById(subFolder1._id);
    assert(!checkDeepFile && !checkSubSub && !checkSub1, 'Multi-level nested subfolders and deep files purged');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 7: Telegram failure mid-way preserves MongoDB records with delete_failed status
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 6: Telegram failure mid-way preserves MongoDB records ---');
    const failFolder = await Media.create({ title: 'Failure Test Folder', isFolder: true, uploadedBy: testUser._id });
    const failFile = await Media.create({
      title: 'File Pending.mp4',
      isFolder: false,
      folderId: failFolder._id,
      uploadedBy: testUser._id,
      telegramMessageId: 777,
    });

    const failRes = await deleteFolderCascade(testUser._id, failFolder._id, {
      deleteTelegramMessages: async (ids) => ({
        success: false,
        deletedCount: 0,
        failedIds: ids,
        errors: ['Network timeout or flood wait'],
      }),
    });
    assert(failRes.success === false, 'Reports failure when Telegram deletion fails');
    assert(failRes.status === 'delete_failed', 'Status set to delete_failed');

    const preservedFolder = await Media.findById(failFolder._id);
    const preservedFile = await Media.findById(failFile._id);
    assert(preservedFolder && preservedFolder.status === 'delete_failed', 'Folder document PRESERVED in MongoDB with delete_failed status');
    assert(preservedFile, 'File document PRESERVED in MongoDB to prevent orphan data loss');
    assert(preservedFolder.pendingTelegramDeletes.includes(777), 'Failed message ID 777 saved in pendingTelegramDeletes for retry');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 8: Retry completes after previous partial failure
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 7: Retry completes successfully ---');
    const retryRes = await deleteFolderCascade(testUser._id, failFolder._id, {
      deleteTelegramMessages: async (ids) => ({ success: true, deletedCount: ids.length, failedIds: [], errors: [] }),
    });
    assert(retryRes.success === true, 'Retry cascade delete completes successfully');

    const purgedRetryFolder = await Media.findById(failFolder._id);
    const purgedRetryFile = await Media.findById(failFile._id);
    assert(!purgedRetryFolder && !purgedRetryFile, 'MongoDB records purged once Telegram retry succeeds');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 9: Idempotency: Calling delete on already deleted folder returns success, NOT 404
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 8: Idempotency ---');
    const alreadyDeletedRes = await deleteFolderCascade(testUser._id, failFolder._id);
    assert(
      alreadyDeletedRes.success === true && alreadyDeletedRes.status === 'already_deleted',
      'Second delete call on already-deleted folder returns success status already_deleted instead of 404'
    );

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 10: Empty folder (0 files) deletes cleanly
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 9: Empty folder (0 files) deletion ---');
    const emptyFolder = await Media.create({
      title: 'Empty Folder',
      isFolder: true,
      uploadedBy: testUser._id,
    });

    const emptyRes = await deleteFolderCascade(testUser._id, emptyFolder._id, {
      deleteTelegramMessages: async () => ({ success: true, deletedCount: 0, failedIds: [], errors: [] }),
    });
    assert(emptyRes.success === true, 'Empty folder deletes cleanly with success: true');
    assert(emptyRes.deletedFilesCount === 0, 'Empty folder reports 0 files deleted');
    assert(emptyRes.deletedFoldersCount === 1, 'Empty folder reports 1 folder deleted');
    const dbEmptyCheck = await Media.findById(emptyFolder._id);
    assert(!dbEmptyCheck, 'Empty folder record is removed from MongoDB');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 11: Invalid folder ID format returns 400
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 10: Invalid folder ID validation ---');
    let invalidIdErr = null;
    try {
      await deleteFolderCascade(testUser._id, 'invalid-non-object-id');
    } catch (err) {
      invalidIdErr = err;
    }
    assert(invalidIdErr && invalidIdErr.status === 400, 'Invalid folder ID returns status 400');

    // Clean up test data
    await Media.deleteMany({ _id: { $in: [folder1._id, unrelatedFolder._id, unrelatedFile._id] } });
    await User.findByIdAndDelete(testUser._id);
    if (dbPlaylist) await Playlist.findByIdAndDelete(playlistDoc._id);

    // Restore real Telegram function
    telegramService.deleteTelegramMessages = originalDeleteTelegramMessages;

    console.log('\n' + '='.repeat(70));
    console.log(`ALL TESTS PASSED: ${passedTests}/${totalTests} tests succeeded!`);
    console.log('='.repeat(70));
  } catch (err) {
    // Restore real Telegram function on error
    telegramService.deleteTelegramMessages = originalDeleteTelegramMessages;
    console.error('\nTest suite failed with error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
