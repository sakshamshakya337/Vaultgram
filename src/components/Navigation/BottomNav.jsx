import React from 'react';
import { Folder, Film, Heart, Clock, User, Shield, Plus, Calendar } from 'lucide-react';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { useAuth } from '../../contexts/useAuth';
import { useUploadQueue } from '../../contexts/useUploadQueue';

export const BottomNav = ({ currentNav = 'all', currentFolder = null, onSelectNav }) => {
  const {
    setIsUploadOpen,
    sessionUnlockedReels,
    setCategoryLockTarget,
    setSelectedCategory,
    selectedCategory,
  } = useVideoFeed();

  const { setIsSettingsOpen, setIsAuthOpen, isAuthenticated, hasPin } = useAuth();
  const { openFilePicker } = useUploadQueue();

  const handleNavClick = (nav) => {
    if (onSelectNav) {
      if (nav === 'reels') {
        onSelectNav('reels');
        if (hasPin && !sessionUnlockedReels) {
          setCategoryLockTarget('Reels');
        }
      } else {
        onSelectNav(nav);
        if (nav === 'all') {
          setSelectedCategory('All');
        }
      }
    }
  };

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-center justify-around px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] bg-zinc-950/95 backdrop-blur-xl border-t border-white/10 pointer-events-auto shadow-2xl">
      {/* 1. Drive Tab (Default) */}
      <button
        onClick={() => handleNavClick('all')}
        className={`flex flex-col items-center justify-center min-w-[52px] min-h-[44px] gap-1 px-1 transition-colors cursor-pointer ${
          currentNav === 'all' ? 'text-cyan-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
        aria-label="Drive"
      >
        <Folder className={`w-5 h-5 ${currentNav === 'all' ? 'fill-cyan-400/20' : ''}`} />
        <span className="text-[10px] font-semibold tracking-tight">Drive</span>
      </button>

      {/* 2. Timeline Tab */}
      <button
        onClick={() => handleNavClick('timeline')}
        className={`flex flex-col items-center justify-center min-w-[52px] min-h-[44px] gap-1 px-1 transition-colors cursor-pointer ${
          currentNav === 'timeline' ? 'text-purple-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
        aria-label="Timeline"
      >
        <Calendar className="w-5 h-5" />
        <span className="text-[10px] font-semibold tracking-tight">Timeline</span>
      </button>

      {/* 3. Center Quick Upload Button */}
      <button
        onClick={() => openFilePicker({
          folderId: currentFolder?._id || null,
          folderTitle: currentFolder?.title || '',
          category: selectedCategory,
        })}
        className="flex items-center justify-center -translate-y-2.5 w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-500 via-blue-500 to-rose-500 text-white shadow-lg shadow-cyan-500/30 active:scale-90 transition-transform cursor-pointer border-2 border-zinc-950 shrink-0"
        aria-label="Upload File"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      {/* 4. Reels Tab */}
      <button
        onClick={() => handleNavClick('reels')}
        className={`relative flex flex-col items-center justify-center min-w-[52px] min-h-[44px] gap-1 px-1 transition-colors cursor-pointer ${
          currentNav === 'reels' ? 'text-rose-400 font-bold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
        aria-label="Reels"
      >
        <div className="relative">
          <Film className="w-5 h-5" />
          <span className="absolute -top-1 -right-2.5 text-[7px] font-black px-1 py-0.2 rounded-full bg-rose-500 text-white font-mono leading-tight">
            NEW
          </span>
        </div>
        <span className="text-[10px] font-semibold tracking-tight">Reels</span>
      </button>

      {/* 5. Settings / Profile Tab */}
      <button
        onClick={() => (isAuthenticated ? setIsSettingsOpen(true) : setIsAuthOpen(true))}
        className="flex flex-col items-center justify-center min-w-[52px] min-h-[44px] gap-1 px-1 text-zinc-400 hover:text-white cursor-pointer transition-colors"
        aria-label="Settings"
      >
        <Shield className="w-5 h-5" />
        <span className="text-[10px] font-semibold tracking-tight">Settings</span>
      </button>
    </nav>
  );
};
