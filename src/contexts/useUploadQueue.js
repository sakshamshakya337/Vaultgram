import { useContext } from 'react';
import { UploadContext } from './UploadContext.js';

export const useUploadQueue = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUploadQueue must be used within an UploadProvider');
  }
  return context;
};

export default useUploadQueue;
