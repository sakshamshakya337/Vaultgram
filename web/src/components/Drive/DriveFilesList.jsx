import React, { useState } from 'react';
import { Video, Heart, Download, Play, Clock, HardDrive, Trash2 } from 'lucide-react';
import { api, formatBytes, formatDuration } from '../../services/api';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { DeleteConfirmModal } from './DeleteConfirmModal';

export const DriveFilesList = ({ videos, onSelectVideo, onDeleteVideo }) => {
  const { toggleLike } = useVideoFeed();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      <div className="rounded-2xl bg-zinc-900/40 border border-white/5 overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-4 py-2.5 bg-zinc-900/80 border-b border-white/5 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
          <div className="col-span-5 sm:col-span-5">Name</div>
          <div className="col-span-2 hidden sm:block">Category</div>
          <div className="col-span-2 sm:col-span-2 text-right">Size</div>
          <div className="col-span-2 sm:col-span-2 text-right">Duration</div>
          <div className="col-span-3 sm:col-span-1 text-right">Actions</div>
        </div>

        <div className="divide-y divide-white/5">
          {videos.map((video, index) => {
            const videoId = video._id || video.id;
            const isStarred = !!video.isStarred;
            const downloadUrl = api.stream.getUrl(videoId, true);

            return (
              <div
                key={videoId}
                onClick={() => onSelectVideo(video, index)}
                className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-white/[0.03] transition-colors cursor-pointer group text-xs text-zinc-300"
              >
                {/* File Title + Thumbnail */}
                <div className="col-span-5 sm:col-span-5 flex items-center gap-3 min-w-0">
                  <div className="w-10 h-7 rounded-lg bg-zinc-950 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative">
                    {video.thumbnail || video.thumbnailFileId ? (
                      <img
                        src={video.thumbnail || api.videos.getThumbnailUrl(videoId)}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <Video className="w-4 h-4 text-zinc-600" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Play className="w-3 h-3 text-cyan-400 fill-cyan-400" />
                    </div>
                  </div>
                  <span className="font-semibold text-white group-hover:text-cyan-300 transition-colors truncate">
                    {video.title || 'Untitled Video'}
                  </span>
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
