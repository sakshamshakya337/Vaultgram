import React, { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDrive } from '../../contexts/DriveContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export const NewFolderModal = () => {
  const { newFolderOpen, setNewFolderOpen, createFolder } = useDrive();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!newFolderOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError('');

    try {
      await createFolder(title.trim());
      setNewFolderOpen(false);
      setTitle('');
    } catch (err) {
      setError(err.message || 'Failed to create folder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl"
      onClick={() => setNewFolderOpen(false)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm rounded-3xl border border-white/[0.08] bg-zinc-950 p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
              <FolderPlus className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold font-display text-white">New Folder</h3>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => setNewFolderOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 p-3 text-xs text-rose-400">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400">Folder Name</label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled folder"
              required
              autoFocus
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setNewFolderOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              className="flex-1 rounded-xl font-semibold"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
