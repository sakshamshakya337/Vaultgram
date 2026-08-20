'use strict';
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const getRpId = (req) => {
  // 1. Explicit environment variable overrides
  const envRpId = (process.env.WEBAUTHN_RP_ID || process.env.RP_ID || '').trim();
  if (envRpId) return envRpId;

  // 2. Client origin / referer inspection
  const origin = req.get('origin') || req.get('referer') || '';
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return 'localhost';
      }
      // Never use Render backend domain as WebAuthn RP ID
      if (parsed.hostname && !parsed.hostname.includes('onrender.com')) {
        return parsed.hostname;
      }
    } catch {}
  }

  // 3. Localhost development fallback
  const host = (req.get('host') || req.hostname || '').split(':')[0];
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'localhost';
  }

  // 4. Default production frontend WebAuthn RP ID
  return 'vaultgram-two.vercel.app';
};

const getExpectedOrigin = (req) => {
  const origin = req.get('origin') || req.get('referer');
  if (origin) {
    try {
      const parsed = new URL(origin);
      return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
    } catch {}
    return origin.replace(/\/+$/, '');
  }
  return 'https://vaultgram-two.vercel.app';
};

const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: process.env.JWT_ACCESS_EXPIRY || process.env.JWT_EXPIRY || '30d',
  });
};

const createRefreshToken = async (userId) => {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await RefreshToken.create({
    userId,
    token,
    expiresAt,
  });
  return token;
};

const formatUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  hasPin: !!user.pinHash,
  hasBiometrics: Array.isArray(user.biometricCredentials) && user.biometricCredentials.length > 0,
  lockedCategories: user.lockedCategories || [],
});

/**
 * POST /api/v1/auth/register
 */
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const cleanUsername = (username || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanUsername || !cleanEmail || !password) {
      return res.status(400).json({ message: 'Please provide username, email, and password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    let existingUser = await User.findOne({
      $or: [{ email: cleanEmail }, { username: cleanUsername }],
    }).select('+password +pinHash');

    if (existingUser) {
      // If legacy document exists without a password, allow completing registration
      if (!existingUser.password) {
        existingUser.username = cleanUsername;
        existingUser.email = cleanEmail;
        existingUser.password = password; // Will be hashed by pre('save')
        await existingUser.save();

        const accessToken = generateAccessToken(existingUser._id);
        const refreshToken = await createRefreshToken(existingUser._id);
        return res.status(200).json({
          accessToken,
          refreshToken,
          token: accessToken,
          user: formatUser(existingUser),
        });
      }

      return res.status(400).json({
        message: existingUser.email === cleanEmail
          ? 'An account with this email already exists. Please Sign In.'
          : 'This username is already taken. Please choose another.',
      });
    }

    const user = await User.create({
      username: cleanUsername,
      email: cleanEmail,
      password,
    });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = await createRefreshToken(user._id);

    res.status(201).json({
      accessToken,
      refreshToken,
      token: accessToken,
      user: formatUser(user),
    });
  } catch (err) {
    console.error('[register error]:', err.message);
    res.status(500).json({ message: err.message || 'Registration failed' });
  }
};

/**
 * POST /api/v1/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const identifier = (email || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({ message: 'Please provide email/username and password' });
    }

    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { username: identifier }],
    }).select('+password +pinHash');

    if (!user) {
      return res.status(401).json({ message: 'No account found with this email or username. Please click Create Account to sign up.' });
    }

    if (!user.password) {
      return res.status(401).json({ message: 'Account needs a password setup. Please click Create Account to set your password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password. Please check your password and try again.' });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = await createRefreshToken(user._id);

    res.json({
      accessToken,
      refreshToken,
      token: accessToken,
      user: formatUser(user),
    });
  } catch (err) {
    console.error('[login error]:', err.message);
    res.status(500).json({ message: err.message || 'Login failed' });
  }
};

/**
 * POST /api/v1/auth/refresh
 * Refreshes an access token using a valid 30-day refresh token.
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const storedToken = await RefreshToken.findOne({ token: refreshToken });
    if (!storedToken) {
      return res.status(401).json({ message: 'Invalid or revoked refresh token' });
    }

    if (new Date() > storedToken.expiresAt) {
      await RefreshToken.deleteOne({ _id: storedToken._id });
      return res.status(401).json({ message: 'Refresh token has expired. Please log in again.' });
    }

    const user = await User.findById(storedToken.userId);
    if (!user) {
      await RefreshToken.deleteOne({ _id: storedToken._id });
      return res.status(401).json({ message: 'User account no longer exists.' });
    }

    const newAccessToken = generateAccessToken(user._id);

    res.json({
      accessToken: newAccessToken,
      refreshToken: storedToken.token,
      token: newAccessToken,
    });
  } catch (err) {
    console.error('[refreshToken error]:', err.message);
    res.status(500).json({ message: 'Failed to refresh token' });
  }
};

/**
 * POST /api/v1/auth/logout
 * Revokes refresh token session.
 */
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    } else if (req.user) {
      await RefreshToken.deleteMany({ userId: req.user._id });
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('[logout error]:', err.message);
    res.status(500).json({ message: 'Logout failed' });
  }
};

