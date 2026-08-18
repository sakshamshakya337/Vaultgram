import React from 'react';
import {
  Folder,
  Star,
  Download,
  Trash2,
  Edit2,
  FolderInput,
  RotateCcw,
  Eye,
  Cloud,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useDrive } from '../../contexts/DriveContext';
import { FileIcon } from './FileIcon';
import { SkeletonDrive } from './SkeletonDrive';
import { Button } from '../ui/button';
import api, { formatBytes, formatRelativeTime } from '../../services/api';

export const DriveList = () => {
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
    restoreTrash,
    activeSection,
    setSection,
  } = useDrive();

  if (loading) {
    return <SkeletonDrive mode="list" />;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-zinc-900/80 border border-white/[0.08] text-zinc-500 mb-4 shadow-xl">
          <Cloud className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold font-display text-zinc-200">No items found</h3>
        <p className="mt-1 text-sm text-zinc-500 max-w-sm">
          {activeSection === 'trash'
            ? 'Your trash is currently empty.'
            : activeSection === 'starred'
            ? 'No starred files yet.'
            : 'Drop files anywhere on the screen or click "+ New" to upload.'}
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

  return (
    <div className="w-full pb-16 overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-white/[0.06] text-xs font-bold uppercase tracking-wider text-zinc-400">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3 hidden md:table-cell">Type</th>
            <th className="px-4 py-3 hidden sm:table-cell">Last Modified</th>
            <th className="px-4 py-3">File Size</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {items.map((item) => {
            const isSelected = selectedItem?._id === item._id;
            return (
              <motion.tr
                key={item._id}
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                className={`group transition-colors cursor-pointer ${
                  isSelected ? 'bg-sky-500/10' : ''
                }`}
                onClick={() => setSelectedItem(item)}
                onDoubleClick={() => {
                  if (item.isFolder) {
                    setSection('my-drive', item._id);
                  } else {
                    setPreviewItem(item);
                  }
                }}
              >
                {/* Name Column */}
                <td className="px-4 py-3 min-w-[220px]">
                  <div className="flex items-center space-x-3">
                    {item.isFolder ? (
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex-shrink-0">
                        <Folder className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800/80 flex-shrink-0">
                        <FileIcon category={item.fileCategory} size={18} />
                      </div>
                    )}
                    <span className="text-sm font-semibold text-zinc-200 group-hover:text-white truncate max-w-xs">
                      {item.title}
                    </span>
                  </div>
                </td>

                {/* Type Column */}
                <td className="px-4 py-3 hidden md:table-cell text-xs font-mono uppercase text-zinc-400">
                  {item.isFolder ? 'Folder' : item.extension || item.fileCategory}
                </td>

                {/* Modified Column */}
                <td className="px-4 py-3 hidden sm:table-cell text-xs font-mono text-zinc-400">
                  {formatRelativeTime(item.updatedAt || item.createdAt)}
                </td>

                {/* Size Column */}
                <td className="px-4 py-3 text-xs font-mono text-zinc-400">
                  {item.isFolder ? '—' : formatBytes(item.fileSizeBytes)}
                </td>

                {/* Actions Column */}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end space-x-1">
                    {!item.isFolder && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStar(item._id);
                          }}
                          title="Star"
                        >
                          <Star
                            className="h-3.5 w-3.5"
                            fill={item.isStarred ? '#f59e0b' : 'none'}
                            color={item.isStarred ? '#f59e0b' : 'currentColor'}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => handleDownload(item, e)}
                          title="Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameTarget(item);
                      }}
                      title="Rename"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMoveTarget(item);
                      }}
                      title="Move"
                    >
                      <FolderInput className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="hover:text-rose-400 hover:bg-rose-500/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        trashOrDelete(item._id);
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
