import React from 'react';

/**
 * Skeleton placeholder for Folder and Category cards
 */
export const DriveFolderSkeleton = ({ count = 6 }) => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Folder Section Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-3.5 w-24 bg-zinc-800/80 rounded-md animate-pulse" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="p-3.5 rounded-2xl bg-zinc-900/40 border border-white/5 shadow-md flex flex-col justify-between min-h-[95px] animate-shimmer"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-zinc-800/80 animate-pulse" />
              <div className="w-5 h-5 rounded-lg bg-zinc-800/50 animate-pulse" />
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="h-3 w-3/4 bg-zinc-800/80 rounded animate-pulse" />
              <div className="h-2 w-1/2 bg-zinc-800/50 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton placeholder for Drive Grid items (Videos / Images / Files)
 */
export const DriveGridSkeleton = ({ count = 8 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl bg-zinc-900/50 border border-white/5 overflow-hidden shadow-lg flex flex-col animate-shimmer"
        >
          {/* Media preview area placeholder */}
          <div className="w-full aspect-video bg-zinc-800/70 animate-pulse relative">
            <div className="absolute top-3 left-3 w-16 h-5 rounded-full bg-zinc-900/60" />
            <div className="absolute bottom-3 right-3 w-12 h-4 rounded-md bg-zinc-900/60" />
          </div>

          {/* Info Card footer placeholder */}
          <div className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-3/5 bg-zinc-800/80 rounded animate-pulse" />
              <div className="w-4 h-4 rounded bg-zinc-800/50" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <div className="h-2.5 w-1/3 bg-zinc-800/50 rounded animate-pulse" />
              <div className="h-2.5 w-1/4 bg-zinc-800/50 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton placeholder for Drive List / Table items
 */
export const DriveListSkeleton = ({ count = 6 }) => {
  return (
    <div className="rounded-2xl border border-white/5 bg-zinc-900/30 overflow-hidden divide-y divide-white/5 animate-fade-in">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="px-4 py-3.5 flex items-center justify-between gap-4 animate-shimmer">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-zinc-800/80 shrink-0 animate-pulse" />
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="h-3.5 w-48 max-w-[70%] bg-zinc-800/80 rounded animate-pulse" />
              <div className="h-2.5 w-24 bg-zinc-800/50 rounded animate-pulse" />
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-6 shrink-0">
            <div className="h-3 w-16 bg-zinc-800/50 rounded animate-pulse" />
            <div className="h-3 w-14 bg-zinc-800/50 rounded animate-pulse" />
            <div className="w-6 h-6 rounded bg-zinc-800/40" />
          </div>
        </div>
      ))}
    </div>
  );
};
