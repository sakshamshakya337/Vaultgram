'use strict';
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const Media = require('../models/Media');
const WatchHistory = require('../models/WatchHistory');
const Like = require('../models/Like');
const Playlist = require('../models/Playlist');
const {
  uploadMediaToTelegram,
  uploadVideoToTelegram,
  uploadDocumentToTelegram,
  deleteMediaFromTelegram,
  detectFileCategory,
  detectFileType,
  resolveFileUrl,
} = require('../services/telegramService');
const {
  compressVideoIfNeeded,
  MAX_VIDEO_UPLOAD_SIZE_MB,
} = require('../services/videoCompressionService');

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
 * Drive listing: supports folders, categories, filters, search.
 */
exports.listMedia = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const filterType = req.query.filter || 'my-drive'; // my-drive, starred, recent, trash
    const folderId = req.query.folderId; // null, 'root', or folder ObjectId
    const fileCategory = req.query.fileCategory; // image, video, audio, pdf, document, code, archive
    const fileType = req.query.fileType; // video, document, image, audio, other
    const category = req.query.category;

    const query = {};

    if (filterType === 'trash') {
      query.isTrashed = true;
    } else {
      query.isTrashed = { $ne: true };

      if (filterType === 'starred') {
        query.isStarred = true;
      } else if (filterType === 'recent') {
        // recent shows all files without folder constraints
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

    // ─── Locked Categories Security Protection ──────────────────────────────────
    let userLocked = Array.isArray(req.user?.lockedCategories) ? req.user.lockedCategories : [];
    if (userLocked.length === 0) {
      try {
        const dbUser = await User.findOne({ 'lockedCategories.0': { $exists: true } }).lean();
        if (dbUser?.lockedCategories) {
          userLocked = dbUser.lockedCategories;
        }
      } catch {}
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

    const activeLockedCategories = userLocked.filter(
      (c) => !unlockedList.includes(c.toLowerCase())
    );

    // If requesting a specific locked category without session unlock, block with 403
    if (category && category !== 'All') {
      if (activeLockedCategories.some((c) => c.toLowerCase() === category.toLowerCase())) {
        return res.status(403).json({
          locked: true,
          message: `Category "${category}" is locked. Unlock with biometric or PIN passcode.`,
          items: [],
          total: 0,
        });
      }
      query.category = category;
    } else if (activeLockedCategories.length > 0) {
      // Exclude all locked categories from the general dashboard listing
      query.category = {
        $nin: activeLockedCategories.map((c) => new RegExp(`^${c}$`, 'i')),
      };
    }

    let sort = { isFolder: -1, createdAt: -1 };
    if (req.query.sort === 'name_asc') sort = { isFolder: -1, title: 1 };
    if (req.query.sort === 'name_desc') sort = { isFolder: -1, title: -1 };
    if (req.query.sort === 'oldest') sort = { isFolder: -1, createdAt: 1 };
    if (req.query.sort === 'size_desc') sort = { isFolder: -1, fileSizeBytes: -1 };

    const [items, total] = await Promise.all([
      Media.find(query).sort(sort).skip(skip).limit(limit).lean(),
      Media.countDocuments(query),
    ]);

    // Build breadcrumbs if inside a folder
    let breadcrumbs = [{ id: 'root', title: 'My Drive' }];
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
      breadcrumbs = [{ id: 'root', title: 'My Drive' }, ...trail];
    }

    const formattedItems = items.map(ensureFileType);

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      items: formattedItems,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
    const { title, folderId, parentFolderId } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Folder title is required' });
    }

    const targetParent = folderId || parentFolderId;
    const parentId = targetParent && targetParent !== 'root' && targetParent !== 'null' ? targetParent : null;

    const folder = await Media.create({
      title: title.trim(),
      isFolder: true,
      fileType: 'other',
      mediaType: 'folder',
      fileCategory: 'folder',
      folderId: parentId,
      uploadedBy: req.user?.id || req.user?._id,
    });

    res.status(201).json(ensureFileType(folder.toObject()));
  } catch (err) {
    console.error('[createFolder error]:', err.message);
    res.status(500).json({ message: 'Failed to create folder' });
  }
};

/**
 * POST /api/v1/media/upload or /api/v1/videos/upload or /api/v1/files/upload
 */
