import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  Film,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useMedia } from '../../contexts/MediaContext';
import { useAuth } from '../../contexts/AuthContext';
import api, { formatBytes } from '../../services/api';

const CATEGORIES = [
  'General',
  'Photos',
  'Videos',
  'Personal',
  'Travel',
  'Family',
  'Work',
  'Projects',
  'Entertainment',
];

export const UploadModal = ({ onOpenAuth }) => {
  const { uploadModalOpen, setUploadModalOpen, fetchMedia, fetchLibrary } = useMedia();
  const { isAuthenticated } = useAuth();

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef(null);

  if (!uploadModalOpen) return null;

  const handleFileSelect = (file) => {
    if (!file) return;
    setError('');
    setSelectedFile(file);

    // Default title to filename without extension
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    setTitle(cleanName);

    // Auto categorize
    if (file.type.startsWith('image/')) {
      setCategory('Photos');
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else if (file.type.startsWith('video/')) {
      setCategory('Videos');
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file to upload');
      return;
    }

    if (!isAuthenticated) {
      onOpenAuth && onOpenAuth();
      return;
    }

    setUploading(true);
    setProgress(1);
    setError('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', title.trim() || selectedFile.name);
    formData.append('category', category);
    formData.append('description', description.trim());

    try {
      await api.media.upload(formData, (percent) => {
        setProgress(percent);
      });

      setSuccess(true);
      setProgress(100);
      fetchMedia();
      fetchLibrary();

      setTimeout(() => {
        setUploadModalOpen(false);
        resetForm();
      }, 1200);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Upload failed');
      setUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setTitle('');
    setCategory('General');
    setDescription('');
    setUploading(false);
    setProgress(0);
    setError('');
    setSuccess(false);
  };

  const handleClose = () => {
    if (uploading && !success) {
      if (!window.confirm('Upload is in progress. Are you sure you want to cancel?')) {
        return;
      }
    }
    setUploadModalOpen(false);
    resetForm();
  };

  const isImage = selectedFile?.type?.startsWith('image/');
  const isVideo = selectedFile?.type?.startsWith('video/');

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UploadCloud size={22} color="#38bdf8" />
            <h2 style={{ fontSize: '1.2rem' }}>Upload to Personal Storage</h2>
          </div>
          <button className="btn-icon" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#f43f5e',
                fontSize: '0.88rem',
                marginBottom: '16px',
              }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <CheckCircle size={56} color="#10b981" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Upload Complete!</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Your media is now safely stored in your private Telegram cloud vault.
              </p>
            </div>
          ) : (
            <form onSubmit={handleUploadSubmit}>
              {/* File Dropzone or Preview */}
              {!selectedFile ? (
                <div
                  className={`dropzone ${dragOver ? 'dragover' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,.mp4,.mov,.mkv,.webm,.jpg,.jpeg,.png,.webp,.gif"
                    style={{ display: 'none' }}
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  />
                  <div
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: 'rgba(56, 189, 248, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <UploadCloud size={30} color="#38bdf8" />
                  </div>
                  <div>
                    <p style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '4px' }}>
                      Drag and drop photos or videos
                    </p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      or click to browse from device (up to 100MB per file)
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '18px',
                    position: 'relative',
                  }}
                >
                  {isImage && previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', background: '#020617' }}
                    />
                  ) : isVideo && previewUrl ? (
                    <video
                      src={previewUrl}
                      controls
                      style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', background: '#020617' }}
                    />
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center' }}>
                      {isVideo ? <Film size={40} color="#38bdf8" /> : <ImageIcon size={40} color="#38bdf8" />}
                    </div>
                  )}

                  <div
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(15, 23, 42, 0.9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: '600' }}>{selectedFile.name}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                        ({formatBytes(selectedFile.size)})
                      </span>
                    </div>
                    {!uploading && (
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        onClick={() => {
                          setSelectedFile(null);
                          setPreviewUrl(null);
                        }}
                      >
                        Change
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Form Metadata Fields */}
              {selectedFile && (
                <>
                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label className="form-label">Title / Caption</label>
                    <input
                      type="text"
                      className="form-input"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Summer Vacation Beach Video"
                      required
                      disabled={uploading}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-input"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      disabled={uploading}
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat} style={{ background: '#0f172a' }}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description (Optional)</label>
                    <textarea
                      className="form-input"
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add notes, tags or details..."
                      disabled={uploading}
                    />
                  </div>
                </>
              )}

              {/* Upload Progress Bar */}
              {uploading && (
                <div className="upload-progress-container">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={14} color="#38bdf8" /> Uploading to Telegram Cloud...
                    </span>
                    <span style={{ fontWeight: '700', color: '#38bdf8' }}>{progress}%</span>
                  </div>
                  <div className="storage-bar" style={{ height: '8px' }}>
                    <div className="storage-progress" style={{ width: `${progress}%`, transition: 'width 0.2s linear' }} />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {selectedFile && !uploading && (
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1 }}
                    onClick={handleClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ flex: 2 }}
                  >
                    <UploadCloud size={18} />
                    <span>Upload to Cloud</span>
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
