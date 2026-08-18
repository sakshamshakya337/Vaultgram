import React from 'react';
import {
  X,
  Download,
  Share,
  PlusSquare,
  Sparkles,
  Shield,
  Zap,
  Cloud,
  CheckCircle2,
  Smartphone
} from 'lucide-react';
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
    } else {
      setIsInstallModalOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in select-none">
      <div className="relative w-full max-w-md rounded-3xl bg-zinc-950 border border-white/15 shadow-2xl p-6 overflow-hidden animate-scale-up">
        {/* Close Button */}
        <button
          onClick={() => setIsInstallModalOpen(false)}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* App Store Card Header */}
        <div className="flex items-start gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-rose-500 p-0.5 shadow-xl shadow-cyan-500/25 shrink-0">
            <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center relative overflow-hidden">
              <Sparkles className="w-8 h-8 text-cyan-400 animate-pulse-subtle" />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-lg font-black text-white leading-tight">StreamVault</h3>
              <CheckCircle2 className="w-4 h-4 text-cyan-400 fill-cyan-400/20" />
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">Reels Feed & Cloud Drive</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-semibold">
                Official PWA
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">Free • Instant</span>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/10 mb-4 text-center">
          <div className="p-2.5 rounded-2xl bg-zinc-900/60 border border-white/5 flex flex-col items-center">
            <Zap className="w-4 h-4 text-amber-400 mb-1" />
            <span className="text-[11px] font-bold text-white leading-tight">Full Screen</span>
            <span className="text-[9px] text-zinc-500">No browser UI</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-zinc-900/60 border border-white/5 flex flex-col items-center">
            <Shield className="w-4 h-4 text-cyan-400 mb-1" />
            <span className="text-[11px] font-bold text-white leading-tight">PIN Protected</span>
            <span className="text-[9px] text-zinc-500">Folder Security</span>
          </div>

          <div className="p-2.5 rounded-2xl bg-zinc-900/60 border border-white/5 flex flex-col items-center">
            <Cloud className="w-4 h-4 text-rose-400 mb-1" />
            <span className="text-[11px] font-bold text-white leading-tight">Zero Disk</span>
            <span className="text-[9px] text-zinc-500">Telegram Cloud</span>
          </div>
        </div>

        {/* Platform-Specific Step Guide */}
        {isIOS ? (
          <div className="space-y-3 py-1 text-xs text-zinc-300">
            <p className="text-zinc-400 font-medium">
              To install on <strong className="text-white">iPhone / iPad</strong>:
            </p>
            <div className="space-y-2 bg-zinc-900/80 p-3.5 rounded-2xl border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <Share className="w-4 h-4" />
                </div>
                <span>1. Tap the <strong>Share</strong> icon in Safari toolbar</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <span>2. Scroll down and choose <strong>Add to Home Screen</strong></span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-1 text-xs text-zinc-400 leading-relaxed">
            Install as a standalone app on your device for lightning-fast startup, offline app shell loading, and native full-screen vertical reels.
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-5 flex items-center justify-end gap-2.5">
          <button
            onClick={() => setIsInstallModalOpen(false)}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            Maybe Later
          </button>

          {!isIOS ? (
            <button
              onClick={handleInstallClick}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-blue-500 text-white font-bold text-xs shadow-xl shadow-cyan-500/25 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>Install StreamVault App</span>
            </button>
          ) : (
            <button
              onClick={() => setIsInstallModalOpen(false)}
              className="flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-xl shadow-cyan-500/25 hover:opacity-95 active:scale-95 transition-all cursor-pointer text-center"
            >
              Got It!
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
