import React, { useState } from 'react';
import {
  Search,
  LayoutGrid,
  List,
  User,
  LogOut,
  Shield,
  ChevronRight,
  X,
  Lock,
  Unlock,
  Sparkles,
  Plus,
  ArrowLeft,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { useUploadQueue } from '../../contexts/useUploadQueue';
import { useTheme } from '../../contexts/useTheme';

export const DriveHeader = ({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  currentNav,
  currentFolder,
  onResetToRoot,
}) => {
  const { user, isAuthenticated, hasPin, setIsSetPinModalOpen, setIsSettingsOpen } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const {
    selectedCategory,
    lockedCategories,
    toggleCategoryLock,
    setIsAuthOpen,
    setIsUploadOpen,
  } = useVideoFeed();
  const { openFilePicker } = useUploadQueue();

  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);


  const getNavTitle = () => {
    if (currentNav === 'reels') return 'Reels Feed';
    if (currentNav === 'starred') return 'Starred';
    if (currentNav === 'recent') return 'Recent';
    if (currentNav === 'trash') return 'Trash';
    return selectedCategory === 'All' ? 'Vaultgram' : selectedCategory;
  };

  const isCurrentCategoryLocked =
    selectedCategory !== 'All' &&
    (lockedCategories || []).some(
      (lc) => lc.toLowerCase() === selectedCategory.toLowerCase()
    );

  const handleHeaderLockToggle = async () => {
    if (!hasPin) {
      setIsSetPinModalOpen(true);
      return;
    }
    await toggleCategoryLock(selectedCategory);
  };

  return (
    <header className="h-16 px-4 md:px-6 border-b border-white/10 bg-zinc-950/90 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 select-none z-30">
      {/* Mobile Search Overlay Bar */}
      {isMobileSearchOpen ? (
        <div className="flex items-center gap-2 w-full animate-fade-in md:hidden">
          <button
            onClick={() => {
              setIsMobileSearchOpen(false);
              onSearchChange('');
            }}
            className="p-2 text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search files and tags..."
              className="w-full pl-9 pr-8 py-2 rounded-2xl bg-zinc-900 border border-white/15 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Left: App Brand & Navigation Title / Breadcrumbs */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile Logo Brand */}
            <div className="flex items-center gap-2 md:hidden">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>

            <button
              onClick={onResetToRoot}
              className="text-xs md:text-sm font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer truncate"
            >
              {selectedCategory === 'All' && currentNav === 'all' ? 'Vaultgram Drive' : 'My Drive'}
            </button>

            {selectedCategory !== 'All' && currentNav === 'all' && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                <span className="text-xs font-bold text-cyan-400 truncate">#{selectedCategory}</span>

                {/* Folder Lock / Unlock Quick Button */}
                <button
                  onClick={handleHeaderLockToggle}
                  className={`ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                    isCurrentCategoryLocked
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      : 'bg-zinc-900 text-zinc-400 border border-white/10 hover:text-white'
                  }`}
                  title={isCurrentCategoryLocked ? 'Folder Locked' : 'Lock Folder (PIN)'}
                >
                  {isCurrentCategoryLocked ? (
                    <Lock className="w-3 h-3 text-rose-400" />
                  ) : (
                    <Unlock className="w-3 h-3 text-zinc-500" />
                  )}
                  <span className="hidden sm:inline">
                    {isCurrentCategoryLocked ? 'Locked' : 'Lock'}
                  </span>
                </button>
              </>
            )}

            {currentNav !== 'all' && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                <span className="text-xs font-bold text-white truncate">{getNavTitle()}</span>
              </>
            )}
          </div>

          {/* Desktop Center: Permanent Search Bar */}
          <div className="hidden md:block flex-1 max-w-md relative mx-2">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search files by title or tags..."
              className="w-full pl-9 pr-8 py-2 rounded-2xl bg-zinc-900/80 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Mobile Search Toggle Icon */}
            <button
              onClick={() => setIsMobileSearchOpen(true)}
              className="md:hidden w-9 h-9 rounded-xl bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Mobile Quick + Upload Button */}
            <button
              onClick={() => openFilePicker({
                folderId: currentFolder?._id || null,
                folderTitle: currentFolder?.title || '',
                category: selectedCategory,
              })}
              className="md:hidden flex items-center gap-1.5 h-9 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload</span>
            </button>

            {/* Desktop Grid / List View Toggle */}
            <div className="hidden md:flex items-center h-9 p-0.5 rounded-xl bg-zinc-900 border border-white/5">
              <button
                onClick={() => onViewModeChange('grid')}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-cyan-500/20 text-cyan-300 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => onViewModeChange('list')}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-cyan-500/20 text-cyan-300 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Theme Toggle (Sun / Moon) */}
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
              title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-500" />
              )}
            </button>

            {/* User Avatar & Settings */}
            {isAuthenticated ? (
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="hidden md:flex items-center gap-2 h-9 px-3 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-white/5 transition-colors cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-500 to-rose-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="text-xs font-semibold text-zinc-300 max-w-[100px] truncate">
                  {user?.username || 'Account'}
                </span>
              </button>
            ) : (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="hidden md:flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </>
      )}
    </header>
  );
};
