import React, { useState } from 'react';
import { Play, Heart, Download, Trash2, Video, Cloud, Loader2, StickyNote } from 'lucide-react';
import { api, formatBytes, formatDuration } from '../../services/api';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { useOfflineMedia } from '../../contexts/useOfflineMedia';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { NoteEditModal } from './NoteEditModal';

export const DriveFilesGrid = ({ videos, onSelectVideo, onDeleteVideo }) => {
  const { toggleLike } = useVideoFeed();
  const { isOfflineAvailable, toggleOfflineSave, isCaching } = useOfflineMedia();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [noteTarget, setNoteTarget] = useState(null);

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

          return (
            <div
              key={videoId}
              onClick={() => onSelectVideo(video, index)}
              className="group relative rounded-2xl bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 hover:border-cyan-500/30 overflow-hidden shadow-lg transition-all duration-200 cursor-pointer flex flex-col"
            >
              {/* Thumbnail Preview Area */}
              <div className="relative w-full aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden">
                {video.thumbnail || video.thumbnailFileId ? (
                  <img
                    src={video.thumbnail || api.videos.getThumbnailUrl(videoId)}
                    alt={video.title || 'Video thumbnail'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-zinc-900 to-zinc-950 flex items-center justify-center">
                    <Video className="w-8 h-8 text-zinc-700 group-hover:text-cyan-500 transition-colors" />
                  </div>
                )}

                {/* Offline Available Badge */}
                {isOffline && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/90 text-black text-[10px] font-bold shadow-md backdrop-blur-md">
                    <span>Offline</span>
                  </div>
                )}

                {/* Duration Badge */}
                {video.duration ? (
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono text-zinc-300 font-semibold">
                    {formatDuration(video.duration)}
                  </div>
                ) : null}

                {/* Hover Play Button Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-11 h-11 rounded-full bg-cyan-500 text-black flex items-center justify-center shadow-lg shadow-cyan-500/40 transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-5 h-5 fill-black ml-0.5" />
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
                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    {video.fileSizeBytes ? (
                      <span>{formatBytes(video.fileSizeBytes)}</span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                    {/* Add/Edit Note Button */}
                    <button
                      onClick={() => setNoteTarget(video)}
                      className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
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
                      className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
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

                    <button
                      onClick={() => toggleLike(videoId)}
                      className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer ${
                        isStarred ? 'text-rose-500' : 'text-zinc-400 hover:text-white'
                      }`}
                      title={isStarred ? 'Liked' : 'Like'}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isStarred ? 'fill-rose-500' : ''}`} />
                    </button>

                    <a
                      href={downloadUrl}
                      download={video.title || 'video.mp4'}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => setDeleteTarget(video)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete File"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
