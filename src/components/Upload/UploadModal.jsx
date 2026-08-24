import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Video, Sparkles, Plus, AlertCircle, Check, Zap, Cpu, VolumeX } from 'lucide-react';
import { api, formatBytes } from '../../services/api';
import { useVideoFeed } from '../../contexts/useVideoFeed';
import { UploadProgressBar } from './UploadProgressBar';
import { detectVideoAudio } from '../../utils/audioDetector';

export const UploadModal = () => {
  const { isUploadOpen, setIsUploadOpen, categories, setVideos, fetchCategories } = useVideoFeed();
  
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [hasNoAudio, setHasNoAudio] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Trending');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  
  const fileInputRef = useRef(null);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!isUploadOpen) return null;

  const isLargeVideo = file && file.size > 20 * 1024 * 1024;

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith('video/') && !/\.(mp4|mov|webm|mkv|avi|3gp|m4v|flv|ts)$/i.test(selected.name)) {
      setError('Please select a valid video file (MP4, WebM, MOV).');
      return;
    }

    if (selected.size > 200 * 1024 * 1024) {
      setError(`Video exceeds 200MB limit (${(selected.size / (1024 * 1024)).toFixed(1)} MB). Please select a file under 200MB.`);
      return;
    }

    setFile(selected);
    setError('');
    setHasNoAudio(false);
    setUploadResult(null);
    const baseName = selected.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    setTitle(baseName);

    // Detect if the video has audio
    detectVideoAudio(selected).then(({ hasAudio }) => {
      setHasNoAudio(!hasAudio);
    });

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(selected);
    setPreviewUrl(url);
  };

  const handleCategorySelect = (e) => {
    const val = e.target.value;
    if (val === '__new__') {
      setIsCustomCategory(true);
      setCustomCategory('');
    } else {
      setIsCustomCategory(false);
      setCategory(val);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a video file to upload.');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a video title.');
      return;
    }

    const finalCategory = isCustomCategory ? customCategory.trim() : category;
    if (!finalCategory) {
      setError('Please provide a category.');
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setError('');
    setUploadResult(null);

    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title.trim());
    formData.append('category', finalCategory);
    if (description.trim()) {
      formData.append('description', description.trim());
    }

    try {
      const res = await api.videos.upload(formData, (percent) => {
        setProgress(percent);
      });

      setUploadResult(res);
      setIsSuccess(true);
      if (res && (res._id || res.id)) {
        setVideos((prev) => {
          const exists = prev.some((v) => (v._id || v.id) === (res._id || res.id));
          if (exists) return prev;
          return [res, ...prev];
        });
      }
      setTimeout(async () => {
        await fetchCategories();
        handleClose();
      }, 1500);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.message || 'Upload failed. Please check your network and try again.');
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (isUploading && !isSuccess) {
      if (!window.confirm('Upload in progress. Are you sure you want to cancel?')) {
        return;
      }
    }
    setIsUploadOpen(false);
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setTitle('');
    setDescription('');
    setProgress(0);
    setIsUploading(false);
    setIsSuccess(false);
    setUploadResult(null);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in select-none">
      <div className="relative w-full max-w-lg rounded-3xl bg-zinc-900 border border-white/10 shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Upload New Reel</h3>
              <p className="text-xs text-zinc-400">Auto-compressed ≤ 20MB & Streamed to Cloud</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto no-scrollbar py-4 space-y-4 flex-1">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Video Picker / Dropzone */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Video File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mp4,.mov,.webm,.mkv,.avi,.3gp,.m4v"
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
            />

            {previewUrl ? (
              <div className="space-y-2">
                <div className="relative rounded-2xl bg-black border border-white/15 overflow-hidden flex items-center justify-center max-h-48 group">
                  <video
                    src={previewUrl}
                    className="max-h-48 object-contain"
                    controls
                    playsInline
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-black/70 hover:bg-black text-white text-[11px] font-medium border border-white/20 backdrop-blur-sm cursor-pointer"
                  >
                    Change
                  </button>
                  <div className="absolute bottom-2 left-2 text-[10px] text-zinc-300 bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm">
                    {file?.name} ({formatBytes(file?.size || 0)})
                  </div>
                </div>

                {/* Compression Notice Badge */}
                {isLargeVideo && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs animate-fade-in">
                    <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>
                      <strong>Smart Compression Active:</strong> Exceeds 20MB ({formatBytes(file.size)}). Will be automatically optimized to ≤ 20MB.
                    </span>
                  </div>
                )}

                {/* No Audio Warning Badge */}
                {hasNoAudio && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs animate-fade-in">
                    <VolumeX className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-amber-300">No Audio Track Detected</p>
                      <p className="text-[11px] text-zinc-300 leading-relaxed">
                        This video has no sound. You can continue to upload it as a silent video or change the file.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-700 hover:border-cyan-500/50 rounded-2xl bg-zinc-950/50 hover:bg-cyan-500/5 transition-all cursor-pointer text-center group"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/5 group-hover:bg-cyan-500/10 group-hover:text-cyan-400 flex items-center justify-center text-zinc-400 mb-2 transition-all">
                  <Video className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-white">Click to select video</p>
                <p className="text-xs text-zinc-400 mt-1">
                  MP4, MOV, WebM up to 200MB • Auto-optimized to ≤ 20MB
                </p>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your reel a catchy title..."
              disabled={isUploading}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 focus:border-cyan-400 text-white text-sm placeholder-zinc-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Category <span className="text-rose-400">*</span>
            </label>
            <div className="space-y-2">
              <select
                value={isCustomCategory ? '__new__' : category}
                onChange={handleCategorySelect}
                disabled={isUploading}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 focus:border-cyan-400 text-white text-sm focus:outline-none transition-colors cursor-pointer"
              >
                {categories
                  .filter((c) => c !== 'All')
                  .map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                <option value="__new__">+ Add New Category...</option>
              </select>

              {isCustomCategory && (
                <div className="flex items-center gap-2 animate-fade-in">
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter new category name..."
                    disabled={isUploading}
                    autoFocus
                    className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-950 border border-cyan-500/50 focus:border-cyan-400 text-white text-sm placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add #hashtags or details about this clip..."
              rows={2}
              disabled={isUploading}
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-700 focus:border-cyan-400 text-white text-sm placeholder-zinc-500 focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Upload & Compression Progress Display */}
          {isUploading && (
            <UploadProgressBar
              progress={progress}
              isComplete={isSuccess}
              isCompressing={progress === 100 && !isSuccess && isLargeVideo}
              statusText={
                isSuccess
                  ? uploadResult?.compressed
                    ? `Uploaded! Compressed ${formatBytes(uploadResult.originalSize)} → ${formatBytes(uploadResult.finalSize)} (${uploadResult.compressionPercentage}% saved)`
                    : 'Video uploaded successfully!'
                  : progress === 100 && isLargeVideo
                  ? 'Optimizing and compressing video to ≤ 20MB...'
                  : progress === 100
                  ? 'Finalizing and encrypting in Telegram Vault...'
                  : `Uploading video... ${progress}%`
              }
            />
          )}
        </form>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading && !isSuccess}
            className="px-4 py-2 rounded-full text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isUploading || !file}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold shadow-lg transition-all cursor-pointer ${
              isSuccess
                ? 'bg-emerald-500 text-white'
                : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-cyan-500/25 hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:pointer-events-none'
            }`}
          >
            {isSuccess ? (
              <>
                <Check className="w-4 h-4" />
                <span>Uploaded!</span>
              </>
            ) : isUploading ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                <span>{progress === 100 && isLargeVideo ? 'Optimizing...' : 'Uploading...'}</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Publish Reel</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
