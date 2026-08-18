/**
 * StreamVault Frontend API Client
 * TikTok / Instagram-Reels Style Video Streaming PWA
 */

const RAW_API_URL = import.meta.env.VITE_API_BASE_URL || '';
export const API_BASE_URL = RAW_API_URL.replace(/\/+$/, '');
const BASE_URL = API_BASE_URL ? `${API_BASE_URL}/api/v1` : '/api/v1';

const TOKEN_KEY = 'streamvault_token';
const USER_KEY = 'streamvault_user';

export const getStoredToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

export const setStoredToken = (token) => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {}
};

export const removeStoredToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
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

async function request(path, options = {}) {
  const token = getStoredToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'bypass-tunnel-reminder': 'true',
    ...(options.headers || {}),
  };

  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || `HTTP error ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export function uploadWithProgress(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const token = getStoredToken();

    const endpoint = `${BASE_URL}/videos/upload`;
    const url = token
      ? `${endpoint}?token=${encodeURIComponent(token)}`
      : endpoint;

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
          const json = JSON.parse(xhr.responseText);
          resolve(json);
        } catch {
          resolve(xhr.responseText);
        }
      } else {
        try {
          const json = JSON.parse(xhr.responseText);
          reject(new Error(json.message || `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network connection error during upload.'));
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
      if (data?.token) {
        setStoredToken(data.token);
        setStoredUser(data.user);
      }
      return data;
    },
    register: async (username, email, password) => {
      const data = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });
      if (data?.token) {
        setStoredToken(data.token);
        setStoredUser(data.user);
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
    logout: () => {
      removeStoredToken();
      removeStoredUser();
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

    getCategories: async () => {
      try {
        const res = await request('/videos/categories');
        if (res?.categories && Array.isArray(res.categories)) {
          return res.categories;
        }
        // Fallback
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

    get: (id) => request(`/videos/${id}`),

    toggleLike: (id) => request(`/media/${id}/like`, { method: 'POST' }),

    upload: (formData, onProgress) => {
      return uploadWithProgress(formData, onProgress);
    },
  },

  stream: {
    getUrl: (id, download = false) => {
      const token = getStoredToken();
      const base = `${BASE_URL}/stream/${id}`;
      const params = [];
      if (token) params.push(`token=${encodeURIComponent(token)}`);
      if (download) params.push('download=1');
      return params.length > 0 ? `${base}?${params.join('&')}` : base;
    },
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

export default api;
