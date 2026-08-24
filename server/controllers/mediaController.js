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
    const filterType = rawFilter || 'my-drive'; // my-drive, starred, recent, this-week, this-month, trash

    const query = {};

    // Search query support
    const searchTerm = (q || search || '').trim();
    if (searchTerm) {
      query.$or = [
        { title: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
        { category: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    if (filterType === 'trash') {
      query.isTrashed = true;
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
        // category view shows all files in that category across folders unless a specific folderId is given
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

    // ─── Locked Categories Security Protection ──────────────────────────────────
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
    } else {
      // General Aggregate / Home / All Files / Root / Starred / Recent listing:
      // STRICT SCOPING: ALWAYS exclude all locked categories from aggregate views,
      // regardless of whether any category was unlocked in another context this session.
      if (userLocked.length > 0) {
        query.category = {
          $nin: userLocked.map((c) => new RegExp(`^#?${c.replace(/^#/, '').replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i')),
        };
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

    // ─── Apple HEIC / HEIF Auto-Conversion to Universal JPEG ───────────────────
    if (isHeicFormat(uploadedFile.originalname, uploadedFile.mimetype)) {
      console.log(`[uploadMedia] Detected Apple HEIC/HEIF image: ${uploadedFile.originalname}. Converting to browser-compatible JPEG...`);
      try {
        const convertedJpegBuffer = await convertHeicToJpeg(uploadedFile.buffer);
        finalBuffer = convertedJpegBuffer;
        finalSize = convertedJpegBuffer.length;
        uploadFilename = `${path.parse(uploadedFile.originalname).name}.jpg`;
        uploadMimetype = 'image/jpeg';
        originalFormat = 'heic';
        servedFormat = 'jpeg';
        isConverted = true;
        console.log(`[uploadMedia] Successfully converted HEIC (${(uploadedFile.size / 1024).toFixed(1)} KB) to JPEG (${(finalSize / 1024).toFixed(1)} KB)`);
      } catch (convErr) {
        console.error('[uploadMedia] HEIC conversion error:', convErr.message);
      }
    }

    const autoFileType = isConverted ? 'image' : detectFileType(uploadFilename, uploadMimetype);
    const autoCategory = isConverted ? 'image' : detectFileCategory(uploadFilename, uploadMimetype);
    const videoExtRegex = /\.(mp4|mov|webm|mkv|avi|3gp|m4v|flv|ts|wmv|ogv)$/i;
    const isImage = autoFileType === 'image' || autoCategory === 'image' || (uploadMimetype && uploadMimetype.startsWith('image/'));
    const isVideo =
      autoFileType === 'video' ||
      autoCategory === 'video' ||
      (uploadMimetype && uploadMimetype.startsWith('video/')) ||
      videoExtRegex.test(uploadedFile.originalname) ||
      videoExtRegex.test(uploadFilename);

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

    let activeThumbBuffer = thumbFile?.buffer || null;

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
    let finalThumbnail = req.body.thumbnail || '';

    if (activeThumbBuffer) {
      finalThumbnail = `data:image/jpeg;base64,${activeThumbBuffer.toString('base64')}`;
      try {
        const thumbUpload = await uploadDocumentToTelegram(activeThumbBuffer, `${path.parse(uploadFilename).name}_thumb.jpg`, 'image/jpeg');
        thumbnailFileId = thumbUpload?.fileId || '';
      } catch (tUploadErr) {
        console.warn('[uploadMedia] Telegram thumbnail upload note (continuing with base64 thumbnail):', tUploadErr.message);
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
      activeThumbBuffer
    );

    // 2. Save document in MongoDB
    const doc = await Media.create({
      title: finalTitle,
      description: description?.trim() || '',
      category: (category?.trim() || 'General').replace(/^#/, '').trim() || 'General',
      isFolder: false,
      folderId: parentId,
      fileType: fileType || autoFileType,
      mediaType: mediaType || autoCategory,
      fileCategory: fileCategory || autoCategory,
      extension: extension || path.extname(uploadFilename).replace('.', ''),
      originalFormat: originalFormat || (isHeicFormat(uploadedFile.originalname, uploadedFile.mimetype) ? 'heic' : ''),
      servedFormat: servedFormat || (isConverted ? 'jpeg' : ''),
      isConverted: isConverted,
      mimeType: uploadMimetype || '',
      thumbnail: finalThumbnail,
      thumbnailFileId: thumbnailFileId,
      telegramFileId: fileId,
      telegramMessageId: messageId,
      duration: duration || compressedMeta.duration || 0,
      width: width || compressedMeta.width || 0,
      height: height || compressedMeta.height || 0,
      fileSizeBytes: fileSizeBytes || finalSize || 0,
      uploadedBy: req.user?.id || req.user?._id,
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
 * POST /api/v1/media/:id/trash or DELETE /api/v1/media/:id
 */
exports.trashOrDelete = async (req, res) => {
  try {
    const item = await Media.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    // Permanent delete if item is already trashed, or if direct DELETE HTTP method or ?permanent=true is used
    const isPermanent = item.isTrashed || req.query.permanent === 'true' || req.method === 'DELETE';

    if (isPermanent) {
      let telegramResult = { success: true };

      // If it's a folder, permanently delete all children and their Telegram messages
      if (item.isFolder) {
        const nestedFiles = await Media.find({ folderId: item._id });
        for (const nested of nestedFiles) {
          if (nested.telegramMessageId) {
            await deleteMediaFromTelegram(nested.telegramMessageId);
          }
        }
        await Media.deleteMany({ folderId: item._id });
      } else if (item.telegramMessageId) {
        telegramResult = await deleteMediaFromTelegram(item.telegramMessageId);
      }

      await Media.findByIdAndDelete(req.params.id);

      return res.json({
        success: true,
        message: 'Item permanently deleted',
        telegramDeleted: telegramResult.success,
        telegramNote: telegramResult.error ? `Telegram note: ${telegramResult.error}` : undefined,
      });
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
    const { q, fileCategory, fileType, cursor } = req.query;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 24));
    if (!q || !q.trim()) {
      return res.json({ items: [], nextCursor: null, hasMore: false, total: 0 });
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

    const isInline = req.query.inline === 'true' || req.query.inline === '1' || req.query.preview === 'true';
    const rawTitle = item.title || 'file';
    const ext = item.extension ? `.${item.extension.replace(/^\./, '')}` : '';
    const safeFilename = rawTitle.endsWith(ext) ? rawTitle : `${rawTitle}${ext}`;
    const asciiFilename = safeFilename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
    const utf8Filename = encodeURIComponent(safeFilename);
    const dispositionType = isInline ? 'inline' : 'attachment';

    res.setHeader('Content-Disposition', `${dispositionType}; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`);
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

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      return response.data.pipe(res);
    }

    res.status(404).json({ message: 'Thumbnail not available' });
  } catch (err) {
    console.error('[getVideoThumbnail error]:', err.message);
    res.status(500).json({ message: 'Failed to retrieve thumbnail' });
  }
};

// Aliases
exports.deleteMedia = exports.trashOrDelete;
