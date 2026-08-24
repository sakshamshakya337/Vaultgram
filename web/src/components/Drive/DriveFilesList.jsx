import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Heart,
  Download,
  Trash2,
  Video,
  Cloud,
  Loader2,
  StickyNote,
  Share2,
  FileText,
  Image as ImageIcon,
  Music,
  Eye,
  CheckSquare,
  Square,
  Edit2,
  FolderSymlink
} from 'lucide-react';
import { api, formatBytes, formatDuration, formatRelativeTime, getFileKind } from '../../services/api';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { useOfflineMedia } from '../../contexts/useOfflineMedia';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { NoteEditModal } from './NoteEditModal';
import { ShareModal } from './ShareModal';

export const DriveFilesList = ({
  videos,
  onSelectVideo,
  onDeleteVideo,
  selectedFileIds = [],
  onToggleSelect,
  focusedIndex = -1,
  onContextMenu,
  onRenameVideo,
  onMoveVideo,
  onShareVideo,
}) => {
  const { toggleLike } = useVideoFeed();
  const { isOfflineAvailable, toggleOfflineSave, isCaching } = useOfflineMedia();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [noteTarget, setNoteTarget] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);

  // Inline rename state
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const editInputRef = useRef(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  if (!videos || videos.length === 0) return null;

  const handleStartRename = (e, video) => {
    e.stopPropagation();
    setEditingId(video._id || video.id);
    setEditingTitle(video.title || '');
  };

  const handleSaveRename = async (video) => {
    const vId = video._id || video.id;
    const cleanTitle = editingTitle.trim();

    if (!cleanTitle || cleanTitle === video.title) {
      setEditingId(null);
      return;
    }

    try {
      if (onRenameVideo) {
        await onRenameVideo(vId, cleanTitle);
      } else {
        await api.drive.rename(vId, cleanTitle);
      }
    } catch (err) {
      console.error('[handleSaveRename error]:', err);
      alert(err.message || 'Failed to rename file');
    } finally {
      setEditingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (onDeleteVideo) {
        await onDeleteVideo(deleteTarget._id || deleteTarget.id);
      } else {
        await api.drive.delete(deleteTarget._id || deleteTarget.id);
      }
      setDeleteTarget(null);
    } catch (err) {
      alert(err.message || 'Failed to delete file');
    } finally {
      setIsDeleting(false);
    }
  };

  const hasActiveSelection = selectedFileIds.length > 0;

  return (
    <>
      <div className="rounded-2xl bg-zinc-900/40 border border-white/5 overflow-hidden shadow-lg select-none">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-900/60 items-center">
          <div className="col-span-6 sm:col-span-5 flex items-center gap-3">
            <span className="w-5"></span>
            <span>Name</span>
          </div>
          <div className="col-span-2 hidden sm:block">Category</div>
          <div className="col-span-2 sm:col-span-2 text-right">Size</div>
          <div className="col-span-4 sm:col-span-3 text-right pr-2">Actions</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/5">
          {videos.map((video, index) => {
            const videoId = video._id || video.id;
            const isSelected = selectedFileIds.includes(videoId);
            const isFocused = focusedIndex === index;
            const isEditing = editingId === videoId;
            const isStarred = !!video.isStarred;
            const isOffline = isOfflineAvailable(videoId);
            const caching = isCaching(videoId);
            const downloadUrl = api.stream.getUrl(videoId, true);
            const { isVideo, isImage, isAudio, isDocument, extension } = getFileKind(video);

            return (
              <div
                key={videoId}
                onClick={(e) => {
                  if (isEditing) return;
                  if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    e.preventDefault();
                    onToggleSelect?.(videoId, e, index);
                  } else {
                    onSelectVideo(video, index);
                  }
                }}
                onContextMenu={(e) => {
                  if (onContextMenu) {
                    e.preventDefault();
                    e.stopPropagation();
                    onContextMenu(e, video);
                  }
                }}
                className={`grid grid-cols-12 gap-4 px-4 py-3 items-center transition-colors cursor-pointer group text-xs text-zinc-300 ${
                  isSelected
                    ? 'bg-cyan-950/40 border-l-4 border-l-cyan-500 text-white'
                    : isFocused
                    ? 'bg-zinc-800/60 text-white'
                    : 'hover:bg-white/[0.03]'
                }`}
              >
                {/* File Checkbox + Title + Thumbnail */}
                <div className="col-span-6 sm:col-span-5 flex items-center gap-3 min-w-0">
                  {/* Row Checkbox */}
                  <div
                    className={`shrink-0 transition-opacity ${
                      isSelected || hasActiveSelection ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect?.(videoId, e, index);
                    }}
                  >
                    <button
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500 text-black'
                          : 'bg-zinc-800 text-white/60 hover:text-white border border-white/20'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 fill-cyan-500 stroke-black stroke-[2.5]" />
                      ) : (
                        <Square className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  <div className="w-10 h-7 rounded-lg bg-zinc-950 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative">
                    {isImage ? (
                      <img
                        src={video.thumbnail || video.streamUrl || api.stream.getUrl(videoId)}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : isVideo && (video.thumbnail || video.thumbnailFileId) ? (
                      <img
                        src={video.thumbnail || api.videos.getThumbnailUrl(videoId)}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : isVideo ? (
                      <Video className="w-4 h-4 text-cyan-400/80" />
                    ) : isImage ? (
                      <ImageIcon className="w-4 h-4 text-emerald-400/80" />
                    ) : isAudio ? (
                      <Music className="w-4 h-4 text-purple-400/80" />
                    ) : (
                      <FileText className="w-4 h-4 text-amber-400/80" />
                    )}

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                      {isVideo || isAudio ? (
                        <Play className="w-3 h-3 text-cyan-400 fill-cyan-400" />
                      ) : isImage ? (
                        <Eye className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <FileText className="w-3 h-3 text-amber-400" />
                      )}
                    </div>
                  </div>

                  {/* Title or Inline Edit */}
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => handleSaveRename(video)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveRename(video);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setEditingId(null);
                            }
                          }}
                          className="w-full px-2 py-0.5 rounded bg-zinc-950 border border-cyan-500 text-white text-xs font-bold focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 group/title">
                        <span
                          onDoubleClick={(e) => handleStartRename(e, video)}
                          className="font-medium text-white truncate max-w-xs group-hover:text-cyan-300 transition-colors select-text"
                          title={`${video.title} (Double-click to rename)`}
                        >
                          {video.title || 'Untitled'}
                        </span>
                        <button
                          onClick={(e) => handleStartRename(e, video)}
                          className="opacity-0 group-hover/title:opacity-100 p-0.5 text-zinc-500 hover:text-cyan-400 transition-opacity"
                          title="Rename file"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    {video.note && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-300/80 truncate mt-0.5" title={video.note}>
                        <StickyNote className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                        <span className="truncate">{video.note}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Category */}
                <div className="col-span-2 hidden sm:block">
                  <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    #{video.category || 'General'}
                  </span>
                </div>

                {/* Size */}
                <div className="col-span-2 sm:col-span-2 text-right font-mono text-[11px] text-zinc-400">
                  {video.fileSizeBytes ? formatBytes(video.fileSizeBytes) : '—'}
                </div>

                {/* Actions */}
                <div className="col-span-4 sm:col-span-3 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  {/* Edit Note */}
                  <button
                    onClick={() => setNoteTarget(video)}
                    className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
                      video.note ? 'text-amber-400' : 'text-zinc-400 hover:text-amber-300'
                    }`}
                    title={video.note ? 'Edit Note' : 'Add Note'}
                  >
                    <StickyNote className={`w-3.5 h-3.5 ${video.note ? 'fill-amber-400/20' : ''}`} />
                  </button>

                  {/* Offline Toggle */}
                  <button
                    onClick={() => toggleOfflineSave(video)}
                    disabled={caching}
                    className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
                      isOffline ? 'text-emerald-400' : 'text-zinc-400 hover:text-cyan-400'
                    }`}
                    title={caching ? 'Saving offline...' : isOffline ? 'Remove from offline' : 'Make available offline'}
                  >
                    {caching ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    ) : (
                      <Cloud className={`w-3.5 h-3.5 ${isOffline ? 'fill-emerald-400/20' : ''}`} />
                    )}
                  </button>

                  {/* Like/Star */}
                  <button
                    onClick={() => toggleLike(videoId)}
                    className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
                      isStarred ? 'text-rose-500' : 'text-zinc-400 hover:text-white'
                    }`}
                    title={isStarred ? 'Liked' : 'Like'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isStarred ? 'fill-rose-500' : ''}`} />
                  </button>

                  {/* Download */}
                  <a
                    href={downloadUrl}
                    download={video.title || 'download'}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>

                  {/* Move to... */}
                  {onMoveVideo && (
                    <button
                      onClick={() => onMoveVideo(video)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-purple-400 hover:bg-white/10 transition-colors cursor-pointer"
                      title="Move to..."
                    >
                      <FolderSymlink className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Share */}
                  <button
                    onClick={() => (onShareVideo ? onShareVideo(video) : setShareTarget(video))}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-cyan-400 hover:bg-white/10 transition-colors cursor-pointer"
                    title="Share File"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => setDeleteTarget(video)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Delete File"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        videoTitle={deleteTarget?.title}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Note Edit Modal */}
      <NoteEditModal
        isOpen={!!noteTarget}
        onClose={() => setNoteTarget(null)}
        video={noteTarget}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={!!shareTarget}
        onClose={() => setShareTarget(null)}
        target={shareTarget}
      />
    </>
  );
};
