import React, { useState } from 'react';
import {
  Folder,
  Lock,
  Unlock,
  MoreVertical,
  FolderOpen,
  Edit2,
  Trash2,
  Shield
} from 'lucide-react';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { useAuth } from '../../contexts/AuthContext';

export const DriveFolderGrid = ({
  folders = [],
  categoryFolders = [],
  onOpenFolder,
  onOpenCategory,
  onRenameFolder,
  onDeleteFolder,
}) => {
  const {
    lockedCategories,
    sessionUnlockedCategories,
    toggleCategoryLock,
  } = useVideoFeed();

  const { hasPin, setIsSetPinModalOpen } = useAuth();
  const [activeMenuId, setActiveMenuId] = useState(null);

  const handleToggleLock = async (e, identifier) => {
    e.stopPropagation();
    setActiveMenuId(null);
    if (!hasPin) {
      setIsSetPinModalOpen(true);
      return;
    }
    await toggleCategoryLock(identifier);
  };

  const isFolderLocked = (identifier) => {
    return (lockedCategories || []).some(
      (lc) => lc.toLowerCase() === identifier.toLowerCase()
    );
  };

  const isFolderUnlockedSession = (identifier) => {
    return sessionUnlockedCategories?.has(identifier.toLowerCase());
  };

  return (
    <div className="space-y-6">
      {/* 1. Custom User Created Folders */}
      {folders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Folders ({folders.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {folders.map((folder) => {
              const folderId = folder._id || folder.id;
              const title = folder.title || 'Untitled Folder';
              const locked = isFolderLocked(title) || isFolderLocked(folderId);
              const unlockedSession = isFolderUnlockedSession(title) || isFolderUnlockedSession(folderId);

              return (
                <div
                  key={folderId}
                  onClick={() => onOpenFolder(folder)}
                  className="group relative p-4 rounded-2xl bg-zinc-900/60 hover:bg-zinc-900 border border-white/5 hover:border-cyan-500/30 shadow-md transition-all duration-200 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex-shrink-0 group-hover:bg-cyan-500 group-hover:text-black transition-colors">
                      <Folder className="h-5 w-5 fill-current" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white truncate block group-hover:text-cyan-300">
                          {title}
                        </span>
                        {locked && !unlockedSession && (
                          <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        {locked && unlockedSession && (
                          <Unlock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500">Folder</span>
                    </div>
                  </div>

                  {/* 3-Dots Dropdown Menu */}
                  <div className="relative flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      onClick={() => setActiveMenuId(activeMenuId === folderId ? null : folderId)}
                      title="Folder Options"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {activeMenuId === folderId && (
                      <div className="absolute right-0 top-8 z-50 w-44 rounded-2xl border border-white/10 bg-zinc-950 p-1.5 shadow-2xl backdrop-blur-2xl animate-fade-in divide-y divide-white/5">
                        <div className="space-y-0.5 pb-1">
                          <button
                            className="flex w-full items-center space-x-2 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                            onClick={() => {
                              onOpenFolder(folder);
                              setActiveMenuId(null);
                            }}
                          >
                            <FolderOpen className="h-3.5 w-3.5 text-cyan-400" />
                            <span>Open</span>
                          </button>

                          {/* Lock / Unlock Toggle in Menu */}
                          <button
                            className={`flex w-full items-center space-x-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                              locked
                                ? 'text-rose-400 hover:bg-rose-500/20'
                                : 'text-cyan-400 hover:bg-cyan-500/20'
                            }`}
                            onClick={(e) => handleToggleLock(e, title)}
                          >
                            {locked ? (
                              <>
                                <Unlock className="h-3.5 w-3.5" />
                                <span>Unlock Folder</span>
                              </>
                            ) : (
                              <>
                                <Lock className="h-3.5 w-3.5" />
                                <span>Lock Folder (PIN)</span>
                              </>
                            )}
                          </button>

                          {onRenameFolder && (
                            <button
                              className="flex w-full items-center space-x-2 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                              onClick={() => {
                                onRenameFolder(folder);
                                setActiveMenuId(null);
                              }}
                            >
                              <Edit2 className="h-3.5 w-3.5 text-blue-400" />
                              <span>Rename</span>
                            </button>
                          )}
                        </div>

                        {onDeleteFolder && (
                          <div className="pt-1">
                            <button
                              className="flex w-full items-center space-x-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                              onClick={() => {
                                onDeleteFolder(folderId);
                                setActiveMenuId(null);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Category Smart Folders (Trending, Music, Tech...) */}
      {categoryFolders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              File Categories ({categoryFolders.length})
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
            {categoryFolders.map((cat) => {
              const locked = isFolderLocked(cat);
              const unlockedSession = isFolderUnlockedSession(cat);

              return (
                <div
                  key={cat}
                  onClick={() => onOpenCategory(cat)}
                  className="group relative p-3.5 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900 border border-white/5 hover:border-cyan-500/30 shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[90px]"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                      <Folder className="w-4 h-4 fill-cyan-400/20 text-cyan-400" />
                    </div>

                    <button
                      onClick={(e) => handleToggleLock(e, cat)}
                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                        locked
                          ? unlockedSession
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'opacity-0 group-hover:opacity-100 bg-white/5 text-zinc-500 hover:text-white border-white/5'
                      }`}
                      title={locked ? 'Unlocked (Click to remove lock)' : 'Lock category with PIN'}
                    >
                      {locked ? (
                        unlockedSession ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />
                      ) : (
                        <Lock className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="mt-2 min-w-0">
                    <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                      #{cat}
                    </h4>
                    <span className="text-[10px] text-zinc-500 font-mono">Smart Folder</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
