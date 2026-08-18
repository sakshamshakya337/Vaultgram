'use strict';
const mongoose = require('mongoose');

const watchHistorySchema = new mongoose.Schema(
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
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
    },
    progressSeconds: {
      type: Number,
      default: 0,
    },
    lastWatchedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

watchHistorySchema.index({ userId: 1, mediaId: 1 });
watchHistorySchema.index({ userId: 1, videoId: 1 });
watchHistorySchema.index({ lastWatchedAt: -1 });

module.exports = mongoose.model('WatchHistory', watchHistorySchema);
