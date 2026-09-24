import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Flame, Hourglass, Trash2 } from 'lucide-react';

interface MediaCountdownBadgeProps {
  expiresAt?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showUrgencyPulse?: boolean;
}

export interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isExpired: boolean;
}

export function calculateTimeRemaining(expiresAt?: string | null): TimeLeft | null {
  if (!expiresAt) return null;

  try {
    const expiryTime = new Date(expiresAt).getTime();
    if (isNaN(expiryTime)) return null;

    const now = Date.now();
    const diff = expiryTime - now;

    if (diff <= 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalMs: 0,
        isExpired: true
      };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return {
      days,
      hours,
      minutes,
      seconds,
      totalMs: diff,
      isExpired: false
    };
  } catch (e) {
    return null;
  }
}

// Compact Animated Digit Cell
const AnimatedDigitCell: React.FC<{
  val: string | number;
  unit: string;
  isUrgent?: boolean;
  isCritical?: boolean;
  isLarge?: boolean;
}> = ({ val, unit, isUrgent, isCritical, isLarge = false }) => {
  const displayVal = typeof val === 'number' ? val.toString().padStart(2, '0') : val;

  const styleConfig = isCritical
    ? {
        bg: 'from-rose-500/25 to-red-950/70 border-rose-500/50 shadow-[0_0_8px_rgba(244,63,94,0.35)]',
        numText: 'text-rose-100 drop-shadow-[0_0_6px_rgba(244,63,94,0.8)]',
        unitText: 'text-rose-400 font-extrabold',
      }
    : isUrgent
    ? {
        bg: 'from-amber-500/25 to-orange-950/70 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.35)]',
        numText: 'text-amber-100 drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]',
        unitText: 'text-amber-400 font-extrabold',
      }
    : {
        bg: 'from-cyan-500/20 to-blue-950/70 border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.3)]',
        numText: 'text-cyan-100 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]',
        unitText: 'text-cyan-300 font-extrabold',
      };

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-md bg-gradient-to-b ${styleConfig.bg} border backdrop-blur-md relative overflow-hidden ${
        isLarge ? 'min-w-[34px] px-2 py-1' : 'min-w-[21px] sm:min-w-[23px] px-0.5 sm:px-1 py-0.5'
      }`}
    >
      {/* Top reflection highlight */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-white/40 pointer-events-none" />

      {/* Animated Number Flip */}
      <div className={`relative flex items-center justify-center overflow-hidden leading-none ${isLarge ? 'h-[16px]' : 'h-[11px] sm:h-[12px]'}`}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={displayVal}
            initial={{ y: -6, opacity: 0, scale: 0.85 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 6, opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`font-mono font-black tracking-tight leading-none ${isLarge ? 'text-xs sm:text-sm' : 'text-[8.5px] sm:text-[9.5px]'} ${styleConfig.numText}`}
          >
            {displayVal}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Micro Unit Label */}
      <span className={`uppercase tracking-tighter leading-none mt-0.5 ${isLarge ? 'text-[7px]' : 'text-[5.5px] sm:text-[6px]'} ${styleConfig.unitText}`}>
        {unit}
      </span>
    </div>
  );
};

export const MediaCountdownBadge: React.FC<MediaCountdownBadgeProps> = ({
  expiresAt,
  className = '',
  size = 'sm',
  showUrgencyPulse = true
}) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() => calculateTimeRemaining(expiresAt));

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft(null);
      return;
    }

    setTimeLeft(calculateTimeRemaining(expiresAt));

    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining(expiresAt);
      setTimeLeft(remaining);
      if (remaining?.isExpired) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!timeLeft || !expiresAt) return null;

  if (timeLeft.isExpired) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/90 backdrop-blur-xl border border-rose-500/60 text-rose-300 text-[8px] font-black uppercase tracking-wider shadow-[0_0_15px_rgba(244,63,94,0.5)] ${className}`}>
        <Trash2 size={10} className="text-rose-400 animate-pulse shrink-0" />
        <span>Deleted / Expired</span>
      </div>
    );
  }

  // Determine urgency tier
  const isCritical = timeLeft.days === 0 && timeLeft.hours < 6; // under 6 hours: glowing neon red
  const isUrgent = timeLeft.days === 0 && timeLeft.hours < 24;   // under 24 hours: intense amber flame

  const d = timeLeft.days;
  const h = timeLeft.hours;
  const m = timeLeft.minutes;
  const s = timeLeft.seconds;

  // Outer Wrapper Neon Glow Styles
  const wrapperStyle = isCritical
    ? 'border-rose-500/50 shadow-[0_4px_16px_rgba(244,63,94,0.35)]'
    : isUrgent
    ? 'border-amber-500/50 shadow-[0_4px_16px_rgba(245,158,11,0.35)]'
    : 'border-cyan-500/40 shadow-[0_4px_16px_rgba(6,182,212,0.35)]';

  const glowDotColor = isCritical ? 'bg-rose-400' : isUrgent ? 'bg-amber-400' : 'bg-cyan-400';

  // LARGE HERO/MODAL DISPLAY
  if (size === 'lg') {
    return (
      <div className={`p-3 rounded-2xl bg-black/90 backdrop-blur-2xl border ${wrapperStyle} flex flex-col gap-2 ${className}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {isCritical ? (
              <Flame size={13} className="text-rose-400 animate-bounce" />
            ) : isUrgent ? (
              <Hourglass size={13} className="text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
            ) : (
              <Trash2 size={13} className="text-cyan-400" />
            )}
            <span className="text-[10px] font-black uppercase tracking-wider text-white">
              {isCritical ? 'Deleting in Final Hours' : isUrgent ? 'Deleting Soon' : 'Auto Delete Countdown'}
            </span>
          </div>
          <span className="flex items-center gap-1 text-[8.5px] font-mono font-bold text-white/50">
            <span className={`w-1.5 h-1.5 rounded-full ${glowDotColor} animate-ping`} />
            AUTO-DELETE
          </span>
        </div>

        {/* Digital Clock Large */}
        <div className="flex items-center justify-center gap-1">
          {d > 0 && (
            <>
              <AnimatedDigitCell val={d} unit="Days" isUrgent={isUrgent} isCritical={isCritical} isLarge />
              <span className="text-white/40 font-black text-xs animate-pulse">:</span>
            </>
          )}
          <AnimatedDigitCell val={h} unit="Hrs" isUrgent={isUrgent} isCritical={isCritical} isLarge />
          <span className="text-white/40 font-black text-xs animate-pulse">:</span>
          <AnimatedDigitCell val={m} unit="Min" isUrgent={isUrgent} isCritical={isCritical} isLarge />
          <span className="text-white/40 font-black text-xs animate-pulse">:</span>
          <AnimatedDigitCell val={s} unit="Sec" isUrgent={isUrgent} isCritical={isCritical} isLarge />
        </div>
      </div>
    );
  }

  // ULTRA SLEEK COMPACT CARD DOCK (Guaranteed not to block movie poster or face)
  return (
    <div
      className={`inline-flex flex-col items-center gap-0.5 p-1 sm:p-1.5 rounded-xl bg-black/85 backdrop-blur-xl border ${wrapperStyle} transition-all duration-300 pointer-events-none select-none max-w-[130px] sm:max-w-[145px] ${className}`}
      title={`Auto delete in: ${d > 0 ? `${d}d ` : ''}${h}h ${m}m ${s}s`}
    >
      {/* Top Header: Explicitly informs that content will delete */}
      <div className="flex items-center justify-between w-full px-0.5 gap-1">
        <div className="flex items-center gap-1 truncate">
          <span className={`w-1.5 h-1.5 rounded-full ${glowDotColor} animate-ping shrink-0`} />
          <span className={`text-[7px] sm:text-[7.5px] font-black tracking-wider uppercase truncate ${isCritical ? 'text-rose-300 font-extrabold' : isUrgent ? 'text-amber-300' : 'text-cyan-300'}`}>
            {isCritical ? 'DELETING SOON' : 'DELETES IN'}
          </span>
        </div>
        {isCritical ? (
          <Flame size={8} className="text-rose-400 animate-bounce shrink-0" />
        ) : isUrgent ? (
          <Hourglass size={8} className="text-amber-400 animate-spin shrink-0" style={{ animationDuration: '6s' }} />
        ) : (
          <Clock size={8} className="text-cyan-400 shrink-0" />
        )}
      </div>

      {/* Micro Animated Segments: DAY | HRS | MIN | SEC */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        {d > 0 && (
          <>
            <AnimatedDigitCell val={d} unit="D" isUrgent={isUrgent} isCritical={isCritical} />
            <span className="text-white/30 font-black text-[7px] sm:text-[8px] pb-1 leading-none animate-pulse">:</span>
          </>
        )}
        <AnimatedDigitCell val={h} unit="H" isUrgent={isUrgent} isCritical={isCritical} />
        <span className="text-white/30 font-black text-[7px] sm:text-[8px] pb-1 leading-none animate-pulse">:</span>
        <AnimatedDigitCell val={m} unit="M" isUrgent={isUrgent} isCritical={isCritical} />
        <span className="text-white/30 font-black text-[7px] sm:text-[8px] pb-1 leading-none animate-pulse">:</span>
        <AnimatedDigitCell val={s} unit="S" isUrgent={isUrgent} isCritical={isCritical} />
      </div>
    </div>
  );
};

export default MediaCountdownBadge;