exports.uploadMedia = async (req, res) => {
  try {
    const uploadedFile =
      req.files?.file?.[0] ||
      req.files?.video?.[0] ||
      req.files?.media?.[0] ||
      req.file;

    const thumbFile = req.files?.thumbnail?.[0];

    if (!uploadedFile) {
      return res.status(400).json({ message: 'No file provided for upload' });
    }

    const autoFileType = detectFileType(uploadedFile.originalname, uploadedFile.mimetype);
    const autoCategory = detectFileCategory(uploadedFile.originalname, uploadedFile.mimetype);

    let finalBuffer = uploadedFile.buffer;
    let finalSize = uploadedFile.size;
    let isCompressed = false;
    let compressionRatio = 0;
    let compressedMeta = {};

    // ─── Automatic Video Compression to <= 20MB ──────────────────────────────────
    if (autoFileType === 'video' || uploadedFile.mimetype.startsWith('video/')) {
      const compressionResult = await compressVideoIfNeeded(
        uploadedFile.buffer,
        uploadedFile.originalname,
        uploadedFile.mimetype
      );

      finalBuffer = compressionResult.buffer;
      finalSize = compressionResult.size;
      isCompressed = compressionResult.compressed;
      compressionRatio = compressionResult.compressionPercentage;
      compressedMeta = {
        duration: compressionResult.duration,
        width: compressionResult.width,
        height: compressionResult.height,
      };
    } else {
      // For non-video files (images, documents), enforce Telegram standard 20MB limit
      const MAX_HOSTED_TELEGRAM_SIZE = 20 * 1024 * 1024;
      if (uploadedFile.size > MAX_HOSTED_TELEGRAM_SIZE) {
        const sizeMb = (uploadedFile.size / (1024 * 1024)).toFixed(1);
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

    let finalThumbnail = req.body.thumbnail || '';
    if (thumbFile) {
      finalThumbnail = `data:${thumbFile.mimetype || 'image/jpeg'};base64,${thumbFile.buffer.toString('base64')}`;
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
      uploadedFile.originalname,
      uploadedFile.mimetype,
      thumbFile?.buffer
    );

    // 2. Save document in MongoDB
    const doc = await Media.create({
      title: finalTitle,
      description: description?.trim() || '',
      category: category?.trim() || 'General',
      isFolder: false,
      folderId: parentId,
      fileType: fileType || autoFileType,
      mediaType: mediaType || autoCategory,
      fileCategory: fileCategory || autoCategory,
      extension: extension || path.extname(uploadedFile.originalname).replace('.', ''),
      mimeType: uploadedFile.mimetype || '',
      thumbnail: finalThumbnail,
      telegramFileId: fileId,
      telegramMessageId: messageId,
      duration: duration || compressedMeta.duration || 0,
      width: width || compressedMeta.width || 0,
      height: height || compressedMeta.height || 0,
      fileSizeBytes: fileSizeBytes || finalSize || 0,
      uploadedBy: req.user?.id || req.user?._id,
    });

    const resultDoc = ensureFileType(doc.toObject());
    resultDoc.originalSize = uploadedFile.size;
    resultDoc.finalSize = finalSize;
    resultDoc.compressed = isCompressed;
    resultDoc.compressionPercentage = compressionRatio;

    res.status(201).json(resultDoc);
  } catch (err) {
    console.error('[uploadMedia error]:', err.message);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: `File exceeds maximum ${MAX_VIDEO_UPLOAD_SIZE_MB || 200}MB upload limit` });
    }
    res.status(500).json({ message: err.message || 'File upload failed' });
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
    const { targetFolderId } = req.body;
    const parentId = targetFolderId && targetFolderId !== 'root' && targetFolderId !== 'null' ? targetFolderId : null;

    const item = await Media.findByIdAndUpdate(
      req.params.id,
      { folderId: parentId },
      { new: true }
    );

    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json(ensureFileType(item.toObject()));
  } catch (err) {
    console.error('[moveItem error]:', err.message);
    res.status(500).json({ message: 'Failed to move item' });
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
exports.trashOrDelete = async (req, res) => {
  try {
    const item = await Media.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (item.isTrashed) {
      if (item.telegramMessageId) {
        await deleteMediaFromTelegram(item.telegramMessageId);
      }
      await Media.findByIdAndDelete(req.params.id);
      return res.json({ message: 'Item permanently deleted' });
    }

    item.isTrashed = true;
    item.trashedAt = new Date();
    await item.save();

    res.json({ message: 'Item moved to trash', item: ensureFileType(item.toObject()) });
  } catch (err) {
    console.error('[trashOrDelete error]:', err.message);
    res.status(500).json({ message: 'Failed to delete item' });
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
    for (const item of trashedItems) {
      if (item.telegramMessageId) {
        await deleteMediaFromTelegram(item.telegramMessageId);
      }
    }
    await Media.deleteMany({ isTrashed: true });
    res.json({ message: 'Trash emptied permanently' });
  } catch (err) {
    console.error('[emptyTrash error]:', err.message);
    res.status(500).json({ message: 'Failed to empty trash' });
  }
};

/**
 * GET /api/v1/media/folders
 */
exports.listFolders = async (req, res) => {
  try {
    const folders = await Media.find({ isFolder: true, isTrashed: { $ne: true } }).sort({ title: 1 }).lean();
    res.json({ folders: folders.map(ensureFileType) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to list folders' });
  }
};

/**
 * GET /api/v1/media/search
 */
exports.searchMedia = async (req, res) => {
  try {
    const { q, fileCategory, fileType } = req.query;
    if (!q || !q.trim()) {
      return res.json({ items: [] });
    }

    const filter = {
      isTrashed: { $ne: true },
      $or: [
        { title: { $regex: q.trim(), $options: 'i' } },
        { description: { $regex: q.trim(), $options: 'i' } },
        { category: { $regex: q.trim(), $options: 'i' } },
      ],
    };

    if (fileCategory && fileCategory !== 'all') {
      filter.fileCategory = fileCategory;
    }
    if (fileType && fileType !== 'all') {
      filter.fileType = fileType;
    }

    const items = await Media.find(filter).sort({ isFolder: -1, createdAt: -1 }).limit(100).lean();
    res.json({ items: items.map(ensureFileType) });
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

    const fileUrl = await resolveFileUrl(item.telegramFileId);
    
    // Proxy download stream
    const response = await axios({
      method: 'GET',
      url: fileUrl,
      responseType: 'stream',
      timeout: 180000,
    });

    const safeName = encodeURIComponent(item.title || 'file');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    if (item.mimeType) res.setHeader('Content-Type', item.mimeType);
    if (item.fileSizeBytes) res.setHeader('Content-Length', item.fileSizeBytes);

    response.data.pipe(res);
  } catch (err) {
    console.error('[downloadFile error]:', err.message);
    res.status(500).json({ message: 'Failed to download file' });
  }
};

/**
 * GET /api/v1/media/user/library
 */
exports.getUserLibrary = async (req, res) => {
  try {
    const allFiles = await Media.find({ isTrashed: { $ne: true }, isFolder: { $ne: true } }).lean();
    const totalBytes = allFiles.reduce((acc, curr) => acc + (curr.fileSizeBytes || 0), 0);
    const categoryStats = {
      image: allFiles.filter((i) => (i.fileType === 'image' || i.fileCategory === 'image')).length,
      video: allFiles.filter((i) => (i.fileType === 'video' || i.fileCategory === 'video')).length,
      audio: allFiles.filter((i) => (i.fileType === 'audio' || i.fileCategory === 'audio')).length,
      document: allFiles.filter((i) => (i.fileType === 'document' || i.fileCategory === 'document' || i.fileCategory === 'pdf')).length,
      archive: allFiles.filter((i) => i.fileCategory === 'archive').length,
      code: allFiles.filter((i) => i.fileCategory === 'code').length,
      other: allFiles.filter((i) => (i.fileType === 'other' || i.fileCategory === 'other')).length,
    };

    const starredCount = await Media.countDocuments({ isStarred: true, isTrashed: { $ne: true } });
    const trashCount = await Media.countDocuments({ isTrashed: true });

    res.json({
      stats: {
        totalItems: allFiles.length,
        totalBytes,
        categoryStats,
        starredCount,
        trashCount,
      },
    });
  } catch (err) {
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
      $or: [
        { fileType: 'video' },
        { fileCategory: 'video' },
        { mediaType: 'video' },
        { mimeType: /^video\//i },
        { extension: { $in: ['mp4', 'mov', 'webm', 'mkv', 'avi', '3gp', 'm4v', 'ts', 'flv'] } },
      ],
    };

    if (category && category !== 'All') {
      query.category = category;
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
    const set = new Set([...standardCategories]);

    distinct.forEach((c) => {
      if (c && typeof c === 'string' && c.trim()) {
        set.add(c.trim());
      }
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ categories: Array.from(set) });
  } catch (err) {
    console.error('[getCategories error]:', err.message);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
};

// Aliases
exports.deleteMedia = exports.trashOrDelete;
