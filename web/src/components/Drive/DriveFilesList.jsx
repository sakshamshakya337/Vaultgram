import React, { useState } from 'react';
import { Play, Heart, Download, Trash2, Video, Cloud, Loader2, StickyNote, Share2, FileText, Image as ImageIcon, Music, Eye } from 'lucide-react';
import { api, formatBytes, formatDuration, formatRelativeTime } from '../../services/api';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { useOfflineMedia } from '../../contexts/useOfflineMedia';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { NoteEditModal } from './NoteEditModal';
import { ShareModal } from './ShareModal';

const getFileKind = (file) => {
  const mime = (file?.mimeType || '').toLowerCase();
  const ext = (file?.extension || '').toLowerCase().replace(/^\./, '');
  const fileCategory = (file?.fileCategory || '').toLowerCase();
  const fileType = (file?.fileType || '').toLowerCase();

  const isVideo =
    fileType === 'video' ||
    fileCategory === 'video' ||
    mime.startsWith('video/') ||
    ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', '3gp', 'flv'].includes(ext);

  const isImage =
    fileType === 'image' ||
    fileCategory === 'image' ||
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);

  const isAudio =
    fileType === 'audio' ||
    fileCategory === 'audio' ||
    mime.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'].includes(ext);

  return {
    isVideo,
    isImage,
    isAudio,
    isDocument: !isVideo && !isImage && !isAudio,
    extension: ext ? ext.toUpperCase() : (isVideo ? 'VIDEO' : isImage ? 'IMAGE' : isAudio ? 'AUDIO' : 'DOC'),
  };
};

export const DriveFilesList = ({ videos, onSelectVideo, onDeleteVideo }) => {
  const { toggleLike } = useVideoFeed();
  const { isOfflineAvailable, toggleOfflineSave, isCaching } = useOfflineMedia();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [noteTarget, setNoteTarget] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);

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
      <div className="rounded-2xl bg-zinc-900/40 border border-white/5 overflow-hidden shadow-lg">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 select-none bg-zinc-900/60">
          <div className="col-span-5 sm:col-span-5">Name</div>
          <div className="col-span-2 hidden sm:block">Category</div>
          <div className="col-span-2 sm:col-span-2 text-right">Size</div>
          <div className="col-span-3 sm:col-span-3 text-right pr-2">Actions</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/5">
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
                className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-white/[0.03] transition-colors cursor-pointer group text-xs text-zinc-300"
              >
                {/* File Title + Thumbnail */}
                <div className="col-span-5 sm:col-span-5 flex items-center gap-3 min-w-0">
                  <div className="w-10 h-7 rounded-lg bg-zinc-950 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative">
                    {(isImage || isVideo) && (video.thumbnail || video.thumbnailFileId) ? (
                      <img
                        src={video.thumbnail || api.videos.getThumbnailUrl(videoId)}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : isVideo ? (
                      <Video className="w-4 h-4 text-cyan-400/80" />
                    ) : isImage ? (
                      <ImageIcon className="w-4 h-4 text-emerald-400/80" />
                    ) : isAudio ? (
                      <Music className="w-4 h-4 text-purple-400/80" />
                    ) : (
                      <FileText className="w-4 h-4 text-amber-400/80" />
                    )}

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      {isVideo || isAudio ? (
                        <Play className="w-3 h-3 text-cyan-400 fill-cyan-400" />
                      ) : isImage ? (
                        <Eye className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <FileText className="w-3 h-3 text-amber-400" />
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-white group-hover:text-cyan-300 transition-colors truncate">
                        {video.title || 'Untitled File'}
                      </span>
                      {isOffline && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                          Offline
                        </span>
                      )}
                    </div>
                    {video.note && (
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-amber-400/90 truncate" title={video.note}>
                        <StickyNote className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{video.note}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Category */}
                <div className="col-span-2 hidden sm:block">
                  <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    #{video.category || 'General'}
                  </span>
                </div>

                {/* File Size */}
                <div className="col-span-2 sm:col-span-2 text-right font-mono text-zinc-400 text-[11px]">
                  {video.fileSizeBytes ? formatBytes(video.fileSizeBytes) : '—'}
                </div>

                {/* Duration */}
                <div className="col-span-2 sm:col-span-2 text-right font-mono text-zinc-400 text-[11px]">
                  {video.duration ? formatDuration(video.duration) : '—'}
                </div>

                {/* Action Buttons */}
                <div
                  className="col-span-3 sm:col-span-1 flex items-center justify-end gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setNoteTarget(video)}
                    className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
                      video.note ? 'text-amber-400' : 'text-zinc-500 hover:text-amber-300'
                    }`}
                    title={video.note ? 'Edit Note' : 'Add Note'}
                  >
                    <StickyNote className={`w-3.5 h-3.5 ${video.note ? 'fill-amber-400/20' : ''}`} />
                  </button>

                  <button
                    onClick={() => toggleOfflineSave(video)}
                    disabled={caching}
                    className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
                      isOffline ? 'text-emerald-400' : 'text-zinc-500 hover:text-cyan-400'
                    }`}
                    title={caching ? 'Saving offline...' : isOffline ? 'Available Offline (Click to remove)' : 'Make available offline'}
                  >
                    {caching ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    ) : (
                      <Cloud className={`w-3.5 h-3.5 ${isOffline ? 'fill-emerald-400/20' : ''}`} />
                    )}
                  </button>

                  <button
                    onClick={() => toggleLike(videoId)}
                    className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
                      isStarred ? 'text-rose-500' : 'text-zinc-500 hover:text-white'
                    }`}
                    title={isStarred ? 'Liked' : 'Like'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isStarred ? 'fill-rose-500' : ''}`} />
                  </button>

                  <a
                    href={downloadUrl}
                    download={video.title || 'video.mp4'}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>

                  {/* Share Button */}
                  <button
                    onClick={() => setShareTarget(video)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-cyan-400 hover:bg-white/10 transition-colors cursor-pointer"
                    title="Share Time-Limited Link"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setDeleteTarget(video)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Delete File"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
