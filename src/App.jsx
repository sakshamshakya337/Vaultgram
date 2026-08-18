import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthProvider } from './contexts/AuthContext';
import { DriveProvider, useDrive } from './contexts/DriveContext';
import { DriveHeader } from './components/Drive/DriveHeader';
import { DriveSidebar } from './components/Drive/DriveSidebar';
import { Breadcrumbs } from './components/Drive/Breadcrumbs';
import { DriveGrid } from './components/Drive/DriveGrid';
import { DriveList } from './components/Drive/DriveList';
import { FileInspector } from './components/Drive/FileInspector';
import { UploadManager } from './components/Drive/UploadManager';
import { UniversalPreviewModal } from './components/Drive/UniversalPreviewModal';
import { NewFolderModal } from './components/Drive/NewFolderModal';
import { RenameModal } from './components/Drive/RenameModal';
import { MoveModal } from './components/Drive/MoveModal';
import { AuthModal } from './components/Auth/AuthModal';
import { UploadCloud } from 'lucide-react';

const DriveMainApp = () => {
  const { viewMode, isInspectorOpen, enqueueUpload } = useDrive();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleGlobalDragOver = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleGlobalDragLeave = (e) => {
    if (
      e.clientX <= 0 ||
      e.clientY <= 0 ||
      e.clientX >= window.innerWidth ||
      e.clientY >= window.innerHeight
    ) {
      setIsDragActive(false);
    }
  };

  const handleGlobalDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      enqueueUpload(e.dataTransfer.files);
    }
  };

  return (
    <div
      className="flex min-h-screen w-full bg-drive-bg text-zinc-100 font-sans relative selection:bg-sky-500/30 selection:text-sky-300"
      onDragOver={handleGlobalDragOver}
      onDragLeave={handleGlobalDragLeave}
      onDrop={handleGlobalDrop}
    >
      {/* ─── Global Drag & Drop Overlay ─────────────────────────────── */}
      <AnimatePresence>
        {isDragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 backdrop-blur-2xl border-4 border-dashed border-sky-500 pointer-events-none p-6 text-center"
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-sky-500/20 text-sky-400 border border-sky-500/30 mb-6 shadow-2xl shadow-sky-500/20 animate-bounce">
              <UploadCloud className="h-12 w-12" />
            </div>
            <h2 className="text-2xl font-bold font-display text-white">
              Drop files to upload instantly
            </h2>
            <p className="mt-2 text-sm text-zinc-400 max-w-md">
              Files will be encrypted and stored directly into your private Telegram Cloud Vault.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Left Sidebar ───────────────────────────────────────────── */}
      <DriveSidebar />

      {/* ─── Main Content Wrapper ───────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 h-screen overflow-hidden">
        <DriveHeader onOpenAuth={() => setAuthModalOpen(true)} />

        <div className="flex flex-1 overflow-hidden">
          {/* Main Files View */}
          <main className="flex-1 overflow-y-auto px-6 py-4 md:px-8">
            <Breadcrumbs />
            <AnimatePresence mode="wait">
              {viewMode === 'grid' ? (
                <motion.div
                  key="grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <DriveGrid />
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <DriveList />
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Details Inspector Sidebar Drawer */}
          {isInspectorOpen && <FileInspector />}
        </div>
      </div>

      {/* ─── Floating Google Drive Upload Manager ───────────────────── */}
      <UploadManager />

      {/* ─── Global Modals ──────────────────────────────────────────── */}
      <UniversalPreviewModal />
      <NewFolderModal />
      <RenameModal />
      <MoveModal />
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <DriveProvider>
        <DriveMainApp />
      </DriveProvider>
    </AuthProvider>
  );
}
