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
  FolderSymlink,
  MoreVertical,
  X
} from 'lucide-react';
import { api, formatBytes, formatDuration, getFileKind } from '../../services/api';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { useOfflineMedia } from '../../contexts/useOfflineMedia';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { NoteEditModal } from './NoteEditModal';
import { ShareModal } from './ShareModal';

export const DriveFilesGrid = ({
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
  const [mobileMenuFile, setMobileMenuFile] = useState(null);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
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
                // If user clicks while in editing mode, don't open
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
              className={`group relative rounded-2xl border overflow-hidden shadow-lg transition-all duration-200 cursor-pointer flex flex-col ${
                isSelected
                  ? 'bg-cyan-950/40 border-cyan-500 ring-2 ring-cyan-500/30'
                  : isFocused
                  ? 'bg-zinc-900 border-cyan-500/60 ring-2 ring-cyan-500/20'
                  : 'bg-zinc-900/50 hover:bg-zinc-900 border-white/5 hover:border-cyan-500/30'
              }`}
            >
              {/* Selection Checkbox (Top-Left Corner) */}
              <div
                className={`absolute top-2.5 left-2.5 z-20 transition-all ${
                  isSelected || hasActiveSelection ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect?.(videoId, e, index);
                }}
              >
                <button
                  className={`w-6 h-6 rounded-lg flex items-center justify-center backdrop-blur-md transition-all shadow-md cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-500 text-black border border-cyan-400'
                      : 'bg-zinc-900/80 text-white/60 hover:text-white border border-white/20 hover:bg-zinc-800'
                  }`}
                  title={isSelected ? 'Deselect file' : 'Select file'}
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 fill-cyan-500 stroke-black stroke-[2.5]" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Thumbnail / Media Preview Area */}
              <div className="relative w-full aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden">
                {isImage ? (
                  <>
                    <img
                      src={video.thumbnail || video.streamUrl || api.stream.getUrl(videoId)}
                      alt={video.title || 'Photo'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.photo-fallback');
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="photo-fallback hidden w-full h-full bg-gradient-to-tr from-emerald-950/20 to-zinc-950 items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                    </div>
                  </>
                ) : isVideo && (video.thumbnail || video.thumbnailFileId) ? (
                  <>
                    <img
                      src={video.thumbnail || api.videos.getThumbnailUrl(videoId)}
                      alt={video.title || 'Video thumbnail'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.video-fallback');
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="video-fallback hidden w-full h-full bg-gradient-to-tr from-cyan-950/20 to-zinc-950 items-center justify-center">
                      <Video className="w-8 h-8 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
                    </div>
                  </>
                ) : isVideo ? (
                  <div className="w-full h-full bg-gradient-to-tr from-cyan-950/20 to-zinc-950 flex items-center justify-center">
                    <Video className="w-8 h-8 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
                  </div>
                ) : isAudio ? (
                  <div className="w-full h-full bg-gradient-to-tr from-purple-950/20 to-zinc-950 flex items-center justify-center">
                    <Music className="w-8 h-8 text-purple-400/80 group-hover:text-purple-300 transition-colors" />
                  </div>
                ) : (
                  /* Document File Preview */
                  <div className="w-full h-full bg-gradient-to-tr from-amber-950/20 to-zinc-950 flex flex-col items-center justify-center gap-1 p-3">
                    <FileText className="w-8 h-8 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-mono font-bold text-amber-300/80 uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                      {extension}
                    </span>
                  </div>
                )}

                {/* Offline Available Badge */}
                {isOffline && (
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/90 text-black text-[10px] font-bold shadow-md backdrop-blur-md">
                    <span>Offline</span>
                  </div>
                )}

                {/* Duration Badge for Videos and Audios */}
                {(isVideo || isAudio) && video.duration ? (
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono text-zinc-300 font-semibold">
                    {formatDuration(video.duration)}
                  </div>
                ) : null}

                {/* Document Type Badge in Corner */}
                {isDocument && (
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[9px] font-mono text-amber-300 font-semibold">
                    {extension}
                  </div>
                )}

                {/* Hover Action Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform ${
                    isVideo || isAudio
                      ? 'bg-cyan-500 text-black shadow-cyan-500/40'
                      : isImage
                      ? 'bg-emerald-500 text-black shadow-emerald-500/40'
                      : 'bg-amber-500 text-black shadow-amber-500/40'
                  }`}>
                    {isVideo || isAudio ? (
                      <Play className="w-5 h-5 fill-black ml-0.5" />
                    ) : isImage ? (
                      <Eye className="w-5 h-5 text-black" />
                    ) : (
                      <FileText className="w-5 h-5 text-black" />
                    )}
                  </div>
                </div>
              </div>

              {/* File Metadata Card Body */}
              <div className="p-3.5 flex flex-col justify-between flex-1 gap-2">
                <div className="min-w-0">
                  {/* Inline Editable Title or Title Display */}
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
                        className="w-full px-2 py-1 rounded-lg bg-zinc-950 border border-cyan-500 text-white text-xs font-bold focus:outline-none focus:ring-1 focus:ring-cyan-400"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between group/title">
                      <h4
                        onDoubleClick={(e) => handleStartRename(e, video)}
                        className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate select-text"
                        title={`${video.title} (Double-click to rename)`}
                      >
                        {video.title || 'Untitled'}
                      </h4>
                      <button
                        onClick={(e) => handleStartRename(e, video)}
                        className="opacity-0 group-hover/title:opacity-100 p-1 text-zinc-500 hover:text-cyan-400 transition-opacity ml-1 shrink-0"
                        title="Rename file"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                      #{video.category || 'General'}
                    </span>
                  </div>

                  {/* Note Subtitle Tooltip if Present */}
                  {video.note && (
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 truncate" title={video.note}>
                      <StickyNote className="w-3 h-3 shrink-0 text-amber-400" />
                      <span className="truncate">{video.note}</span>
                    </div>
                  )}
                </div>

                {/* Bottom Details & Quick Actions */}
                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono pt-2 border-t border-white/5 h-8">
                  <div className="flex items-center gap-1.5 shrink-0 text-zinc-400">
                    {video.fileSizeBytes ? (
                      <span>{formatBytes(video.fileSizeBytes)}</span>
                    ) : null}
                  </div>

                  {/* Desktop Action Buttons (Hover) */}
                  <div className="hidden md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    {/* Add/Edit Note Button */}
                    <button
                      onClick={() => setNoteTarget(video)}
                      className={`w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer ${
                        video.note ? 'text-amber-400' : 'text-zinc-400 hover:text-amber-300'
                      }`}
                      title={video.note ? 'Edit Note' : 'Add Note'}
                    >
                      <StickyNote className={`w-3.5 h-3.5 ${video.note ? 'fill-amber-400/20' : ''}`} />
                    </button>

                    {/* Offline Toggle Button */}
                    <button
                      onClick={() => toggleOfflineSave(video)}
                      disabled={caching}
                      className={`w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer ${
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

                    {/* Like / Star Button */}
                    <button
                      onClick={() => toggleLike(videoId)}
                      className={`w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer ${
                        isStarred ? 'text-rose-500' : 'text-zinc-400 hover:text-white'
                      }`}
                      title={isStarred ? 'Liked' : 'Like'}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isStarred ? 'fill-rose-500' : ''}`} />
                    </button>

                    {/* Download Button */}
                    <a
                      href={downloadUrl}
                      download={video.title || 'download'}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>

                    {/* Move Button */}
                    {onMoveVideo && (
                      <button
                        onClick={() => onMoveVideo(video)}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-purple-400 hover:bg-white/10 transition-colors cursor-pointer"
                        title="Move to..."
                      >
                        <FolderSymlink className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Share Button */}
                    <button
                      onClick={() => (onShareVideo ? onShareVideo(video) : setShareTarget(video))}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-cyan-400 hover:bg-white/10 transition-colors cursor-pointer"
                      title="Share File"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => setDeleteTarget(video)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete File"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Mobile Action Buttons (Touch Friendly) */}
                  <div className="md:hidden flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setMobileMenuFile(video)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Single Item Modal */}
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
