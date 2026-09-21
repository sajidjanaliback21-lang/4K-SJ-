import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  Tv, 
  Smartphone, 
  Flame, 
  ExternalLink, 
  Sparkles, 
  Info, 
  Monitor, 
  ArrowRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { AppDownloadItem } from '../types';

interface DownloadAppsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apps: AppDownloadItem[];
  activeReseller?: any;
  defaultDownloadUrl?: string;
  defaultServerUrl?: string;
}

export const DownloadAppsModal: React.FC<DownloadAppsModalProps> = ({
  isOpen,
  onClose,
  apps,
  activeReseller,
  defaultDownloadUrl,
  defaultServerUrl,
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showInstructions, setShowInstructions] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleCopyCode = (code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode(null);
    }, 2500);
  };

  // Determine branding
  const brandName = activeReseller?.brand_name || 'SJ IPTV & VOD';
  const brandTagline = activeReseller?.tagline || 'Official Applications & FireStick Downloader Codes';
  const brandLogo = activeReseller?.logo_url;

  // Filter apps based on active reseller permission:
  // 1. If activeReseller is present (subdomain / reseller URL):
  //    - Show if app is marked is_default === true (available globally across all resellers & main site)
  //    - OR if allowed_reseller_ids is empty or includes 'all'
  //    - OR if allowed_reseller_ids matches this reseller's id, subdomain, or brand name
  // 2. If NO activeReseller (Main Website):
  //    - ALWAYS show all applications created by the admin!
  //    - "Main Chahta Hun Ki vah application mere pass bhi show ho aur mere Allowed kiye hue resalers ke pass bhi show Ho"
  const filteredApps = apps.filter(app => {
    if (activeReseller) {
      if (app.is_default) return true;
      if (!app.allowed_reseller_ids || app.allowed_reseller_ids.length === 0) return true;
      if (app.allowed_reseller_ids.includes('all')) return true;

      const resId = String(activeReseller.id || '').trim().toLowerCase();
      const resSubdomain = String(activeReseller.subdomain || '').trim().toLowerCase();
      const resName = String(activeReseller.brand_name || '').trim().toLowerCase();

      return app.allowed_reseller_ids.some((id: string) => {
        const cleanId = String(id || '').trim().toLowerCase();
        return (
          cleanId === resId ||
          cleanId === resSubdomain ||
          cleanId === resName ||
          cleanId === 'all'
        );
      });
    }

    // Main website: Always show all apps created by the owner
    return true;
  });

  // Also include reseller's direct app_link as a featured item if provided and not already duplicate
  const allDisplayApps: (AppDownloadItem & { isResellerDirect?: boolean })[] = [...filteredApps];

  if (activeReseller?.app_link && activeReseller.app_link.trim() !== '') {
    const directUrl = activeReseller.app_link.trim();
    const alreadyExists = allDisplayApps.some(a => a.download_url === directUrl);
    if (!alreadyExists) {
      allDisplayApps.unshift({
        id: 'reseller-custom-app',
        name: `${brandName} Custom App`,
        logo_url: brandLogo || '',
        download_url: directUrl,
        downloader_code: '',
        version: 'Custom App',
        description: `Official branded APK provided exclusively for ${brandName} subscribers.`,
        device_type: 'android_tv',
        is_default: true,
        isResellerDirect: true,
      });
    }
  }

  // Only if database has ZERO apps configured anywhere and defaultDownloadUrl exists
  if (allDisplayApps.length === 0 && apps.length === 0 && defaultDownloadUrl && defaultDownloadUrl.trim() !== '') {
    allDisplayApps.push({
      id: 'default-app-fallback',
      name: `${brandName} Official App`,
      logo_url: brandLogo || '',
      download_url: defaultDownloadUrl,
      downloader_code: '',
      version: 'Latest',
      description: `Download the official streaming application for your device.`,
      device_type: 'android_tv',
      is_default: true,
    });
  }

  // Filter by category tab
  const displayedApps = allDisplayApps.filter(app => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'tv') {
      return (
        !app.device_type ||
        app.device_type === 'all' ||
        app.device_type === 'android_tv' ||
        app.device_type === 'firestick'
      );
    }
    if (selectedCategory === 'mobile') {
      return !app.device_type || app.device_type === 'all' || app.device_type === 'mobile';
    }
    return true;
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-gradient-to-b from-[#111622] via-[#0d111a] to-[#080b11] border border-cyan-500/25 rounded-2xl sm:rounded-3xl shadow-[0_0_60px_rgba(6,182,212,0.25)] overflow-hidden z-10"
        >
          {/* Header Glow Bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 animate-pulse" />

          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3 sm:gap-4">
              {brandLogo ? (
                <img 
                  src={brandLogo} 
                  alt={brandName} 
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-contain bg-black/40 border border-white/15 p-1 shadow-md"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30">
                  <Download size={22} className="animate-bounce" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-wide uppercase font-display flex items-center gap-2">
                    {brandName} Apps
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    APK & Codes
                  </span>
                </div>
                <p className="text-xs text-white/50 line-clamp-1">
                  {brandTagline}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 sm:p-2.5 rounded-full bg-white/5 hover:bg-rose-500/20 text-white/60 hover:text-rose-400 border border-white/10 transition-all cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Category Filter & Instruction Toggle */}
          <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-2.5 bg-black/30 border-b border-white/5 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                All Apps ({allDisplayApps.length})
              </button>
              <button
                onClick={() => setSelectedCategory('tv')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === 'tv'
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <Tv size={13} />
                <span>Android TV & FireStick</span>
              </button>
              <button
                onClick={() => setSelectedCategory('mobile')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === 'mobile'
                    ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <Smartphone size={13} />
                <span>Mobile & Tablet</span>
              </button>
            </div>

            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap cursor-pointer px-2 py-1 rounded-md hover:bg-cyan-500/10"
            >
              <Info size={13} />
              <span>{showInstructions ? 'Hide Help' : 'Downloader Guide'}</span>
            </button>
          </div>

          {/* Quick Guide Accordion */}
          <AnimatePresence>
            {showInstructions && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-cyan-500/20 bg-cyan-950/20"
              >
                <div className="p-4 sm:p-5 text-xs text-white/80 space-y-2">
                  <h4 className="font-bold text-cyan-400 flex items-center gap-1.5 text-sm">
                    <Flame size={15} className="text-amber-400" />
                    How to Install on Amazon FireStick & Android TV Box:
                  </h4>
                  <ol className="list-decimal list-inside space-y-1 text-white/70 pl-1">
                    <li>Open the <strong>Downloader</strong> app on your FireStick or Android TV.</li>
                    <li>In the URL / Search bar, enter the <strong>Downloader Code</strong> shown below.</li>
                    <li>Press <strong>GO</strong>. The app will immediately download and prompt you to <strong>Install</strong>.</li>
                    <li>Open the app, enter your IPTV login credentials, and enjoy!</li>
                  </ol>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Apps Cards Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {displayedApps.length === 0 ? (
              <div className="text-center py-16 bg-white/[0.02] rounded-2xl border border-white/5">
                <Download size={36} className="text-white/20 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white mb-1">No Applications Listed Yet</h3>
                <p className="text-xs text-white/40 max-w-sm mx-auto">
                  Applications will appear here once added in the Admin Panel or assigned by your reseller.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayedApps.map((app, index) => {
                  const hasDownloaderCode = !!app.downloader_code && app.downloader_code.trim() !== '';
                  const isCopied = copiedCode === app.downloader_code;

                  return (
                    <div
                      key={app.id || index}
                      className="relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 hover:border-cyan-500/40 transition-all duration-300 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] group"
                    >
                      {/* Top Row: App Icon & Info */}
                      <div>
                        <div className="flex items-start gap-3.5 mb-3">
                          {app.logo_url ? (
                            <img
                              src={app.logo_url}
                              alt={app.name}
                              className="w-14 h-14 rounded-2xl object-cover bg-black/60 border border-white/15 p-1 shadow-lg shrink-0 group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-cyan-500/20 shrink-0">
                              {app.name.charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <h3 className="text-base font-bold text-white truncate">
                                {app.name}
                              </h3>
                              {app.version && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-cyan-300 border border-white/10">
                                  {app.version}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-white/50 line-clamp-2 leading-relaxed">
                              {app.description || 'Fast, reliable IPTV streaming application with live EPG and multi-screen support.'}
                            </p>
                          </div>
                        </div>

                        {/* Downloader Code Box (if available) */}
                        {hasDownloaderCode && (
                          <div className="my-3.5 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-transparent border border-amber-500/30 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                                <Flame size={16} />
                              </div>
                              <div>
                                <div className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                                  FireStick Downloader Code
                                </div>
                                <div className="font-mono text-base font-black text-white tracking-widest">
                                  {app.downloader_code}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleCopyCode(app.downloader_code!)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                                isCopied
                                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/30'
                                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
                              }`}
                            >
                              {isCopied ? (
                                <>
                                  <Check size={13} />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={13} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Download APK Button */}
                      <div className="pt-2">
                        <a
                          href={app.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative overflow-hidden flex items-center justify-center gap-2 w-full py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] border border-white/20 transition-all duration-300 group/btn"
                        >
                          {/* Shine effect */}
                          <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover/btn:translate-x-[300%] transition-transform duration-1000" />
                          <Download size={16} className="group-hover/btn:translate-y-0.5 transition-transform" />
                          <span>Download APK</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-3 sm:p-4 bg-black/50 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>100% Virus-Free & Safe APKs Verified</span>
            </div>
            <span>Powered by {brandName}</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default DownloadAppsModal;
