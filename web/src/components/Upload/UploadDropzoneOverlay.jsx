import React, { useState, useEffect, useRef } from 'react';
import { Upload, Folder, Sparkles, Cloud } from 'lucide-react';
import { useUploadQueue } from '../../contexts/useUploadQueue';

export const UploadDropzoneOverlay = ({ currentFolder, selectedCategory }) => {
  const { addToQueue, promptCategoryForFiles } = useUploadQueue();
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // Compute destination title
  let targetTitle = 'My Drive';
  let targetSubtitle = 'Files will be placed at the root level';
  if (currentFolder) {
    targetTitle = currentFolder.title || 'Current Folder';
    targetSubtitle = `Uploading to folder "${targetTitle}"`;
  } else if (selectedCategory && selectedCategory !== 'All') {
    targetTitle = `#${selectedCategory}`;
    targetSubtitle = `Categorized under #${selectedCategory}`;
  }

  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current += 1;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDragging && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragging(false);
      }
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (!files || files.length === 0) return;

      if (currentFolder) {
        addToQueue(files, {
          folderId: currentFolder._id || currentFolder.id,
          folderTitle: currentFolder.title || '',
          category: currentFolder.category || 'General',
        });
      } else if (selectedCategory && selectedCategory !== 'All') {
        addToQueue(files, {
          category: selectedCategory,
        });
      } else {
        // At root level: prompt user for category selection
        promptCategoryForFiles(files, null);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [currentFolder, selectedCategory, addToQueue, promptCategoryForFiles, isDragging]);

  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none p-4 md:p-8 flex items-center justify-center bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full h-full rounded-3xl border-3 border-dashed border-cyan-400/80 bg-gradient-to-b from-cyan-500/10 via-blue-500/5 to-transparent shadow-2xl flex flex-col items-center justify-center p-6 text-center animate-pulse">
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-2xl shadow-cyan-500/40 transform -translate-y-1">
            <Upload className="w-12 h-12 stroke-[2.5]" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-zinc-900 border border-white/20 flex items-center justify-center text-cyan-300 shadow-lg">
            <Folder className="w-5 h-5 fill-cyan-400/20" />
          </div>
        </div>

        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-2">
          Drop files to upload to{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
            {targetTitle}
          </span>
        </h2>

        <p className="text-sm md:text-base text-zinc-300 font-medium max-w-md">
          {targetSubtitle}
        </p>

        <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/15 text-xs text-zinc-200 font-semibold backdrop-blur-md">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span>Sequential auto-upload • Videos auto-compressed ≤ 20MB</span>
        </div>
      </div>
    </div>
  );
};
