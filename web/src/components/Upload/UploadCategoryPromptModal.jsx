import React, { useState, useEffect } from 'react';
import { Folder, Sparkles, X, Upload } from 'lucide-react';
import { useUploadQueue } from '../../contexts/useUploadQueue';
import { useVideoFeed } from '../../contexts/useVideoFeed';

export const UploadCategoryPromptModal = () => {
  const { categoryPrompt, closeCategoryPrompt, confirmCategoryPrompt } = useUploadQueue();
  const { categories } = useVideoFeed();

  const [selectedCategory, setSelectedCategory] = useState('Trending');
  const [isCustom, setIsCustom] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  // Default to first valid category when opened
  useEffect(() => {
    if (categoryPrompt.isOpen) {
      const validCats = categories.filter((c) => c !== 'All');
      if (validCats.length > 0) {
        setSelectedCategory(validCats[0]);
      } else {
        setSelectedCategory('General');
      }
      setIsCustom(false);
      setCustomCategory('');
    }
  }, [categoryPrompt.isOpen, categories]);

  if (!categoryPrompt.isOpen) return null;

  const handleConfirm = (e) => {
    e.preventDefault();
    const finalCategory = isCustom ? customCategory.trim() : selectedCategory;
    if (!finalCategory) return;
    confirmCategoryPrompt(finalCategory);
  };

  const fileCount = categoryPrompt.files.length;
  const targetName = categoryPrompt.targetFolder?.title || 'My Drive';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in select-none">
      <div className="relative w-full max-w-md rounded-3xl bg-zinc-900 border border-white/10 shadow-2xl p-6 overflow-hidden flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Choose Upload Category</h3>
              <p className="text-xs text-zinc-400">
                {fileCount} {fileCount === 1 ? 'file' : 'files'} for {targetName}
              </p>
            </div>
          </div>
          <button
            onClick={closeCategoryPrompt}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Picker Form */}
        <form onSubmit={handleConfirm} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-2">
              Select Category or Tag
            </label>
            <div className="space-y-2">
              <select
                value={isCustom ? '__new__' : selectedCategory}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setIsCustom(true);
                    setCustomCategory('');
                  } else {
                    setIsCustom(false);
                    setSelectedCategory(e.target.value);
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 focus:border-cyan-400 text-white text-sm focus:outline-none transition-colors cursor-pointer"
              >
                {categories
                  .filter((c) => c !== 'All')
                  .map((cat) => (
                    <option key={cat} value={cat}>
                      #{cat}
                    </option>
                  ))}
                <option value="__new__">+ Add New Category...</option>
              </select>

              {isCustom && (
                <div className="flex items-center gap-2 animate-fade-in pt-1">
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Enter category name..."
                    autoFocus
                    required
                    className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-950 border border-cyan-500/50 focus:border-cyan-400 text-white text-sm placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={closeCategoryPrompt}
              className="px-4 py-2 rounded-full text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCustom && !customCategory.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 hover:opacity-95 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload {fileCount} {fileCount === 1 ? 'File' : 'Files'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadCategoryPromptModal;
