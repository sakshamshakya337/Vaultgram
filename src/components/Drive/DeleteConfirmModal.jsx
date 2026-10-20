import React from 'react';
import { Trash2, AlertTriangle, X, RefreshCw, CheckCircle2 } from 'lucide-react';

export const DeleteConfirmModal = ({
  isOpen,
  title = 'Delete File',
  itemName = 'this item',
  itemType = 'file',
  fileCount = 0,
  onConfirm,
  onCancel,
  onRetry,
  loading = false,
  error = null,
}) => {
  if (!isOpen) return null;

  const isFolder = itemType === 'folder';

  const getErrorInfo = () => {
    if (!error) return null;
    const msg = typeof error === 'string' ? error : error?.message || 'Failed to complete deletion';
    const lower = msg.toLowerCase();

    if (lower.includes('already deleted') || lower.includes('folder not found') || lower.includes('item not found')) {
      return {
        title: 'Folder Already Removed',
        text: 'This folder has already been deleted from your storage.',
        isAlreadyDeleted: true,
      };
    }
    if (lower.includes('locked') || lower.includes('pin') || lower.includes('vault') || lower.includes('verification')) {
      return {
        title: 'Locked Folder - Verification Required',
        text: msg,
        isLockError: true,
      };
    }
    if (lower.includes('network') || lower.includes('connection')) {
      return {
        title: 'Network Error',
        text: 'Could not connect to the storage service. Please check your network and retry.',
        isNetworkError: true,
      };
    }
    if (lower.includes('telegram')) {
      return {
        title: 'Telegram Storage Issue',
        text: msg,
        isTelegramError: true,
      };
    }
    return {
      title: 'Deletion Incomplete',
      text: msg,
      isGeneralError: true,
    };
  };

  const errorInfo = getErrorInfo();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-zinc-950 border border-white/10 shadow-2xl p-6 overflow-hidden">
        {/* Close button */}
        <button
          onClick={onCancel}
          disabled={loading}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer disabled:opacity-40"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Warning / Error Icon */}
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-lg ${
          errorInfo?.isAlreadyDeleted
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-emerald-500/10'
            : error
            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-amber-500/10'
            : 'bg-rose-500/10 border border-rose-500/20 text-rose-400 shadow-rose-500/10'
        }`}>
          {errorInfo?.isAlreadyDeleted ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          ) : error ? (
            <AlertTriangle className="w-6 h-6" />
          ) : (
            <Trash2 className="w-6 h-6" />
          )}
        </div>

        {/* Header */}
        <h3 className="text-base font-bold text-white mb-1.5">{title}</h3>

        {/* Description */}
        {isFolder ? (
          <div className="space-y-2 mb-5">
            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to delete folder <span className="text-white font-bold break-all">"{itemName}"</span>?
            </p>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-zinc-400 space-y-1">
              <p className="flex items-center gap-1.5 text-zinc-300">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
                <span>
                  {fileCount > 0 ? (
                    <>Permanently deletes <strong className="text-white">{fileCount} item{fileCount === 1 ? '' : 's'}</strong> and subfolders in MongoDB.</>
                  ) : (
                    <>Deletes folder record and subfolders in MongoDB.</>
                  )}
                </span>
              </p>
              <p className="flex items-center gap-1.5 text-zinc-300">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                <span>
                  Purges all media files and thumbnails from <strong className="text-cyan-300">Telegram cloud</strong>.
                </span>
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
            Are you sure you want to delete <span className="text-white font-semibold break-all">"{itemName}"</span>? This action cannot be undone and will permanently remove it from your storage and Telegram.
          </p>
        )}

        {/* Error Notice */}
        {errorInfo && (
          <div className={`mb-4 p-3 rounded-xl border text-xs flex flex-col gap-1.5 ${
            errorInfo.isAlreadyDeleted
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
          }`}>
            <div className="flex items-start gap-2">
              {errorInfo.isAlreadyDeleted ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-semibold ${errorInfo.isAlreadyDeleted ? 'text-emerald-200' : 'text-rose-200'}`}>
                  {errorInfo.title}
                </p>
                <p className={`text-[11px] leading-tight ${errorInfo.isAlreadyDeleted ? 'text-emerald-300/90' : 'text-rose-300/90'}`}>
                  {errorInfo.text}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading Progress Notice */}
        {loading && (
          <div className="mb-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin shrink-0" />
            <span className="text-[11px] font-medium text-cyan-200">
              Purging from Telegram cloud and database...
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition-colors cursor-pointer text-center disabled:opacity-40"
          >
            {errorInfo?.isAlreadyDeleted ? 'Done' : 'Cancel'}
          </button>

          {!errorInfo?.isAlreadyDeleted && (
            error && onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white font-bold text-xs shadow-lg shadow-cyan-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Delete</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs shadow-lg shadow-rose-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    <span className="text-[11px]">Deleting...</span>
                  </div>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
