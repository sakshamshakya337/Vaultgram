'use strict';
require('dotenv').config();

const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const FormData = require('form-data');
const app = require('./server/app');
const User = require('./server/models/User');
const Media = require('./server/models/Media');

const JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_vaultgram_super_secure';

async function runPrivateVaultTestSuite() {
  console.log('================================================================');
  console.log('  PRIVATE VAULT AUTHENTICATION & SESSION REGRESSION SUITE        ');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[+] Test server listening on ${baseUrl}`);

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
    // 1. Setup test users
    const salt = await bcrypt.genSalt(10);
    const pinSalt = await bcrypt.genSalt(10);
    const hashedPinA = await bcrypt.hash('123456', pinSalt);
    const hashedPassword = await bcrypt.hash('password123', salt);

    await User.deleteMany({ email: { $in: ['vault_tester_a@vault.test', 'vault_tester_b@vault.test'] } });
    await Media.deleteMany({ title: { $in: ['Test Vault Video', 'Test Public Video', 'Test Root Vault Doc'] } });

    // Mock biometric credential
    const dummyCredentialID = 'mock_cred_id_123456789';
    const dummyPublicKey = Buffer.from('mock_public_key_buffer_data').toString('base64url');

    const userA = await User.create({
      username: 'vault_tester_a',
      email: 'vault_tester_a@vault.test',
      password: hashedPassword,
      pinHash: hashedPinA,
      hasPin: true,
      hasBiometrics: true,
      biometricCredentials: [
        {
          credentialID: dummyCredentialID,
          publicKey: dummyPublicKey,
          counter: 0,
          deviceLabel: 'Test TouchID Authenticator',
        },
      ],
    });

    const userB = await User.create({
      username: 'vault_tester_b',
      email: 'vault_tester_b@vault.test',
      password: hashedPassword,
      hasPin: false,
      hasBiometrics: false,
    });

    // Generate JWT access tokens
    const tokenA = jwt.sign({ id: userA._id.toString() }, JWT_SECRET, { expiresIn: '1d' });
    const tokenB = jwt.sign({ id: userB._id.toString() }, JWT_SECRET, { expiresIn: '1d' });

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

    // ─────────────────────────────────────────────────────────────
    // TEST A: Fingerprint/WebAuthn auth-options generation
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST A: Fingerprint/WebAuthn auth-options format ---');
    const resAuthOpts = await apiA.post('/api/v1/auth/biometric/auth-options');
    assert(resAuthOpts.status === 200, 'auth-options returned 200');
    assert(!!resAuthOpts.data.challenge, 'challenge present at root of response');
    assert(!!resAuthOpts.data.options, 'options property also wrapped and present');
    assert(resAuthOpts.data.options.challenge === resAuthOpts.data.challenge, 'wrapped challenge matches unwrapped challenge');
    assert(Array.isArray(resAuthOpts.data.allowCredentials), 'allowCredentials array returned');
    assert(resAuthOpts.data.allowCredentials[0].id === dummyCredentialID, 'registered credential ID matches user credential');

    // ─────────────────────────────────────────────────────────────
    // TEST B: Invalid WebAuthn assertion / bad challenge rejects vault unlock
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST B: Invalid authentication rejects vault unlock ---');
    const resBadAuth = await apiA.post('/api/v1/auth/biometric/auth-verify', {
      response: { id: 'wrong_credential_id', rawId: 'wrong' },
      forVault: true,
    });
    assert(resBadAuth.status === 400 || resBadAuth.status === 401, `Invalid biometric assertion rejected (${resBadAuth.status})`);
    assert(!resBadAuth.data.vaultToken, 'No vaultToken returned on invalid biometric assertion');

    // ─────────────────────────────────────────────────────────────
    // TEST C: Private Vault Unlock & Session Creation
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST C: Vault unlock via PIN returns verified vaultToken session ---');
    const resUnlock = await apiA.post('/api/v1/auth/vault/open', { pin: '123456' });
    assert(resUnlock.status === 200, 'Unlock endpoint returns 200');
    assert(!!resUnlock.data.vaultToken, 'vaultToken is issued');
    const vaultToken = resUnlock.data.vaultToken;

    const decoded = jwt.verify(vaultToken, JWT_SECRET);
    assert(decoded.type === 'private_vault', 'Decoded token type is private_vault');
    assert(decoded.userId === userA._id.toString(), 'Decoded token userId matches userA');

    // ─────────────────────────────────────────────────────────────
    // TEST D: Upload into hidden/private vault folder requires active vault session
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST D: Upload to hidden folder requires active vault session ---');
    // Create hidden folder
    const resHiddenFolder = await apiA.post(
      '/api/v1/media/folder',
      { title: 'Test Secret Vault Folder', isHidden: true },
      { headers: { 'x-vault-token': vaultToken } }
    );
    const hiddenFolderId = resHiddenFolder.data._id || resHiddenFolder.data.folder?._id;

    // Attempt upload without x-vault-token
    const formNoVault = new FormData();
    formNoVault.append('file', Buffer.from('fake mp4 video content test 123'), {
      filename: 'test_vault_video.mp4',
      contentType: 'video/mp4',
    });
    formNoVault.append('title', 'Test Vault Video');
    formNoVault.append('folderId', hiddenFolderId);

    const resUploadNoSession = await apiA.post('/api/v1/videos/upload', formNoVault, {
      headers: { ...formNoVault.getHeaders() },
    });
    assert(resUploadNoSession.status === 403, 'Upload to hidden folder without vault session rejected with 403');
    assert(
      resUploadNoSession.data.message.includes('Cannot upload into private vault folder without active vault session') ||
      resUploadNoSession.data.code === 'VAULT_AUTH_REQUIRED',
      'Correct error message returned'
    );

    // ─────────────────────────────────────────────────────────────
    // TEST E: Upload with expired session is rejected
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST E: Upload with expired vault session rejected ---');
    const expiredVaultToken = jwt.sign(
      { userId: userA._id.toString(), type: 'private_vault' },
      JWT_SECRET,
      { expiresIn: '-10s' }
    );

    const formExpired = new FormData();
    formExpired.append('file', Buffer.from('fake mp4 video content test expired'), {
      filename: 'test_expired.mp4',
      contentType: 'video/mp4',
    });
    formExpired.append('title', 'Test Expired Video');
    formExpired.append('folderId', hiddenFolderId);

    const resUploadExpired = await apiA.post('/api/v1/videos/upload', formExpired, {
      headers: {
        ...formExpired.getHeaders(),
        'x-vault-token': expiredVaultToken,
      },
    });
    assert(resUploadExpired.status === 403, 'Upload with expired vault token rejected with 403');
    assert(resUploadExpired.data.code === 'VAULT_SESSION_EXPIRED', 'Response code is VAULT_SESSION_EXPIRED');

    // ─────────────────────────────────────────────────────────────
    // TEST F: User B cannot upload to User A hidden folder using User B session
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST F: Another user cannot upload to protected folder ---');
    const vaultTokenB = jwt.sign(
      { userId: userB._id.toString(), type: 'private_vault' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const formUserB = new FormData();
    formUserB.append('file', Buffer.from('fake mp4 user b file'), {
      filename: 'user_b_attack.mp4',
      contentType: 'video/mp4',
    });
    formUserB.append('title', 'User B Attack');
    formUserB.append('folderId', hiddenFolderId);

    const resUploadUserB = await apiB.post('/api/v1/videos/upload', formUserB, {
      headers: {
        ...formUserB.getHeaders(),
        'x-vault-token': vaultTokenB,
      },
    });
    assert(resUploadUserB.status === 403, 'Cross-user vault upload rejected with 403');

    // ─────────────────────────────────────────────────────────────
    // TEST G: Authorized upload with valid vaultToken succeeds
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST G: Authorized upload into hidden folder with valid vaultToken ---');
    const formValid = new FormData();
    formValid.append('file', Buffer.from('fake valid video content for vault test'), {
      filename: 'test_vault_video.mp4',
      contentType: 'video/mp4',
    });
    formValid.append('title', 'Test Vault Video');
    formValid.append('folderId', hiddenFolderId);

    const resUploadValid = await apiA.post('/api/v1/videos/upload', formValid, {
      headers: {
        ...formValid.getHeaders(),
        'x-vault-token': vaultToken,
      },
    });
    // In test environment without active Telegram bot token, either 201 (mock/stub) or 500 Telegram error
    // but the session authorization check must have PASSED (status not 401 or 403)
    assert(
      resUploadValid.status !== 401 && resUploadValid.status !== 403,
      `Session verification passed on upload (status: ${resUploadValid.status})`
    );

    // ─────────────────────────────────────────────────────────────
    // TEST H: Upload directly at root of Private Vault with isHidden=true
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST H: Upload directly at root of Private Vault requires vaultToken ---');
    const formRootHidden = new FormData();
    formRootHidden.append('file', Buffer.from('fake text document content'), {
      filename: 'secret_root_doc.txt',
      contentType: 'text/plain',
    });
    formRootHidden.append('title', 'Test Root Vault Doc');
    formRootHidden.append('isHidden', 'true');

    // Without token: must be rejected
    const resRootNoToken = await apiA.post('/api/v1/videos/upload', formRootHidden, {
      headers: {
        ...formRootHidden.getHeaders(),
      },
    });
    assert(resRootNoToken.status === 403, 'Root vault upload without vault session rejected with 403');

    // With token: must pass authorization
    const formRootWithToken = new FormData();
    formRootWithToken.append('file', Buffer.from('fake text document content with token'), {
      filename: 'secret_root_doc.txt',
      contentType: 'text/plain',
    });
    formRootWithToken.append('title', 'Test Root Vault Doc');
    formRootWithToken.append('isHidden', 'true');

    const resRootWithToken = await apiA.post('/api/v1/videos/upload', formRootWithToken, {
      headers: {
        ...formRootWithToken.getHeaders(),
        'x-vault-token': vaultToken,
        'x-upload-vault': 'true',
      },
    });
    assert(
      resRootWithToken.status !== 401 && resRootWithToken.status !== 403,
      `Root vault upload passed authorization verification (status: ${resRootWithToken.status})`
    );

    // ─────────────────────────────────────────────────────────────
    // TEST I: CORS allows x-vault-token and x-upload-vault
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST I: CORS preflight allows required headers ---');
    const resCors = await axios.options(`${baseUrl}/api/v1/videos/upload`, {
      headers: {
        Origin: 'https://vaultgram-two.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization, x-vault-token, x-upload-vault',
      },
    });
    assert(resCors.status === 200 || resCors.status === 204, `OPTIONS preflight returns success (${resCors.status})`);
    const allowedH = resCors.headers['access-control-allow-headers'] || '';
    assert(allowedH.includes('x-vault-token'), 'CORS allows x-vault-token');
    assert(allowedH.includes('x-upload-vault'), 'CORS allows x-upload-vault');

    // Clean up test documents
    await User.deleteMany({ email: { $in: ['vault_tester_a@vault.test', 'vault_tester_b@vault.test'] } });
    await Media.deleteMany({ _id: hiddenFolderId });

    console.log('\n================================================================');
    console.log(`  ALL PRIVATE VAULT TESTS COMPLETED: ${passed} PASSED, ${failed} FAILED `);
    console.log('================================================================\n');

  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runPrivateVaultTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
