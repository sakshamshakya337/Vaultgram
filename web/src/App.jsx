import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { VideoFeedProvider } from './contexts/VideoFeedContext';
import { UploadProvider } from './contexts/UploadContext';
import { DriveLayout } from './components/Drive/DriveLayout';
import { UploadModal } from './components/Upload/UploadModal';
import { UploadTray } from './components/Upload/UploadTray';
import { UploadCategoryPromptModal } from './components/Upload/UploadCategoryPromptModal';
import { AuthModal } from './components/Auth/AuthModal';
import { InstallPromptModal } from './components/PWA/InstallPromptModal';
import { InstallBanner } from './components/PWA/InstallBanner';
import { OfflineIndicator } from './components/PWA/OfflineIndicator';
import { CategoryPinModal } from './components/PIN/CategoryPinModal';
import { SetPinModal } from './components/PIN/SetPinModal';
import { SettingsModal } from './components/Settings/SettingsModal';

const StreamVaultApp = () => {
  return (
    <div className="relative w-full h-full min-h-[100dvh] bg-black text-white overflow-hidden">
      {/* Offline Status Alert */}
      <OfflineIndicator />

      {/* Unified Responsive File Manager & Reels Layout (Desktop & Mobile) */}
      <DriveLayout />

      {/* Google Drive-Style Upload Tray & Root Category Selector */}
      <UploadTray />
      <UploadCategoryPromptModal />

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
        <UploadProvider>
          <StreamVaultApp />
        </UploadProvider>
      </VideoFeedProvider>
    </AuthProvider>
  );
}

