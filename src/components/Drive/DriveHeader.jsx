import React, { useState } from 'react';
import {
  Search,
  LayoutGrid,
  List,
  Info,
  User,
  LogOut,
  SlidersHorizontal,
  X,
  FileText,
  Video,
  Music,
  Image as ImageIcon,
  Archive,
  Code,
  HardDrive,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrive } from '../../contexts/DriveContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export const DriveHeader = ({ onOpenAuth }) => {
  const {
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    isInspectorOpen,
    setIsInspectorOpen,
    fileCategory,
    setSection,
  } = useDrive();

  const { user, isAuthenticated, logout } = useAuth();
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  const categories = [
    { key: 'all', label: 'All Files', icon: HardDrive },
    { key: 'document', label: 'Documents & PDFs', icon: FileText },
    { key: 'image', label: 'Photos & Images', icon: ImageIcon },
    { key: 'video', label: 'Videos & Movies', icon: Video },
    { key: 'audio', label: 'Audio & Music', icon: Music },
    { key: 'archive', label: 'Archives & ZIPs', icon: Archive },
    { key: 'code', label: 'Code & Scripts', icon: Code },
  ];

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between gap-4 border-b border-white/[0.06] bg-drive-bg/95 px-6 backdrop-blur-2xl">
      {/* ─── Search Bar ─────────────────────────────────────────── */}
      <div className="relative flex-1 max-w-2xl">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 h-4 w-4 text-zinc-400 pointer-events-none" />
          <Input
            type="text"
            className="h-10 pl-10 pr-24 rounded-xl bg-zinc-900/80 border-white/[0.08] focus-visible:border-blue-500 focus-visible:ring-blue-500/20 text-xs text-zinc-100"
            placeholder="Search files, folders, documents in CloudVault..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="absolute right-2 flex items-center space-x-1">
            {searchQuery && (
              <button
                type="button"
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              type="button"
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterMenuOpen || (fileCategory && fileCategory !== 'all')
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
              onClick={() => setFilterMenuOpen(!filterMenuOpen)}
              title="Filter by file type"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ─── Category Filter Dropdown ──────────────────────────── */}
        <AnimatePresence>
          {filterMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute left-0 right-0 top-12 z-50 rounded-2xl border border-white/[0.08] bg-zinc-900 p-3 shadow-2xl backdrop-blur-2xl"
            >
              <p className="px-3 py-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Filter by Type
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = (fileCategory || 'all') === cat.key;
                  return (
                    <button
                      key={cat.key}
                      className={`flex items-center space-x-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold'
                          : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                      }`}
                      onClick={() => {
                        setSection('type-filter', null, cat.key);
                        setFilterMenuOpen(false);
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Right Action Toolbar ───────────────────────────────── */}
      <div className="flex items-center space-x-2">
        {/* View Mode Switcher */}
        <div className="flex items-center rounded-xl bg-zinc-900 border border-white/[0.08] p-0.5">
          <button
            className={`p-2 rounded-lg transition-all ${
              viewMode === 'grid'
                ? 'bg-zinc-800 text-blue-400 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            className={`p-2 rounded-lg transition-all ${
              viewMode === 'list'
                ? 'bg-zinc-800 text-blue-400 shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            <List className="h-4 w-4" />
          </button>
        </div>

        {/* Inspector Toggle */}
        <Button
          variant="icon"
          className={isInspectorOpen ? 'bg-blue-600/15 text-blue-400 border-blue-500/30' : ''}
          onClick={() => setIsInspectorOpen(!isInspectorOpen)}
          title="Details Inspector"
        >
          <Info className="h-4 w-4" />
        </Button>

        {/* Auth Button */}
        {isAuthenticated && user ? (
          <div className="flex items-center space-x-2 pl-2 border-l border-white/[0.08]">
            <div className="flex items-center space-x-2 rounded-xl bg-zinc-900 border border-white/[0.08] px-3 py-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white uppercase">
                {user.username ? user.username[0] : 'U'}
              </div>
              <span className="text-xs font-semibold text-zinc-200 hidden sm:inline max-w-[100px] truncate">
                {user.username}
              </span>
            </div>

            <Button
              variant="icon"
              className="text-zinc-400 hover:text-rose-400"
              onClick={logout}
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={onOpenAuth}
            className="ml-2 font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md shadow-blue-600/20"
          >
            <User className="mr-1.5 h-3.5 w-3.5" /> Sign In
          </Button>
        )}
      </div>
    </header>
  );
};
