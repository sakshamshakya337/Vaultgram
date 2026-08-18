import React from 'react';
import { Folder, Lock, Unlock, Shield } from 'lucide-react';
import { useVideoFeed } from '../../contexts/VideoFeedContext';
import { useAuth } from '../../contexts/AuthContext';

export const DriveFolderGrid = ({ categoryCounts = {}, onSelectCategory }) => {
  const {
    categories,
    lockedCategories,
    sessionUnlockedCategories,
    toggleCategoryLock,
  } = useVideoFeed();

  const { hasPin, setIsSetPinModalOpen } = useAuth();

  const folderList = categories.filter((c) => c !== 'All');

  if (folderList.length === 0) return null;

  const handleQuickLockToggle = async (e, cat) => {
    e.stopPropagation(); // Don't navigate into folder
    if (!hasPin) {
      setIsSetPinModalOpen(true);
      return;
    }
    await toggleCategoryLock(cat);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          Folders & Categories
        </h3>
        <span className="text-xs text-zinc-500 font-mono">{folderList.length} folders</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
        {folderList.map((cat) => {
          const isLocked = (lockedCategories || []).some(
            (lc) => lc.toLowerCase() === cat.toLowerCase()
          );
          const isUnlockedThisSession = sessionUnlockedCategories?.has(cat.toLowerCase());
          const count = categoryCounts[cat.toLowerCase()] || 0;

          return (
            <div
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className="group relative p-3.5 rounded-2xl bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 hover:border-cyan-500/30 shadow-md hover:shadow-cyan-500/5 transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[95px]"
            >
              {/* Folder Icon & Lock action */}
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                  <Folder className="w-5 h-5 fill-cyan-400/20 text-cyan-400" />
                </div>

                {/* Quick Lock Button */}
                <button
                  onClick={(e) => handleQuickLockToggle(e, cat)}
                  className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                    isLocked
                      ? isUnlockedThisSession
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20 shadow-sm'
                      : 'opacity-0 group-hover:opacity-100 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 border-white/10'
                  }`}
                  title={isLocked ? 'Click to Unlock Category' : 'Click to Lock Category with PIN'}
                >
                  {isLocked ? (
                    isUnlockedThisSession ? (
                      <Unlock className="w-3.5 h-3.5" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Title & Count */}
              <div className="mt-2 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                    #{cat}
                  </h4>
                </div>
                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                  {count > 0 ? `${count} video${count === 1 ? '' : 's'}` : 'Folder'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
