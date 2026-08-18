import React, { useRef, useEffect } from 'react';
import { X, Play, Heart, Share2, Download, Sparkles, Clock, HardDrive, Eye } from 'lucide-react';
import { api, formatBytes, formatDuration, formatViews, formatRelativeTime } from '../../services/api';
import { useVideoFeed } from '../../contexts/VideoFeedContext';

export const DesktopVideoModal = ({ video, onClose }) => {
  const videoRef = useRef(null);
  const { toggleLike } = useVideoFeed();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!video) return null;

  const videoId = video._id || video.id;
  const streamUrl = video.streamUrl || api.stream.getUrl(videoId);
  const downloadUrl = api.stream.getUrl(videoId, true);
  const isStarred = !!video.isStarred;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/85 backdrop-blur-xl animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] rounded-3xl bg-zinc-950 border border-white/10 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
              <Play className="w-4 h-4 fill-cyan-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">{video.title || 'Untitled Video'}</h3>
              <p className="text-xs text-zinc-400 flex items-center gap-2">
                <span className="text-cyan-400 font-semibold">#{video.category || 'General'}</span>
                <span>•</span>
                <span>{video.createdAt ? formatRelativeTime(video.createdAt) : 'Recently uploaded'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Like Button */}
            <button
              onClick={() => toggleLike(videoId)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isStarred
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
              title={isStarred ? 'Liked' : 'Like'}
            >
              <Heart className={`w-4 h-4 ${isStarred ? 'fill-rose-500' : ''}`} />
            </button>

            {/* Direct Download */}
            <a
              href={downloadUrl}
              download={video.title || 'video.mp4'}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Download file"
            >
              <Download className="w-4 h-4" />
            </a>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Player Container */}
        <div className="relative flex-1 min-h-[380px] max-h-[65vh] bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            src={streamUrl}
            poster={video.thumbnail || ''}
            controls
            autoPlay
            playsInline
            className="w-full h-full max-h-[65vh] object-contain"
          />
        </div>

        {/* Video Details Footer */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-400 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            {video.fileSizeBytes ? (
              <span className="flex items-center gap-1.5 font-mono">
                <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
                <span>{formatBytes(video.fileSizeBytes)}</span>
              </span>
            ) : null}
            {video.duration ? (
              <span className="flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                <span>{formatDuration(video.duration)}</span>
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-zinc-500" />
              <span>{formatViews(video.views || 0)} views</span>
            </span>
          </div>

          {video.description && (
            <p className="text-xs text-zinc-300 max-w-md truncate hidden sm:block">
              {video.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
