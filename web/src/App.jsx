import React from 'react';
import { AuthProvider } from './contexts/AuthProvider';
import { VideoFeedProvider } from './contexts/VideoFeedProvider';
import { UploadProvider } from './contexts/UploadProvider';
import { ThemeProvider } from './contexts/ThemeProvider';
import { OfflineMediaProvider } from './contexts/OfflineMediaProvider';
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
import { SharePlayerPage } from './components/Share/SharePlayerPage';
import { useUploadQueue } from './contexts/useUploadQueue';

const StreamVaultApp = () => {
  const { enqueueFiles } = useUploadQueue();

  // Check if current URL is a public share link
  const path = window.location.pathname;
  if (path.startsWith('/share/')) {
    const token = path.replace(/^\/share\//, '').split('/')[0];
    if (token) {
      return <SharePlayerPage token={token} />;
    }
  }

  // Handle incoming PWA Web Share Target
  React.useEffect(() => {
    if (path === '/share-target' || window.location.search.includes('share_target')) {
      window.history.replaceState({}, document.title, '/');
    }
  }, [path]);

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
    <ThemeProvider>
      <AuthProvider>
        <VideoFeedProvider>
          <UploadProvider>
            <OfflineMediaProvider>
              <StreamVaultApp />
            </OfflineMediaProvider>
          </UploadProvider>
        </VideoFeedProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

