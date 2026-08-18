import React from 'react';
import { Play, Heart, Download, Clock, HardDrive, Video } from 'lucide-react';
import { api, formatBytes, formatDuration } from '../../services/api';
import { useVideoFeed } from '../../contexts/useVideoFeed';

export const DriveFilesGrid = ({ videos, onSelectVideo }) => {
  const { toggleLike } = useVideoFeed();

  if (!videos || videos.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
      {videos.map((video) => {
        const videoId = video._id || video.id;
        const isStarred = !!video.isStarred;
        const downloadUrl = api.stream.getUrl(videoId, true);

        return (
          <div
            key={videoId}
            onClick={() => onSelectVideo(video)}
            className="group relative rounded-2xl bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 hover:border-cyan-500/30 overflow-hidden shadow-lg transition-all duration-200 cursor-pointer flex flex-col"
          >
            {/* Thumbnail Preview Area */}
            <div className="relative w-full aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden">
              {video.thumbnail ? (
                <img
                  src={video.thumbnail}
                  alt={video.title || 'Video thumbnail'}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-zinc-900 to-zinc-950 flex items-center justify-center">
                  <Video className="w-8 h-8 text-zinc-700 group-hover:text-cyan-500 transition-colors" />
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
              </div>

              {/* Bottom Details & Quick Actions */}
              <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono pt-2 border-t border-white/5">
                <div className="flex items-center gap-2">
                  {video.fileSizeBytes ? (
                    <span>{formatBytes(video.fileSizeBytes)}</span>
                  ) : null}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => toggleLike(videoId)}
                    className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${
                      isStarred ? 'text-rose-500' : 'text-zinc-400 hover:text-white'
                    }`}
                    title={isStarred ? 'Liked' : 'Like'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isStarred ? 'fill-rose-500' : ''}`} />
                  </button>

                  <a
                    href={downloadUrl}
                    download={video.title || 'video.mp4'}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
