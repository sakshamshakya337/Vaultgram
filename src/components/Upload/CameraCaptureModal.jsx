import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Video, Circle, Square, RotateCcw, Check, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { useUploadQueue } from '../../contexts/useUploadQueue';
import { useVideoFeed } from '../../contexts/useVideoFeed';

export const CameraCaptureModal = ({
  isOpen,
  folderId = null,
  folderTitle = '',
  category = 'General',
  onClose,
}) => {
  const { enqueueFiles } = useUploadQueue();
  const { categories } = useVideoFeed();

  const [mode, setMode] = useState('photo'); // 'photo' | 'video'
  const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedType, setCapturedType] = useState(null); // 'image' | 'video'
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(category || 'General');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  // Initialize camera stream
  const startCamera = async (facing = facingMode) => {
    stopCamera();
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error('[CameraCapture error]:', err);
      setError('Could not access camera or microphone. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen && !capturedBlob) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, capturedBlob, facingMode]);

  useEffect(() => {
    if (category) {
      setSelectedCategory(category === 'All' ? 'General' : category);
    }
  }, [category]);

  if (!isOpen) return null;

  // Toggle Camera Front/Back
  const toggleFacingMode = () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    startCamera(next);
  };

  // Capture Photo
  const handleTakePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');

    // Flip horizontal if front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          stopCamera();
          setCapturedBlob(blob);
          setCapturedType('image');
          setPreviewUrl(URL.createObjectURL(blob));
          setTitle(`Photo_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}`);
        }
      },
      'image/jpeg',
      0.92
    );
  };

  // Start Video Recording
  const handleStartRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    setRecordingSeconds(0);

    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];
    let selectedMime = '';
    for (const m of mimeTypes) {
      if (MediaRecorder.isTypeSupported(m)) {
        selectedMime = m;
        break;
      }
    }

    const options = selectedMime ? { mimeType: selectedMime } : undefined;
    const recorder = new MediaRecorder(streamRef.current, options);

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: selectedMime || 'video/webm',
      });
      stopCamera();
      setCapturedBlob(blob);
      setCapturedType('video');
      setPreviewUrl(URL.createObjectURL(blob));
      setTitle(`Video_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}`);
      setIsRecording(false);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(500); // chunk every 500ms
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  // Stop Video Recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Retake
  const handleRetake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCapturedBlob(null);
    setCapturedType(null);
    setPreviewUrl(null);
    setTitle('');
    startCamera(facingMode);
  };

  // Upload to Queue
  const handleSaveAndUpload = () => {
    if (!capturedBlob) return;
    const ext = capturedType === 'image' ? 'jpg' : 'webm';
    const fileName = `${title.trim() || (capturedType === 'image' ? 'Photo' : 'Video')}.${ext}`;
    const file = new File([capturedBlob], fileName, {
      type: capturedBlob.type,
      lastModified: Date.now(),
    });

    enqueueFiles([file], {
      category: selectedCategory || 'General',
      folderId: folderId || null,
      folderTitle: folderTitle || '',
    });

    handleClose();
  };

  const handleClose = () => {
    stopCamera();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCapturedBlob(null);
    setCapturedType(null);
    setPreviewUrl(null);
    setIsRecording(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in select-none">
      <div
        className="relative w-full max-w-lg rounded-3xl bg-zinc-950 border border-white/10 p-5 shadow-2xl space-y-4 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">
                {capturedBlob ? 'Review Capture' : 'In-App Camera'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {capturedBlob ? 'Review and upload to vault' : 'Record video or capture photo'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="relative aspect-video rounded-2xl bg-black border border-white/10 overflow-hidden flex items-center justify-center">
          {error ? (
            <div className="p-6 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <p className="text-xs text-rose-300 font-semibold">{error}</p>
            </div>
          ) : capturedBlob ? (
            capturedType === 'image' ? (
              <img src={previewUrl} alt="Captured" className="w-full h-full object-contain" />
            ) : (
              <video src={previewUrl} controls autoPlay className="w-full h-full object-contain" />
            )
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />

              {/* Recording Indicator */}
              {isRecording && (
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full bg-rose-600/90 text-white text-xs font-mono font-bold animate-pulse shadow-lg">
                  <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                  <span>
                    REC {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              )}

              {/* Flip Camera Button */}
              <button
                type="button"
                onClick={toggleFacingMode}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-lg active:scale-95"
                title="Switch Camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Controls Area */}
        {capturedBlob ? (
          /* Post-Capture Review Controls */
          <div className="space-y-3 animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 block mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      #{cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleRetake}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAndUpload}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Upload to Vault</span>
              </button>
            </div>
          </div>
        ) : (
          /* Capture Controls */
          <div className="space-y-4">
            {/* Mode Switcher */}
            <div className="flex items-center justify-center gap-2 p-1 rounded-2xl bg-zinc-900 border border-white/5 max-w-xs mx-auto">
              <button
                type="button"
                disabled={isRecording}
                onClick={() => setMode('photo')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  mode === 'photo'
                    ? 'bg-cyan-500 text-black shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Photo
              </button>
              <button
                type="button"
                disabled={isRecording}
                onClick={() => setMode('video')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  mode === 'video'
                    ? 'bg-cyan-500 text-black shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Video
              </button>
            </div>

            {/* Shutter Action Button */}
            <div className="flex items-center justify-center">
              {mode === 'photo' ? (
                <button
                  type="button"
                  onClick={handleTakePhoto}
                  className="w-16 h-16 rounded-full border-4 border-white/30 bg-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  title="Take Photo"
                >
                  <div className="w-12 h-12 rounded-full border-2 border-zinc-900 bg-white" />
                </button>
              ) : isRecording ? (
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="w-16 h-16 rounded-full border-4 border-rose-500/40 bg-rose-600 flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer animate-pulse"
                  title="Stop Recording"
                >
                  <Square className="w-6 h-6 fill-white text-white" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartRecording}
                  className="w-16 h-16 rounded-full border-4 border-rose-500/30 bg-rose-600 flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  title="Start Recording"
                >
                  <Circle className="w-6 h-6 fill-white text-white" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
