import React, { useState } from 'react';
import { Heart, Volume2, VolumeX, Eye, Sparkles, Music, Trash2, Loader2 } from 'lucide-react';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { formatViews, formatDuration, formatBytes } from '../../services/api';

export const ReelOverlay = ({ video, isMuted, onToggleMute, onLike }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { requestCategory, deleteReel } = useVideoFeed();

  const handleDelete = async (e) => {
    e.stopPropagation();
    const confirmDelete = window.confirm('Are you sure you want to delete this reel? This action is permanent.');
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      await deleteReel(video._id || video.id);
    } catch (err) {
      alert(err.message || 'Failed to delete reel');
      setIsDeleting(false);
    }
  };

  const handleCategoryClick = (e, cat) => {
    e.stopPropagation();
    if (cat) {
      requestCategory(cat);
    }
  };

  const title = video.title || 'Untitled Video';
  const category = video.category || 'General';
  const views = video.views || 0;
  const isStarred = !!video.isStarred;
  const likesCount = video.likesCount || (isStarred ? 1 : 0);

  return (
    <div className="reels-overlay absolute inset-0 pointer-events-none flex flex-col justify-between p-4 pb-20 md:pb-6 z-20">
      {/* Top Bar: Category Pill & Sound Badge */}
      <div className="flex items-center justify-between pt-12 md:pt-2 px-1">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={(e) => handleCategoryClick(e, category)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 text-white text-xs font-bold hover:bg-black/80 hover:border-cyan-500/40 transition-all cursor-pointer shadow-lg"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>#{category}</span>
          </button>
        </div>

        {/* Muted Pill Indicator when audio is locked/muted */}
        {isMuted && (
          <div className="pointer-events-auto">
            <button
              onClick={onToggleMute}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/80 backdrop-blur-md text-white text-[11px] font-bold shadow-lg animate-pulse cursor-pointer hover:bg-rose-600 transition-colors"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Tap for Sound</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Area: Left Info & Right Action Buttons */}
      <div className="flex items-end justify-between gap-4">
        {/* Left Side: Video Title, Description, Duration, Size */}
        <div className="flex-1 min-w-0 pointer-events-auto pr-2">
          {/* Uploader / Tag row */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-rose-500 flex items-center justify-center p-0.5 shadow-md">
              <div className="w-full h-full bg-zinc-950 rounded-full flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              </div>
            </div>
            <span className="text-xs font-bold text-white drop-shadow">
              {video.uploadedBy?.username || 'StreamVault User'}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-sm font-bold text-white leading-snug line-clamp-2 drop-shadow-md mb-1">
            {title}
          </h2>

          {/* Description if present */}
          {video.description && (
            <p className="text-xs text-zinc-300 line-clamp-2 drop-shadow leading-relaxed mb-2 font-normal">
              {video.description}
            </p>
          )}

          {/* Meta tags: Duration, Size, Extension */}
          <div className="flex items-center gap-2.5 text-[11px] font-mono text-zinc-300 drop-shadow">
            {video.duration ? (
              <span className="px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-md border border-white/10">
                {formatDuration(video.duration)}
              </span>
            ) : null}
            {video.fileSizeBytes ? (
              <span className="px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-md border border-white/10">
                {formatBytes(video.fileSizeBytes)}
              </span>
            ) : null}
            {video.extension ? (
              <span className="px-2 py-0.5 rounded-md bg-black/40 backdrop-blur-md border border-white/10 uppercase text-cyan-400 font-bold">
                {video.extension}
              </span>
            ) : null}
          </div>
        </div>

        {/* Right Side: Interaction Floating Buttons */}
        <div className="flex flex-col items-center gap-3.5 pointer-events-auto shrink-0 pb-1">
          {/* Like Button */}
          <button
            onClick={onLike}
            className="group flex flex-col items-center gap-1 transition-transform active:scale-75 cursor-pointer"
            aria-label="Like video"
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-xl border transition-all duration-200 ${
                isStarred
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-500 shadow-lg shadow-rose-500/25 scale-105'
                  : 'bg-black/50 border-white/15 text-white hover:bg-black/70 hover:border-white/30'
              }`}
            >
              <Heart
                className={`w-6 h-6 transition-transform group-hover:scale-110 ${
                  isStarred ? 'fill-rose-500 text-rose-500' : ''
                }`}
              />
            </div>
            <span className="text-xs font-semibold text-white drop-shadow">
              {formatViews(likesCount)}
            </span>
          </button>

          {/* Mute / Unmute Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            className="group flex flex-col items-center gap-1 transition-transform active:scale-75 cursor-pointer"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-xl border border-white/15 text-white hover:bg-black/70 hover:border-white/30 transition-all">
              {isMuted ? (
                <VolumeX className="w-6 h-6 text-rose-400 group-hover:scale-110" />
              ) : (
                <Volume2 className="w-6 h-6 text-cyan-400 group-hover:scale-110" />
              )}
            </div>
            <span className="text-[11px] font-medium text-zinc-300 drop-shadow">
              {isMuted ? 'Muted' : 'Sound'}
            </span>
          </button>

          {/* Views Indicator */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-xl border border-white/15 text-zinc-300">
              <Eye className="w-5 h-5 text-zinc-300" />
            </div>
            <span className="text-xs font-semibold text-white drop-shadow">
              {formatViews(views)}
            </span>
          </div>

          {/* Delete Reel Button */}
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="group flex flex-col items-center gap-1 transition-transform active:scale-75 cursor-pointer disabled:opacity-50"
            aria-label="Delete video"
            title="Delete reel"
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-xl border border-white/15 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10 transition-all">
              {isDeleting ? (
                <Loader2 className="w-5 h-5 text-rose-400 animate-spin" />
              ) : (
                <Trash2 className="w-5 h-5 transition-transform group-hover:scale-110" />
              )}
            </div>
            <span className="text-[11px] font-medium text-zinc-400 group-hover:text-rose-300 drop-shadow">
              Delete
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
