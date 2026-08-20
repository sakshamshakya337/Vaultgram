import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  X,
  Play,
  Heart,
  Download,
  Trash2,
  Clock,
  HardDrive,
  Eye,
  ChevronLeft,
  ChevronRight,
  Music,
  FileText,
  Image as ImageIcon,
  Cloud,
  Loader2,
  StickyNote,
  Share2,
} from 'lucide-react';
import { api, formatBytes, formatDuration, formatViews, formatRelativeTime } from '../../services/api';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { useOfflineMedia } from '../../contexts/useOfflineMedia';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { NoteEditModal } from './NoteEditModal';
import { ShareModal } from './ShareModal';

export const DesktopVideoModal = ({
  video,
  items = [],
  currentIndex = 0,
  initialIndex = 0,
  onIndexChange,
  onClose,
  onDelete,
}) => {
  const videoRef = useRef(null);
  const backdropPointerRef = useRef(false);
  const { toggleLike } = useVideoFeed();
  const { isOfflineAvailable, getOfflinePlaybackUrl, toggleOfflineSave, isCaching } = useOfflineMedia();

  const [localIndex, setLocalIndex] = useState(currentIndex ?? initialIndex ?? 0);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [offlineBlobUrl, setOfflineBlobUrl] = useState(null);

  // Derive the active list of files
  const activeItems = items && items.length > 0 ? items : (video ? [video] : []);
  
  // Use controlled currentIndex if provided, otherwise fallback to local state
  const activeIndex = typeof currentIndex === 'number' ? currentIndex : localIndex;
  const safeIndex = Math.max(0, Math.min(activeIndex, Math.max(0, activeItems.length - 1)));
  const currentFile = activeItems[safeIndex] || video;

  // Ensure unmuted audio and volume 1.0 on video element
  useEffect(() => {
    if (videoRef.current) {
      const vid = videoRef.current;
      vid.volume = 1.0;
      vid.muted = false;
      const p = vid.play();
      if (p !== undefined) {
        p.catch((err) => {
          // If browser strictly blocks unmuted autoplay without prior interaction, fallback to muted
          if (err.name === 'NotAllowedError') {
            vid.muted = true;
            vid.play().catch(() => {});
          }
        });
      }
    }
  }, [currentFile?._id, currentFile?.id]);

  // Previous item handler
  const handlePrev = useCallback(() => {
    if (safeIndex > 0) {
      const nextIdx = safeIndex - 1;
      setLocalIndex(nextIdx);
      if (onIndexChange) {
        onIndexChange(nextIdx);
      }
    }
  }, [safeIndex, onIndexChange]);

  // Next item handler
  const handleNext = useCallback(() => {
    if (safeIndex < activeItems.length - 1) {
      const nextIdx = safeIndex + 1;
      setLocalIndex(nextIdx);
      if (onIndexChange) {
        onIndexChange(nextIdx);
      }
    }
  }, [safeIndex, activeItems.length, onIndexChange]);

  // Keyboard navigation: Left/Right arrow keys & Escape
  useEffect(() => {
    if (!currentFile) return;

    const handleKeyDown = (e) => {
      // Do not capture if typing in form inputs
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        if (isDeleteModalOpen) {
          setIsDeleteModalOpen(false);
        } else if (onClose) {
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        handleNext();
      }
    };

    // Use capture phase to ensure arrow key events are caught
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [currentFile, isDeleteModalOpen, onClose, handlePrev, handleNext]);

  if (!currentFile) return null;

  const fileId = currentFile._id || currentFile.id;
  const streamUrl = currentFile.streamUrl || api.stream.getUrl(fileId);
  const downloadUrl = api.stream.getUrl(fileId, true);
  const isStarred = !!currentFile.isStarred;
  const rawFileType = currentFile.fileType || currentFile.fileCategory || 'video';
  const isVideo = rawFileType === 'video' || (!rawFileType && currentFile.duration > 0);
  const isImage = rawFileType === 'image';
  const isAudio = rawFileType === 'audio';

  const thumbUrl = currentFile.thumbnail || (currentFile.thumbnailFileId ? api.videos.getThumbnailUrl(fileId) : '');

  useEffect(() => {
    let active = true;
    if (fileId && isOfflineAvailable(fileId)) {
      getOfflinePlaybackUrl(fileId).then((url) => {
        if (active && url) setOfflineBlobUrl(url);
      });
    } else {
      setOfflineBlobUrl(null);
    }
    return () => {
      active = false;
    };
  }, [fileId, isOfflineAvailable, getOfflinePlaybackUrl]);

  const activeStreamSrc = offlineBlobUrl || streamUrl;

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (onDelete) {
        await onDelete(fileId);
      } else {
        await api.drive.delete(fileId);
      }

      const nextList = activeItems.filter((it) => (it._id || it.id) !== fileId);
      if (nextList.length === 0) {
        setIsDeleteModalOpen(false);
        onClose();
      } else {
        const nextIdx = Math.min(safeIndex, nextList.length - 1);
        setLocalIndex(nextIdx);
        if (onIndexChange) onIndexChange(nextIdx);
        setIsDeleteModalOpen(false);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete file');
    } finally {
      setIsDeleting(false);
    }
  };

  const getFileIcon = () => {
    if (isVideo) return <Play className="w-4 h-4 fill-cyan-400 text-cyan-400" />;
    if (isImage) return <ImageIcon className="w-4 h-4 text-emerald-400" />;
    if (isAudio) return <Music className="w-4 h-4 text-purple-400" />;
    return <FileText className="w-4 h-4 text-amber-400" />;
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/85 backdrop-blur-xl animate-fade-in select-none"
        onPointerDown={(e) => {
          // Only mark as backdrop pointer-down if the pointer is directly on the backdrop (not a child)
          backdropPointerRef.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          // Only close if both pointerdown AND click landed directly on the backdrop
          if (backdropPointerRef.current && e.target === e.currentTarget) {
            onClose();
          }
          backdropPointerRef.current = false;
        }}
      >
        {/* On-Screen Left Arrow Navigation Button */}
        {activeItems.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handlePrev();
            }}
            disabled={safeIndex <= 0}
            className={`fixed left-3 md:left-6 top-1/2 -translate-y-1/2 z-[60] pointer-events-auto w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center border transition-all duration-200 shadow-2xl backdrop-blur-xl cursor-pointer ${
              safeIndex > 0
                ? 'bg-black/70 hover:bg-black/90 border-white/20 hover:border-cyan-500/50 text-white hover:scale-110 active:scale-95'
                : 'bg-black/30 border-white/5 text-zinc-600 opacity-40 cursor-not-allowed pointer-events-none'
            }`}
            aria-label="Previous file"
            title="Previous file (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6 md:w-7 md:h-7" />
          </button>
        )}

        {/* On-Screen Right Arrow Navigation Button */}
        {activeItems.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleNext();
            }}
            disabled={safeIndex >= activeItems.length - 1}
            className={`fixed right-3 md:right-6 top-1/2 -translate-y-1/2 z-[60] pointer-events-auto w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center border transition-all duration-200 shadow-2xl backdrop-blur-xl cursor-pointer ${
              safeIndex < activeItems.length - 1
                ? 'bg-black/70 hover:bg-black/90 border-white/20 hover:border-cyan-500/50 text-white hover:scale-110 active:scale-95'
                : 'bg-black/30 border-white/5 text-zinc-600 opacity-40 cursor-not-allowed pointer-events-none'
            }`}
            aria-label="Next file"
            title="Next file (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6 md:w-7 md:h-7" />
          </button>
        )}

        {/* Modal Dialog Card */}
        <div
          className="relative w-full max-w-4xl max-h-[90vh] rounded-3xl bg-zinc-950 border border-white/10 shadow-2xl overflow-hidden flex flex-col z-10"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Top Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-zinc-900/60 shrink-0">
            <div className="flex items-center gap-3 min-w-0 pr-4">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                {getFileIcon()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white truncate" title={currentFile.title}>
                    {currentFile.title || 'Untitled File'}
                  </h3>
                  {activeItems.length > 1 && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 shrink-0 font-semibold">
                      {safeIndex + 1} / {activeItems.length}
                    </span>
                  )}
                  {isOfflineAvailable(fileId) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                      Offline
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 flex items-center gap-2">
                  <span className="text-cyan-400 font-semibold">#{currentFile.category || 'General'}</span>
                  <span>•</span>
                  <span>{currentFile.createdAt ? formatRelativeTime(currentFile.createdAt) : 'Recently uploaded'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Note / Reminder Button */}
              <button
                onClick={() => setIsNoteModalOpen(true)}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  currentFile.note
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-white/5 border-white/10 text-zinc-400 hover:text-amber-300 hover:bg-white/10'
                }`}
                title={currentFile.note ? 'Edit Note' : 'Add Note'}
              >
                <StickyNote className={`w-4 h-4 ${currentFile.note ? 'fill-amber-400/20' : ''}`} />
              </button>

              {/* Offline Toggle Button */}
              <button
                onClick={() => toggleOfflineSave(currentFile)}
                disabled={isCaching(fileId)}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  isOfflineAvailable(fileId)
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-white/5 border-white/10 text-zinc-400 hover:text-cyan-400 hover:bg-white/10'
                }`}
                title={isCaching(fileId) ? 'Saving offline...' : isOfflineAvailable(fileId) ? 'Available Offline (Click to remove)' : 'Make available offline'}
              >
                {isCaching(fileId) ? (
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                ) : (
                  <Cloud className={`w-4 h-4 ${isOfflineAvailable(fileId) ? 'fill-emerald-400/20' : ''}`} />
                )}
              </button>

              {/* Like Button */}
              <button
                onClick={() => toggleLike(fileId)}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  isStarred
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                    : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
                title={isStarred ? 'Liked' : 'Like'}
              >
                <Heart className={`w-4 h-4 ${isStarred ? 'fill-rose-500' : ''}`} />
              </button>

              {/* Direct Download */}
              <a
                href={downloadUrl}
                download={currentFile.title || 'download'}
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Download file"
              >
                <Download className="w-4 h-4" />
              </a>

              {/* Share Button */}
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-cyan-400 hover:bg-white/10 transition-colors cursor-pointer"
                title="Share time-limited link"
              >
                <Share2 className="w-4 h-4" />
              </button>

              {/* Delete Button */}
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Delete file"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer ml-1"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* File Note Banner */}
          {currentFile.note && (
            <div
              onClick={() => setIsNoteModalOpen(true)}
              className="flex items-center justify-between px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300 hover:bg-amber-500/15 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0 pr-4">
                <StickyNote className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-semibold text-amber-400 shrink-0">Note:</span>
                <span className="truncate">{currentFile.note}</span>
              </div>
              <span className="text-[10px] font-semibold text-amber-400/80 shrink-0">Edit</span>
            </div>
          )}

          {/* Media Player / Viewer Container */}
          <div className="relative flex-1 min-h-[380px] max-h-[65vh] bg-black flex items-center justify-center overflow-hidden">
            {isVideo ? (
              <video
                key={fileId}
                ref={videoRef}
                src={activeStreamSrc}
                poster={thumbUrl || ''}
                controls
                autoPlay
                playsInline
                className="w-full h-full max-h-[65vh] object-contain"
              />
            ) : isImage ? (
              <img
                key={fileId}
                src={activeStreamSrc}
                alt={currentFile.title || 'Image preview'}
                className="w-full h-full max-h-[65vh] object-contain p-2 animate-fade-in"
              />
            ) : isAudio ? (
              <div key={fileId} className="flex flex-col items-center justify-center p-8 gap-5 animate-fade-in">
                <div className="w-24 h-24 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-xl shadow-purple-500/10">
                  <Music className="w-12 h-12 animate-pulse" />
                </div>
                <div className="text-center">
                  <h4 className="text-sm font-bold text-white mb-1">{currentFile.title}</h4>
                  <p className="text-xs text-zinc-400">{formatBytes(currentFile.fileSizeBytes)}</p>
                </div>
                <audio
                  ref={videoRef}
                  src={activeStreamSrc}
                  controls
                  autoPlay
                  className="w-full max-w-md mt-2"
                />
              </div>
            ) : (
              <div key={fileId} className="flex flex-col items-center justify-center p-8 gap-5 text-center animate-fade-in">
                <div className="w-24 h-24 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/10">
                  <FileText className="w-12 h-12" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">{currentFile.title}</h4>
                  <p className="text-xs text-zinc-400 font-mono">{formatBytes(currentFile.fileSizeBytes)} • {currentFile.extension?.toUpperCase() || 'DOCUMENT'}</p>
                </div>
                <a
                  href={downloadUrl}
                  download={currentFile.title || 'document'}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Document</span>
                </a>
              </div>
            )}
          </div>

          {/* Details Footer */}
          <div className="px-6 py-3.5 border-t border-white/10 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-400 shrink-0">
            <div className="flex items-center gap-4 flex-wrap">
              {currentFile.fileSizeBytes ? (
                <span className="flex items-center gap-1.5 font-mono">
                  <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{formatBytes(currentFile.fileSizeBytes)}</span>
                </span>
              ) : null}
              {currentFile.duration ? (
                <span className="flex items-center gap-1.5 font-mono">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{formatDuration(currentFile.duration)}</span>
                </span>
              ) : null}
              {isVideo && (
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{formatViews(currentFile.views || 0)} views</span>
                </span>
              )}
            </div>

            {currentFile.description && (
              <p className="text-xs text-zinc-300 max-w-md truncate hidden sm:block">
                {currentFile.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        file={currentFile}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* Note Edit Modal */}
      <NoteEditModal
        isOpen={isNoteModalOpen}
        file={currentFile}
        onClose={() => setIsNoteModalOpen(false)}
        onNoteUpdated={(id, newNote) => {
          currentFile.note = newNote;
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete File"
        itemName={currentFile?.title || 'this file'}
        itemType="file"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </>
  );
};
