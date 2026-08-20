import React, { useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, Video, Play, Loader2 } from 'lucide-react';
import { api, formatBytes, formatDuration } from '../../services/api';
import { DeleteConfirmModal } from './DeleteConfirmModal';

export const TrashView = ({
  items = [],
  viewMode = 'grid',
  onItemRestored,
  onItemDeletedPermanently,
  onTrashEmptied,
}) => {
  const [restoringId, setRestoringId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);

  const getDaysRemaining = (trashedAt) => {
    if (!trashedAt) return 30;
    const elapsedDays = Math.floor((Date.now() - new Date(trashedAt).getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, 30 - elapsedDays);
  };

  const handleRestore = async (item) => {
    const id = item._id || item.id;
    setRestoringId(id);
    try {
      await api.drive.restore(id);
      if (onItemRestored) onItemRestored(id);
    } catch (err) {
      alert(err.message || 'Failed to restore item');
    } finally {
      setRestoringId(null);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const id = deleteTarget._id || deleteTarget.id;
      await api.drive.delete(id);
      if (onItemDeletedPermanently) onItemDeletedPermanently(id);
      setDeleteTarget(null);
    } catch (err) {
      alert(err.message || 'Failed to permanently delete item');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm('Are you sure you want to empty the trash? All items will be permanently deleted and cannot be recovered.')) {
      return;
    }
    setIsEmptyingTrash(true);
    try {
      await api.drive.emptyTrash();
      if (onTrashEmptied) onTrashEmptied();
    } catch (err) {
      alert(err.message || 'Failed to empty trash');
    } finally {
      setIsEmptyingTrash(false);
    }
  };

  if (!items || items.length === 0) {
    return (
      <div className="p-12 rounded-3xl bg-zinc-900/30 border border-white/5 flex flex-col items-center justify-center text-center space-y-4 my-6">
        <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-600">
          <Trash2 className="w-8 h-8 text-zinc-600" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white mb-1">Trash is Empty</h4>
          <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
            Items deleted from your drive will be held here for 30 days before being automatically purged forever.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 30-Day Auto-Purge Notice & Empty Trash Bar */}
      <div className="p-4 rounded-2xl bg-zinc-900/70 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs text-zinc-300">
            Items in Trash are automatically deleted forever after <span className="font-bold text-white">30 days</span>.
          </p>
        </div>

        <button
          onClick={handleEmptyTrash}
          disabled={isEmptyingTrash}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer shrink-0 disabled:opacity-50"
        >
          {isEmptyingTrash ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
          <span>Empty Trash ({items.length})</span>
        </button>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {items.map((item) => {
          const id = item._id || item.id;
          const daysLeft = getDaysRemaining(item.trashedAt);
          const isRestoring = restoringId === id;

          return (
            <div
              key={id}
              className="relative rounded-2xl bg-zinc-900/50 border border-white/5 overflow-hidden shadow-lg flex flex-col justify-between"
            >
              {/* Thumbnail Area */}
              <div className="relative w-full aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden">
                {item.thumbnail || item.thumbnailFileId ? (
                  <img
                    src={item.thumbnail || api.videos.getThumbnailUrl(id)}
                    alt=""
                    className="w-full h-full object-cover opacity-60"
                  />
                ) : (
                  <Video className="w-8 h-8 text-zinc-700" />
                )}

                {/* Days Remaining Badge */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-white/10 text-[10px] font-mono font-semibold text-amber-300">
                  {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                </div>

                {item.duration ? (
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono text-zinc-300 font-semibold">
                    {formatDuration(item.duration)}
                  </div>
                ) : null}
              </div>

              {/* Body & Actions */}
              <div className="p-3.5 space-y-3">
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-zinc-300 truncate" title={item.title}>
                    {item.title || 'Untitled File'}
                  </h4>
                  <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                    {item.fileSizeBytes ? formatBytes(item.fileSizeBytes) : '—'} • #{item.category || 'General'}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={() => handleRestore(item)}
                    disabled={isRestoring}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    {isRestoring ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                    <span>Restore</span>
                  </button>

                  <button
                    onClick={() => setDeleteTarget(item)}
                    className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
                    title="Delete Forever"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Permanent Delete Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Permanently"
        itemName={deleteTarget?.title || 'this file'}
        itemType="file"
        loading={isDeleting}
        onConfirm={handleConfirmPermanentDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
