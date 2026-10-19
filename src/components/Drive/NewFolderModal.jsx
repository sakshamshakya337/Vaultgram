import React, { useState } from 'react';
import { FolderPlus, X, Lock, Fingerprint } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/useAuth';
import { useVideoFeed } from '../../contexts/useVideoFeed';

export const NewFolderModal = ({ isOpen, onClose, currentFolderId, onFolderCreated, isVaultView = false }) => {
  const [title, setTitle] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [isHidden, setIsHidden] = useState(isVaultView);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { hasPin, hasBiometrics, user } = useAuth();
  const { toggleCategoryLock, fetchCategories } = useVideoFeed();

  // Reset or initialize state on open
  React.useEffect(() => {
    if (isOpen) {
      setIsHidden(isVaultView);
      setIsLocked(false);
      setError('');
    }
  }, [isOpen, isVaultView]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    setLoading(true);
    setError('');
    try {
      const res = await api.drive.createFolder(cleanTitle, currentFolderId, isLocked, isHidden);
      if (isLocked) {
        await toggleCategoryLock(cleanTitle).catch(() => null);
        if (res?._id) {
          await toggleCategoryLock(String(res._id)).catch(() => null);
        }
      }
      if (fetchCategories) fetchCategories();
      setTitle('');
      setIsLocked(false);
      setIsHidden(false);
      onFolderCreated();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create folder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-zinc-950 border border-white/10 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <FolderPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">New Folder</h3>
            <p className="text-xs text-zinc-400">Create a cloud folder</p>
          </div>
        </div>

        {error && (
          <div className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 mb-3 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Folder name (e.g. Work, Secret Vault)"
            className="w-full px-4 py-3 rounded-2xl bg-zinc-900 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
            autoFocus
            required
          />

          {/* Privacy & Lock Toggle (only shown when account has configured PIN) */}
          {hasPin && (
            <div className="space-y-2">
              <div
                onClick={() => setIsLocked((prev) => !prev)}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                  isLocked
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                      isLocked
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {hasBiometrics || user?.hasBiometrics ? (
                      <Fingerprint className="w-4 h-4" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">
                      Lock Folder (Passcode)
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      Require PIN or biometric verification to open
                    </p>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                    isLocked
                      ? 'bg-rose-500 border-rose-500 text-white'
                      : 'border-white/20 bg-zinc-800'
                  }`}
                >
                  {isLocked && <span className="text-[10px] font-bold">✓</span>}
                </div>
              </div>

              {/* Hide Folder (Private Vault) Toggle */}
              <div
                onClick={() => setIsHidden((prev) => !prev)}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                  isHidden
                    ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                    : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                      isHidden
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    <span className="text-sm">👁️‍🗨️</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white leading-tight">
                      Hide Folder (Private Vault)
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      Hidden from drive, searches, and recents
                    </p>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                    isHidden
                      ? 'bg-purple-500 border-purple-500 text-white'
                      : 'border-white/20 bg-zinc-800'
                  }`}
                >
                  {isHidden && <span className="text-[10px] font-bold">✓</span>}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
