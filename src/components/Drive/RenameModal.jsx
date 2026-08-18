import React, { useState, useEffect } from 'react';
import { X, Edit2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDrive } from '../../contexts/DriveContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export const RenameModal = () => {
  const { renameTarget, setRenameTarget, rename } = useDrive();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (renameTarget) {
      setTitle(renameTarget.title || '');
    }
  }, [renameTarget]);

  if (!renameTarget) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      await rename(renameTarget._id, title.trim());
      setRenameTarget(null);
    } catch (err) {
      alert(err.message || 'Rename failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl"
      onClick={() => setRenameTarget(null)}
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
              <Edit2 className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold font-display text-white">Rename</h3>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => setRenameTarget(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setRenameTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              className="flex-1 rounded-xl font-semibold"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'OK'}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
