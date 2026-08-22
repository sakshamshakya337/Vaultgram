'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

// Configure static FFmpeg and FFprobe binaries
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}
if (ffprobeStatic?.path) {
  ffmpeg.setFfprobePath(ffprobeStatic.path);
}

// Configurable constants via environment variables
const MAX_VIDEO_UPLOAD_SIZE_MB = parseInt(process.env.MAX_VIDEO_UPLOAD_SIZE_MB, 10) || 200;
const MAX_COMPRESSED_VIDEO_SIZE_MB = parseInt(process.env.MAX_COMPRESSED_VIDEO_SIZE_MB, 10) || 20;
const TARGET_VIDEO_SIZE_MB = parseFloat(process.env.TARGET_VIDEO_SIZE_MB) || 19.0;
const MAX_VIDEO_DURATION_SECONDS = parseInt(process.env.MAX_VIDEO_DURATION_SECONDS, 10) || 600;

const MAX_TARGET_BYTES = MAX_COMPRESSED_VIDEO_SIZE_MB * 1024 * 1024;
const INITIAL_TARGET_BYTES = TARGET_VIDEO_SIZE_MB * 1024 * 1024;

/**
 * Probes video metadata using ffprobe
 */
function probeVideo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        return reject(new Error(`Failed to probe video: ${err.message}`));
      }

      const format = metadata.format || {};
      const streams = metadata.streams || [];
      const videoStream = streams.find((s) => s.codec_type?.toLowerCase() === 'video') || {};
      const audioStream = streams.find((s) => s.codec_type?.toLowerCase() === 'audio') || {};

      const duration = parseFloat(format.duration || videoStream.duration || 0);
      const width = parseInt(videoStream.width || 0, 10);
      const height = parseInt(videoStream.height || 0, 10);
      const videoBitrate = parseInt(videoStream.bit_rate || format.bit_rate || 0, 10);
      const hasAudio = streams.some((s) => s.codec_type?.toLowerCase() === 'audio');

      resolve({
        duration,
        width,
        height,
        videoBitrate,
        hasAudio,
        formatName: format.format_name || '',
      });
    });
  });
}

/**
 * Runs a single FFmpeg compression pass
 */
function runFfmpegPass({ inputPath, outputPath, videoBitrateKbps, audioBitrateKbps, maxWidth, hasAudio, onCommand }) {
  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath)
      .output(outputPath)
      .videoCodec('libx264')
      .outputOptions([
        '-preset veryfast',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
        `-maxrate ${Math.floor(videoBitrateKbps * 1.2)}k`,
        `-bufsize ${Math.floor(videoBitrateKbps * 2)}k`,
      ])
      .videoBitrate(`${Math.max(150, Math.floor(videoBitrateKbps))}k`);

    if (onCommand && typeof onCommand === 'function') {
      onCommand(command);
    }

    // Resolution scaling preserving aspect ratio and ensuring even pixel dimensions
    if (maxWidth && maxWidth > 0) {
      command = command.outputOptions([
        `-vf scale='min(iw,${maxWidth})':-2`,
      ]);
    } else {
      command = command.outputOptions([
        "-vf scale='trunc(iw/2)*2:trunc(ih/2)*2'",
      ]);
    }

    // Ensure audio stream is preserved and encoded cleanly
    if (hasAudio !== false) {
      command = command
        .audioCodec('aac')
        .audioBitrate(`${Math.max(64, Math.floor(audioBitrateKbps || 96))}k`)
        .audioChannels(2)
        .outputOptions([
          '-strict -2',
          '-map 0:v:0',
          '-map 0:a:0?',
        ]);
    }

    command
      .on('end', () => resolve(outputPath))
      .on('error', (err) => {
        if (err.message && (err.message.includes('SIGKILL') || err.message.includes('killed') || err.message.includes('SIGTERM'))) {
          return reject(new Error('FFmpeg compression process was terminated by client cancellation.'));
        }
        console.error('[FFmpeg Pass Error]:', err.message);
        reject(new Error(`FFmpeg encoding error: ${err.message}`));
      })
      .run();
  });
}

/**
 * Intelligently compresses a video buffer if it exceeds the 20MB limit
 * 
 * @param {Buffer} inputBuffer - The original uploaded video buffer
 * @param {string} originalName - Original filename
 * @param {string} mimeType - Original MIME type
 * @param {object} req - Express request object for detecting client cancellation
 * @returns {Promise<{ buffer: Buffer, size: number, originalSize: number, compressed: boolean, compressionPercentage: number, duration: number, width: number, height: number }>}
 */
