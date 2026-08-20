'use strict';
const crypto = require('crypto');
const ShareLink = require('../models/ShareLink');
const Media = require('../models/Media');

/**
 * POST /api/v1/videos/:id/share
 * Create a time-limited public share link
 */
exports.createShareLink = async (req, res) => {
  try {
    const fileId = req.params.id;
    const item = await Media.findById(fileId);

    if (!item || item.isTrashed) {
      return res.status(404).json({ message: 'File not found or has been trashed' });
    }

    if (item.isFolder) {
      return res.status(400).json({ message: 'Folder sharing is not supported' });
    }

    // Refuse sharing if category is locked
    if (req.user && Array.isArray(req.user.lockedCategories) && req.user.lockedCategories.includes(item.category)) {
      return res.status(403).json({
        message: 'Cannot create a public share link for an item in a locked category',
      });
    }

    // Duration in hours: 1, 24, or 168 (7 days)
    const rawHours = Number(req.body.durationHours) || 24;
    const durationHours = Math.min(Math.max(rawHours, 1), 168); // Between 1 hour and 7 days
    const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000);

    const token = crypto.randomBytes(16).toString('hex');
    const shareLink = new ShareLink({
      fileId: item._id,
      token,
      expiresAt,
      createdBy: req.user ? req.user._id : null,
    });

    await shareLink.save();

    res.status(201).json({
      success: true,
      token,
      expiresAt,
      shareUrl: `/share/${token}`,
      durationHours,
    });
  } catch (err) {
    console.error('[createShareLink error]:', err.message);
    res.status(500).json({ message: 'Failed to generate share link' });
  }
};

/**
 * GET /api/v1/share/:token/info
 * Retrieve file metadata for a public time-limited share link
 */
exports.getShareInfo = async (req, res) => {
  try {
    const { token } = req.params;
    const link = await ShareLink.findOne({ token }).populate('fileId');

    if (!link) {
      return res.status(404).json({ message: 'Share link not found or has expired' });
    }

    if (new Date(link.expiresAt) < new Date()) {
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
        streamUrl: `/api/v1/stream/${file._id}`,
        createdAt: file.createdAt,
      },
    });
  } catch (err) {
    console.error('[getShareInfo error]:', err.message);
    res.status(500).json({ message: 'Failed to retrieve shared file' });
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
