import React, { useState, useEffect } from 'react';
import { X, StickyNote, Check, Trash2, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

export const NoteEditModal = ({
  isOpen,
  file,
  onClose,
  onNoteUpdated,
}) => {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (file) {
      setNote(file.note || '');
      setError('');
    }
  }, [file, isOpen]);

  if (!isOpen || !file) return null;

  const fileId = file._id || file.id;

  const handleSave = async (e) => {
    e.preventDefault();
    if (note.length > 200) {
      setError('Note cannot exceed 200 characters');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await api.drive.updateNote(fileId, note.trim());
      if (onNoteUpdated) {
        onNoteUpdated(fileId, note.trim());
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update note');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    setError('');
    try {
      await api.drive.updateNote(fileId, '');
      if (onNoteUpdated) {
        onNoteUpdated(fileId, '');
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to clear note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div
        className="relative w-full max-w-sm rounded-3xl bg-zinc-950 border border-white/10 p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <StickyNote className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">File Note / Reminder</h3>
              <p className="text-[11px] text-zinc-400 truncate max-w-[200px]" title={file.title}>
                {file.title || 'Untitled'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <textarea
              value={note}
              onChange={(e) => {
                if (e.target.value.length <= 200) {
                  setNote(e.target.value);
                  setError('');
                }
              }}
              rows={3}
              placeholder="Add a short reminder or note about this file..."
              className="w-full p-3 rounded-2xl bg-zinc-900 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50 resize-none transition-colors"
              autoFocus
            />
            <div className="flex items-center justify-between mt-1 text-[11px] font-mono text-zinc-500 px-1">
              <span>Max 200 characters</span>
              <span className={note.length > 180 ? 'text-amber-400 font-bold' : ''}>
                {note.length} / 200
              </span>
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-semibold px-1">{error}</p>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-2">
            {file.note ? (
              <button
                type="button"
                onClick={handleClear}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold shadow-lg shadow-amber-500/20 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save Note</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
