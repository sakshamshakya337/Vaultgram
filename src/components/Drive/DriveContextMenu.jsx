import React, { useEffect, useRef } from 'react';
import {
  Eye,
  Edit2,
  FolderSymlink,
  Share2,
  Download,
  Trash2,
  FolderOpen,
  Copy,
  Info
} from 'lucide-react';

export const DriveContextMenu = ({
  x,
  y,
  item, // Can be a file or a folder
  isFolder = false,
  selectedCount = 1,
  onClose,
  onOpen,
  onRename,
  onMove,
  onShare,
  onDownload,
  onDelete,
}) => {
  const menuRef = useRef(null);

  // Close on outside click or Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', onClose, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  // Adjust menu position to guarantee it stays inside window viewport
  const menuWidth = 200;
  const menuHeight = isFolder ? 180 : 250;
  const adjustedX = Math.min(Math.max(10, x), window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(Math.max(10, y), window.innerHeight - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-50 w-52 rounded-2xl bg-zinc-950/95 border border-white/10 shadow-2xl p-1.5 backdrop-blur-2xl animate-fade-in text-xs select-none"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Target Title / Count Header */}
      <div className="px-3 py-1.5 mb-1 border-b border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
        <span className="truncate max-w-[130px] font-semibold text-zinc-200">
          {selectedCount > 1 ? `${selectedCount} items selected` : (item?.title || (isFolder ? 'Folder' : 'File'))}
        </span>
        {selectedCount > 1 && (
          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px] font-mono font-bold">
            {selectedCount}
          </span>
        )}
      </div>

      <div className="space-y-0.5">
        {/* Open / Preview Action */}
        <button
          onClick={() => {
            onClose();
            onOpen?.(item);
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-left"
        >
          {isFolder ? <FolderOpen className="w-4 h-4 text-blue-400" /> : <Eye className="w-4 h-4 text-cyan-400" />}
          <span>{isFolder ? 'Open Folder' : selectedCount > 1 ? 'Preview First' : 'Preview / Open'}</span>
        </button>

        {/* Rename Action (Single item only) */}
        {selectedCount <= 1 && onRename && (
          <button
            onClick={() => {
              onClose();
              onRename(item);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-left"
          >
            <Edit2 className="w-4 h-4 text-amber-400" />
            <span>Rename</span>
          </button>
        )}

        {/* Move to... Action */}
        {!isFolder && onMove && (
          <button
            onClick={() => {
              onClose();
              onMove(item);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-left"
          >
            <FolderSymlink className="w-4 h-4 text-purple-400" />
            <span>Move to...</span>
          </button>
        )}

        {/* Share Action */}
        {onShare && (
          <button
            onClick={() => {
              onClose();
              onShare(item);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-left"
          >
            <Share2 className="w-4 h-4 text-emerald-400" />
            <span>Share {isFolder ? 'Folder' : selectedCount > 1 ? `(${selectedCount})` : ''}</span>
          </button>
        )}

        {/* Download Action (Files only) */}
        {!isFolder && onDownload && (
          <button
            onClick={() => {
              onClose();
              onDownload(item);
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-left"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Download {selectedCount > 1 ? `(${selectedCount})` : ''}</span>
          </button>
        )}

        {/* Delete Action */}
        {onDelete && (
          <div className="pt-1 mt-1 border-t border-white/5">
            <button
              onClick={() => {
                onClose();
                onDelete(item);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer text-left font-medium"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>Delete {selectedCount > 1 ? `(${selectedCount})` : ''}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
