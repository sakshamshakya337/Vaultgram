import React from 'react';
import { UploadCloud, CheckCircle2, Cpu } from 'lucide-react';

export const UploadProgressBar = ({ progress, statusText, isComplete, isCompressing }) => {
  return (
    <div className="w-full space-y-3 p-4 rounded-2xl bg-zinc-900/90 border border-white/10 backdrop-blur-md animate-fade-in">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-zinc-300 font-medium">
          {isComplete ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : isCompressing ? (
            <Cpu className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
          ) : (
            <UploadCloud className="w-4 h-4 text-cyan-400 animate-bounce shrink-0" />
          )}
          <span className="truncate">{statusText || (isComplete ? 'Upload Complete!' : 'Processing...')}</span>
        </div>
        {!isCompressing && !isComplete && (
          <span className="font-mono font-bold text-cyan-400 shrink-0">{progress}%</span>
        )}
      </div>

      {/* Progress Track */}
      <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden relative">
        {isCompressing ? (
          <div className="h-full w-full bg-gradient-to-r from-amber-500 via-cyan-500 to-blue-500 animate-pulse" />
        ) : (
          <div
            className={`h-full transition-all duration-200 ease-out ${
              isComplete
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-rose-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        )}
      </div>
    </div>
  );
};
