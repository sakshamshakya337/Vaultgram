import React, { useState, useEffect } from 'react';
import { X, FolderInput, Folder, HardDrive } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDrive } from '../../contexts/DriveContext';
import { Button } from '../ui/button';
import api from '../../services/api';

export const MoveModal = () => {
  const { moveTarget, setMoveTarget, move } = useDrive();
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState('root');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (moveTarget) {
      api.drive.getFolders().then((res) => {
        const list = (res?.folders || []).filter((f) => f._id !== moveTarget._id);
        setFolders(list);
      });
    }
  }, [moveTarget]);

  if (!moveTarget) return null;

  const handleMove = async () => {
    setLoading(true);
    try {
      await move(moveTarget._id, selectedFolderId === 'root' ? null : selectedFolderId);
      setMoveTarget(null);
    } catch (err) {
      alert(err.message || 'Move failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl"
      onClick={() => setMoveTarget(null)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm rounded-3xl border border-white/[0.08] bg-zinc-950 p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 flex-shrink-0">
              <FolderInput className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold font-display text-white truncate">
              Move "{moveTarget.title}"
            </h3>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => setMoveTarget(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-zinc-400">Select destination:</p>

          <div className="max-h-56 overflow-y-auto space-y-1.5 p-1">
            <button
              className={`flex w-full items-center space-x-3 rounded-2xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                selectedFolderId === 'root'
                  ? 'bg-sky-500/15 text-sky-400 font-semibold border border-sky-500/30'
                  : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
              }`}
              onClick={() => setSelectedFolderId('root')}
            >
              <HardDrive className="h-4 w-4 text-sky-400" />
              <span>My Drive (Root)</span>
            </button>

            {folders.map((f) => (
              <button
                key={f._id}
                className={`flex w-full items-center space-x-3 rounded-2xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                  selectedFolderId === f._id
                    ? 'bg-sky-500/15 text-sky-400 font-semibold border border-sky-500/30'
                    : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                }`}
                onClick={() => setSelectedFolderId(f._id)}
              >
                <Folder className="h-4 w-4 text-indigo-400" />
                <span className="truncate">{f.title}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setMoveTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              className="flex-1 rounded-xl font-semibold"
              disabled={loading}
              onClick={handleMove}
            >
              {loading ? 'Moving...' : 'Move Here'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
