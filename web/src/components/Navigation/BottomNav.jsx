import React from 'react';
import { Home, Compass, Plus, Heart, Shield } from 'lucide-react';
import { useVideoFeed } from '../../contexts/VideoFeedContext';
import { useAuth } from '../../contexts/AuthContext';

export const BottomNav = () => {
  const {
    selectedCategory,
    setSelectedCategory,
    setIsUploadOpen,
  } = useVideoFeed();

  const { setIsSettingsOpen, setIsAuthOpen, isAuthenticated } = useAuth();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-center justify-around px-2 pb-safe pt-2 bg-gradient-to-t from-black via-black/90 to-transparent border-t border-white/5 pointer-events-auto">
      {/* Home / Feed */}
      <button
        onClick={() => setSelectedCategory('All')}
        className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors ${
          selectedCategory === 'All' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px] font-semibold">Feed</span>
      </button>

      {/* Explore / Categories */}
      <button
        onClick={() => setSelectedCategory('Trending')}
        className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors ${
          selectedCategory === 'Trending' ? 'text-cyan-400' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <Compass className="w-5 h-5" />
        <span className="text-[10px] font-semibold">Explore</span>
      </button>

      {/* Center Action: Plus / Upload */}
      <button
        onClick={() => setIsUploadOpen(true)}
        className="flex items-center justify-center -translate-y-2 w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 via-blue-500 to-rose-500 text-white shadow-lg shadow-cyan-500/30 active:scale-95 transition-transform cursor-pointer"
        aria-label="Upload reel"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* Liked / Saved */}
      <button
        onClick={() => setSelectedCategory('Starred')}
        className={`flex flex-col items-center gap-1 py-1 px-3 transition-colors ${
          selectedCategory === 'Starred' ? 'text-rose-500' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <Heart className="w-5 h-5" />
        <span className="text-[10px] font-semibold">Liked</span>
      </button>

      {/* Settings & PIN */}
      <button
        onClick={() => (isAuthenticated ? setIsSettingsOpen(true) : setIsAuthOpen(true))}
        className="flex flex-col items-center gap-1 py-1 px-3 text-zinc-400 hover:text-white cursor-pointer"
      >
        <Shield className="w-5 h-5" />
        <span className="text-[10px] font-semibold">Privacy</span>
      </button>
    </nav>
  );
};
