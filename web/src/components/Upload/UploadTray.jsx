import React from 'react';
import {
  X,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle,
  RotateCw,
  FileText,
  Video,
  Image as ImageIcon,
  Music,
  File,
  Loader2,
  Clock,
  Sparkles,
  Pause,
  Play
} from 'lucide-react';
import { useUploadQueue } from '../../contexts/useUploadQueue';
import { formatBytes } from '../../services/api';

export const UploadTray = () => {
  const {
    uploadQueue,
    isTrayOpen,
    isTrayMinimized,
    setIsTrayMinimized,
    dismissTray,
    cancelUpload,
    cancelAllUploads,
    retryUpload,
    clearCompleted,
    isProcessing,
    isPaused,
    togglePauseUploads,
    pauseUpload,
    resumeUpload,
  } = useUploadQueue();

  if (!isTrayOpen || uploadQueue.length === 0) return null;

  const totalFiles = uploadQueue.length;
  const completedFiles = uploadQueue.filter((i) => i.status === 'done').length;
  const errorFiles = uploadQueue.filter((i) => i.status === 'error').length;
  const activeItem = uploadQueue.find((i) => i.status === 'uploading' || i.status === 'compressing');
  const queuedFiles = uploadQueue.filter((i) => i.status === 'queued').length;
  const pausedFiles = uploadQueue.filter((i) => i.status === 'paused').length;
  const inProgress = (isProcessing || !!activeItem || queuedFiles > 0) && !isPaused;

  // Header Title
  let headerTitle = '';
  if (isPaused) {
    headerTitle = `Uploads Paused (${pausedFiles || queuedFiles} remaining)`;
  } else if (inProgress) {
    const currentNum = completedFiles + errorFiles + (activeItem ? 1 : 0);
    headerTitle = `Uploading ${Math.min(currentNum, totalFiles)} of ${totalFiles}`;
  } else if (errorFiles > 0 && completedFiles === 0) {
    headerTitle = `${errorFiles} ${errorFiles === 1 ? 'upload' : 'uploads'} failed`;
  } else if (errorFiles > 0) {
    headerTitle = `${completedFiles} complete, ${errorFiles} failed`;
  } else {
    headerTitle = `${completedFiles} ${completedFiles === 1 ? 'upload' : 'uploads'} complete`;
  }

  // Get icon by file type category
  const renderFileIcon = (category) => {
    switch (category) {
      case 'video':
        return <Video className="w-4 h-4 text-cyan-400 shrink-0" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'audio':
        return <Music className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'pdf':
      case 'document':
      case 'spreadsheet':
        return <FileText className="w-4 h-4 text-blue-400 shrink-0" />;
      default:
        return <File className="w-4 h-4 text-zinc-400 shrink-0" />;
    }
  };

  const hasPendingItems = uploadQueue.some(
    (i) => i.status === 'uploading' || i.status === 'compressing' || i.status === 'queued' || i.status === 'paused'
  );

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ease-in-out select-none
        bottom-20 inset-x-3 sm:bottom-6 sm:right-6 sm:left-auto sm:w-[390px]
      `}
    >
      <div className="rounded-2xl bg-zinc-900/95 border border-white/10 shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col text-white">
        {/* Tray Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-950/80 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {isPaused ? (
              <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Pause className="w-3 h-3 fill-amber-400" />
              </div>
            ) : inProgress ? (
              <div className="w-5 h-5 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin shrink-0" />
            ) : errorFiles > 0 ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            )}
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block truncate">
                {headerTitle}
              </span>
              {!isPaused && inProgress && activeItem && (
                <span className="text-[10px] text-zinc-400 block truncate font-mono">
                  {activeItem.status === 'compressing'
                    ? activeItem.isVideo
                      ? '⚡ Compressing on server...'
                      : '🔒 Finalizing in Vault...'
                    : `${activeItem.progress}% • ${activeItem.fileName}`}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {/* Pause / Resume Button for multi-batch */}
            {hasPendingItems && (
              <button
                onClick={togglePauseUploads}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm ${
                  isPaused
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                    : 'bg-white/10 text-cyan-300 border border-white/10 hover:bg-white/15'
                }`}
                title={isPaused ? 'Resume Uploads' : 'Pause Uploads'}
                aria-label={isPaused ? 'Resume Uploads' : 'Pause Uploads'}
              >
                {isPaused ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-amber-300" />
                    <span className="text-[11px]">Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-cyan-300" />
                    <span className="text-[11px]">Pause</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => setIsTrayMinimized((prev) => !prev)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title={isTrayMinimized ? 'Expand' : 'Minimize'}
              aria-label={isTrayMinimized ? 'Expand' : 'Minimize'}
            >
              {isTrayMinimized ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={dismissTray}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Hide tray (uploads continue in background)"
              aria-label="Hide tray"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tray Body - File Items List */}
        {!isTrayMinimized && (
          <div className="max-h-64 sm:max-h-72 overflow-y-auto no-scrollbar divide-y divide-white/5">
            {uploadQueue.map((item) => {
              const isUploading = item.status === 'uploading';
              const isCompressing = item.status === 'compressing';
              const isDone = item.status === 'done';
              const isError = item.status === 'error';
              const isQueued = item.status === 'queued';
              const isPausedItem = item.status === 'paused';

              return (
                <div
                  key={item.id}
                  className="px-4 py-3 hover:bg-white/[0.02] transition-colors flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {renderFileIcon(item.fileTypeCategory)}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-zinc-200 truncate leading-tight" title={item.fileName}>
                          {item.fileName}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono mt-0.5">
                          <span>{formatBytes(item.fileSize)}</span>
                          {item.folderTitle && <span>• in {item.folderTitle}</span>}
                          {item.category && !item.folderTitle && <span>• #{item.category}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Status & Action Icons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isDone && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}

                      {isUploading && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono text-cyan-400 font-bold">
                            {item.progress}%
                          </span>
                          <button
                            onClick={() => pauseUpload(item.id)}
                            className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-amber-300 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            title="Pause this upload"
                          >
                            <Pause className="w-3.5 h-3.5 fill-current" />
                          </button>
                          <button
                            onClick={() => cancelUpload(item.id)}
                            className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            title="Cancel upload"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {isCompressing && (
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[10px] font-semibold">
                            <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                            <span>{item.isVideo ? 'Compressing...' : 'Finalizing...'}</span>
                          </div>
                          <button
                            onClick={() => cancelUpload(item.id)}
                            className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            title="Cancel upload"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {isPausedItem && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-amber-300 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30">
                            Paused
                          </span>
                          <button
                            onClick={() => resumeUpload(item.id)}
                            className="w-7 h-7 flex items-center justify-center text-amber-300 hover:text-amber-200 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            title="Resume this upload"
                          >
                            <Play className="w-3.5 h-3.5 fill-amber-300" />
                          </button>
                          <button
                            onClick={() => cancelUpload(item.id)}
                            className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            title="Cancel upload"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {isQueued && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-800">
                            Queued
                          </span>
                          <button
                            onClick={() => cancelUpload(item.id)}
                            className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            title="Cancel queued upload"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {isError && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => retryUpload(item.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-[10px] font-bold transition-colors cursor-pointer min-h-[28px]"
                            title="Retry Upload"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>Retry</span>
                          </button>
                          <button
                            onClick={() => cancelUpload(item.id)}
                            className="w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            title="Dismiss"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar (Uploading) */}
                  {isUploading && (
                    <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden mt-1">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-200 ease-out rounded-full"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tray Footer (When Completed) */}
        {!isTrayMinimized && (completedFiles > 0 || errorFiles > 0) && (
          <div className="px-4 py-2.5 bg-zinc-950/90 border-t border-white/5 flex items-center justify-between text-xs shrink-0">
            <span className="text-zinc-500 text-[11px] font-mono">
              {completedFiles} of {totalFiles} completed
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={clearCompleted}
                className="text-[11px] font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Clear completed
              </button>
              {queuedFiles === 0 && !activeItem && (
                <button
                  onClick={cancelAllUploads}
                  className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
