import React from 'react';
import { X, Download, Share, PlusSquare, Sparkles, Smartphone } from 'lucide-react';
import { useVideoFeed } from '../../contexts/useVideoFeed';

export const InstallPromptModal = () => {
  const { isInstallModalOpen, setIsInstallModalOpen, isIOS, deferredInstallPrompt } = useVideoFeed();

  if (!isInstallModalOpen) return null;

  const handleInstallClick = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallModalOpen(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-sm rounded-3xl bg-zinc-900 border border-white/10 shadow-2xl p-6 overflow-hidden animate-float-up">
        {/* Close Button */}
        <button
          onClick={() => setIsInstallModalOpen(false)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Heading */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-rose-500 p-0.5 shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-cyan-400" />
            </div>
          </div>
          <div>
            <h3 className="text-base font-bold text-white leading-tight">Install StreamVault</h3>
            <p className="text-xs text-zinc-400">Full screen Reels & native experience</p>
          </div>
        </div>

        {/* iOS Safari Instructions */}
        {isIOS ? (
          <div className="space-y-3 py-2 text-xs text-zinc-300">
            <p className="leading-relaxed">
              Install <strong className="text-white">StreamVault</strong> on your iPhone / iPad for a full-screen app experience without browser bars:
            </p>
            <div className="space-y-2.5 bg-zinc-950/60 p-3.5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <Share className="w-4 h-4" />
                </div>
                <span>1. Tap the <strong>Share</strong> button in Safari toolbar</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <span>2. Scroll down & tap <strong>Add to Home Screen</strong></span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-2 text-xs text-zinc-300">
            <p className="leading-relaxed">
              Get fast offline access, instant startup, and immersive vertical video playback right from your home screen.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-end gap-3">
          <button
            onClick={() => setIsInstallModalOpen(false)}
            className="px-4 py-2 rounded-full text-xs font-semibold text-zinc-400 hover:text-white cursor-pointer"
          >
            Maybe Later
          </button>
          {!isIOS && deferredInstallPrompt && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Install Now</span>
            </button>
          )}
          {isIOS && (
            <button
              onClick={() => setIsInstallModalOpen(false)}
              className="px-5 py-2.5 rounded-full bg-cyan-500 text-black font-bold text-xs shadow-lg shadow-cyan-500/25 hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              Got it!
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
