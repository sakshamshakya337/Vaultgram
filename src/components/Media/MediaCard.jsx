import React, { useState } from 'react';
import {
  Play,
  Heart,
  Trash2,
  Download,
  Image as ImageIcon,
  Film,
  MoreVertical,
  Maximize2,
} from 'lucide-react';
import { useMedia } from '../../contexts/MediaContext';
import { useAuth } from '../../contexts/AuthContext';
import api, { formatBytes, formatDuration, formatRelativeTime } from '../../services/api';

export const MediaCard = ({ item, onOpenAuth }) => {
  const { toggleLike, deleteMediaItem, setSelectedVideo, openLightbox, items } = useMedia();
  const { isAuthenticated } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [imgError, setImgError] = useState(false);

  const isVideo = item.mediaType === 'video' || (!item.mediaType && item.duration > 0);
  const streamUrl = api.stream.getUrl(item._id);

  // Thumbnail fallback hierarchy: thumbnail base64 -> stream proxy url for image -> placeholder
  const thumbnailSrc = item.thumbnail || (!isVideo ? streamUrl : null);

  const handleCardClick = () => {
    if (isVideo) {
      setSelectedVideo(item);
    } else {
      openLightbox(item, items);
    }
  };

  const handleLikeClick = async (e) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      onOpenAuth && onOpenAuth();
      return;
    }
    setLikeLoading(true);
    try {
      const liked = await toggleLike(item._id);
      setIsLiked(liked);
    } catch (err) {
      console.error(err);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleDeleteClick = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${item.title}"?`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteMediaItem(item._id);
    } catch (err) {
      alert(err.message || 'Failed to delete');
      setIsDeleting(false);
    }
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = streamUrl;
    link.download = item.title || 'media';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isDeleting) {
    return (
      <div className="media-card glass-panel" style={{ opacity: 0.5, pointerEvents: 'none', padding: '30px', textAlign: 'center' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Deleting file from cloud...</span>
      </div>
    );
  }

  return (
    <div className="media-card" onClick={handleCardClick}>
      <div className="media-thumbnail-wrapper">
        {thumbnailSrc && !imgError ? (
          <img
            src={thumbnailSrc}
            alt={item.title}
            className="media-thumbnail-img"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="media-placeholder">
            {isVideo ? <Film size={36} /> : <ImageIcon size={36} />}
            <span style={{ fontSize: '0.75rem', marginTop: '6px' }}>{isVideo ? 'Video' : 'Photo'}</span>
          </div>
        )}

        {/* Media type indicator badge */}
        <span className="media-type-tag">
          {isVideo ? 'Video' : 'Photo'}
        </span>

        {/* Video Duration / Photo dimensions badge */}
        {isVideo && item.duration > 0 && (
          <span className="media-badge">
            {formatDuration(item.duration)}
          </span>
        )}

        {/* Hover Action Overlay */}
        <div className="media-overlay-play">
          {isVideo ? (
            <div className="play-circle">
              <Play size={20} fill="#ffffff" style={{ marginLeft: '2px' }} />
            </div>
          ) : (
            <div className="play-circle">
              <Maximize2 size={20} />
            </div>
          )}
        </div>
      </div>

      <div className="media-info">
        <h3 className="media-title" title={item.title}>
          {item.title}
        </h3>

        <div className="media-meta-row">
          <span>{formatBytes(item.fileSizeBytes)} • {formatRelativeTime(item.createdAt)}</span>

          <div className="media-actions-row">
            <button
              className={`card-action-btn ${isLiked ? 'liked' : ''}`}
              onClick={handleLikeClick}
              title="Save to favorites"
              disabled={likeLoading}
            >
              <Heart size={16} fill={isLiked ? '#f43f5e' : 'none'} />
            </button>

            <button
              className="card-action-btn"
              onClick={handleDownload}
              title="Download file"
            >
              <Download size={16} />
            </button>

            {isAuthenticated && (
              <button
                className="card-action-btn"
                onClick={handleDeleteClick}
                title="Delete from cloud"
                style={{ color: 'rgba(244, 63, 94, 0.7)' }}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
