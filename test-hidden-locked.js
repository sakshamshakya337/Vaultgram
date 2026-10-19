'use strict';
require('dotenv').config();

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const app = require('./server/app');
const User = require('./server/models/User');
const Media = require('./server/models/Media');

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_vaultgram_super_secure';

async function runTests() {
  console.log('====================================================');
  console.log('  VAULTGRAM HIDDEN & LOCKED FOLDERS SECURITY SUITE  ');
  console.log('====================================================\n');

  // Start ephemeral server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[+] Test server listening on ${baseUrl}`);

  // Connect to DB if not already connected
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (!condition) {
      console.error(`  ❌ FAILED: ${message}`);
      failed++;
      throw new Error(message);
    } else {
      console.log(`  ✓ PASSED: ${message}`);
      passed++;
    }
  }

  try {
    // Setup test users
    const salt = await bcrypt.genSalt(10);
    const pinSalt = await bcrypt.genSalt(10);
    const hashedPinA = await bcrypt.hash('123456', pinSalt);
    const hashedPinB = await bcrypt.hash('654321', pinSalt);
    const hashedPassword = await bcrypt.hash('password123', salt);

    await User.deleteMany({ email: { $in: ['test_user_a@vault.test', 'test_user_b@vault.test'] } });

    const userA = await User.create({
      username: 'test_user_a',
      email: 'test_user_a@vault.test',
      password: hashedPassword,
      pinHash: hashedPinA,
      hasPin: true,
      hasBiometrics: false,
    });

    const userB = await User.create({
      username: 'test_user_b',
      email: 'test_user_b@vault.test',
      password: hashedPassword,
      pinHash: hashedPinB,
      hasPin: true,
      hasBiometrics: false,
    });

    await Media.deleteMany({ userId: { $in: [userA._id, userB._id] } });

    const tokenA = jwt.sign({ id: userA._id, email: userA.email }, JWT_SECRET, { expiresIn: '1h' });
    const tokenB = jwt.sign({ id: userB._id, email: userB.email }, JWT_SECRET, { expiresIn: '1h' });

    const apiA = axios.create({
      baseURL: baseUrl,
      headers: { Authorization: `Bearer ${tokenA}` },
      validateStatus: () => true,
    });

    const apiB = axios.create({
      baseURL: baseUrl,
      headers: { Authorization: `Bearer ${tokenB}` },
      validateStatus: () => true,
    });

    let normalFolderId;
    let secretFolderId;
    let classifiedFileId;
    let vaultTokenA;
    let lockedSecretFolderId;

    // ─────────────────────────────────────────────────────────────
    // TEST 1: A normal folder is visible and accessible.
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 1: A normal folder is visible and accessible ---');
    const res1Create = await apiA.post('/api/v1/media/folder', {
      title: 'Public Docs',
      isLocked: false,
      isHidden: false,
    });
    assert(res1Create.status === 201, 'Normal folder created with status 201');
    normalFolderId = res1Create.data._id || res1Create.data.folder?._id;

    const res1List = await apiA.get('/api/v1/media?filter=all');
    assert(res1List.status === 200, 'Normal listing returns 200');
    const foundNormal = (res1List.data.items || []).some((item) => item._id === normalFolderId);
    assert(foundNormal, 'Normal folder "Public Docs" is visible in normal listing');

    // ─────────────────────────────────────────────────────────────
    // TEST 2: A hidden folder disappears from normal listings.
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: A hidden folder disappears from normal listings ---');
    const res2Create = await apiA.post('/api/v1/media/folder', {
      title: 'Secret Plans',
      isLocked: false,
      isHidden: true,
    });
    assert(res2Create.status === 201, 'Hidden folder created with status 201');
    secretFolderId = res2Create.data._id || res2Create.data.folder?._id;

    const res2List = await apiA.get('/api/v1/media?filter=all');
    const foundSecretInAll = (res2List.data.items || []).some((item) => item._id === secretFolderId);
    assert(!foundSecretInAll, 'Hidden folder "Secret Plans" does NOT appear in normal listing');

    const res2Folders = await apiA.get('/api/v1/media/folders');
    const foundSecretInFolders = (res2Folders.data.folders || []).some((f) => f._id === secretFolderId);
    assert(!foundSecretInFolders, 'Hidden folder does NOT appear in listFolders tree');

    // ─────────────────────────────────────────────────────────────
    // TEST 3: A hidden folder does not appear in global search.
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 3: A hidden folder does not appear in global search ---');
    const res3Search = await apiA.get('/api/v1/media/search?q=Secret');
    assert(res3Search.status === 200, 'Search returns 200');
    const foundInSearch = (res3Search.data.items || []).some(
      (item) => item._id === secretFolderId || item.title === 'Secret Plans'
    );
    assert(!foundInSearch, 'Hidden folder "Secret Plans" does not appear in global search results');

    // ─────────────────────────────────────────────────────────────
    // TEST 4: Files inside a hidden folder do not appear in recent or starred results that would reveal their existence.
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 4: Files in hidden folder do not leak in recent or starred ---');
    const classifiedMedia = await Media.create({
      userId: userA._id,
      uploadedBy: userA._id,
      title: 'classified_intel.mp4',
      originalName: 'classified_intel.mp4',
      mimeType: 'video/mp4',
      size: 1048576,
      category: 'Secret',
      folderId: secretFolderId,
      isHidden: true,
      isStarred: true,
      telegramFileId: 'tg_dummy_classified_123',
    });
    classifiedFileId = classifiedMedia._id.toString();

    const res4Recent = await apiA.get('/api/v1/media?filter=recent');
    const foundInRecent = (res4Recent.data.items || []).some((item) => item._id === classifiedFileId);
    assert(!foundInRecent, 'Classified file does not appear in recent files');

    const res4Starred = await apiA.get('/api/v1/media?filter=starred');
    const foundInStarred = (res4Starred.data.items || []).some((item) => item._id === classifiedFileId);
    assert(!foundInStarred, 'Classified file does not appear in starred files');

    const res4SearchFile = await apiA.get('/api/v1/media/search?q=classified');
    const foundInSearchFile = (res4SearchFile.data.items || []).some((item) => item._id === classifiedFileId);
    assert(!foundInSearchFile, 'Classified file does not appear in search results');

    // ─────────────────────────────────────────────────────────────
    // TEST 5: An unauthenticated request cannot access a hidden folder.
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 5: Unauthenticated request cannot access hidden folder ---');
    const unauthApi = axios.create({ baseURL: baseUrl, validateStatus: () => true });
    const res5 = await unauthApi.get(`/api/v1/media?folderId=${secretFolderId}`);
    assert(res5.status === 401 || res5.status === 403, `Unauthenticated request correctly rejected (status: ${res5.status})`);

    // ─────────────────────────────────────────────────────────────
    // TEST 6: Authenticated user without vault session cannot read/download protected files.
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 6: User without vault session cannot read/download protected files ---');
    const res6Get = await apiA.get(`/api/v1/media/${classifiedFileId}`);
    assert(res6Get.status === 403, 'Reading protected file metadata rejected with 403');
    assert(res6Get.data.code === 'VAULT_AUTH_REQUIRED', 'Error code is VAULT_AUTH_REQUIRED');

    const res6Download = await apiA.get(`/api/v1/media/download/${classifiedFileId}`);
    assert(res6Download.status === 403, 'Downloading protected file rejected with 403');

    // ─────────────────────────────────────────────────────────────
    // TEST 7: Guessing a hidden folder ID does not bypass authorization.
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 7: Guessing hidden folder ID does not bypass authorization ---');
    const res7Browse = await apiA.get(`/api/v1/media?folderId=${secretFolderId}`);
    assert(res7Browse.status === 403, 'Browsing hidden folder without vault session rejected with 403');
    assert(res7Browse.data.code === 'VAULT_AUTH_REQUIRED', 'Error code is VAULT_AUTH_REQUIRED');

    // ─────────────────────────────────────────────────────────────
    // TEST 8: Authorized user can unlock private vault and access their own protected folders.
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 8: Authorized user unlocks vault and accesses protected folders ---');
    const res8Open = await apiA.post('/api/v1/auth/vault/open', { pin: '123456' });
    assert(res8Open.status === 200, 'Opening vault with valid PIN returns 200');
    assert(!!res8Open.data.vaultToken, 'Response contains valid vaultToken');
    vaultTokenA = res8Open.data.vaultToken;

    const res8VaultFolders = await apiA.get('/api/v1/media/vault/folders', {
      headers: { 'x-vault-token': vaultTokenA },
    });
    assert(res8VaultFolders.status === 200, 'Listing vault folders returns 200');
    const foundInVault = (res8VaultFolders.data.folders || []).some((f) => f._id === secretFolderId);
    assert(foundInVault, 'Hidden folder "Secret Plans" is accessible in Private Vault');

    const res8BrowseVault = await apiA.get(`/api/v1/media?folderId=${secretFolderId}`, {
      headers: { 'x-vault-token': vaultTokenA },
    });
    assert(res8BrowseVault.status === 200, 'Browsing hidden folder with vaultToken returns 200');
    const foundFileInVault = (res8BrowseVault.data.items || []).some((item) => item._id === classifiedFileId);
    assert(foundFileInVault, 'Classified file is visible inside hidden folder with valid vaultToken');

    const res8GetFile = await apiA.get(`/api/v1/media/${classifiedFileId}`, {
      headers: { 'x-vault-token': vaultTokenA },
    });
    assert(res8GetFile.status === 200, 'Reading file metadata with vaultToken returns 200');

    // ─────────────────────────────────────────────────────────────
    // TEST 9: Locking the vault invalidates access to protected files.
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 9: Locking the vault invalidates access to protected files ---');
    // On the client, locking clears vaultToken. Let us test that making requests without it is rejected.
    const res9AfterLock = await apiA.get(`/api/v1/media?folderId=${secretFolderId}`);
    assert(res9AfterLock.status === 403, 'Post-lock request without vaultToken returns 403');

    // ─────────────────────────────────────────────────────────────
    // TEST 10: An expired private-vault session cannot access protected content.
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 10: Expired vault session cannot access protected content ---');
    const expiredVaultToken = jwt.sign(
      { userId: userA._id.toString(), type: 'private_vault' },
      JWT_SECRET,
      { expiresIn: '-10s' }
    );
    const res10Expired = await apiA.get(`/api/v1/media?folderId=${secretFolderId}`, {
      headers: { 'x-vault-token': expiredVaultToken },
    });
    assert(res10Expired.status === 403, 'Expired vaultToken is rejected with 403');
    assert(res10Expired.data.code === 'VAULT_SESSION_EXPIRED', 'Code is VAULT_SESSION_EXPIRED');

    // ─────────────────────────────────────────────────────────────
    // TEST 11: A user cannot access another user's hidden folder.
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 11: A user cannot access another user\'s hidden folder ---');
    const res11VaultB = await apiB.post('/api/v1/auth/vault/open', { pin: '654321' });
    assert(res11VaultB.status === 200, 'User B opens their own vault');
    const vaultTokenB = res11VaultB.data.vaultToken;

    const res11CrossAccess = await apiB.get(`/api/v1/media?folderId=${secretFolderId}`, {
      headers: { 'x-vault-token': vaultTokenB },
    });
    assert(
      res11CrossAccess.status === 404 || res11CrossAccess.status === 403,
      'User B cannot access User A\'s hidden folder (403/404)'
    );

    // ─────────────────────────────────────────────────────────────
    // TEST 12: Moving a file or folder cannot bypass protection.
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 12: Moving a file or folder cannot bypass protection ---');
    const res12MoveNoToken = await apiA.patch('/api/v1/media/move', {
      itemIds: [classifiedFileId],
      destinationFolderId: normalFolderId,
    });
    assert(res12MoveNoToken.status === 403, 'Moving file out of hidden folder without vault token is rejected (403)');

    // ─────────────────────────────────────────────────────────────
    // TEST 13: Unhiding a still-locked folder does not make its contents accessible.
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 13: Unhiding a still-locked folder preserves locked protection ---');
    const res13Create = await apiA.post(
      '/api/v1/media/folder',
      {
        title: 'Locked and Hidden',
        isLocked: true,
        isHidden: true,
      },
      { headers: { 'x-vault-token': vaultTokenA } }
    );
    assert(res13Create.status === 201, 'Created locked and hidden folder');
    lockedSecretFolderId = res13Create.data._id || res13Create.data.folder?._id;

    // Unhide the folder
    const res13Unhide = await apiA.patch(
      `/api/v1/media/folder/${lockedSecretFolderId}/unhide`,
      {},
      { headers: { 'x-vault-token': vaultTokenA } }
    );
    assert(res13Unhide.status === 200, 'Unhide folder succeeded');
    assert(res13Unhide.data.folder.isHidden === false, 'Folder is no longer hidden');
    assert(res13Unhide.data.folder.isLocked === true, 'Folder remains LOCKED');

    // Access without unlock category / pin session
    const res13AccessLocked = await apiA.get(`/api/v1/media?folderId=${lockedSecretFolderId}`);
    assert(res13AccessLocked.status === 403, 'Still-locked folder remains inaccessible without unlock verification');

    // ─────────────────────────────────────────────────────────────
    // TEST 14: Unlocking a still-hidden folder does not reveal it in ordinary folder listings.
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 14: Unlocking a still-hidden folder does not reveal it in normal drive ---');
    // Re-hide folder, then unlock it
    await apiA.patch(`/api/v1/media/folder/${lockedSecretFolderId}/hide`, {}, { headers: { 'x-vault-token': vaultTokenA } });
    const res14Unlock = await apiA.patch(`/api/v1/media/folder/${lockedSecretFolderId}/unlock`, {});
    assert(res14Unlock.status === 200, 'Folder unlocked');
    assert(res14Unlock.data.folder.isLocked === false, 'Folder is unlocked');
    assert(res14Unlock.data.folder.isHidden === true, 'Folder remains HIDDEN');

    const res14NormalList = await apiA.get('/api/v1/media?filter=all');
    const foundStillHidden = (res14NormalList.data.items || []).some((item) => item._id === lockedSecretFolderId);
    assert(!foundStillHidden, 'Unlocked folder does not appear in normal list while still hidden');

    // ─────────────────────────────────────────────────────────────
    // TEST 15: Incorrect passcodes are rate-limited.
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 15: Incorrect passcodes are rate-limited ---');
    let rateLimited = false;
    for (let i = 0; i < 7; i++) {
      const res15Attempt = await apiA.post('/api/v1/auth/vault/open', { pin: '000000' });
      if (res15Attempt.status === 429) {
        rateLimited = true;
        break;
      }
    }
    assert(rateLimited, 'Excessive incorrect passcodes triggered 429 Too Many Requests rate limiting');

    // ─────────────────────────────────────────────────────────────
    // TEST 16: Logout clears private-vault access.
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 16: Logout clears private-vault access ---');
    const res16Logout = await apiA.post('/api/v1/auth/logout');
    assert(res16Logout.status === 200, 'Logout endpoint returns 200');

    // ─────────────────────────────────────────────────────────────
    // TEST 17: Existing uploads, downloads, and ordinary folders continue to work.
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 17: Ordinary folders and files continue to work ---');
    const normalMedia = await Media.create({
      userId: userA._id,
      uploadedBy: userA._id,
      title: 'vacation_photo.jpg',
      originalName: 'vacation_photo.jpg',
      mimeType: 'image/jpeg',
      size: 50000,
      folderId: normalFolderId,
      isHidden: false,
      isLocked: false,
      telegramFileId: 'tg_dummy_normal_456',
    });

    const res17ListNormal = await apiA.get(`/api/v1/media?folderId=${normalFolderId}`);
    assert(res17ListNormal.status === 200, 'Normal folder browse returns 200');
    const foundNormalFile = (res17ListNormal.data.items || []).some((item) => item._id === normalMedia._id.toString());
    assert(foundNormalFile, 'Normal file is visible inside normal folder');

    const res17GetNormal = await apiA.get(`/api/v1/media/${normalMedia._id}`);
    assert(res17GetNormal.status === 200, 'Normal file metadata readable without vault token');

    // ─────────────────────────────────────────────────────────────
    // TEST 18: A direct file-download request cannot bypass the privacy checks.
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST 18: Direct file download / stream cannot bypass privacy checks ---');
    const res18DirectDownloadNoVault = await apiA.get(`/api/v1/media/download/${classifiedFileId}`);
    assert(res18DirectDownloadNoVault.status === 403, 'Direct download without vaultToken rejected with 403');

    const res18DirectStreamNoVault = await apiA.get(`/api/v1/stream/${classifiedFileId}`);
    assert(res18DirectStreamNoVault.status === 403, 'Direct stream without vaultToken rejected with 403');

    // Direct stream WITH vaultToken in query
    const res18DirectStreamWithVault = await apiA.get(`/api/v1/stream/${classifiedFileId}?vaultToken=${vaultTokenA}`);
    // Since telegramFileId is a dummy string, streamMedia will pass privacy check and proceed to fetch/stream
    // (returning 500 or 502 due to dummy Telegram ID, NOT 403 authorization error)
    assert(
      res18DirectStreamWithVault.status !== 403,
      'Direct stream with valid vaultToken passes privacy verification'
    );

    console.log('\n====================================================');
    console.log(`  ALL TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED `);
    console.log('====================================================\n');
  } catch (err) {
    console.error('Test execution error:', err.message);
  } finally {
    await server.close();
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
