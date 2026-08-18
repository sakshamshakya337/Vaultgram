import React from 'react';
import { Sparkles, Download, Plus, User, Shield } from 'lucide-react';
import { useVideoFeed } from '../../contexts/VideoFeedContext';
import { useAuth } from '../../contexts/AuthContext';

export const TopHeader = () => {
  const { isInstallable, isIOS, triggerInstall, setIsUploadOpen, setIsAuthOpen } = useVideoFeed();
  const { isAuthenticated, setIsSettingsOpen } = useAuth();

  return (
    <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 pt-safe h-14 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
      {/* Brand Logo */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-rose-500 flex items-center justify-center p-0.5 shadow-lg shadow-cyan-500/20">
          <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
        </div>
        <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1 font-sans">
          Stream<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-rose-500">Vault</span>
        </h1>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {/* PWA Install Button (if available) */}
        {(isInstallable || isIOS) && (
          <button
            onClick={triggerInstall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-semibold backdrop-blur-md hover:bg-cyan-500/30 active:scale-95 transition-all cursor-pointer animate-pulse-subtle"
            title="Install StreamVault as App"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Install App</span>
          </button>
        )}

        {/* Upload Button */}
        <button
          onClick={() => setIsUploadOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold shadow-md shadow-cyan-500/20 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Upload</span>
        </button>

        {/* Privacy & Settings Button */}
        {isAuthenticated ? (
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-zinc-300 hover:text-white transition-all cursor-pointer"
            title="Settings & PIN Lock"
          >
            <Shield className="w-4 h-4 text-cyan-400" />
          </button>
        ) : (
          <button
            onClick={() => setIsAuthOpen(true)}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-zinc-300 hover:text-white transition-all cursor-pointer"
            title="Sign In"
          >
            <User className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
