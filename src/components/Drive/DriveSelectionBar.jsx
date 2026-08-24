import React from 'react';
import {
  CheckSquare,
  Square,
  Trash2,
  FolderSymlink,
  Share2,
  Download,
  X
} from 'lucide-react';

export const DriveSelectionBar = ({
  selectedCount = 0,
  totalCount = 0,
  isAllSelected = false,
  onToggleSelectAll,
  onBulkDelete,
  onBulkMove,
  onBulkShare,
  onBulkDownload,
  onClearSelection,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 backdrop-blur-xl shadow-xl shadow-cyan-950/30 animate-fade-in text-xs select-none">
      {/* Left: Select All Checkbox & Count */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSelectAll}
          className="flex items-center gap-2 text-cyan-300 hover:text-white font-semibold cursor-pointer transition-colors"
          title={isAllSelected ? 'Deselect all' : 'Select all files in view'}
        >
          {isAllSelected ? (
            <CheckSquare className="w-4 h-4 text-cyan-400" />
          ) : (
            <Square className="w-4 h-4 text-cyan-500/60" />
          )}
          <span>{selectedCount} selected</span>
        </button>
      </div>

      {/* Right: Bulk Action Buttons */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Bulk Move */}
        {onBulkMove && (
          <button
            onClick={onBulkMove}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-purple-300 text-xs font-semibold transition-colors cursor-pointer"
            title="Move selected files"
          >
            <FolderSymlink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Move</span>
          </button>
        )}

        {/* Bulk Share */}
        {onBulkShare && (
          <button
            onClick={onBulkShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-emerald-300 text-xs font-semibold transition-colors cursor-pointer"
            title="Share selected files"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>
        )}

        {/* Bulk Download */}
        {onBulkDownload && (
          <button
            onClick={onBulkDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-300 text-xs font-semibold transition-colors cursor-pointer"
            title="Download selected files"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>
        )}

        {/* Bulk Delete */}
        {onBulkDelete && (
          <button
            onClick={onBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-colors cursor-pointer"
            title="Delete selected files"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        )}

        {/* Clear Selection X */}
        <button
          onClick={onClearSelection}
          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer ml-1"
          title="Clear selection (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
