import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { VideoFeedProvider } from './contexts/VideoFeedContext';
import { ReelsContainer } from './components/Reels/ReelsContainer';
import { TopHeader } from './components/Navigation/TopHeader';
import { CategoryFilterBar } from './components/Navigation/CategoryFilterBar';
import { BottomNav } from './components/Navigation/BottomNav';
import { UploadModal } from './components/Upload/UploadModal';
import { AuthModal } from './components/Auth/AuthModal';
import { InstallPromptModal } from './components/PWA/InstallPromptModal';
import { OfflineIndicator } from './components/PWA/OfflineIndicator';
import { PinLockOverlay } from './components/PIN/PinLockOverlay';
import { CategoryPinModal } from './components/PIN/CategoryPinModal';
import { SetPinModal } from './components/PIN/SetPinModal';
import { SettingsModal } from './components/Settings/SettingsModal';

const StreamVaultApp = () => {
  return (
    <div className="relative w-full h-full h-[100dvh] bg-black text-white flex items-center justify-center overflow-hidden">
      {/* Desktop Ambient Background Decoration */}
      <div className="hidden md:block absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl" />
      </div>

      {/* Main Reels Feed Column (Full screen on mobile, 9:16 frame on desktop) */}
      <div className="relative w-full h-full h-[100dvh] md:max-w-[430px] md:h-[94dvh] md:rounded-3xl md:border md:border-white/10 md:shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden bg-black flex flex-col">
        {/* Offline Banner */}
        <OfflineIndicator />

        {/* Floating Top Header */}
        <TopHeader />

        {/* Floating Category Filter Pills */}
        <CategoryFilterBar />

        {/* Vertical Scroll-Snap Video Feed */}
        <div className="flex-1 w-full h-full overflow-hidden relative">
          <ReelsContainer />
        </div>

        {/* Mobile Bottom Navigation */}
        <BottomNav />
      </div>

      {/* Fullscreen PIN Lock Overlay (Protects entire app on startup / tab resume) */}
      <PinLockOverlay />

      {/* Category Folder Unlock PIN Modal */}
      <CategoryPinModal />

      {/* Set / Change PIN Modal */}
      <SetPinModal />

      {/* Privacy & Settings Modal */}
      <SettingsModal />

      {/* Global Modals */}
      <UploadModal />
      <AuthModal />
      <InstallPromptModal />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <VideoFeedProvider>
        <StreamVaultApp />
      </VideoFeedProvider>
    </AuthProvider>
  );
}