async function compressVideoIfNeeded(inputBuffer, originalName = 'video.mp4', mimeType = 'video/mp4', req = null) {
  const originalSize = inputBuffer.length;
  const isVideo = mimeType.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|3gp|m4v|flv|ts)$/i.test(originalName);

  // EARLY SIZE & TYPE CHECK: If not a video or already <= 20MB, skip ALL processing
  if (!isVideo || originalSize <= MAX_TARGET_BYTES) {
    console.log(`[VideoCompression] File "${originalName}" (${(originalSize / (1024 * 1024)).toFixed(2)} MB) is already within limit (${MAX_COMPRESSED_VIDEO_SIZE_MB} MB). Skipping compression.`);
    return {
      buffer: inputBuffer,
      size: originalSize,
      originalSize,
      compressed: false,
      compressionPercentage: 0,
      duration: 0,
      width: 0,
      height: 0,
    };
  }

  // Pre-check maximum allowed raw upload size
  const maxRawBytes = MAX_VIDEO_UPLOAD_SIZE_MB * 1024 * 1024;
  if (originalSize > maxRawBytes) {
    throw new Error(
      `The selected video (${(originalSize / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed upload limit of ${MAX_VIDEO_UPLOAD_SIZE_MB} MB.`
    );
  }

  const tempDir = os.tmpdir();
  const fileHash = crypto.randomBytes(6).toString('hex');
  const tempInputPath = path.join(tempDir, `vg_in_${Date.now()}_${fileHash}.mp4`);
  const tempFilesToClean = [tempInputPath];

  let activeFfmpegCommand = null;
  let isAborted = false;

  const handleAbort = () => {
    if (isAborted) return;
    isAborted = true;
    console.log(`[VideoCompression] Client disconnected/cancelled. Terminating FFmpeg process and cleaning temp files for "${originalName}"...`);
    if (activeFfmpegCommand) {
      try {
        activeFfmpegCommand.kill('SIGKILL');
      } catch (err) {
        console.warn('[VideoCompression] Note killing FFmpeg process:', err.message);
      }
      activeFfmpegCommand = null;
    }
    for (const filePath of tempFilesToClean) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {}
    }
  };

  if (req) {
    req.on('close', () => {
      if (!req.complete && !req.res?.writableEnded) {
        handleAbort();
      }
    });
    req.on('aborted', handleAbort);
  }

  try {
    // Write incoming buffer to temporary input file
    await fs.promises.writeFile(tempInputPath, inputBuffer);

    // Probe metadata
    const metadata = await probeVideo(tempInputPath);
    const duration = Math.max(1, metadata.duration || 1);

    if (duration > MAX_VIDEO_DURATION_SECONDS) {
      throw new Error(
        `Video duration (${Math.round(duration)}s) exceeds the maximum allowed duration of ${MAX_VIDEO_DURATION_SECONDS} seconds (${Math.round(MAX_VIDEO_DURATION_SECONDS / 60)} mins).`
      );
    }

    // Dynamic bitrate calculation strategy
    // Total bits = target_bytes * 8
    // Total kbps = (target_bytes * 8) / (duration * 1000)
    const calculateBitrates = (targetBytes, audioK = 96) => {
      const totalKbps = (targetBytes * 8) / (duration * 1000);
      const audioKbps = metadata.hasAudio ? audioK : 0;
      // 8% safety overhead margin for MP4 atom headers & variable GOP
      const availableVideoKbps = Math.max(120, (totalKbps - audioKbps) * 0.92);
      return {
        videoBitrateKbps: Math.floor(availableVideoKbps),
        audioBitrateKbps: audioKbps,
      };
    };

    // Define adaptive progressive compression attempts
    const attempts = [
      // Attempt 1: Target ~19.0 MB, original resolution (max 1080p), 96k audio
      {
        targetBytes: INITIAL_TARGET_BYTES,
        maxWidth: 1920,
        audioK: 96,
        description: 'High Quality (1080p)',
      },
      // Attempt 2: Target ~16.5 MB, max 720p (1280px), 96k audio
      {
        targetBytes: 16.5 * 1024 * 1024,
        maxWidth: 1280,
        audioK: 96,
        description: 'Standard Quality (720p)',
      },
      // Attempt 3: Target ~14.5 MB, max 480p (854px), 64k audio
      {
        targetBytes: 14.5 * 1024 * 1024,
        maxWidth: 854,
        audioK: 64,
        description: 'Optimized Quality (480p)',
      },
    ];

    let finalBuffer = null;
    let finalSize = 0;
    let finalMeta = { ...metadata };

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      const tempOutputPath = path.join(tempDir, `vg_out_${Date.now()}_${fileHash}_a${i + 1}.mp4`);
      tempFilesToClean.push(tempOutputPath);

      const { videoBitrateKbps, audioBitrateKbps } = calculateBitrates(attempt.targetBytes, attempt.audioK);

      console.log(
        `[VideoCompression] Attempt ${i + 1}/${attempts.length}: ${attempt.description}, Video: ${videoBitrateKbps}kbps, Audio: ${audioBitrateKbps}kbps, MaxW: ${attempt.maxWidth}px`
      );

      try {
        await runFfmpegPass({
          inputPath: tempInputPath,
          outputPath: tempOutputPath,
          videoBitrateKbps,
          audioBitrateKbps,
          maxWidth: attempt.maxWidth,
          hasAudio: metadata.hasAudio,
          onCommand: (cmd) => {
            activeFfmpegCommand = cmd;
          },
        });

        const stat = await fs.promises.stat(tempOutputPath);
        console.log(`[VideoCompression] Attempt ${i + 1} generated ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);

        if (stat.size <= MAX_TARGET_BYTES) {
          finalBuffer = await fs.promises.readFile(tempOutputPath);
          finalSize = stat.size;
          try {
            const outMeta = await probeVideo(tempOutputPath);
            finalMeta = { ...outMeta, duration: outMeta.duration || duration };
          } catch {}
          break; // Successful compression under 20MB!
        }
      } catch (passErr) {
        console.warn(`[VideoCompression] Attempt ${i + 1} failed:`, passErr.message);
      }
    }

    if (!finalBuffer || finalSize > MAX_TARGET_BYTES) {
      throw new Error(
        'This video cannot be compressed below 20 MB without excessive quality loss. Please choose a shorter or lower-resolution video.'
      );
    }

    const compressionPercentage = Math.round(((originalSize - finalSize) / originalSize) * 100);

    return {
      buffer: finalBuffer,
      size: finalSize,
      originalSize,
      compressed: true,
      compressionPercentage: Math.max(0, compressionPercentage),
      duration: finalMeta.duration || duration,
      width: finalMeta.width || metadata.width,
      height: finalMeta.height || metadata.height,
    };
  } finally {
    // Zero leftover disk usage: clean up all temporary files asynchronously
    for (const filePath of tempFilesToClean) {
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      } catch (cleanErr) {
        console.warn(`[VideoCompression] Temp cleanup note for ${filePath}:`, cleanErr.message);
      }
    }
  }
}

/**
 * Automatically extracts a representative JPEG thumbnail frame from a video buffer
 * 
 * @param {Buffer} inputBuffer - The video buffer
 * @param {string} originalName - Original filename for logging
 * @returns {Promise<Buffer|null>} The generated JPEG thumbnail buffer or null on error
 */
async function generateVideoThumbnail(inputBuffer, originalName = 'video.mp4') {
  if (!inputBuffer || inputBuffer.length === 0) return null;

  const tempDir = os.tmpdir();
  const fileHash = crypto.randomBytes(6).toString('hex');
  const tempInputPath = path.join(tempDir, `vg_thumb_in_${Date.now()}_${fileHash}.mp4`);
  const tempOutputPath = path.join(tempDir, `vg_thumb_out_${Date.now()}_${fileHash}.jpg`);
  const tempFiles = [tempInputPath, tempOutputPath];

  try {
    await fs.promises.writeFile(tempInputPath, inputBuffer);

    let duration = 0;
    try {
      const meta = await probeVideo(tempInputPath);
      duration = meta.duration || 0;
    } catch {}

    // Pull from ~1 second mark (or 10% into duration for short clips) to avoid frame 0 blackness
    const seekSeconds = duration > 2 ? 1.0 : Math.max(0.1, duration * 0.1);

    await new Promise((resolve, reject) => {
      ffmpeg(tempInputPath)
        .seekInput(seekSeconds)
        .frames(1)
        .outputOptions([
          "-vf scale='min(iw,480)':-2",
          "-q:v 3"
        ])
        .output(tempOutputPath)
        .on('end', () => resolve(tempOutputPath))
        .on('error', (err) => reject(err))
        .run();
    });

    if (fs.existsSync(tempOutputPath)) {
      const thumbBuffer = await fs.promises.readFile(tempOutputPath);
      console.log(`[generateVideoThumbnail] Successfully extracted thumbnail for "${originalName}" (${(thumbBuffer.length / 1024).toFixed(1)} KB)`);
      return thumbBuffer;
    }

    return null;
  } catch (err) {
    console.warn(`[generateVideoThumbnail] Thumbnail extraction failed for "${originalName}":`, err.message);
    return null;
  } finally {
    for (const filePath of tempFiles) {
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      } catch {}
    }
  }
}

module.exports = {
  compressVideoIfNeeded,
  generateVideoThumbnail,
  probeVideo,
  MAX_VIDEO_UPLOAD_SIZE_MB,
  MAX_COMPRESSED_VIDEO_SIZE_MB,
  TARGET_VIDEO_SIZE_MB,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_TARGET_BYTES,
};
