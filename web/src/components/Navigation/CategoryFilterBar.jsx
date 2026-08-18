import React from 'react';
import { useVideoFeed } from '../../contexts/VideoFeedContext';

export const CategoryFilterBar = () => {
  const { categories, selectedCategory, setSelectedCategory } = useVideoFeed();

  return (
    <div className="absolute top-14 inset-x-0 z-30 px-4 pointer-events-none">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 pointer-events-auto mask-fade-edges">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-white text-black shadow-lg shadow-white/20 scale-105 font-bold'
                  : 'bg-black/40 text-zinc-300 hover:text-white hover:bg-black/60 border border-white/10 backdrop-blur-md'
              }`}
            >
              {cat === 'All' ? '⚡ All Reels' : `#${cat}`}
            </button>
          );
        })}
      </div>
    </div>
  );
};
