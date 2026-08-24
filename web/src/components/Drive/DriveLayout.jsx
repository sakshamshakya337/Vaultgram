import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Video, Plus, Search, Folder, Sparkles, FolderOpen, Heart, Trash2, FolderPlus, Upload, Loader2, Share2 } from 'lucide-react';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { useAuth } from '../../contexts/useAuth';
import { useUploadQueue } from '../../contexts/useUploadQueue';
import { api, getFileKind } from '../../services/api';
import { DriveSidebar } from './DriveSidebar';
import { DriveHeader } from './DriveHeader';
import { DriveFolderGrid } from './DriveFolderGrid';
import { DriveFilesGrid } from './DriveFilesGrid';
import { DriveFilesList } from './DriveFilesList';
import { DesktopVideoModal } from './DesktopVideoModal';
import { PhotoViewer } from './PhotoViewer';
import { DocumentViewerModal } from './DocumentViewerModal';
import { NewFolderModal } from './NewFolderModal';
import { RenameModal } from './RenameModal';
import { ShareModal } from './ShareModal';
import { TimelineView } from './TimelineView';
import { TrashView } from './TrashView';
import { CameraCaptureModal } from '../Upload/CameraCaptureModal';
import { VoiceMemoModal } from '../Upload/VoiceMemoModal';
import { ReelsContainer } from '../Reels/ReelsContainer';
import { BottomNav } from '../Navigation/BottomNav';
import { UploadDropzoneOverlay } from '../Upload/UploadDropzoneOverlay';
import { DriveFolderSkeleton, DriveGridSkeleton, DriveListSkeleton } from '../Skeletons/DriveSkeleton';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { DriveSelectionBar } from './DriveSelectionBar';
import { DriveContextMenu } from './DriveContextMenu';
import { MoveToModal } from './MoveToModal';
import { BulkDeleteModal } from './BulkDeleteModal';

