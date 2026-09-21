import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, ChevronLeft, ChevronRight, Flame } from 'lucide-react';

interface FloatingDownloadStickerProps {
  onClick: () => void;
  hasCodes?: boolean;
}

export const FloatingDownloadSticker: React.FC<FloatingDownloadStickerProps> = ({
  onClick,
  hasCodes = true,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  return (
    <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 select-none pointer-events-auto">
      <AnimatePresence mode="wait">
        {!isMinimized ? (
          <motion.div
            key="expanded-sticker"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="flex items-center"
          >
            {/* Tiny collapse arrow */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(true);
              }}
              className="p-0.5 sm:p-1 rounded-l-md bg-black/80 hover:bg-black text-white/40 hover:text-white border-l border-t border-b border-white/10 transition-colors shadow-sm cursor-pointer"
              title="Minimize"
            >
              <ChevronRight size={10} className="sm:w-3 sm:h-3" />
            </button>

            {/* Main Slim Interactive Floating Tab */}
            <motion.button
              onClick={onClick}
              whileHover={{ scale: 1.04, x: -2 }}
              whileTap={{ scale: 0.96 }}
              className="relative overflow-hidden flex flex-col items-center justify-center gap-1 py-1.5 sm:py-2.5 px-1 sm:px-2 bg-gradient-to-b from-zinc-900/95 via-black/95 to-zinc-950/95 backdrop-blur-md rounded-l-xl border-l-2 border-t border-b border-cyan-400/70 shadow-[0_0_15px_rgba(6,182,212,0.35)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] transition-all cursor-pointer group"
            >
              {/* Subtle top ping indicator */}
              <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 bg-emerald-500"></span>
              </span>

              {/* Download Icon circle */}
              <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-white shadow-sm shadow-cyan-500/40 group-hover:scale-105 transition-transform duration-200">
                <Download size={11} className="sm:w-3.5 sm:h-3.5" />
              </div>

              {/* Compact Vertical Text */}
              <div className="flex flex-col items-center leading-none">
                <span className="text-[7px] sm:text-[9px] font-black uppercase text-cyan-300 font-display tracking-tight">
                  GET
                </span>
                <span className="text-[9px] sm:text-[11px] font-black uppercase text-white font-display tracking-wider">
                  APK
                </span>
              </div>

              {/* FireStick Codes Tag */}
              {hasCodes && (
                <div className="flex items-center gap-0.5 px-1 py-0.2 rounded-full bg-amber-500/20 border border-amber-500/40 text-[7px] sm:text-[8px] font-bold text-amber-300 scale-90 sm:scale-100">
                  <Flame size={7} className="text-amber-400" />
                  <span className="hidden sm:inline">CODES</span>
                </div>
              )}
            </motion.button>
          </motion.div>
        ) : (
          /* Minimized Slivers Handle */
          <motion.button
            key="minimized-sticker"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            onClick={() => setIsMinimized(false)}
            whileHover={{ x: -2 }}
            className="flex items-center py-2 px-1 bg-gradient-to-b from-cyan-600 to-blue-700 text-white rounded-l-lg border-l border-t border-b border-cyan-300/40 shadow-md cursor-pointer"
            title="Download APK"
          >
            <ChevronLeft size={11} />
            <Download size={11} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FloatingDownloadSticker;
