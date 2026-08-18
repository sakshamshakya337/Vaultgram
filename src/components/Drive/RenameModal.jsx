import React, { useState, useEffect } from 'react';
import { Edit2, X } from 'lucide-react';
import { api } from '../../services/api';

export const RenameModal = ({ item, onClose, onRenamed }) => {
  const [title, setTitle] = useState(item?.title || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setTitle(item?.title || '');
    setError('');
  }, [item]);

  if (!item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || cleanTitle === item.title) {
      onClose();
      return;
    }

    setLoading(true);
    setError('');
    try {
      await api.drive.rename(item._id || item.id, cleanTitle);
      onRenamed();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to rename');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-zinc-950 border border-white/10 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Edit2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Rename</h3>
            <p className="text-xs text-zinc-400 truncate max-w-[200px]">{item.title}</p>
          </div>
        </div>

        {error && (
          <div className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 mb-3 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New title"
            className="w-full px-4 py-3 rounded-2xl bg-zinc-900 border border-white/10 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
            autoFocus
            required
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? 'Saving...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
