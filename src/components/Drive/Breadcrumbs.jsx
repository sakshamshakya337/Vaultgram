import React from 'react';
import { ChevronRight, ArrowUpDown, Trash2, RotateCcw } from 'lucide-react';
import { useDrive } from '../../contexts/DriveContext';
import { Button } from '../ui/button';

export const Breadcrumbs = () => {
  const {
    breadcrumbs,
    currentFolderId,
    activeSection,
    setSection,
    sortOption,
    setSortOption,
    emptyTrash,
    items,
  } = useDrive();

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'starred':
        return 'Starred';
      case 'recent':
        return 'Recent';
      case 'trash':
        return 'Trash';
      case 'type-filter':
        return 'Filtered Files';
      default:
        return null;
    }
  };

  const sectionTitle = getSectionTitle();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-white/[0.04] mb-6">
      {/* ─── Breadcrumb Path ───────────────────────────────────── */}
      <nav className="flex items-center space-x-1.5 text-sm font-semibold text-zinc-300">
        {sectionTitle ? (
          <h2 className="text-xl font-bold font-display text-white">{sectionTitle}</h2>
        ) : (
          breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.id || idx}>
                {idx > 0 && <ChevronRight className="h-4 w-4 text-zinc-600 flex-shrink-0" />}
                <button
                  className={`rounded-lg px-2 py-1 transition-colors ${
                    isLast
                      ? 'text-white font-bold cursor-default'
                      : 'text-zinc-400 hover:text-sky-400 hover:bg-zinc-800/40'
                  }`}
                  onClick={() => {
                    if (!isLast) {
                      setSection('my-drive', crumb.id === 'root' ? null : crumb.id);
                    }
                  }}
                >
                  {crumb.title}
                </button>
              </React.Fragment>
            );
          })
        )}
      </nav>

      {/* ─── Action Controls / Sort ────────────────────────────── */}
      <div className="flex items-center space-x-3">
        {activeSection === 'trash' ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={emptyTrash}
            disabled={!items || items.length === 0}
            className="rounded-xl font-semibold text-xs"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Empty Trash
          </Button>
        ) : (
          <div className="flex items-center space-x-2 rounded-xl bg-zinc-900/60 border border-white/[0.08] px-2.5 py-1 text-xs">
            <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="bg-transparent text-zinc-300 font-medium focus:outline-none cursor-pointer"
            >
              <option value="newest" className="bg-zinc-900 text-white">Last Modified</option>
              <option value="oldest" className="bg-zinc-900 text-white">Oldest Modified</option>
              <option value="name-asc" className="bg-zinc-900 text-white">Name (A to Z)</option>
              <option value="name-desc" className="bg-zinc-900 text-white">Name (Z to A)</option>
              <option value="size-desc" className="bg-zinc-900 text-white">File Size (Largest)</option>
              <option value="size-asc" className="bg-zinc-900 text-white">File Size (Smallest)</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
};
