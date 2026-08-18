import React, { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { VideoFeedProvider } from './contexts/VideoFeedContext';
import { ReelsContainer } from './components/Reels/ReelsContainer';
import { TopHeader } from './components/Navigation/TopHeader';
import { CategoryFilterBar } from './components/Navigation/CategoryFilterBar';
import { BottomNav } from './components/Navigation/BottomNav';
import { UploadModal } from './components/Upload/UploadModal';
import { AuthModal } from './components/Auth/AuthModal';
import { InstallPromptModal } from './components/PWA/InstallPromptModal';
import { InstallBanner } from './components/PWA/InstallBanner';
import { OfflineIndicator } from './components/PWA/OfflineIndicator';
import { PinLockOverlay } from './components/PIN/PinLockOverlay';
import { CategoryPinModal } from './components/PIN/CategoryPinModal';
import { SetPinModal } from './components/PIN/SetPinModal';
import { SettingsModal } from './components/Settings/SettingsModal';
import { DriveLayout } from './components/Drive/DriveLayout';

// Hook to detect viewport width >= 768px (Desktop file manager vs Mobile Reels feed)
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(min-width: 768px)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setIsDesktop(e.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}

const StreamVaultMobileLayout = () => {
  return (
    <div className="relative w-full h-full h-[100dvh] bg-black text-white flex flex-col overflow-hidden">
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
  );
};

const StreamVaultApp = () => {
  const isDesktop = useIsDesktop();

  return (
    <div className="relative w-full h-full min-h-[100dvh] bg-black text-white overflow-hidden">
      {/* Offline Status Alert */}
      <OfflineIndicator />

      {/* Responsive Layout Switch:
          - Desktop (>= 768px): Google Drive style cloud file manager
          - Mobile (< 768px): TikTok / Instagram-Reels vertical snap feed
      */}
      {isDesktop ? <DriveLayout /> : <StreamVaultMobileLayout />}

      {/* Category & Custom Folder Unlock PIN Modal */}
      <CategoryPinModal />

      {/* Set / Change PIN Modal */}
      <SetPinModal />

      {/* Privacy & Settings Modal */}
      <SettingsModal />

      {/* Global Modals & Install Banner */}
      <UploadModal />
      <AuthModal />
      <InstallPromptModal />
      <InstallBanner />
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
