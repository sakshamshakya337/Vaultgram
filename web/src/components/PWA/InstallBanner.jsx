import React, { useState, useEffect } from 'react';
import { Download, Sparkles, X } from 'lucide-react';
import { useVideoFeed } from '../../contexts/useVideoFeed';

export const InstallBanner = () => {
  const { isInstallable, isIOS, triggerInstall } = useVideoFeed();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const isDismissed = sessionStorage.getItem('streamvault_pwa_banner_dismissed');
      if (isDismissed) setDismissed(true);
    } catch {}
  }, []);

  if (dismissed || (!isInstallable && !isIOS)) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('streamvault_pwa_banner_dismissed', 'true');
    } catch {}
  };

  return (
    <div className="md:hidden fixed bottom-16 inset-x-3 z-40 animate-slide-up pointer-events-auto">
      <div className="p-3 rounded-2xl bg-zinc-950/90 border border-cyan-500/30 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0" onClick={triggerInstall}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-rose-500 p-0.5 shadow-md shadow-cyan-500/20 shrink-0">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate">Install StreamVault App</h4>
            <p className="text-[10px] text-zinc-400 truncate">Fullscreen Reels & Cloud Drive</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={triggerInstall}
            className="flex items-center gap-1 py-1.5 px-3 rounded-xl bg-cyan-500 text-black font-bold text-xs shadow-md shadow-cyan-500/20 hover:bg-cyan-400 active:scale-95 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>

          <button
            onClick={handleDismiss}
            className="w-7 h-7 rounded-lg text-zinc-500 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
