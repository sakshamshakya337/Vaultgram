'use strict';
const router = require('express').Router();
const {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  setPin,
  verifyPin,
  removePin,
  getBiometricRegisterOptions,
  verifyBiometricRegistration,
  getBiometricAuthOptions,
  verifyBiometricAuth,
  removeBiometrics,
} = require('../controllers/authController');
const { protect, optionalAuth } = require('../middleware/auth');
const { authLimiter, pinVerifyLimiter } = require('../middleware/rateLimiter');

// ─── Authentication & Session Tokens ────────────────────────────────────────
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refreshToken);
router.post('/logout', optionalAuth, logout);
router.get('/me', protect, getMe);

// ─── PIN Lock Endpoints ─────────────────────────────────────────────────────
router.post('/pin/set', protect, setPin);
router.post('/pin/verify', protect, pinVerifyLimiter, verifyPin);
router.post('/pin/remove', protect, removePin);

// ─── Biometric WebAuthn Endpoints ───────────────────────────────────────────
router.post('/biometric/register-options', protect, getBiometricRegisterOptions);
router.post('/biometric/register-verify', protect, verifyBiometricRegistration);
router.post('/biometric/auth-options', protect, getBiometricAuthOptions);
router.post('/biometric/auth-verify', protect, pinVerifyLimiter, verifyBiometricAuth);
router.post('/biometric/remove', protect, removeBiometrics);

module.exports = router;
