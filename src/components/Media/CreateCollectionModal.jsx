import React, { useState } from 'react';
import { X, FolderPlus, Sparkles } from 'lucide-react';
import { useMedia } from '../../contexts/MediaContext';
import api from '../../services/api';

export const CreateCollectionModal = () => {
  const { collectionModalOpen, setCollectionModalOpen, fetchLibrary } = useMedia();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!collectionModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError('');

    try {
      await api.media.createCollection(title.trim(), description.trim());
      await fetchLibrary();
      setCollectionModalOpen(false);
      setTitle('');
      setDescription('');
    } catch (err) {
      setError(err.message || 'Failed to create collection');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => setCollectionModalOpen(false)}>
      <div className="modal-content glass-panel" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderPlus size={20} color="#38bdf8" />
            <h2 style={{ fontSize: '1.15rem' }}>New Collection</h2>
          </div>
          <button className="btn-icon" onClick={() => setCollectionModalOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(244, 63, 94, 0.15)',
                color: '#f43f5e',
                fontSize: '0.85rem',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Collection Name</label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Trips 2026, Work Assets, Favorites"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description (Optional)</label>
            <textarea
              className="form-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this collection..."
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setCollectionModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              style={{ flex: 1.5 }}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
