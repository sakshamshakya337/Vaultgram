import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useVideoFeed } from '../../contexts/VideoFeedContext';
import { ReelCard } from './ReelCard';
import { TapToUnmuteHint } from './TapToUnmuteHint';
import { Video, Sparkles, Plus, RefreshCw } from 'lucide-react';

export const ReelsContainer = () => {
  const containerRef = useRef(null);
  const {
    videos,
    loading,
    error,
    selectedCategory,
    activeVideoIndex,
    setActiveVideoIndex,
    setIsUploadOpen,
    fetchVideos,
  } = useVideoFeed();

  // Set up IntersectionObserver with threshold 0.8 (>=80% visible)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.8) {
            const indexAttr = entry.target.getAttribute('data-index');
            if (indexAttr !== null) {
              const idx = parseInt(indexAttr, 10);
              setActiveVideoIndex(idx);
            }
          }
        });
      },
      {
        root: container,
        threshold: [0.8], // 80% visibility threshold
      }
    );

    const children = container.querySelectorAll('.snap-item');
    children.forEach((child) => observer.observe(child));

    return () => {
      children.forEach((child) => observer.unobserve(child));
      observer.disconnect();
    };
  }, [videos, setActiveVideoIndex]);

  // Keyboard navigation for desktop users
  useEffect(() => {
    const handleKeyDown = (e) => {
      const container = containerRef.current;
      if (!container) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = Math.min(videos.length - 1, activeVideoIndex + 1);
        scrollToIndex(nextIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = Math.max(0, activeVideoIndex - 1);
        scrollToIndex(prevIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeVideoIndex, videos.length]);

  const scrollToIndex = (index) => {
    const container = containerRef.current;
    if (!container) return;
    const items = container.querySelectorAll('.snap-item');
    if (items[index]) {
      items[index].scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (loading && videos.length === 0) {
    return (
      <div className="w-full h-full h-[100dvh] flex flex-col items-center justify-center bg-black p-6">
        <div className="relative flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <Video className="w-7 h-7 text-cyan-400 absolute animate-pulse" />
        </div>
        <p className="text-sm font-medium text-zinc-400 animate-pulse">
          Loading StreamVault feed...
        </p>
      </div>
    );
  }

  if (videos.length === 0 && !loading) {
    return (
      <div className="w-full h-full h-[100dvh] flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6 shadow-2xl shadow-cyan-500/10">
          <Video className="w-10 h-10" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No videos yet</h3>
        <p className="text-sm text-zinc-400 max-w-sm mb-6 leading-relaxed">
          {selectedCategory !== 'All'
            ? `No reels found in the "${selectedCategory}" category.`
            : 'Be the first to upload a short reel to your StreamVault Cloud!'}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-cyan-500/25 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Upload First Reel</span>
          </button>
          <button
            onClick={() => fetchVideos(selectedCategory)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/15 active:scale-95 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full h-[100dvh] overflow-hidden bg-black">
      {/* Session Unmute Floating Hint */}
      <TapToUnmuteHint />

      {/* Main Snap Feed */}
      <div
        ref={containerRef}
        className="w-full h-full h-[100dvh] overflow-y-scroll snap-y-mandatory no-scrollbar"
      >
        {videos.map((video, idx) => (
          <ReelCard
            key={video._id || video.id || idx}
            video={video}
            index={idx}
            isActive={idx === activeVideoIndex}
          />
        ))}
      </div>
    </div>
  );
};
