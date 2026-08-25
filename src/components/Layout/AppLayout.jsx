import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Image,
  Video,
  FolderHeart,
  Heart,
  Search,
  UploadCloud,
  HardDrive,
  User,
  LogOut,
  Sparkles,
  Download,
  Menu,
  X,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useMedia } from '../../contexts/MediaContext';
import { formatBytes } from '../../services/api';

export const AppLayout = ({ activeTab, setActiveTab, onOpenAuth, children }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const {
    setUploadModalOpen,
    searchQuery,
    setSearchQuery,
    library,
    items,
  } = useMedia();

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Capture PWA beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstallPwa(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setCanInstallPwa(false);
    }
  };

  // Compute storage statistics
  const totalStorageBytes =
    library?.stats?.totalBytes ||
    items.reduce((acc, curr) => acc + (curr.fileSizeBytes || 0), 0);

  const photoCount =
    library?.stats?.photoCount ??
    items.filter((i) => i.mediaType === 'image').length;

  const videoCount =
    library?.stats?.videoCount ??
    items.filter((i) => i.mediaType === 'video' || (!i.mediaType && i.duration > 0)).length;

  const navItems = [
    { id: 'dashboard', label: 'All Files', icon: LayoutDashboard },
    { id: 'photos', label: 'Photos', icon: Image, badge: photoCount },
    { id: 'videos', label: 'Videos', icon: Video, badge: videoCount },
    { id: 'collections', label: 'Collections', icon: FolderHeart },
    { id: 'favorites', label: 'Favorites', icon: Heart, badge: library?.likes?.length || 0 },
    { id: 'search', label: 'Search', icon: Search },
  ];

  return (
    <div className="app-container">
      {/* ─── Desktop Sidebar ────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-badge">
            <HardDrive size={22} color="#ffffff" />
          </div>
          <div className="logo-text">
            <h1>Personal Storage</h1>
            <span>Cloud Vault</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: isActive ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                      color: isActive ? '#38bdf8' : 'var(--text-muted)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {/* Storage Meter */}
          <div className="storage-card">
            <div className="storage-card-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} color="#38bdf8" /> Cloud Storage
              </span>
              <span style={{ color: '#10b981', fontWeight: 'bold' }}>{formatBytes(totalStorageBytes)}</span>
            </div>
            <div className="storage-bar">
              <div className="storage-progress" style={{ width: '45%' }} />
            </div>
            <div className="storage-meta">
              <span>{formatBytes(totalStorageBytes)} used</span>
              <span>Telegram Cloud</span>
            </div>
          </div>

          {/* Quick upload CTA button */}
          <button
            className="btn-primary"
            style={{ width: '100%', borderRadius: 'var(--radius-md)' }}
            onClick={() => setUploadModalOpen(true)}
          >
            <UploadCloud size={18} />
            <span>Upload Media</span>
          </button>
        </div>
      </aside>

      {/* ─── Main Content Area ──────────────────────────────────────── */}
      <div className="main-wrapper">
        {/* Top Navbar */}
        <header className="top-navbar">
          <div className="search-container">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search photos, videos, tags..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (activeTab !== 'search' && e.target.value.trim()) {
                  setActiveTab('search');
                }
              }}
            />
          </div>

          <div className="nav-actions">
            {/* Install PWA Button */}
            {canInstallPwa && (
              <button
                className="btn-secondary"
                onClick={handleInstallPwa}
                title="Install Personal Storage as Desktop / Mobile Web App"
              >
                <Download size={16} color="#38bdf8" />
                <span style={{ display: 'none', md: 'inline' }}>Install App</span>
              </button>
            )}

            {/* Quick Upload Button on desktop */}
            <button
              className="btn-primary"
              onClick={() => setUploadModalOpen(true)}
            >
              <Plus size={18} />
              <span>Upload</span>
            </button>

            {/* User Profile / Auth Button */}
            {isAuthenticated ? (
              <div style={{ position: 'relative' }}>
                <button
                  className="btn-icon"
                  style={{
                    background: 'var(--gradient-brand)',
                    color: '#fff',
                    fontWeight: '700',
                  }}
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                >
                  {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </button>

                {profileDropdownOpen && (
                  <div
                    className="glass-panel"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '48px',
                      width: '200px',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px',
                      zIndex: 60,
                      boxShadow: 'var(--shadow-lg)',
                    }}
                  >
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{user?.username}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email}</div>
                    </div>

                    <button
                      className="nav-item"
                      style={{ width: '100%', marginTop: '4px', padding: '8px 12px' }}
                      onClick={() => {
                        setActiveTab('profile');
                        setProfileDropdownOpen(false);
                      }}
                    >
                      <User size={16} /> Profile & Storage
                    </button>

                    <button
                      className="nav-item"
                      style={{ width: '100%', color: 'var(--accent-rose)', padding: '8px 12px' }}
                      onClick={() => {
                        logout();
                        setProfileDropdownOpen(false);
                      }}
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="btn-secondary" onClick={onOpenAuth}>
                <User size={16} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="page-content">{children}</main>
      </div>

      {/* ─── Mobile Bottom Navigation Bar ────────────────────────────── */}
      <nav className="bottom-nav">
        <button
          className={`bottom-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={20} />
          <span>Home</span>
        </button>

        <button
          className={`bottom-nav-item ${activeTab === 'photos' ? 'active' : ''}`}
          onClick={() => setActiveTab('photos')}
        >
          <Image size={20} />
          <span>Photos</span>
        </button>

        {/* Highlighted Upload Center Button */}
        <div className="bottom-nav-item upload-highlight">
          <button
            className="upload-highlight-btn"
            onClick={() => setUploadModalOpen(true)}
            aria-label="Upload Media"
          >
            <Plus size={24} />
          </button>
        </div>

        <button
          className={`bottom-nav-item ${activeTab === 'videos' ? 'active' : ''}`}
          onClick={() => setActiveTab('videos')}
        >
          <Video size={20} />
          <span>Videos</span>
        </button>

        <button
          className={`bottom-nav-item ${activeTab === 'favorites' || activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab(isAuthenticated ? 'favorites' : 'profile')}
        >
          <Heart size={20} />
          <span>Saved</span>
        </button>
      </nav>
    </div>
  );
};
