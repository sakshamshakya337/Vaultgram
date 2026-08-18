import React, { useMemo } from 'react';
import { Video, UploadCloud } from 'lucide-react';
import { useMedia } from '../contexts/MediaContext';
import { MediaCard } from '../components/Media/MediaCard';

export const VideosPage = ({ onOpenAuth }) => {
  const { items, loading, setUploadModalOpen } = useMedia();

  const videoItems = useMemo(() => {
    return items.filter((i) => i.mediaType === 'video' || (!i.mediaType && i.duration > 0));
  }, [items]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Video size={24} color="#6366f1" /> Video Streaming Vault
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            {videoItems.length} {videoItems.length === 1 ? 'video' : 'videos'} ready for streaming
          </p>
        </div>

        <button className="btn-primary" onClick={() => setUploadModalOpen(true)}>
          <UploadCloud size={16} />
          <span>Add Video</span>
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <p>Loading videos...</p>
        </div>
      ) : videoItems.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            borderRadius: 'var(--radius-xl)',
            border: '2px dashed var(--border-subtle)',
          }}
        >
          <Video size={48} color="#6366f1" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>No videos uploaded</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 20px', fontSize: '0.9rem' }}>
            Upload MP4, MKV, MOV, WEBM videos for cloud streaming without storing local files.
          </p>
          <button className="btn-primary" onClick={() => setUploadModalOpen(true)}>
            <UploadCloud size={18} />
            <span>Upload Video</span>
          </button>
        </div>
      ) : (
        <div className="media-grid">
          {videoItems.map((item) => (
            <MediaCard key={item._id} item={item} onOpenAuth={onOpenAuth} />
          ))}
        </div>
      )}
    </div>
  );
};
