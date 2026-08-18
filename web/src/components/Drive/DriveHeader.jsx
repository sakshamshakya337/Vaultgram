import React from 'react';
import { Search, LayoutGrid, List, User, LogOut, Shield, ChevronRight, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useVideoFeed } from '../../contexts/VideoFeedContext';

export const DriveHeader = ({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  currentNav,
  onResetToRoot,
}) => {
  const { user, isAuthenticated, logout, setIsSettingsOpen } = useAuth();
  const { selectedCategory, setIsAuthOpen } = useVideoFeed();

  const getNavTitle = () => {
    if (currentNav === 'starred') return 'Starred Videos';
    if (currentNav === 'recent') return 'Recent Uploads';
    if (currentNav === 'trash') return 'Trash';
    return selectedCategory === 'All' ? 'My Drive' : selectedCategory;
  };

  return (
    <header className="h-16 px-6 border-b border-white/10 bg-zinc-950/80 backdrop-blur-md flex items-center justify-between gap-4 shrink-0 select-none">
      {/* Left: Breadcrumbs / Title */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onResetToRoot}
          className="text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          My Drive
        </button>

        {selectedCategory !== 'All' && currentNav === 'all' && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            <span className="text-xs font-bold text-cyan-400 truncate">#{selectedCategory}</span>
          </>
        )}

        {currentNav !== 'all' && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            <span className="text-xs font-bold text-white truncate">{getNavTitle()}</span>
          </>
        )}
      </div>

      {/* Center: Search Bar */}
      <div className="flex-1 max-w-md relative">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search videos by title or tags..."
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

      {/* Right: View Toggle & User Profile */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Grid / List View Toggle */}
        <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-white/5">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
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
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-cyan-500/20 text-cyan-300 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="List View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* User Avatar & Settings */}
        {isAuthenticated ? (
          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 py-1.5 px-2.5 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 border border-white/5 transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-500 to-rose-500 flex items-center justify-center text-[10px] font-bold text-white">
                {user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-xs font-semibold text-zinc-300 max-w-[100px] truncate">
                {user?.username || 'Account'}
              </span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAuthOpen(true)}
            className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-white transition-colors cursor-pointer"
          >
            <User className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
