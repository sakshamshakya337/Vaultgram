'use strict';
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const Media = require('../models/Media');
const User = require('../models/User');
const WatchHistory = require('../models/WatchHistory');
const Like = require('../models/Like');
const Playlist = require('../models/Playlist');
const ShareLink = require('../models/ShareLink');
const { verifyVaultToken } = require('../middleware/auth');
const telegramService = require('../services/telegramService');
const {
  uploadMediaToTelegram,
  uploadVideoToTelegram,
  uploadDocumentToTelegram,
  deleteMediaFromTelegram,
  deleteTelegramMessages,
  detectFileCategory,
  detectFileType,
  resolveFileUrl,
} = telegramService;
const {
  compressVideoIfNeeded,
  generateVideoThumbnail,
  MAX_VIDEO_UPLOAD_SIZE_MB,
  MAX_COMPRESSED_VIDEO_SIZE_MB,
  MAX_TARGET_BYTES,
} = require('../services/videoCompressionService');
const {
  isHeicFormat,
  convertHeicToJpeg,
  generateImageThumbnail,
  getImageMetadata,
  detectImageFormatFromBuffer,
  getMimeForFormat,
  isSupportedImageExtension,
  SUPPORTED_IMAGE_EXTENSIONS,
} = require('../services/imageService');

// Multer memory storage (zero local disk usage)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: (MAX_VIDEO_UPLOAD_SIZE_MB || 200) * 1024 * 1024 }, // Configurable upload limit (default 200MB)
  fileFilter: (_req, _file, cb) => {
    // Accept ALL file mimetypes (videos, documents, images, audio, etc.)
    cb(null, true);
  },
});

exports.uploadMiddleware = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'media', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

const normalizeUploadTitle = (filename) => {
  const name = String(filename || '').trim();
  const stripped = name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').trim();
  return stripped || name || 'Untitled File';
};

const ownerOrLegacyFilter = (req) => {
  if (!req.user?._id) return null;
  return {
    $or: [{ uploadedBy: req.user._id }, { uploadedBy: null }, { uploadedBy: { $exists: false } }],
  };
};

const isSameVaultFile = (doc, name, size) => {
  const nameLc = String(name || '').trim().toLowerCase();
  const titleLc = normalizeUploadTitle(name).toLowerCase();
  const sizeNum = Number(size) || 0;
  const docName = String(doc.originalName || '').trim().toLowerCase();
  const docTitle = String(doc.title || '').trim().toLowerCase();
  const nameMatches = (docName && docName === nameLc) || docTitle === nameLc || docTitle === titleLc;
  if (!nameMatches) return false;
  const origSize = Number(doc.originalSizeBytes) || 0;
  const storedSize = Number(doc.fileSizeBytes) || 0;
  return origSize === sizeNum || storedSize === sizeNum;
};

const findExistingDuplicate = async (req, originalName, originalSizeBytes) => {
  const sizeNum = Number(originalSizeBytes) || 0;
  const name = String(originalName || '').trim();
  if (!name || !sizeNum) return null;

  const query = {
    isTrashed: { $ne: true },
    isFolder: { $ne: true },
    $or: [{ originalSizeBytes: sizeNum }, { fileSizeBytes: sizeNum }],
  };
  const owner = ownerOrLegacyFilter(req);
  if (owner) {
    query.$and = [owner];
  }

  const candidates = await Media.find(query)
    .select('title originalName originalSizeBytes fileSizeBytes')
    .lean()
    .limit(500);

  return candidates.find((doc) => isSameVaultFile(doc, name, sizeNum)) || null;
};

/**
 * POST /api/v1/media/check-duplicates
 * Body: { files: [{ name, size }] }
 */
exports.checkDuplicates = async (req, res) => {
  try {
    const incoming = Array.isArray(req.body?.files) ? req.body.files.slice(0, 80) : [];
    if (incoming.length === 0) {
      return res.json({ duplicates: [] });
    }

    const sizes = [
      ...new Set(incoming.map((f) => Number(f.size) || 0).filter((s) => s > 0)),
    ];
    if (sizes.length === 0) {
      return res.json({ duplicates: [] });
    }

    const query = {
      isTrashed: { $ne: true },
      isFolder: { $ne: true },
      $or: [{ originalSizeBytes: { $in: sizes } }, { fileSizeBytes: { $in: sizes } }],
    };
    const owner = ownerOrLegacyFilter(req);
    if (owner) {
      query.$and = [owner];
    }

    const existing = await Media.find(query)
      .select('title originalName originalSizeBytes fileSizeBytes')
      .lean()
      .limit(2000);

    const duplicates = incoming
      .filter((f) => existing.some((doc) => isSameVaultFile(doc, f.name, f.size)))
      .map((f) => ({ name: f.name, size: f.size }));

    res.json({ duplicates });
  } catch (err) {
    console.error('[checkDuplicates error]:', err.message);
    res.status(500).json({ message: 'Failed to check duplicates' });
  }
};

const ensureFileType = (item) => {
  if (!item) return item;
  const copy = { ...item };
  if (!copy.fileType) {
    if (copy.fileCategory === 'video' || copy.mediaType === 'video') copy.fileType = 'video';
    else if (copy.fileCategory === 'image' || copy.mediaType === 'image') copy.fileType = 'image';
    else if (copy.fileCategory === 'audio' || copy.mediaType === 'audio') copy.fileType = 'audio';
    else if (copy.fileCategory === 'document' || copy.fileCategory === 'pdf' || copy.mediaType === 'document') copy.fileType = 'document';
    else copy.fileType = 'other';
  }
  return copy;
};

/**
 * GET /api/v1/media or /api/v1/videos
 * Drive listing: supports cursor-based pagination, folders, categories, smart date filters, search.
 */
