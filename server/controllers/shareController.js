'use strict';
const crypto = require('crypto');
const ShareLink = require('../models/ShareLink');
const Media = require('../models/Media');
const { streamMedia } = require('./streamController');

/**
 * Helper to calculate expiration date from durationHours
 * 0 or negative or 'never' = null (never expires)
 */
function calculateExpiresAt(rawHours) {
  if (rawHours === 'never' || rawHours === 0 || rawHours === '0' || rawHours === null || rawHours === undefined) {
    return null;
  }
  const hours = Number(rawHours);
  if (isNaN(hours) || hours <= 0) {
    return null;
  }
  // Max duration 720 hours (30 days) if specified
  const durationHours = Math.min(Math.max(hours, 1), 720);
  return new Date(Date.now() + durationHours * 3600 * 1000);
}

/**
 * Helper to check if a share link has expired
 */
function isLinkExpired(link) {
  if (!link.expiresAt) return false; // null means never expires
  return new Date(link.expiresAt) < new Date();
}

/**
 * POST /api/v1/videos/:id/share or /api/v1/share/create/:id
 * Create a public share link for an individual file (with optional duration or never expires)
 */
exports.createShareLink = async (req, res) => {
  try {
    const fileId = req.params.id;
    const item = await Media.findById(fileId);

    if (!item || item.isTrashed) {
      return res.status(404).json({ message: 'File not found or has been trashed' });
    }

    if (item.isFolder) {
      return res.status(400).json({ message: 'Use folder sharing endpoint to share a folder' });
    }

    // Refuse sharing if category is locked
    const userLocked = Array.isArray(req.user?.lockedCategories) ? req.user.lockedCategories : [];
    if (userLocked.some((lc) => lc.toLowerCase() === (item.category || '').toLowerCase())) {
      return res.status(403).json({
        message: 'Cannot create a public share link for an item in a locked category',
      });
    }

    const expiresAt = calculateExpiresAt(req.body.durationHours);
    const token = crypto.randomBytes(16).toString('hex');
    const shareLink = new ShareLink({
      scope: 'file',
      fileId: item._id,
      token,
      expiresAt,
      createdBy: req.user ? req.user._id : null,
    });

    await shareLink.save();

    res.status(201).json({
      success: true,
      token,
      scope: 'file',
      expiresAt,
      shareUrl: `/share/${token}`,
      durationHours: req.body.durationHours || (expiresAt ? 24 : 'never'),
    });
  } catch (err) {
    console.error('[createShareLink error]:', err.message);
    res.status(500).json({ message: 'Failed to generate share link' });
  }
};

/**
 * POST /api/v1/share/category/:category or /api/v1/videos/category/:category/share
 * Create a public share link for an entire folder / category
 */
