import React, { useState, useRef } from 'react';
import {
  HardDrive,
  Star,
  Clock,
  Trash2,
  Plus,
  FolderPlus,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  Code,
  ShieldCheck,
  Cloud,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrive } from '../../contexts/DriveContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { formatBytes } from '../../services/api';

export const DriveSidebar = () => {
  const {
    activeSection,
    fileCategory,
    setSection,
    setNewFolderOpen,
    enqueueUpload,
    stats,
  } = useDrive();

  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const mainNav = [
    { id: 'my-drive', label: 'My Cloud', icon: HardDrive },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'recent', label: 'Recent', icon: Clock },
    { id: 'trash', label: 'Trash', icon: Trash2 },
  ];

  const categories = [
    { id: 'document', label: 'Documents & PDFs', icon: FileText, color: 'text-amber-400' },
    { id: 'image', label: 'Photos & Images', icon: ImageIcon, color: 'text-sky-400' },
    { id: 'video', label: 'Videos & Movies', icon: Video, color: 'text-blue-400' },
    { id: 'audio', label: 'Audio & Music', icon: Music, color: 'text-cyan-400' },
    { id: 'archive', label: 'Archives & ZIPs', icon: Archive, color: 'text-emerald-400' },
    { id: 'code', label: 'Code & Scripts', icon: Code, color: 'text-teal-400' },
  ];

  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      enqueueUpload(e.target.files);
      setNewMenuOpen(false);
    }
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 flex-col border-r border-white/[0.06] bg-drive-sidebar backdrop-blur-2xl md:flex z-40">
      {/* ─── Brand Lockup ────────────────────────────────────────── */}
      <div className="flex items-center space-x-3 px-6 py-5 border-b border-white/[0.04]">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
          <Cloud className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-bold font-display tracking-tight text-white">CloudVault</h1>
          <div className="flex items-center space-x-1 text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
            <ShieldCheck className="h-3 w-3" />
            <span>Encrypted Cloud</span>
          </div>
        </div>
      </div>

      {/* ─── "+ New" Button ─────────────────────────────────────── */}
      <div className="relative px-4 py-4">
        <Button
          variant="default"
          size="lg"
          className="w-full rounded-xl py-5 font-bold shadow-lg shadow-blue-600/20 text-sm flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500"
          onClick={() => setNewMenuOpen(!newMenuOpen)}
        >
          <Plus className="h-4 w-4" />
          <span>New Upload</span>
        </Button>

        {/* Hidden inputs */}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />
        <input
          type="file"
          ref={folderInputRef}
          multiple
          webkitdirectory=""
          directory=""
          className="hidden"
          onChange={handleFileUpload}
        />

        <AnimatePresence>
          {newMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute left-4 right-4 top-20 z-50 rounded-2xl border border-white/[0.08] bg-zinc-900 p-2 shadow-2xl backdrop-blur-2xl"
            >
              <button
                className="flex w-full items-center space-x-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors"
                onClick={() => {
                  setNewFolderOpen(true);
                  setNewMenuOpen(false);
                }}
              >
                <FolderPlus className="h-4 w-4 text-blue-400" />
                <span>New Folder</span>
              </button>
              <button
                className="flex w-full items-center space-x-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud className="h-4 w-4 text-sky-400" />
                <span>Upload Files</span>
              </button>
              <button
                className="flex w-full items-center space-x-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors"
                onClick={() => folderInputRef.current?.click()}
              >
                <FolderPlus className="h-4 w-4 text-cyan-400" />
                <span>Upload Folder</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Navigation Links ────────────────────────────────────── */}
      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        <div className="space-y-1">
          {mainNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 font-bold border border-blue-500/20'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100'
                }`}
                onClick={() => setSection(item.id)}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Categories */}
        <div className="space-y-1 pt-2 border-t border-white/[0.04]">
          <p className="px-3 py-1.5 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
            File Categories
          </p>
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeSection === 'type-filter' && fileCategory === cat.id;
            return (
              <button
                key={cat.id}
                className={`flex w-full items-center space-x-3 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 font-bold border border-blue-500/20'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100'
                }`}
                onClick={() => setSection('type-filter', null, cat.id)}
              >
                <Icon className={`h-4 w-4 ${cat.color}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Storage Card ────────────────────────────────────────── */}
      <div className="border-t border-white/[0.06] bg-zinc-950/60 p-4">
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/70 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
            <span className="flex items-center space-x-1.5">
              <Cloud className="h-3.5 w-3.5 text-blue-400" />
              <span>Storage</span>
            </span>
            <Badge variant="cyan" className="text-[10px] px-1.5 py-0">Unlimited</Badge>
          </div>

          <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full w-2/5 rounded-full bg-blue-500" />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span>{formatBytes(stats?.totalBytes || 0)} used</span>
            <span className="text-emerald-400 font-semibold">Free Forever</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
