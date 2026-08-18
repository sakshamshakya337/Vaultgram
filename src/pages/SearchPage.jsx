import React from 'react';
import { Search, Image as ImageIcon, Video, Layers } from 'lucide-react';
import { useMedia } from '../contexts/MediaContext';
import { MediaCard } from '../components/Media/MediaCard';

export const SearchPage = ({ onOpenAuth }) => {
  const { searchQuery, setSearchQuery, mediaType, setMediaType, items, loading } = useMedia();

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={24} color="#38bdf8" /> Search Vault
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
          {items.length} {items.length === 1 ? 'result' : 'results'} found for "{searchQuery}"
        </p>
      </div>

      {/* Type Filters */}
      <div className="filter-chips" style={{ marginBottom: '24px' }}>
        <button
          className={`filter-chip ${mediaType === 'all' ? 'active' : ''}`}
          onClick={() => setMediaType('all')}
        >
          <Layers size={14} style={{ display: 'inline', marginRight: '6px' }} />
          All Types
        </button>
        <button
          className={`filter-chip ${mediaType === 'image' ? 'active' : ''}`}
          onClick={() => setMediaType('image')}
        >
          <ImageIcon size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Photos Only
        </button>
        <button
          className={`filter-chip ${mediaType === 'video' ? 'active' : ''}`}
          onClick={() => setMediaType('video')}
        >
          <Video size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Videos Only
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <p>Searching media vault...</p>
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
          <Search size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>No matches found</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto', fontSize: '0.9rem' }}>
            Try adjusting your search keyword or selecting a different media filter.
          </p>
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
