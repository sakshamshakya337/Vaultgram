import React from 'react';
import {
  HardDrive,
  Image as ImageIcon,
  Video,
  Sparkles,
  UploadCloud,
  FolderPlus,
  Filter,
} from 'lucide-react';
import { useMedia } from '../contexts/MediaContext';
import { useAuth } from '../contexts/AuthContext';
import { MediaCard } from '../components/Media/MediaCard';
import { formatBytes } from '../services/api';

const CATEGORIES = ['All', 'Photos', 'Videos', 'General', 'Travel', 'Personal', 'Work', 'Projects'];

export const DashboardPage = ({ onOpenAuth }) => {
  const {
    items,
    loading,
    category,
    setCategory,
    mediaType,
    setMediaType,
    setUploadModalOpen,
    setCollectionModalOpen,
    library,
  } = useMedia();
  const { isAuthenticated, user } = useAuth();

  const totalStorageBytes =
    library?.stats?.totalBytes ||
    items.reduce((acc, curr) => acc + (curr.fileSizeBytes || 0), 0);

  const photoCount =
    library?.stats?.photoCount ??
    items.filter((i) => i.mediaType === 'image').length;

  const videoCount =
    library?.stats?.videoCount ??
    items.filter((i) => i.mediaType === 'video' || (!i.mediaType && i.duration > 0)).length;

  return (
    <div>
      {/* ─── Hero / Stats Section ───────────────────────────────────── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            <HardDrive size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{formatBytes(totalStorageBytes)}</div>
            <div className="stat-label">Cloud Storage Used</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
            <ImageIcon size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{photoCount}</div>
            <div className="stat-label">Photos Stored</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
            <Video size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{videoCount}</div>
            <div className="stat-label">Videos Stored</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Sparkles size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#10b981' }}>Active</div>
            <div className="stat-label">Telegram Cloud Link</div>
          </div>
        </div>
      </div>

      {/* ─── Filter Bar ────────────────────────────────────────────── */}
      <div className="filter-bar">
        <div className="filter-chips">
          {CATEGORIES.map((cat) => {
            const isActive = category === cat;
            return (
              <button
                key={cat}
                className={`filter-chip ${isActive ? 'active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn-secondary"
            style={{ padding: '7px 14px', fontSize: '0.85rem' }}
            onClick={() => setCollectionModalOpen(true)}
          >
            <FolderPlus size={16} />
            <span>New Folder</span>
          </button>
        </div>
      </div>

      {/* ─── Media Items Grid ──────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>
            <Sparkles size={32} color="#38bdf8" />
          </div>
          <p style={{ marginTop: '12px', fontSize: '0.9rem' }}>Loading media vault...</p>
        </div>
      ) : items.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            borderRadius: 'var(--radius-xl)',
            border: '2px dashed var(--border-subtle)',
          }}
        >
          <UploadCloud size={48} color="#38bdf8" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>No media items yet</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 20px', fontSize: '0.9rem' }}>
            Upload photos and videos to your private Telegram-backed cloud vault. Unlimited storage, zero local disk usage.
          </p>
          <button className="btn-primary" onClick={() => setUploadModalOpen(true)}>
            <UploadCloud size={18} />
            <span>Upload Your First File</span>
          </button>
        </div>
      ) : (
        <div className="media-grid">
          {items.map((item) => (
            <MediaCard key={item._id} item={item} onOpenAuth={onOpenAuth} />
          ))}
        </div>
      )}
    </div>
  );
};