/**
 * GET /api/v1/auth/me
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password +pinHash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user: formatUser(user) });
  } catch (err) {
    console.error('[getMe error]:', err.message);
    res.status(500).json({ message: 'Failed to retrieve profile' });
  }
};

// ─── PIN Lock Controllers ──────────────────────────────────────────────────

/**
 * POST /api/v1/auth/pin/set
 */
exports.setPin = async (req, res) => {
  try {
    const { pin } = req.body;
    const pinStr = String(pin || '').trim();

    if (!/^\d{4,6}$/.test(pinStr)) {
      return res.status(400).json({ message: 'PIN must be a 4 to 6 digit number' });
    }

    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash(pinStr, salt);

    await User.findByIdAndUpdate(req.user._id, { pinHash });

    res.json({ message: 'App PIN set successfully', hasPin: true });
  } catch (err) {
    console.error('[setPin error]:', err.message);
    res.status(500).json({ message: 'Failed to configure PIN' });
  }
};

/**
 * POST /api/v1/auth/pin/verify
 */
exports.verifyPin = async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ valid: false, message: 'PIN is required' });
    }

    const user = await User.findById(req.user._id).select('+pinHash');
    if (!user || !user.pinHash) {
      return res.status(400).json({ valid: false, message: 'No PIN is configured for this account' });
    }

    const isValid = await user.comparePin(pin);
    if (!isValid) {
      return res.status(400).json({ valid: false, message: 'Incorrect PIN' });
    }

    res.json({ valid: true, message: 'PIN verified successfully' });
  } catch (err) {
    console.error('[verifyPin error]:', err.message);
    res.status(500).json({ valid: false, message: 'Failed to verify PIN' });
  }
};

/**
 * POST /api/v1/auth/pin/remove
 */
exports.removePin = async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.status(400).json({ message: 'Current PIN is required to remove PIN lock' });
    }

    const user = await User.findById(req.user._id).select('+pinHash');
    if (!user || !user.pinHash) {
      return res.status(400).json({ message: 'No PIN is currently configured' });
    }

    const isValid = await user.comparePin(pin);
    if (!isValid) {
      return res.status(401).json({ message: 'Incorrect current PIN' });
    }

    user.pinHash = null;
    user.lockedCategories = [];
    await user.save();

    res.json({ message: 'PIN lock removed successfully', hasPin: false, lockedCategories: [] });
  } catch (err) {
    console.error('[removePin error]:', err.message);
    res.status(500).json({ message: 'Failed to remove PIN' });
  }
};

// ─── Category-Level Lock Controllers ───────────────────────────────────────

/**
 * POST /api/v1/videos/categories/:category/lock
 */
exports.lockCategory = async (req, res) => {
  try {
    const category = decodeURIComponent(req.params.category || '').trim();
    if (!category) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const user = await User.findById(req.user._id).select('+pinHash');
    if (!user.pinHash) {
      return res.status(400).json({ message: 'Please set an app PIN before locking categories' });
    }

    if (!user.lockedCategories.includes(category)) {
      user.lockedCategories.push(category);
      await user.save();
    }

    res.json({
      message: `Category "${category}" is now locked`,
      lockedCategories: user.lockedCategories,
    });
  } catch (err) {
    console.error('[lockCategory error]:', err.message);
    res.status(500).json({ message: 'Failed to lock category' });
  }
};

/**
 * POST /api/v1/videos/categories/:category/unlock
 */
exports.unlockCategory = async (req, res) => {
  try {
    const category = decodeURIComponent(req.params.category || '').trim();
    if (!category) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const user = await User.findById(req.user._id);
    user.lockedCategories = (user.lockedCategories || []).filter(
      (c) => c.toLowerCase() !== category.toLowerCase()
    );
    await user.save();

    res.json({
      message: `Category "${category}" is now unlocked`,
      lockedCategories: user.lockedCategories,
    });
  } catch (err) {
    console.error('[unlockCategory error]:', err.message);
    res.status(500).json({ message: 'Failed to unlock category' });
  }
};

/**
 * GET /api/v1/videos/categories/locked-status
 */
exports.getLockedStatus = async (req, res) => {
  try {
    let user = null;
    if (req.user?._id) {
      user = await User.findById(req.user._id).select('+pinHash');
    }
    if (!user) {
      user = await User.findOne({ 'lockedCategories.0': { $exists: true } }).select('+pinHash');
    }
    if (!user) {
      user = await User.findOne({ pinHash: { $exists: true, $ne: null } }).select('+pinHash');
    }

    res.json({
      lockedCategories: user?.lockedCategories || [],
      hasPin: !!user?.pinHash,
      hasBiometrics: Array.isArray(user?.biometricCredentials) && user.biometricCredentials.length > 0,
    });
  } catch (err) {
    console.error('[getLockedStatus error]:', err.message);
    res.status(500).json({ message: 'Failed to retrieve locked status' });
  }
};

// ─── Biometric WebAuthn Controllers ─────────────────────────────────────────

/**
 * POST /api/v1/auth/biometric/register-options
 */
