import React from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { useMedia } from '../contexts/MediaContext';
import { useAuth } from '../contexts/AuthContext';
import { MediaCard } from '../components/Media/MediaCard';

export const FavoritesPage = ({ onOpenAuth }) => {
  const { library, loading } = useMedia();
  const { isAuthenticated } = useAuth();
  const likes = library?.likes || [];

  if (!isAuthenticated) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: 'var(--radius-xl)' }}>
        <Heart size={48} color="#f43f5e" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Sign in to view Favorites</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Keep your most loved photos and videos starred for fast access across devices.
        </p>
        <button className="btn-primary" onClick={onOpenAuth}>
          <span>Sign In</span>
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Heart size={24} color="#f43f5e" fill="#f43f5e" /> Starred & Favorites
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
          {likes.length} {likes.length === 1 ? 'item' : 'items'} saved in your favorites list
        </p>
      </div>

      {likes.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            borderRadius: 'var(--radius-xl)',
            border: '2px dashed var(--border-subtle)',
          }}
        >
          <Heart size={48} color="#f43f5e" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>No favorites yet</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto', fontSize: '0.9rem' }}>
            Click the heart icon on any photo or video to save it to this list.
          </p>
        </div>
      ) : (
        <div className="media-grid">
          {likes.map((item) => (
            <MediaCard key={item._id} item={item} onOpenAuth={onOpenAuth} />
          ))}
        </div>
      )}
    </div>
  );
};
