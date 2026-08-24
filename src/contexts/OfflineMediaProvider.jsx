import React, { useState, useEffect, useCallback } from 'react';
import { OfflineMediaContext } from './OfflineMediaContext.js';
import {
  getOfflineVideosList,
  cacheVideoOffline,
  removeVideoFromOffline,
  clearAllOfflineCache,
  getOfflineVideoPlaybackUrl,
  getTotalOfflineStorageUsed,
} from '../services/offlineMediaService.js';

export const OfflineMediaProvider = ({ children }) => {
  const [offlineList, setOfflineList] = useState(getOfflineVideosList());
  const [cachingIds, setCachingIds] = useState(new Set());
  const [storageUsed, setStorageUsed] = useState(getTotalOfflineStorageUsed());

  const refreshList = useCallback(() => {
    const list = getOfflineVideosList();
    setOfflineList(list);
    setStorageUsed(getTotalOfflineStorageUsed());
  }, []);

  const isOfflineAvailable = useCallback(
    (videoId) => {
      if (!videoId) return false;
      return offlineList.some((item) => (item._id || item.id) === videoId);
    },
    [offlineList]
  );

  const toggleOfflineSave = useCallback(
    async (video) => {
      const videoId = video._id || video.id;
      if (!videoId) return;

      if (isOfflineAvailable(videoId)) {
        await removeVideoFromOffline(videoId);
        refreshList();
      } else {
        setCachingIds((prev) => new Set(prev).add(videoId));
        try {
          await cacheVideoOffline(video);
          refreshList();
        } catch (err) {
          alert(err.message || 'Failed to save video for offline playback.');
        } finally {
          setCachingIds((prev) => {
            const next = new Set(prev);
            next.delete(videoId);
            return next;
          });
        }
      }
    },
    [isOfflineAvailable, refreshList]
  );

  const clearCache = useCallback(async () => {
    await clearAllOfflineCache();
    refreshList();
  }, [refreshList]);

  return (
    <OfflineMediaContext.Provider
      value={{
        offlineList,
        isOfflineAvailable,
        toggleOfflineSave,
        isCaching: (id) => cachingIds.has(id),
        storageUsed,
        clearCache,
        getOfflinePlaybackUrl: getOfflineVideoPlaybackUrl,
      }}
    >
      {children}
    </OfflineMediaContext.Provider>
  );
};
