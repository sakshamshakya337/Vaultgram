import React, { useState } from 'react';
import {
  Folder,
  Star,
  MoreVertical,
  Download,
  Trash2,
  Edit2,
  FolderInput,
  Eye,
  Cloud,
  FolderOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrive } from '../../contexts/DriveContext';
import { FileIcon } from './FileIcon';
import { SkeletonDrive } from './SkeletonDrive';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import api, { formatBytes, formatRelativeTime } from '../../services/api';

export const DriveGrid = () => {
  const {
    items,
    loading,
    selectedItem,
    setSelectedItem,
    setPreviewItem,
    setRenameTarget,
    setMoveTarget,
    toggleStar,
    trashOrDelete,
    activeSection,
    navigateToFolder,
  } = useDrive();

  const [activeMenuId, setActiveMenuId] = useState(null);

  if (loading) {
    return <SkeletonDrive mode="grid" />;
  }

  const folders = items.filter((item) => item.isFolder);
  const files = items.filter((item) => !item.isFolder);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 border border-white/[0.08] text-zinc-500 mb-4 shadow-xl">
          <Cloud className="h-8 w-8 text-blue-400" />
        </div>
        <h3 className="text-lg font-bold font-display text-zinc-200">No items found</h3>
        <p className="mt-1 text-xs text-zinc-500 max-w-sm">
          {activeSection === 'trash'
            ? 'Your trash is currently empty.'
            : activeSection === 'starred'
            ? 'No starred files yet. Star items for quick access.'
            : 'Drop files anywhere on the screen or click "+ New Upload".'}
        </p>
      </div>
    );
  }

  const handleDownload = (item, e) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = api.stream.getUrl(item._id, true);
    link.download = item.title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.15 } },
  };

  return (
    <div className="space-y-8 pb-16">
      {/* ─── Folders Section ────────────────────────────────────── */}
      {folders.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3.5 px-1">
            Folders ({folders.length})
          </h3>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5"
          >
            {folders.map((folder) => {
              const isSelected = selectedItem?._id === folder._id;
              return (
                <motion.div
                  key={folder._id}
                  variants={itemVariants}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={`group relative flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500/60 shadow-md shadow-blue-500/10'
                      : 'bg-zinc-900/80 border-white/[0.06] hover:bg-zinc-800/80 hover:border-white/[0.14]'
                  }`}
                  onClick={() => {
                    setSelectedItem(folder);
                    navigateToFolder(folder._id);
                  }}
                >
                  <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/15 text-blue-400 border border-blue-500/20 flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Folder className="h-5 w-5 fill-current" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span
                        className="text-sm font-semibold text-zinc-200 truncate block group-hover:text-white"
                        title={folder.title}
                      >
                        {folder.title}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">Folder</span>
                    </div>
                  </div>

                  {/* 3-Dot Actions */}
                  <div className="relative flex-shrink-0 ml-2">
                    <button
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuId(activeMenuId === folder._id ? null : folder._id);
                      }}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    <AnimatePresence>
                      {activeMenuId === folder._id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute right-0 top-8 z-50 w-36 rounded-xl border border-white/[0.08] bg-zinc-900 p-1.5 shadow-2xl backdrop-blur-2xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="flex w-full items-center space-x-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
                            onClick={() => {
                              navigateToFolder(folder._id);
                              setActiveMenuId(null);
                            }}
                          >
                            <FolderOpen className="h-3.5 w-3.5 text-blue-400" />
                            <span>Open</span>
                          </button>
                          <button
                            className="flex w-full items-center space-x-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
                            onClick={() => {
                              setRenameTarget(folder);
                              setActiveMenuId(null);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5 text-blue-400" />
                            <span>Rename</span>
                          </button>
                          <button
                            className="flex w-full items-center space-x-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
                            onClick={() => {
                              setMoveTarget(folder);
                              setActiveMenuId(null);
                            }}
                          >
                            <FolderInput className="h-3.5 w-3.5 text-sky-400" />
                            <span>Move</span>
                          </button>
                          <button
                            className="flex w-full items-center space-x-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-500/20"
                            onClick={() => {
                              trashOrDelete(folder._id);
                              setActiveMenuId(null);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}

      {/* ─── Files Section ──────────────────────────────────────── */}
      {files.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3.5 px-1">
            Files ({files.length})
          </h3>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
          >
            {files.map((file) => {
              const isSelected = selectedItem?._id === file._id;
              const streamUrl = api.stream.getUrl(file._id);

              return (
                <motion.div
                  key={file._id}
                  variants={itemVariants}
                  whileHover={{ y: -3 }}
                  className={`group relative flex flex-col rounded-xl border overflow-hidden transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/40'
                      : 'bg-zinc-900/80 border-white/[0.06] hover:bg-zinc-800/80 hover:border-white/[0.14]'
                  }`}
                  onClick={() => setSelectedItem(file)}
                  onDoubleClick={() => setPreviewItem(file)}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-[4/3] w-full bg-zinc-950 overflow-hidden flex items-center justify-center border-b border-white/[0.04]">
                    {file.fileCategory === 'image' ? (
                      <img
                        src={streamUrl}
                        alt={file.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : file.fileCategory === 'video' ? (
                      <video
                        src={streamUrl}
                        className="h-full w-full object-cover opacity-80"
                        preload="metadata"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4">
                        <FileIcon category={file.fileCategory} size={38} />
                        {file.extension && (
                          <Badge variant="secondary" className="mt-2 text-[10px] uppercase font-mono">
                            .{file.extension}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Quick Preview Hover */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity space-x-2">
                      <Button
                        variant="default"
                        size="icon-sm"
                        className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewItem(file);
                        }}
                        title="Preview"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        className="rounded-lg"
                        onClick={(e) => handleDownload(file, e)}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Star Badge */}
                    <button
                      className={`absolute top-2 right-2 p-1.5 rounded-lg transition-all ${
                        file.isStarred
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-black/50 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-white'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStar(file._id);
                      }}
                      title="Star"
                    >
                      <Star className="h-3.5 w-3.5" fill={file.isStarred ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  {/* Metadata */}
                  <div className="p-3 space-y-1 flex-1 flex flex-col justify-between">
                    <div className="flex items-start space-x-2">
                      <FileIcon category={file.fileCategory} size={15} />
                      <span
                        className="text-xs font-semibold text-zinc-200 truncate group-hover:text-white flex-1"
                        title={file.title}
                      >
                        {file.title}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1">
                      <span>{formatBytes(file.fileSizeBytes)}</span>
                      <span>{formatRelativeTime(file.createdAt)}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      )}
    </div>
  );
};
