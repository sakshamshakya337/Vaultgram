/**
 * Google Drive Platform Frontend API Client
 */

const BASE_URL = '/api/v1';

const TOKEN_KEY = 'personal_storage_token';
const USER_KEY = 'personal_storage_user';

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY) || '';
export const setStoredToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const removeStoredToken = () => localStorage.removeItem(TOKEN_KEY);

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
export const setStoredUser = (user) => localStorage.setItem(USER_KEY, JSON.stringify(user));
export const removeStoredUser = () => localStorage.removeItem(USER_KEY);

async function request(path, options = {}) {
  const token = getStoredToken();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'bypass-tunnel-reminder': 'true',
    ...(options.headers || {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, {
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

    const url = token
      ? `${BASE_URL}/media/upload?token=${encodeURIComponent(token)}`
      : `${BASE_URL}/media/upload`;

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

  drive: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/media${qs ? `?${qs}` : ''}`);
    },
    get: (id) => request(`/media/${id}`),
    search: (q, fileCategory, category) => {
      const params = {};
      if (q) params.q = q;
      if (fileCategory && fileCategory !== 'all') params.fileCategory = fileCategory;
      if (category && category !== 'All') params.category = category;
      const qs = new URLSearchParams(params).toString();
      return request(`/media/search?${qs}`);
    },
    upload: (formData, onProgress) => {
      return uploadWithProgress(formData, onProgress);
    },
    createFolder: (title, folderId) =>
      request('/media/folder', {
        method: 'POST',
        body: JSON.stringify({ title, folderId }),
      }),
    rename: (id, title) =>
      request(`/media/${id}/rename`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      }),
    move: (id, targetFolderId) =>
      request(`/media/${id}/move`, {
        method: 'PATCH',
        body: JSON.stringify({ targetFolderId }),
      }),
    toggleStar: (id) => request(`/media/${id}/star`, { method: 'POST' }),
    trash: (id) => request(`/media/${id}/trash`, { method: 'POST' }),
    restore: (id) => request(`/media/${id}/restore`, { method: 'POST' }),
    emptyTrash: () => request('/media/trash/empty', { method: 'DELETE' }),
    getFolders: () => request('/media/folders'),
    getLibrary: () => request('/media/user/library'),
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

  // Backward compatibility alias
  media: {
    list: (params) => api.drive.list(params),
    get: (id) => api.drive.get(id),
    upload: (formData, onProgress) => api.drive.upload(formData, onProgress),
    delete: (id) => api.drive.trash(id),
    toggleLike: (id) => api.drive.toggleStar(id),
    getLibrary: () => api.drive.getLibrary(),
  },
};

export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

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

export function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export default api;
