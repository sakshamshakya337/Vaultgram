import React, { useState } from 'react';
import { Heart, Volume2, VolumeX, Share2, Eye, Sparkles, Music, Check, Trash2, Loader2 } from 'lucide-react';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { formatViews, formatDuration, formatBytes } from '../../services/api';

export const ReelOverlay = ({ video, isMuted, onToggleMute, onLike }) => {
  const [copied, setCopied] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { setSelectedCategory, deleteReel } = useVideoFeed();

  const handleShare = async (e) => {
    e.stopPropagation();
    const shareUrl = window.location.origin + `?v=${video._id || video.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: video.title || 'StreamVault Reel',
          text: `Watch ${video.title} on StreamVault!`,
          url: shareUrl,
        });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    const reelTitle = video.title || 'this reel';
    const confirmed = window.confirm(`Delete "${reelTitle}"?\n\nThis will permanently delete the video and remove it from your cloud storage.`);
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      await deleteReel(video._id || video.id);
    } catch (err) {
      alert(err.message || 'Failed to delete reel');
      setIsDeleting(false);
    }
  };

  const handleCategoryClick = (e, cat) => {
    e.stopPropagation();
    if (cat) {
      setSelectedCategory(cat);
    }
  };

  const title = video.title || 'Untitled Video';
  const category = video.category || 'General';
  const views = video.views || 0;
  const isStarred = !!video.isStarred;
  const likesCount = video.likesCount || (isStarred ? 1 : 0);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 pb-20 md:pb-6 z-20">
      {/* Top Scrim Gradient */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none" />

      {/* Bottom Scrim Gradient */}
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />

      {/* Top Content Area (Empty spacer for category bar) */}
      <div className="relative z-10" />

      {/* Main Bottom + Right Rails Overlay */}
      <div className="relative z-10 flex items-end justify-between gap-4 w-full">
        {/* Left Side: Video Info */}
        <div className="flex-1 min-w-0 pr-2 pointer-events-auto space-y-2.5">
          {/* Category Chip */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={(e) => handleCategoryClick(e, category)}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 backdrop-blur-md hover:bg-cyan-500/30 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>#{category}</span>
            </button>
            {video.duration ? (
              <span className="text-[11px] font-mono text-zinc-400 bg-black/40 px-2 py-0.5 rounded border border-white/10 backdrop-blur-sm">
                {formatDuration(video.duration)}
              </span>
            ) : null}
            {video.fileSizeBytes ? (
              <span className="text-[11px] font-mono text-zinc-400 bg-black/40 px-2 py-0.5 rounded border border-white/10 backdrop-blur-sm">
                {formatBytes(video.fileSizeBytes)}
              </span>
            ) : null}
          </div>

          {/* Video Title */}
          <h2 className="text-base md:text-lg font-bold text-white leading-snug drop-shadow-md line-clamp-2">
            {title}
          </h2>

          {/* Description if present */}
          {video.description ? (
            <p className="text-xs md:text-sm text-zinc-300 line-clamp-2 leading-relaxed drop-shadow">
              {video.description}
            </p>
          ) : null}

          {/* Audio Ticker / Channel Info */}
          <div className="flex items-center gap-2 text-xs text-zinc-300/90 pt-1">
            <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-full border border-white/10 backdrop-blur-sm max-w-[220px]">
              <Music className="w-3 h-3 text-cyan-400 shrink-0 animate-spin-slow" />
              <span className="truncate text-[11px] font-medium">Original Audio • StreamVault</span>
            </div>
          </div>
        </div>

        {/* Right Rail: Action Buttons */}
        <div className="flex flex-col items-center gap-3.5 pointer-events-auto pb-1 shrink-0">
          {/* Like Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLike();
            }}
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

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="group flex flex-col items-center gap-1 transition-transform active:scale-75 cursor-pointer"
            aria-label="Share video"
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-xl border border-white/15 text-white hover:bg-black/70 hover:border-white/30 transition-all">
              {copied ? (
                <Check className="w-5 h-5 text-emerald-400" />
              ) : (
                <Share2 className="w-5 h-5 text-white group-hover:scale-110" />
              )}
            </div>
            <span className="text-[11px] font-medium text-zinc-300 drop-shadow">
              {copied ? 'Copied' : 'Share'}
            </span>
          </button>

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
