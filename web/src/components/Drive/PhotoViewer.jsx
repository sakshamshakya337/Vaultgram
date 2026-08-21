import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  Download,
  Share2,
  Trash2,
  StickyNote,
  Cloud,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Calendar,
  HardDrive,
  Sparkles,
  Info,
} from 'lucide-react';
import { api, formatBytes, formatRelativeTime } from '../../services/api';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { useOfflineMedia } from '../../contexts/useOfflineMedia';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { NoteEditModal } from './NoteEditModal';
import { ShareModal } from './ShareModal';

export const PhotoViewer = ({
  photo,
  items = [],
  currentIndex = 0,
  onIndexChange,
  onClose,
  onDelete,
}) => {
  const { toggleLike } = useVideoFeed();
  const { isOfflineAvailable, getOfflinePlaybackUrl, toggleOfflineSave, isCaching } = useOfflineMedia();

  // Active items array
  const activeItems = items.length > 0 ? items : photo ? [photo] : [];
  const [localIndex, setLocalIndex] = useState(currentIndex ?? 0);
  const safeIndex = Math.max(0, Math.min(currentIndex ?? localIndex ?? 0, activeItems.length - 1));
  const currentPhoto = activeItems[safeIndex] || photo;

  // Sub-modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [offlineBlobUrl, setOfflineBlobUrl] = useState(null);

  // UI overlay toggle
  const [showControls, setShowControls] = useState(true);

  // Zoom & Pan state
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isZoomed = scale > 1.05;

  // Touch gesture & Swipe state
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const touchDistanceRef = useRef(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Sync internal index with prop changes
  useEffect(() => {
    if (typeof currentIndex === 'number') {
      setLocalIndex(currentIndex);
    }
  }, [currentIndex]);

  // Reset zoom & pan when photo changes
  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setDragOffset({ x: 0, y: 0 });
  }, [safeIndex]);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    if (safeIndex > 0) {
      const nextIdx = safeIndex - 1;
      setLocalIndex(nextIdx);
      if (onIndexChange) onIndexChange(nextIdx);
    }
  }, [safeIndex, onIndexChange]);

  const handleNext = useCallback(() => {
    if (safeIndex < activeItems.length - 1) {
      const nextIdx = safeIndex + 1;
      setLocalIndex(nextIdx);
      if (onIndexChange) onIndexChange(nextIdx);
    }
  }, [safeIndex, activeItems.length, onIndexChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        if (isDeleteModalOpen) setIsDeleteModalOpen(false);
        else if (isNoteModalOpen) setIsNoteModalOpen(false);
        else if (isShareModalOpen) setIsShareModalOpen(false);
        else if (scale > 1) {
          setScale(1);
          setPan({ x: 0, y: 0 });
        } else if (onClose) {
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === '+' || e.key === '=') {
        setScale((prev) => Math.min(3.5, prev + 0.5));
      } else if (e.key === '-') {
        setScale((prev) => {
          const next = Math.max(1, prev - 0.5);
          if (next === 1) setPan({ x: 0, y: 0 });
          return next;
        });
      } else if (e.key === '0') {
        setScale(1);
        setPan({ x: 0, y: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isDeleteModalOpen, isNoteModalOpen, isShareModalOpen, scale, onClose, handlePrev, handleNext]);

  // ─── Image Preloading (Neighboring items for instant swipe feel) ───────────
  useEffect(() => {
    if (activeItems.length <= 1) return;

    // Preload next image
    if (safeIndex < activeItems.length - 1) {
      const nextItem = activeItems[safeIndex + 1];
      const nextId = nextItem?._id || nextItem?.id;
      if (nextId) {
        const nextUrl = nextItem.streamUrl || api.stream.getUrl(nextId);
        const img = new Image();
        img.src = nextUrl;
      }
    }

    // Preload previous image
    if (safeIndex > 0) {
      const prevItem = activeItems[safeIndex - 1];
      const prevId = prevItem?._id || prevItem?.id;
      if (prevId) {
        const prevUrl = prevItem.streamUrl || api.stream.getUrl(prevId);
        const img = new Image();
        img.src = prevUrl;
      }
    }
  }, [safeIndex, activeItems]);

  // ─── Offline Blob URL Resolution ──────────────────────────────────────────
  const safeFileId = currentPhoto?._id || currentPhoto?.id || null;
  useEffect(() => {
    let active = true;
    if (safeFileId && isOfflineAvailable(safeFileId)) {
      getOfflinePlaybackUrl(safeFileId).then((url) => {
        if (active && url) setOfflineBlobUrl(url);
      });
    } else {
      setOfflineBlobUrl(null);
    }
    return () => {
      active = false;
    };
  }, [safeFileId, isOfflineAvailable, getOfflinePlaybackUrl]);

  if (!currentPhoto) return null;

  const fileId = currentPhoto._id || currentPhoto.id;
  const streamUrl = currentPhoto.streamUrl || api.stream.getUrl(fileId);
  const downloadUrl = api.stream.getUrl(fileId, true);
  const isStarred = !!currentPhoto.isStarred;
  const activeSrc = offlineBlobUrl || streamUrl;
  const isCached = isOfflineAvailable(fileId);
  const caching = isCaching(fileId);

  // ─── Delete Handler ───────────────────────────────────────────────────────
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
      alert(err.message || 'Failed to delete photo');
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Touch & Swipe Gestures (Mobile) ──────────────────────────────────────
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      // Pinch to zoom start
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      touchDistanceRef.current = dist;
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };

      if (isZoomed) {
        isPanningRef.current = true;
        panStartRef.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y };
      } else {
        setIsDragging(true);
      }
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && touchDistanceRef.current) {
      // Pinch to zoom move
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const factor = currentDist / touchDistanceRef.current;
      setScale((prev) => Math.max(1, Math.min(3.5, prev * factor)));
      touchDistanceRef.current = currentDist;
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];

      if (isZoomed && isPanningRef.current) {
        // Pan the zoomed image
        setPan({
          x: touch.clientX - panStartRef.current.x,
          y: touch.clientY - panStartRef.current.y,
        });
        return;
      }

      if (!isZoomed && isDragging) {
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = touch.clientY - touchStartRef.current.y;

        // Apply resistance at edges
        let adjustedX = deltaX;
        if ((safeIndex === 0 && deltaX > 0) || (safeIndex === activeItems.length - 1 && deltaX < 0)) {
          adjustedX = deltaX * 0.25;
        }

        // Horizontal swipe primary, vertical swipe down secondary
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          setDragOffset({ x: adjustedX, y: 0 });
        } else if (deltaY > 0) {
          // Swipe down to dismiss
          setDragOffset({ x: 0, y: deltaY });
        }
      }
    }
  };

  const handleTouchEnd = (e) => {
    touchDistanceRef.current = null;
    isPanningRef.current = false;
    setIsDragging(false);

    if (isZoomed) return;

    const deltaX = dragOffset.x;
    const deltaY = dragOffset.y;
    const SWIPE_THRESHOLD = 60;
    const DISMISS_THRESHOLD = 110;

    // Swipe Down Dismiss
    if (deltaY > DISMISS_THRESHOLD) {
      if (onClose) onClose();
      return;
    }

    // Horizontal Swipe Prev / Next
    if (deltaX < -SWIPE_THRESHOLD && safeIndex < activeItems.length - 1) {
      handleNext();
    } else if (deltaX > SWIPE_THRESHOLD && safeIndex > 0) {
      handlePrev();
    }

    // Snap back
    setDragOffset({ x: 0, y: 0 });
  };

  // ─── Double Tap / Double Click to Zoom ────────────────────────────────────
  const handleDoubleTap = (e) => {
    const now = Date.now();
    const touch = e.changedTouches ? e.changedTouches[0] : e;
    const timeSinceLast = now - lastTapRef.current.time;

    if (timeSinceLast < 300 && timeSinceLast > 0) {
      // Double tap detected: toggle zoom
      if (scale > 1) {
        setScale(1);
        setPan({ x: 0, y: 0 });
      } else {
        setScale(2.5);
      }
      lastTapRef.current = { time: 0, x: 0, y: 0 };
    } else {
      lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
    }
  };

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.2 : 0.8;
      setScale((prev) => {
        const next = Math.max(1, Math.min(4, prev * zoomFactor));
        if (next === 1) setPan({ x: 0, y: 0 });
        return next;
      });
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black select-none overflow-hidden touch-none"
        style={{
          opacity: dragOffset.y > 0 ? Math.max(0.3, 1 - dragOffset.y / 300) : 1,
          transition: isDragging ? 'none' : 'opacity 0.2s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {/* ─── Top Floating Overlay ───────────────────────────────────────── */}
        <div
          className={`fixed top-0 inset-x-0 z-50 flex items-center justify-between p-4 md:p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300 pointer-events-auto ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Top Left: Title & Counter */}
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm md:text-base font-bold text-white truncate drop-shadow-md" title={currentPhoto.title}>
                  {currentPhoto.title || 'Untitled Photo'}
                </h3>
                {activeItems.length > 1 && (
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-white/15 text-zinc-200 shrink-0 font-bold backdrop-blur-md border border-white/10">
                    {safeIndex + 1} / {activeItems.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-semibold text-cyan-400">
                  #{currentPhoto.category || 'General'}
                </span>
                {currentPhoto.createdAt && (
                  <span className="text-[10px] text-zinc-400 font-mono">
                    • {formatRelativeTime(currentPhoto.createdAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Top Right: Action Buttons */}
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            {/* Zoom Toggle */}
            <button
              onClick={() => {
                if (scale > 1) {
                  setScale(1);
                  setPan({ x: 0, y: 0 });
                } else {
                  setScale(2.5);
                }
              }}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white transition-all backdrop-blur-md cursor-pointer"
              title={scale > 1 ? 'Reset Zoom (0)' : 'Zoom In (+)'}
              aria-label="Toggle Zoom"
            >
              {scale > 1 ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
            </button>

            {/* Offline Cache Button */}
            <button
              onClick={() => toggleOfflineSave(currentPhoto)}
              disabled={caching}
              className={`w-9 h-9 md:w-10 md:h-10 rounded-full border flex items-center justify-center transition-all backdrop-blur-md cursor-pointer ${
                isCached
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-md shadow-emerald-500/20'
                  : 'bg-white/10 hover:bg-white/20 border-white/10 text-zinc-300 hover:text-white'
              }`}
              title={isCached ? 'Available Offline' : 'Save for Offline Access'}
            >
              {caching ? (
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              ) : (
                <Cloud className={`w-4 h-4 ${isCached ? 'fill-emerald-400 text-emerald-400' : ''}`} />
              )}
            </button>

            {/* Like / Favorite Button */}
            <button
              onClick={() => toggleLike(fileId)}
              className={`w-9 h-9 md:w-10 md:h-10 rounded-full border flex items-center justify-center transition-all backdrop-blur-md cursor-pointer ${
                isStarred
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 shadow-md shadow-rose-500/20 scale-105'
                  : 'bg-white/10 hover:bg-white/20 border-white/10 text-zinc-300 hover:text-rose-400'
              }`}
              title={isStarred ? 'Unstar Photo' : 'Star / Favorite'}
            >
              <Heart className={`w-4 h-4 ${isStarred ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>

            {/* Download Button */}
            <a
              href={downloadUrl}
              download={currentPhoto.title || 'photo'}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-cyan-400 transition-all backdrop-blur-md cursor-pointer"
              title="Download Full Resolution Photo"
              aria-label="Download Photo"
            >
              <Download className="w-4 h-4" />
            </a>

            {/* Note Button */}
            <button
              onClick={() => setIsNoteModalOpen(true)}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-amber-400 transition-all backdrop-blur-md cursor-pointer"
              title="Add / Edit Note"
            >
              <StickyNote className="w-4 h-4" />
            </button>

            {/* Share Button */}
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-blue-400 transition-all backdrop-blur-md cursor-pointer"
              title="Share Link"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Delete Button */}
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/10 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 flex items-center justify-center text-zinc-400 hover:text-rose-400 transition-all backdrop-blur-md cursor-pointer"
              title="Delete Photo"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition-all backdrop-blur-md cursor-pointer ml-1"
              title="Close Viewer (Escape)"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ─── Desktop Left Chevron Arrow ─────────────────────────────────── */}
        {activeItems.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            disabled={safeIndex <= 0}
            className={`fixed left-4 md:left-6 top-1/2 -translate-y-1/2 z-50 hidden sm:flex w-12 h-12 md:w-14 md:h-14 rounded-full items-center justify-center border transition-all duration-200 backdrop-blur-xl shadow-2xl cursor-pointer ${
              safeIndex > 0
                ? 'bg-black/60 hover:bg-black/90 border-white/20 hover:border-cyan-500/50 text-white hover:scale-110 active:scale-95'
                : 'bg-black/30 border-white/5 text-zinc-600 opacity-40 cursor-not-allowed pointer-events-none'
            }`}
            aria-label="Previous Photo (Left Arrow)"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>
        )}

        {/* ─── Desktop Right Chevron Arrow ────────────────────────────────── */}
        {activeItems.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            disabled={safeIndex >= activeItems.length - 1}
            className={`fixed right-4 md:right-6 top-1/2 -translate-y-1/2 z-50 hidden sm:flex w-12 h-12 md:w-14 md:h-14 rounded-full items-center justify-center border transition-all duration-200 backdrop-blur-xl shadow-2xl cursor-pointer ${
              safeIndex < activeItems.length - 1
                ? 'bg-black/60 hover:bg-black/90 border-white/20 hover:border-cyan-500/50 text-white hover:scale-110 active:scale-95'
                : 'bg-black/30 border-white/5 text-zinc-600 opacity-40 cursor-not-allowed pointer-events-none'
            }`}
            aria-label="Next Photo (Right Arrow)"
          >
            <ChevronRight className="w-7 h-7" />
          </button>
        )}

        {/* ─── Main Hero Photo Display ────────────────────────────────────── */}
        <div
          className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
          onClick={() => setShowControls((prev) => !prev)}
          onDoubleClick={handleDoubleTap}
        >
          <img
            key={fileId}
            src={activeSrc}
            alt={currentPhoto.title || 'Photo'}
            className="w-full h-full object-contain pointer-events-none select-none max-w-[100vw] max-h-[100vh]"
            style={{
              transform: `translate3d(${dragOffset.x + pan.x}px, ${dragOffset.y + pan.y}px, 0) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)',
              willChange: 'transform',
            }}
            draggable={false}
          />
        </div>

        {/* ─── Bottom Floating Metadata Bar ──────────────────────────────── */}
        <div
          className={`fixed bottom-0 inset-x-0 z-50 flex items-center justify-between p-4 md:px-8 md:py-5 bg-gradient-to-t from-black/85 via-black/40 to-transparent transition-opacity duration-300 pointer-events-auto ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-4 text-xs text-zinc-300 font-mono">
            {currentPhoto.fileSizeBytes ? (
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                <span>{formatBytes(currentPhoto.fileSizeBytes)}</span>
              </span>
            ) : null}
            {currentPhoto.extension && (
              <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                {currentPhoto.extension}
              </span>
            )}
            {currentPhoto.note && (
              <span className="hidden sm:inline-block text-amber-300/90 text-xs italic truncate max-w-xs">
                📝 "{currentPhoto.note}"
              </span>
            )}
          </div>

          {currentPhoto.description && (
            <p className="text-xs text-zinc-300 max-w-sm truncate hidden md:block">
              {currentPhoto.description}
            </p>
          )}
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        file={currentPhoto}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* Note Edit Modal */}
      <NoteEditModal
        isOpen={isNoteModalOpen}
        file={currentPhoto}
        onClose={() => setIsNoteModalOpen(false)}
        onNoteUpdated={(id, newNote) => {
          currentPhoto.note = newNote;
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Photo"
        itemName={currentPhoto?.title || 'this photo'}
        itemType="file"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </>
  );
};
