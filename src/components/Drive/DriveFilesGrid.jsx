import React, { useState } from 'react';
import { Play, Heart, Download, Trash2, Video, Cloud, Loader2, StickyNote, Share2, FileText, Image as ImageIcon, Music, Eye, MoreVertical, X } from 'lucide-react';
import { api, formatBytes, formatDuration, getFileKind } from '../../services/api';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { useOfflineMedia } from '../../contexts/useOfflineMedia';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { NoteEditModal } from './NoteEditModal';
import { ShareModal } from './ShareModal';

export const DriveFilesGrid = ({ videos, onSelectVideo, onDeleteVideo }) => {
  const { toggleLike } = useVideoFeed();
  const { isOfflineAvailable, toggleOfflineSave, isCaching } = useOfflineMedia();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [noteTarget, setNoteTarget] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [mobileMenuFile, setMobileMenuFile] = useState(null);

  if (!videos || videos.length === 0) return null;

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (onDeleteVideo) {
        await onDeleteVideo(deleteTarget._id || deleteTarget.id);
      } else {
        await api.drive.delete(deleteTarget._id || deleteTarget.id);
      }
      setDeleteTarget(null);
    } catch (err) {
      alert(err.message || 'Failed to delete file');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {videos.map((video, index) => {
          const videoId = video._id || video.id;
          const isStarred = !!video.isStarred;
          const isOffline = isOfflineAvailable(videoId);
          const caching = isCaching(videoId);
          const downloadUrl = api.stream.getUrl(videoId, true);
          const { isVideo, isImage, isAudio, isDocument, extension } = getFileKind(video);

          return (
            <div
              key={videoId}
              onClick={() => onSelectVideo(video, index)}
              className="group relative rounded-2xl bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 hover:border-cyan-500/30 overflow-hidden shadow-lg transition-all duration-200 cursor-pointer flex flex-col"
            >
              {/* Thumbnail / Media Preview Area */}
              <div className="relative w-full aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden">
                {isImage ? (
                  <>
                    <img
                      src={video.thumbnail || video.streamUrl || api.stream.getUrl(videoId)}
                      alt={video.title || 'Photo'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.photo-fallback');
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="photo-fallback hidden w-full h-full bg-gradient-to-tr from-emerald-950/20 to-zinc-950 items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                    </div>
                  </>
                ) : isVideo && (video.thumbnail || video.thumbnailFileId) ? (
                  <>
                    <img
                      src={video.thumbnail || api.videos.getThumbnailUrl(videoId)}
                      alt={video.title || 'Video thumbnail'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.video-fallback');
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                    <div className="video-fallback hidden w-full h-full bg-gradient-to-tr from-cyan-950/20 to-zinc-950 items-center justify-center">
                      <Video className="w-8 h-8 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
                    </div>
                  </>
                ) : isVideo ? (
                  <div className="w-full h-full bg-gradient-to-tr from-cyan-950/20 to-zinc-950 flex items-center justify-center">
                    <Video className="w-8 h-8 text-zinc-600 group-hover:text-cyan-400 transition-colors" />
                  </div>
                ) : isAudio ? (
                  <div className="w-full h-full bg-gradient-to-tr from-purple-950/20 to-zinc-950 flex items-center justify-center">
                    <Music className="w-8 h-8 text-purple-400/80 group-hover:text-purple-300 transition-colors" />
                  </div>
                ) : (
                  /* Document File Preview */
                  <div className="w-full h-full bg-gradient-to-tr from-amber-950/20 to-zinc-950 flex flex-col items-center justify-center gap-1 p-3">
                    <FileText className="w-8 h-8 text-amber-400 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-mono font-bold text-amber-300/80 uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                      {extension}
                    </span>
                  </div>
                )}

                {/* Offline Available Badge */}
                {isOffline && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/90 text-black text-[10px] font-bold shadow-md backdrop-blur-md">
                    <span>Offline</span>
                  </div>
                )}

                {/* Duration Badge for Videos and Audios */}
                {(isVideo || isAudio) && video.duration ? (
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono text-zinc-300 font-semibold">
                    {formatDuration(video.duration)}
                  </div>
                ) : null}

                {/* Document Type Badge in Corner */}
                {isDocument && (
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[9px] font-mono text-amber-300 font-semibold">
                    {extension}
                  </div>
                )}

                {/* Hover Action Overlay: Play for Video/Audio, Eye for Image, FileText/Open for Document */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform ${
                    isVideo || isAudio
                      ? 'bg-cyan-500 text-black shadow-cyan-500/40'
                      : isImage
                      ? 'bg-emerald-500 text-black shadow-emerald-500/40'
                      : 'bg-amber-500 text-black shadow-amber-500/40'
                  }`}>
                    {isVideo || isAudio ? (
                      <Play className="w-5 h-5 fill-black ml-0.5" />
                    ) : isImage ? (
                      <Eye className="w-5 h-5 text-black" />
                    ) : (
                      <FileText className="w-5 h-5 text-black" />
                    )}
                  </div>
                </div>
              </div>

              {/* File Metadata Card Body */}
              <div className="p-3.5 flex flex-col justify-between flex-1 gap-2">
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate" title={video.title}>
                    {video.title || 'Untitled Video'}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                      #{video.category || 'General'}
                    </span>
                  </div>

                  {/* Note Subtitle Tooltip if Present */}
                  {video.note && (
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 truncate" title={video.note}>
                      <StickyNote className="w-3 h-3 shrink-0 text-amber-400" />
                      <span className="truncate">{video.note}</span>
                    </div>
                  )}
                </div>

                {/* Bottom Details & Quick Actions */}
                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono pt-2 border-t border-white/5 h-8">
                  <div className="flex items-center gap-1.5 shrink-0 text-zinc-400">
                    {video.fileSizeBytes ? (
                      <span>{formatBytes(video.fileSizeBytes)}</span>
                    ) : null}
                  </div>

                  {/* Desktop Action Buttons (Hover) */}
                  <div className="hidden md:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    {/* Add/Edit Note Button */}
                    <button
                      onClick={() => setNoteTarget(video)}
                      className={`w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer ${
                        video.note ? 'text-amber-400' : 'text-zinc-400 hover:text-amber-300'
                      }`}
                      title={video.note ? 'Edit Note' : 'Add Note'}
                    >
                      <StickyNote className={`w-3.5 h-3.5 ${video.note ? 'fill-amber-400/20' : ''}`} />
                    </button>

                    {/* Offline Toggle Button */}
                    <button
                      onClick={() => toggleOfflineSave(video)}
                      disabled={caching}
                      className={`w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer ${
                        isOffline ? 'text-emerald-400' : 'text-zinc-400 hover:text-cyan-400'
                      }`}
                      title={caching ? 'Saving offline...' : isOffline ? 'Remove from offline' : 'Make available offline'}
                    >
                      {caching ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                      ) : (
                        <Cloud className={`w-3.5 h-3.5 ${isOffline ? 'fill-emerald-400/20' : ''}`} />
                      )}
                    </button>

                    {/* Like / Star Button */}
                    <button
                      onClick={() => toggleLike(videoId)}
                      className={`w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer ${
                        isStarred ? 'text-rose-500' : 'text-zinc-400 hover:text-white'
                      }`}
                      title={isStarred ? 'Liked' : 'Like'}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isStarred ? 'fill-rose-500' : ''}`} />
                    </button>

                    {/* Download Button */}
                    <a
                      href={downloadUrl}
                      download={video.title || 'download'}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>

                    {/* Share Button */}
                    <button
                      onClick={() => setShareTarget(video)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-cyan-400 hover:bg-white/10 transition-colors cursor-pointer"
                      title="Share Time-Limited Link"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => setDeleteTarget(video)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete File"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Mobile Action Buttons (Touch Friendly) */}
                  <div className="md:hidden flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => toggleLike(videoId)}
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-transform active:scale-75 cursor-pointer ${
                        isStarred ? 'text-rose-500' : 'text-zinc-400 hover:text-white'
                      }`}
                      aria-label="Like"
                    >
                      <Heart className={`w-3.5 h-3.5 ${isStarred ? 'fill-rose-500' : ''}`} />
                    </button>
                    <button
                      onClick={() => setMobileMenuFile(video)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-white active:bg-white/10 transition-colors cursor-pointer"
                      aria-label="More actions"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile File Actions Bottom Sheet */}
      {mobileMenuFile && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center animate-fade-in"
          onClick={() => setMobileMenuFile(null)}
        >
          <div
            className="w-full max-w-lg bg-zinc-900 border-t border-white/10 rounded-t-3xl p-5 flex flex-col gap-3 shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="min-w-0 pr-4">
                <h4 className="text-sm font-bold text-white truncate">
                  {mobileMenuFile.title || 'File Actions'}
                </h4>
                <p className="text-xs text-cyan-400 font-semibold mt-0.5">
                  #{mobileMenuFile.category || 'General'}
                </p>
              </div>
              <button
                onClick={() => setMobileMenuFile(null)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {/* Star / Like */}
              <button
                onClick={() => {
                  toggleLike(mobileMenuFile._id || mobileMenuFile.id);
                  setMobileMenuFile(null);
                }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/5 transition-colors cursor-pointer"
              >
                <Heart className={`w-4 h-4 ${mobileMenuFile.isStarred ? 'fill-rose-500 text-rose-500' : 'text-zinc-400'}`} />
                <span>{mobileMenuFile.isStarred ? 'Liked' : 'Like'}</span>
              </button>

              {/* Offline */}
              <button
                onClick={() => {
                  toggleOfflineSave(mobileMenuFile);
                  setMobileMenuFile(null);
                }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/5 transition-colors cursor-pointer"
              >
                <Cloud className={`w-4 h-4 ${isOfflineAvailable(mobileMenuFile._id || mobileMenuFile.id) ? 'fill-emerald-400 text-emerald-400' : 'text-zinc-400'}`} />
                <span>{isOfflineAvailable(mobileMenuFile._id || mobileMenuFile.id) ? 'Offline Ready' : 'Save Offline'}</span>
              </button>

              {/* Note */}
              <button
                onClick={() => {
                  const target = mobileMenuFile;
                  setMobileMenuFile(null);
                  setNoteTarget(target);
                }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/5 transition-colors cursor-pointer"
              >
                <StickyNote className={`w-4 h-4 ${mobileMenuFile.note ? 'text-amber-400 fill-amber-400/20' : 'text-zinc-400'}`} />
                <span>{mobileMenuFile.note ? 'Edit Note' : 'Add Note'}</span>
              </button>

              {/* Share */}
              <button
                onClick={() => {
                  const target = mobileMenuFile;
                  setMobileMenuFile(null);
                  setShareTarget(target);
                }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/5 transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-blue-400" />
                <span>Share Link</span>
              </button>

              {/* Download */}
              <a
                href={api.stream.getUrl(mobileMenuFile._id || mobileMenuFile.id, true)}
                download={mobileMenuFile.title || 'download'}
                onClick={() => setMobileMenuFile(null)}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/5 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-cyan-400" />
                <span>Download</span>
              </a>

              {/* Delete */}
              <button
                onClick={() => {
                  const target = mobileMenuFile;
                  setMobileMenuFile(null);
                  setDeleteTarget(target);
                }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={!!shareTarget}
        file={shareTarget}
        onClose={() => setShareTarget(null)}
      />

      {/* Note Edit Modal */}
      <NoteEditModal
        isOpen={!!noteTarget}
        file={noteTarget}
        onClose={() => setNoteTarget(null)}
        onNoteUpdated={(id, newNote) => {
          const item = videos.find((v) => (v._id || v.id) === id);
          if (item) item.note = newNote;
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        title="Delete File"
        itemName={deleteTarget?.title || 'this file'}
        itemType="file"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
};
