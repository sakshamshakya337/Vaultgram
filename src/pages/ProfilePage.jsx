import React from 'react';
import {
  User,
  HardDrive,
  Sparkles,
  ShieldCheck,
  Send,
  LogOut,
  Image as ImageIcon,
  Video,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMedia } from '../contexts/MediaContext';
import { formatBytes } from '../services/api';

export const ProfilePage = ({ onOpenAuth }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { library, items } = useMedia();

  if (!isAuthenticated) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px', borderRadius: 'var(--radius-xl)' }}>
        <User size={48} color="#38bdf8" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Sign in to view Profile</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Manage your account, view detailed storage metrics, and customize your vault settings.
        </p>
        <button className="btn-primary" onClick={onOpenAuth}>
          <span>Sign In</span>
        </button>
      </div>
    );
  }

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
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* ─── Profile Header Card ────────────────────────────────────── */}
      <div
        className="glass-panel"
        style={{
          padding: '28px',
          borderRadius: 'var(--radius-xl)',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--gradient-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: '800',
            color: '#fff',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
        </div>

        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '4px' }}>{user?.username}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{user?.email}</p>
        </div>

        <button
          className="btn-secondary"
          onClick={logout}
          style={{ color: 'var(--accent-rose)' }}
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>

      {/* ─── Storage Breakdown ──────────────────────────────────────── */}
      <div
        className="glass-panel"
        style={{
          padding: '24px',
          borderRadius: 'var(--radius-xl)',
          marginBottom: '24px',
        }}
      >
        <h3 style={{ fontSize: '1.15rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HardDrive size={20} color="#38bdf8" /> Storage Breakdown
        </h3>

        <div className="storage-bar" style={{ height: '10px', marginBottom: '16px' }}>
          <div className="storage-progress" style={{ width: '100%' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>
              <HardDrive size={14} color="#38bdf8" /> Total Stored
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800' }}>{formatBytes(totalStorageBytes)}</div>
          </div>

          <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>
              <ImageIcon size={14} color="#a855f7" /> Photos
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800' }}>{photoCount} files</div>
          </div>

          <div style={{ padding: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>
              <Video size={14} color="#6366f1" /> Videos
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800' }}>{videoCount} files</div>
          </div>
        </div>
      </div>

      {/* ─── Cloud Vault Infrastructure Info ────────────────────────── */}
      <div
        className="glass-panel"
        style={{
          padding: '24px',
          borderRadius: 'var(--radius-xl)',
          marginBottom: '24px',
        }}
      >
        <h3 style={{ fontSize: '1.15rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} color="#10b981" /> Cloud Vault Infrastructure
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={16} color="#38bdf8" /> Telegram Bot Cloud
            </span>
            <span style={{ color: '#10b981', fontWeight: '600' }}>Connected & Active</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Storage Disk Usage</span>
            <span style={{ color: '#38bdf8', fontWeight: '600' }}>0 Bytes (100% Cloud)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Vercel Ready Architecture</span>
            <span style={{ color: '#10b981', fontWeight: '600' }}>Enabled</span>
          </div>
        </div>
      </div>
    </div>
  );
};
