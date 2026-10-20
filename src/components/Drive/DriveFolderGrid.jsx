import React, { useState } from 'react';
import {
  Folder,
  Lock,
  Unlock,
  MoreVertical,
  FolderOpen,
  Edit2,
  Trash2,
  Shield,
  Share2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { useAuth } from '../../contexts/useAuth';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { api } from '../../services/api';

export const DriveFolderGrid = ({
  folders = [],
  categoryFolders = [],
  onOpenFolder,
  onOpenCategory,
  onRenameFolder,
  onDeleteFolder,
  onShareFolder,
  onFolderContextMenu,
  onLockFolder,
  onUnlockFolder,
  onHideFolder,
  onUnhideFolder,
}) => {
  const {
    lockedCategories,
    sessionUnlockedCategories,
    toggleCategoryLock,
  } = useVideoFeed();

  const { hasPin, setIsSetPinModalOpen } = useAuth();
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const handleOpenDeleteDialog = async (folder) => {
    setDeleteFolderTarget(folder);
    setDeleteError(null);
    const folderId = folder?._id || folder?.id;
    if (folderId && api?.drive?.getFolderInfo) {
      try {
        const info = await api.drive.getFolderInfo(folderId);
        if (info?.success) {
          setDeleteFolderTarget((prev) =>
            prev && (prev._id === folderId || prev.id === folderId)
              ? {
                  ...prev,
                  itemCount: info.fileCount,
                  totalItemCount: info.totalCount,
                  subfolderCount: info.subfolderCount,
                }
              : prev
          );
        }
      } catch (e) {
        // Fallback to existing count
      }
    }
  };

  const handleToggleLock = async (e, identifier, secondaryId = null, folderObj = null) => {
    e.stopPropagation();
    setActiveMenuId(null);
    if (!hasPin) {
      setIsSetPinModalOpen(true);
      return;
    }
    if (folderObj) {
      if (folderObj.isLocked) {
        if (onUnlockFolder) return onUnlockFolder(folderObj);
      } else {
        if (onLockFolder) return onLockFolder(folderObj);
      }
    }
    await toggleCategoryLock(identifier);
    if (secondaryId && isFolderLocked(secondaryId)) {
      await toggleCategoryLock(secondaryId);
    }
  };

  const isFolderLocked = (identifier, folderObj = null) => {
    if (folderObj?.isLocked) return true;
    if (!identifier) return false;
    const str = String(identifier).trim().toLowerCase();
    return (lockedCategories || []).some(
      (lc) => (typeof lc === 'string' ? lc : lc?.category || '').trim().toLowerCase() === str
    );
  };

  const isFolderUnlockedSession = (identifier) => {
    if (!identifier) return false;
    const str = String(identifier).trim().toLowerCase();
    return sessionUnlockedCategories?.has(str);
  };

  const handleConfirmDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      if (onDeleteFolder) {
        await onDeleteFolder(deleteFolderTarget);
      }
      setDeleteFolderTarget(null);
    } catch (err) {
      // If folder is already gone / not found, dismiss cleanly
      if (err.status === 404 || err.message?.toLowerCase().includes('already deleted') || err.message?.toLowerCase().includes('not found')) {
        setDeleteFolderTarget(null);
        return;
      }
      setDeleteError(err.message || 'Failed to delete folder');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRetryDeleteFolder = async () => {
    await handleConfirmDeleteFolder();
  };

  return (
    <>
      <div className="space-y-6">
        {/* 1. Custom User Created Folders */}
        {folders.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Folders ({folders.length})
              </h3>
            </div>

            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-3.5">
              {folders.map((folder) => {
                const folderId = folder._id || folder.id;
                const title = folder.title || 'Untitled Folder';
                const locked = isFolderLocked(title, folder) || isFolderLocked(folderId, folder);
                const isHidden = !!folder.isHidden;
                const unlockedSession = isFolderUnlockedSession(title) || isFolderUnlockedSession(folderId);

                return (
                  <div
                    key={folderId}
                    onClick={() => onOpenFolder(folder)}
                    onContextMenu={(e) => {
                      if (onFolderContextMenu) {
                        e.preventDefault();
                        e.stopPropagation();
                        onFolderContextMenu(e, folder, true);
                      }
                    }}
                    className="group relative p-3 sm:p-4 rounded-2xl bg-zinc-900/60 hover:bg-zinc-900 border border-white/5 hover:border-cyan-500/30 shadow-md transition-all duration-200 cursor-pointer flex items-center justify-between w-full max-w-full min-w-0"
                  >
                    <div className="flex items-center space-x-3 sm:space-x-3.5 min-w-0 flex-1">
                      <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex-shrink-0 group-hover:bg-cyan-500 group-hover:text-black transition-colors">
                        <Folder className="h-4.5 w-4.5 sm:h-5 sm:w-5 fill-current" />
                      </div>
                      <div className="min-w-0 flex-1 pr-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="text-xs sm:text-sm font-bold text-white truncate min-w-0 flex-1 block group-hover:text-cyan-300"
                            title={title}
                          >
                            {title}
                          </span>
                          {locked && !unlockedSession && (
                            <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" title="Locked Folder" />
                          )}
                          {locked && unlockedSession && (
                            <Unlock className="w-3.5 h-3.5 text-cyan-400 shrink-0" title="Unlocked for session" />
                          )}
                          {isHidden && (
                            <EyeOff className="w-3.5 h-3.5 text-purple-400 shrink-0" title="Hidden Folder (Private Vault)" />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mt-1">
                          <span className="text-[10px] font-mono text-zinc-500 shrink-0">Folder</span>
                          {isHidden && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono shrink-0">
                              HIDDEN
                            </span>
                          )}
                          {locked && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono shrink-0">
                              LOCKED
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 3-Dots Dropdown Menu */}
                    <div className="relative flex-shrink-0 ml-1.5 sm:ml-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="p-1.5 sm:p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer"
                        onClick={() => setActiveMenuId(activeMenuId === folderId ? null : folderId)}
                        title="Folder Options"
                        aria-label="Folder Options"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {activeMenuId === folderId && (
                        <div className="absolute right-0 top-8 sm:top-9 z-50 w-44 sm:w-48 max-w-[calc(100vw-32px)] rounded-2xl border border-white/10 bg-zinc-950 p-1.5 shadow-2xl backdrop-blur-2xl animate-fade-in divide-y divide-white/5">
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
                                  : 'text-amber-400 hover:bg-amber-500/20'
                              }`}
                              onClick={(e) => handleToggleLock(e, title, folderId, folder)}
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

                            {/* Hide / Unhide Toggle in Menu */}
                            <button
                              className={`flex w-full items-center space-x-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                                isHidden
                                  ? 'text-cyan-400 hover:bg-cyan-500/20'
                                  : 'text-purple-400 hover:bg-purple-500/20'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(null);
                                if (isHidden) {
                                  if (onUnhideFolder) onUnhideFolder(folder);
                                } else {
                                  if (onHideFolder) onHideFolder(folder);
                                }
                              }}
                            >
                              {isHidden ? (
                                <>
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>Unhide Folder</span>
                                </>
                              ) : (
                                <>
                                  <EyeOff className="h-3.5 w-3.5" />
                                  <span>Hide Folder</span>
                                </>
                              )}
                            </button>

                            {onShareFolder && (
                              <button
                                className="flex w-full items-center space-x-2 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                                onClick={() => {
                                  onShareFolder({ category: title, isFolder: true });
                                  setActiveMenuId(null);
                                }}
                              >
                                <Share2 className="h-3.5 w-3.5 text-cyan-400" />
                                <span>Share Folder</span>
                              </button>
                            )}

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
                                  handleOpenDeleteDialog(folder);
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

            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3.5">
              {categoryFolders.map((cat) => {
                const locked = isFolderLocked(cat);
                const unlockedSession = isFolderUnlockedSession(cat);

                return (
                  <div
                    key={cat}
                    onClick={() => onOpenCategory(cat)}
                    onContextMenu={(e) => {
                      if (onFolderContextMenu) {
                        e.preventDefault();
                        e.stopPropagation();
                        onFolderContextMenu(e, { title: cat, category: cat, isCategory: true }, true);
                      }
                    }}
                    className="group relative p-3 sm:p-3.5 rounded-2xl bg-zinc-900/40 hover:bg-zinc-900 border border-white/5 hover:border-cyan-500/30 shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[85px] sm:min-h-[90px]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform shrink-0">
                        <Folder className="w-4 h-4 fill-cyan-400/20 text-cyan-400" />
                      </div>

                      <div className="flex items-center gap-1">
                        {onShareFolder && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onShareFolder({ category: cat, isFolder: true });
                            }}
                            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-lg border border-white/5 bg-white/5 text-zinc-400 hover:text-cyan-400 transition-all cursor-pointer"
                            title="Share Folder Link"
                            aria-label={`Share ${cat} folder link`}
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={(e) => handleToggleLock(e, cat)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            locked
                              ? unlockedSession
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 bg-white/5 text-zinc-500 hover:text-white border-white/5'
                          }`}
                          title={locked ? 'Unlocked (Click to remove lock)' : 'Lock category with PIN'}
                          aria-label={locked ? `Unlocked ${cat}` : `Lock ${cat} with PIN`}
                        >
                          {locked ? (
                            unlockedSession ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />
                          ) : (
                            <Lock className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 min-w-0">
                      <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 truncate" title={`#${cat}`}>
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

      {/* Delete Folder Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteFolderTarget}
        title="Delete Folder"
        itemName={deleteFolderTarget?.title || 'this folder'}
        itemType="folder"
        fileCount={deleteFolderTarget?.totalItemCount ?? deleteFolderTarget?.itemCount ?? 0}
        loading={isDeleting}
        error={deleteError}
        onConfirm={handleConfirmDeleteFolder}
        onRetry={handleRetryDeleteFolder}
        onCancel={() => {
          setDeleteFolderTarget(null);
          setDeleteError(null);
        }}
      />
    </>
  );
};
