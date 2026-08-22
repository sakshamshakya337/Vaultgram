import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  Download,
  Play,
  Image as ImageIcon,
  FileText,
  Music,
  Video,
  Eye,
  Clock,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  X,
  ExternalLink,
  ChevronRight,
  Loader2,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { api, API_BASE_URL, formatBytes, formatDuration } from '../../services/api';

export const ShareFolderPage = ({ token: propToken }) => {
  const token = propToken || window.location.pathname.replace(/^\/share\/folder\//, '').split('/')[0];
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const [activePreviewFile, setActivePreviewFile] = useState(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Helper to ensure URL points to absolute backend
  const toAbsoluteUrl = (relPath) => {
    if (!relPath) return '';
    if (relPath.startsWith('http://') || relPath.startsWith('https://')) return relPath;
    const cleanPath = relPath.startsWith('/') ? relPath : `/${relPath}`;
    return `${API_BASE_URL}${cleanPath}`;
  };

  useEffect(() => {
    let isMounted = true;
    const fetchFolderData = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await api.share.getFolderInfo(token);
        if (isMounted) {
          const normalizedFiles = (res.files || []).map((f) => {
            const streamUrl = toAbsoluteUrl(
              f.streamUrl || `/share/folder/${token}/file/${f._id || f.id}/stream`
            );
            const downloadUrl = toAbsoluteUrl(
              f.downloadUrl || `/share/folder/${token}/file/${f._id || f.id}/download`
            );
            return {
              ...f,
              streamUrl,
              downloadUrl,
            };
          });

          setData({
            ...res,
            files: normalizedFiles,
          });
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'This folder share link has expired or is invalid.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchFolderData();
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Expiration countdown
  useEffect(() => {
    if (!data?.expiresAt) {
      if (data) setTimeLeft('Never Expires');
      return;
    }

    const updateCountdown = () => {
      const remaining = new Date(data.expiresAt).getTime() - Date.now();
      if (remaining <= 0) {
        setTimeLeft('Expired');
        setError('This folder share link has expired.');
        return;
      }

      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeLeft(`${days}d ${hours % 24}h remaining`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m remaining`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s remaining`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [data?.expiresAt]);

  // Single file download helper with Content-Disposition / Blob fallback
  const downloadSingleFile = async (file) => {
    try {
      const fileUrl = toAbsoluteUrl(file.downloadUrl);
      const response = await fetch(fileUrl, {
        method: 'GET',
        headers: { 'bypass-tunnel-reminder': 'true' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Extract filename from response header
      const disposition = response.headers.get('Content-Disposition') || '';
      let targetFilename = file.title || 'shared-file';
      const filenameMatch = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      if (filenameMatch && filenameMatch[1]) {
        targetFilename = decodeURIComponent(filenameMatch[1].replace(/["']/g, ''));
      } else if (file.extension && !targetFilename.toLowerCase().endsWith(`.${file.extension.toLowerCase()}`)) {
        targetFilename = `${targetFilename}.${file.extension}`;
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = targetFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn('Direct blob download fallback to native a-click:', file.title, err);
      const fallbackUrl = toAbsoluteUrl(file.downloadUrl);
      const link = document.createElement('a');
      link.href = fallbackUrl;
      link.download = file.title || 'shared-file';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Download All Files Sequentially
  const handleDownloadAll = async () => {
    if (!data?.files || data.files.length === 0 || downloadingAll) return;
    setDownloadingAll(true);
    setDownloadProgress(0);

    const total = data.files.length;
    for (let i = 0; i < total; i++) {
      const file = data.files[i];
      await downloadSingleFile(file);
      setDownloadProgress(Math.round(((i + 1) / total) * 100));
      // 500ms delay between downloads so browser doesn't block multi-downloads
      await new Promise((r) => setTimeout(r, 500));
    }

    setTimeout(() => {
      setDownloadingAll(false);
      setDownloadProgress(0);
    }, 1500);
  };

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'video':
        return <Video className="w-5 h-5 text-cyan-400" />;
      case 'image':
        return <ImageIcon className="w-5 h-5 text-emerald-400" />;
      case 'audio':
        return <Music className="w-5 h-5 text-purple-400" />;
      default:
        return <FileText className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between selection:bg-cyan-500 selection:text-black">
      {/* Top Header */}
      <header className="px-4 md:px-8 py-3.5 md:py-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/60 backdrop-blur-xl shrink-0 z-20 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-500 to-rose-500 flex items-center justify-center p-0.5 shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight text-white leading-none flex items-center gap-1.5">
              <span>Stream<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-rose-500">Vault</span></span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 uppercase">
                Folder Share
              </span>
            </h1>
            <span className="text-[10px] font-mono text-zinc-400">
              {data ? `#${data.category}` : 'SECURE SHARED FOLDER'}
            </span>
          </div>
        </div>

        {timeLeft && timeLeft !== 'Expired' && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono font-semibold">
            <Clock className="w-3.5 h-3.5" />
            <span>{timeLeft}</span>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
            <div className="w-12 h-12 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
            <p className="text-sm text-zinc-400 font-mono">Loading shared folder contents...</p>
          </div>
        ) : error || !data ? (
          <div className="w-full max-w-md mx-auto my-16 p-8 rounded-3xl bg-zinc-900/60 border border-white/10 text-center space-y-4 shadow-2xl backdrop-blur-xl">
            <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Folder Unavailable</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {error || 'This link has expired or the folder was removed by the owner.'}
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
          <div className="space-y-6 animate-fade-in">
            {/* Folder Info Banner & Action Row */}
            <div className="p-5 sm:p-6 rounded-3xl bg-zinc-900/70 border border-white/10 shadow-xl backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg">
                  <Folder className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    <span>#{data.category}</span>
                  </h2>
                  <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1 font-mono">
                    <span>{data.totalFiles} {data.totalFiles === 1 ? 'file' : 'files'}</span>
                    <span>•</span>
                    <span>{formatBytes(data.totalBytes)}</span>
                    {data.views ? (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{data.views} views</span>
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadAll}
                  disabled={downloadingAll || data.totalFiles === 0}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {downloadingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Downloading ({downloadProgress}%)</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download All ({data.totalFiles})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* File Cards Grid */}
            {data.files.length === 0 ? (
              <div className="text-center py-16 text-zinc-500 space-y-2">
                <Folder className="w-12 h-12 mx-auto text-zinc-600 stroke-[1.5]" />
                <p className="text-sm font-semibold">This folder is empty</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {data.files.map((file) => {
                  const isVideo = file.fileType === 'video';
                  const isImage = file.fileType === 'image';
                  const isAudio = file.fileType === 'audio';
                  const thumb = file.thumbnail;

                  return (
                    <div
                      key={file._id}
                      className="group relative rounded-2xl bg-zinc-900/60 border border-white/10 hover:border-cyan-500/40 hover:bg-zinc-900/90 transition-all overflow-hidden flex flex-col cursor-pointer shadow-lg hover:shadow-cyan-500/10"
                      onClick={() => setActivePreviewFile(file)}
                    >
                      {/* Media Thumbnail Area */}
                      <div className="relative aspect-video sm:aspect-square bg-zinc-950 overflow-hidden flex items-center justify-center">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={file.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : isImage ? (
                          <img
                            src={file.streamUrl}
                            alt={file.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-3 text-center">
                            {getFileIcon(file.fileType)}
                            <span className="text-[10px] font-mono text-zinc-500 mt-1 uppercase">
                              {file.fileCategory || file.fileType}
                            </span>
                          </div>
                        )}

                        {/* Media badge / duration overlay */}
                        {isVideo && (
                          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                            <div className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-md">
                              <Play className="w-4 h-4 fill-white ml-0.5" />
                            </div>
                            {file.duration > 0 && (
                              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                                {formatDuration(file.duration)}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Quick Download Button on card */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadSingleFile(file);
                          }}
                          className="absolute top-2 right-2 w-8 h-8 rounded-xl bg-black/70 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:text-cyan-400 hover:bg-black transition-colors shadow-md opacity-0 group-hover:opacity-100 z-10 cursor-pointer"
                          title="Download file"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>

                      {/* File Details */}
                      <div className="p-3 flex-1 flex flex-col justify-between space-y-1">
                        <h3
                          className="text-xs font-semibold text-white truncate group-hover:text-cyan-400 transition-colors"
                          title={file.title}
                        >
                          {file.title || 'Untitled File'}
                        </h3>
                        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                          <span>{formatBytes(file.fileSizeBytes)}</span>
                          <span className="text-[10px] uppercase text-zinc-500">{file.fileCategory || file.fileType}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-4 md:px-8 py-3.5 border-t border-white/5 text-center text-xs text-zinc-500 shrink-0 mt-8">
        <p className="flex items-center justify-center gap-1.5 font-mono text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>Encrypted Cloud Storage Powered by Vaultgram</span>
        </p>
      </footer>

      {/* Preview Lightbox Modal */}
      {activePreviewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-2xl animate-fade-in"
          onClick={() => setActivePreviewFile(null)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[92vh] rounded-3xl bg-zinc-950 border border-white/15 shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-3 border-b border-white/10 flex items-center justify-between bg-zinc-900/60 backdrop-blur-xl shrink-0">
              <div className="min-w-0 flex-1 pr-3">
                <h3 className="text-sm sm:text-base font-bold text-white truncate" title={activePreviewFile.title}>
                  {activePreviewFile.title}
                </h3>
                <span className="text-[11px] font-mono text-zinc-400">
                  {formatBytes(activePreviewFile.fileSizeBytes)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadSingleFile(activePreviewFile)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => setActivePreviewFile(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Media Body */}
            <div className="flex-1 min-h-[300px] max-h-[70vh] bg-black flex items-center justify-center overflow-hidden">
              {activePreviewFile.fileType === 'video' ? (
                <video
                  src={activePreviewFile.streamUrl}
                  poster={activePreviewFile.thumbnail}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full max-h-[70vh] object-contain"
                />
              ) : activePreviewFile.fileType === 'image' ? (
                <img
                  src={activePreviewFile.streamUrl}
                  alt={activePreviewFile.title}
                  className="w-full h-full max-h-[70vh] object-contain"
                />
              ) : activePreviewFile.fileType === 'audio' ? (
                <div className="flex flex-col items-center justify-center gap-4 p-8 text-center w-full">
                  <div className="w-16 h-16 rounded-3xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-lg">
                    <Music className="w-8 h-8" />
                  </div>
                  <audio src={activePreviewFile.streamUrl} controls className="w-full max-w-md" />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-lg">
                    <FileText className="w-8 h-8" />
                  </div>
                  <p className="text-xs text-zinc-400 font-mono">Document preview not supported</p>
                  <button
                    onClick={() => downloadSingleFile(activePreviewFile)}
                    className="mt-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold cursor-pointer"
                  >
                    Download to View
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
