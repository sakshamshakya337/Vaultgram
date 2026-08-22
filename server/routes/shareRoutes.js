'use strict';
const router = require('express').Router();
const cors = require('cors');
const {
  createShareLink,
  createFolderShareLink,
  getShareInfo,
  getFolderShareInfo,
  streamSharedMedia,
  downloadSharedMedia,
  streamFolderSharedFile,
  downloadFolderSharedFile,
  revokeShareLink,
} = require('../controllers/shareController');
const { optionalAuth } = require('../middleware/auth');
const { streamLimiter } = require('../middleware/rateLimiter');

const publicShareCors = cors({
  origin: '*',
  methods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'DELETE'],
  allowedHeaders: ['Range', 'Authorization', 'Content-Type', 'bypass-tunnel-reminder'],
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Content-Type', 'Content-Disposition'],
});

router.options('*', publicShareCors, (_req, res) => res.sendStatus(204));

// Public routes: Folder sharing
router.get('/folder/:token', publicShareCors, getFolderShareInfo);
router.get('/folder/:token/info', publicShareCors, getFolderShareInfo);
router.get('/folder/:token/file/:fileId/stream', publicShareCors, streamLimiter, streamFolderSharedFile);
router.get('/folder/:token/file/:fileId/download', publicShareCors, streamLimiter, downloadFolderSharedFile);

// Public routes: Single-file sharing
router.get('/:token/info', publicShareCors, getShareInfo);
router.get('/:token/stream', publicShareCors, streamLimiter, streamSharedMedia);
router.get('/:token/download', publicShareCors, streamLimiter, downloadSharedMedia);

// Protected routes: Create & Revoke share links
router.post('/category/:category', publicShareCors, optionalAuth, createFolderShareLink);
router.post('/create/:id', publicShareCors, optionalAuth, createShareLink);
router.delete('/:token', publicShareCors, optionalAuth, revokeShareLink);

module.exports = router;
