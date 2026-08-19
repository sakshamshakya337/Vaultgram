import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getAccessToken, API_BASE_URL } from '../services/api';

const BASE_URL = API_BASE_URL ? `${API_BASE_URL}/api/v1` : '/api/v1';

// Configurable upload size limits matching backend settings
export const MAX_VIDEO_UPLOAD_SIZE_MB = parseInt(import.meta.env.VITE_MAX_VIDEO_UPLOAD_SIZE_MB, 10) || 200;
export const MAX_NON_VIDEO_UPLOAD_SIZE_MB = parseInt(import.meta.env.VITE_MAX_NON_VIDEO_UPLOAD_SIZE_MB, 10) || 20;

const MAX_VIDEO_BYTES = MAX_VIDEO_UPLOAD_SIZE_MB * 1024 * 1024;
const MAX_NON_VIDEO_BYTES = MAX_NON_VIDEO_UPLOAD_SIZE_MB * 1024 * 1024;

export const UploadContext = createContext(null);

export const UploadProvider = ({ children }) => {
  const [uploadQueue, setUploadQueue] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [isTrayMinimized, setIsTrayMinimized] = useState(false);

  // Category prompt state when dropping/selecting at root
  const [categoryPrompt, setCategoryPrompt] = useState({
    isOpen: false,
    files: [],
    targetFolder: null,
  });

  // Target destination when opening file picker via "+ Upload" button
  const filePickerTargetRef = useRef({ folderId: null, folderTitle: '', category: 'General', isRoot: false });
  const fileInputRef = useRef(null);

  // Listeners to notify components (e.g. DriveLayout) when an upload succeeds
  const onUploadSuccessListenersRef = useRef(new Set());
  const activeXhrRef = useRef(null);
  const currentProcessingIdRef = useRef(null);

  const registerOnUploadSuccess = useCallback((callback) => {
    onUploadSuccessListenersRef.current.add(callback);
    return () => {
      onUploadSuccessListenersRef.current.delete(callback);
    };
  }, []);

  const notifyUploadSuccess = useCallback((result) => {
    onUploadSuccessListenersRef.current.forEach((cb) => {
      try {
        cb(result);
      } catch (err) {
        console.error('Error in onUploadSuccess listener:', err);
      }
    });
  }, []);

  // Helper to determine file icon category
  const detectFileTypeCategory = (file) => {
    const type = file.type || '';
    const name = file.name || '';
    if (type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|3gp|m4v|flv|ts)$/i.test(name)) return 'video';
    if (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(name)) return 'image';
    if (type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|wma)$/i.test(name)) return 'audio';
    if (type.includes('pdf') || /\.(pdf)$/i.test(name)) return 'pdf';
    if (type.includes('word') || type.includes('document') || /\.(doc|docx|txt|rtf|odt|md)$/i.test(name)) return 'document';
    if (type.includes('sheet') || type.includes('excel') || /\.(xls|xlsx|csv)$/i.test(name)) return 'spreadsheet';
    return 'document';
  };

  /**
   * Add files to upload queue with client-side validation
   */
  const addToQueue = useCallback((files, { folderId = null, folderTitle = '', category = 'General' } = {}) => {
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const newItems = fileList.map((file) => {
      const id = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const fileTypeCategory = detectFileTypeCategory(file);
      const isVideo = fileTypeCategory === 'video' || (file.type && file.type.startsWith('video/'));

      // Validate against the original-size limit (200MB default for video, 20MB for non-video)
      const maxLimitBytes = isVideo ? MAX_VIDEO_BYTES : MAX_NON_VIDEO_BYTES;
      const maxLimitMb = isVideo ? MAX_VIDEO_UPLOAD_SIZE_MB : MAX_NON_VIDEO_UPLOAD_SIZE_MB;
      const isTooLarge = file.size > maxLimitBytes;
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);

      let initialStatus = 'queued';
      let initialError = null;

      if (isTooLarge) {
        initialStatus = 'error';
        initialError = isVideo
          ? `Video exceeds ${maxLimitMb}MB limit (${sizeMb} MB)`
          : `File exceeds ${maxLimitMb}MB limit (${sizeMb} MB)`;
      }

      return {
        id,
        file,
        fileName: file.name,
        fileSize: file.size,
        fileTypeCategory,
        isVideo,
        status: initialStatus, // 'queued' | 'uploading' | 'compressing' | 'done' | 'error'
        progress: 0,
        errorMessage: initialError,
        category: category || 'General',
        folderId: folderId || null,
        folderTitle: folderTitle || '',
        createdAt: Date.now(),
        result: null,
      };
    });

    setUploadQueue((prev) => [...prev, ...newItems]);
    setIsTrayOpen(true);
    setIsTrayMinimized(false);
  }, []);


  /**
   * Prompt category modal for files dropped/selected at root
   */
  const promptCategoryForFiles = useCallback((files, targetFolder = null) => {
    setCategoryPrompt({
      isOpen: true,
      files: Array.from(files),
      targetFolder,
    });
  }, []);

  const closeCategoryPrompt = useCallback(() => {
    setCategoryPrompt({
      isOpen: false,
      files: [],
      targetFolder: null,
    });
  }, []);

  const confirmCategoryPrompt = useCallback((chosenCategory) => {
    if (categoryPrompt.files.length > 0) {
      addToQueue(categoryPrompt.files, {
        category: chosenCategory,
        folderId: categoryPrompt.targetFolder?._id || null,
        folderTitle: categoryPrompt.targetFolder?.title || '',
      });
    }
    closeCategoryPrompt();
  }, [categoryPrompt, addToQueue, closeCategoryPrompt]);

  /**
   * Trigger the file picker for "+ Upload" button flow
   */
  const openFilePicker = useCallback(({ folderId = null, folderTitle = '', category = 'All' } = {}) => {
    const isRoot = !folderId && (!category || category === 'All');
    filePickerTargetRef.current = {
      folderId: folderId || null,
      folderTitle: folderTitle || '',
      category: category !== 'All' ? category : 'General',
      isRoot,
    };

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, []);

  const handleNativeFileSelect = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const target = filePickerTargetRef.current;
    if (target.isRoot) {
      promptCategoryForFiles(files, null);
    } else {
      addToQueue(files, {
        folderId: target.folderId,
        folderTitle: target.folderTitle,
        category: target.category || 'General',
      });
    }
  };

  /**
   * Cancel an individual upload item (aborts in-flight XHR if currently active)
   */
  const cancelUpload = useCallback((id) => {
    // If the cancelled item is currently active (uploading or compressing), abort XHR mid-flight
    if (activeXhrRef.current && currentProcessingIdRef.current === id) {
      try {
        activeXhrRef.current.abort();
      } catch (err) {
        console.warn('Error aborting upload XHR:', err);
      }
      activeXhrRef.current = null;
      currentProcessingIdRef.current = null;
    }

    setUploadQueue((prev) => prev.filter((i) => i.id !== id));
  }, []);

  /**
   * Cancel all upload items, abort active in-flight transfers, and reset queue
   */
  const cancelAllUploads = useCallback(() => {
    if (activeXhrRef.current) {
      try {
        activeXhrRef.current.abort();
      } catch (err) {
        console.warn('Error aborting upload XHR:', err);
      }
      activeXhrRef.current = null;
      currentProcessingIdRef.current = null;
    }
    setUploadQueue([]);
    setIsTrayOpen(false);
  }, []);

  /**
   * Retry a failed item
   */
  const retryUpload = useCallback((id) => {
    setUploadQueue((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const isVideo = item.isVideo ?? (item.fileTypeCategory === 'video' || (item.file?.type && item.file.type.startsWith('video/')));
          const maxLimitBytes = isVideo ? MAX_VIDEO_BYTES : MAX_NON_VIDEO_BYTES;
          const maxLimitMb = isVideo ? MAX_VIDEO_UPLOAD_SIZE_MB : MAX_NON_VIDEO_UPLOAD_SIZE_MB;

          if (item.file?.size > maxLimitBytes) {
            const sizeMb = (item.file.size / (1024 * 1024)).toFixed(1);
            return {
              ...item,
              status: 'error',
              errorMessage: isVideo
                ? `Video exceeds ${maxLimitMb}MB limit (${sizeMb} MB)`
                : `File exceeds ${maxLimitMb}MB limit (${sizeMb} MB)`,
              progress: 0,
            };
          }
          return {
            ...item,
            status: 'queued',
            progress: 0,
            errorMessage: null,
          };
        }
        return item;
      })
    );
    setIsTrayOpen(true);
  }, []);

  /**
   * Clear all completed and failed items
   */
  const clearCompleted = useCallback(() => {
    setUploadQueue((prev) =>
      prev.filter((item) => item.status === 'queued' || item.status === 'uploading' || item.status === 'compressing')
    );
  }, []);

  /**
   * Dismiss the entire tray (like Google Drive, does not abort background uploads)
   */
  const dismissTray = useCallback(() => {
    setIsTrayOpen(false);
  }, []);

  /**
   * Execute single file upload with XMLHttpRequest and live progress
   */
  const executeFileUpload = useCallback((item) => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      activeXhrRef.current = xhr;
      currentProcessingIdRef.current = item.id;

      const token = getAccessToken();
      const endpoint = `${BASE_URL}/videos/upload`;
      const url = token ? `${endpoint}?token=${encodeURIComponent(token)}` : endpoint;

      xhr.open('POST', url);
      xhr.setRequestHeader('bypass-tunnel-reminder', 'true');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      // Live progress tracking
      xhr.upload.onprogress = (event) => {
        if (event.total > 0) {
          const rawPercent = (event.loaded / event.total) * 100;
          if (rawPercent < 100) {
            const clamped = Math.min(99, Math.max(1, Math.round(rawPercent)));
            setUploadQueue((prev) =>
              prev.map((q) => (q.id === item.id ? { ...q, status: 'uploading', progress: clamped } : q))
            );
          } else {
            // Byte upload complete — enter 'compressing' ONLY if it's a video over 20MB that needs FFmpeg
            const needsCompression = item.isVideo && item.fileSize > 20 * 1024 * 1024;
            setUploadQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? { ...q, status: needsCompression ? 'compressing' : 'uploading', progress: 100 }
                  : q
              )
            );
          }
        }
      };

      xhr.onload = () => {
        activeXhrRef.current = null;
        currentProcessingIdRef.current = null;

        if (xhr.status >= 200 && xhr.status < 300) {
          let responseData = null;
          try {
            responseData = JSON.parse(xhr.responseText);
          } catch {
            responseData = { message: 'Upload succeeded' };
          }

          setUploadQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? { ...q, status: 'done', progress: 100, result: responseData, errorMessage: null }
                : q
            )
          );
          notifyUploadSuccess(responseData);
          resolve({ success: true, data: responseData });
        } else {
          let errMessage = `Upload failed (${xhr.status})`;
          try {
            const json = JSON.parse(xhr.responseText);
            if (json.message) errMessage = json.message;
            else if (json.error) errMessage = json.error;
          } catch {}

          if (xhr.status === 413) {
            errMessage = 'File too large for upload server.';
          }

          setUploadQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? { ...q, status: 'error', progress: 0, errorMessage: errMessage }
                : q
            )
          );
          resolve({ success: false, error: errMessage });
        }
      };

      xhr.onerror = () => {
        activeXhrRef.current = null;
        currentProcessingIdRef.current = null;
        const errMessage = 'Network error during upload.';
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: 'error', progress: 0, errorMessage: errMessage }
              : q
          )
        );
        resolve({ success: false, error: errMessage });
      };

      xhr.onabort = () => {
        activeXhrRef.current = null;
        currentProcessingIdRef.current = null;
        resolve({ success: false, error: 'Cancelled' });
      };

      xhr.ontimeout = () => {
        activeXhrRef.current = null;
        currentProcessingIdRef.current = null;
        const errMessage = 'Upload timed out. Network connection is too slow.';
        setUploadQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: 'error', progress: 0, errorMessage: errMessage }
              : q
          )
        );
        resolve({ success: false, error: errMessage });
      };

      const formData = new FormData();
      // Backend checks req.files.file || req.files.video || req.files.media || req.file
      formData.append('file', item.file);
      formData.append('title', item.fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || item.fileName);
      formData.append('category', item.category || 'General');
      if (item.folderId && item.folderId !== 'root') {
        formData.append('folderId', item.folderId);
      }

      xhr.send(formData);
    });
  }, [notifyUploadSuccess]);

  /**
   * Sequential Queue Worker:
   * Picks the next 'queued' item, uploads it, and then continues sequentially.
   */
  useEffect(() => {
    if (isProcessing) return;

    const nextItem = uploadQueue.find((i) => i.status === 'queued');
    if (!nextItem) return;

    setIsProcessing(true);

    // Mark as uploading
    setUploadQueue((prev) =>
      prev.map((i) => (i.id === nextItem.id ? { ...i, status: 'uploading', progress: 1 } : i))
    );

    executeFileUpload(nextItem).finally(() => {
      setIsProcessing(false);
    });
  }, [uploadQueue, isProcessing, executeFileUpload]);

  return (
    <UploadContext.Provider
      value={{
        uploadQueue,
        isProcessing,
        isTrayOpen,
        setIsTrayOpen,
        isTrayMinimized,
        setIsTrayMinimized,
        addToQueue,
        promptCategoryForFiles,
        categoryPrompt,
        closeCategoryPrompt,
        confirmCategoryPrompt,
        openFilePicker,
        cancelUpload,
        cancelAllUploads,
        retryUpload,
        clearCompleted,
        dismissTray,
        registerOnUploadSuccess,
        notifyUploadSuccess,
      }}
    >
      {children}
      {/* Hidden global multi-file selector input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleNativeFileSelect}
      />
    </UploadContext.Provider>
  );
};

