import React from 'react';
import {
  X,
  Star,
  Download,
  Trash2,
  Edit2,
  FolderInput,
  Cloud,
  Calendar,
  HardDrive,
  FileCheck,
  Eye,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useDrive } from '../../contexts/DriveContext';
import { FileIcon } from './FileIcon';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import api, { formatBytes, formatRelativeTime } from '../../services/api';

export const FileInspector = () => {
  const {
    selectedItem,
    setSelectedItem,
    setIsInspectorOpen,
    setPreviewItem,
    setRenameTarget,
    setMoveTarget,
    toggleStar,
    trashOrDelete,
  } = useDrive();

  if (!selectedItem) {
    return (
      <motion.aside
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="hidden lg:flex h-full w-80 flex-col border-l border-white/[0.08] bg-drive-sidebar/80 backdrop-blur-2xl p-6 text-center justify-center items-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 border border-white/[0.08] text-zinc-500 mb-3">
          <HardDrive className="h-6 w-6" />
        </div>
        <h4 className="text-sm font-bold text-zinc-300">Select an item</h4>
        <p className="text-xs text-zinc-500 mt-1">
          Click any file or folder to view its storage details.
        </p>
      </motion.aside>
    );
  }

  const streamUrl = api.stream.getUrl(selectedItem._id);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = api.stream.getUrl(selectedItem._id, true);
    link.download = selectedItem.title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.aside
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="hidden lg:flex h-full w-80 flex-col border-l border-white/[0.08] bg-drive-sidebar/90 backdrop-blur-2xl overflow-y-auto"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center space-x-2">
          <FileIcon category={selectedItem.fileCategory} size={18} />
          <h4 className="text-sm font-bold text-zinc-200 truncate max-w-[170px]">
            {selectedItem.title}
          </h4>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsInspectorOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-5 space-y-6">
        {/* Preview Thumbnail Box */}
        <div className="relative aspect-video w-full rounded-2xl bg-zinc-950/80 border border-white/[0.06] overflow-hidden flex items-center justify-center">
          {selectedItem.fileCategory === 'image' ? (
            <img
              src={streamUrl}
              alt={selectedItem.title}
              className="h-full w-full object-cover"
            />
          ) : selectedItem.fileCategory === 'video' ? (
            <video src={streamUrl} className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center p-4">
              <FileIcon category={selectedItem.fileCategory} size={42} />
              {selectedItem.extension && (
                <Badge variant="cyan" className="mt-2 text-[10px] uppercase font-mono">
                  .{selectedItem.extension}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {!selectedItem.isFolder && (
            <>
              <Button variant="default" size="sm" onClick={() => setPreviewItem(selectedItem)}>
                <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
              </Button>
              <Button variant="secondary" size="sm" onClick={handleDownload}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download
              </Button>
            </>
          )}
        </div>

        {/* Storage & Metadata Breakdown */}
        <div className="space-y-3 pt-2 border-t border-white/[0.06]">
          <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Properties
          </h5>

          <div className="space-y-2 text-xs font-mono text-zinc-300">
            <div className="flex justify-between py-1 border-b border-white/[0.04]">
              <span className="text-zinc-500">Type</span>
              <span className="font-semibold uppercase">{selectedItem.fileCategory || 'Folder'}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-white/[0.04]">
              <span className="text-zinc-500">Size</span>
              <span>{selectedItem.isFolder ? '—' : formatBytes(selectedItem.fileSizeBytes)}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-white/[0.04]">
              <span className="text-zinc-500">Storage Vault</span>
              <span className="text-sky-400 font-semibold flex items-center">
                <Cloud className="mr-1 h-3 w-3" /> Telegram CDN
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-white/[0.04]">
              <span className="text-zinc-500">Modified</span>
              <span>{formatRelativeTime(selectedItem.updatedAt || selectedItem.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Operations */}
        <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
          <button
            className="flex w-full items-center space-x-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            onClick={() => toggleStar(selectedItem._id)}
          >
            <Star
              className="h-3.5 w-3.5"
              fill={selectedItem.isStarred ? '#f59e0b' : 'none'}
              color={selectedItem.isStarred ? '#f59e0b' : 'currentColor'}
            />
            <span>{selectedItem.isStarred ? 'Remove from Starred' : 'Add to Starred'}</span>
          </button>

          <button
            className="flex w-full items-center space-x-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            onClick={() => setRenameTarget(selectedItem)}
          >
            <Edit2 className="h-3.5 w-3.5 text-sky-400" />
            <span>Rename</span>
          </button>

          <button
            className="flex w-full items-center space-x-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            onClick={() => setMoveTarget(selectedItem)}
          >
            <FolderInput className="h-3.5 w-3.5 text-indigo-400" />
            <span>Move to folder</span>
          </button>

          <button
            className="flex w-full items-center space-x-2.5 rounded-xl px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/15 transition-colors"
            onClick={() => trashOrDelete(selectedItem._id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </motion.aside>
  );
};
