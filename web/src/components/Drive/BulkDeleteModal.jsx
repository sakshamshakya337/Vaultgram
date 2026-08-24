import React, { useState } from 'react';
import { Trash2, X, AlertTriangle, Loader2 } from 'lucide-react';

export const BulkDeleteModal = ({
  isOpen,
  onClose,
  count = 0,
  onConfirm,
  isPermanent = false,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || count === 0) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('[BulkDelete error]:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-zinc-950 border border-white/10 shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <Trash2 className="w-6 h-6" />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h3 className="text-base font-bold text-white mb-1.5">
            {isPermanent ? 'Delete Permanently?' : `Move ${count} ${count === 1 ? 'item' : 'items'} to Trash?`}
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {isPermanent
              ? `Are you sure you want to permanently delete these ${count} files? This action cannot be undone.`
              : `These ${count} files will be moved to the Trash. You can restore them at any time.`}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-lg shadow-rose-500/20 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>{isPermanent ? 'Delete Permanently' : 'Move to Trash'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
