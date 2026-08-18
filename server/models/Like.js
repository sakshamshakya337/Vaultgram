'use strict';
const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    mediaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
    },
    videoId: {
      // Retained for backward compatibility with existing likes in DB
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
    },
  },
  { timestamps: true }
);

likeSchema.index({ userId: 1, mediaId: 1 }, { unique: true, sparse: true });
likeSchema.index({ userId: 1, videoId: 1 }, { sparse: true });

module.exports = mongoose.model('Like', likeSchema);