exports.createFolderShareLink = async (req, res) => {
  try {
    const rawCategory = req.params.category || req.body.category || '';
    const category = rawCategory.replace(/^#/, '').trim();

    if (!category) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    // Refuse sharing if category is locked
    const userLocked = Array.isArray(req.user?.lockedCategories) ? req.user.lockedCategories : [];
    if (userLocked.some((lc) => lc.toLowerCase() === category.toLowerCase())) {
      return res.status(403).json({
        message: 'Cannot create a public share link for a locked folder/category',
      });
    }

    // Check if category has files
    const fileCount = await Media.countDocuments({
      category,
      isTrashed: { $ne: true },
      isFolder: { $ne: true },
    });

    if (fileCount === 0) {
      return res.status(400).json({ message: `No active files found in folder #${category}` });
    }

    const expiresAt = calculateExpiresAt(req.body.durationHours);
    const token = crypto.randomBytes(16).toString('hex');
    const shareLink = new ShareLink({
      scope: 'folder',
      category,
      folderTitle: category,
      token,
      expiresAt,
      createdBy: req.user ? req.user._id : null,
    });

    await shareLink.save();

    res.status(201).json({
      success: true,
      token,
      scope: 'folder',
      category,
      fileCount,
      expiresAt,
      shareUrl: `/share/folder/${token}`,
      durationHours: req.body.durationHours || (expiresAt ? 24 : 'never'),
    });
  } catch (err) {
    console.error('[createFolderShareLink error]:', err.message);
    res.status(500).json({ message: 'Failed to generate folder share link' });
  }
};

/**
 * GET /api/v1/share/:token/info
 * Retrieve file metadata for a public time-limited single-file share link
 */
exports.getShareInfo = async (req, res) => {
  try {
    const { token } = req.params;
    const link = await ShareLink.findOne({ token, scope: 'file' }).populate('fileId');

    if (!link) {
      return res.status(404).json({ message: 'Share link not found or has expired' });
    }

    if (isLinkExpired(link)) {
      await ShareLink.deleteOne({ _id: link._id }).catch(() => {});
      return res.status(410).json({ message: 'This share link has expired' });
    }

    const file = link.fileId;
    if (!file || file.isTrashed) {
      return res.status(404).json({ message: 'Shared file no longer exists' });
    }

    // Increment views asynchronously
    link.views = (link.views || 0) + 1;
    link.save().catch(() => {});

    res.json({
      success: true,
      token: link.token,
      scope: 'file',
      expiresAt: link.expiresAt,
      views: link.views,
      file: {
        _id: file._id,
        id: file._id,
        title: file.title,
        description: file.description,
        note: file.note,
        category: file.category,
        fileType: file.fileType || file.fileCategory || 'video',
        fileSizeBytes: file.fileSizeBytes,
        duration: file.duration,
        thumbnail: file.thumbnail,
        thumbnailFileId: file.thumbnailFileId,
        streamUrl: `/api/v1/share/${link.token}/stream`,
        downloadUrl: `/api/v1/share/${link.token}/download`,
        createdAt: file.createdAt,
      },
    });
  } catch (err) {
    console.error('[getShareInfo error]:', err.message);
    res.status(500).json({ message: 'Failed to retrieve shared file' });
  }
};

/**
 * GET /api/v1/share/folder/:token
 * Public folder listing endpoint returning all files in the shared category
 */
exports.getFolderShareInfo = async (req, res) => {
  try {
    const { token } = req.params;
    const link = await ShareLink.findOne({ token, scope: 'folder' });

    if (!link) {
      return res.status(404).json({ message: 'Folder share link not found or has expired' });
    }

    if (isLinkExpired(link)) {
      await ShareLink.deleteOne({ _id: link._id }).catch(() => {});
      return res.status(410).json({ message: 'This folder share link has expired' });
    }

    // Increment views asynchronously
    link.views = (link.views || 0) + 1;
    link.save().catch(() => {});

    // Fetch active files scoped STRICTLY to this shared category
    const files = await Media.find({
      category: link.category,
      isTrashed: { $ne: true },
      isFolder: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .lean();

    const formattedFiles = files.map((f) => ({
      _id: f._id,
      id: f._id,
      title: f.title,
      description: f.description,
      note: f.note,
      category: f.category,
      fileType: f.fileType || f.fileCategory || 'video',
      fileCategory: f.fileCategory || f.fileType || 'other',
      mimeType: f.mimeType,
      fileSizeBytes: f.fileSizeBytes || 0,
      duration: f.duration || 0,
      thumbnail: f.thumbnail || '',
      thumbnailFileId: f.thumbnailFileId || '',
      streamUrl: `/api/v1/share/folder/${link.token}/file/${f._id}/stream`,
      downloadUrl: `/api/v1/share/folder/${link.token}/file/${f._id}/download`,
      createdAt: f.createdAt,
    }));

    const totalBytes = formattedFiles.reduce((acc, f) => acc + (f.fileSizeBytes || 0), 0);

    res.json({
      success: true,
      token: link.token,
      scope: 'folder',
      category: link.category,
      folderTitle: link.folderTitle || link.category,
      expiresAt: link.expiresAt,
      views: link.views,
      files: formattedFiles,
      totalFiles: formattedFiles.length,
      totalBytes,
    });
  } catch (err) {
    console.error('[getFolderShareInfo error]:', err.message);
    res.status(500).json({ message: 'Failed to retrieve shared folder contents' });
  }
};

/**
 * GET /api/v1/share/:token/stream
 * Public streaming endpoint for single shared file
 */
exports.streamSharedMedia = async (req, res) => {
  try {
    const { token } = req.params;
    const link = await ShareLink.findOne({ token, scope: 'file' }).populate('fileId');

    if (!link) {
      return res.status(404).json({ message: 'Share link not found or has expired' });
    }

    if (isLinkExpired(link)) {
      await ShareLink.deleteOne({ _id: link._id }).catch(() => {});
      return res.status(410).json({ message: 'This share link has expired' });
    }

    const file = link.fileId;
    if (!file || file.isTrashed) {
      return res.status(404).json({ message: 'Shared file no longer exists' });
    }

    req.params.id = file._id.toString();
    req.query.download = '0';
    return streamMedia(req, res);
  } catch (err) {
    console.error('[streamSharedMedia error]:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to stream shared file' });
    }
  }
};

/**
 * GET /api/v1/share/:token/download
 * Public download endpoint for single shared file
 */
exports.downloadSharedMedia = async (req, res) => {
  try {
    const { token } = req.params;
    const link = await ShareLink.findOne({ token, scope: 'file' }).populate('fileId');

    if (!link) {
      return res.status(404).json({ message: 'Share link not found or has expired' });
    }

    if (isLinkExpired(link)) {
      await ShareLink.deleteOne({ _id: link._id }).catch(() => {});
      return res.status(410).json({ message: 'This share link has expired' });
    }

    const file = link.fileId;
    if (!file || file.isTrashed) {
      return res.status(404).json({ message: 'Shared file no longer exists' });
    }

    req.params.id = file._id.toString();
    req.query.download = '1';
    return streamMedia(req, res);
  } catch (err) {
    console.error('[downloadSharedMedia error]:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to download shared file' });
    }
  }
};

