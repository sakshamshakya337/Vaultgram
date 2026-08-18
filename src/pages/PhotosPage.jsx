import React, { useMemo } from 'react';
import { Image as ImageIcon, UploadCloud, Sparkles } from 'lucide-react';
import { useMedia } from '../contexts/MediaContext';
import { MediaCard } from '../components/Media/MediaCard';

export const PhotosPage = ({ onOpenAuth }) => {
  const { items, loading, setUploadModalOpen } = useMedia();

  const photoItems = useMemo(() => {
    return items.filter((i) => i.mediaType === 'image');
  }, [items]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ImageIcon size={24} color="#a855f7" /> Photos Gallery
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            {photoItems.length} {photoItems.length === 1 ? 'photo' : 'photos'} stored in high resolution
          </p>
        </div>

        <button className="btn-primary" onClick={() => setUploadModalOpen(true)}>
          <UploadCloud size={16} />
          <span>Add Photos</span>
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <p>Loading photos...</p>
        </div>
      ) : photoItems.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            borderRadius: 'var(--radius-xl)',
            border: '2px dashed var(--border-subtle)',
          }}
        >
          <ImageIcon size={48} color="#a855f7" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>No photos found</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 20px', fontSize: '0.9rem' }}>
            Upload JPEG, PNG, WEBP, GIF, or SVG images directly to your vault.
          </p>
          <button className="btn-primary" onClick={() => setUploadModalOpen(true)}>
            <UploadCloud size={18} />
            <span>Upload Photo</span>
          </button>
        </div>
      ) : (
        <div className="media-grid">
          {photoItems.map((item) => (
            <MediaCard key={item._id} item={item} onOpenAuth={onOpenAuth} />
          ))}
        </div>
      )}
    </div>
  );
};