exports.getBiometricRegisterOptions = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const rpID = getRpId(req);
    const excludeCredentials = (user.biometricCredentials || []).map((c) => ({
      id: c.credentialID,
      type: 'public-key',
      transports: c.transports || [],
    }));

    const options = await generateRegistrationOptions({
      rpName: 'Vaultgram',
      rpID,
      userID: new Uint8Array(Buffer.from(user._id.toString())),
      userName: user.email,
      userDisplayName: user.username,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    user.currentChallenge = options.challenge;
    await user.save();

    res.json(options);
  } catch (err) {
    console.error('[getBiometricRegisterOptions error]:', err.message);
    res.status(500).json({ message: 'Failed to generate biometric registration options' });
  }
};

/**
 * POST /api/v1/auth/biometric/register-verify
 */
exports.verifyBiometricRegistration = async (req, res) => {
  try {
    const { response, deviceLabel } = req.body;
    if (!response) {
      return res.status(400).json({ message: 'Biometric response is required' });
    }

    const user = await User.findById(req.user._id).select('+currentChallenge');
    if (!user || !user.currentChallenge) {
      return res.status(400).json({ message: 'Challenge expired. Please retry.' });
    }

    const rpID = getRpId(req);
    const expectedOrigin = getExpectedOrigin(req);

    const allowedOrigins = [
      expectedOrigin,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://vaultgram-two.vercel.app',
    ];

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: allowedOrigins,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ verified: false, message: 'Biometric verification failed' });
    }

    const { credential } = verification.registrationInfo;
    const credentialID = typeof credential.id === 'string'
      ? credential.id
      : Buffer.from(credential.id).toString('base64url');
    const publicKey = Buffer.from(credential.publicKey).toString('base64url');

    // Store in user's biometricCredentials
    user.biometricCredentials = user.biometricCredentials || [];
    user.biometricCredentials.push({
      credentialID,
      publicKey,
      counter: credential.counter || 0,
      deviceLabel: deviceLabel || 'Biometric Authenticator',
      transports: response?.response?.transports || [],
    });

    user.currentChallenge = null;
    await user.save();

    res.json({
      verified: true,
      hasBiometrics: true,
      message: 'Biometric registered successfully',
    });
  } catch (err) {
    console.error('[verifyBiometricRegistration error]:', err.message);
    res.status(500).json({ verified: false, message: err.message || 'Failed to verify biometric registration' });
  }
};

/**
 * POST /api/v1/auth/biometric/auth-options
 */
exports.getBiometricAuthOptions = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !user.biometricCredentials || user.biometricCredentials.length === 0) {
      return res.status(400).json({ message: 'No biometric credentials registered on this account' });
    }

    const rpID = getRpId(req);
    const allowCredentials = user.biometricCredentials.map((c) => ({
      id: c.credentialID,
      type: 'public-key',
      transports: c.transports || [],
    }));

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    user.currentChallenge = options.challenge;
    await user.save();

    res.json(options);
  } catch (err) {
    console.error('[getBiometricAuthOptions error]:', err.message);
    res.status(500).json({ message: 'Failed to generate biometric authentication options' });
  }
};

/**
 * POST /api/v1/auth/biometric/auth-verify
 */
exports.verifyBiometricAuth = async (req, res) => {
  try {
    const { response } = req.body;
    if (!response || !response.id) {
      return res.status(400).json({ valid: false, message: 'Invalid biometric response' });
    }

    const user = await User.findById(req.user._id).select('+currentChallenge');
    if (!user || !user.currentChallenge) {
      return res.status(400).json({ valid: false, message: 'Session expired. Please retry.' });
    }

    const dbCred = (user.biometricCredentials || []).find((c) => c.credentialID === response.id);
    if (!dbCred) {
      return res.status(400).json({ valid: false, message: 'Unrecognized biometric authenticator' });
    }

    const rpID = getRpId(req);
    const expectedOrigin = getExpectedOrigin(req);

    const allowedOrigins = [
      expectedOrigin,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://vaultgram-two.vercel.app',
    ];

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: allowedOrigins,
      expectedRPID: rpID,
      credential: {
        id: dbCred.credentialID,
        publicKey: Buffer.from(dbCred.publicKey, 'base64url'),
        counter: dbCred.counter || 0,
        transports: dbCred.transports || [],
      },
    });

    if (!verification.verified) {
      return res.status(401).json({ valid: false, message: 'Biometric verification failed' });
    }

    dbCred.counter = verification.authenticationInfo.newCounter;
    user.currentChallenge = null;
    await user.save();

    res.json({
      valid: true,
      message: 'Biometrics verified successfully',
    });
  } catch (err) {
    console.error('[verifyBiometricAuth error]:', err.message);
    res.status(500).json({ valid: false, message: err.message || 'Biometric authentication error' });
  }
};

/**
 * POST /api/v1/auth/biometric/remove
 */
exports.removeBiometrics = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.biometricCredentials = [];
    await user.save();

    res.json({
      message: 'Biometrics disabled successfully',
      hasBiometrics: false,
    });
  } catch (err) {
    console.error('[removeBiometrics error]:', err.message);
    res.status(500).json({ message: 'Failed to disable biometrics' });
  }
};
