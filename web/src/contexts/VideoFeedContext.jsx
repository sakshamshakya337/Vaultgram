import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const VideoFeedContext = createContext(null);

export const VideoFeedProvider = ({ children }) => {
  const { user, hasPin } = useAuth();

  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState(['All']);
  const [lockedCategories, setLockedCategories] = useState([]);

  // Session-only unlocked categories (never persisted)
  const [sessionUnlockedCategories, setSessionUnlockedCategories] = useState(new Set());
  const [categoryLockTarget, setCategoryLockTarget] = useState(null);

  // App Lock State (PIN required on start / app visibility change if user has PIN set)
  const [isAppLocked, setIsAppLocked] = useState(hasPin);

  // Sync app lock state with user PIN configuration
  useEffect(() => {
    if (hasPin) {
      setIsAppLocked(true);
    } else {
      setIsAppLocked(false);
    }
  }, [hasPin]);

  // Page Visibility API: re-lock app on tab return if PIN is set
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && hasPin) {
        setIsAppLocked(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [hasPin]);

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

  // Generation & category tracking to prevent race conditions during category switches
  const requestGenRef = useRef(0);
  const currentCategoryRef = useRef(selectedCategory);

  // Keep ref in sync
  useEffect(() => {
    currentCategoryRef.current = selectedCategory;
  }, [selectedCategory]);

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

  // Fetch categories and locked status from API
  const fetchCategories = useCallback(async () => {
    try {
      const distinct = await api.videos.getCategories();
      const set = new Set(['All']);
      distinct.forEach((c) => {
        if (c && c.trim()) set.add(c.trim());
      });
      setCategories(Array.from(set));

      // Fetch user's locked categories
      const statusRes = await api.videos.getLockedStatus().catch(() => null);
      if (statusRes?.lockedCategories) {
        setLockedCategories(statusRes.lockedCategories);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, []);

  // Fetch initial videos for category with generation tracking
  const fetchVideos = useCallback(async (cat = selectedCategory) => {
    const gen = ++requestGenRef.current;
    currentCategoryRef.current = cat;

    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setNextCursor(null);
    setHasMore(false);
    setActiveVideoIndex(0);

    try {
      const res = await api.videos.getFeed({
        category: cat,
        limit: 10,
      });

      // Ignore response if category changed while request was in-flight
      if (gen !== requestGenRef.current) return;

      const rawList = res?.items || (Array.isArray(res) ? res : []);
      setVideos(rawList);
      setNextCursor(res?.nextCursor || null);
      setHasMore(!!res?.hasMore);
      setActiveVideoIndex(0);
    } catch (err) {
      if (gen !== requestGenRef.current) return;
      console.warn('API fetch feed warning:', err.message);
      setError(err.message);
    } finally {
      if (gen === requestGenRef.current) {
        setLoading(false);
      }
    }
  }, [selectedCategory]);

  // Infinite scroll load more with cursor bound to current category generation
  const loadMoreVideos = useCallback(async () => {
    const gen = requestGenRef.current;
    const targetCategory = currentCategoryRef.current;
    const targetCursor = nextCursor;

    if (loading || loadingMore || !hasMore || !targetCursor) return;

    setLoadingMore(true);
    try {
      const res = await api.videos.getFeed({
        category: targetCategory,
        cursor: targetCursor,
        limit: 10,
      });

      // Discard stale responses from older generations or switched categories
      if (gen !== requestGenRef.current || targetCategory !== currentCategoryRef.current) {
        return;
      }

      const newItems = res?.items || [];
      if (newItems.length > 0) {
        setVideos((prev) => {
          const existingIds = new Set(prev.map((v) => v._id || v.id));
          const filtered = newItems.filter((v) => !existingIds.has(v._id || v.id));
          return [...prev, ...filtered];
        });
      }
      setNextCursor(res?.nextCursor || null);
      setHasMore(!!res?.hasMore);
    } catch (err) {
      if (gen !== requestGenRef.current) return;
      console.warn('Load more reels error:', err.message);
    } finally {
      if (gen === requestGenRef.current) {
        setLoadingMore(false);
      }
    }
  }, [loading, loadingMore, hasMore, nextCursor]);

  // Automatically trigger loadMore when scrolling close to bottom of current valid feed
  useEffect(() => {
    if (!loading && !loadingMore && hasMore && videos.length > 0 && activeVideoIndex >= videos.length - 3) {
      loadMoreVideos();
    }
  }, [activeVideoIndex, videos.length, hasMore, loading, loadingMore, loadMoreVideos]);

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

  // Category selection handler with PIN protection check
  const requestCategory = useCallback(
    (cat) => {
      const isLocked = lockedCategories.some((lc) => lc.toLowerCase() === cat.toLowerCase());
      const isUnlockedThisSession = sessionUnlockedCategories.has(cat.toLowerCase());

      if (isLocked && !isUnlockedThisSession && hasPin) {
        // Trigger category PIN modal
        setCategoryLockTarget(cat);
      } else {
        setSelectedCategory(cat);
      }
    },
    [lockedCategories, sessionUnlockedCategories, hasPin]
  );

  // Unlock category for the current session
  const unlockCategoryForSession = useCallback((cat) => {
    setSessionUnlockedCategories((prev) => {
      const next = new Set(prev);
      next.add(cat.toLowerCase());
      return next;
    });
    setSelectedCategory(cat);
  }, []);

  // Lock / Unlock category toggle
  const toggleCategoryLock = useCallback(
    async (cat) => {
      const isCurrentlyLocked = lockedCategories.some((lc) => lc.toLowerCase() === cat.toLowerCase());
      if (isCurrentlyLocked) {
        const res = await api.videos.unlockCategory(cat);
        setLockedCategories(res?.lockedCategories || []);
      } else {
        const res = await api.videos.lockCategory(cat);
        setLockedCategories(res?.lockedCategories || []);
      }
    },
    [lockedCategories]
  );

  // Optimistic like toggle
  const toggleLike = useCallback(async (id) => {
    setVideos((prev) =>
      prev.map((v) => {
        if (v._id === id || v.id === id) {
          const isStarred = !v.isStarred;
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
        loadingMore,
        hasMore,
        error,
        selectedCategory,
        setSelectedCategory,
        requestCategory,
        categories,
        lockedCategories,
        toggleCategoryLock,
        sessionUnlockedCategories,
        unlockCategoryForSession,
        categoryLockTarget,
        setCategoryLockTarget,
        isAppLocked,
        setIsAppLocked,
        fetchCategories,
        fetchVideos,
        loadMoreVideos,
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
