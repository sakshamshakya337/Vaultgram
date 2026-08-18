import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import { useVideoFeed } from '../../contexts/useVideoFeed';

export const CategoryFilterBar = () => {
  const {
    categories,
    selectedCategory,
    requestCategory,
    lockedCategories,
    sessionUnlockedCategories,
  } = useVideoFeed();

  return (
    <div className="absolute top-14 inset-x-0 z-30 px-4 pointer-events-none">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 pointer-events-auto mask-fade-edges">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat;
          const isLocked = (lockedCategories || []).some(
            (lc) => lc.toLowerCase() === cat.toLowerCase()
          );
          const isUnlockedThisSession = sessionUnlockedCategories?.has(cat.toLowerCase());

          return (
            <button
              key={cat}
              onClick={() => requestCategory(cat)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-white text-black shadow-lg shadow-white/20 scale-105 font-bold'
                  : 'bg-black/50 text-zinc-300 hover:text-white hover:bg-black/70 border border-white/10 backdrop-blur-md'
              }`}
            >
              {isLocked && !isUnlockedThisSession && (
                <Lock className="w-3 h-3 text-rose-400" />
              )}
              {isLocked && isUnlockedThisSession && (
                <Unlock className="w-3 h-3 text-cyan-400" />
              )}
              <span>{cat === 'All' ? '⚡ All Reels' : `#${cat}`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
