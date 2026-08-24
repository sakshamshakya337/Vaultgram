import { api } from './api';

const OFFLINE_CACHE_NAME = 'streamvault-offline-media-v1';
const OFFLINE_STORAGE_KEY = 'vaultgram_offline_videos_list';

/**
 * Get stored offline videos metadata list from localStorage
 */
export function getOfflineVideosList() {
  try {
    const raw = localStorage.getItem(OFFLINE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save offline videos metadata list to localStorage
 */
function setOfflineVideosList(list) {
  try {
    localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to save offline videos list:', err);
  }
}

/**
 * Check if a video is stored in Cache API
 */
export async function isVideoCachedOffline(videoId) {
  if (!videoId || typeof window === 'undefined' || !('caches' in window)) return false;
  try {
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    const streamUrl = api.stream.getUrl(videoId);
    const match = await cache.match(streamUrl);
    return !!match;
  } catch {
    return false;
  }
}

/**
 * Cache video stream response for offline playback
 */
export async function cacheVideoOffline(video, onProgress) {
  const videoId = video._id || video.id;
  if (!videoId || !('caches' in window)) {
    throw new Error('Offline caching is not supported in this browser.');
  }

  const streamUrl = api.stream.getUrl(videoId);
  const cache = await caches.open(OFFLINE_CACHE_NAME);

  // Fetch the full stream
  const response = await fetch(streamUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch video for offline storage (Status: ${response.status})`);
  }

  // Clone and put into Cache API
  const responseToCache = response.clone();
  await cache.put(streamUrl, responseToCache);

  // Save metadata
  const list = getOfflineVideosList();
  const existingIndex = list.findIndex((item) => (item._id || item.id) === videoId);
  const newItem = {
    _id: videoId,
    id: videoId,
    title: video.title || 'Untitled Video',
    category: video.category || 'General',
    duration: video.duration || 0,
    fileSizeBytes: video.fileSizeBytes || 0,
    cachedAt: new Date().toISOString(),
    thumbnail: video.thumbnail || '',
  };

  if (existingIndex >= 0) {
    list[existingIndex] = newItem;
  } else {
    list.push(newItem);
  }
  setOfflineVideosList(list);

  return true;
}

/**
 * Remove cached video from Cache API and localStorage
 */
export async function removeVideoFromOffline(videoId) {
  if (!videoId || !('caches' in window)) return;
  try {
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    const streamUrl = api.stream.getUrl(videoId);
    await cache.delete(streamUrl);
  } catch (err) {
    console.warn('Cache delete error:', err);
  }

  const list = getOfflineVideosList().filter((v) => (v._id || v.id) !== videoId);
  setOfflineVideosList(list);
}

/**
 * Get offline cached video Object URL for video player
 */
export async function getOfflineVideoPlaybackUrl(videoId) {
  if (!videoId || !('caches' in window)) return null;
  try {
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    const streamUrl = api.stream.getUrl(videoId);
    const match = await cache.match(streamUrl);
    if (match) {
      const blob = await match.blob();
      return URL.createObjectURL(blob);
    }
  } catch (err) {
    console.warn('Error reading offline video from cache:', err);
  }
  return null;
}

/**
 * Clear all offline cached videos
 */
export async function clearAllOfflineCache() {
  if ('caches' in window) {
    try {
      await caches.delete(OFFLINE_CACHE_NAME);
    } catch (err) {
      console.warn('Error deleting offline cache:', err);
    }
  }
  localStorage.removeItem(OFFLINE_STORAGE_KEY);
}

/**
 * Calculate total storage used by offline cached files
 */
export function getTotalOfflineStorageUsed() {
  const list = getOfflineVideosList();
  return list.reduce((total, item) => total + (item.fileSizeBytes || 0), 0);
}
