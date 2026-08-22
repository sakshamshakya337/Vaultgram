import React, { useState } from 'react';
import { X, Share2, Folder, Clock, Copy, Check, Lock, AlertCircle, Loader2, Infinity as InfinityIcon } from 'lucide-react';
import { api } from '../../services/api';
import { useVideoFeed } from '../../contexts/useVideoFeed';

export const ShareModal = ({
  isOpen,
  file = null,
  category = null,
  isFolder = false,
  onClose,
}) => {
  const { lockedCategories } = useVideoFeed();
  const [durationHours, setDurationHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [shareData, setShareData] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const isFolderMode = isFolder || (!file && !!category);
  const targetCategory = (category || file?.category || '').replace(/^#/, '').trim();
  const isLocked = lockedCategories.some((lc) => lc.toLowerCase() === targetCategory.toLowerCase());
  const fileId = file?._id || file?.id;

  const handleGenerate = async () => {
    if (isLocked) {
      setError(
        isFolderMode
          ? `Cannot share folder #${targetCategory} because it is locked with a PIN.`
          : 'Cannot share files from a locked category.'
      );
      return;
    }

    setLoading(true);
    setError('');
    try {
      let res;
      let fullUrl;

      if (isFolderMode) {
        res = await api.share.createFolder(targetCategory, durationHours);
        fullUrl = `${window.location.origin}/share/folder/${res.token}`;
      } else {
        res = await api.share.create(fileId, durationHours);
        fullUrl = `${window.location.origin}/share/${res.token}`;
      }

      setShareData({
        token: res.token,
        scope: isFolderMode ? 'folder' : 'file',
        category: targetCategory,
        expiresAt: res.expiresAt,
        fullUrl,
      });
    } catch (err) {
      setError(err.message || 'Failed to create share link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!shareData?.fullUrl) return;
    navigator.clipboard.writeText(shareData.fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const titleText = isFolderMode
    ? `Share Folder #${targetCategory}`
    : file?.title || 'Shared File';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div
        className="relative w-full max-w-md rounded-3xl bg-zinc-950 border border-white/10 p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              {isFolderMode ? <Folder className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">
                {isFolderMode ? 'Share Entire Folder' : 'Share File Link'}
              </h3>
              <p className="text-xs text-zinc-400 truncate max-w-[220px]" title={titleText}>
                {titleText}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Locked Category Protection Alert */}
        {isLocked ? (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
              <Lock className="w-4 h-4" />
              <span>Folder is Protected (#{targetCategory})</span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Public share links cannot be generated for locked folders or files within them. Unlock the category to share it publicly.
            </p>
          </div>
        ) : shareData ? (
          /* Link Generated Result */
          <div className="space-y-4 animate-fade-in">
            <div className="p-3.5 rounded-2xl bg-zinc-900 border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
                  {shareData.scope === 'folder' ? '📁 Folder Share Link' : '📄 File Share Link'}
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {shareData.expiresAt ? `Expires in ${durationHours}h` : '♾️ Never Expires'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareData.fullUrl}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 select-all outline-none"
                />
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
                    copied
                      ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/20'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                <span>
                  {shareData.expiresAt
                    ? `Expires: ${new Date(shareData.expiresAt).toLocaleString()}`
                    : 'Permanent Link (No Expiration)'}
                </span>
              </span>
              <button
                onClick={() => setShareData(null)}
                className="text-cyan-400 hover:underline font-semibold cursor-pointer text-[11px]"
              >
                Generate Another
              </button>
            </div>
          </div>
        ) : (
          /* Duration Picker Form */
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-zinc-300 block mb-2">
                Link Expiration Duration
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: '1 Hour', hours: 1 },
                  { label: '24 Hours', hours: 24 },
                  { label: '7 Days', hours: 168 },
                  { label: 'Never', hours: 0, isNever: true },
                ].map((opt) => (
                  <button
                    key={opt.hours}
                    type="button"
                    onClick={() => setDurationHours(opt.hours)}
                    className={`py-2.5 px-2 rounded-2xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      durationHours === opt.hours
                        ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shadow-md'
                        : 'bg-zinc-900/60 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {opt.isNever && <span className="text-[10px] font-mono text-cyan-400">♾️ Permanent</span>}
                  </button>
                ))}
              </div>
            </div>

            {isFolderMode && (
              <div className="p-3 rounded-2xl bg-zinc-900/60 border border-white/5 text-xs text-zinc-400 space-y-1">
                <p className="font-semibold text-white">📁 Folder Sharing Access</p>
                <p className="text-[11px] leading-relaxed">
                  Recipients with this link can view and download all files inside <span className="text-cyan-400 font-mono">#{targetCategory}</span> without signing in.
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-xs text-rose-400 font-semibold px-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-blue-500 text-white font-bold text-xs shadow-xl shadow-cyan-500/20 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isFolderMode ? (
                <Folder className="w-4 h-4" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
              <span>{isFolderMode ? 'Generate Folder Share Link' : 'Create Share Link'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
