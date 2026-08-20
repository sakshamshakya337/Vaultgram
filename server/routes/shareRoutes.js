'use strict';
const router = require('express').Router();
const {
  createShareLink,
  getShareInfo,
  revokeShareLink,
} = require('../controllers/shareController');
const { protect, optionalAuth } = require('../middleware/auth');

// Public route: Retrieve shared file info by token
router.get('/:token/info', getShareInfo);

// Protected routes: Create & Revoke share links
router.post('/create/:id', optionalAuth, createShareLink);
router.delete('/:token', optionalAuth, revokeShareLink);

module.exports = router;
