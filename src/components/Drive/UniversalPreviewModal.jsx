import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Star,
  Music,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrive } from '../../contexts/DriveContext';
import { FileIcon } from './FileIcon';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import api, { formatBytes } from '../../services/api';

export const UniversalPreviewModal = () => {
  const { previewItem, setPreviewItem, toggleStar } = useDrive();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [textContent, setTextContent] = useState('');
  const [loadingText, setLoadingText] = useState(false);

  useEffect(() => {
    if (!previewItem) {
      setZoomLevel(1);
      setTextContent('');
      return;
    }

    if (
      previewItem.fileCategory === 'code' ||
      previewItem.extension === 'txt' ||
      previewItem.extension === 'md' ||
      previewItem.extension === 'json'
    ) {
      setLoadingText(true);
      fetch(api.stream.getUrl(previewItem._id))
        .then((res) => res.text())
        .then((txt) => {
          setTextContent(txt.slice(0, 15000));
          setLoadingText(false);
        })
        .catch(() => setLoadingText(false));
    }
  }, [previewItem]);

  if (!previewItem) return null;

  const streamUrl = api.stream.getUrl(previewItem._id);
  const downloadUrl = api.stream.getUrl(previewItem._id, true);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = previewItem.title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderPreviewContent = () => {
    switch (previewItem.fileCategory) {
      case 'image':
        return (
          <div className="flex h-full w-full items-center justify-center overflow-hidden p-6">
            <img
              src={streamUrl}
              alt={previewItem.title}
              className="max-h-[75vh] max-w-[90vw] rounded-xl object-contain shadow-2xl transition-transform duration-200"
              style={{ transform: `scale(${zoomLevel})` }}
            />
          </div>
        );

      case 'video':
        return (
          <div className="flex aspect-video w-full items-center justify-center bg-black">
            <video
              src={streamUrl}
              controls
              autoPlay
              playsInline
              className="max-h-[75vh] w-full object-contain"
            />
          </div>
        );

      case 'audio':
        return (
          <div className="mx-auto max-w-md py-16 px-6 text-center space-y-6">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-pink-500/15 text-pink-400 border border-pink-500/20 shadow-xl shadow-pink-500/10">
              <Music className="h-12 w-12" />
            </div>
            <div>
              <h3 className="text-xl font-bold font-display text-white">{previewItem.title}</h3>
              <p className="mt-1 text-xs font-mono text-zinc-400">
                {formatBytes(previewItem.fileSizeBytes)}
              </p>
            </div>
            <audio src={streamUrl} controls autoPlay className="w-full" />
          </div>
        );

      case 'pdf':
        return (
          <div className="h-[75vh] w-full bg-zinc-900">
            <iframe
              src={streamUrl}
              title={previewItem.title}
              className="h-full w-full border-0"
            />
          </div>
        );

      case 'code':
        return (
          <div className="h-[70vh] overflow-y-auto bg-zinc-950 p-6 font-mono text-xs text-sky-300 leading-relaxed">
            {loadingText ? (
              <p className="text-zinc-500">Loading code contents...</p>
            ) : (
              <pre className="whitespace-pre-wrap break-all">
                {textContent || 'No text content available.'}
              </pre>
            )}
          </div>
        );

      default:
        return (
          <div className="mx-auto max-w-md py-16 px-6 text-center space-y-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-zinc-900 border border-white/[0.08] text-zinc-400 shadow-xl">
              <FileIcon category={previewItem.fileCategory} size={48} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{previewItem.title}</h3>
              <p className="mt-2 text-xs text-zinc-400">
                Direct web preview is not supported for this file format ({previewItem.extension || previewItem.fileCategory}).
              </p>
            </div>
            <Button variant="default" size="lg" onClick={handleDownload} className="mx-auto">
              <Download className="mr-2 h-4 w-4" /> Download File ({formatBytes(previewItem.fileSizeBytes)})
            </Button>
          </div>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-2xl"
      onClick={() => setPreviewItem(null)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/[0.1] bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-zinc-900/80 px-6 py-4">
          <div className="flex items-center space-x-3 min-w-0">
            <FileIcon category={previewItem.fileCategory} size={22} />
            <h3 className="text-sm font-bold text-zinc-100 truncate max-w-md">
              {previewItem.title}
            </h3>
            <span className="text-xs font-mono text-zinc-400 hidden sm:inline">
              ({formatBytes(previewItem.fileSizeBytes)})
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {previewItem.fileCategory === 'image' && (
              <>
                <Button
                  variant="icon"
                  onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button
                  variant="icon"
                  onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="icon" onClick={() => setZoomLevel(1)} title="Reset Zoom">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </>
            )}

            <Button
              variant="icon"
              onClick={() => toggleStar(previewItem._id)}
              title="Star"
            >
              <Star
                className="h-4 w-4"
                fill={previewItem.isStarred ? '#f59e0b' : 'none'}
                color={previewItem.isStarred ? '#f59e0b' : 'currentColor'}
              />
            </Button>

            <Button variant="icon" onClick={handleDownload} title="Download">
              <Download className="h-4 w-4" />
            </Button>

            <Button variant="icon" onClick={() => setPreviewItem(null)} title="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 overflow-hidden">{renderPreviewContent()}</div>
      </motion.div>
    </div>
  );
};
