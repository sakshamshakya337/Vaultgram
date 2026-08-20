import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Video,
  Film,
  Heart,
  Clock,
  Trash2,
  Folder,
  FolderPlus,
  Lock,
  Unlock,
  Cloud,
  Shield,
  Upload,
  Download,
  Calendar,
  CalendarDays,
  CalendarRange
} from 'lucide-react';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { useAuth } from '../../contexts/useAuth';
import { useUploadQueue } from '../../contexts/useUploadQueue';

export const DriveSidebar = ({
  currentNav,
  currentFolder,
  onSelectNav,
  onOpenNewFolder,
}) => {
  const {
    categories,
    selectedCategory,
    requestCategory,
    lockedCategories,
    sessionUnlockedCategories,
    toggleCategoryLock,
    setIsUploadOpen,
    triggerInstall,
  } = useVideoFeed();

  const { setIsSettingsOpen, setIsSetPinModalOpen, hasPin } = useAuth();
  const { openFilePicker } = useUploadQueue();
  const [showNewMenu, setShowNewMenu] = useState(false);

  const handleQuickLockToggle = async (e, cat) => {
    e.stopPropagation();
    if (!hasPin) {
      setIsSetPinModalOpen(true);
      return;
    }
    await toggleCategoryLock(cat);
  };

  return (
    <aside className="w-64 h-screen bg-zinc-950 border-r border-white/10 flex flex-col justify-between shrink-0 select-none">
      {/* Top Header & Logo */}
      <div className="p-5 flex flex-col gap-4 shrink-0">
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-500 to-rose-500 flex items-center justify-center p-0.5 shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-zinc-950 rounded-[12px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-white leading-none">
              Stream<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-rose-500">Vault</span>
            </h1>
            <span className="text-[10px] font-mono text-zinc-500">CLOUD DRIVE</span>
          </div>
        </div>

        {/* Primary "+ New" Action Button with Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNewMenu((prev) => !prev)}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-blue-500 text-white font-bold text-sm shadow-xl shadow-cyan-500/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>New Action</span>
          </button>

          {showNewMenu && (
            <div className="absolute left-0 right-0 top-14 z-50 rounded-2xl bg-zinc-900 border border-white/10 p-1.5 shadow-2xl backdrop-blur-xl animate-fade-in space-y-1">
              <button
                onClick={() => {
                  setShowNewMenu(false);
                  openFilePicker({
                    folderId: currentFolder?._id || null,
                    folderTitle: currentFolder?.title || '',
                    category: selectedCategory,
                  });
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-cyan-400" />
                <span>Upload Files</span>
              </button>

              <button
                onClick={() => {
                  setShowNewMenu(false);
                  if (onOpenNewFolder) onOpenNewFolder();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <FolderPlus className="w-4 h-4 text-blue-400" />
                <span>New Folder</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation & Categories Scrollable Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-3 space-y-6">
        {/* Main Nav Items */}
        <div className="space-y-1">
          <button
            onClick={() => {
              onSelectNav('reels');
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentNav === 'reels'
                ? 'bg-gradient-to-r from-rose-500/20 to-purple-500/20 text-rose-300 border border-rose-500/40 shadow-lg shadow-rose-500/10'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Film className={`w-4 h-4 ${currentNav === 'reels' ? 'text-rose-400' : 'text-zinc-400'}`} />
            <div className="flex items-center justify-between flex-1">
              <span>Reels</span>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-mono">
                FEED
              </span>
            </div>
          </button>

          <button
            onClick={() => {
              onSelectNav('all');
              requestCategory('All');
            }}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentNav === 'all' && selectedCategory === 'All'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>My Cloud Drive</span>
          </button>

          <button
            onClick={() => onSelectNav('starred')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentNav === 'starred'
                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Heart className="w-4 h-4" />
            <span>Starred</span>
          </button>

          <button
            onClick={() => onSelectNav('recent')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentNav === 'recent'
                ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Recent</span>
          </button>

          <button
            onClick={() => onSelectNav('timeline')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentNav === 'timeline'
                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Timeline</span>
          </button>

          <button
            onClick={() => onSelectNav('this-week')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentNav === 'this-week'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>This Week</span>
          </button>

          <button
            onClick={() => onSelectNav('this-month')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentNav === 'this-month'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <CalendarRange className="w-4 h-4" />
            <span>This Month</span>
          </button>

          <button
            onClick={() => onSelectNav('trash')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentNav === 'trash'
                ? 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Trash</span>
          </button>
        </div>

        {/* Categories / Folders Section */}
        <div className="space-y-1 pt-2 border-t border-white/5">
          <div className="px-3.5 py-1.5 flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
            <span>File Categories</span>
            <span className="text-[10px] text-zinc-600 font-mono">
              {categories.filter((c) => c !== 'All').length}
            </span>
          </div>

          {categories
            .filter((cat) => cat !== 'All')
            .map((cat) => {
              const isSelected = selectedCategory === cat && currentNav === 'all';
              const isLocked = (lockedCategories || []).some(
                (lc) => lc.toLowerCase() === cat.toLowerCase()
              );
              const isUnlockedThisSession = sessionUnlockedCategories?.has(cat.toLowerCase());

              return (
                <div
                  key={cat}
                  onClick={() => {
                    onSelectNav('all');
                    requestCategory(cat);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-white/10 text-white font-bold border border-white/15'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Folder className={`w-4 h-4 shrink-0 transition-colors ${isSelected ? 'text-cyan-400 fill-cyan-400/20' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                    <span className="truncate">#{cat}</span>
                  </div>

                  <button
                    onClick={(e) => handleQuickLockToggle(e, cat)}
                    className={`p-1 rounded-md transition-all cursor-pointer ${
                      isLocked
                        ? isUnlockedThisSession
                          ? 'text-cyan-400 hover:bg-cyan-500/20'
                          : 'text-rose-400 hover:bg-rose-500/20'
                        : 'opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white hover:bg-white/10'
                    }`}
                    title={isLocked ? 'Folder Locked (Click to Unlock)' : 'Lock Folder with PIN'}
                  >
                    {isLocked ? (
                      isUnlockedThisSession ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              );
            })}
        </div>
      </div>

      {/* Bottom Storage & Settings Area */}
      <div className="p-4 border-t border-white/10 bg-zinc-950/60 space-y-3 shrink-0">
        {/* Storage Bar */}
        <div className="p-3 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
              <Cloud className="w-3.5 h-3.5 text-cyan-400" />
              <span>Telegram Cloud Vault</span>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 font-bold">Unlimited</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 w-3/4 rounded-full" />
          </div>
          <p className="text-[10px] text-zinc-500">Free, encrypted cloud storage</p>
        </div>

        {/* Install Desktop App Option */}
        <button
          onClick={triggerInstall}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            <span>Install App</span>
          </div>
          <span className="text-[10px] font-mono text-cyan-300">PWA</span>
        </button>

        {/* Privacy & Settings Button */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>Passcode & Privacy</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            {hasPin ? 'PIN 🔒' : 'Off'}
          </span>
        </button>
      </div>
    </aside>
  );
};
