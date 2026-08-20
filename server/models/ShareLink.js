'use strict';
const mongoose = require('mongoose');
const crypto = require('crypto');

const shareLinkSchema = new mongoose.Schema(
  {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
      required: [true, 'File ID is required'],
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => crypto.randomBytes(16).toString('hex'),
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Expire TTL index (automatically delete expired links from mongo after expiry)
shareLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ShareLink', shareLinkSchema);
