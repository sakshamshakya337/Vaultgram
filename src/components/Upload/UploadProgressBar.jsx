import React from 'react';
import { UploadCloud, CheckCircle2 } from 'lucide-react';

export const UploadProgressBar = ({ progress, statusText, isComplete }) => {
  return (
    <div className="w-full space-y-3 p-4 rounded-2xl bg-zinc-900/90 border border-white/10 backdrop-blur-md">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-zinc-300 font-medium">
          {isComplete ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <UploadCloud className="w-4 h-4 text-cyan-400 animate-bounce" />
          )}
          <span>{statusText || (isComplete ? 'Upload Complete!' : 'Uploading to Telegram Vault...')}</span>
        </div>
        <span className="font-mono font-bold text-cyan-400">{progress}%</span>
      </div>

      {/* Progress Track */}
      <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full transition-all duration-200 ease-out ${
            isComplete
              ? 'bg-emerald-500'
              : 'bg-gradient-to-r from-cyan-500 via-blue-500 to-rose-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
