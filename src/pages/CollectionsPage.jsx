import React from 'react';
import { FolderHeart, Plus, Folder, Trash2 } from 'lucide-react';
import { useMedia } from '../contexts/MediaContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export const CollectionsPage = ({ onOpenAuth }) => {
  const { library, setCollectionModalOpen, fetchLibrary } = useMedia();
  const { isAuthenticated } = useAuth();
  const playlists = library?.playlists || [];

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this collection?')) return;
    try {
      await api.media.deleteCollection(id);
      fetchLibrary();
    } catch (err) {
      alert(err.message || 'Failed to delete');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: 'var(--radius-xl)' }}>
        <FolderHeart size={48} color="#38bdf8" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Sign in to manage Collections</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Create custom folders and playlists to organize your photos and videos.
        </p>
        <button className="btn-primary" onClick={onOpenAuth}>
          <span>Sign In</span>
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderHeart size={24} color="#38bdf8" /> Collections & Folders
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Organize your media into custom albums and playlists
          </p>
        </div>

        <button className="btn-primary" onClick={() => setCollectionModalOpen(true)}>
          <Plus size={16} />
          <span>New Collection</span>
        </button>
      </div>

      {playlists.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            borderRadius: 'var(--radius-xl)',
            border: '2px dashed var(--border-subtle)',
          }}
        >
          <Folder size={48} color="#38bdf8" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>No collections yet</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 20px', fontSize: '0.9rem' }}>
            Create folders to group your favorite memories, projects, or movie streams.
          </p>
          <button className="btn-primary" onClick={() => setCollectionModalOpen(true)}>
            <Plus size={16} />
            <span>Create Folder</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {playlists.map((pl) => {
            const count = (pl.mediaIds?.length || 0) + (pl.videoIds?.length || 0);
            return (
              <div
                key={pl._id}
                className="glass-panel"
                style={{
                  padding: '20px',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(56, 189, 248, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#38bdf8',
                    }}
                  >
                    <Folder size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', marginBottom: '4px' }}>{pl.title}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {count} {count === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                </div>

                <button
                  className="card-action-btn"
                  onClick={(e) => handleDelete(e, pl._id)}
                  title="Delete collection"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
