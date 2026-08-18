'use strict';
const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    isFolder: {
      type: Boolean,
      default: false,
    },
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
      default: null, // null means root "My Drive"
    },
    mediaType: {
      type: String,
      enum: ['video', 'image', 'audio', 'pdf', 'document', 'code', 'archive', 'other', 'folder'],
      default: 'other',
    },
    fileCategory: {
      type: String,
      default: 'other', // image, video, audio, pdf, document, code, archive, other, folder
    },
    extension: {
      type: String,
      default: '',
    },
    mimeType: {
      type: String,
      default: '',
    },
    telegramFileId: {
      type: String,
      default: '', // empty for folders
    },
    telegramMessageId: {
      type: Number,
    },
    thumbnail: {
      type: String,
      default: '',
    },
    duration: {
      type: Number,
      default: 0,
    },
    width: {
      type: Number,
      default: 0,
    },
    height: {
      type: Number,
      default: 0,
    },
    category: {
      type: String,
      trim: true,
      default: 'General',
    },
    fileSizeBytes: {
      type: Number,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
    },
    isStarred: {
      type: Boolean,
      default: false,
    },
    isTrashed: {
      type: Boolean,
      default: false,
    },
    trashedAt: {
      type: Date,
      default: null,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true, collection: 'videos' }
);

// Indexes
mediaSchema.index({ title: 'text', description: 'text', category: 'text' });
mediaSchema.index({ folderId: 1, isTrashed: 1 });
mediaSchema.index({ isStarred: 1 });
mediaSchema.index({ fileCategory: 1 });
mediaSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Media', mediaSchema);
