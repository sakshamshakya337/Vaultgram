#!/usr/bin/env node
'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const { cleanupOrphans } = require('../server/controllers/mediaController');

async function main() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute') || args.includes('--delete') || args.includes('-f') || args.includes('--force');
  const dryRun = !isExecute;

  console.log('='.repeat(70));
  console.log('       StreamVault Orphaned Data Audit & Cleanup Tool');
  console.log('='.repeat(70));
  console.log(`Mode: ${dryRun ? 'DRY-RUN (audit only, no changes)' : 'LIVE EXECUTION (deleting orphaned data)'}`);
  if (dryRun) {
    console.log('Notice: To permanently delete identified orphaned data, pass --execute');
  }
  console.log('-'.repeat(70));

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('Error: MONGODB_URI is not set in environment or .env');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected successfully.');

    const report = await cleanupOrphans({ dryRun });

    console.log('\nAudit Results:');
    console.log(`- Orphaned Files (folder missing in DB): ${report.orphanedFilesCount}`);
    if (report.orphanedFiles.length > 0) {
      report.orphanedFiles.forEach((f, i) => {
        console.log(`  [${i + 1}] ID: ${f._id} | Title: "${f.title}" | Missing folderId: ${f.folderId} | tgMsg: ${f.telegramMessageId || 'none'}`);
      });
    }

    console.log(`- Orphaned Subfolders (parent folder missing): ${report.orphanedSubfoldersCount}`);
    if (report.orphanedSubfolders.length > 0) {
      report.orphanedSubfolders.forEach((sf, i) => {
        console.log(`  [${i + 1}] ID: ${sf._id} | Title: "${sf.title}" | Missing parent folderId: ${sf.folderId}`);
      });
    }

    console.log(`- Orphaned Likes: ${report.orphanedLikesCount}`);
    console.log(`- Orphaned Watch History: ${report.orphanedWatchHistoryCount}`);
    console.log(`- Orphaned Share Links: ${report.orphanedShareLinksCount}`);
    console.log(`- Orphaned Folder ID Locks in Users: ${report.orphanedUserLocksCount}`);
    console.log(`- Legacy Files missing telegramMessageId: ${report.legacyFilesWithoutMessageIdCount}`);
    console.log(`- Legacy Thumbnails missing thumbnailMessageId: ${report.legacyThumbnailsWithoutMessageIdCount}`);

    if (!dryRun && report.deleted) {
      console.log('\nCleanup Actions Performed:');
      console.log(`- Telegram Messages Deleted: ${report.deleted.telegramMessages}`);
      console.log(`- Media Documents Deleted: ${report.deleted.mediaDocuments}`);
      console.log(`- Like Records Deleted: ${report.deleted.likes}`);
      console.log(`- Watch History Records Deleted: ${report.deleted.watchHistory}`);
      console.log(`- Share Link Records Deleted: ${report.deleted.shareLinks}`);
      console.log(`- User Locks Cleaned: ${report.deleted.userLocks}`);
      console.log('\nCleanup completed successfully.');
    } else {
      console.log('\nDRY-RUN completed. Zero documents or Telegram messages were modified.');
      if (report.orphanedFilesCount > 0 || report.orphanedSubfoldersCount > 0 || report.orphanedLikesCount > 0 || report.orphanedWatchHistoryCount > 0 || report.orphanedShareLinksCount > 0) {
        console.log('To clean these up, run: node scripts/clean-orphaned-data.js --execute');
      }
    }
  } catch (err) {
    console.error('Audit/cleanup error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('='.repeat(70));
  }
}

main();
