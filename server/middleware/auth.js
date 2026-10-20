'use strict';
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const optionalAuth = async (req, res, next) => {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      const user = await User.findById(decoded.id).select('-password');
      if (user) {
        req.user = user;
      }
    } catch {
      // Ignore invalid token on optional auth routes
    }
  }

  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Admin privileges required' });
};

const verifyVaultToken = (req) => {
  const token =
    req.headers['x-vault-token'] ||
    req.query?.vaultToken ||
    req.body?.vaultToken ||
    req.cookies?.vaultToken;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    if (decoded && decoded.type === 'private_vault') {
      return decoded;
    }
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { expired: true };
    }
    return null;
  }
  return null;
};

const requireVaultAuth = (req, res, next) => {
  const vaultSession = verifyVaultToken(req);
  if (vaultSession?.expired) {
    return res.status(403).json({
      code: 'VAULT_SESSION_EXPIRED',
      error: 'VAULT_SESSION_EXPIRED',
      message: 'Private vault session has expired. Please unlock the vault again.',
    });
  }
  const userId = req.user?._id?.toString() || req.user?.id?.toString();
  if (!vaultSession || (userId && vaultSession.userId !== userId)) {
    return res.status(403).json({
      code: 'VAULT_AUTH_REQUIRED',
      error: 'VAULT_AUTH_REQUIRED',
      message: 'Active private vault session required',
    });
  }
  req.vaultSession = vaultSession;
  next();
};

module.exports = {
  protect,
  optionalAuth,
  requireAdmin,
  verifyVaultToken,
  requireVaultAuth,
};
