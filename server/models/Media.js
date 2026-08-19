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
    fileType: {
      type: String,
      enum: ['video', 'document', 'image', 'audio', 'other'],
      default: 'video',
    },
    mediaType: {
      type: String,
      default: 'video',
    },
    fileCategory: {
      type: String,
      default: 'video',
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
    thumbnailFileId: {
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

// Pre-save hook: Ensure fileType is set
mediaSchema.pre('save', function (next) {
  if (!this.fileType) {
    if (this.mediaType === 'video' || this.fileCategory === 'video') this.fileType = 'video';
    else if (this.mediaType === 'image' || this.fileCategory === 'image') this.fileType = 'image';
    else if (this.mediaType === 'audio' || this.fileCategory === 'audio') this.fileType = 'audio';
    else if (this.mediaType === 'document' || this.mediaType === 'pdf' || this.fileCategory === 'document' || this.fileCategory === 'pdf') this.fileType = 'document';
    else this.fileType = 'other';
  }
  next();
});

// Indexes
mediaSchema.index({ title: 'text', description: 'text', category: 'text' });
mediaSchema.index({ folderId: 1, isTrashed: 1 });
mediaSchema.index({ isStarred: 1 });
mediaSchema.index({ fileType: 1 });
mediaSchema.index({ fileCategory: 1 });
mediaSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Media', mediaSchema);
