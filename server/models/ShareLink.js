'use strict';
const mongoose = require('mongoose');
const crypto = require('crypto');

const shareLinkSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      enum: ['file', 'folder'],
      default: 'file',
      index: true,
    },
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
      required: false,
      index: true,
    },
    category: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    folderTitle: {
      type: String,
      default: null,
      trim: true,
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
      default: null, // null means never expires
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

// Expire TTL index (automatically delete expired links where expiresAt is a Date)
shareLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ShareLink', shareLinkSchema);
