import React from 'react';

/**
 * High-fidelity full-height skeleton placeholder for Reels Feed
 */
export const ReelSkeleton = () => {
  return (
    <div className="relative w-full h-full bg-zinc-950 flex flex-col justify-between p-5 pb-20 md:pb-8 overflow-hidden animate-fade-in animate-shimmer select-none">
      {/* Top category chip placeholder */}
      <div className="pt-12 md:pt-4 flex items-center gap-2">
        <div className="h-6 w-20 rounded-full bg-zinc-800/80 animate-pulse" />
        <div className="h-6 w-16 rounded-full bg-zinc-800/50 animate-pulse" />
      </div>

      {/* Center subtle playback indicator placeholder */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center animate-pulse">
          <div className="w-6 h-6 rounded-md bg-white/10" />
        </div>
      </div>

      {/* Bottom info & right action buttons */}
      <div className="flex items-end justify-between gap-4 z-10">
        {/* Left Video Information Placeholder */}
        <div className="space-y-2.5 max-w-[70%] flex-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-zinc-800/80 animate-pulse shrink-0" />
            <div className="h-3.5 w-28 bg-zinc-800/80 rounded animate-pulse" />
          </div>
          <div className="h-4 w-48 bg-zinc-800/90 rounded animate-pulse" />
          <div className="h-3 w-36 bg-zinc-800/60 rounded animate-pulse" />
        </div>

        {/* Right Action Buttons Placeholder */}
        <div className="flex flex-col items-center gap-4 shrink-0">
          {/* Like button skeleton */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-11 h-11 rounded-full bg-zinc-800/80 border border-white/5 animate-pulse" />
            <div className="h-2 w-6 bg-zinc-800/60 rounded animate-pulse" />
          </div>

          {/* Mute button skeleton */}
          <div className="w-11 h-11 rounded-full bg-zinc-800/80 border border-white/5 animate-pulse" />

          {/* Share button skeleton */}
          <div className="w-11 h-11 rounded-full bg-zinc-800/80 border border-white/5 animate-pulse" />

          {/* Music disk skeleton */}
          <div className="w-10 h-10 rounded-full bg-zinc-800/90 border border-cyan-500/20 animate-pulse mt-1" />
        </div>
      </div>

      {/* Bottom Progress Bar Skeleton */}
      <div className="absolute bottom-0 inset-x-0 h-1 bg-zinc-800/50">
        <div className="h-full w-1/3 bg-cyan-500/40 animate-pulse" />
      </div>
    </div>
  );
};
