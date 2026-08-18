'use strict';
const router = require('express').Router();
const {
  listMedia,
  getMedia,
  getFeed,
  getCategories,
  uploadMedia,
  uploadMiddleware,
  deleteMedia,
  toggleStar,
  searchMedia,
  getUserLibrary,
  createFolder,
  listFolders,
  renameItem,
  moveItem,
  trashOrDelete,
  restoreTrash,
  emptyTrash,
} = require('../controllers/mediaController');
const { protect, optionalAuth } = require('../middleware/auth');

// ─── Reels / Video Feed & Categories ─────────────────────────────────────────
router.get('/feed', optionalAuth, getFeed);
router.get('/categories', optionalAuth, getCategories);

// ─── Drive Stats & Folders ───────────────────────────────────────────────────
router.get('/user/library', optionalAuth, getUserLibrary);
router.get('/folders', optionalAuth, listFolders);
router.post('/folder', optionalAuth, createFolder);

// ─── Drive File & Folder Operations ──────────────────────────────────────────
router.patch('/:id/rename', optionalAuth, renameItem);
router.patch('/:id/move', optionalAuth, moveItem);
router.post('/:id/star', optionalAuth, toggleStar);
router.post('/:id/like', optionalAuth, toggleStar); // Alias
router.post('/:id/trash', optionalAuth, trashOrDelete);
router.post('/:id/restore', optionalAuth, restoreTrash);
router.delete('/trash/empty', optionalAuth, emptyTrash);

// ─── Listing, Search, Upload & Direct Delete ─────────────────────────────────
router.get('/', optionalAuth, listMedia);
router.get('/search', optionalAuth, searchMedia);
router.get('/:id', optionalAuth, getMedia);
router.post('/upload', optionalAuth, uploadMiddleware, uploadMedia);
router.delete('/:id', optionalAuth, trashOrDelete);

module.exports = router;
