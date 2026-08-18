import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  File,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrive } from '../../contexts/DriveContext';

export const UploadManager = () => {
  const {
    uploadQueue,
    clearCompletedUploads,
    isUploadManagerMinimized,
    setIsUploadManagerMinimized,
  } = useDrive();

  if (!uploadQueue || uploadQueue.length === 0) return null;

  const totalCount = uploadQueue.length;
  const completedCount = uploadQueue.filter((t) => t.status === 'completed').length;
  const isAllComplete = completedCount === totalCount;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed bottom-6 right-6 z-50 w-88 max-w-[92vw] overflow-hidden rounded-2xl border border-white/[0.1] bg-zinc-950/95 shadow-2xl backdrop-blur-2xl"
    >
      {/* ─── Upload Manager Header ───────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3.5 bg-zinc-900/80 border-b border-white/[0.06] cursor-pointer"
        onClick={() => setIsUploadManagerMinimized(!isUploadManagerMinimized)}
      >
        <div className="flex items-center space-x-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600/15 text-blue-400">
            <UploadCloud className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-zinc-100">
            {isAllComplete
              ? `${completedCount} uploads complete`
              : `Uploading ${completedCount}/${totalCount} files...`}
          </span>
        </div>

        <div className="flex items-center space-x-1">
          <button
            type="button"
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
            onClick={(e) => {
              e.stopPropagation();
              setIsUploadManagerMinimized(!isUploadManagerMinimized);
            }}
          >
            {isUploadManagerMinimized ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {isAllComplete && (
            <button
              type="button"
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              onClick={(e) => {
                e.stopPropagation();
                clearCompletedUploads();
              }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ─── Upload Items List ───────────────────────────────────── */}
      <AnimatePresence>
        {!isUploadManagerMinimized && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="max-h-60 overflow-y-auto p-3 space-y-2"
          >
            {uploadQueue.map((task) => (
              <div
                key={task.id}
                className="rounded-xl bg-zinc-900/60 border border-white/[0.04] p-2.5 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 min-w-0">
                    <File className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
                    <span className="font-medium text-zinc-200 truncate max-w-[170px]" title={task.file.name}>
                      {task.file.name}
                    </span>
                  </div>

                  <div>
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : task.status === 'error' ? (
                      <AlertCircle className="h-4 w-4 text-rose-400" title={task.error} />
                    ) : (
                      <span className="font-mono text-[11px] font-bold text-blue-400">
                        {task.progress}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {task.status === 'uploading' && (
                  <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-200"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
