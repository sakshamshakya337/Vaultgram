import React from 'react';
import { Skeleton } from '../ui/skeleton';

export const SkeletonDrive = ({ mode = 'grid' }) => {
  if (mode === 'list') {
    return (
      <div className="w-full space-y-2 mt-4">
        {/* Table Header Skeleton */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <Skeleton className="h-4 w-40" />
          <div className="flex items-center space-x-8">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>

        {/* Row Skeletons */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-4 py-3 rounded-xl bg-zinc-900/40 border border-white/[0.04]"
          >
            <div className="flex items-center space-x-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex items-center space-x-8">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8 mt-4">
      {/* Folders Section Skeleton */}
      <div>
        <Skeleton className="h-5 w-28 mb-3.5" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="p-3.5 rounded-2xl bg-zinc-900/40 border border-white/[0.04] flex items-center space-x-3"
            >
              <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-2.5 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Files Section Skeleton */}
      <div>
        <Skeleton className="h-5 w-24 mb-3.5" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-zinc-900/40 border border-white/[0.04] overflow-hidden flex flex-col"
            >
              <Skeleton className="h-32 w-full" />
              <div className="p-3.5 space-y-2">
                <Skeleton className="h-4 w-full" />
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 w-10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
