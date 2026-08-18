import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Heart,
  Image as ImageIcon,
} from 'lucide-react';
import { useMedia } from '../../contexts/MediaContext';
import { useAuth } from '../../contexts/AuthContext';
import api, { formatBytes, formatRelativeTime } from '../../services/api';

export const ImageLightbox = () => {
  const { lightboxState, closeLightbox, toggleLike } = useMedia();
  const { isAuthenticated } = useAuth();
  const { isOpen, index, items } = lightboxState;

  const [currentIndex, setCurrentIndex] = useState(index);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    setCurrentIndex(index);
    setZoomLevel(1);
  }, [index, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, items]);

  if (!isOpen || !items || items.length === 0) return null;

  const currentItem = items[currentIndex] || items[0];
  const streamUrl = api.stream.getUrl(currentItem._id);
  const imageSrc = currentItem.thumbnail || streamUrl;

  const handlePrev = () => {
    setZoomLevel(1);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
  };

  const handleNext = () => {
    setZoomLevel(1);
    setCurrentIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = streamUrl;
    a.download = `${currentItem.title || 'photo'}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.95)', zIndex: 120 }} onClick={closeLightbox}>
      {/* Top Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)',
          zIndex: 10,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ImageIcon size={20} color="#38bdf8" />
          <span style={{ fontWeight: '700', fontSize: '1rem', color: '#fff' }}>
            {currentItem.title}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            ({currentIndex + 1} of {items.length})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Zoom controls */}
          <button
            className="btn-icon"
            onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>
          <button
            className="btn-icon"
            onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <button
            className="btn-icon"
            onClick={() => setZoomLevel(1)}
            title="Reset Zoom"
          >
            <RotateCcw size={16} />
          </button>

          <button className="btn-icon" onClick={handleDownload} title="Download Full Resolution">
            <Download size={18} />
          </button>

          <button className="btn-icon" onClick={closeLightbox} title="Close">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Image Display */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '60px 40px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageSrc}
          alt={currentItem.title}
          style={{
            maxWidth: '90vw',
            maxHeight: '80vh',
            objectFit: 'contain',
            transform: `scale(${zoomLevel})`,
            transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
          }}
        />

        {/* Previous Button */}
        {items.length > 1 && (
          <button
            className="btn-icon"
            style={{
              position: 'absolute',
              left: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '48px',
              height: '48px',
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
            }}
            onClick={handlePrev}
            aria-label="Previous image"
          >
            <ChevronLeft size={28} />
          </button>
        )}

        {/* Next Button */}
        {items.length > 1 && (
          <button
            className="btn-icon"
            style={{
              position: 'absolute',
              right: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '48px',
              height: '48px',
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
            }}
            onClick={handleNext}
            aria-label="Next image"
          >
            <ChevronRight size={28} />
          </button>
        )}
      </div>

      {/* Bottom Info Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <span>{currentItem.category || 'General'}</span>
          <span> • </span>
          <span>{formatBytes(currentItem.fileSizeBytes)}</span>
          <span> • </span>
          <span>{formatRelativeTime(currentItem.createdAt)}</span>
        </div>
      </div>
    </div>
  );
};
