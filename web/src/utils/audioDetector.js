'use strict';

/**
 * Robust Client-Side Audio Detection for Video Files
 * Uses a combination of HTML5 Video metadata, webkitAudioDecodedByteCount,
 * audioTracks API, and Web Audio API AudioContext decoding.
 *
 * @param {File} file - The file to inspect
 * @returns {Promise<{ isVideo: boolean, hasAudio: boolean }>}
 */
export async function detectVideoAudio(file) {
  if (!file) return { isVideo: false, hasAudio: true };

  const type = file.type || '';
  const name = file.name || '';
  const isVideo =
    type.startsWith('video/') ||
    /\.(mp4|mov|webm|mkv|avi|3gp|m4v|flv|ts|wmv)$/i.test(name);

  if (!isVideo) {
    return { isVideo: false, hasAudio: true };
  }

  return new Promise(async (resolve) => {
    let resolved = false;
    let objectUrl = '';

    const finish = (hasAudio) => {
      if (resolved) return;
      resolved = true;
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {}
      }
      resolve({ isVideo: true, hasAudio });
    };

    // Safety timeout: If detection takes longer than 2.5s, default to hasAudio: true so upload is not blocked
    const timer = setTimeout(() => {
      finish(true);
    }, 2500);

    try {
      objectUrl = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = false;
      video.volume = 0.01;
      video.playsInline = true;

      video.onloadedmetadata = async () => {
        // 1. Firefox mozHasAudio API
        if (typeof video.mozHasAudio !== 'undefined') {
          clearTimeout(timer);
          return finish(Boolean(video.mozHasAudio));
        }

        // 2. Safari / Standard audioTracks API
        if (video.audioTracks && typeof video.audioTracks.length === 'number') {
          clearTimeout(timer);
          return finish(video.audioTracks.length > 0);
        }

        // 3. Chromium webkitAudioDecodedByteCount & Web Audio API Decode
        try {
          // Check slice with AudioContext
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            // Read first 1.5MB of video file to check container audio stream header
            const sliceSize = Math.min(file.size, 1.5 * 1024 * 1024);
            const arrayBuffer = await file.slice(0, sliceSize).arrayBuffer();
            
            ctx.decodeAudioData(
              arrayBuffer,
              (audioBuffer) => {
                ctx.close().catch(() => {});
                clearTimeout(timer);
                if (audioBuffer && audioBuffer.numberOfChannels > 0 && audioBuffer.duration > 0) {
                  return finish(true);
                } else {
                  return finish(false);
                }
              },
              () => {
                ctx.close().catch(() => {});
                // If decode fails on slice, check webkitAudioDecodedByteCount on video play slice
                testVideoPlaySlice(video, finish, timer);
              }
            );
            return;
          }
        } catch {}

        testVideoPlaySlice(video, finish, timer);
      };

      video.onerror = () => {
        clearTimeout(timer);
        finish(true); // default to true on error so user is not blocked
      };

      video.src = objectUrl;
      video.load();
    } catch (err) {
      clearTimeout(timer);
      finish(true);
    }
  });
}

function testVideoPlaySlice(video, finish, timer) {
  let playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        setTimeout(() => {
          try {
            video.pause();
            if (typeof video.webkitAudioDecodedByteCount !== 'undefined') {
              const hasAudio = video.webkitAudioDecodedByteCount > 0;
              clearTimeout(timer);
              return finish(hasAudio);
            }
          } catch {}
          clearTimeout(timer);
          finish(true);
        }, 150);
      })
      .catch(() => {
        clearTimeout(timer);
        finish(true);
      });
  } else {
    clearTimeout(timer);
    finish(true);
  }
}
