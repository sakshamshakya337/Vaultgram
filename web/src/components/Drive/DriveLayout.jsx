import React, { useState, useMemo } from 'react';
import { Video, Plus, Search, Folder, Sparkles, FolderOpen, Heart, Trash2 } from 'lucide-react';
import { useVideoFeed } from '../../contexts/VideoFeedContext';
import { useAuth } from '../../contexts/AuthContext';
import { DriveSidebar } from './DriveSidebar';
import { DriveHeader } from './DriveHeader';
import { DriveFolderGrid } from './DriveFolderGrid';
import { DriveFilesGrid } from './DriveFilesGrid';
import { DriveFilesList } from './DriveFilesList';
import { DesktopVideoModal } from './DesktopVideoModal';

export const DriveLayout = () => {
  const {
    videos,
    loading,
    selectedCategory,
    setSelectedCategory,
    requestCategory,
    categories,
    setIsUploadOpen,
  } = useVideoFeed();

  const { isAuthenticated, setIsAuthOpen } = useAuth();

  const [currentNav, setCurrentNav] = useState('all'); // 'all', 'starred', 'recent', 'trash'
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [selectedVideo, setSelectedVideo] = useState(null);

  // Compute category counts for folder badges
  const categoryCounts = useMemo(() => {
    const counts = {};
    (videos || []).forEach((v) => {
      if (v.category) {
        const cat = v.category.toLowerCase().trim();
        counts[cat] = (counts[cat] || 0) + 1;
      }
    });
    return counts;
  }, [videos]);

  // Filter videos based on navigation, category, and search query
  const filteredVideos = useMemo(() => {
    let list = [...(videos || [])];

    // Nav-level filtering
    if (currentNav === 'starred') {
      list = list.filter((v) => !!v.isStarred);
    } else if (currentNav === 'recent') {
      list = list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (currentNav === 'trash') {
      return []; // Stub for Trash
    }

    // Category filtering
    if (currentNav === 'all' && selectedCategory !== 'All') {
      list = list.filter(
        (v) => (v.category || '').toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Search query filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (v) =>
          (v.title || '').toLowerCase().includes(q) ||
          (v.category || '').toLowerCase().includes(q) ||
          (v.description || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [videos, currentNav, selectedCategory, searchQuery]);

  const handleResetToRoot = () => {
    setCurrentNav('all');
    setSelectedCategory('All');
    setSearchQuery('');
  };

  const isAtRoot = currentNav === 'all' && selectedCategory === 'All' && !searchQuery.trim();

  return (
    <div className="flex w-screen h-screen bg-black text-white overflow-hidden select-none font-sans">
      {/* 1. Left Sidebar (~260px) */}
      <DriveSidebar
        currentNav={currentNav}
        onSelectNav={(nav) => {
          setCurrentNav(nav);
          if (nav !== 'all') {
            setSelectedCategory('All');
          }
        }}
      />

      {/* 2. Main Drive Layout Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-zinc-950/40">
        {/* Top Header Bar */}
        <DriveHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          currentNav={currentNav}
          onResetToRoot={handleResetToRoot}
        />

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
          {/* FOLDERS SECTION (Visible when at root My Drive) */}
          {isAtRoot && (
            <DriveFolderGrid
              categoryCounts={categoryCounts}
              onSelectCategory={(cat) => requestCategory(cat)}
            />
          )}

          {/* FILES SECTION */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {currentNav === 'starred'
                    ? 'Starred Videos'
                    : currentNav === 'recent'
                    ? 'Recent Uploads'
                    : currentNav === 'trash'
                    ? 'Trash'
                    : selectedCategory === 'All'
                    ? 'All Files'
                    : `#${selectedCategory} Files`}
                </h3>
                <span className="text-xs font-mono text-zinc-500">
                  ({filteredVideos.length})
                </span>
              </div>
            </div>

            {/* Empty State */}
            {filteredVideos.length === 0 && !loading && (
              <div className="p-12 rounded-3xl bg-zinc-900/30 border border-white/5 flex flex-col items-center justify-center text-center space-y-4 my-6">
                <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-600">
                  {currentNav === 'starred' ? (
                    <Heart className="w-8 h-8 text-rose-500/40" />
                  ) : currentNav === 'trash' ? (
                    <Trash2 className="w-8 h-8 text-zinc-600" />
                  ) : (
                    <FolderOpen className="w-8 h-8 text-cyan-500/40" />
                  )}
                </div>

                <div className="max-w-xs">
                  <h4 className="text-base font-bold text-white mb-1">
                    {currentNav === 'starred'
                      ? 'No Starred Videos'
                      : currentNav === 'trash'
                      ? 'Trash is Empty'
                      : searchQuery
                      ? 'No Matching Videos'
                      : 'No Videos in this Category'}
                  </h4>
                  <p className="text-xs text-zinc-400">
                    {currentNav === 'starred'
                      ? 'Click the heart icon on any video card to star it.'
                      : currentNav === 'trash'
                      ? 'Items you delete will appear here.'
                      : searchQuery
                      ? `No files match "${searchQuery}". Try a different keyword.`
                      : 'Upload your first video to start building your cloud library.'}
                  </p>
                </div>

                {currentNav === 'all' && (
                  <button
                    onClick={() => setIsUploadOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Upload Video</span>
                  </button>
                )}
              </div>
            )}

            {/* Grid vs List View */}
            {filteredVideos.length > 0 && (
              viewMode === 'grid' ? (
                <DriveFilesGrid
                  videos={filteredVideos}
                  onSelectVideo={(v) => setSelectedVideo(v)}
                />
              ) : (
                <DriveFilesList
                  videos={filteredVideos}
                  onSelectVideo={(v) => setSelectedVideo(v)}
                />
              )
            )}
          </div>
        </main>
      </div>

      {/* Desktop Video Playback Modal with HTML5 Controls */}
      <DesktopVideoModal
        video={selectedVideo}
        onClose={() => setSelectedVideo(null)}
      />
    </div>
  );
};
