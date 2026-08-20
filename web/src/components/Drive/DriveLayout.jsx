import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Video, Plus, Search, Folder, Sparkles, FolderOpen, Heart, Trash2, FolderPlus, Upload } from 'lucide-react';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { useAuth } from '../../contexts/useAuth';
import { useUploadQueue } from '../../contexts/useUploadQueue';
import { api } from '../../services/api';
import { DriveSidebar } from './DriveSidebar';
import { DriveHeader } from './DriveHeader';
import { DriveFolderGrid } from './DriveFolderGrid';
import { DriveFilesGrid } from './DriveFilesGrid';
import { DriveFilesList } from './DriveFilesList';
import { DesktopVideoModal } from './DesktopVideoModal';
import { NewFolderModal } from './NewFolderModal';
import { RenameModal } from './RenameModal';
import { ReelsContainer } from '../Reels/ReelsContainer';
import { BottomNav } from '../Navigation/BottomNav';
import { UploadDropzoneOverlay } from '../Upload/UploadDropzoneOverlay';
import { DriveFolderSkeleton, DriveGridSkeleton, DriveListSkeleton } from '../Skeletons/DriveSkeleton';

export const DriveLayout = () => {
  const {
    videos,
    selectedCategory,
    setSelectedCategory,
    requestCategory,
    categories,
    lockedCategories,
    sessionUnlockedCategories,
    setCategoryLockTarget,
    setIsUploadOpen,
  } = useVideoFeed();

  const { user, isAuthenticated, hasPin } = useAuth();
  const { registerOnUploadSuccess, openFilePicker } = useUploadQueue();

  // Navigation & Data
  const [currentNav, setCurrentNav] = useState('all'); // 'all', 'starred', 'recent', 'trash'
  const [currentFolder, setCurrentFolder] = useState(null); // null = root
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [modalPreviewState, setModalPreviewState] = useState(null); // { items: [], index: 0 }

  // Drive state
  const [driveItems, setDriveItems] = useState([]);
  const [loadingDrive, setLoadingDrive] = useState(false);

  // Modals
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);

  // Load drive items (folders and files)
  const loadDriveItems = useCallback(async () => {
    setLoadingDrive(true);
    try {
      const isScopedView = selectedCategory !== 'All' || !!currentFolder;
      const unlockedCats = isScopedView
        ? Array.from(sessionUnlockedCategories || []).join(',')
        : undefined;

      if (searchQuery.trim()) {
        const res = await api.drive.list({ limit: 100, unlockedCategories: unlockedCats });
        const items = res?.items || res?.videos || (Array.isArray(res) ? res : []);
        setDriveItems(items);
      } else {
        const res = await api.drive.list({
          folderId: currentFolder?._id || null,
          category: selectedCategory !== 'All' ? selectedCategory : undefined,
          filter: currentNav,
          limit: 100,
          unlockedCategories: unlockedCats,
        });
        const items = res?.items || res?.videos || (Array.isArray(res) ? res : []);
        setDriveItems(items);
      }
    } catch (err) {
      console.warn('Drive items fetch error:', err.message);
      setDriveItems([]);
    } finally {
      setLoadingDrive(false);
    }
  }, [currentFolder, currentNav, searchQuery, selectedCategory, sessionUnlockedCategories]);

  useEffect(() => {
    loadDriveItems();
  }, [loadDriveItems]);

  // Real-time automatic refresh when any queued upload completes
  useEffect(() => {
    const unregister = registerOnUploadSuccess(() => {
      loadDriveItems();
    });
    return unregister;
  }, [registerOnUploadSuccess, loadDriveItems]);

  // Separate folders and files
  const folders = useMemo(() => {
    if (currentFolder || currentNav !== 'all') return [];
    return driveItems.filter((item) => item.isFolder);
  }, [driveItems, currentFolder, currentNav]);

  const files = useMemo(() => {
    let list = driveItems.filter((item) => !item.isFolder);

    // ─── Strict Privacy Protection: Exclude Locked Categories ────────────────
    const effectiveLocked = Array.isArray(lockedCategories) && lockedCategories.length > 0
      ? lockedCategories
      : (Array.isArray(user?.lockedCategories) ? user.lockedCategories : []);

    if (effectiveLocked.length > 0) {
      list = list.filter((v) => {
        const cat = (v.category || '').toLowerCase().trim();
        const isCatLocked = effectiveLocked.some(
          (lc) => lc.toLowerCase().trim() === cat
        );
        if (!isCatLocked) return true;

        // In aggregate / home view (selectedCategory === 'All' and no currentFolder),
        // locked categories are ALWAYS completely excluded, even if unlocked in another context.
        if (selectedCategory === 'All' && !currentFolder) {
          return false;
        }

        const isCatUnlocked = sessionUnlockedCategories?.has(cat);
        return isCatUnlocked;
      });
    }

    // If viewing a category filter
    if (selectedCategory !== 'All' && currentNav === 'all') {
      list = list.filter(
        (v) => (v.category || '').toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Search query filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (v) =>
          (v.title || '').toLowerCase().includes(q) ||
          (v.category || '').toLowerCase().includes(q) ||
          (v.description || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [driveItems, lockedCategories, user?.lockedCategories, sessionUnlockedCategories, selectedCategory, currentNav, searchQuery]);

  // Handle opening custom folder with PIN check
  const handleOpenFolder = (folder) => {
    const title = folder.title || '';
    const folderId = folder._id || folder.id;
    const isLocked =
      (lockedCategories || []).some((lc) => lc.toLowerCase() === title.toLowerCase()) ||
      (lockedCategories || []).some((lc) => lc.toLowerCase() === folderId.toLowerCase());
    const isUnlockedSession =
      sessionUnlockedCategories?.has(title.toLowerCase()) ||
      sessionUnlockedCategories?.has(folderId.toLowerCase());

    if (isLocked && !isUnlockedSession && hasPin) {
      setCategoryLockTarget(title);
    } else {
      setCurrentFolder(folder);
    }
  };

  const handleOpenCategory = (cat) => {
    requestCategory(cat);
  };

  const handleDeleteFolder = async (folderId) => {
    if (window.confirm('Are you sure you want to delete this folder?')) {
      try {
        await api.drive.delete(folderId);
        loadDriveItems();
      } catch (err) {
        alert(err.message || 'Failed to delete folder');
      }
    }
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await api.drive.delete(fileId);
      setDriveItems((prev) => prev.filter((item) => (item._id || item.id) !== fileId));
      loadDriveItems();
    } catch (err) {
      alert(err.message || 'Failed to delete file');
    }
  };

  const handleResetToRoot = () => {
    setCurrentNav('all');
    setCurrentFolder(null);
    setSelectedCategory('All');
    setSearchQuery('');
  };

  const isAtRoot = currentNav === 'all' && !currentFolder && selectedCategory === 'All' && !searchQuery.trim();
  const categoryFoldersList = categories.filter((c) => c !== 'All');

  return (
    <div className="flex w-screen h-screen bg-black text-white overflow-hidden select-none font-sans relative">
      {/* Full-window Drag-and-Drop Dropzone Overlay */}
      <UploadDropzoneOverlay currentFolder={currentFolder} selectedCategory={selectedCategory} />

      {/* 1. Left Sidebar (Desktop Only) */}
      <div className="hidden md:flex shrink-0 h-full">
        <DriveSidebar
          currentNav={currentNav}
          currentFolder={currentFolder}
          onSelectNav={(nav) => {
            setCurrentNav(nav);
            setCurrentFolder(null);
            if (nav !== 'all') {
              setSelectedCategory('All');
            }
          }}
          onOpenNewFolder={() => setIsNewFolderOpen(true)}
        />
      </div>

      {/* 2. Main Drive Layout Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-zinc-950/40 relative">
        {/* Top Header Bar */}
        {currentNav !== 'reels' ? (
          <DriveHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            currentNav={currentNav}
            currentFolder={currentFolder}
            onResetToRoot={handleResetToRoot}
          />
        ) : (
          <div className="hidden md:block">
            <DriveHeader
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              currentNav={currentNav}
              currentFolder={currentFolder}
              onResetToRoot={handleResetToRoot}
            />
          </div>
        )}

        {/* Main Content Area: Responsive Reels vs Drive Browser */}
        {currentNav === 'reels' ? (
          <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden pb-16 md:pb-0 bg-black md:bg-zinc-950/60 md:p-6">
            <div className="w-full h-full md:max-w-[420px] md:h-[calc(100vh-6rem)] md:rounded-3xl overflow-hidden md:border md:border-white/10 md:shadow-2xl bg-black relative">
              <ReelsContainer />
            </div>
          </div>
        ) : (
          <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 pb-28 md:pb-8 no-scrollbar">
            {/* FOLDERS SECTION */}
            {isAtRoot && (
              loadingDrive && folders.length === 0 ? (
                <DriveFolderSkeleton count={6} />
              ) : (
                <DriveFolderGrid
                  folders={folders}
                  categoryFolders={categoryFoldersList}
                  onOpenFolder={handleOpenFolder}
                  onOpenCategory={handleOpenCategory}
                  onRenameFolder={(folder) => setRenameTarget(folder)}
                  onDeleteFolder={handleDeleteFolder}
                />
              )
            )}

            {/* FILES SECTION */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    {currentFolder
                      ? `Folder: ${currentFolder.title}`
                      : currentNav === 'starred'
                      ? 'Starred Videos'
                      : currentNav === 'recent'
                      ? 'Recent Uploads'
                      : currentNav === 'trash'
                      ? 'Trash'
                      : selectedCategory === 'All'
                      ? 'All Files'
                      : `#${selectedCategory} Files`}
                  </h3>
                  <span className="text-xs font-mono text-zinc-500">
                    ({loadingDrive && files.length === 0 ? '...' : files.length})
                  </span>
                </div>

                {currentFolder && (
                  <button
                    onClick={handleResetToRoot}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                  >
                    ← Back to My Drive
                  </button>
                )}
              </div>

              {/* Skeletons when initial loading or network is slow */}
              {loadingDrive && files.length === 0 ? (
                viewMode === 'grid' ? (
                  <DriveGridSkeleton count={8} />
                ) : (
                  <DriveListSkeleton count={6} />
                )
              ) : files.length === 0 ? (
                /* Empty State */
                <div className="p-8 md:p-12 rounded-3xl bg-zinc-900/30 border border-white/5 flex flex-col items-center justify-center text-center space-y-4 my-6">
                  <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-600">
                    {currentNav === 'starred' ? (
                      <Heart className="w-8 h-8 text-rose-500/40" />
                    ) : currentNav === 'trash' ? (
                      <Trash2 className="w-8 h-8 text-zinc-600" />
                    ) : (
                      <Folder className="w-8 h-8 text-zinc-600" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">
                      {currentNav === 'starred'
                        ? 'No Starred Files'
                        : currentNav === 'trash'
                        ? 'Trash is Empty'
                        : searchQuery
                        ? 'No Files Found'
                        : 'No Files in this Folder'}
                    </h4>
                    <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                      {currentNav === 'starred'
                        ? 'Like or star videos to save them here for quick access.'
                        : currentNav === 'trash'
                        ? 'Items you delete will appear here.'
                        : searchQuery
                        ? `No files match "${searchQuery}".`
                        : 'Upload your first media file or create a folder.'}
                    </p>
                  </div>

                  {currentNav === 'all' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openFilePicker({
                          folderId: currentFolder?._id || null,
                          folderTitle: currentFolder?.title || '',
                          category: selectedCategory,
                        })}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Upload Files</span>
                      </button>
                      <button
                        onClick={() => setIsNewFolderOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/10 transition-colors cursor-pointer"
                      >
                        <FolderPlus className="w-4 h-4 text-blue-400" />
                        <span>New Folder</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Grid vs List View */
                viewMode === 'grid' ? (
                  <DriveFilesGrid
                    videos={files}
                    onSelectVideo={(v, idx) =>
                      setModalPreviewState({
                        items: files,
                        index: typeof idx === 'number' ? idx : files.findIndex((f) => (f._id || f.id) === (v._id || v.id)),
                      })
                    }
                    onDeleteVideo={handleDeleteFile}
                  />
                ) : (
                  <DriveFilesList
                    videos={files}
                    onSelectVideo={(v, idx) =>
                      setModalPreviewState({
                        items: files,
                        index: typeof idx === 'number' ? idx : files.findIndex((f) => (f._id || f.id) === (v._id || v.id)),
                      })
                    }
                    onDeleteVideo={handleDeleteFile}
                  />
                )
              )}
            </div>
          </main>
        )}

        {/* Mobile Bottom Navigation Bar (hidden on desktop) */}
        <BottomNav
          currentNav={currentNav}
          currentFolder={currentFolder}
          onSelectNav={(nav) => {
            setCurrentNav(nav);
            setCurrentFolder(null);
            if (nav !== 'all') {
              setSelectedCategory('All');
            }
          }}
        />
      </div>

      {/* Desktop Video/Media Playback Modal with Prev/Next Navigation */}
      <DesktopVideoModal
        video={modalPreviewState ? modalPreviewState.items[modalPreviewState.index] : null}
        items={modalPreviewState?.items || []}
        currentIndex={modalPreviewState?.index ?? 0}
        onIndexChange={(newIdx) => setModalPreviewState((prev) => (prev ? { ...prev, index: newIdx } : null))}
        onClose={() => setModalPreviewState(null)}
        onDelete={handleDeleteFile}
      />

      {/* New Folder Modal */}
      <NewFolderModal
        isOpen={isNewFolderOpen}
        onClose={() => setIsNewFolderOpen(false)}
        currentFolderId={currentFolder?._id || null}
        onFolderCreated={loadDriveItems}
      />

      {/* Rename Modal */}
      <RenameModal
        item={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRenamed={loadDriveItems}
      />
    </div>
  );
};
