import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const MediaContext = createContext(null);

export const MediaProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('All');
  const [mediaType, setMediaType] = useState('all'); // 'all' | 'image' | 'video'
  const [searchQuery, setSearchQuery] = useState('');
  const [library, setLibrary] = useState({ history: [], likes: [], uploads: [], playlists: [], stats: null });

  // Modal / Viewer States
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [lightboxState, setLightboxState] = useState({ isOpen: false, index: 0, items: [] });
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);

  // Fetch Media Items
  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      if (searchQuery.trim()) {
        const res = await api.media.search(searchQuery, category, mediaType);
        setItems(res?.items || []);
      } else {
        const res = await api.media.list({ category, mediaType, limit: 50 });
        setItems(res?.items || []);
      }
    } catch (err) {
      console.error('Failed to load media:', err);
    } finally {
      setLoading(false);
    }
  }, [category, mediaType, searchQuery]);

  // Fetch User Library (Likes, History, Stats)
  const fetchLibrary = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await api.media.getLibrary();
      if (data) {
        setLibrary(data);
      }
    } catch (err) {
      console.warn('Library load note:', err.message);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchLibrary();
    }
  }, [isAuthenticated, fetchLibrary]);

  // Actions
  const toggleLike = async (mediaId) => {
    try {
      const res = await api.media.toggleLike(mediaId);
      // Refresh library likes
      fetchLibrary();
      return res?.liked;
    } catch (err) {
      console.error('Like toggle error:', err);
      throw err;
    }
  };

  const deleteMediaItem = async (mediaId) => {
    try {
      await api.media.delete(mediaId);
      setItems((prev) => prev.filter((item) => item._id !== mediaId));
      fetchLibrary();
    } catch (err) {
      console.error('Delete media error:', err);
      throw err;
    }
  };

  // Lightbox handlers
  const openLightbox = (clickedItem, imageList) => {
    const list = imageList || items.filter((i) => i.mediaType === 'image');
    const idx = list.findIndex((i) => i._id === clickedItem._id);
    setLightboxState({
      isOpen: true,
      index: idx >= 0 ? idx : 0,
      items: list.length > 0 ? list : [clickedItem],
    });
  };

  const closeLightbox = () => {
    setLightboxState({ isOpen: false, index: 0, items: [] });
  };

  return (
    <MediaContext.Provider
      value={{
        items,
        loading,
        category,
        setCategory,
        mediaType,
        setMediaType,
        searchQuery,
        setSearchQuery,
        library,
        fetchMedia,
        fetchLibrary,
        toggleLike,
        deleteMediaItem,
        uploadModalOpen,
        setUploadModalOpen,
        selectedVideo,
        setSelectedVideo,
        lightboxState,
        openLightbox,
        closeLightbox,
        collectionModalOpen,
        setCollectionModalOpen,
      }}
    >
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = () => {
  const context = useContext(MediaContext);
  if (!context) {
    throw new Error('useMedia must be used within a MediaProvider');
  }
  return context;
};
