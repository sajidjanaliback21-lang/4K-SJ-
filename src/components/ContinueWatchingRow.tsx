import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { Play, X, ChevronLeft, ChevronRight, Clock, Tv, Film, Sparkles, Trash2 } from 'lucide-react';
import { ContinueWatchingItem } from '../types';

interface ContinueWatchingRowProps {
  items: ContinueWatchingItem[];
  onResume: (item: ContinueWatchingItem) => void;
  onRemove: (id: string, e: React.MouseEvent) => void;
  onClearAll?: () => void;
}

export const ContinueWatchingRow: React.FC<ContinueWatchingRowProps> = ({
  items,
  onResume,
  onRemove,
  onClearAll,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const formatRemainingTime = (currentTime: number, duration: number) => {
    if (!duration || duration <= 0) return '';
    const remSeconds = Math.max(0, duration - currentTime);
    const mins = Math.floor(remSeconds / 60);
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMins}m left`;
    }
    return `${mins}m left`;
  };

  const formatTimeTimestamp = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <section className="space-y-4 pt-1 select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-2 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="w-2.5 h-7 bg-gradient-to-b from-cyan-400 to-emerald-400 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.6)]" />
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-xl md:text-3xl font-display font-black tracking-tight text-white flex items-center gap-2">
              Continue Watching
            </h3>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-[10px] md:text-xs font-black uppercase tracking-wider text-cyan-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              {items.length} in progress
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {items.length > 1 && onClearAll && (
            <button
              onClick={onClearAll}
              className="text-[11px] md:text-xs text-white/50 hover:text-rose-400 font-bold px-3 py-1 rounded-full bg-white/5 hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Clear all continue watching history"
            >
              <Trash2 size={12} />
              <span className="hidden sm:inline">Clear List</span>
            </button>
          )}

          {/* Desktop Scroll Nav Buttons */}
          <div className="hidden sm:flex items-center gap-1 bg-black/40 border border-white/10 rounded-full p-1">
            <button
              onClick={() => scroll('left')}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
              aria-label="Scroll left"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
              aria-label="Scroll right"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel */}
      <div
        ref={scrollRef}
        className="flex gap-3 sm:gap-4 md:gap-5 overflow-x-auto pb-4 pt-1 px-2 no-scrollbar scroll-smooth snap-x"
      >
        {items.map((item, idx) => {
          const isSeries = item.type === 'series' || item.type === 'free_series';
          const remainingLabel = formatRemainingTime(item.currentTime, item.duration);
          const currentTimestampLabel = formatTimeTimestamp(item.currentTime);

          return (
            <motion.div
              key={`cw-${item.id}-${idx}`}
              initial={{ opacity: 0, y: 15, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: idx * 0.04, duration: 0.25 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onResume(item)}
              className="group relative w-[240px] sm:w-[280px] md:w-[320px] shrink-0 cursor-pointer snap-start flex-none rounded-2xl overflow-hidden bg-slate-900/90 border border-white/10 hover:border-cyan-400/80 shadow-lg hover:shadow-[0_0_30px_rgba(6,182,212,0.25)] transition-all duration-300"
            >
              {/* Media Card Aspect Container (16:9) */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/60">
                <img
                  src={item.backdrop_url || item.poster_url || 'https://picsum.photos/seed/movie/600/340'}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 brightness-90 group-hover:brightness-100"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = item.poster_url || 'https://picsum.photos/seed/media/600/340?blur=2';
                  }}
                />

                {/* Dark Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/20 group-hover:via-black/20 transition-all duration-300" />

                {/* Badges Top Row */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 z-10">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/15 text-[9px] font-black uppercase tracking-wider text-cyan-300 shadow-md">
                    {isSeries ? <Tv size={10} className="text-purple-400" /> : <Film size={10} className="text-cyan-400" />}
                    <span>{isSeries ? 'Series' : 'Movie'}</span>
                  </span>

                  {/* Remove Button */}
                  <button
                    onClick={(e) => onRemove(item.id, e)}
                    className="p-1.5 rounded-full bg-black/70 hover:bg-rose-500/90 text-white/70 hover:text-white backdrop-blur-md border border-white/15 transition-all opacity-80 group-hover:opacity-100 hover:scale-110 active:scale-95 cursor-pointer shadow-md"
                    title="Remove from Continue Watching"
                  >
                    <X size={12} />
                  </button>
                </div>

                {/* Center Hover Play Button */}
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-cyan-500/90 text-black flex items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.6)] transform scale-90 group-hover:scale-105 transition-all duration-300">
                    <Play size={20} fill="currentColor" className="ml-1" />
                  </div>
                </div>

                {/* Bottom Meta Overlay */}
                <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[10px] md:text-[11px] font-bold z-10">
                  <span className="flex items-center gap-1 text-white/90 bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-sm border border-white/10 font-mono">
                    <Clock size={10} className="text-cyan-400" />
                    <span>{currentTimestampLabel}</span>
                  </span>

                  {remainingLabel && (
                    <span className="text-emerald-400 bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-sm border border-emerald-500/20 font-black tracking-tight">
                      {remainingLabel}
                    </span>
                  )}
                </div>

                {/* Progress Bar Container */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/15 z-20 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 shadow-[0_0_10px_rgba(6,182,212,0.9)] transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(3, item.percentage || 0))}%` }}
                  />
                </div>
              </div>

              {/* Title & Info Section */}
              <div className="p-3 space-y-1 bg-gradient-to-b from-slate-900 to-slate-950">
                <h4 className="text-xs md:text-sm font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                  {item.title}
                </h4>

                <div className="flex items-center justify-between text-[10px] md:text-[11px] text-white/50">
                  <span className="truncate font-medium text-purple-300/90">
                    {item.subtitle || (isSeries ? `Episode ${item.episodeNum || '1'}` : 'Resume Feature Film')}
                  </span>
                  <span className="shrink-0 font-bold text-cyan-400/80">
                    {Math.round(item.percentage || 0)}%
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

export default ContinueWatchingRow;
