import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const VideoFeedContext = createContext(null);

export const VideoFeedProvider = ({ children }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState(['All']);
  
  // Audio Autoplay: Starts muted, unlocked on first interaction
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [hasShownAudioHint, setHasShownAudioHint] = useState(false);
  
  // Active reel index currently in view
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  
  // Modal states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  // Detect iOS Safari for custom install banner
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  // Listen for PWA install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Fetch categories from API
  const fetchCategories = useCallback(async () => {
    try {
      const distinct = await api.videos.getCategories();
      const set = new Set(['All']);
      distinct.forEach((c) => {
        if (c && c.trim()) set.add(c.trim());
      });
      setCategories(Array.from(set));
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, []);

  // Fetch videos for current category
  const fetchVideos = useCallback(async (cat = selectedCategory) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.videos.list({
        category: cat,
        limit: 50,
      });
      const rawList = res?.items || res?.videos || (Array.isArray(res) ? res : []);
      
      // If no videos exist in backend yet, provide high quality demo reels so the feed works out-of-the-box
      if (!rawList || rawList.length === 0) {
        setVideos([]);
      } else {
        setVideos(rawList);
      }
    } catch (err) {
      console.warn('API fetch warning:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchVideos(selectedCategory);
  }, [selectedCategory, fetchVideos]);

  // Audio unlock trigger on first user interaction
  const unlockAudio = useCallback(() => {
    if (!isAudioUnlocked) {
      setIsAudioUnlocked(true);
      setHasShownAudioHint(true);
    }
  }, [isAudioUnlocked]);

  // Optimistic like toggle
  const toggleLike = useCallback(async (id) => {
    setVideos((prev) =>
      prev.map((v) => {
        if (v._id === id || v.id === id) {
          const isStarred = !v.isStarred;
          const views = v.views || 0;
          return {
            ...v,
            isStarred,
            likesCount: (v.likesCount || 0) + (isStarred ? 1 : -1),
          };
        }
        return v;
      })
    );

    try {
      await api.videos.toggleLike(id);
    } catch (err) {
      console.error('Failed to toggle like on backend:', err);
    }
  }, []);

  const triggerInstall = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
        setDeferredInstallPrompt(null);
      }
    } else {
      setIsInstallModalOpen(true);
    }
  };

  return (
    <VideoFeedContext.Provider
      value={{
        videos,
        setVideos,
        loading,
        error,
        selectedCategory,
        setSelectedCategory,
        categories,
        fetchCategories,
        fetchVideos,
        isAudioUnlocked,
        setIsAudioUnlocked,
        unlockAudio,
        hasShownAudioHint,
        setHasShownAudioHint,
        activeVideoIndex,
        setActiveVideoIndex,
        toggleLike,
        isUploadOpen,
        setIsUploadOpen,
        isAuthOpen,
        setIsAuthOpen,
        isInstallModalOpen,
        setIsInstallModalOpen,
        isInstallable,
        isIOS,
        triggerInstall,
      }}
    >
      {children}
    </VideoFeedContext.Provider>
  );
};

export const useVideoFeed = () => {
  const context = useContext(VideoFeedContext);
  if (!context) {
    throw new Error('useVideoFeed must be used within a VideoFeedProvider');
  }
  return context;
};
