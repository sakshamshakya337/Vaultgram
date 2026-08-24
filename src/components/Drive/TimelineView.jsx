import React, { useMemo } from 'react';
import { Calendar, Clock, FileText, Sparkles } from 'lucide-react';
import { DriveFilesGrid } from './DriveFilesGrid';
import { DriveFilesList } from './DriveFilesList';

function isSameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export const TimelineView = ({
  videos = [],
  viewMode = 'grid',
  onSelectVideo,
  onDeleteVideo,
}) => {
  // Compute timeline grouping
  const timelineGroups = useMemo(() => {
    if (!videos || videos.length === 0) return [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(startOfWeek.getDate() - today.getDay());

    const groups = {
      Today: [],
      Yesterday: [],
      'This Week': [],
      'This Month': [],
    };

    const monthlyGroups = {}; // 'July 2026': []

    // Sort newest first
    const sorted = [...videos].sort((a, b) => {
      const tA = new Date(a.createdAt || 0).getTime();
      const tB = new Date(b.createdAt || 0).getTime();
      return tB - tA;
    });

    sorted.forEach((item) => {
      const itemDate = new Date(item.createdAt || now);

      if (isSameDay(itemDate, today)) {
        groups['Today'].push(item);
      } else if (isSameDay(itemDate, yesterday)) {
        groups['Yesterday'].push(item);
      } else if (itemDate >= startOfWeek) {
        groups['This Week'].push(item);
      } else if (
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getFullYear() === now.getFullYear()
      ) {
        groups['This Month'].push(item);
      } else {
        const monthYear = itemDate.toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        });
        if (!monthlyGroups[monthYear]) {
          monthlyGroups[monthYear] = [];
        }
        monthlyGroups[monthYear].push(item);
      }
    });

    const result = [];
    if (groups['Today'].length > 0) result.push({ title: 'Today', items: groups['Today'] });
    if (groups['Yesterday'].length > 0) result.push({ title: 'Yesterday', items: groups['Yesterday'] });
    if (groups['This Week'].length > 0) result.push({ title: 'This Week', items: groups['This Week'] });
    if (groups['This Month'].length > 0) result.push({ title: 'This Month', items: groups['This Month'] });

    Object.entries(monthlyGroups).forEach(([monthTitle, items]) => {
      if (items.length > 0) {
        result.push({ title: monthTitle, items });
      }
    });

    return result;
  }, [videos]);

  if (!videos || videos.length === 0) {
    return (
      <div className="p-12 rounded-3xl bg-zinc-900/30 border border-white/5 flex flex-col items-center justify-center text-center space-y-4 my-6">
        <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-600">
          <Calendar className="w-8 h-8 text-cyan-400" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white mb-1">Timeline is Empty</h4>
          <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
            Upload videos or photos to see them automatically organized chronologically by date.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {timelineGroups.map((group) => (
        <div key={group.title} className="space-y-3.5">
          {/* Section Date Header */}
          <div className="flex items-center gap-2 pb-1 border-b border-white/5">
            <div className="w-7 h-7 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              {group.title}
            </h3>
            <span className="text-xs font-mono text-zinc-500">
              ({group.items.length})
            </span>
          </div>

          {/* Group Content */}
          {viewMode === 'grid' ? (
            <DriveFilesGrid
              videos={group.items}
              onSelectVideo={(video, idx) => {
                const globalIndex = videos.findIndex(
                  (v) => (v._id || v.id) === (video._id || video.id)
                );
                onSelectVideo(video, globalIndex >= 0 ? globalIndex : idx);
              }}
              onDeleteVideo={onDeleteVideo}
            />
          ) : (
            <DriveFilesList
              videos={group.items}
              onSelectVideo={(video, idx) => {
                const globalIndex = videos.findIndex(
                  (v) => (v._id || v.id) === (video._id || video.id)
                );
                onSelectVideo(video, globalIndex >= 0 ? globalIndex : idx);
              }}
              onDeleteVideo={onDeleteVideo}
            />
          )}
        </div>
      ))}
    </div>
  );
};
