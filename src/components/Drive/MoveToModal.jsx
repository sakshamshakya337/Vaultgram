import React, { useState } from 'react';
import { X, Folder, FolderSymlink, Sparkles, Check, Loader2, HardDrive } from 'lucide-react';
import { api } from '../../services/api';

export const MoveToModal = ({
  isOpen,
  onClose,
  targetItems = [], // Array of file objects
  folders = [],
  categories = [],
  currentFolder = null,
  currentCategory = 'All',
  onMoveSuccess,
}) => {
  const [selectedDestination, setSelectedDestination] = useState(null); // { type: 'folder' | 'category' | 'root', id: string, name: string }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || targetItems.length === 0) return null;

  const handleConfirmMove = async () => {
    if (!selectedDestination) return;
    setIsSubmitting(true);
    setError(null);

    const ids = targetItems.map((item) => item._id || item.id);

    try {
      let targetFolderId = null;
      let newCategory = null;

      if (selectedDestination.type === 'folder') {
        targetFolderId = selectedDestination.id;
      } else if (selectedDestination.type === 'category') {
        newCategory = selectedDestination.name.replace(/^#/, '');
        targetFolderId = null;
      } else if (selectedDestination.type === 'root') {
        targetFolderId = 'root';
      }

      await api.drive.batchMove(ids, targetFolderId, newCategory);

      if (onMoveSuccess) {
        onMoveSuccess({
          ids,
          destination: selectedDestination,
        });
      }
      onClose();
    } catch (err) {
      console.error('[MoveToModal error]:', err);
      setError(err.message || 'Failed to move items');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCurrentLocation = (type, id, name) => {
    if (type === 'root' && !currentFolder && (!currentCategory || currentCategory === 'All')) return true;
    if (type === 'folder' && currentFolder && String(currentFolder._id || currentFolder.id) === String(id)) return true;
    if (type === 'category' && currentCategory && currentCategory.replace(/^#/, '').toLowerCase() === name.replace(/^#/, '').toLowerCase()) return true;
    return false;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-zinc-950 border border-white/10 shadow-2xl p-6 space-y-5 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <FolderSymlink className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Move to...</h3>
              <p className="text-xs text-zinc-400">
                Move {targetItems.length} {targetItems.length === 1 ? 'file' : 'files'} to another folder or category
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs shrink-0">
            {error}
          </div>
        )}

        {/* Destination List */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar">
          {/* Root Destination */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">
              Main Location
            </span>
            <div
              onClick={() => !isCurrentLocation('root') && setSelectedDestination({ type: 'root', id: 'root', name: 'My Drive (Root)' })}
              className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                isCurrentLocation('root')
                  ? 'opacity-40 bg-zinc-900/30 border-white/5 cursor-not-allowed'
                  : selectedDestination?.type === 'root'
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-zinc-900/50 hover:bg-zinc-900 border-white/5 text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold">My Drive (Root)</span>
              </div>
              {isCurrentLocation('root') ? (
                <span className="text-[10px] text-zinc-500 font-mono">Current</span>
              ) : selectedDestination?.type === 'root' ? (
                <Check className="w-4 h-4 text-cyan-400" />
              ) : null}
            </div>
          </div>

          {/* Custom User Folders */}
          {folders.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">
                Folders ({folders.length})
              </span>
              <div className="space-y-1">
                {folders.map((folder) => {
                  const fId = folder._id || folder.id;
                  const fTitle = folder.title || 'Untitled Folder';
                  const isCurrent = isCurrentLocation('folder', fId, fTitle);
                  const isSelected = selectedDestination?.type === 'folder' && selectedDestination.id === fId;

                  return (
                    <div
                      key={fId}
                      onClick={() => !isCurrent && setSelectedDestination({ type: 'folder', id: fId, name: fTitle })}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                        isCurrent
                          ? 'opacity-40 bg-zinc-900/30 border-white/5 cursor-not-allowed'
                          : isSelected
                          ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                          : 'bg-zinc-900/50 hover:bg-zinc-900 border-white/5 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate pr-2">
                        <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="text-xs font-semibold truncate">{fTitle}</span>
                      </div>
                      {isCurrent ? (
                        <span className="text-[10px] text-zinc-500 font-mono">Current</span>
                      ) : isSelected ? (
                        <Check className="w-4 h-4 text-blue-400" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Categories / Smart Folders */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 font-mono">
              Categories ({categories.filter((c) => c !== 'All').length})
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {categories
                .filter((c) => c !== 'All')
                .map((cat) => {
                  const isCurrent = isCurrentLocation('category', cat, cat);
                  const isSelected = selectedDestination?.type === 'category' && selectedDestination.name === cat;

                  return (
                    <div
                      key={cat}
                      onClick={() => !isCurrent && setSelectedDestination({ type: 'category', id: cat, name: cat })}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
                        isCurrent
                          ? 'opacity-40 bg-zinc-900/30 border-white/5 cursor-not-allowed'
                          : isSelected
                          ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                          : 'bg-zinc-900/50 hover:bg-zinc-900 border-white/5 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="text-xs font-semibold truncate">#{cat}</span>
                      </div>
                      {isCurrent ? (
                        <span className="text-[9px] text-zinc-500 font-mono">Current</span>
                      ) : isSelected ? (
                        <Check className="w-3.5 h-3.5 text-purple-400" />
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmMove}
            disabled={!selectedDestination || isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 hover:opacity-95 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Moving...</span>
              </>
            ) : (
              <span>Move {targetItems.length > 1 ? `(${targetItems.length})` : ''}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
