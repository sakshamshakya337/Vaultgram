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
import { useAuth } from './contexts/useAuth';
import { useUploadQueue } from './contexts/useUploadQueue';
import { AuthScreen } from './components/Auth/AuthScreen';
import { Sparkles } from 'lucide-react';

const StreamVaultApp = () => {
  const { isAuthenticated, loading } = useAuth();
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

  // 1. Initial Authentication Loading State: Show sleek animated splash screen
  if (loading) {
    return (
      <div className="flex w-full h-full min-h-[100dvh] items-center justify-center bg-slate-50 dark:bg-black text-slate-900 dark:text-white select-none">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-rose-500 p-0.5 shadow-2xl shadow-cyan-500/30 animate-pulse">
            <div className="w-full h-full bg-white dark:bg-zinc-950 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-cyan-500 dark:text-cyan-400" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 tracking-wider uppercase">
              Loading StreamVault...
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated Visitor: Ask for Login & Signup
  if (!isAuthenticated) {
    return (
      <>
        <AuthScreen />
        <InstallPromptModal />
        <InstallBanner />
      </>
    );
  }

  // 3. Authenticated User: Show full personal Cloud Drive & Reels Layout
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

