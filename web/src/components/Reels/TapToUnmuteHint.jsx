import React from 'react';
import { VolumeX, Volume2 } from 'lucide-react';
import { useVideoFeed } from '../../contexts/VideoFeedContext';

export const TapToUnmuteHint = () => {
  const { isAudioUnlocked, unlockAudio } = useVideoFeed();

  if (isAudioUnlocked) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        unlockAudio();
      }}
      className="absolute top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 rounded-full glass-pill bg-black/60 text-white text-xs font-semibold shadow-2xl border border-white/20 animate-bounce cursor-pointer hover:bg-black/80 transition-all active:scale-95"
      aria-label="Tap to unmute"
    >
      <VolumeX className="w-4 h-4 text-cyan-400 animate-pulse" />
      <span>Tap anywhere to unmute</span>
    </button>
  );
};
