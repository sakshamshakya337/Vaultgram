import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { useAuth } from '../../contexts/AuthContext';
import { ReelCard } from './ReelCard';
import { TapToUnmuteHint } from './TapToUnmuteHint';
import { Video, Sparkles, Plus, RefreshCw, Lock, Shield } from 'lucide-react';

export const ReelsContainer = () => {
  const containerRef = useRef(null);
  const { hasPin, setIsSetPinModalOpen } = useAuth();
  const {
    videos,
    loading,
    error,
    selectedCategory,
    activeVideoIndex,
    setActiveVideoIndex,
    setIsUploadOpen,
    fetchVideos,
    sessionUnlockedReels,
    setCategoryLockTarget,
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
        const target = container.querySelector(`[data-index="${nextIndex}"]`);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = Math.max(0, activeVideoIndex - 1);
        const target = container.querySelector(`[data-index="${prevIndex}"]`);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeVideoIndex, videos.length]);

  // 1. PIN Security Gate: Prompt user to set a PIN if none exists
  if (!hasPin) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 p-6 text-center select-none">
        <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 shadow-xl shadow-cyan-500/10">
          <Shield className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1.5">Set PIN to Enable Reels</h3>
        <p className="text-xs text-zinc-400 max-w-xs mb-6 leading-relaxed">
          Reels displays aggregate video feeds. To protect your private folders, a PIN passcode is required to access Reels.
        </p>
        <button
          onClick={() => setIsSetPinModalOpen(true)}
          className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
        >
          Set Passcode Now
        </button>
      </div>
    );
  }

  // 2. PIN Security Gate: Prompt user for PIN entry to unlock Reels for this session
  if (hasPin && !sessionUnlockedReels) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 p-6 text-center select-none">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 shadow-xl shadow-rose-500/10">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-white mb-1.5">Reels Feed Locked</h3>
        <p className="text-xs text-zinc-400 max-w-xs mb-6 leading-relaxed">
          Enter your PIN passcode to unlock full-screen vertical video reels for this session.
        </p>
        <button
          onClick={() => setCategoryLockTarget('Reels')}
          className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 via-purple-600 to-rose-600 text-white font-bold text-xs shadow-lg shadow-rose-500/25 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
        >
          Unlock Reels Feed
        </button>
      </div>
    );
  }

  if (loading && videos.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 animate-spin">
          <RefreshCw className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-zinc-400 animate-pulse">
          Loading StreamVault feed...
        </p>
      </div>
    );
  }

  if (videos.length === 0 && !loading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-950 p-6 text-center">
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
            onClick={() => fetchVideos(selectedCategory, true)}
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
    <div className="relative w-full h-full overflow-hidden bg-black">
      {/* Session Unmute Floating Hint */}
      <TapToUnmuteHint />

      {/* Main Snap Feed */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-y-scroll snap-y-mandatory no-scrollbar"
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
