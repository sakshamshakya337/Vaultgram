import React, { useState, useEffect, useRef } from 'react';
import { Play, Download, Clock, Eye, AlertCircle, Sparkles, HardDrive, ShieldCheck, FileText, Music, Image as ImageIcon } from 'lucide-react';
import { api, API_BASE_URL, formatBytes, formatDuration, formatViews } from '../../services/api';

export const SharePlayerPage = ({ token }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const videoRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadShareInfo() {
      try {
        setLoading(true);
        setError('');
        const res = await api.share.getInfo(token);
        if (active) {
          setData(res);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Share link is expired or invalid.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    if (token) {
      loadShareInfo();
    }

    return () => {
      active = false;
    };
  }, [token]);

  // Live countdown timer
  useEffect(() => {
    if (!data?.expiresAt) return;

    function updateRemaining() {
      const remainingMs = new Date(data.expiresAt).getTime() - Date.now();
      if (remainingMs <= 0) {
        setTimeLeft('Expired');
        setError('This share link has expired.');
        return;
      }

      const totalSecs = Math.floor(remainingMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;

      if (hours > 0) {
        setTimeLeft(`${hours}h ${mins}m left`);
      } else {
        setTimeLeft(`${mins}m ${secs}s left`);
      }
    }

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [data?.expiresAt]);

  const file = data?.file;
  const isVideo = file?.fileType === 'video' || (!file?.fileType && file?.duration > 0);
  const isImage = file?.fileType === 'image';
  const isAudio = file?.fileType === 'audio';

  // Guarantee absolute backend URLs so Vercel SPA rewrite never intercepts stream/download requests
  const streamUrl = file?.streamUrl
    ? (file.streamUrl.startsWith('http') ? file.streamUrl : `${API_BASE_URL}${file.streamUrl}`)
    : api.share.getStreamUrl(token);

  const downloadUrl = file?.downloadUrl
    ? (file.downloadUrl.startsWith('http') ? file.downloadUrl : `${API_BASE_URL}${file.downloadUrl}`)
    : api.share.getDownloadUrl(token);

  const posterUrl = file?.thumbnail?.startsWith('/api')
    ? `${API_BASE_URL}${file.thumbnail}`
    : (file?.thumbnail || '');

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      {/* Top Header */}
      <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/40 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-rose-500 flex items-center justify-center p-0.5 shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-white leading-none">
              Stream<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-rose-500">Vault</span>
            </h1>
            <span className="text-[9px] font-mono text-zinc-500">SECURE SHARED FILE</span>
          </div>
        </div>

        {timeLeft && timeLeft !== 'Expired' && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono font-semibold">
            <Clock className="w-3.5 h-3.5" />
            <span>{timeLeft}</span>
          </div>
        )}
      </header>

      {/* Main Content Body */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        {loading ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
            <p className="text-sm text-zinc-400 font-mono">Loading secure media...</p>
          </div>
        ) : error || !file ? (
          <div className="w-full max-w-md p-8 rounded-3xl bg-zinc-900/60 border border-white/10 text-center space-y-4 shadow-2xl backdrop-blur-xl">
            <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Link Unavailable</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {error || 'This link has expired or the file was deleted by the owner.'}
              </p>
            </div>
            <a
              href="/"
              className="inline-block px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors"
            >
              Go to Vaultgram
            </a>
          </div>
        ) : (
          <div className="w-full max-w-4xl rounded-3xl bg-zinc-900/50 border border-white/10 shadow-2xl overflow-hidden flex flex-col">
            {/* Player / Preview Display */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              {isVideo ? (
                <video
                  ref={videoRef}
                  src={streamUrl}
                  poster={posterUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : isImage ? (
                <img
                  src={streamUrl}
                  alt={file.title}
                  className="w-full h-full object-contain"
                />
              ) : isAudio ? (
                <div className="flex flex-col items-center gap-4 p-8 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <Music className="w-10 h-10" />
                  </div>
                  <audio src={streamUrl} controls className="w-full max-w-md" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 p-8 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <FileText className="w-10 h-10" />
                  </div>
                  <p className="text-xs text-zinc-400 font-mono">Document preview not supported</p>
                </div>
              )}
            </div>

            {/* File Info & Download Footer */}
            <div className="p-6 bg-zinc-950/80 border-t border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-white truncate" title={file.title}>
                    {file.title || 'Shared Video'}
                  </h2>
                  <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1 font-mono">
                    {file.fileSizeBytes ? <span>{formatBytes(file.fileSizeBytes)}</span> : null}
                    {file.duration ? (
                      <>
                        <span>•</span>
                        <span>{formatDuration(file.duration)}</span>
                      </>
                    ) : null}
                    {data.views ? (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3 text-zinc-500" />
                          <span>{data.views} views</span>
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>

                <a
                  href={downloadUrl}
                  download={file.title || 'shared-file'}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </a>
              </div>

              {/* Note / Description */}
              {(file.note || file.description) && (
                <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5 text-xs text-zinc-300">
                  {file.note && (
                    <p className="text-amber-300 font-semibold mb-1">
                      Note: {file.note}
                    </p>
                  )}
                  {file.description && <p className="text-zinc-400">{file.description}</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 border-t border-white/5 text-center text-xs text-zinc-500">
        <p className="flex items-center justify-center gap-1.5 font-mono text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>Encrypted Cloud Storage Powered by Vaultgram</span>
        </p>
      </footer>
    </div>
  );
};
