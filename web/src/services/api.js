/**
 * StreamVault Frontend API Client
 * TikTok / Instagram-Reels Style Video Streaming PWA
 */

const RAW_API_URL = import.meta.env.VITE_API_BASE_URL || '';
export const API_BASE_URL = RAW_API_URL.replace(/\/+$/, '');
const BASE_URL = API_BASE_URL ? `${API_BASE_URL}/api/v1` : '/api/v1';

const ACCESS_TOKEN_KEY = 'streamvault_access_token';
const REFRESH_TOKEN_KEY = 'streamvault_refresh_token';
const USER_KEY = 'streamvault_user';

// Persistent Access Token & in-memory cache
let inMemoryAccessToken = '';
try {
  inMemoryAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY) || '';
} catch {}

export const getAccessToken = () => {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  try {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY) || '';
    if (token) inMemoryAccessToken = token;
    return token;
  } catch {
    return '';
  }
};

export const setAccessToken = (token) => {
  inMemoryAccessToken = token || '';
  try {
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch {}
};

export const clearAccessToken = () => {
  inMemoryAccessToken = '';
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {}
};

// Backward compatibility helpers
export const getStoredToken = () => getAccessToken();
export const setStoredToken = (token) => setAccessToken(token);
export const removeStoredToken = () => clearAccessToken();

export const getStoredRefreshToken = () => {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

export const setStoredRefreshToken = (token) => {
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch {}
};

export const removeStoredRefreshToken = () => {
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {}
};

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredUser = (user) => {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
};

export const removeStoredUser = () => {
  try {
    localStorage.removeItem(USER_KEY);
  } catch {}
};

let refreshPromise = null;

async function request(path, options = {}) {
  const token = getAccessToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'bypass-tunnel-reminder': 'true',
    ...(options.headers || {}),
  };

  const url = `${BASE_URL}${path}`;
  let response = await fetch(url, {
    ...options,
    headers,
  });

  // Interceptor: If 401 Unauthorized, perform silent refresh and retry request
  if (response.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register') && !path.startsWith('/auth/refresh')) {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      try {
        if (!refreshPromise) {
          refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          })
            .then(async (r) => {
              if (!r.ok) {
                const errJson = await r.json().catch(() => null);
                throw new Error(errJson?.message || 'Refresh failed');
              }
              return r.json();
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const refreshData = await refreshPromise;
        if (refreshData?.accessToken) {
          setAccessToken(refreshData.accessToken);
          if (refreshData.refreshToken) {
            setStoredRefreshToken(refreshData.refreshToken);
          }

          // Retry the original failed request with the new access token
          const retryHeaders = {
            ...headers,
            Authorization: `Bearer ${refreshData.accessToken}`,
          };
          response = await fetch(url, {
            ...options,
            headers: retryHeaders,
          });
        }
      } catch (err) {
        console.warn('Silent token refresh failed:', err.message);
        clearAccessToken();
        removeStoredRefreshToken();
        removeStoredUser();
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || `HTTP error ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function uploadWithProgress(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const token = getAccessToken();

    const endpoint = `${BASE_URL}/videos/upload`;
    const url = endpoint;

    xhr.open('POST', url);
    xhr.setRequestHeader('bypass-tunnel-reminder', 'true');

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (onProgress && event.total > 0) {
        const rawPercent = (event.loaded / event.total) * 100;
        const clampedPercent = Math.min(99, Math.max(1, Math.round(rawPercent)));
        onProgress(clampedPercent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100);
        try {
          const res = JSON.parse(xhr.responseText);
          resolve(res);
        } catch {
          resolve({ message: 'Upload succeeded' });
        }
      } else {
        let errMessage = `Upload failed (${xhr.status})`;
        try {
          const json = JSON.parse(xhr.responseText);
          if (json.message) errMessage = json.message;
        } catch {}
        if (xhr.status === 413) {
          errMessage = 'File exceeds maximum upload limit.';
        } else if (xhr.status === 0 || xhr.status === 502 || xhr.status === 503 || xhr.status === 504) {
          errMessage = "Can't reach the server — check your connection or try again shortly";
        }
        reject(new Error(errMessage));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Can't reach the server — check your connection or try again shortly"));
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload timed out. File is too large or network is slow.'));
    };

    xhr.send(formData);
  });
}

export const api = {
  auth: {
    login: async (email, password) => {
      const data = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const token = data?.accessToken || data?.token;
      if (token) {
        setAccessToken(token);
        if (data.refreshToken) setStoredRefreshToken(data.refreshToken);
        if (data.user) setStoredUser(data.user);
      }
      return data;
    },

    register: async (username, email, password) => {
      const data = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });
      const token = data?.accessToken || data?.token;
      if (token) {
        setAccessToken(token);
        if (data.refreshToken) setStoredRefreshToken(data.refreshToken);
        if (data.user) setStoredUser(data.user);
      }
      return data;
    },

    refresh: async () => {
      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) return null;
      const data = await request('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
      if (data?.accessToken) {
        setAccessToken(data.accessToken);
        if (data.refreshToken) setStoredRefreshToken(data.refreshToken);
      }
      return data;
    },

    me: async () => {
      const data = await request('/auth/me');
      if (data?.user) {
        setStoredUser(data.user);
      }
      return data;
    },

    logout: async () => {
      const refreshToken = getStoredRefreshToken();
      try {
        if (refreshToken) {
          await request('/auth/logout', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
          });
        }
      } catch {}
      clearAccessToken();
      removeStoredRefreshToken();
      removeStoredUser();
    },

    // PIN lock APIs
    setPin: (pin) =>
      request('/auth/pin/set', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      }),

    verifyPin: (pin) =>
      request('/auth/pin/verify', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      }),

    removePin: (pin) =>
      request('/auth/pin/remove', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      }),

    // Biometric WebAuthn APIs
    biometric: {
      getRegisterOptions: () => request('/auth/biometric/register-options', { method: 'POST' }),
      verifyRegistration: (response, deviceLabel) =>
        request('/auth/biometric/register-verify', {
          method: 'POST',
          body: JSON.stringify({ response, deviceLabel }),
        }),
      getAuthOptions: () => request('/auth/biometric/auth-options', { method: 'POST' }),
      verifyAuth: (response) =>
        request('/auth/biometric/auth-verify', {
          method: 'POST',
          body: JSON.stringify({ response }),
        }),
      remove: () => request('/auth/biometric/remove', { method: 'POST' }),
    },
  },

  videos: {
    getFeed: async (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.category && params.category !== 'All') {
        queryParams.set('category', params.category);
      }
      if (params.cursor) {
        queryParams.set('cursor', params.cursor);
      }
      if (params.limit) {
        queryParams.set('limit', params.limit);
      }
      if (params.unlockedCategories) {
        queryParams.set('unlockedCategories', params.unlockedCategories);
      }
      return request(`/videos/feed?${queryParams.toString()}`);
    },

    list: async (params = {}) => {
      const queryParams = new URLSearchParams();
      queryParams.set('fileCategory', 'video');
      if (params.category && params.category !== 'All') {
        queryParams.set('category', params.category);
      }
      if (params.page) queryParams.set('page', params.page);
      if (params.limit) queryParams.set('limit', params.limit || '50');
      if (params.sort) queryParams.set('sort', params.sort);

      return request(`/videos?${queryParams.toString()}`);
    },

    search: async (q, category) => {
      const queryParams = new URLSearchParams();
      if (q) queryParams.set('q', q);
      queryParams.set('fileCategory', 'video');
      if (category && category !== 'All') queryParams.set('category', category);
      return request(`/media/search?${queryParams.toString()}`);
    },

    getCategories: async () => {
      try {
        const res = await request('/videos/categories');
        if (res?.categories && Array.isArray(res.categories)) {
          return res.categories;
        }
        const listRes = await request('/videos?fileCategory=video&limit=100');
        const items = listRes?.items || listRes?.videos || (Array.isArray(listRes) ? listRes : []);
        const categories = new Set();
        items.forEach((item) => {
          if (item.category && typeof item.category === 'string' && item.category.trim()) {
            categories.add(item.category.trim());
          }
        });
        return Array.from(categories);
      } catch (err) {
        console.warn('Failed to load categories:', err.message);
        return ['Trending', 'Music', 'Gaming', 'Tech', 'Comedy', 'Entertainment', 'Tutorials'];
      }
    },

    getLockedStatus: () => request('/videos/categories/locked-status'),

    lockCategory: (category) =>
      request(`/videos/categories/${encodeURIComponent(category)}/lock`, {
        method: 'POST',
      }),

    unlockCategory: (category) =>
      request(`/videos/categories/${encodeURIComponent(category)}/unlock`, {
        method: 'POST',
      }),

    get: (id) => request(`/videos/${id}`),

    getThumbnailUrl: (id) => (id ? `${BASE_URL}/videos/${id}/thumbnail` : ''),

    toggleLike: (id) => request(`/media/${id}/like`, { method: 'POST' }),

    upload: (formData, onProgress) => {
      return uploadWithProgress(formData, onProgress);
    },

    updateNote: (id, note) =>
      request(`/videos/${id}/note`, {
        method: 'PATCH',
        body: JSON.stringify({ note }),
      }),

    delete: (id) => request(`/videos/${id}`, { method: 'DELETE' }),
  },

  drive: {
    list: async (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.folderId) queryParams.set('folderId', params.folderId);
      if (params.category && params.category !== 'All') queryParams.set('category', params.category);
      if (params.fileCategory && params.fileCategory !== 'all') queryParams.set('fileCategory', params.fileCategory);
      if (params.filter) queryParams.set('filter', params.filter);
      if (params.sort) queryParams.set('sort', params.sort);
      if (params.limit) queryParams.set('limit', params.limit || '100');
      if (params.unlockedCategories) queryParams.set('unlockedCategories', params.unlockedCategories);

      return request(`/videos?${queryParams.toString()}`);
    },

    getLibrary: () => request('/videos/user/library'),

    createFolder: (title, parentFolderId = null) =>
      request('/videos/folder', {
        method: 'POST',
        body: JSON.stringify({ title, parentFolderId }),
      }),

    rename: (id, title) =>
      request(`/videos/${id}/rename`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      }),

    updateNote: (id, note) =>
      request(`/videos/${id}/note`, {
        method: 'PATCH',
        body: JSON.stringify({ note }),
      }),

    move: (id, targetFolderId) =>
      request(`/videos/${id}/move`, {
        method: 'PATCH',
        body: JSON.stringify({ targetFolderId }),
      }),

    trash: (id) =>
      request(`/videos/${id}/trash`, {
        method: 'POST',
      }),

    restore: (id) =>
      request(`/videos/${id}/restore`, {
        method: 'POST',
      }),

    delete: (id) =>
      request(`/videos/${id}`, {
        method: 'DELETE',
      }),

    emptyTrash: () =>
      request('/videos/trash/empty', {
        method: 'DELETE',
      }),
  },

  stream: {
    getUrl: (id, download = false) => {
      const token = getAccessToken();
      const base = `${BASE_URL}/stream/${id}`;
      const params = [];
      if (token) params.push(`token=${encodeURIComponent(token)}`);
      if (download) params.push('download=1');
      return params.length > 0 ? `${base}?${params.join('&')}` : base;
    },
  },

  share: {
    create: (fileId, durationHours = 24) =>
      request(`/share/create/${fileId}`, {
        method: 'POST',
        body: JSON.stringify({ durationHours }),
      }),
    getInfo: (token) => request(`/share/${token}/info`),
    revoke: (token) =>
      request(`/share/${token}`, {
        method: 'DELETE',
      }),
  },
};

export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatViews(num) {
  if (!num || num === 0) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function getFileKind(file) {
  const mime = (file?.mimeType || '').toLowerCase();
  const ext = (file?.extension || '').toLowerCase().replace(/^\./, '');
  const fileCategory = (file?.fileCategory || '').toLowerCase();
  const fileType = (file?.fileType || '').toLowerCase();

  const isVideo =
    fileType === 'video' ||
    fileCategory === 'video' ||
    mime.startsWith('video/') ||
    ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', '3gp', 'flv', 'ts'].includes(ext);

  const isImage =
    fileType === 'image' ||
    fileCategory === 'image' ||
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'tiff'].includes(ext);

  const isAudio =
    fileType === 'audio' ||
    fileCategory === 'audio' ||
    mime.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'wma'].includes(ext);

  return {
    isVideo,
    isImage,
    isAudio,
    isDocument: !isVideo && !isImage && !isAudio,
    extension: ext ? ext.toUpperCase() : (isVideo ? 'VIDEO' : isImage ? 'IMAGE' : isAudio ? 'AUDIO' : 'DOC'),
  };
}

export default api;
