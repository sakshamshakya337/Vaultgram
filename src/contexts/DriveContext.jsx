import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const DriveContext = createContext(null);

export const DriveProvider = ({ children }) => {
  // Navigation & View States
  const [activeSection, setActiveSection] = useState('my-drive'); // my-drive, starred, recent, trash, type-filter
  const [currentFolderId, setCurrentFolderId] = useState(null); // null = root My Drive
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: 'root', title: 'My Cloud' }]);
  const [viewMode, setViewMode] = useState(localStorage.getItem('drive_view_mode') || 'grid'); // 'grid' | 'list'
  const [searchQuery, setSearchQuery] = useState('');
  const [fileCategory, setFileCategory] = useState('all');
  const [sortOption, setSortOption] = useState('newest');

  // Data States
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  // Inspector & Selection
  const [selectedItem, setSelectedItem] = useState(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  // Modals & Viewers
  const [previewItem, setPreviewItem] = useState(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);

  // Floating Upload Manager Queue
  const [uploadQueue, setUploadQueue] = useState([]);
  const [isUploadManagerMinimized, setIsUploadManagerMinimized] = useState(false);

  // Navigation dispatcher
  const setSection = (newSection, folderId = null, category = 'all') => {
    setActiveSection(newSection);
    setCurrentFolderId(folderId);
    setFileCategory(category);
    setSearchQuery('');
    setSelectedItem(null);
    if (!folderId) {
      const titles = {
        'starred': 'Starred',
        'recent': 'Recent',
        'trash': 'Trash',
        'type-filter': 'Filtered Files',
      };
      setBreadcrumbs([{ id: 'root', title: titles[newSection] || 'My Cloud' }]);
    }
  };

  const navigateToFolder = (folderId) => {
    setSection('my-drive', folderId);
  };

  // Load drive items
  const loadDrive = useCallback(async () => {
    setLoading(true);
    try {
      if (searchQuery.trim()) {
        const res = await api.drive.search(searchQuery, fileCategory);
        setItems(res?.items || []);
      } else {
        const res = await api.drive.list({
          filter: activeSection,
          folderId: currentFolderId,
          fileCategory,
          sort: sortOption,
          limit: 100,
        });
        setItems(res?.items || []);
        if (res?.breadcrumbs) {
          setBreadcrumbs(res.breadcrumbs);
        }
      }
    } catch (err) {
      console.error('Failed to load drive:', err);
    } finally {
      setLoading(false);
    }
  }, [activeSection, currentFolderId, fileCategory, sortOption, searchQuery]);

  // Load storage metrics
  const loadStats = useCallback(async () => {
    try {
      const res = await api.drive.getLibrary();
      if (res?.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.warn('Drive stats note:', err.message);
    }
  }, []);

  useEffect(() => {
    loadDrive();
  }, [loadDrive]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // File & Folder Operations
  const createFolder = async (title) => {
    const folder = await api.drive.createFolder(title, currentFolderId);
    loadDrive();
    loadStats();
    return folder;
  };

  const rename = async (id, title) => {
    const updated = await api.drive.rename(id, title);
    setItems((prev) => prev.map((item) => (item._id === id ? { ...item, title: updated.title } : item)));
    if (selectedItem?._id === id) {
      setSelectedItem((prev) => ({ ...prev, title: updated.title }));
    }
    return updated;
  };

  const move = async (id, targetFolderId) => {
    const updated = await api.drive.move(id, targetFolderId);
    loadDrive();
    loadStats();
    return updated;
  };

  const toggleStar = async (id) => {
    const res = await api.drive.toggleStar(id);
    setItems((prev) =>
      prev.map((item) => (item._id === id ? { ...item, isStarred: res.isStarred } : item))
    );
    if (selectedItem?._id === id) {
      setSelectedItem((prev) => ({ ...prev, isStarred: res.isStarred }));
    }
    loadStats();
    return res.isStarred;
  };

  const trashOrDelete = async (id) => {
    const res = await api.drive.trash(id);
    setItems((prev) => prev.filter((item) => item._id !== id));
    if (selectedItem?._id === id) setSelectedItem(null);
    loadStats();
    return res;
  };

  const restoreTrash = async (id) => {
    const res = await api.drive.restore(id);
    setItems((prev) => prev.filter((item) => item._id !== id));
    loadStats();
    return res;
  };

  const emptyTrash = async () => {
    await api.drive.emptyTrash();
    setItems([]);
    setSelectedItem(null);
    loadStats();
  };

  // Upload Queue Handler
  const enqueueUpload = (files) => {
    if (!files || files.length === 0) return;

    const newTasks = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      progress: 0,
      status: 'pending',
      error: null,
      folderId: currentFolderId,
    }));

    setUploadQueue((prev) => [...prev, ...newTasks]);
    setIsUploadManagerMinimized(false);
  };

  // Upload Worker Effect
  useEffect(() => {
    const nextTask = uploadQueue.find((t) => t.status === 'pending');
    if (!nextTask) return;

    setUploadQueue((prev) =>
      prev.map((t) => (t.id === nextTask.id ? { ...t, status: 'uploading' } : t))
    );

    const formData = new FormData();
    formData.append('file', nextTask.file);
    formData.append('title', nextTask.file.name);
    if (nextTask.folderId) {
      formData.append('folderId', nextTask.folderId);
    }

    api.drive
      .upload(formData, (percent) => {
        setUploadQueue((prev) =>
          prev.map((t) => (t.id === nextTask.id ? { ...t, progress: percent } : t))
        );
      })
      .then(() => {
        setUploadQueue((prev) =>
          prev.map((t) =>
            t.id === nextTask.id ? { ...t, progress: 100, status: 'completed' } : t
          )
        );
        loadDrive();
        loadStats();
      })
      .catch((err) => {
        setUploadQueue((prev) =>
          prev.map((t) =>
            t.id === nextTask.id ? { ...t, status: 'error', error: err.message } : t
          )
        );
      });
  }, [uploadQueue, loadDrive, loadStats]);

  const clearCompletedUploads = () => {
    setUploadQueue((prev) => prev.filter((t) => t.status === 'uploading' || t.status === 'pending'));
  };

  return (
    <DriveContext.Provider
      value={{
        activeSection,
        setSection,
        currentFolderId,
        navigateToFolder,
        breadcrumbs,
        viewMode,
        setViewMode,
        searchQuery,
        setSearchQuery,
        fileCategory,
        setFileCategory,
        sortOption,
        setSortOption,
        items,
        loading,
        stats,
        loadDrive,
        loadStats,
        selectedItem,
        setSelectedItem,
        isInspectorOpen,
        setIsInspectorOpen,
        previewItem,
        setPreviewItem,
        newFolderOpen,
        setNewFolderOpen,
        renameTarget,
        setRenameTarget,
        moveTarget,
        setMoveTarget,
        createFolder,
        rename,
        move,
        toggleStar,
        trashOrDelete,
        restoreTrash,
        emptyTrash,
        uploadQueue,
        enqueueUpload,
        clearCompletedUploads,
        isUploadManagerMinimized,
        setIsUploadManagerMinimized,
      }}
    >
      {children}
    </DriveContext.Provider>
  );
};

export const useDrive = () => {
  const context = useContext(DriveContext);
  if (!context) {
    throw new Error('useDrive must be used within a DriveProvider');
  }
  return context;
};