exports.listMedia = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 24));
    const { cursor, page: rawPage, filter: rawFilter, folderId, fileCategory, fileType, category, q, search } = req.query;
    const filterType = rawFilter || 'my-drive'; // my-drive, starred, recent, this-week, this-month, trash, vault

    const query = { status: { $ne: 'deleting' } };

    // Check Vault Session
    const vaultSession = verifyVaultToken(req);

    // If filterType is 'vault', strictly require valid vault session
    if (filterType === 'vault') {
      if (vaultSession?.expired) {
        return res.status(403).json({
          code: 'VAULT_SESSION_EXPIRED',
          error: 'VAULT_SESSION_EXPIRED',
          message: 'Private vault session has expired. Please unlock the vault again.',
          items: [],
          total: 0,
        });
      }
      if (!vaultSession) {
        return res.status(403).json({
          code: 'VAULT_AUTH_REQUIRED',
          error: 'VAULT_AUTH_REQUIRED',
          message: 'Active private vault session required',
          items: [],
          total: 0,
        });
      }
    }

    // Search query support
    const searchTerm = (q || search || '').trim();
    if (searchTerm) {
      query.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { category: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    // ─── Filter Types ─────────────────────────────────────────────────────────
    if (filterType === 'trash') {
      query.isTrashed = true;
    } else if (filterType === 'vault') {
      // Private Vault View
      query.isTrashed = { $ne: true };
      const reqUserId = req.user?._id?.toString() || req.user?.id?.toString();
      if (reqUserId) {
        query.$or = [{ uploadedBy: req.user._id }, { userId: req.user._id }];
      }
      if (!folderId || folderId === 'null' || folderId === 'root') {
        // Root of Private Vault shows all hidden folders
        query.isHidden = true;
        query.folderId = null;
      } else {
        const targetFolder = await Media.findById(folderId).lean();
        if (!targetFolder) {
          return res.status(404).json({ error: 'Folder not found', items: [], total: 0 });
        }
        const folderOwner = targetFolder.uploadedBy || targetFolder.userId;
        if (folderOwner && reqUserId && String(folderOwner) !== String(reqUserId)) {
          return res.status(403).json({
            code: 'ACCESS_DENIED',
            error: 'ACCESS_DENIED',
            message: 'Not authorized to access this folder',
            items: [],
            total: 0,
          });
        }
        query.folderId = folderId;
      }
    } else {
      query.isTrashed = { $ne: true };

      if (filterType === 'starred') {
        query.isStarred = true;
      } else if (filterType === 'recent') {
        // recent shows all files without folder constraints
      } else if (filterType === 'this-week') {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(today);
        startOfWeek.setDate(startOfWeek.getDate() - today.getDay());
        query.createdAt = { $gte: startOfWeek };
      } else if (filterType === 'this-month') {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        query.createdAt = { $gte: startOfMonth };
      } else if (category && category !== 'All') {
        if (folderId && folderId !== 'null' && folderId !== 'root') {
          query.folderId = folderId;
        }
      } else {
        // 'my-drive' or folder navigation
        if (!folderId || folderId === 'null' || folderId === 'root') {
          query.folderId = null;
        } else {
          query.folderId = folderId;
        }
      }
    }

    if (fileCategory && fileCategory !== 'all') {
      query.fileCategory = fileCategory;
    }

    if (fileType && fileType !== 'all') {
      query.fileType = fileType;
    }

    // ─── Hidden Folders & Files Isolation ─────────────────────────────────────
    // For any non-vault request: NEVER return hidden items or files inside hidden folders
    if (filterType !== 'vault') {
      const hiddenFolderDocs = await Media.find({
        isFolder: true,
        isHidden: true,
        ...(req.user?._id ? { uploadedBy: req.user._id } : {}),
      }).select('_id').lean();
      const hiddenFolderIds = hiddenFolderDocs.map((d) => d._id);

      query.isHidden = { $ne: true };

      if (folderId && folderId !== 'null' && folderId !== 'root') {
        // If a specific folderId is requested, verify if it exists and check authorization
        const targetFolder = await Media.findById(folderId).lean();
        if (targetFolder) {
          const reqUserId = req.user?._id?.toString() || req.user?.id?.toString();
          const folderOwner = targetFolder.uploadedBy || targetFolder.userId;
          if (folderOwner && reqUserId && String(folderOwner) !== String(reqUserId)) {
            return res.status(403).json({
              code: 'ACCESS_DENIED',
              error: 'ACCESS_DENIED',
              message: 'Not authorized to access this folder',
              items: [],
              total: 0,
            });
          }

          if (targetFolder.isHidden) {
            if (vaultSession?.expired) {
              return res.status(403).json({
                code: 'VAULT_SESSION_EXPIRED',
                error: 'VAULT_SESSION_EXPIRED',
                message: 'Private vault session has expired. Please unlock the vault again.',
                items: [],
                total: 0,
              });
            }
            if (!vaultSession || (reqUserId && vaultSession.userId !== reqUserId)) {
              return res.status(403).json({
                code: 'VAULT_AUTH_REQUIRED',
                error: 'VAULT_AUTH_REQUIRED',
                message: 'This folder is in your Private Vault. Please unlock Private Vault first.',
                items: [],
                total: 0,
              });
            }
            if (folderOwner && vaultSession.userId && String(folderOwner) !== String(vaultSession.userId)) {
              return res.status(403).json({
                code: 'ACCESS_DENIED',
                error: 'ACCESS_DENIED',
                message: 'Not authorized to access this folder',
                items: [],
                total: 0,
              });
            }
            // If vaultSession is valid, allow viewing the hidden folder
            delete query.isHidden;
          }
        }
      } else if (hiddenFolderIds.length > 0) {
        query.folderId = { $nin: hiddenFolderIds };
      }
    }

    // ─── Locked Categories & Folders Authorization ───────────────────────────
    let userLocked = [];
    if (req.user?._id) {
      const u = await User.findById(req.user._id).lean();
      if (Array.isArray(u?.lockedCategories)) {
        userLocked = u.lockedCategories;
      }
    }
    if (userLocked.length === 0) {
      const anyUser = await User.findOne({ 'lockedCategories.0': { $exists: true } }).lean();
      if (Array.isArray(anyUser?.lockedCategories)) {
        userLocked = anyUser.lockedCategories;
      }
    }

    const rawUnlocked = typeof req.query?.unlockedCategories === 'string'
      ? req.query.unlockedCategories
      : Array.isArray(req.query?.unlockedCategories)
      ? req.query.unlockedCategories.join(',')
      : '';

    const unlockedList = rawUnlocked
      .split(',')
      .map((c) => c.trim().replace(/^#/, '').toLowerCase())
      .filter(Boolean);

    // If requesting a specific single category
    if (category && category !== 'All') {
      const cleanCat = category.replace(/^#/, '').trim();
      const isLocked = userLocked.some((c) => c.replace(/^#/, '').toLowerCase() === cleanCat.toLowerCase());
      const isUnlockedInSession = unlockedList.some((c) => c === cleanCat.toLowerCase());
      if (isLocked && !isUnlockedInSession) {
        return res.status(403).json({
          locked: true,
          message: `Category "${cleanCat}" is locked. Unlock with biometric or PIN passcode.`,
          items: [],
          nextCursor: null,
          hasMore: false,
          total: 0,
        });
      }
      query.category = new RegExp(`^#?${cleanCat.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i');
      if (folderId && folderId !== 'null' && folderId !== 'root') {
        query.folderId = folderId;
      } else {
        delete query.folderId;
      }
    } else if (folderId && folderId !== 'null' && folderId !== 'root') {
      // ─── Custom Folder Authorization & Scoping ───────────────────────────
      const targetFolder = await Media.findOne({ _id: folderId, isFolder: true }).lean();
      if (targetFolder) {
        const reqUserId = req.user?._id?.toString() || req.user?.id?.toString();
        const folderOwner = targetFolder.uploadedBy || targetFolder.userId;
        if (folderOwner && reqUserId && String(folderOwner) !== String(reqUserId)) {
          return res.status(403).json({
            code: 'ACCESS_DENIED',
            error: 'ACCESS_DENIED',
            message: 'Not authorized to access this folder',
            items: [],
            total: 0,
          });
        }
        const folderTitle = (targetFolder.title || '').trim().toLowerCase();
        const folderIdStr = String(targetFolder._id).toLowerCase();
        const folderCat = (targetFolder.category || '').trim().replace(/^#/, '').toLowerCase();

        const isFolderLocked = targetFolder.isLocked || userLocked.some((c) => {
          const clean = (typeof c === 'string' ? c : c?.category || '').trim().replace(/^#/, '').toLowerCase();
          return clean === folderTitle || clean === folderIdStr || (folderCat && clean === folderCat);
        });

        const isFolderUnlocked = unlockedList.some((c) => {
          return c === folderTitle || c === folderIdStr || (folderCat && c === folderCat);
        });

        if (isFolderLocked && !isFolderUnlocked) {
          return res.status(403).json({
            locked: true,
            message: `Folder "${targetFolder.title}" is locked. Unlock with biometric or PIN passcode.`,
            items: [],
            nextCursor: null,
            hasMore: false,
            total: 0,
          });
        }
      }
      query.folderId = folderId;
    } else if (filterType !== 'vault') {
      // General Aggregate views: exclude locked categories from files list
      if (userLocked.length > 0) {
        const lockedRegexes = userLocked.map((c) =>
          new RegExp(`^#?${c.replace(/^#/, '').replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i')
        );
        const lockFilter = {
          $or: [
            { isFolder: true },
            { category: { $nin: lockedRegexes } }
          ]
        };
        if (query.$or) {
          query.$and = (query.$and || []).concat([{ $or: query.$or }, lockFilter]);
          delete query.$or;
        } else {
          query.$or = lockFilter.$or;
        }
      }
    }

    // Cursor-based filter
    if (cursor) {
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    let sort = { isFolder: -1, createdAt: -1, _id: -1 };
    if (req.query.sort === 'name_asc') sort = { isFolder: -1, title: 1, _id: -1 };
    if (req.query.sort === 'name_desc') sort = { isFolder: -1, title: -1, _id: -1 };
    if (req.query.sort === 'oldest') sort = { isFolder: -1, createdAt: 1, _id: 1 };
    if (req.query.sort === 'size_desc') sort = { isFolder: -1, fileSizeBytes: -1, _id: -1 };

    // Fetch limit + 1 items to determine hasMore
    const [rawItems, total] = await Promise.all([
      Media.find(query).sort(sort).limit(limit + 1).lean(),
      Media.countDocuments(query),
    ]);

    const hasMore = rawItems.length > limit;
    const items = hasMore ? rawItems.slice(0, limit) : rawItems;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]._id.toString() : null;

    // Build breadcrumbs if inside a folder
    let breadcrumbs = [{ id: 'root', title: filterType === 'vault' ? 'Private Vault' : 'My Drive' }];
    if (folderId && folderId !== 'null' && folderId !== 'root') {
      let currentFolder = await Media.findById(folderId).lean();
      const trail = [];
      while (currentFolder) {
        trail.unshift({ id: currentFolder._id.toString(), title: currentFolder.title });
        if (currentFolder.folderId) {
          currentFolder = await Media.findById(currentFolder.folderId).lean();
        } else {
          currentFolder = null;
        }
      }
      breadcrumbs = [{ id: 'root', title: filterType === 'vault' ? 'Private Vault' : 'My Drive' }, ...trail];
    }

    const formattedItems = items.map(ensureFileType);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({
      items: formattedItems,
      nextCursor,
      hasMore,
      limit,
      total,
      breadcrumbs,
    });
  } catch (err) {
    console.error('[listMedia error]:', err.message);
    res.status(500).json({ message: 'Failed to fetch drive contents' });
  }
};

/**
 * POST /api/v1/media/folder
 */
exports.createFolder = async (req, res) => {
  try {
    const { title, folderId, parentFolderId, isLocked, isHidden } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Folder title is required' });
    }

    const cleanTitle = title.trim();
    const targetParent = folderId || parentFolderId;
    const parentId = targetParent && targetParent !== 'root' && targetParent !== 'null' ? targetParent : null;

    let shouldLock = !!isLocked;
    let shouldHide = !!isHidden;
    const userId = req.user?.id || req.user?._id;

    if (parentId && userId) {
      const parentFolder = await Media.findById(parentId).lean();
      const user = await User.findById(userId).lean();
      const userLocked = user?.lockedCategories || [];
      if (parentFolder) {
        const parentTitle = (parentFolder.title || '').trim().toLowerCase();
        const parentIdStr = String(parentFolder._id).toLowerCase();
        if (userLocked.some((l) => l.toLowerCase() === parentTitle || l.toLowerCase() === parentIdStr) || parentFolder.isLocked) {
          shouldLock = true;
        }
        if (parentFolder.isHidden) {
          shouldHide = true;
        }
      }
    }

    // Require auth configured before locking or hiding
    if ((shouldLock || shouldHide) && userId) {
      const user = await User.findById(userId).select('+pinHash');
      const hasAuth = !!user?.pinHash || (user?.biometricCredentials && user.biometricCredentials.length > 0);
      if (!hasAuth) {
        shouldLock = false;
        shouldHide = false;
      }
    }

    const folder = await Media.create({
      title: cleanTitle,
      category: cleanTitle,
      isFolder: true,
      fileType: 'other',
      mediaType: 'folder',
      fileCategory: 'folder',
      folderId: parentId,
      uploadedBy: userId,
      isLocked: shouldLock,
      isHidden: shouldHide,
    });

    if (shouldLock && userId) {
      const user = await User.findById(userId).select('+pinHash');
      if (user) {
        if (!user.lockedCategories.includes(cleanTitle)) {
          user.lockedCategories.push(cleanTitle);
        }
        const folderIdStr = String(folder._id);
        if (!user.lockedCategories.includes(folderIdStr)) {
          user.lockedCategories.push(folderIdStr);
        }
        await user.save();
      }
    }

    res.status(201).json(ensureFileType(folder.toObject()));
  } catch (err) {
    console.error('[createFolder error]:', err.message);
    res.status(500).json({ message: 'Failed to create folder' });
  }
};

/**
 * PATCH /api/v1/media/folder/:id/lock
 */
exports.lockFolder = async (req, res) => {
  try {
    const folder = await Media.findOne({ _id: req.params.id, isFolder: true });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    const userId = req.user?._id || req.user?.id;
    if (folder.uploadedBy && userId && String(folder.uploadedBy) !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized to modify this folder' });
    }

    const user = await User.findById(userId).select('+pinHash');
    if (!user || (!user.pinHash && (!user.biometricCredentials || user.biometricCredentials.length === 0))) {
      return res.status(400).json({ message: 'Please set an app PIN before locking folders' });
    }

    if (req.body?.pin && user.pinHash) {
      const isValid = await user.comparePin(req.body.pin);
      if (!isValid) {
        return res.status(401).json({ message: 'Incorrect PIN' });
      }
    }

    folder.isLocked = true;
    await folder.save();

    const cleanTitle = (folder.title || '').trim();
    if (!user.lockedCategories.includes(cleanTitle)) {
      user.lockedCategories.push(cleanTitle);
    }
    const folderIdStr = String(folder._id);
    if (!user.lockedCategories.includes(folderIdStr)) {
      user.lockedCategories.push(folderIdStr);
    }
    await user.save();

    res.json({
      message: `Folder "${cleanTitle}" is now locked`,
      folder: ensureFileType(folder.toObject()),
      isLocked: true,
      isHidden: folder.isHidden,
    });
  } catch (err) {
    console.error('[lockFolder error]:', err.message);
    res.status(500).json({ message: 'Failed to lock folder' });
  }
};

/**
 * PATCH /api/v1/media/folder/:id/unlock
 */
exports.unlockFolder = async (req, res) => {
  try {
    const folder = await Media.findOne({ _id: req.params.id, isFolder: true });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    const userId = req.user?._id || req.user?.id;
    if (folder.uploadedBy && userId && String(folder.uploadedBy) !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized to modify this folder' });
    }

    const user = await User.findById(userId).select('+pinHash');
    if (req.body?.pin && user?.pinHash) {
      const isValid = await user.comparePin(req.body.pin);
      if (!isValid) {
        return res.status(401).json({ message: 'Incorrect PIN' });
      }
    }

    folder.isLocked = false;
    await folder.save();

    if (user) {
      const cleanTitle = (folder.title || '').trim().toLowerCase();
      const folderIdStr = String(folder._id).toLowerCase();
      user.lockedCategories = (user.lockedCategories || []).filter((c) => {
        const clean = (typeof c === 'string' ? c : c?.category || '').trim().toLowerCase();
        return clean !== cleanTitle && clean !== folderIdStr;
      });
      await user.save();
    }

    res.json({
      message: `Folder "${folder.title}" is now unlocked`,
      folder: ensureFileType(folder.toObject()),
      isLocked: false,
      isHidden: folder.isHidden,
    });
  } catch (err) {
    console.error('[unlockFolder error]:', err.message);
    res.status(500).json({ message: 'Failed to unlock folder' });
  }
};

/**
 * PATCH /api/v1/media/folder/:id/hide
 */
exports.hideFolder = async (req, res) => {
  try {
    const folder = await Media.findOne({ _id: req.params.id, isFolder: true });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    const userId = req.user?._id || req.user?.id;
    if (folder.uploadedBy && userId && String(folder.uploadedBy) !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized to modify this folder' });
    }

    const user = await User.findById(userId).select('+pinHash');
    if (!user || (!user.pinHash && (!user.biometricCredentials || user.biometricCredentials.length === 0))) {
      return res.status(400).json({ message: 'Please set an app PIN before hiding folders' });
    }

    if (req.body?.pin && user.pinHash) {
      const isValid = await user.comparePin(req.body.pin);
      if (!isValid) {
        return res.status(401).json({ message: 'Incorrect PIN' });
      }
    }

    folder.isHidden = true;
    await folder.save();

    // Cascade isHidden to all descendant folders and files
    const cascadeHide = async (parentId) => {
      const children = await Media.find({ folderId: parentId });
      for (const child of children) {
        child.isHidden = true;
        await child.save();
        if (child.isFolder) {
          await cascadeHide(child._id);
        }
      }
    };
    await cascadeHide(folder._id);

    res.json({
      message: `Folder "${folder.title}" is now hidden and moved to Private Vault`,
      folder: ensureFileType(folder.toObject()),
      isHidden: true,
      isLocked: folder.isLocked,
    });
  } catch (err) {
    console.error('[hideFolder error]:', err.message);
    res.status(500).json({ message: 'Failed to hide folder' });
  }
};

/**
 * PATCH /api/v1/media/folder/:id/unhide
 */
exports.unhideFolder = async (req, res) => {
  try {
    const folder = await Media.findOne({ _id: req.params.id, isFolder: true });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    const userId = req.user?._id || req.user?.id;
    if (folder.uploadedBy && userId && String(folder.uploadedBy) !== String(userId)) {
      return res.status(403).json({ message: 'Not authorized to modify this folder' });
    }

    const vaultSession = verifyVaultToken(req);
    const user = await User.findById(userId).select('+pinHash');
    if (!vaultSession) {
      if (!req.body?.pin) {
        return res.status(403).json({ message: 'Authentication required to unhide folder' });
      }
      if (user?.pinHash) {
        const isValid = await user.comparePin(req.body.pin);
        if (!isValid) {
          return res.status(401).json({ message: 'Incorrect PIN' });
        }
      }
    }

    folder.isHidden = false;
    await folder.save();

    // Cascade unhide to descendants
    const cascadeUnhide = async (parentId) => {
      const children = await Media.find({ folderId: parentId });
      for (const child of children) {
        child.isHidden = false;
        await child.save();
        if (child.isFolder) {
          await cascadeUnhide(child._id);
        }
      }
    };
    await cascadeUnhide(folder._id);

    res.json({
      message: `Folder "${folder.title}" is restored to My Cloud Drive`,
      folder: ensureFileType(folder.toObject()),
      isHidden: false,
      isLocked: folder.isLocked,
    });
  } catch (err) {
    console.error('[unhideFolder error]:', err.message);
    res.status(500).json({ message: 'Failed to unhide folder' });
  }
};

/**
 * GET /api/v1/media/vault/folders
 */
exports.listVaultFolders = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const folders = await Media.find({
      isFolder: true,
      isHidden: true,
      isTrashed: { $ne: true },
      status: { $ne: 'deleting' },
      ...(userId ? { uploadedBy: userId } : {}),
    }).sort({ title: 1 }).lean();

    const folderIds = folders.map((f) => f._id);
    const countAgg = await Media.aggregate([
      {
        $match: {
          isFolder: false,
          isTrashed: { $ne: true },
          status: { $ne: 'deleting' },
          folderId: { $in: folderIds },
        },
      },
      {
        $group: {
          _id: '$folderId',
          count: { $sum: 1 },
        },
      },
    ]);
    const countMap = {};
    for (const c of countAgg) {
      countMap[String(c._id)] = c.count;
    }

    const enhancedFolders = folders.map((f) => {
      const obj = ensureFileType(f);
      obj.itemCount = countMap[String(f._id)] || 0;
      return obj;
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ folders: enhancedFolders });
  } catch (err) {
    console.error('[listVaultFolders error]:', err.message);
    res.status(500).json({ message: 'Failed to list private vault folders' });
  }
};

/**
 * POST /api/v1/media/upload or /api/v1/videos/upload or /api/v1/files/upload
 */
exports.uploadMedia = async (req, res) => {
  const correlationId = req.headers['x-request-id'] || `up_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  try {
    const uploadedFile =
      req.files?.file?.[0] ||
      req.files?.video?.[0] ||
      req.files?.media?.[0] ||
      req.file;

    const thumbFile = req.files?.thumbnail?.[0];

    if (!uploadedFile) {
      console.warn(`[${correlationId}] [uploadMedia] No file provided in request`);
      return res.status(400).json({ message: 'No file provided for upload', requestId: correlationId });
    }

    console.log(`[${correlationId}] [uploadMedia] Incoming upload: "${uploadedFile.originalname}" (${uploadedFile.size} bytes, ${uploadedFile.mimetype})`);

    const duplicate = await findExistingDuplicate(req, uploadedFile.originalname, uploadedFile.size);
    if (duplicate) {
      return res.status(409).json({
        error: 'DUPLICATE',
        skipped: true,
        message: 'Already in your vault — skipped',
        existingId: duplicate._id,
      });
    }

    let uploadFilename = uploadedFile.originalname;
    let uploadMimetype = uploadedFile.mimetype;
    let originalFormat = '';
    let servedFormat = '';
    let isConverted = false;
    let finalBuffer = uploadedFile.buffer;
    let finalSize = uploadedFile.size;
    let isCompressed = false;
    let compressionRatio = 0;
    let compressedMeta = {};

    // ─── Format Inspection: Magic Bytes & Extension ─────────────────────────────
    const bufferImageFormat = detectImageFormatFromBuffer(uploadedFile.buffer);
    const parsedExt = path.extname(uploadedFile.originalname).replace(/^\./, '').toLowerCase();
    const effectiveImageFormat = bufferImageFormat || (isSupportedImageExtension(parsedExt) ? parsedExt : null);

    if (effectiveImageFormat) {
      // Establish canonical MIME type if missing, generic or mismatched
      if (!uploadMimetype || uploadMimetype === 'application/octet-stream' || uploadMimetype === 'image/jpeg' || !uploadMimetype.startsWith('image/')) {
        uploadMimetype = getMimeForFormat(effectiveImageFormat);
      }
      originalFormat = effectiveImageFormat;
    }

    let activeThumbBuffer = thumbFile?.buffer || null;

    // ─── Apple HEIC / HEIF Preview Generation (PRESERVES ORIGINAL BYTES) ─────────
    if (effectiveImageFormat === 'heic' || effectiveImageFormat === 'heif' || isHeicFormat(uploadedFile.originalname, uploadedFile.mimetype)) {
      console.log(`[uploadMedia] Apple HEIC/HEIF image detected: ${uploadedFile.originalname}. Generating compatible JPEG preview...`);
      originalFormat = 'heic';
      uploadMimetype = 'image/heic';
      try {
        const convertedJpegBuffer = await convertHeicToJpeg(uploadedFile.buffer);
        if (!activeThumbBuffer) {
          activeThumbBuffer = convertedJpegBuffer;
        }
        isConverted = true;
        servedFormat = 'jpeg';
        console.log(`[uploadMedia] Successfully generated compatible JPEG preview for HEIC (${(convertedJpegBuffer.length / 1024).toFixed(1)} KB)`);
      } catch (convErr) {
        console.error('[uploadMedia] HEIC preview generation error:', convErr.message);
      }
    }

    const autoFileType = effectiveImageFormat ? 'image' : detectFileType(uploadFilename, uploadMimetype);
    const autoCategory = effectiveImageFormat ? 'image' : detectFileCategory(uploadFilename, uploadMimetype);
    const videoExtRegex = /\.(mp4|mov|webm|mkv|avi|3gp|m4v|flv|ts|wmv|ogv)$/i;
    const isImage = autoFileType === 'image' || autoCategory === 'image' || (uploadMimetype && uploadMimetype.startsWith('image/')) || !!effectiveImageFormat;
    const isVideo =
      !isImage &&
      (autoFileType === 'video' ||
      autoCategory === 'video' ||
      (uploadMimetype && uploadMimetype.startsWith('video/')) ||
      videoExtRegex.test(uploadedFile.originalname) ||
      videoExtRegex.test(uploadFilename));

    // ─── Automatic Video Compression to <= 20MB ONLY when exceeding 20MB ──────
    if (isVideo) {
      if (uploadedFile.size > MAX_TARGET_BYTES) {
        console.log(`[uploadMedia] Video size (${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB) exceeds ${MAX_COMPRESSED_VIDEO_SIZE_MB}MB limit. Initiating FFmpeg compression...`);
        const compressionResult = await compressVideoIfNeeded(
          uploadedFile.buffer,
          uploadedFile.originalname,
          uploadedFile.mimetype,
          req
        );

        finalBuffer = compressionResult.buffer;
        finalSize = compressionResult.size;
        isCompressed = compressionResult.compressed;
        compressionRatio = compressionResult.compressionPercentage;
        uploadFilename = `${path.parse(uploadedFile.originalname).name}.mp4`;
        uploadMimetype = 'video/mp4';
        servedFormat = 'mp4';
        compressedMeta = {
          duration: compressionResult.duration,
          width: compressionResult.width,
          height: compressionResult.height,
        };
        console.log(`[uploadMedia] Video compressed successfully: ${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB -> ${(finalSize / (1024 * 1024)).toFixed(2)} MB (${compressionRatio}% reduction)`);
      } else {
        console.log(`[uploadMedia] Video size (${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB) is already <= ${MAX_COMPRESSED_VIDEO_SIZE_MB}MB. Skipping FFmpeg compression entirely.`);
        finalBuffer = uploadedFile.buffer;
        finalSize = uploadedFile.size;
        isCompressed = false;
        compressionRatio = 0;
      }
    } else {
      // For non-video files (images, documents), enforce Telegram standard 20MB limit
      const MAX_HOSTED_TELEGRAM_SIZE = 20 * 1024 * 1024;
      if (finalSize > MAX_HOSTED_TELEGRAM_SIZE) {
        const sizeMb = (finalSize / (1024 * 1024)).toFixed(1);
        return res.status(413).json({
          error: 'FILE_TOO_LARGE_FOR_HOSTED_API',
          message: `Non-video files over 20MB (${sizeMb} MB) are not supported on Telegram hosted Bot API. Please upload files under 20MB.`,
        });
      }
    }

    const { title, description, category, folderId, parentFolderId } = req.body;
    const finalTitle = title?.trim() || uploadedFile.originalname || 'Untitled File';
    const targetParent = folderId || parentFolderId;
    const parentId = targetParent && targetParent !== 'root' && targetParent !== 'null' ? targetParent : null;

    let finalCategory = (category?.trim() || '').replace(/^#/, '').trim();
    let isFileHidden = false;
    let isFileLocked = false;
    let parentFolder = null;

    if (parentId) {
      parentFolder = await Media.findById(parentId).lean();
      if (!parentFolder) {
        return res.status(404).json({ message: 'Target folder not found', requestId: correlationId });
      }
      if (parentFolder.status === 'deleting') {
        return res.status(409).json({
          code: 'FOLDER_DELETING',
          message: 'Target folder is currently being deleted. Uploads not permitted.',
          requestId: correlationId,
        });
      }
      const reqUserId = req.user?._id?.toString() || req.user?.id?.toString();
      const folderOwner = parentFolder.uploadedBy?.toString();
      if (folderOwner && reqUserId && folderOwner !== reqUserId) {
        console.warn(`[${correlationId}] [uploadMedia] User ${reqUserId} attempted to upload into folder owned by ${folderOwner}`);
        return res.status(403).json({
          code: 'ACCESS_DENIED',
          error: 'ACCESS_DENIED',
          message: 'Not authorized to upload into this folder',
          requestId: correlationId,
        });
      }
      if (!finalCategory || finalCategory.toLowerCase() === 'general' || finalCategory.toLowerCase() === 'all') {
        finalCategory = parentFolder.category || parentFolder.title;
      }
      if (parentFolder.isHidden) {
        isFileHidden = true;
      }
      if (parentFolder.isLocked) {
        isFileLocked = true;
      }
    }
    if (req.body.isHidden === 'true' || req.body.isHidden === true || req.headers['x-upload-vault'] === 'true') {
      isFileHidden = true;
    }
    if (!finalCategory) finalCategory = 'General';

    // If uploading into a hidden folder or private vault, strictly verify vault session
    if (isFileHidden) {
      const vaultSession = verifyVaultToken(req);
      if (vaultSession?.expired) {
        console.warn(`[${correlationId}] [uploadMedia] Private vault session expired for user ${req.user?._id || req.user?.id}`);
        return res.status(403).json({
          code: 'VAULT_SESSION_EXPIRED',
          error: 'VAULT_SESSION_EXPIRED',
          message: 'Private vault session has expired. Please unlock the vault again.',
          requestId: correlationId,
        });
      }
      const reqUserId = req.user?._id?.toString() || req.user?.id?.toString();
      const folderOwner = parentFolder?.uploadedBy?.toString();
      if (
        !vaultSession ||
        (reqUserId && vaultSession.userId && String(vaultSession.userId) !== String(reqUserId)) ||
        (folderOwner && vaultSession.userId && String(vaultSession.userId) !== String(folderOwner))
      ) {
        console.warn(`[${correlationId}] [uploadMedia] Unauthorized vault upload attempt (session present: ${!!vaultSession})`);
        return res.status(403).json({
          code: 'VAULT_AUTH_REQUIRED',
          error: 'VAULT_AUTH_REQUIRED',
          message: 'Cannot upload into private vault folder without active vault session',
          requestId: correlationId,
        });
      }
      console.log(`[${correlationId}] [uploadMedia] Valid vault session verified for user ${reqUserId}`);
    }

    // Automatic thumbnail generation for video files if no custom thumbnail was provided
    if (!activeThumbBuffer && isVideo) {
      try {
        activeThumbBuffer = await generateVideoThumbnail(finalBuffer, uploadFilename);
      } catch (thumbErr) {
        console.warn('[uploadMedia] Video thumbnail extraction note:', thumbErr.message);
      }
    }

    // Automatic thumbnail & metadata extraction for image files (WebP, PNG, JPEG, converted HEIC)
    if (isImage) {
      try {
        const meta = await getImageMetadata(finalBuffer);
        if (meta.width) compressedMeta.width = meta.width;
        if (meta.height) compressedMeta.height = meta.height;

        if (!activeThumbBuffer) {
          activeThumbBuffer = await generateImageThumbnail(finalBuffer);
        }
      } catch (imgThumbErr) {
        console.warn('[uploadMedia] Image thumbnail generation note:', imgThumbErr.message);
      }
    }

    let thumbnailFileId = '';
    let thumbnailMessageId = null;
    let finalThumbnail = req.body.thumbnail || '';

    if (activeThumbBuffer) {
      finalThumbnail = `data:image/jpeg;base64,${activeThumbBuffer.toString('base64')}`;
      try {
        const thumbUpload = await uploadDocumentToTelegram(
          activeThumbBuffer,
          `${path.parse(uploadFilename).name}_thumb.jpg`,
          'image/jpeg',
          null,
          { correlationId }
        );
        thumbnailFileId = thumbUpload?.fileId || '';
        thumbnailMessageId = thumbUpload?.messageId || null;
      } catch (tUploadErr) {
        console.warn(`[${correlationId}] [uploadMedia] Telegram thumbnail upload note (continuing with base64 thumbnail):`, tUploadErr.message);
      }
      // Add a 1.2s delay between standalone thumbnail upload and main payload upload to prevent chat flood
      await new Promise((r) => setTimeout(r, 1200));
    }

    // 1. Upload to Telegram Cloud
    const {
      fileId,
      messageId,
      duration,
      width,
      height,
      fileSizeBytes,
      fileType,
      mediaType,
      fileCategory,
      extension,
    } = await uploadMediaToTelegram(
      finalBuffer,
      uploadFilename,
      uploadMimetype,
      activeThumbBuffer,
      { correlationId }
    );

    // 2. Save document in MongoDB

    const doc = await Media.create({
      title: finalTitle,
      description: description?.trim() || '',
      category: finalCategory,
      isFolder: false,
      folderId: parentId,
      fileType: fileType || autoFileType,
      mediaType: mediaType || autoCategory,
      fileCategory: fileCategory || autoCategory,
      extension: extension || parsedExt || effectiveImageFormat || path.extname(uploadFilename).replace('.', ''),
      originalFormat: originalFormat || (effectiveImageFormat || ''),
      servedFormat: servedFormat || (isConverted ? 'jpeg' : (effectiveImageFormat || '')),
      isConverted: isConverted,
      mimeType: uploadMimetype || (effectiveImageFormat ? getMimeForFormat(effectiveImageFormat) : ''),
      thumbnail: finalThumbnail,
      thumbnailFileId: thumbnailFileId,
      thumbnailMessageId: thumbnailMessageId,
      telegramFileId: fileId,
      telegramMessageId: messageId,
      duration: duration || compressedMeta.duration || 0,
      width: width || compressedMeta.width || 0,
      height: height || compressedMeta.height || 0,
      fileSizeBytes: fileSizeBytes || finalSize || 0,
      originalName: uploadedFile.originalname || '',
      originalSizeBytes: uploadedFile.size || 0,
      uploadedBy: req.user?.id || req.user?._id,
      isHidden: isFileHidden,
      isLocked: isFileLocked,
    });

    const resultDoc = ensureFileType(doc.toObject());
    resultDoc.success = true;
    resultDoc.message = isCompressed ? 'Video compressed and uploaded successfully' : 'File uploaded successfully';
    resultDoc.originalSize = uploadedFile.size;
    resultDoc.compressedSize = finalSize;
    resultDoc.finalSize = finalSize;
    resultDoc.compressed = isCompressed;
    resultDoc.compressionApplied = isCompressed;
    resultDoc.compressionPercentage = compressionRatio;

    res.status(201).json(resultDoc);
  } catch (err) {
    console.error(`[${correlationId}] [uploadMedia error]:`, err.message);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: `File exceeds maximum ${MAX_VIDEO_UPLOAD_SIZE_MB || 200}MB upload limit`, requestId: correlationId });
    }
    const isClientError = err.telegramErrorCode && err.telegramErrorCode >= 400 && err.telegramErrorCode < 500;
    const statusCode = isClientError ? 400 : 500;
    res.status(statusCode).json({
      message: err.message || 'File upload failed',
      error: err.telegramErrorCode ? `TELEGRAM_${err.telegramErrorCode}` : 'UPLOAD_FAILED',
      details: err.telegramDescription || err.message,
      requestId: correlationId,
    });
  }
};

/**
 * PATCH /api/v1/media/:id/rename
 */
exports.renameItem = async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'New name is required' });
    }

    const item = await Media.findByIdAndUpdate(
      req.params.id,
      { title: title.trim() },
      { new: true }
    );

    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json(ensureFileType(item.toObject()));
  } catch (err) {
    console.error('[renameItem error]:', err.message);
    res.status(500).json({ message: 'Failed to rename item' });
  }
};

/**
 * PATCH /api/v1/media/:id/move
 */
exports.moveItem = async (req, res) => {
  try {
    const rawTarget = req.body.targetFolderId !== undefined ? req.body.targetFolderId : req.body.destinationFolderId;
    const parentId = rawTarget && rawTarget !== 'root' && rawTarget !== 'null' ? rawTarget : null;
    const effectiveCategory = (req.body.newCategory || req.body.category || '').trim();

    const sourceItem = await Media.findById(req.params.id);
    if (!sourceItem) return res.status(404).json({ message: 'Item not found' });

    // Verify ownership
    const userId = req.user?._id?.toString() || req.user?.id?.toString();
    const itemOwner = sourceItem.uploadedBy || sourceItem.userId;
    if (itemOwner && userId && String(itemOwner) !== String(userId)) {
      return res.status(403).json({
        code: 'ACCESS_DENIED',
        error: 'ACCESS_DENIED',
        message: 'Not authorized to move this item',
      });
    }

    // Check if source item is inside a hidden folder or is hidden
    let isSourceHidden = !!sourceItem.isHidden;
    if (!isSourceHidden && sourceItem.folderId) {
      const parent = await Media.findById(sourceItem.folderId).lean();
      if (parent?.isHidden) isSourceHidden = true;
    }

    const vaultSession = verifyVaultToken(req);
    if (isSourceHidden) {
      if (vaultSession?.expired) {
        return res.status(403).json({
          code: 'VAULT_SESSION_EXPIRED',
          error: 'VAULT_SESSION_EXPIRED',
          message: 'Private vault session has expired. Please unlock the vault again.',
        });
      }
      if (!vaultSession || (userId && vaultSession.userId !== userId)) {
        return res.status(403).json({
          code: 'VAULT_AUTH_REQUIRED',
          error: 'VAULT_AUTH_REQUIRED',
          message: 'Cannot move protected private vault item without active vault session',
        });
      }
    }

    // Check destination folder
    const updateFields = {};
    if (rawTarget !== undefined) {
      updateFields.folderId = parentId;
    }
    if (effectiveCategory) {
      updateFields.category = effectiveCategory.replace(/^#/, '');
    }

    if (parentId) {
      const destFolder = await Media.findById(parentId).lean();
      if (!destFolder || !destFolder.isFolder) {
        return res.status(400).json({ message: 'Target folder does not exist' });
      }

      // Check circular reference if moving a folder
      if (sourceItem.isFolder) {
        if (String(sourceItem._id) === String(parentId)) {
          return res.status(400).json({ message: 'Cannot move folder into itself' });
        }
        let checkParent = destFolder;
        while (checkParent) {
          if (String(checkParent._id) === String(sourceItem._id)) {
            return res.status(400).json({ message: 'Cannot move folder into its own subfolder' });
          }
          checkParent = checkParent.folderId ? await Media.findById(checkParent.folderId).lean() : null;
        }
      }

      if (destFolder.isHidden) {
        if (vaultSession?.expired) {
          return res.status(403).json({
            code: 'VAULT_SESSION_EXPIRED',
            error: 'VAULT_SESSION_EXPIRED',
            message: 'Private vault session has expired. Please unlock the vault again.',
          });
        }
        if (!vaultSession || (userId && vaultSession.userId !== userId)) {
          return res.status(403).json({
            code: 'VAULT_AUTH_REQUIRED',
            error: 'VAULT_AUTH_REQUIRED',
            message: 'Cannot move item into private vault without active vault session',
          });
        }
        updateFields.isHidden = true;
      } else if (isSourceHidden && !destFolder.isHidden) {
        // Moving out of private vault into public folder
        updateFields.isHidden = false;
      }

      if (destFolder.isLocked) {
        updateFields.isLocked = true;
      }
    } else {
      // Moving to root
      if (isSourceHidden) {
        updateFields.isHidden = false;
      }
    }

    const item = await Media.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true }
    );

    res.json(ensureFileType(item.toObject()));
  } catch (err) {
    console.error('[moveItem error]:', err.message);
    res.status(500).json({ message: 'Failed to move item' });
  }
};

/**
 * PATCH /api/v1/media/batch/move or /api/v1/media/move
 */
exports.batchMove = async (req, res) => {
  try {
    const rawIds = req.body.ids || req.body.itemIds || [];
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(400).json({ message: 'ids or itemIds array is required' });
    }

    const rawTarget = req.body.targetFolderId !== undefined ? req.body.targetFolderId : req.body.destinationFolderId;
    const parentId = rawTarget && rawTarget !== 'root' && rawTarget !== 'null' ? rawTarget : null;
    const effectiveCategory = (req.body.newCategory || req.body.category || '').trim();

    const items = await Media.find({ _id: { $in: rawIds } });
    if (!items || items.length === 0) {
      return res.status(404).json({ message: 'Items not found' });
    }

    const userId = req.user?._id?.toString() || req.user?.id?.toString();
    for (const it of items) {
      const owner = it.uploadedBy || it.userId;
      if (owner && userId && String(owner) !== String(userId)) {
        return res.status(403).json({
          code: 'ACCESS_DENIED',
          error: 'ACCESS_DENIED',
          message: 'Not authorized to move one or more items',
        });
      }
    }

    let anySourceHidden = false;
    for (const it of items) {
      if (it.isHidden) {
        anySourceHidden = true;
        break;
      }
      if (it.folderId) {
        const parent = await Media.findById(it.folderId).lean();
        if (parent?.isHidden) {
          anySourceHidden = true;
          break;
        }
      }
    }

    const vaultSession = verifyVaultToken(req);
    if (anySourceHidden) {
      if (vaultSession?.expired) {
        return res.status(403).json({
          code: 'VAULT_SESSION_EXPIRED',
          error: 'VAULT_SESSION_EXPIRED',
          message: 'Private vault session has expired. Please unlock the vault again.',
        });
      }
      if (!vaultSession || (userId && vaultSession.userId !== userId)) {
        return res.status(403).json({
          code: 'VAULT_AUTH_REQUIRED',
          error: 'VAULT_AUTH_REQUIRED',
          message: 'Cannot move protected private vault item without active vault session',
        });
      }
    }

    const updateFields = {};
    if (rawTarget !== undefined) {
      updateFields.folderId = parentId;
    }
    if (effectiveCategory) {
      updateFields.category = effectiveCategory.replace(/^#/, '');
    }

    if (parentId) {
      const destFolder = await Media.findById(parentId).lean();
      if (!destFolder || !destFolder.isFolder) {
        return res.status(400).json({ message: 'Target folder does not exist' });
      }

      if (destFolder.isHidden) {
        if (vaultSession?.expired) {
          return res.status(403).json({
            code: 'VAULT_SESSION_EXPIRED',
            error: 'VAULT_SESSION_EXPIRED',
            message: 'Private vault session has expired. Please unlock the vault again.',
          });
        }
        if (!vaultSession || (userId && vaultSession.userId !== userId)) {
          return res.status(403).json({
            code: 'VAULT_AUTH_REQUIRED',
            error: 'VAULT_AUTH_REQUIRED',
            message: 'Cannot move item into private vault without active vault session',
          });
        }
        updateFields.isHidden = true;
      } else if (anySourceHidden && !destFolder.isHidden) {
        updateFields.isHidden = false;
      }

      if (destFolder.isLocked) {
        updateFields.isLocked = true;
      }
    } else {
      if (anySourceHidden) {
        updateFields.isHidden = false;
      }
    }

    await Media.updateMany(
      { _id: { $in: rawIds } },
      { $set: updateFields }
    );

    res.json({
      success: true,
      message: `Successfully moved ${rawIds.length} items`,
      movedCount: rawIds.length,
    });
  } catch (err) {
    console.error('[batchMove error]:', err.message);
    res.status(500).json({ message: 'Failed to batch move items' });
  }
};

/**
 * POST /api/v1/media/batch/trash
 */
exports.batchTrash = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids array is required' });
    }

    await Media.updateMany(
      { _id: { $in: ids } },
      { $set: { isTrashed: true, trashedAt: new Date() } }
    );

    res.json({
      success: true,
      message: `Successfully moved ${ids.length} items to trash`,
      trashedCount: ids.length,
    });
  } catch (err) {
    console.error('[batchTrash error]:', err.message);
    res.status(500).json({ message: 'Failed to batch trash items' });
  }
};

/**
 * PATCH /api/v1/videos/:id/note
 * Update reminder/note on a media item (max 200 chars)
 */
exports.updateNote = async (req, res) => {
  try {
    const rawNote = typeof req.body.note === 'string' ? req.body.note.trim() : '';
    if (rawNote.length > 200) {
      return res.status(400).json({ message: 'Note cannot exceed 200 characters' });
    }

    const item = await Media.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (req.user && item.uploadedBy && item.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit notes on this file' });
    }

    item.note = rawNote;
    await item.save();

    res.json({
      success: true,
      message: 'Note updated successfully',
      item: ensureFileType(item.toObject()),
    });
  } catch (err) {
    console.error('[updateNote error]:', err.message);
    res.status(500).json({ message: 'Failed to update note' });
  }
};

/**
 * POST /api/v1/media/:id/star
 */
exports.toggleStar = async (req, res) => {
  try {
    const item = await Media.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    item.isStarred = !item.isStarred;
    await item.save();

    res.json({ isStarred: item.isStarred });
  } catch (err) {
    console.error('[toggleStar error]:', err.message);
    res.status(500).json({ message: 'Failed to star/unstar item' });
  }
};

/**
 * POST /api/v1/media/:id/trash
 */
/**
 * Performs complete cascading deletion of a folder across Telegram, MongoDB, and thumbnails.
 *
 * 1. Verifies ownership and biometric/PIN lock security.
 * 2. Recursively collects all descendant subfolders and files.
 * 3. Collects all Telegram message IDs (file, thumbnail, chunks, parts).
 * 4. Marks folder and contents as 'deleting' in MongoDB.
 * 5. Batch-deletes Telegram messages with rate-limit backoff and idempotency.
 * 6. Preserves DB records and flags 'delete_failed' if Telegram fails.
 * 7. Purges all MongoDB documents (Media, Likes, WatchHistory, Playlists, ShareLinks, User locks) if Telegram succeeds.
 */
async function deleteFolderCascade(userId, folderId, options = {}) {
  const correlationId = options.correlationId || `cascade_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[${correlationId}] [deleteFolderCascade] Starting cascade delete for folderId=${folderId}, userId=${userId}`);

  const folder = await Media.findOne({ _id: folderId, isFolder: true });
  if (!folder) {
    const error = new Error('Folder not found');
    error.status = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  // 1. Authorization: Verify folder belongs to user
  const folderOwner = folder.uploadedBy || folder.userId;
  if (folderOwner && !userId) {
    const error = new Error('Authentication required to delete folder');
    error.status = 401;
    error.code = 'UNAUTHORIZED';
    throw error;
  }
  if (folderOwner && userId && String(folderOwner) !== String(userId)) {
    const error = new Error('Not authorized to delete this folder');
    error.status = 403;
    error.code = 'ACCESS_DENIED';
    throw error;
  }

  // 2. Lock & Biometric Protection: Never allow delete to bypass lock!
  let userLocked = [];
  let user = null;
  if (userId) {
    user = await User.findById(userId).select('+pinHash');
    if (Array.isArray(user?.lockedCategories)) {
      userLocked = user.lockedCategories;
    }
  }

  const folderTitle = (folder.title || '').trim().toLowerCase();
  const folderIdStr = String(folder._id).toLowerCase();
  const folderCat = (folder.category || '').trim().replace(/^#/, '').toLowerCase();

  const isFolderLocked = folder.isLocked || userLocked.some((c) => {
    const clean = (typeof c === 'string' ? c : c?.category || '').trim().toLowerCase();
    return clean === folderTitle || clean === folderIdStr || (folderCat && clean === folderCat);
  });

  const isFolderHidden = !!folder.isHidden;

  if (isFolderHidden) {
    let hasVaultAuth = false;
    if (options.req) {
      const vaultSession = verifyVaultToken(options.req);
      if (vaultSession && (!userId || String(vaultSession.userId) === String(userId))) {
        hasVaultAuth = true;
      }
    }
    if (!hasVaultAuth && options.vaultToken) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(options.vaultToken, process.env.JWT_SECRET || 'vault_secret_fallback');
        if (decoded && (!userId || String(decoded.userId) === String(userId))) {
          hasVaultAuth = true;
        }
      } catch {}
    }
    const pinProvided = options.pin || options.req?.body?.pin || options.req?.headers?.['x-folder-pin'];
    if (!hasVaultAuth && pinProvided && user?.pinHash) {
      const isValidPin = await user.comparePin(pinProvided);
      if (isValidPin) hasVaultAuth = true;
    }

    if (!hasVaultAuth) {
      const error = new Error('Active Private Vault session or PIN required to delete hidden folder');
      error.status = 403;
      error.code = 'VAULT_AUTH_REQUIRED';
      throw error;
    }
  }

  if (isFolderLocked) {
    let isUnlocked = false;
    const rawUnlocked = options.unlockedCategories || options.req?.query?.unlockedCategories || options.req?.headers?.['x-unlocked-categories'] || '';
    const unlockedList = (typeof rawUnlocked === 'string' ? rawUnlocked.split(',') : Array.isArray(rawUnlocked) ? rawUnlocked : [])
      .map((c) => String(c).trim().replace(/^#/, '').toLowerCase())
      .filter(Boolean);

    if (unlockedList.some((c) => c === folderTitle || c === folderIdStr || (folderCat && c === folderCat))) {
      isUnlocked = true;
    }

    const pinProvided = options.pin || options.req?.body?.pin || options.req?.headers?.['x-folder-pin'];
    if (!isUnlocked && pinProvided && user?.pinHash) {
      const valid = await user.comparePin(pinProvided);
      if (valid) isUnlocked = true;
    }

    if (!isUnlocked) {
      const error = new Error(`Folder "${folder.title}" is locked. PIN passcode or unlock required before deletion.`);
      error.status = 403;
      error.code = 'FOLDER_LOCKED';
      throw error;
    }
  }

  // 3. Collect everything: Folder + all descendants (recursive subfolders)
  const allFolderIds = [folder._id];
  const allFolderTitles = [folder.title];
  const queue = [folder._id];

  while (queue.length > 0) {
    const parentId = queue.shift();
    const children = await Media.find({ folderId: parentId, isFolder: true }).lean();
    for (const child of children) {
      allFolderIds.push(child._id);
      if (child.title && !allFolderTitles.includes(child.title)) {
        allFolderTitles.push(child.title);
      }
      queue.push(child._id);
    }
  }

  // Find all file records inside any of these folders
  const files = await Media.find({
    folderId: { $in: allFolderIds },
    isFolder: false,
  }).lean();

  const fileIds = files.map((f) => f._id);

  // Collect all Telegram message IDs across files, thumbnails, chunks, and pending deletes
  const rawMessageIds = [];
  let filesWithoutMessageId = 0;
  let thumbnailsWithoutMessageId = 0;

  for (const f of files) {
    if (f.telegramMessageId) {
      rawMessageIds.push(f.telegramMessageId);
    } else {
      filesWithoutMessageId++;
    }

    if (f.thumbnailMessageId) {
      rawMessageIds.push(f.thumbnailMessageId);
    } else if (f.thumbnailFileId) {
      thumbnailsWithoutMessageId++;
    }

    if (Array.isArray(f.chunks)) {
      for (const ch of f.chunks) {
        if (ch.telegramMessageId) rawMessageIds.push(ch.telegramMessageId);
      }
    }

    if (Array.isArray(f.parts)) {
      for (const pt of f.parts) {
        if (pt.telegramMessageId) rawMessageIds.push(pt.telegramMessageId);
      }
    }
  }

  // Also include any previously pending message IDs on the folders
  if (Array.isArray(folder.pendingTelegramDeletes)) {
    rawMessageIds.push(...folder.pendingTelegramDeletes);
  }

  const telegramMessageIds = Array.from(
    new Set(rawMessageIds.map(Number).filter((id) => !isNaN(id) && id > 0))
  );

  console.log(`[${correlationId}] [deleteFolderCascade] Discovered ${allFolderIds.length} folder(s), ${files.length} file(s), ${telegramMessageIds.length} unique Telegram message(s)`);

  // 4. Mark folders and files as "deleting" in MongoDB before external calls
  await Media.updateMany(
    { _id: { $in: allFolderIds } },
    { $set: { status: 'deleting', pendingTelegramDeletes: telegramMessageIds } }
  );
  if (fileIds.length > 0) {
    await Media.updateMany(
      { _id: { $in: fileIds } },
      { $set: { status: 'deleting' } }
    );
  }

  // 5. Delete Telegram messages in batches with retry, rate-limit backoff, and idempotency
  let tgResult = { success: true, deletedCount: 0, failedIds: [], errors: [] };
  if (telegramMessageIds.length > 0) {
    const deleteFn = options.deleteTelegramMessages || telegramService.deleteTelegramMessages;
    tgResult = await deleteFn(telegramMessageIds, { correlationId });
  }

  // 6. Handle Telegram partial failures:
  // If Telegram deletion failed permanently for some messages, do NOT drop the MongoDB records!
  if (!tgResult.success && tgResult.failedIds.length > 0) {
    console.warn(`[${correlationId}] [deleteFolderCascade] Partial Telegram delete failure: ${tgResult.failedIds.length} messages failed`);
    await Media.findByIdAndUpdate(folder._id, {
      status: 'delete_failed',
      pendingTelegramDeletes: tgResult.failedIds,
    });

    return {
      success: false,
      status: 'delete_failed',
      folderId: folder._id,
      folderTitle: folder.title,
      message: 'Some files could not be removed from Telegram. Database records preserved. Please retry.',
      deletedTelegramCount: tgResult.deletedCount,
      failedTelegramIds: tgResult.failedIds,
      errors: tgResult.errors,
      filesCount: files.length,
      foldersCount: allFolderIds.length,
    };
  }

  // 7. Telegram deletion succeeded! Now delete MongoDB documents in cascade
  console.log(`[${correlationId}] [deleteFolderCascade] Telegram deletion complete. Purging MongoDB records...`);

  let session = null;
  let useTransaction = false;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    useTransaction = true;
  } catch (txErr) {
    console.log(`[${correlationId}] [deleteFolderCascade] Standalone MongoDB deployment detected (transactions unsupported). Using ordered deletes.`);
    session = null;
    useTransaction = false;
  }

  try {
    const opts = session ? { session } : {};

    // Delete Media files and folders
    if (fileIds.length > 0) {
      await Media.deleteMany({ _id: { $in: fileIds } }, opts);
    }
    await Media.deleteMany({ _id: { $in: allFolderIds } }, opts);

    // Delete related Likes
    if (fileIds.length > 0) {
      await Like.deleteMany({ $or: [{ mediaId: { $in: fileIds } }, { videoId: { $in: fileIds } }] }, opts);
    }

    // Delete related WatchHistory
    if (fileIds.length > 0) {
      await WatchHistory.deleteMany({ $or: [{ mediaId: { $in: fileIds } }, { videoId: { $in: fileIds } }] }, opts);
    }

    // Remove file references from Playlists
    if (fileIds.length > 0) {
      await Playlist.updateMany(
        {},
        { $pull: { mediaIds: { $in: fileIds }, videoIds: { $in: fileIds } } },
        opts
      );
    }

    // Delete related ShareLinks (files and folder links)
    const folderTitleConditions = allFolderTitles
      .filter(Boolean)
      .flatMap((t) => [{ category: t }, { folderTitle: t }]);

    const shareConditions = [];
    if (fileIds.length > 0) {
      shareConditions.push({ fileId: { $in: fileIds } });
    }
    if (folderTitleConditions.length > 0) {
      shareConditions.push(...folderTitleConditions);
    }
    if (shareConditions.length > 0) {
      await ShareLink.deleteMany({ $or: shareConditions }, opts);
    }

    // Clean up User.lockedCategories
    if (user) {
      const cleanTitles = allFolderTitles.map((t) => t.trim().toLowerCase());
      const cleanIds = allFolderIds.map((id) => String(id).toLowerCase());
      user.lockedCategories = (user.lockedCategories || []).filter((c) => {
        const clean = (typeof c === 'string' ? c : c?.category || '').trim().toLowerCase();
        return !cleanTitles.includes(clean) && !cleanIds.includes(clean);
      });
      await user.save(opts);
    }

    if (session && useTransaction) {
      await session.commitTransaction();
    }
  } catch (dbErr) {
    if (session && useTransaction) {
      await session.abortTransaction();
    }
    throw dbErr;
  } finally {
    if (session) {
      session.endSession();
    }
  }

  console.log(`[${correlationId}] [deleteFolderCascade] Successfully completed cascade delete for folder "${folder.title}"`);

  return {
    success: true,
    status: 'deleted',
    folderId: folder._id,
    folderTitle: folder.title,
    message: `Folder "${folder.title}" and all its contents were completely deleted`,
    deletedFilesCount: files.length,
    deletedFoldersCount: allFolderIds.length,
    deletedTelegramMessagesCount: tgResult.deletedCount,
    legacyFilesWithoutMessageId: filesWithoutMessageId,
    legacyThumbnailsWithoutMessageId: thumbnailsWithoutMessageId,
  };
}

exports.deleteFolderCascade = deleteFolderCascade;

/**
 * DELETE /api/v1/media/folder/:id
 */
exports.deleteFolder = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const folderId = req.params.id;
    const options = {
      pin: req.body?.pin || req.headers['x-folder-pin'],
      vaultToken: req.headers['x-vault-token'],
      unlockedCategories: req.query?.unlockedCategories || req.headers['x-unlocked-categories'],
      req,
    };

    const result = await deleteFolderCascade(userId, folderId, options);
    if (!result.success && result.status === 'delete_failed') {
      return res.status(502).json(result);
    }
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    console.error('[deleteFolder error]:', err.message);
    return res.status(status).json({
      success: false,
      error: err.code || 'DELETE_FAILED',
      message: err.message || 'Failed to delete folder',
    });
  }
};

/**
 * POST /api/v1/media/folder/:id/retry
 */
exports.retryDeleteFolder = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const folderId = req.params.id;
    const options = {
      pin: req.body?.pin || req.headers['x-folder-pin'],
      vaultToken: req.headers['x-vault-token'],
      unlockedCategories: req.query?.unlockedCategories || req.headers['x-unlocked-categories'],
      req,
    };

    const result = await deleteFolderCascade(userId, folderId, options);
    if (!result.success && result.status === 'delete_failed') {
      return res.status(502).json(result);
    }
    return res.json(result);
  } catch (err) {
    const status = err.status || 500;
    console.error('[retryDeleteFolder error]:', err.message);
    return res.status(status).json({
      success: false,
      error: err.code || 'RETRY_FAILED',
      message: err.message || 'Failed to retry folder deletion',
    });
  }
};

/**
 * POST /api/v1/media/:id/trash or DELETE /api/v1/media/:id
 */
exports.trashOrDelete = async (req, res) => {
  try {
    const item = await Media.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    // Permanent delete if item is already trashed, or if direct DELETE HTTP method or ?permanent=true is used
    const isPermanent = item.isTrashed || req.query.permanent === 'true' || req.method === 'DELETE';

    if (isPermanent) {
      // If it's a folder, run full cascade deletion
      if (item.isFolder) {
        const userId = req.user?._id || req.user?.id;
        const options = {
          pin: req.body?.pin || req.headers['x-folder-pin'],
          vaultToken: req.headers['x-vault-token'],
          unlockedCategories: req.query?.unlockedCategories || req.headers['x-unlocked-categories'],
          req,
        };
        const cascadeResult = await deleteFolderCascade(userId, item._id, options);
        if (!cascadeResult.success && cascadeResult.status === 'delete_failed') {
          return res.status(502).json(cascadeResult);
        }
        return res.json(cascadeResult);
      }

      // Permanent file deletion
      const fileTgIds = [];
      if (item.telegramMessageId) fileTgIds.push(item.telegramMessageId);
      if (item.thumbnailMessageId) fileTgIds.push(item.thumbnailMessageId);
      if (Array.isArray(item.chunks)) {
        for (const ch of item.chunks) {
          if (ch.telegramMessageId) fileTgIds.push(ch.telegramMessageId);
        }
      }
      if (Array.isArray(item.parts)) {
        for (const pt of item.parts) {
          if (pt.telegramMessageId) fileTgIds.push(pt.telegramMessageId);
        }
      }

      let tgRes = { success: true, deletedCount: 0 };
      if (fileTgIds.length > 0) {
        tgRes = await deleteTelegramMessages(fileTgIds);
      }

      // Clean up relations
      await Like.deleteMany({ $or: [{ mediaId: item._id }, { videoId: item._id }] });
      await WatchHistory.deleteMany({ $or: [{ mediaId: item._id }, { videoId: item._id }] });
      await Playlist.updateMany({}, { $pull: { mediaIds: item._id, videoIds: item._id } });
      await ShareLink.deleteMany({ fileId: item._id });

      await Media.findByIdAndDelete(req.params.id);

      return res.json({
        success: true,
        message: 'Item permanently deleted',
        telegramDeleted: tgRes.success,
        telegramDeletedCount: tgRes.deletedCount,
      });
    }

    item.isTrashed = true;
    item.trashedAt = new Date();
    await item.save();

    res.json({ message: 'Item moved to trash', item: ensureFileType(item.toObject()) });
  } catch (err) {
    console.error('[trashOrDelete error]:', err.message);
    const status = err.status || 500;
    res.status(status).json({
      success: false,
      error: err.code || 'DELETE_FAILED',
      message: err.message || 'Failed to delete item',
    });
  }
};

/**
 * POST /api/v1/media/:id/restore
 */
exports.restoreTrash = async (req, res) => {
  try {
    const item = await Media.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    item.isTrashed = false;
    item.trashedAt = null;
    await item.save();

    res.json({ message: 'Item restored', item: ensureFileType(item.toObject()) });
  } catch (err) {
    console.error('[restoreTrash error]:', err.message);
    res.status(500).json({ message: 'Failed to restore item' });
  }
};

/**
 * DELETE /api/v1/media/trash/empty
 */
exports.emptyTrash = async (req, res) => {
  try {
    const trashedItems = await Media.find({ isTrashed: true });
    let telegramDeleteCount = 0;
    for (const item of trashedItems) {
      if (item.telegramMessageId) {
        const delRes = await deleteMediaFromTelegram(item.telegramMessageId);
        if (delRes?.success) telegramDeleteCount++;
      }
    }
    await Media.deleteMany({ isTrashed: true });
    res.json({
      success: true,
      message: 'Trash emptied permanently',
      itemsRemoved: trashedItems.length,
      telegramMessagesDeleted: telegramDeleteCount,
    });
  } catch (err) {
    console.error('[emptyTrash error]:', err.message);
    res.status(500).json({ message: 'Failed to empty trash' });
  }
};

/**
 * Auto-purge routine: permanently deletes trashed items older than 30 days
 */
exports.autoPurgeOldTrash = async () => {
  try {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - THIRTY_DAYS_MS);

    const oldTrashed = await Media.find({
      isTrashed: true,
      trashedAt: { $lte: cutoffDate },
    });

    if (oldTrashed.length === 0) return { purged: 0 };

    for (const item of oldTrashed) {
      if (item.telegramMessageId) {
        await deleteMediaFromTelegram(item.telegramMessageId).catch(() => {});
      }
    }

    await Media.deleteMany({
      isTrashed: true,
      trashedAt: { $lte: cutoffDate },
    });

    console.log(`[AutoPurge] Permanently purged ${oldTrashed.length} items older than 30 days.`);
    return { purged: oldTrashed.length };
  } catch (err) {
    console.error('[AutoPurge error]:', err.message);
    return { purged: 0, error: err.message };
  }
};

/**
 * GET /api/v1/media/folders
 */
exports.listFolders = async (req, res) => {
  try {
    const filter = {
      isFolder: true,
      isTrashed: { $ne: true },
      isHidden: { $ne: true },
      status: { $ne: 'deleting' },
    };
    const userId = req.user?._id || req.user?.id;
    if (userId) {
      filter.uploadedBy = userId;
    }
    const folders = await Media.find(filter).sort({ title: 1 }).lean();

    const folderIds = folders.map((f) => f._id);
    const countAgg = await Media.aggregate([
      {
        $match: {
          isFolder: false,
          isTrashed: { $ne: true },
          status: { $ne: 'deleting' },
          folderId: { $in: folderIds },
        },
      },
      {
        $group: {
          _id: '$folderId',
          count: { $sum: 1 },
        },
      },
    ]);
    const countMap = {};
    for (const c of countAgg) {
      countMap[String(c._id)] = c.count;
    }

    const enhancedFolders = folders.map((f) => {
      const obj = ensureFileType(f);
      obj.itemCount = countMap[String(f._id)] || 0;
      return obj;
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ folders: enhancedFolders });
  } catch (err) {
    res.status(500).json({ message: 'Failed to list folders' });
  }
};

/**
 * GET /api/v1/media/search
 */
exports.searchMedia = async (req, res) => {
  try {
    const { q, fileCategory, fileType, cursor } = req.query;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 24));
    if (!q || !q.trim()) {
      return res.json({ items: [], nextCursor: null, hasMore: false, total: 0 });
    }

    const userId = req.user?._id || req.user?.id;
    // Exclude hidden folders and their contents from global search
    const hiddenFolderDocs = await Media.find({
      isFolder: true,
      isHidden: true,
      ...(userId ? { uploadedBy: userId } : {}),
    }).select('_id').lean();
    const hiddenFolderIds = hiddenFolderDocs.map((d) => d._id);

    const filter = {
      isTrashed: { $ne: true },
      isHidden: { $ne: true },
      $or: [
        { title: { $regex: q.trim(), $options: 'i' } },
        { description: { $regex: q.trim(), $options: 'i' } },
        { category: { $regex: q.trim(), $options: 'i' } },
      ],
    };

    if (hiddenFolderIds.length > 0) {
      filter.folderId = { $nin: hiddenFolderIds };
    }

    // Exclude locked categories from normal search unless user unlocked them
    let userLocked = [];
    if (userId) {
      const u = await User.findById(userId).lean();
      if (Array.isArray(u?.lockedCategories)) {
        userLocked = u.lockedCategories;
      }
    }
    if (userLocked.length > 0) {
      const lockedRegexes = userLocked.map((c) =>
        new RegExp(`^#?${c.replace(/^#/, '').replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i')
      );
      filter.category = { $nin: lockedRegexes };
    }

    if (fileCategory && fileCategory !== 'all') {
      filter.fileCategory = fileCategory;
    }
    if (fileType && fileType !== 'all') {
      filter.fileType = fileType;
    }
    if (cursor) {
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const [rawItems, total] = await Promise.all([
      Media.find(filter).sort({ isFolder: -1, createdAt: -1, _id: -1 }).limit(limit + 1).lean(),
      Media.countDocuments(filter),
    ]);

    const hasMore = rawItems.length > limit;
    const items = hasMore ? rawItems.slice(0, limit) : rawItems;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]._id.toString() : null;

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({
      items: items.map(ensureFileType),
      nextCursor,
      hasMore,
      limit,
      total,
    });
  } catch (err) {
    console.error('[searchMedia error]:', err.message);
    res.status(500).json({ message: 'Search failed' });
  }
};

/**
 * GET /api/v1/media/:id or /api/v1/videos/:id or /api/v1/files/:id
 */
exports.getMedia = async (req, res) => {
  try {
    const item = await Media.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ message: 'File not found' });

    // Check hidden folder privacy
    let isHiddenItem = !!item.isHidden;
    let parent = null;
    if (item.folderId) {
      parent = await Media.findById(item.folderId).lean();
      if (parent?.isHidden) isHiddenItem = true;
    }

    const userId = req.user?._id?.toString() || req.user?.id?.toString();
    const itemOwner = item.uploadedBy || item.userId || parent?.uploadedBy || parent?.userId;
    if (itemOwner && userId && String(itemOwner) !== String(userId)) {
      return res.status(403).json({
        code: 'ACCESS_DENIED',
        error: 'ACCESS_DENIED',
        message: 'Not authorized to access this file',
      });
    }

    if (isHiddenItem) {
      const vaultSession = verifyVaultToken(req);
      if (vaultSession?.expired) {
        return res.status(403).json({
          code: 'VAULT_SESSION_EXPIRED',
          error: 'VAULT_SESSION_EXPIRED',
          message: 'Private vault session has expired. Please unlock the vault again.',
        });
      }
      if (!vaultSession || (userId && vaultSession.userId !== userId)) {
        return res.status(403).json({
          code: 'VAULT_AUTH_REQUIRED',
          error: 'VAULT_AUTH_REQUIRED',
          message: 'Access denied: item is in private vault',
        });
      }
    }

    // Check locked folder privacy
    const ownerId = req.user?._id || item.uploadedBy;
    if (ownerId) {
      const owner = await User.findById(ownerId).lean();
      const userLocked = owner?.lockedCategories || [];
      if (userLocked.length > 0 || item.isLocked) {
        const itemCat = (item.category || '').trim().replace(/^#/, '').toLowerCase();
        let isItemLocked = item.isLocked || userLocked.some((c) => (typeof c === 'string' ? c : c?.category || '').trim().replace(/^#/, '').toLowerCase() === itemCat);
        if (isItemLocked) {
          const rawUnlocked = typeof req.query?.unlockedCategories === 'string'
            ? req.query.unlockedCategories
            : Array.isArray(req.query?.unlockedCategories)
            ? req.query.unlockedCategories.join(',')
            : '';
          const unlockedList = rawUnlocked.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
          if (!unlockedList.includes(itemCat) && !unlockedList.includes(String(item._id).toLowerCase())) {
            return res.status(403).json({ message: 'Access denied: item is locked', locked: true });
          }
        }
      }
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json(ensureFileType(item));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch item details' });
  }
};

/**
 * GET /api/v1/files/:id/download or /api/v1/videos/:id/download
 */
exports.downloadFile = async (req, res) => {
  try {
    const item = await Media.findById(req.params.id);
    if (!item || !item.telegramFileId) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check hidden folder privacy
    let isHiddenItem = !!item.isHidden;
    let parent = null;
    if (item.folderId) {
      parent = await Media.findById(item.folderId).lean();
      if (parent?.isHidden) isHiddenItem = true;
    }

    const userId = req.user?._id?.toString() || req.user?.id?.toString();
    const itemOwner = item.uploadedBy || item.userId || parent?.uploadedBy || parent?.userId;
    if (itemOwner && userId && String(itemOwner) !== String(userId)) {
      return res.status(403).json({
        code: 'ACCESS_DENIED',
        error: 'ACCESS_DENIED',
        message: 'Not authorized to download this file',
      });
    }

    if (isHiddenItem) {
      const vaultSession = verifyVaultToken(req);
      if (vaultSession?.expired) {
        return res.status(403).json({
          code: 'VAULT_SESSION_EXPIRED',
          error: 'VAULT_SESSION_EXPIRED',
          message: 'Private vault session has expired. Please unlock the vault again.',
        });
      }
      if (!vaultSession || (userId && vaultSession.userId !== userId)) {
        return res.status(403).json({
          code: 'VAULT_AUTH_REQUIRED',
          error: 'VAULT_AUTH_REQUIRED',
          message: 'Access denied: item is in private vault',
        });
      }
    }

    // Check locked folder privacy
    const ownerId = req.user?._id || item.uploadedBy;
    if (ownerId) {
      const owner = await User.findById(ownerId).lean();
      const userLocked = owner?.lockedCategories || [];
      if (userLocked.length > 0 || item.isLocked) {
        const itemCat = (item.category || '').trim().replace(/^#/, '').toLowerCase();
        let isItemLocked = item.isLocked || userLocked.some((c) => (typeof c === 'string' ? c : c?.category || '').trim().replace(/^#/, '').toLowerCase() === itemCat);
        if (isItemLocked) {
          const rawUnlocked = typeof req.query?.unlockedCategories === 'string'
            ? req.query.unlockedCategories
            : Array.isArray(req.query?.unlockedCategories)
            ? req.query.unlockedCategories.join(',')
            : '';
          const unlockedList = rawUnlocked.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
          if (!unlockedList.includes(itemCat) && !unlockedList.includes(String(item._id).toLowerCase())) {
            return res.status(403).json({ message: 'Access denied: item is locked', locked: true });
          }
        }
      }
    }

    const fileUrl = await resolveFileUrl(item.telegramFileId);
    
    // Proxy download stream
    const response = await axios({
      method: 'GET',
      url: fileUrl,
      responseType: 'stream',
      timeout: 180000,
    });

    const isInline = req.query.inline === 'true' || req.query.inline === '1' || req.query.preview === 'true';
    const rawTitle = item.title || 'file';
    let ext = item.extension ? `.${item.extension.replace(/^\./, '')}` : '';
    if (!ext) {
      const parsed = path.extname(item.originalName || rawTitle);
      if (parsed) ext = parsed;
      else if (item.mimeType) {
        const mimeMap = {
          'image/jpeg': '.jpg',
          'image/png': '.png',
          'image/webp': '.webp',
          'image/avif': '.avif',
          'image/gif': '.gif',
          'image/svg+xml': '.svg',
          'image/bmp': '.bmp',
          'image/tiff': '.tiff',
          'image/heic': '.heic',
          'image/heif': '.heif',
          'image/x-icon': '.ico',
          'video/mp4': '.mp4',
        };
        ext = mimeMap[item.mimeType.toLowerCase()] || '';
      }
    }
    const safeFilename = rawTitle.toLowerCase().endsWith(ext.toLowerCase()) ? rawTitle : `${rawTitle}${ext}`;
    const asciiFilename = safeFilename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
    const utf8Filename = encodeURIComponent(safeFilename);
    const dispositionType = isInline ? 'inline' : 'attachment';

    res.setHeader('Content-Disposition', `${dispositionType}; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const effectiveMime = item.mimeType || (ext ? getMimeForFormat(ext.replace('.', '')) : 'application/octet-stream');
    res.setHeader('Content-Type', effectiveMime);
    if (effectiveMime === 'image/svg+xml') {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    }
    if (item.fileSizeBytes) res.setHeader('Content-Length', item.fileSizeBytes);

    response.data.pipe(res);
  } catch (err) {
    console.error('[downloadFile error]:', err.message);
    res.status(500).json({ message: 'Failed to download file' });
  }
};

/**
 * GET /api/v1/media/user/library
 * Sums fileSizeBytes for every non-trashed file (folders excluded).
 */
exports.getUserLibrary = async (req, res) => {
  try {
    const match = {
      isTrashed: { $ne: true },
      isFolder: { $ne: true },
    };

    if (req.user?._id) {
      match.$or = [
        { uploadedBy: req.user._id },
        { uploadedBy: null },
        { uploadedBy: { $exists: false } },
      ];
    }

    const [totals] = await Media.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalBytes: { $sum: { $ifNull: ['$fileSizeBytes', 0] } },
          totalItems: { $sum: 1 },
        },
      },
    ]);

    const categoryStats = {
      image: 0,
      video: 0,
      audio: 0,
      document: 0,
      archive: 0,
      code: 0,
      other: 0,
    };

    const breakdownRows = await Media.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            $toLower: {
              $ifNull: ['$fileType', { $ifNull: ['$fileCategory', 'other'] }],
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    breakdownRows.forEach((row) => {
      const key = row._id === 'pdf' ? 'document' : row._id;
      if (Object.prototype.hasOwnProperty.call(categoryStats, key)) {
        categoryStats[key] += row.count;
      } else {
        categoryStats.other += row.count;
      }
    });

    const starredMatch = { isStarred: true, isTrashed: { $ne: true } };
    const trashMatch = { isTrashed: true };
    if (req.user?._id) {
      const ownerOrLegacy = [
        { uploadedBy: req.user._id },
        { uploadedBy: null },
        { uploadedBy: { $exists: false } },
      ];
      starredMatch.$or = ownerOrLegacy;
      trashMatch.$or = ownerOrLegacy;
    }

    const starredCount = await Media.countDocuments(starredMatch);
    const trashCount = await Media.countDocuments(trashMatch);

    res.json({
      stats: {
        totalItems: totals?.totalItems || 0,
        totalBytes: totals?.totalBytes || 0,
        categoryStats,
        starredCount,
        trashCount,
      },
    });
  } catch (err) {
    console.error('[getUserLibrary error]:', err.message);
    res.status(500).json({ message: 'Failed to load drive library stats' });
  }
};

/**
 * GET /api/v1/videos/feed
 */
exports.getFeed = async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const { category, cursor, unlockedCategories } = req.query;

    const query = {
      isTrashed: { $ne: true },
      isFolder: { $ne: true },
      status: { $ne: 'deleting' },
      $or: [
        { fileType: 'video' },
        { fileCategory: 'video' },
        { mediaType: 'video' },
        { mimeType: /^video\//i },
        { extension: { $in: ['mp4', 'mov', 'webm', 'mkv', 'avi', '3gp', 'm4v', 'ts', 'flv'] } },
      ],
    };

    if (category && category !== 'All') {
      const cleanCat = category.replace(/^#/, '').trim();
      query.category = new RegExp(`^#?${cleanCat.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i');
    } else {
      try {
        let userLocked = Array.isArray(req.user?.lockedCategories) ? req.user.lockedCategories : [];
        if (userLocked.length === 0) {
          const dbUser = await User.findOne({ 'lockedCategories.0': { $exists: true } }).lean();
          if (dbUser?.lockedCategories) {
            userLocked = dbUser.lockedCategories;
          }
        }

        const rawUnlocked = typeof req.query?.unlockedCategories === 'string'
          ? req.query.unlockedCategories
          : Array.isArray(req.query?.unlockedCategories)
          ? req.query.unlockedCategories.join(',')
          : '';

        const unlockedList = rawUnlocked
          .split(',')
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean);

        // If client authenticated with PIN/Biometrics for Reels feed ('all' or 'reels'), include all videos
        if (rawUnlocked.toLowerCase() === 'all' || unlockedList.includes('all') || unlockedList.includes('reels')) {
          // Authenticated Reels session: all categories permitted
        } else {
          const activeLockedCategories = userLocked.filter(
            (c) => !unlockedList.includes(c.toLowerCase())
          );

          if (activeLockedCategories.length > 0) {
            query.category = {
              $nin: activeLockedCategories.map((c) => new RegExp(`^${c}$`, 'i')),
            };
          }
        }
      } catch (catFilterErr) {
        console.warn('[getFeed category filter fallback warning]:', catFilterErr.message);
      }
    }

    if (cursor) {
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const videos = await Media.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = videos.length > limit;
    const items = hasMore ? videos.slice(0, limit) : videos;
    const nextCursor = items.length > 0 ? items[items.length - 1]._id.toString() : null;

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      items: items.map(ensureFileType),
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
      count: items.length,
    });
  } catch (err) {
    console.error('[getFeed error]:', err.message);
    res.status(500).json({ message: 'Failed to fetch video feed' });
  }
};

/**
 * GET /api/v1/videos/categories
 */
exports.getCategories = async (req, res) => {
  try {
    const distinct = await Media.distinct('category', {
      isTrashed: { $ne: true },
      isFolder: { $ne: true },
    });

    const standardCategories = ['Trending', 'Music', 'Gaming', 'Tech', 'Comedy', 'Entertainment', 'Tutorials'];
    const set = new Set(standardCategories);

    distinct.forEach((c) => {
      if (c && typeof c === 'string' && c.trim()) {
        const clean = c.trim().replace(/^#/, '');
        if (clean && clean.toLowerCase() !== 'all' && clean.toLowerCase() !== 'general') {
          set.add(clean);
        }
      }
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ categories: Array.from(set) });
  } catch (err) {
    console.error('[getCategories error]:', err.message);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
};

/**
 * GET /api/v1/videos/:id/thumbnail or /api/v1/media/:id/thumbnail
 */
exports.getVideoThumbnail = async (req, res) => {
  try {
    const item = await Media.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Media not found' });
    }

    // 1. If base64 data URL is stored in database
    if (item.thumbnail && item.thumbnail.startsWith('data:image/')) {
      const parts = item.thumbnail.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const imgBuffer = Buffer.from(parts[1], 'base64');

      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      res.setHeader('Content-Length', imgBuffer.length);
      return res.send(imgBuffer);
    }

    // 2. If thumbnail is stored in Telegram via thumbnailFileId
    const targetFileId = item.thumbnailFileId || (item.fileType === 'image' ? item.telegramFileId : null);
    if (targetFileId) {
      const fileUrl = await resolveFileUrl(targetFileId);
      const response = await axios({
        method: 'GET',
        url: fileUrl,
        responseType: 'stream',
        timeout: 60000,
      });

      const contentType = item.thumbnailFileId
        ? 'image/jpeg'
        : (item.mimeType || getMimeForFormat(item.extension) || 'image/jpeg');

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      if (contentType === 'image/svg+xml') {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
      }
      return response.data.pipe(res);
    }

    res.status(404).json({ message: 'Thumbnail not available' });
  } catch (err) {
    console.error('[getVideoThumbnail error]:', err.message);
    res.status(500).json({ message: 'Failed to retrieve thumbnail' });
  }
};

/**
 * Safe maintenance routine that identifies and cleans orphaned data.
 * Defaults to dry-run (report only). Only deletes when options.dryRun === false.
 */
async function cleanupOrphans(options = {}) {
  const dryRun = options.dryRun !== false; // default true
  const correlationId = options.correlationId || `cleanup_${Date.now()}`;
  console.log(`[${correlationId}] [cleanupOrphans] Running orphan scan (dryRun=${dryRun})...`);

  // 1. Existing folder IDs
  const allFolders = await Media.find({ isFolder: true }).select('_id title category').lean();
  const folderIdSet = new Set(allFolders.map((f) => String(f._id)));
  const folderTitlesAndCats = new Set(
    allFolders.flatMap((f) => [f.title, f.category].filter(Boolean).map((s) => s.trim().toLowerCase()))
  );

  // 2. Orphaned files whose folderId is not in existing folders
  const filesWithFolder = await Media.find({
    isFolder: false,
    folderId: { $ne: null },
  }).lean();
  const orphanedFiles = filesWithFolder.filter((f) => !folderIdSet.has(String(f.folderId)));

  // 3. Orphaned subfolders whose folderId is not in existing folders
  const subfoldersWithFolder = await Media.find({
    isFolder: true,
    folderId: { $ne: null },
  }).lean();
  const orphanedSubfolders = subfoldersWithFolder.filter((sf) => !folderIdSet.has(String(sf.folderId)));

  // 4. All existing Media IDs for reference checks
  const allMediaDocs = await Media.find({}).select('_id').lean();
  const mediaIdSet = new Set(allMediaDocs.map((m) => String(m._id)));

  // 5. Orphaned Likes
  const allLikes = await Like.find({}).lean();
  const orphanedLikes = allLikes.filter(
    (l) => (l.mediaId && !mediaIdSet.has(String(l.mediaId))) || (l.videoId && !mediaIdSet.has(String(l.videoId)))
  );

  // 6. Orphaned WatchHistory
  const allHistory = await WatchHistory.find({}).lean();
  const orphanedHistory = allHistory.filter(
    (h) => (h.mediaId && !mediaIdSet.has(String(h.mediaId))) || (h.videoId && !mediaIdSet.has(String(h.videoId)))
  );

  // 7. Orphaned ShareLinks
  const allShares = await ShareLink.find({}).lean();
  const orphanedShares = allShares.filter((s) => {
    if (s.scope === 'file') {
      return s.fileId && !mediaIdSet.has(String(s.fileId));
    }
    if (s.scope === 'folder') {
      const cat = (s.category || '').trim().toLowerCase();
      const ft = (s.folderTitle || '').trim().toLowerCase();
      return (cat && !folderTitlesAndCats.has(cat)) && (ft && !folderTitlesAndCats.has(ft));
    }
    return false;
  });

  // 8. Orphaned locks in Users
  const allUsers = await User.find({}).select('_id username lockedCategories').lean();
  const orphanedUserLocks = [];
  for (const u of allUsers) {
    const locks = u.lockedCategories || [];
    for (const item of locks) {
      if (mongoose.Types.ObjectId.isValid(item) && !folderIdSet.has(String(item))) {
        orphanedUserLocks.push({ userId: u._id, username: u.username, lockItem: item });
      }
    }
  }

  // 9. Files lacking telegramMessageId or thumbnails lacking thumbnailMessageId
  const legacyFilesWithoutMessageId = await Media.find({
    isFolder: false,
    $or: [{ telegramMessageId: { $exists: false } }, { telegramMessageId: null }],
  }).select('_id title').lean();

  const legacyThumbnailsWithoutMessageId = await Media.find({
    isFolder: false,
    thumbnailFileId: { $exists: true, $ne: '' },
    $or: [{ thumbnailMessageId: { $exists: false } }, { thumbnailMessageId: null }],
  }).select('_id title thumbnailFileId').lean();

  const report = {
    dryRun,
    orphanedFilesCount: orphanedFiles.length,
    orphanedFiles: orphanedFiles.map((f) => ({ _id: f._id, title: f.title, folderId: f.folderId, telegramMessageId: f.telegramMessageId })),
    orphanedSubfoldersCount: orphanedSubfolders.length,
    orphanedSubfolders: orphanedSubfolders.map((sf) => ({ _id: sf._id, title: sf.title, folderId: sf.folderId })),
    orphanedLikesCount: orphanedLikes.length,
    orphanedWatchHistoryCount: orphanedHistory.length,
    orphanedShareLinksCount: orphanedShares.length,
    orphanedUserLocksCount: orphanedUserLocks.length,
    legacyFilesWithoutMessageIdCount: legacyFilesWithoutMessageId.length,
    legacyThumbnailsWithoutMessageIdCount: legacyThumbnailsWithoutMessageId.length,
    deleted: null,
  };

  if (!dryRun) {
    console.log(`[${correlationId}] [cleanupOrphans] Executing live deletion of orphaned data...`);

    // 1. Delete Telegram messages for orphaned files
    const tgIdsToDelete = [];
    for (const f of orphanedFiles) {
      if (f.telegramMessageId) tgIdsToDelete.push(f.telegramMessageId);
      if (f.thumbnailMessageId) tgIdsToDelete.push(f.thumbnailMessageId);
    }
    let tgDeletedCount = 0;
    if (tgIdsToDelete.length > 0) {
      const tgRes = await deleteTelegramMessages(tgIdsToDelete, { correlationId });
      tgDeletedCount = tgRes.deletedCount;
    }

    // 2. Delete orphaned files and subfolders
    const fileIdsToDelete = orphanedFiles.map((f) => f._id);
    const subfolderIdsToDelete = orphanedSubfolders.map((sf) => sf._id);
    const allIds = [...fileIdsToDelete, ...subfolderIdsToDelete];
    if (allIds.length > 0) {
      await Media.deleteMany({ _id: { $in: allIds } });
    }

    // 3. Delete orphaned Likes
    if (orphanedLikes.length > 0) {
      const likeIds = orphanedLikes.map((l) => l._id);
      await Like.deleteMany({ _id: { $in: likeIds } });
    }

    // 4. Delete orphaned WatchHistory
    if (orphanedHistory.length > 0) {
      const historyIds = orphanedHistory.map((h) => h._id);
      await WatchHistory.deleteMany({ _id: { $in: historyIds } });
    }

    // 5. Delete orphaned ShareLinks
    if (orphanedShares.length > 0) {
      const shareIds = orphanedShares.map((s) => s._id);
      await ShareLink.deleteMany({ _id: { $in: shareIds } });
    }

    // 6. Clean orphaned locks in Users
    for (const item of orphanedUserLocks) {
      await User.findByIdAndUpdate(item.userId, {
        $pull: { lockedCategories: item.lockItem },
      });
    }

    report.deleted = {
      telegramMessages: tgDeletedCount,
      mediaDocuments: allIds.length,
      likes: orphanedLikes.length,
      watchHistory: orphanedHistory.length,
      shareLinks: orphanedShares.length,
      userLocks: orphanedUserLocks.length,
    };

    console.log(`[${correlationId}] [cleanupOrphans] Cleanup executed successfully:`, report.deleted);
  }

  return report;
}

exports.cleanupOrphans = cleanupOrphans;

exports.cleanupOrphansHandler = async (req, res) => {
  try {
    const dryRun = req.body?.dryRun !== false && req.query?.dryRun !== 'false';
    const report = await cleanupOrphans({ dryRun });
    res.json({
      success: true,
      message: dryRun ? 'Orphan scan completed (dry run). No changes made.' : 'Orphan cleanup executed successfully.',
      ...report,
    });
  } catch (err) {
    console.error('[cleanupOrphansHandler error]:', err.message);
    res.status(500).json({ success: false, message: 'Failed to run orphan cleanup', error: err.message });
  }
};

// Aliases
exports.deleteMedia = exports.trashOrDelete;

