import { useContext } from 'react';
import { VideoFeedContext } from './VideoFeedContext';

export const useVideoFeed = () => {
  const context = useContext(VideoFeedContext);
  if (!context) {
    throw new Error('useVideoFeed must be used within a VideoFeedProvider');
  }
  return context;
};

export default useVideoFeed;
