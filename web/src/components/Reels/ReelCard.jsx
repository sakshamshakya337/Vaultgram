import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, Heart, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { ReelOverlay } from './ReelOverlay';

export const ReelCard = ({ video, isActive, index }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  
  const { isAudioUnlocked, unlockAudio, toggleLike } = useVideoFeed();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isCardMuted, setIsCardMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Animation state for gestures
  const [showPlayStateIcon, setShowPlayStateIcon] = useState(null); // 'play' | 'pause' | null
  const [showLikeHeart, setShowLikeHeart] = useState(false);
  
  const lastTapRef = useRef(0);

  const videoId = video._id || video.id;
  const streamUrl = video.streamUrl || api.stream.getUrl(videoId);

  // Play/pause and audio setup based on isActive prop
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    if (isActive) {
      vid.currentTime = 0;
      vid.volume = 1.0;
      // If user has unlocked audio, play with sound
      vid.muted = !isAudioUnlocked || isCardMuted;

      const playPromise = vid.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setHasError(false);
          })
          .catch((err) => {
            console.log('Autoplay caught (falling back to muted):', err.name);
            vid.muted = true;
            vid.play()
              .then(() => setIsPlaying(true))
              .catch(() => setIsPlaying(false));
          });
      }
    } else {
      vid.pause();
      vid.currentTime = 0;
      setIsPlaying(false);
      setProgress(0);
    }
  }, [isActive, isAudioUnlocked, isCardMuted]);

  // Sync mute state when global isAudioUnlocked changes
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isAudioUnlocked && !isCardMuted) {
      vid.muted = false;
      vid.volume = 1.0;
    } else {
      vid.muted = true;
    }
  }, [isAudioUnlocked, isCardMuted]);

  // Handle single tap (toggle play/pause & unlock sound) vs double tap (like)
  const handleContainerClick = (e) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    // Immediately unlock audio on user gesture
    if (!isAudioUnlocked) {
      unlockAudio();
      setIsCardMuted(false);
      const vid = videoRef.current;
      if (vid) {
        vid.muted = false;
        vid.volume = 1.0;
      }
    }

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap -> Like
      if (!video.isStarred) {
        toggleLike(videoId);
      }
      setShowLikeHeart(true);
      setTimeout(() => setShowLikeHeart(false), 800);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current === now) {
          // Single tap -> Toggle Play / Pause
          togglePlayPause();
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

  const togglePlayPause = () => {
    const vid = videoRef.current;
    if (!vid) return;

    if (vid.paused) {
      vid.play().then(() => {
        setIsPlaying(true);
        triggerIconFlash('play');
      }).catch(() => {});
    } else {
      vid.pause();
      setIsPlaying(false);
      triggerIconFlash('pause');
    }
  };

  const triggerIconFlash = (type) => {
    setShowPlayStateIcon(type);
    setTimeout(() => {
      setShowPlayStateIcon(null);
    }, 500);
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!isAudioUnlocked) {
      unlockAudio();
      setIsCardMuted(false);
      if (vid) {
        vid.muted = false;
        vid.volume = 1.0;
      }
    } else {
      const nextMuted = !isCardMuted;
      setIsCardMuted(nextMuted);
      if (vid) {
        vid.muted = nextMuted;
        vid.volume = nextMuted ? 0 : 1.0;
      }
    }
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid || !vid.duration) return;
    const current = vid.currentTime;
    const total = vid.duration;
    setProgress((current / total) * 100);
  };

  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');

  const handleVideoError = async () => {
    setIsBuffering(false);
    setHasError(true);
    try {
      const resp = await fetch(streamUrl);
      if (!resp.ok) {
        const errJson = await resp.json().catch(() => null);
        if (errJson) {
          setErrorCode(errJson.error || `HTTP ${resp.status}`);
          setErrorMessage(errJson.message || 'Streaming failed');
          return;
        }
      }
    } catch {}
    setErrorMessage('Network error or video source unreachable');
  };

  const retryStream = (e) => {
    e.stopPropagation();
    setHasError(false);
    setErrorMessage('');
    setErrorCode('');
    setIsBuffering(true);
    const vid = videoRef.current;
    if (vid) {
      vid.load();
      vid.play()
        .then(() => setIsPlaying(true))
        .catch(() => handleVideoError());
    }
  };

  const isActuallyMuted = !isAudioUnlocked || isCardMuted;
  const thumbUrl = video.thumbnail || (video.thumbnailFileId ? api.videos.getThumbnailUrl(videoId) : '');

  return (
    <div
      ref={containerRef}
      data-video-id={videoId}
      data-index={index}
      onClick={handleContainerClick}
      className="reels-player snap-item relative w-full h-full flex items-center justify-center bg-zinc-950 overflow-hidden select-none cursor-pointer"
    >
      {/* Background Ambient Glow / Blur */}
      {thumbUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-25 scale-125 pointer-events-none"
          style={{ backgroundImage: `url(${thumbUrl})` }}
        />
      ) : null}

      {/* Main Video Element */}
      <video
        ref={videoRef}
        src={streamUrl}
        poster={thumbUrl || ''}
        playsInline
        webkit-playsinline="true"
        loop
        crossOrigin="anonymous"
        preload={isActive ? 'auto' : 'metadata'}
        muted={isActuallyMuted}
        onTimeUpdate={handleTimeUpdate}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onCanPlay={() => setIsBuffering(false)}
        onError={handleVideoError}
        className="w-full h-full object-contain md:object-cover relative z-10"
      />

      {/* Buffering Spinner */}
      {isBuffering && isActive && !hasError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none bg-black/20 backdrop-blur-[2px]">
          <div className="w-12 h-12 rounded-full border-3 border-cyan-500/20 border-t-cyan-400 animate-spin" />
        </div>
      )}

      {/* Error Fallback */}
      {hasError && isActive && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 p-6 text-center select-none">
          <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3 shadow-xl">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-white font-bold text-base mb-1">
            {errorCode || 'Stream Error'}
          </h3>
          <p className="text-zinc-300 text-xs max-w-xs mb-4 leading-relaxed font-mono">
            {errorMessage || 'Unable to stream this video. It may still be processing on the server.'}
          </p>
          <button
            onClick={retryStream}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-semibold border border-white/15 transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Stream</span>
          </button>
        </div>
      )}

      {/* Play / Pause Animated Icon Flash */}
      {showPlayStateIcon && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl animate-fade-in">
            {showPlayStateIcon === 'play' ? (
              <Play className="w-10 h-10 fill-white translate-x-0.5" />
            ) : (
              <Pause className="w-10 h-10 fill-white" />
            )}
          </div>
        </div>
      )}

      {/* Double Tap Heart Burst Animation */}
      {showLikeHeart && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="animate-like-pop">
            <Heart className="w-28 h-28 text-rose-500 fill-rose-500 drop-shadow-[0_0_35px_rgba(244,63,94,0.8)]" />
          </div>
        </div>
      )}

      {/* Overlay UI Controls */}
      <ReelOverlay
        video={video}
        isMuted={isActuallyMuted}
        onToggleMute={toggleMute}
        onLike={() => toggleLike(videoId)}
      />

      {/* Scrub / Progress Bar */}
      <div
        className="absolute bottom-0 inset-x-0 z-30 h-1 group cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full h-full bg-white/20 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-rose-500 transition-all duration-100 ease-linear shadow-[0_0_8px_rgba(6,182,212,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
