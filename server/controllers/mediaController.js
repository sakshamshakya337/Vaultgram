'use strict';
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const Media = require('../models/Media');
const WatchHistory = require('../models/WatchHistory');
const Like = require('../models/Like');
const Playlist = require('../models/Playlist');
const {
  uploadMediaToTelegram,
  deleteMediaFromTelegram,
  detectFileCategory,
} = require('../services/telegramService');

// Multer memory storage (zero local disk usage)
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (_req, _file, cb) => {
    // Accept ALL files
    cb(null, true);
  },
});

exports.uploadMiddleware = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'media', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
]);

/**
 * GET /api/v1/media
 * Google Drive listing: supports folder navigation, filter (my-drive, starred, recent, trash), fileCategory, sort.
 */
exports.listMedia = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const filterType = req.query.filter || 'my-drive'; // my-drive, starred, recent, trash
    const folderId = req.query.folderId; // null, 'root', or folder ObjectId
    const fileCategory = req.query.fileCategory; // image, video, audio, pdf, document, code, archive
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

    if (category && category !== 'All') {
      query.category = category;
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

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      items,
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
 * Creates a new folder in Google Drive
 */
exports.createFolder = async (req, res) => {
  try {
    const { title, folderId } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Folder title is required' });
    }

    const parentId = folderId && folderId !== 'root' && folderId !== 'null' ? folderId : null;

    const folder = await Media.create({
      title: title.trim(),
      isFolder: true,
      mediaType: 'folder',
      fileCategory: 'folder',
      folderId: parentId,
      uploadedBy: req.user?.id || req.user?._id,
    });

    res.status(201).json(folder);
  } catch (err) {
    console.error('[createFolder error]:', err.message);
    res.status(500).json({ message: 'Failed to create folder' });
  }
};

/**
 * POST /api/v1/media/upload
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

    const { title, description, category, folderId } = req.body;
    const finalTitle = title?.trim() || uploadedFile.originalname || 'Untitled File';
    const parentId = folderId && folderId !== 'root' && folderId !== 'null' ? folderId : null;
    const detectedCategory = detectFileCategory(uploadedFile.originalname, uploadedFile.mimetype);

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
      mediaType,
      fileCategory,
      extension,
    } = await uploadMediaToTelegram(
      uploadedFile.buffer,
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
      mediaType: mediaType || detectedCategory,
      fileCategory: fileCategory || detectedCategory,
      extension: extension || path.extname(uploadedFile.originalname).replace('.', ''),
      mimeType: uploadedFile.mimetype || '',
      thumbnail: finalThumbnail,
      telegramFileId: fileId,
      telegramMessageId: messageId,
      duration: duration || 0,
      width: width || 0,
      height: height || 0,
      fileSizeBytes: fileSizeBytes || uploadedFile.size || 0,
      uploadedBy: req.user?.id || req.user?._id,
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error('[uploadMedia error]:', err.message);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File exceeds maximum 100MB Telegram limit' });
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
    res.json(item);
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
    res.json(item);
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

    if (!item.isTrashed) {
      // Move to Trash
      item.isTrashed = true;
      item.trashedAt = new Date();
      await item.save();
      return res.json({ message: 'Moved to Trash', isTrashed: true });
    }

    // Already in trash: Permanently Purge!
    if (item.telegramMessageId) {
      await deleteMediaFromTelegram(item.telegramMessageId);
    }

    await Promise.all([
      Media.findByIdAndDelete(req.params.id),
      WatchHistory.deleteMany({ $or: [{ mediaId: req.params.id }, { videoId: req.params.id }] }),
      Like.deleteMany({ $or: [{ mediaId: req.params.id }, { videoId: req.params.id }] }),
      Playlist.updateMany({}, { $pull: { mediaIds: req.params.id, videoIds: req.params.id } }),
    ]);

    res.json({ message: 'Permanently deleted', deleted: true });
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
    const item = await Media.findByIdAndUpdate(
      req.params.id,
      { isTrashed: false, trashedAt: null },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ message: 'Restored from Trash', item });
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
    res.json({ message: 'Trash emptied completely' });
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
    const folders = await Media.find({ isFolder: true, isTrashed: { $ne: true } })
      .select('_id title folderId')
      .sort({ title: 1 })
      .lean();
    res.json({ folders });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch folders' });
  }
};

/**
 * GET /api/v1/media/:id
 */
