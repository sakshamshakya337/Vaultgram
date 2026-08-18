import React, { useRef, useEffect, useState } from 'react';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Download,
  Share2,
  Heart,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useMedia } from '../../contexts/MediaContext';
import { useAuth } from '../../contexts/AuthContext';
import api, { formatBytes, formatDuration, formatRelativeTime } from '../../services/api';

export const VideoModal = () => {
  const { selectedVideo, setSelectedVideo, toggleLike } = useMedia();
  const { isAuthenticated } = useAuth();
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    if (!selectedVideo) return;

    // Reset states
    setIsPlaying(true);
    setCurrentTime(0);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedVideo(null);
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if (e.key === 'm' || e.key === 'M') toggleMute();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedVideo]);

  if (!selectedVideo) return null;

  const streamUrl = api.stream.getUrl(selectedVideo._id);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoRef.current.requestFullscreen();
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
    setDuration(videoRef.current.duration || selectedVideo.duration || 0);

    // Update history every 10 seconds if authenticated
    if (isAuthenticated && Math.floor(videoRef.current.currentTime) % 10 === 0) {
      api.media.saveHistory(selectedVideo._id, Math.floor(videoRef.current.currentTime));
    }
  };

  const handleSeek = (e) => {
    if (!videoRef.current) return;
    const seekTime = parseFloat(e.target.value);
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = streamUrl;
    a.download = `${selectedVideo.title || 'video'}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="modal-overlay" onClick={() => setSelectedVideo(null)}>
      <div
        className="modal-content glass-panel"
        style={{
          maxWidth: '960px',
          width: '96vw',
          maxHeight: '94vh',
          background: '#0a0f1d',
          padding: 0,
          overflow: 'hidden',
          borderRadius: 'var(--radius-xl)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Video Player Container */}
        <div style={{ position: 'relative', width: '100%', background: '#000', aspectRatio: '16/9' }}>
          <video
            ref={videoRef}
            src={streamUrl}
            autoPlay
            playsInline
            controls
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />

          {/* Close button overlay */}
          <button
            className="btn-icon"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(0, 0, 0, 0.7)',
              color: '#fff',
              zIndex: 10,
            }}
            onClick={() => setSelectedVideo(null)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Video Details & Meta */}
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <h2 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>{selectedVideo.title}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                <span>{selectedVideo.category || 'General'}</span>
                <span>•</span>
                <span>{formatBytes(selectedVideo.fileSizeBytes)}</span>
                <span>•</span>
                <span>{formatRelativeTime(selectedVideo.createdAt)}</span>
                {selectedVideo.views > 0 && (
                  <>
                    <span>•</span>
                    <span>{selectedVideo.views} views</span>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn-secondary"
                onClick={async () => {
                  if (isAuthenticated) {
                    const liked = await toggleLike(selectedVideo._id);
                    setIsLiked(liked);
                  }
                }}
              >
                <Heart size={16} fill={isLiked ? '#f43f5e' : 'none'} color={isLiked ? '#f43f5e' : 'currentColor'} />
                <span>{isLiked ? 'Liked' : 'Favorite'}</span>
              </button>

              <button className="btn-secondary" onClick={handleDownload}>
                <Download size={16} />
                <span>Download</span>
              </button>
            </div>
          </div>

          {selectedVideo.description && (
            <p
              style={{
                marginTop: '16px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                lineHeight: 1.6,
              }}
            >
              {selectedVideo.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