export const DriveLayout = () => {
  const {
    selectedCategory = 'All',
    setSelectedCategory,
    categories,
    fetchCategories,
    categoryLockTarget,
    setCategoryLockTarget,
    sessionUnlockedCategories,
    requestCategory,
    lockedCategories,
  } = useVideoFeed();

  const { user, hasPin } = useAuth();
  const { openFilePicker, registerOnUploadSuccess } = useUploadQueue();

  // Navigation & Data
  const [currentNav, setCurrentNav] = useState('all'); // 'all', 'starred', 'recent', 'this-week', 'this-month', 'trash'
  const [currentFolder, setCurrentFolder] = useState(null); // null = root
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [modalPreviewState, setModalPreviewState] = useState(null); // { items: [], index: 0 }
  const [photoViewerState, setPhotoViewerState] = useState(null); // { items: [], index: 0 }
  const [docViewerState, setDocViewerState] = useState(null); // { items: [], index: 0 }

  // Multi-Selection & Navigation Focus State
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [lastSelectedId, setLastSelectedId] = useState(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Context Menu & Action Modals State
  const [contextMenu, setContextMenu] = useState(null); // { x, y, item, isFolder, selectedCount }
  const [moveToTarget, setMoveToTarget] = useState(null); // { items: [] }
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState(null); // { ids: [] }
  const [singleShareTarget, setSingleShareTarget] = useState(null);

  // Modals
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isVoiceMemoOpen, setIsVoiceMemoOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [shareFolderTarget, setShareFolderTarget] = useState(null);
  const sentinelRef = useRef(null);

  // Memoized query parameters for unified cursor pagination
  const queryParams = useMemo(() => {
    const isScopedView = (selectedCategory && selectedCategory !== 'All') || !!currentFolder;
    const unlockedCats = isScopedView
      ? Array.from(sessionUnlockedCategories || []).join(',')
      : undefined;

    return {
      folderId: currentFolder?._id || null,
      category: selectedCategory && selectedCategory !== 'All' ? selectedCategory : undefined,
      filter: currentNav,
      search: searchQuery.trim() || undefined,
      unlockedCategories: unlockedCats,
    };
  }, [currentFolder, selectedCategory, currentNav, searchQuery, sessionUnlockedCategories]);

  // Shared cursor-based pagination hook with AbortController and request-id protection
  const {
    items: driveItems,
    loading: loadingDrive,
    loadingMore,
    hasMore,
    total: totalCount,
    loadMore,
    refresh: loadDriveItems,
    mutateItems: setDriveItems,
  } = usePaginatedList(api.drive.list, queryParams, { limit: 24 });

  // Automatic Infinite Scroll with IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingDrive && !loadingMore && hasMore) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '350px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, loadingDrive, loadingMore, hasMore]);

  // Real-time automatic in-place state update when any queued upload completes
  useEffect(() => {
    const unregister = registerOnUploadSuccess((newDoc) => {
      if (!newDoc || !newDoc._id) return;

      // Refresh categories list whenever a new item is uploaded
      if (fetchCategories) {
        fetchCategories();
      }

      // 1. Match folder
      const targetFolderId = currentFolder?._id || currentFolder?.id || null;
      const docFolderId = newDoc.folderId || newDoc.parentFolderId || null;
      const isSameFolder =
        (targetFolderId === null && (!docFolderId || docFolderId === 'root')) ||
        (targetFolderId && String(targetFolderId) === String(docFolderId));

      // 2. Match category filter
      const cleanSelected = String(selectedCategory || 'All').replace(/^#/, '').toLowerCase().trim();
      const cleanDocCat = String(newDoc.category || '').replace(/^#/, '').toLowerCase().trim();
      const isSameCategory = cleanSelected === 'all' || cleanSelected === cleanDocCat;

      // 3. Match current view navigation
      const matchesNav =
        currentNav === 'all' ||
        currentNav === 'recent' ||
        (currentNav === 'starred' && newDoc.isStarred);

      if (isSameFolder && isSameCategory && matchesNav) {
        setDriveItems((prev) => {
          const exists = prev.some((it) => (it._id || it.id) === (newDoc._id || newDoc.id));
          if (exists) return prev;
          return [newDoc, ...prev];
        });
      }
    });
    return unregister;
  }, [registerOnUploadSuccess, fetchCategories, currentFolder, selectedCategory, currentNav, setDriveItems]);

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
        const cat = (v?.category || '').replace(/^#/, '').toLowerCase().trim();
        const isCatLocked = effectiveLocked.some(
          (lc) => (typeof lc === 'string' ? lc : lc?.category || '').replace(/^#/, '').toLowerCase().trim() === cat
        );
        if (!isCatLocked) return true;

        if ((!selectedCategory || selectedCategory === 'All') && !currentFolder) {
          return false;
        }

        const isCatUnlocked = sessionUnlockedCategories?.has(cat) || sessionUnlockedCategories?.has(`#${cat}`);
        return isCatUnlocked;
      });
    }

    // If viewing a category filter
    if (selectedCategory && selectedCategory !== 'All' && currentNav === 'all') {
      const cleanSelected = String(selectedCategory || '').replace(/^#/, '').toLowerCase().trim();
      list = list.filter(
        (v) => (v?.category || '').replace(/^#/, '').toLowerCase().trim() === cleanSelected
      );
    }

    // Auto-categorize smart views by date
    if (currentNav === 'this-week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      list = list.filter((v) => new Date(v.createdAt || v.updatedAt) >= oneWeekAgo);
    } else if (currentNav === 'this-month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
      list = list.filter((v) => new Date(v.createdAt || v.updatedAt) >= oneMonthAgo);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (v) =>
          (v.title || '').toLowerCase().includes(q) ||
          (v.note || '').toLowerCase().includes(q) ||
          (v.category || '').toLowerCase().includes(q) ||
          (v.extension || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [driveItems, lockedCategories, user?.lockedCategories, sessionUnlockedCategories, selectedCategory, currentNav, searchQuery]);

  // Handle opening custom folder with PIN check
  const handleOpenFolder = (folder) => {
    const title = folder.title || '';
    const folderId = folder._id || folder.id || '';
    const isLocked =
      (lockedCategories || []).some((lc) => (typeof lc === 'string' ? lc : lc?.category || '').toLowerCase() === title.toLowerCase()) ||
      (lockedCategories || []).some((lc) => (typeof lc === 'string' ? lc : lc?.category || '').toLowerCase() === String(folderId).toLowerCase());
    const isUnlockedSession =
      sessionUnlockedCategories?.has(title.toLowerCase()) ||
      sessionUnlockedCategories?.has(String(folderId).toLowerCase());

    if (isLocked && !isUnlockedSession && hasPin) {
      setCategoryLockTarget(title);
    } else {
      setCurrentFolder(folder);
      setSelectedFileIds([]);
    }
  };

  const handleOpenCategory = (cat) => {
    requestCategory(cat);
    setSelectedFileIds([]);
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
      setSelectedFileIds((prev) => prev.filter((id) => id !== fileId));
      loadDriveItems();
    } catch (err) {
      alert(err.message || 'Failed to delete file');
    }
  };

  // Inline rename handler
  const handleRenameFile = async (fileId, newTitle) => {
    try {
      await api.drive.rename(fileId, newTitle);
      setDriveItems((prev) =>
        prev.map((item) =>
          (item._id === fileId || item.id === fileId) ? { ...item, title: newTitle } : item
        )
      );
    } catch (err) {
      console.error('[handleRenameFile error]:', err);
      throw err;
    }
  };

  // Multi-Selection Logic
  const handleToggleSelect = useCallback(
    (fileId, event, index) => {
      setSelectedFileIds((prev) => {
        if (event?.shiftKey && lastSelectedId) {
          const idx1 = files.findIndex((f) => (f._id || f.id) === lastSelectedId);
          const idx2 = typeof index === 'number' ? index : files.findIndex((f) => (f._id || f.id) === fileId);

          if (idx1 >= 0 && idx2 >= 0) {
            const start = Math.min(idx1, idx2);
            const end = Math.max(idx1, idx2);
            const rangeIds = files.slice(start, end + 1).map((f) => f._id || f.id);
            const set = new Set([...prev, ...rangeIds]);
            return Array.from(set);
          }
        }

        if (prev.includes(fileId)) {
          return prev.filter((id) => id !== fileId);
        } else {
          return [...prev, fileId];
        }
      });
      setLastSelectedId(fileId);
      if (typeof index === 'number') setFocusedIndex(index);
    },
    [files, lastSelectedId]
  );

  const handleToggleSelectAll = useCallback(() => {
    if (selectedFileIds.length === files.length) {
      setSelectedFileIds([]);
    } else {
      setSelectedFileIds(files.map((f) => f._id || f.id));
    }
  }, [selectedFileIds.length, files]);

  const handleClearSelection = useCallback(() => {
    setSelectedFileIds([]);
    setFocusedIndex(-1);
  }, []);

  // Bulk Actions
  const handleExecuteBulkDelete = async () => {
    const ids = bulkDeleteTarget?.ids || selectedFileIds;
    if (ids.length === 0) return;

    try {
      await api.drive.batchTrash(ids);
      setDriveItems((prev) => prev.filter((item) => !ids.includes(item._id || item.id)));
      setSelectedFileIds([]);
      setBulkDeleteTarget(null);
      loadDriveItems();
    } catch (err) {
      console.error('[handleExecuteBulkDelete error]:', err);
      alert(err.message || 'Failed to bulk delete files');
    }
  };

  const handleExecuteBulkMove = async ({ ids, destination }) => {
    loadDriveItems();
    setSelectedFileIds([]);
    setMoveToTarget(null);
  };

  const handleBulkDownload = useCallback(() => {
    const targetFiles = files.filter((f) => selectedFileIds.includes(f._id || f.id));
    targetFiles.forEach((file, i) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = api.stream.getUrl(file._id || file.id, true);
        link.download = file.title || 'file';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, i * 350);
    });
  }, [files, selectedFileIds]);

  const handleBulkShare = useCallback(() => {
    const targetFiles = files.filter((f) => selectedFileIds.includes(f._id || f.id));
    if (targetFiles.length === 1) {
      setSingleShareTarget(targetFiles[0]);
    } else if (targetFiles.length > 1) {
      // If all selected files share the same category, offer folder share, otherwise share first
      setSingleShareTarget(targetFiles[0]);
    }
  }, [files, selectedFileIds]);

  // Context Menu Dispatcher
  const handleContextMenu = (e, item, isFolder = false) => {
    const itemId = item._id || item.id;
    if (!isFolder && itemId) {
      if (!selectedFileIds.includes(itemId)) {
        setSelectedFileIds([itemId]);
        setLastSelectedId(itemId);
      }
    }
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
      isFolder,
      selectedCount: !isFolder && selectedFileIds.includes(itemId) ? selectedFileIds.length : 1,
    });
  };

  const handleSelectFile = useCallback(
    (file, idx) => {
      if (!file) return;
      const { isImage, isVideo } = getFileKind(file);

      if (isImage) {
        const imageFiles = files.filter((f) => getFileKind(f).isImage);
        const photoIdx = imageFiles.findIndex(
          (f) => (f._id || f.id) === (file._id || file.id)
        );
        setPhotoViewerState({
          items: imageFiles.length > 0 ? imageFiles : [file],
          index: photoIdx >= 0 ? photoIdx : 0,
        });
      } else if (isVideo) {
        const videoFiles = files.filter((f) => getFileKind(f).isVideo);
        const videoIdx = videoFiles.findIndex(
          (f) => (f._id || f.id) === (file._id || file.id)
        );
        setModalPreviewState({
          items: videoFiles.length > 0 ? videoFiles : [file],
          index: videoIdx >= 0 ? videoIdx : (typeof idx === 'number' ? idx : 0),
        });
      } else {
        const docFiles = files.filter((f) => !getFileKind(f).isImage && !getFileKind(f).isVideo);
        const docIdx = docFiles.findIndex(
          (f) => (f._id || f.id) === (file._id || file.id)
        );
        setDocViewerState({
          items: docFiles.length > 0 ? docFiles : [file],
          index: docIdx >= 0 ? docIdx : 0,
        });
      }
    },
    [files]
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable) {
        return;
      }

      // Don't intercept if any full-screen viewer modal is active
      const isAnyModalOpen =
        !!modalPreviewState ||
        !!photoViewerState ||
        !!docViewerState ||
        isNewFolderOpen ||
        !!renameTarget ||
        !!shareFolderTarget ||
        isCameraOpen ||
        isVoiceMemoOpen ||
        !!moveToTarget ||
        !!bulkDeleteTarget ||
        !!singleShareTarget;

      if (isAnyModalOpen) return;

      // 1. "/" focuses search input
      if (e.key === '/') {
        e.preventDefault();
        const searchEl = document.getElementById('drive-search-input');
        if (searchEl) {
          searchEl.focus();
          searchEl.select();
        }
        return;
      }

      // 2. Escape clears selection / context menu
      if (e.key === 'Escape') {
        if (contextMenu) {
          setContextMenu(null);
        } else if (selectedFileIds.length > 0) {
          setSelectedFileIds([]);
          setFocusedIndex(-1);
        }
        return;
      }

      // 3. Delete or Backspace triggers bulk delete confirmation
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFileIds.length > 0) {
        e.preventDefault();
        setBulkDeleteTarget({ ids: selectedFileIds });
        return;
      }

      // 4. Arrow navigation
      if (files.length === 0) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev < files.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : files.length - 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const step = viewMode === 'grid' ? 4 : 1;
        setFocusedIndex((prev) => Math.min(files.length - 1, Math.max(0, prev + step)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const step = viewMode === 'grid' ? 4 : 1;
        setFocusedIndex((prev) => Math.max(0, prev - step));
      } else if (e.key === 'Enter' && focusedIndex >= 0 && files[focusedIndex]) {
        e.preventDefault();
        handleSelectFile(files[focusedIndex], focusedIndex);
      } else if (e.key === ' ' && focusedIndex >= 0 && files[focusedIndex]) {
        e.preventDefault();
        const fId = files[focusedIndex]._id || files[focusedIndex].id;
        handleToggleSelect(fId, e, focusedIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    modalPreviewState,
    photoViewerState,
    docViewerState,
    isNewFolderOpen,
    renameTarget,
    shareFolderTarget,
    isCameraOpen,
    isVoiceMemoOpen,
    moveToTarget,
    bulkDeleteTarget,
    singleShareTarget,
    contextMenu,
    selectedFileIds,
    files,
    focusedIndex,
    viewMode,
    handleSelectFile,
    handleToggleSelect,
  ]);

  const handleResetToRoot = () => {
    setCurrentNav('all');
    setCurrentFolder(null);
    setSelectedCategory('All');
    setSearchQuery('');
    setSelectedFileIds([]);
    setFocusedIndex(-1);
  };

  const isAtRoot = currentNav === 'all' && !currentFolder && selectedCategory === 'All' && !searchQuery.trim();
  const categoryFoldersList = useMemo(() => {
    const set = new Set();
    (categories || []).forEach((c) => {
      const clean = (c || '').replace(/^#/, '').trim();
      if (clean && clean.toLowerCase() !== 'all' && clean.toLowerCase() !== 'general') {
        set.add(clean);
      }
    });
    (driveItems || []).forEach((item) => {
      if (item?.category && typeof item.category === 'string') {
        const clean = item.category.replace(/^#/, '').trim();
        if (clean && clean.toLowerCase() !== 'all' && clean.toLowerCase() !== 'general') {
          set.add(clean);
        }
      }
    });
    return Array.from(set);
  }, [categories, driveItems]);

  return (
    <div className="flex w-screen h-screen bg-black text-white overflow-hidden select-none font-sans relative">
      {/* Full-window Drag-and-Drop Dropzone Overlay */}
      <UploadDropzoneOverlay currentFolder={currentFolder} selectedCategory={selectedCategory} />

      {/* 1. Left Sidebar (Desktop Only) */}
      <div className="hidden md:flex shrink-0 h-full">
        <DriveSidebar
          currentNav={currentNav}
          onSelectNav={(nav) => {
            setCurrentNav(nav);
            setCurrentFolder(null);
            setSelectedFileIds([]);
            setFocusedIndex(-1);
            if (nav !== 'all') {
              setSelectedCategory('All');
            }
          }}
          selectedCategory={selectedCategory}
          currentFolder={currentFolder}
          onResetToRoot={handleResetToRoot}
          onOpenCategory={handleOpenCategory}
          onOpenNewFolder={() => setIsNewFolderOpen(true)}
          onOpenVoiceMemo={() => setIsVoiceMemoOpen(true)}
        />
      </div>

      {/* 2. Main Drive Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950/40 relative">
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
          <div className="fixed inset-0 bottom-[52px] z-10 bg-black md:static md:inset-auto md:bottom-auto md:z-auto md:flex-1 md:flex md:items-center md:justify-center md:overflow-hidden md:bg-zinc-950/60 md:p-6">
            <div className="w-full h-full md:max-w-[420px] md:h-[calc(100vh-6rem)] md:rounded-3xl overflow-hidden md:border md:border-white/10 md:shadow-2xl bg-black">
              <ReelsContainer />
            </div>
          </div>
        ) : (
          <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 pb-28 md:pb-8 no-scrollbar">
            {/* Multi-Selection Action Toolbar Overlay */}
            {selectedFileIds.length > 0 && (
              <div className="sticky top-0 z-30 mb-4">
                <DriveSelectionBar
                  selectedCount={selectedFileIds.length}
                  totalCount={files.length}
                  isAllSelected={selectedFileIds.length === files.length && files.length > 0}
                  onToggleSelectAll={handleToggleSelectAll}
                  onBulkDelete={() => setBulkDeleteTarget({ ids: selectedFileIds })}
                  onBulkMove={() => {
                    const targetItems = files.filter((f) => selectedFileIds.includes(f._id || f.id));
                    setMoveToTarget({ items: targetItems });
                  }}
                  onBulkShare={handleBulkShare}
                  onBulkDownload={handleBulkDownload}
                  onClearSelection={handleClearSelection}
                />
              </div>
            )}

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
                  onShareFolder={(target) => setShareFolderTarget(target)}
                  onFolderContextMenu={(e, folder, isCat) => {
                    handleContextMenu(e, folder, true);
                  }}
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
                      : currentNav === 'timeline'
                      ? 'Timeline (By Date)'
                      : currentNav === 'this-week'
                      ? 'Files from This Week'
                      : currentNav === 'this-month'
                      ? 'Files from This Month'
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

                <div className="flex items-center gap-2">
                  {selectedCategory !== 'All' && currentNav === 'all' && (
                    <button
                      onClick={() => setShareFolderTarget({ category: selectedCategory })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-xs font-semibold transition-colors cursor-pointer"
                      title={`Share #${selectedCategory} folder`}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share Folder</span>
                    </button>
                  )}

                  {currentFolder && (
                    <button
                      onClick={handleResetToRoot}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                    >
                      ← Back to My Drive
                    </button>
                  )}
                </div>
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
                      {currentNav === 'timeline'
                        ? 'Timeline is Empty'
                        : currentNav === 'this-week'
                        ? 'No Files This Week'
                        : currentNav === 'this-month'
                        ? 'No Files This Month'
                        : currentNav === 'starred'
                        ? 'No Starred Files'
                        : currentNav === 'trash'
                        ? 'Trash is Empty'
                        : searchQuery
                        ? 'No Files Found'
                        : 'No Files in this Folder'}
                    </h4>
                    <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                      {currentNav === 'timeline'
                        ? 'Upload media to see it organized chronologically by date.'
                        : currentNav === 'this-week'
                        ? 'Files you upload this week will automatically appear here.'
                        : currentNav === 'this-month'
                        ? 'Files you upload this month will automatically appear here.'
                        : currentNav === 'starred'
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
              ) : currentNav === 'trash' ? (
                /* Trash Recycle Bin View */
                <TrashView
                  items={files}
                  viewMode={viewMode}
                  onItemRestored={loadDriveItems}
                  onItemDeletedPermanently={loadDriveItems}
                  onTrashEmptied={loadDriveItems}
                />
              ) : currentNav === 'timeline' ? (
                /* Timeline View */
                <TimelineView
                  videos={files}
                  viewMode={viewMode}
                  onSelectVideo={handleSelectFile}
                  onDeleteVideo={handleDeleteFile}
                />
              ) : (
                /* Grid vs List View */
                viewMode === 'grid' ? (
                  <DriveFilesGrid
                    videos={files}
                    onSelectVideo={handleSelectFile}
                    onDeleteVideo={handleDeleteFile}
                    selectedFileIds={selectedFileIds}
                    onToggleSelect={handleToggleSelect}
                    focusedIndex={focusedIndex}
                    onContextMenu={handleContextMenu}
                    onRenameVideo={handleRenameFile}
                    onMoveVideo={(file) => setMoveToTarget({ items: [file] })}
                    onShareVideo={(file) => setSingleShareTarget(file)}
                  />
                ) : (
                  <DriveFilesList
                    videos={files}
                    onSelectVideo={handleSelectFile}
                    onDeleteVideo={handleDeleteFile}
                    selectedFileIds={selectedFileIds}
                    onToggleSelect={handleToggleSelect}
                    focusedIndex={focusedIndex}
                    onContextMenu={handleContextMenu}
                    onRenameVideo={handleRenameFile}
                    onMoveVideo={(file) => setMoveToTarget({ items: [file] })}
                    onShareVideo={(file) => setSingleShareTarget(file)}
                  />
                )
              )}

              {/* Infinite Scroll Sentinel & Loading Indicator */}
              <div ref={sentinelRef} className="py-6 flex flex-col items-center justify-center min-h-[48px]">
                {loadingMore && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/80 border border-white/10 text-cyan-400 text-xs font-semibold shadow-lg backdrop-blur-md animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading more files...</span>
                  </div>
                )}
                {!loadingMore && !hasMore && files.length > 24 && (
                  <span className="text-[11px] font-mono text-zinc-600">
                    All {totalCount || files.length} files loaded
                  </span>
                )}
              </div>
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
            setSelectedFileIds([]);
            setFocusedIndex(-1);
            if (nav !== 'all') {
              setSelectedCategory('All');
            }
          }}
        />
      </div>

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <DriveContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          isFolder={contextMenu.isFolder}
          selectedCount={contextMenu.selectedCount}
          onClose={() => setContextMenu(null)}
          onOpen={(target) => {
            if (contextMenu.isFolder) {
              if (target.isCategory) handleOpenCategory(target.category);
              else handleOpenFolder(target);
            } else {
              handleSelectFile(target);
            }
          }}
          onRename={(target) => {
            if (contextMenu.isFolder) {
              setRenameTarget(target);
            } else {
              // Trigger single rename modal or edit mode
              setRenameTarget(target);
            }
          }}
          onMove={(target) => {
            const targetItems = selectedFileIds.length > 1
              ? files.filter((f) => selectedFileIds.includes(f._id || f.id))
              : [target];
            setMoveToTarget({ items: targetItems });
          }}
          onShare={(target) => {
            if (contextMenu.isFolder) {
              setShareFolderTarget({ category: target.title || target.category, isFolder: true });
            } else {
              setSingleShareTarget(target);
            }
          }}
          onDownload={(target) => {
            if (selectedFileIds.length > 1) {
              handleBulkDownload();
            } else {
              const link = document.createElement('a');
              link.href = api.stream.getUrl(target._id || target.id, true);
              link.download = target.title || 'file';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          }}
          onDelete={(target) => {
            if (contextMenu.isFolder) {
              handleDeleteFolder(target._id || target.id);
            } else if (selectedFileIds.length > 1) {
              setBulkDeleteTarget({ ids: selectedFileIds });
            } else {
              handleDeleteFile(target._id || target.id);
            }
          }}
        />
      )}

      {/* Move to... Folder/Category Picker Modal */}
      {moveToTarget && (
        <MoveToModal
          isOpen={!!moveToTarget}
          onClose={() => setMoveToTarget(null)}
          targetItems={moveToTarget.items}
          folders={folders}
          categories={categoryFoldersList}
          currentFolder={currentFolder}
          currentCategory={selectedCategory}
          onMoveSuccess={handleExecuteBulkMove}
        />
      )}

      {/* Bulk Delete Modal */}
      {bulkDeleteTarget && (
        <BulkDeleteModal
          isOpen={!!bulkDeleteTarget}
          onClose={() => setBulkDeleteTarget(null)}
          count={bulkDeleteTarget.ids.length}
          onConfirm={handleExecuteBulkDelete}
          isPermanent={currentNav === 'trash'}
        />
      )}

      {/* Single File Share Modal */}
      {singleShareTarget && (
        <ShareModal
          isOpen={!!singleShareTarget}
          onClose={() => setSingleShareTarget(null)}
          target={singleShareTarget}
        />
      )}

      {/* Desktop Video/Media Playback Modal with Prev/Next Navigation */}
      <DesktopVideoModal
        video={modalPreviewState ? modalPreviewState.items[modalPreviewState.index] : null}
        items={modalPreviewState?.items || []}
        currentIndex={modalPreviewState?.index ?? 0}
        onIndexChange={(newIdx) => setModalPreviewState((prev) => (prev ? { ...prev, index: newIdx } : null))}
        onClose={() => setModalPreviewState(null)}
        onDelete={handleDeleteFile}
      />

      {/* Full-Screen Instagram-Style Photo Viewer */}
      {photoViewerState && (
        <PhotoViewer
          photo={photoViewerState.items[photoViewerState.index]}
          items={photoViewerState.items}
          currentIndex={photoViewerState.index}
          onIndexChange={(newIdx) =>
            setPhotoViewerState((prev) => (prev ? { ...prev, index: newIdx } : null))
          }
          onClose={() => setPhotoViewerState(null)}
          onDelete={handleDeleteFile}
        />
      )}

      {/* In-App Document / Spreadsheet / PDF Viewer Modal */}
      {docViewerState && (
        <DocumentViewerModal
          document={docViewerState.items[docViewerState.index]}
          items={docViewerState.items}
          currentIndex={docViewerState.index}
          onIndexChange={(newIdx) =>
            setDocViewerState((prev) => (prev ? { ...prev, index: newIdx } : null))
          }
          onClose={() => setDocViewerState(null)}
          onDelete={handleDeleteFile}
        />
      )}

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

      {/* In-App Camera / Video Recording Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        folderId={currentFolder?._id || null}
        folderTitle={currentFolder?.title || ''}
        category={selectedCategory}
      />

      {/* In-App Voice Recording Modal */}
      <VoiceMemoModal
        isOpen={isVoiceMemoOpen}
        onClose={() => setIsVoiceMemoOpen(false)}
        folderId={currentFolder?._id || null}
        folderTitle={currentFolder?.title || ''}
        category={selectedCategory}
      />

      {/* Category / Folder Share Modal */}
      <ShareModal
        isOpen={!!shareFolderTarget}
        onClose={() => setShareFolderTarget(null)}
        target={shareFolderTarget}
      />
    </div>
  );
};