exports.getMedia = async (req, res) => {
  try {
    const item = await Media.findById(req.params.id).populate('uploadedBy', 'username avatar').lean();
    if (!item) return res.status(404).json({ message: 'Item not found' });

    Media.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }).exec();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch item' });
  }
};

/**
 * GET /api/v1/media/search
 */
exports.searchMedia = async (req, res) => {
  try {
    const { q, fileCategory, category } = req.query;
    const filter = { isTrashed: { $ne: true } };

    if (q && q.trim()) {
      filter.$or = [
        { title: { $regex: q.trim(), $options: 'i' } },
        { description: { $regex: q.trim(), $options: 'i' } },
        { extension: { $regex: q.trim(), $options: 'i' } },
      ];
    }

    if (fileCategory && fileCategory !== 'all') {
      filter.fileCategory = fileCategory;
    }

    if (category && category !== 'All') {
      filter.category = category;
    }

    const items = await Media.find(filter).sort({ isFolder: -1, createdAt: -1 }).limit(50).lean();
    res.json({ items, total: items.length });
  } catch (err) {
    res.status(500).json({ message: 'Search failed' });
  }
};

/**
 * GET /api/v1/media/user/library
 */
exports.getUserLibrary = async (req, res) => {
  try {
    const allFiles = await Media.find({ isFolder: false, isTrashed: { $ne: true } }).lean();

    const totalBytes = allFiles.reduce((acc, curr) => acc + (curr.fileSizeBytes || 0), 0);
    const categoryStats = {
      image: allFiles.filter((i) => i.fileCategory === 'image').length,
      video: allFiles.filter((i) => i.fileCategory === 'video').length,
      audio: allFiles.filter((i) => i.fileCategory === 'audio').length,
      document: allFiles.filter((i) => i.fileCategory === 'document' || i.fileCategory === 'pdf').length,
      archive: allFiles.filter((i) => i.fileCategory === 'archive').length,
      code: allFiles.filter((i) => i.fileCategory === 'code').length,
      other: allFiles.filter((i) => i.fileCategory === 'other').length,
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
 * Cursor-based infinite scroll feed for TikTok / Reels vertical playback.
 * Query params:
 *  - category: optional category filter ('All' or specific category name)
 *  - cursor: optional last seen item _id (returns items created before this cursor)
 *  - limit: number of items (default 10)
 */
exports.getFeed = async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const { category, cursor } = req.query;

    const query = {
      isTrashed: { $ne: true },
      isFolder: { $ne: true },
      $or: [
        { fileCategory: 'video' },
        { mediaType: 'video' },
      ],
    };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }

    const items = await Media.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = items.length > limit;
    const feed = hasMore ? items.slice(0, limit) : items;
    const nextCursor = feed.length > 0 ? feed[feed.length - 1]._id : null;

    res.json({
      items: feed,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
      count: feed.length,
    });
  } catch (err) {
    console.error('[getFeed error]:', err);
    res.status(500).json({ message: 'Failed to load video feed' });
  }
};

/**
 * GET /api/v1/videos/categories
 * Returns distinct category list from active video collection.
 */
exports.getCategories = async (_req, res) => {
  try {
    const distinct = await Media.distinct('category', {
      isTrashed: { $ne: true },
      isFolder: { $ne: true },
      $or: [{ fileCategory: 'video' }, { mediaType: 'video' }],
    });

    // Clean up empty, null, or undefined values
    const categories = distinct
      .filter((c) => c && typeof c === 'string' && c.trim().length > 0)
      .map((c) => c.trim());

    // Ensure default common categories are present if collection is small
    const defaultCategories = ['Trending', 'Music', 'Gaming', 'Tech', 'Comedy', 'Entertainment', 'Tutorials'];
    const set = new Set([...categories, ...defaultCategories]);

    res.json({
      categories: Array.from(set),
    });
  } catch (err) {
    console.error('[getCategories error]:', err);
    res.status(500).json({ message: 'Failed to retrieve categories' });
  }
};

// Aliases
exports.deleteMedia = exports.trashOrDelete;
exports.toggleLike = exports.toggleStar;

