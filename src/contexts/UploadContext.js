import { createContext } from 'react';

// Configurable upload size limits matching backend settings
export const MAX_VIDEO_UPLOAD_SIZE_MB = parseInt(import.meta.env.VITE_MAX_VIDEO_UPLOAD_SIZE_MB, 10) || 200;
export const MAX_NON_VIDEO_UPLOAD_SIZE_MB = parseInt(import.meta.env.VITE_MAX_NON_VIDEO_UPLOAD_SIZE_MB, 10) || 20;

export const UploadContext = createContext(null);
export default UploadContext;