/**
 * GET /api/v1/share/folder/:token/file/:fileId/stream
 * Public streaming endpoint for a file inside a shared folder (strict category check)
 */
exports.streamFolderSharedFile = async (req, res) => {
  try {
    const { token, fileId } = req.params;
    const link = await ShareLink.findOne({ token, scope: 'folder' });

    if (!link) {
      return res.status(404).json({ message: 'Folder share link not found or has expired' });
    }

    if (isLinkExpired(link)) {
      await ShareLink.deleteOne({ _id: link._id }).catch(() => {});
      return res.status(410).json({ message: 'This folder share link has expired' });
    }

    const file = await Media.findById(fileId).lean();
    if (!file || file.isTrashed) {
      return res.status(404).json({ message: 'Requested file not found' });
    }

    // STRICT SECURITY VALIDATION: Confirm file belongs to the shared category
    const cleanFileCat = (file.category || '').replace(/^#/, '').toLowerCase().trim();
    const cleanLinkCat = (link.category || '').replace(/^#/, '').toLowerCase().trim();
    if (cleanFileCat !== cleanLinkCat) {
      return res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'Security error: The requested file does not belong to this shared folder',
      });
    }

    req.params.id = file._id.toString();
    req.query.download = '0';
    return streamMedia(req, res);
  } catch (err) {
    console.error('[streamFolderSharedFile error]:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to stream shared folder file' });
    }
  }
};

/**
 * GET /api/v1/share/folder/:token/file/:fileId/download
 * Public download endpoint for a file inside a shared folder (strict category check)
 */
exports.downloadFolderSharedFile = async (req, res) => {
  try {
    const { token, fileId } = req.params;
    const link = await ShareLink.findOne({ token, scope: 'folder' });

    if (!link) {
      return res.status(404).json({ message: 'Folder share link not found or has expired' });
    }

    if (isLinkExpired(link)) {
      await ShareLink.deleteOne({ _id: link._id }).catch(() => {});
      return res.status(410).json({ message: 'This folder share link has expired' });
    }

    const file = await Media.findById(fileId).lean();
    if (!file || file.isTrashed) {
      return res.status(404).json({ message: 'Requested file not found' });
    }

    // STRICT SECURITY VALIDATION: Confirm file belongs to the shared category
    const cleanFileCat = (file.category || '').replace(/^#/, '').toLowerCase().trim();
    const cleanLinkCat = (link.category || '').replace(/^#/, '').toLowerCase().trim();
    if (cleanFileCat !== cleanLinkCat) {
      return res.status(403).json({
        error: 'ACCESS_DENIED',
        message: 'Security error: The requested file does not belong to this shared folder',
      });
    }

    req.params.id = file._id.toString();
    req.query.download = '1';
    return streamMedia(req, res);
  } catch (err) {
    console.error('[downloadFolderSharedFile error]:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to download shared folder file' });
    }
  }
};

/**
 * DELETE /api/v1/share/:token
 * Revoke an active share link
 */
exports.revokeShareLink = async (req, res) => {
  try {
    const { token } = req.params;
    const link = await ShareLink.findOne({ token });
    if (!link) {
      return res.status(404).json({ message: 'Share link not found' });
    }

    if (req.user && link.createdBy && link.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to revoke this link' });
    }

    await ShareLink.deleteOne({ _id: link._id });
    res.json({ success: true, message: 'Share link revoked successfully' });
  } catch (err) {
    console.error('[revokeShareLink error]:', err.message);
    res.status(500).json({ message: 'Failed to revoke share link' });
  }
};
