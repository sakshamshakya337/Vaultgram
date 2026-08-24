import { useContext } from 'react';
import { OfflineMediaContext } from './OfflineMediaContext.js';

export const useOfflineMedia = () => {
  const context = useContext(OfflineMediaContext);
  if (!context) {
    throw new Error('useOfflineMedia must be used within an OfflineMediaProvider');
  }
  return context;
};
