import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Unlock,
  Shield,
  KeyRound,
  LogOut,
  User,
  Sparkles,
  Check,
  AlertCircle,
  Fingerprint,
  Smartphone,
  Sun,
  Moon,
  Cloud,
  HardDrive,
  Trash2
} from 'lucide-react';
import { useAuth } from '../../contexts/useAuth';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { useTheme } from '../../contexts/useTheme';
import { useOfflineMedia } from '../../contexts/useOfflineMedia';
import { formatBytes } from '../../services/api';

export const SettingsModal = () => {
  const { theme, toggleTheme, setTheme } = useTheme();
  const { storageUsed, clearCache, offlineList } = useOfflineMedia();
  const {
    user,
    isAuthenticated,
    hasPin,
    hasBiometrics,
    logout,
    setIsSetPinModalOpen,
    removePin,
    enableBiometrics,
    disableBiometrics,
    isSettingsOpen,
    setIsSettingsOpen,
  } = useAuth();

  const {
    categories,
    lockedCategories,
    toggleCategoryLock,
    vaultStats = { totalBytes: 0, totalItems: 0 },
  } = useVideoFeed();

  const [isRemovingPin, setIsRemovingPin] = useState(false);
  const [removePinInput, setRemovePinInput] = useState('');
  const [removeError, setRemoveError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricError, setBiometricError] = useState('');

  // Feature detection for WebAuthn
  const [supportsBiometrics, setSupportsBiometrics] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
          .then((available) => setSupportsBiometrics(!!available))
          .catch(() => setSupportsBiometrics(true));
      } else {
        setSupportsBiometrics(true);
      }
    }
  }, []);

  if (!isSettingsOpen) return null;

  const handleToggleLock = async (category) => {
    if (!hasPin) {
      setIsSetPinModalOpen(true);
      return;
    }
    try {
      await toggleCategoryLock(category);
      showSuccess(`Category "${category}" updated`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmRemovePin = async (e) => {
    e.preventDefault();
    if (!removePinInput) return;
    setRemoveError('');
    try {
      await removePin(removePinInput);
      setIsRemovingPin(false);
      setRemovePinInput('');
      showSuccess('PIN lock removed');
    } catch (err) {
      setRemoveError(err.message || 'Incorrect PIN');
    }
  };

  const handleEnableBiometrics = async () => {
    setBiometricError('');
    setBiometricLoading(true);
    try {
      const res = await enableBiometrics('Vaultgram Device');
      if (res?.verified) {
        showSuccess('Biometric authentication enabled successfully!');
      } else {
        setBiometricError(res?.message || 'Biometric registration was cancelled or failed.');
      }
    } catch (err) {
      console.warn('Biometric registration error:', err.message);
      if (err.name === 'NotAllowedError') {
        setBiometricError('Biometric prompt was cancelled.');
      } else {
        setBiometricError(err.message || 'Failed to setup biometrics');
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleDisableBiometrics = async () => {
    setBiometricError('');
    setBiometricLoading(true);
    try {
      await disableBiometrics();
      showSuccess('Biometrics disabled. PIN remains active.');
    } catch (err) {
      setBiometricError(err.message || 'Failed to disable biometrics');
    } finally {
      setBiometricLoading(false);
    }
  };

  const showSuccess = (msg) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(''), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in select-none">
      <div className="relative w-full max-w-md rounded-3xl bg-zinc-950 border border-white/10 shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Privacy & Security</h3>
              <p className="text-xs text-zinc-400">Passcode, Face ID & folder locks</p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto no-scrollbar py-4 space-y-6 flex-1">
          {actionSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs animate-fade-in">
              <Check className="w-4 h-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Account Profile Box */}
          {isAuthenticated && (
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-rose-500 flex items-center justify-center text-white font-bold text-sm">
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">@{user?.username || 'User'}</h4>
                  <p className="text-xs text-zinc-400">{user?.email || 'Logged In'}</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    await logout();
                  } finally {
                    setIsSettingsOpen(false);
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* Theme & Appearance Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  {theme === 'dark' ? <Moon className="w-4 h-4 text-cyan-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
                  <span>Appearance & Theme</span>
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Choose your interface display preference
                </p>
              </div>
            </div>

            <div className="p-1.5 rounded-2xl bg-zinc-900/60 border border-white/5 grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setTheme('dark')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span>Dark Mode</span>
              </button>
              <button
                onClick={() => setTheme('light')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span>Light Mode</span>
              </button>
            </div>
          </div>

          {/* Cloud vault usage */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-cyan-400" />
                  <span>Cloud Vault</span>
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Total size of files you have uploaded
                </p>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {formatBytes(vaultStats.totalBytes)}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/5">
              <p className="text-xs font-semibold text-white">
                {vaultStats.totalItems} {vaultStats.totalItems === 1 ? 'file' : 'files'} uploaded
              </p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Counted from each file&apos;s size. Trashed items are not included until restored.
              </p>
            </div>
          </div>

          {/* Offline Storage Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-cyan-400" />
                  <span>Offline Storage</span>
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Saved videos available without internet
                </p>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {offlineList.length} {offlineList.length === 1 ? 'video' : 'videos'} ({formatBytes(storageUsed)})
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-white">Device Cache Storage</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {storageUsed > 0
                    ? `${formatBytes(storageUsed)} currently cached on this device.`
                    : 'No videos currently saved offline.'}
                </p>
              </div>

              {storageUsed > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('Clear all offline cached videos to free up storage?')) {
                      clearCache();
                      showSuccess('Offline cache cleared');
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Cache</span>
                </button>
              )}
            </div>
          </div>

          {/* App-Level PIN Lock Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-cyan-400" />
                  <span>Passcode (PIN)</span>
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Protects locked folders and Reels feed
                </p>
              </div>
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                  hasPin
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {hasPin ? 'Active' : 'Not Set'}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/5 flex flex-wrap gap-2.5">
              {hasPin ? (
                <>
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setIsSetPinModalOpen(true);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors cursor-pointer text-center"
                  >
                    Change PIN
                  </button>
                  <button
                    onClick={() => setIsRemovingPin((prev) => !prev)}
                    className="py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Remove PIN
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setIsSetPinModalOpen(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-md shadow-cyan-500/20 hover:opacity-90 active:scale-95 transition-all cursor-pointer text-center"
                >
                  Set App Passcode
                </button>
              )}
            </div>

            {/* Remove PIN Inline Prompt */}
            {isRemovingPin && hasPin && (
              <form onSubmit={handleConfirmRemovePin} className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-3 animate-fade-in">
                <p className="text-xs text-rose-300 font-semibold">
                  Enter current PIN to confirm removal:
                </p>
                {removeError && (
                  <p className="text-[11px] text-rose-400 font-medium">{removeError}</p>
                )}
                <div className="flex gap-2">
                  <input
                    type="password"
                    maxLength={6}
                    value={removePinInput}
                    onChange={(e) => setRemovePinInput(e.target.value)}
                    placeholder="Current PIN"
                    className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-white text-xs focus:outline-none focus:border-rose-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 transition-colors cursor-pointer"
                  >
                    Confirm
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Biometric WebAuthn Section (Fingerprint / Face ID) */}
          {supportsBiometrics && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-cyan-400" />
                    <span>Biometric Unlock</span>
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Unlock folders & Reels instantly with Face ID or Fingerprint
                  </p>
                </div>
                <span
                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                    hasBiometrics
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {hasBiometrics ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              {biometricError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{biometricError}</span>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">
                      {hasBiometrics ? 'Face ID / Fingerprint Registered' : 'Hardware Biometrics'}
                    </h5>
                    <p className="text-[11px] text-zinc-400">
                      {hasBiometrics
                        ? 'Auto-prompts on lock screens with PIN fallback'
                        : 'Use device biometric sensor for faster access'}
                    </p>
                  </div>
                </div>

                {hasBiometrics ? (
                  <button
                    disabled={biometricLoading}
                    onClick={handleDisableBiometrics}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    {biometricLoading ? 'Updating...' : 'Disable'}
                  </button>
                ) : (
                  <button
                    disabled={biometricLoading}
                    onClick={handleEnableBiometrics}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold shadow-md shadow-cyan-500/20 hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {biometricLoading ? 'Setting up...' : 'Enable'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Category-Level Folder Locks */}
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-400" />
                <span>Category Locks</span>
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Lock specific categories so only you can view them with your PIN / Biometrics
              </p>
            </div>

            <div className="divide-y divide-white/5 rounded-2xl bg-zinc-900/60 border border-white/5 overflow-hidden">
              {categories
                .filter((c) => c !== 'All')
                .map((cat) => {
                  const isLocked = (lockedCategories || []).some(
                    (lc) => lc.toLowerCase() === cat.toLowerCase()
                  );
                  return (
                    <div
                      key={cat}
                      className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isLocked ? (
                          <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                        ) : (
                          <Unlock className="w-4 h-4 text-zinc-500 shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-white">#{cat}</span>
                      </div>

                      <button
                        onClick={() => handleToggleLock(cat)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          isLocked
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
                            : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                        }`}
                      >
                        {isLocked ? 'Locked 🔒' : 'Lock Folder'}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
