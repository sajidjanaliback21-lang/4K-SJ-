import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Sparkles, Server, Check } from 'lucide-react';

interface IntroLoadingProps {
  progress: number;
  onComplete: () => void;
  brandName?: string;
  isResellersLoading?: boolean;
}

// -------------------------------------------------------------
// Streamy Mascot Component: High-fidelity animated TV Astronaut
// -------------------------------------------------------------
const StreamyMascot: React.FC<{ isLoading: boolean }> = ({ isLoading }) => {
  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      {/* Halo Glow behind head */}
      <motion.div
        animate={{
          scale: isLoading ? [0.85, 1.15, 0.85] : [1.1, 1.3, 1.1],
          opacity: isLoading ? [0.2, 0.4, 0.2] : [0.4, 0.6, 0.4],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-8 w-28 h-28 bg-cyan-400/20 rounded-full blur-xl pointer-events-none"
      />

      {/* Jetpack Flame Glow */}
      <motion.div
        animate={{
          scale: isLoading ? [0.9, 1.3, 0.9] : [1.2, 1.6, 1.2],
          opacity: isLoading ? [0.4, 0.7, 0.4] : [0.7, 1.0, 0.7],
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-6 w-12 h-12 bg-cyan-500/30 rounded-full blur-md"
      />
      
      {/* Floating Hoverpad Glow */}
      <motion.div
        animate={{
          scale: [0.9, 1.1, 0.9],
          opacity: [0.1, 0.25, 0.1],
        }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-2 w-36 h-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full blur-lg"
      />

      <motion.svg
        width="160"
        height="160"
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={{
          y: [-8, 8, -8],
          rotate: isLoading ? [-2, 2, -2] : [-4, 4, -4],
        }}
        transition={{
          y: { duration: 3.5, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 5, repeat: Infinity, ease: "easeInOut" }
        }}
        className="relative z-10"
      >
        {/* Antennas */}
        <g id="antennas">
          {/* Left Antenna */}
          <motion.path
            d="M65 35C61 24 53 18 45 20"
            stroke="#94A3B8"
            strokeWidth="3.5"
            strokeLinecap="round"
            animate={{ rotate: [-4, 4, -4] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "65px 35px" }}
          />
          <motion.circle
            cx="44"
            cy="20"
            r="6"
            fill="#22D3EE"
            animate={{
              scale: [1, 1.4, 1],
              fill: isLoading ? ["#22D3EE", "#06B6D4", "#22D3EE"] : ["#F43F5E", "#E11D48", "#F43F5E"],
            }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />

          {/* Right Antenna */}
          <motion.path
            d="M95 35C99 24 107 18 115 20"
            stroke="#94A3B8"
            strokeWidth="3.5"
            strokeLinecap="round"
            animate={{ rotate: [4, -4, 4] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "95px 35px" }}
          />
          <motion.circle
            cx="116"
            cy="20"
            r="6"
            fill="#22D3EE"
            animate={{
              scale: [1, 1.4, 1],
              fill: isLoading ? ["#22D3EE", "#06B6D4", "#22D3EE"] : ["#F43F5E", "#E11D48", "#F43F5E"],
            }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
          />
        </g>

        {/* Jetpack on back */}
        <g id="jetpack">
          <rect x="46" y="72" width="16" height="32" rx="8" fill="#334155" />
          <rect x="98" y="72" width="16" height="32" rx="8" fill="#334155" />
          {/* Flame paths */}
          <motion.path
            d="M50 104 L54 124 L58 104 Z"
            fill="url(#fireGradient)"
            animate={{ scaleY: [1, 1.6, 1], y: [0, 2, 0] }}
            transition={{ duration: 0.12, repeat: Infinity }}
          />
          <motion.path
            d="M102 104 L106 124 L110 104 Z"
            fill="url(#fireGradient)"
            animate={{ scaleY: [1, 1.6, 1], y: [0, 2, 0] }}
            transition={{ duration: 0.12, repeat: Infinity, delay: 0.06 }}
          />
        </g>

        {/* Main Body Spacesuit */}
        <rect x="52" y="68" width="56" height="44" rx="22" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="4" />
        
        {/* Chest Plate Detail */}
        <rect x="64" y="76" width="32" height="18" rx="6" fill="#1E293B" />
        {/* Arc Reactor in chest */}
        <motion.circle
          cx="80"
          cy="85"
          r="5"
          fill="#22D3EE"
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [0.85, 1.15, 0.85],
          }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* TV Head */}
        <g id="head">
          {/* Outer casing */}
          <rect x="34" y="30" width="92" height="52" rx="18" fill="#475569" stroke="#1E293B" strokeWidth="4" />
          {/* Side bolts / Ears */}
          <rect x="28" y="48" width="6" height="14" rx="2" fill="#94A3B8" />
          <rect x="126" y="48" width="6" height="14" rx="2" fill="#94A3B8" />

          {/* Inner Glowing Screen */}
          <rect x="42" y="36" width="76" height="40" rx="12" fill="#020617" stroke="#1E293B" strokeWidth="2.5" />
          
          {/* Glow backdrop on screen */}
          <rect x="44" y="38" width="72" height="36" rx="10" fill="url(#screenGlow)" opacity="0.25" />

          {/* Screen Content - Searching / Found */}
          {isLoading ? (
            <g id="searching_face">
              {/* Scanline sweep */}
              <motion.line
                x1="44"
                y1="38"
                x2="116"
                y2="38"
                stroke="#22D3EE"
                strokeWidth="1.5"
                opacity="0.8"
                animate={{ y: [0, 36, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
              />

              {/* Glowing spinning radar indicator */}
              <motion.g
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: "80px 56px" }}
              >
                <circle cx="80" cy="56" r="10" stroke="#22D3EE" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
                <line x1="80" y1="46" x2="80" y2="66" stroke="#22D3EE" strokeWidth="0.8" opacity="0.5" />
                <line x1="70" y1="56" x2="90" y2="56" stroke="#22D3EE" strokeWidth="0.8" opacity="0.5" />
              </motion.g>

              {/* Left search indicator eye */}
              <motion.circle 
                cx="54" 
                cy="56" 
                r="3" 
                fill="#22D3EE"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              {/* Right search indicator eye */}
              <motion.circle 
                cx="106" 
                cy="56" 
                r="3" 
                fill="#22D3EE"
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </g>
          ) : (
            <motion.g 
              id="happy_face"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              style={{ transformOrigin: "80px 56px" }}
            >
              {/* Happy Glowing Eyes */}
              <path d="M50 56 Q55 48 60 56" stroke="#22D3EE" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M100 56 Q105 48 110 56" stroke="#22D3EE" strokeWidth="3.5" strokeLinecap="round" />
              
              {/* Cheerful Pink Cheeks */}
              <motion.circle 
                cx="48" 
                cy="64" 
                r="4.5" 
                fill="#F43F5E" 
                opacity="0.7"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <motion.circle 
                cx="112" 
                cy="64" 
                r="4.5" 
                fill="#F43F5E" 
                opacity="0.7"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.25 }}
              />

              {/* Smiling Mouth */}
              <path d="M74 60 Q80 67 86 60" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round" />
            </motion.g>
          )}
        </g>

        {/* Arms */}
        {/* Left Arm */}
        <motion.g
          animate={isLoading ? {
            rotate: [-12, 15, -12],
          } : {
            rotate: [30, 80, 30],
            y: [-2, -5, -2]
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "52px 76px" }}
        >
          <path d="M52 76 C40 82 32 90 36 100" stroke="#F1F5F9" strokeWidth="6" strokeLinecap="round" />
          <circle cx="36" cy="100" r="5" fill="#94A3B8" />
        </motion.g>

        {/* Right Arm */}
        <motion.g
          animate={isLoading ? {
            rotate: [12, -15, 12],
          } : {
            rotate: [-35, -5, -35],
            y: [-1, -4, -1]
          }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "108px 76px" }}
        >
          <path d="M108 76 C120 82 128 90 124 100" stroke="#F1F5F9" strokeWidth="6" strokeLinecap="round" />
          <circle cx="124" cy="100" r="5" fill="#94A3B8" />
        </motion.g>

        {/* Legs */}
        {/* Left Leg */}
        <motion.g
          animate={{ rotate: [-6, 6, -6], y: [0, -2, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "66px 104px" }}
        >
          <path d="M66 104 C63 114 60 122 63 128" stroke="#F1F5F9" strokeWidth="6" strokeLinecap="round" />
          <circle cx="63" cy="128" r="5" fill="#94A3B8" />
        </motion.g>

        {/* Right Leg */}
        <motion.g
          animate={{ rotate: [6, -6, 6], y: [0, -2, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
          style={{ transformOrigin: "94px 104px" }}
        >
          <path d="M94 104 C97 114 100 122 97 128" stroke="#F1F5F9" strokeWidth="6" strokeLinecap="round" />
          <circle cx="97" cy="128" r="5" fill="#94A3B8" />
        </motion.g>

        {/* Definitions */}
        <defs>
          <linearGradient id="fireGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="45%" stopColor="#2563EB" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#1E40AF" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="screenGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0" />
          </radialGradient>
        </defs>
      </motion.svg>
    </div>
  );
};

// -------------------------------------------------------------
// Main IntroLoading Component
// -------------------------------------------------------------
const IntroLoading: React.FC<IntroLoadingProps> = ({ 
  progress, 
  onComplete, 
  brandName = "4K•SJ", 
  isResellersLoading = true 
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);

  // Split and render brand names beautifully
  const renderBrandName = (name: string) => {
    const separators = ['•', '·', '•', '*', '-'];
    let sepFound = '';
    for (const s of separators) {
      if (name.includes(s)) {
        sepFound = s;
        break;
      }
    }

    if (sepFound) {
      const parts = name.split(sepFound);
      return (
        <div className="flex items-center justify-center font-display font-black tracking-tight italic">
          <motion.span 
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 14 }}
            className="text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]"
          >
            {parts[0]}
          </motion.span>
          <motion.span 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.5 }}
            transition={{ delay: 0.15, type: "spring" }}
            className="text-white/40 font-normal mx-2"
          >
            {sepFound}
          </motion.span>
          <motion.span 
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.1 }}
            className="text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
          >
            {parts.slice(1).join(sepFound)}
          </motion.span>
        </div>
      );
    }

    if (name.includes(' ')) {
      const parts = name.split(' ');
      return (
        <div className="flex items-center justify-center font-display font-black tracking-tight italic">
          <motion.span 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]"
          >
            {parts[0]}
          </motion.span>
          <span className="mx-2"> </span>
          <motion.span 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-white"
          >
            {parts.slice(1).join(' ')}
          </motion.span>
        </div>
      );
    }

    if (name.length > 3) {
      const splitIndex = Math.min(2, Math.floor(name.length / 2));
      return (
        <div className="flex items-center justify-center font-display font-black tracking-tight italic">
          <motion.span 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]"
          >
            {name.substring(0, splitIndex)}
          </motion.span>
          <motion.span 
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-white"
          >
            {name.substring(splitIndex)}
          </motion.span>
        </div>
      );
    }

    return (
      <motion.span 
        initial={{ filter: "blur(10px)", opacity: 0 }}
        animate={{ filter: "blur(0px)", opacity: 1 }}
        className="text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.6)] font-display font-black italic"
      >
        {name}
      </motion.span>
    );
  };

  useEffect(() => {
    // Smoothly animate the progress number
    const timer = setInterval(() => {
      setDisplayProgress(prev => {
        if (prev < progress) return Math.min(prev + 1, progress);
        return prev;
      });
    }, 15);
    return () => clearInterval(timer);
  }, [progress]);

  useEffect(() => {
    if (displayProgress >= 100) {
      const timeout = setTimeout(() => {
        onComplete();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [displayProgress, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.8, ease: [0.43, 0.13, 0.23, 0.96] }}
      className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center overflow-hidden gpu text-white"
    >
      {/* 🌌 Space Twinkling Stars Background */}
      <div className="absolute inset-0 overflow-hidden opacity-30 pointer-events-none">
        {[...Array(24)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              top: `${(i * 17) % 100}%`,
              left: `${(i * 23) % 100}%`,
              boxShadow: "0 0 8px rgba(255, 255, 255, 0.8)"
            }}
            animate={{
              opacity: [0.1, 0.8, 0.1],
              scale: [0.7, 1.3, 0.7],
            }}
            transition={{
              duration: 2 + (i % 3),
              repeat: Infinity,
              delay: (i % 4) * 0.5,
            }}
          />
        ))}
      </div>

      {/* 🌠 Floating Nebulae Dust & Space Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute bg-cyan-500/10 rounded-full blur-3xl"
            style={{
              top: `${(i * 25) % 80 + 10}%`,
              left: `${(i * 35) % 80 + 10}%`,
              width: `${120 + (i * 40)}px`,
              height: `${120 + (i * 40)}px`,
            }}
            animate={{
              x: [-15, 15, -15],
              y: [-15, 15, -15],
              scale: [0.9, 1.1, 0.9],
            }}
            transition={{
              duration: 8 + i * 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* Glowing Backdrop Centers */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-cyan-500/5 blur-[80px] rounded-full pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-600/5 blur-[60px] rounded-full pointer-events-none" />

      {/* 🚀 Interactive Loading Core */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-6 w-full max-w-lg px-8">
        
        {/* Animated Hologram ring around Streamy */}
        <div className="relative flex items-center justify-center">
          {/* Cybernetic Rotating Circle */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute w-56 h-56 border border-dashed border-cyan-500/20 rounded-full flex items-center justify-center"
          >
            <div className="absolute w-2 h-2 bg-cyan-400 rounded-full top-0 shadow-[0_0_8px_#22d3ee]" />
            <div className="absolute w-2 h-2 bg-blue-500 rounded-full bottom-0 shadow-[0_0_8px_#3b82f6]" />
          </motion.div>
          
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute w-48 h-48 border border-dashed border-blue-500/10 rounded-full"
          />

          {/* Streamy the TV Mascot */}
          <StreamyMascot isLoading={isResellersLoading} />
        </div>

        {/* 🏷️ Dynamic Brand Reveal Panel */}
        <div className="min-h-[140px] flex flex-col items-center justify-center text-center">
          <AnimatePresence mode="wait">
            {isResellersLoading ? (
              <motion.div
                key="searching_status"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="flex flex-col items-center gap-2"
              >
                {/* Searching Hologram Glow */}
                <div className="flex items-center gap-2 bg-cyan-950/40 border border-cyan-500/20 px-4 py-2 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 size={16} className="text-cyan-400" />
                  </motion.div>
                  <span className="text-xs text-cyan-300 font-mono tracking-widest uppercase flex items-center gap-1.5">
                    Pinging Reseller Server
                    <motion.span
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    >
                      ...
                    </motion.span>
                  </span>
                </div>
                
                <h2 className="text-2xl font-black italic tracking-wider text-slate-400 font-display mt-2">
                  LOCATING GATEWAY
                </h2>
                <p className="text-[10px] text-slate-500 font-mono tracking-[0.2em] uppercase">
                  Scanning Decentralized Nodes
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="found_brand"
                initial={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
                className="flex flex-col items-center gap-3"
              >
                {/* Found Hologram Glow */}
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-500/20 px-4 py-1.5 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                >
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-[10px] text-emerald-300 font-mono tracking-widest uppercase">
                    Reseller Gateway Loaded
                  </span>
                </motion.div>

                {/* Big cinematic brand name */}
                <div className="text-5xl md:text-7xl">
                  {renderBrandName(brandName)}
                </div>

                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  transition={{ delay: 0.5 }}
                  className="text-xs text-cyan-300/80 uppercase tracking-[0.4em] font-medium italic pl-1"
                >
                  PREMIUM PORTAL ENGAGED
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 📊 Progress Section */}
        <div className="w-full space-y-4 mt-2">
          <div className="flex justify-between items-end">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col text-left"
            >
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold font-mono">
                {isResellersLoading ? "Initializing Quantum Engine" : "Ready to Launch"}
              </span>
              <span className="text-xs text-white/70 font-medium">
                {displayProgress < 30 ? "Synchronizing satellite stream..." :
                 displayProgress < 60 ? "De-serializing content cache..." :
                 displayProgress < 90 ? "Injecting customized themes..." : "Stream completely primed!"}
              </span>
            </motion.div>
            <motion.span 
              className="text-3xl font-display font-black text-cyan-400 tabular-nums drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {displayProgress}%
            </motion.span>
          </div>

          {/* Glowing Futuristic Progress Capsule Bar */}
          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-white/5 p-[1px] relative shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-white shadow-[0_0_15px_rgba(34,211,238,0.7)]"
              initial={{ width: "0%" }}
              animate={{ width: `${displayProgress}%` }}
              transition={{ duration: 0.2 }}
            />
            {/* Pulsing light accent on progress tip */}
            <motion.div
              style={{ left: `${displayProgress}%` }}
              className="absolute top-0 bottom-0 w-4 bg-white/60 blur-[3px] -translate-x-full pointer-events-none"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          </div>
        </div>

      </div>

      {/* Cinematic corner decorations */}
      <div className="absolute bottom-12 left-12 flex flex-col gap-1.5 opacity-40">
        <div className="w-10 h-[1.5px] bg-cyan-500/50 shadow-[0_0_4px_#22d3ee]" />
        <div className="w-6 h-[1.5px] bg-cyan-500/30" />
      </div>
      <div className="absolute top-12 right-12 flex flex-col items-end gap-1.5 opacity-40">
        <div className="w-10 h-[1.5px] bg-cyan-500/50 shadow-[0_0_4px_#22d3ee]" />
        <div className="w-14 h-[1.5px] bg-cyan-500/30" />
      </div>
    </motion.div>
  );
};

export default IntroLoading;
