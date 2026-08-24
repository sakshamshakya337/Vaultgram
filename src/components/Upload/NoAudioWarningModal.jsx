import React from 'react';
import { VolumeX, AlertTriangle, X, Check, ArrowRight, SkipForward, Upload } from 'lucide-react';
import { formatBytes } from '../../services/api';

export const NoAudioWarningModal = ({
  isOpen,
  silentFiles = [],
  currentIndex = 0,
  onSkipCurrent,
  onUploadCurrent,
  onSkipAll,
  onUploadAll,
  onCancel,
}) => {
  if (!isOpen || !silentFiles || silentFiles.length === 0) return null;

  const currentFile = silentFiles[currentIndex] || silentFiles[0];
  const totalSilent = silentFiles.length;
  const isMultiple = totalSilent > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in select-none">
      <div
        className="relative w-full max-w-md rounded-3xl bg-zinc-950 border border-amber-500/30 p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
              <VolumeX className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">No Audio Detected</h3>
              <p className="text-[11px] font-mono text-amber-400">
                {isMultiple ? `Silent Video ${currentIndex + 1} of ${totalSilent}` : 'Silent Video Check'}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* File Card info */}
        <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white truncate max-w-[260px]" title={currentFile.name}>
              {currentFile.name}
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              {formatBytes(currentFile.size)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-amber-300/90 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>This video does not contain an audio track.</span>
          </div>
        </div>

        {/* Explanation prompt */}
        <p className="text-xs text-zinc-300 leading-relaxed">
          Do you want to <strong className="text-white">skip</strong> this silent video from uploading, or <strong className="text-cyan-400">upload it anyway</strong> to your vault?
        </p>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={onSkipCurrent}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-white/20 text-white font-bold text-xs transition-all active:scale-[0.98] cursor-pointer"
            >
              <SkipForward className="w-4 h-4 text-amber-400" />
              <span>Skip Video</span>
            </button>

            <button
              onClick={onUploadCurrent}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Anyway</span>
            </button>
          </div>

          {/* Bulk actions if multiple files */}
          {isMultiple && (
            <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-zinc-400">
              <button
                onClick={onSkipAll}
                className="text-amber-400 hover:underline font-semibold cursor-pointer"
              >
                Skip All Silent ({totalSilent})
              </button>
              <button
                onClick={onUploadAll}
                className="text-cyan-400 hover:underline font-semibold cursor-pointer"
              >
                Upload All Anyway
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
