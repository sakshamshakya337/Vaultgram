'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const Media = require('../models/Media');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const stats = await Media.aggregate([
    { $match: { isFolder: false } },
    {
      $group: {
        _id: {
          mimeType: '$mimeType',
          extension: '$extension',
          fileType: '$fileType',
          fileCategory: '$fileCategory',
        },
        count: { $sum: 1 },
      },
    },
  ]);
  console.log('Media stats in DB:');
  console.table(
    stats.map((s) => ({
      mimeType: s._id.mimeType,
      extension: s._id.extension,
      fileType: s._id.fileType,
      fileCategory: s._id.fileCategory,
      count: s.count,
    }))
  );
  await mongoose.disconnect();
})();
