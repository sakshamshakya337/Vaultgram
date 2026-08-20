import React, { useState, useRef, useEffect } from 'react';
import { X, Mic, Square, Play, RotateCcw, Check, Loader2, AlertCircle, Volume2 } from 'lucide-react';
import { useUploadQueue } from '../../contexts/useUploadQueue';

export const VoiceMemoModal = ({
  isOpen,
  folderId = null,
  folderTitle = '',
  onClose,
}) => {
  const { enqueueFiles } = useUploadQueue();

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  const startMic = async () => {
    stopMic();
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
    } catch (err) {
      console.error('[VoiceMemo error]:', err);
      setError('Could not access microphone. Please check permissions.');
    }
  };

  const stopMic = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen && !recordedBlob) {
      startMic();
    } else {
      stopMic();
    }
    return () => {
      stopMic();
    };
  }, [isOpen, recordedBlob]);

  if (!isOpen) return null;

  const handleStartRecording = async () => {
    if (!streamRef.current) {
      await startMic();
      if (!streamRef.current) return;
    }

    chunksRef.current = [];
    setRecordingSeconds(0);
    setError('');

    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
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
        type: selectedMime || 'audio/webm',
      });
      stopMic();
      setRecordedBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      const defaultTitle = `VoiceNote_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}`;
      setTitle(defaultTitle);
      setIsRecording(false);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(300);
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleRetake = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setRecordedBlob(null);
    setAudioUrl(null);
    setTitle('');
    startMic();
  };

  const handleSaveAndUpload = () => {
    if (!recordedBlob) return;
    const fileName = `${title.trim() || 'VoiceNote'}.webm`;
    const file = new File([recordedBlob], fileName, {
      type: recordedBlob.type || 'audio/webm',
      lastModified: Date.now(),
    });

    // Directly upload into "Voice Notes" category without prompting
    enqueueFiles([file], {
      category: 'Voice Notes',
      folderId: folderId || null,
      folderTitle: folderTitle || '',
    });

    handleClose();
  };

  const handleClose = () => {
    stopMic();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setRecordedBlob(null);
    setAudioUrl(null);
    setIsRecording(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div
        className="relative w-full max-w-sm rounded-3xl bg-zinc-950 border border-white/10 p-6 shadow-2xl space-y-5 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-left">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">Quick Voice Memo</h3>
              <p className="text-[11px] text-zinc-400">Direct to #Voice Notes</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Recording Animation / Audio Display */}
        <div className="py-6 flex flex-col items-center justify-center space-y-4">
          {error ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              <AlertCircle className="w-6 h-6 mx-auto mb-1 text-rose-400" />
              <span>{error}</span>
            </div>
          ) : recordedBlob ? (
            <div className="w-full space-y-3">
              <div className="w-16 h-16 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mx-auto">
                <Volume2 className="w-7 h-7" />
              </div>
              <audio ref={audioRef} src={audioUrl} controls className="w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  isRecording
                    ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-400 animate-pulse scale-110'
                    : 'bg-purple-500/10 border border-purple-500/20 text-purple-400'
                }`}
              >
                <Mic className="w-8 h-8" />
              </div>
              <div className="font-mono text-lg font-bold text-white">
                {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        {recordedBlob ? (
          <div className="space-y-3 animate-fade-in text-left">
            <div>
              <label className="text-[11px] font-bold text-zinc-400 block mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-purple-500"
              />
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
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-bold shadow-lg shadow-purple-500/20 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save to Vault</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            {isRecording ? (
              <button
                type="button"
                onClick={handleStopRecording}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xl shadow-rose-600/30 active:scale-95 transition-all cursor-pointer"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Stop Recording</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartRecording}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:opacity-95 text-white font-bold text-xs shadow-xl shadow-purple-500/30 active:scale-95 transition-all cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                <span>Start Recording</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
