import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft,
  Check,
  Copy,
  Play, 
  Download, 
  Search, 
  LogIn, 
  LogOut, 
  Lock,
  Unlock,
  Shield,
  Film, 
  Tv, 
  Clapperboard,
  Zap,
  Gift,
  X, 
  ChevronRight, 
  Info,
  ExternalLink,
  Loader2,
  AlertCircle,
  Home,
  User,
  TrendingUp,
  Clock,
  LayoutGrid,
  Star,
  Trophy,
  Crown,
  MessageCircle,
  Pencil,
  Settings,
  Share2,
  Heart,
  Plus,
  Youtube,
  Radio,
  GripVertical,
  Trash2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { xtreamApi, DEFAULT_CREDENTIALS } from './lib/api';
import { XtreamCredentials, Category, Stream, Series, LiveStream } from './types';
import axios from 'axios';
import VideoPlayer from './components/VideoPlayer';
import IntroLoading from './components/IntroLoading';
import { db, auth } from './firebase';
import { doc, onSnapshot, setDoc, getDoc, getDocFromServer, collection, addDoc, deleteDoc, query, orderBy, updateDoc, where, writeBatch } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { fetchTmdbDetails, TmdbDetails, fetchTrendingMovies, fetchTrendingSeries, TmdbTrendingItem, cleanMediaTitle, fetchTmdbDetailsById, getStoredTmdbDetails, getStoredTmdbDetailsById, getLanguageTags } from './lib/tmdb';


enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const AVATARS = [
  {
    id: 'cinephile',
    name: 'Cinephile Red',
    render: () => (
      <svg viewBox="0 0 100 100" className="w-full h-full object-cover rounded-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="url(#cinephile-grad)" stroke="#00D1FF" strokeWidth="2.5" />
        {/* Face skin */}
        <path d="M28 48 C28 66, 72 66, 72 48 C72 38, 28 38, 28 48Z" fill="#FFE082" />
        {/* Cool hair/cap */}
        <path d="M22 44 Q50 20 78 44 C82 32, 18 32, 22 44Z" fill="#FF1744" />
        <circle cx="50" cy="24" r="5" fill="#FFFFFF" />
        {/* Retro 3D glasses */}
        <rect x="29" y="44" width="18" height="10" rx="3" fill="#00E5FF" stroke="#1A1A1A" strokeWidth="2.5" />
        <rect x="53" y="44" width="18" height="10" rx="3" fill="#FF1744" stroke="#1A1A1A" strokeWidth="2.5" />
        <rect x="47" y="47" width="6" height="3" fill="#1A1A1A" />
        {/* Mouth */}
        <path d="M43 62 Q50 67 57 62" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" fill="none" />
        <defs>
          <linearGradient id="cinephile-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0B132B" />
            <stop offset="100%" stopColor="#3A506B" />
          </linearGradient>
        </defs>
      </svg>
    )
  },
  {
    id: 'geek',
    name: 'Cyber Geek',
    render: () => (
      <svg viewBox="0 0 100 100" className="w-full h-full object-cover rounded-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="url(#geek-grad)" stroke="#14B8A6" strokeWidth="2.5" />
        {/* Skin */}
        <path d="M28 50 C28 68, 72 68, 72 50 C72 40, 28 40, 28 50Z" fill="#FFD54F" />
        {/* Cap with glowing emblem */}
        <path d="M22 45 Q50 22 78 45 C82 35, 18 35, 22 45Z" fill="#1E293B" />
        <rect x="42" y="32" width="16" height="6" rx="2" fill="#5EEAD4" />
        {/* Futuristic visor/glasses */}
        <rect x="25" y="43" width="50" height="10" rx="4" fill="#14B8A6" stroke="#0F172A" strokeWidth="2" opacity="0.9" />
        <line x1="25" y1="48" x2="75" y2="48" stroke="#CCFBF1" strokeWidth="1" />
        {/* Mouth */}
        <path d="M45 61 H55" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
        <defs>
          <linearGradient id="geek-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0B1622" />
            <stop offset="100%" stopColor="#115E59" />
          </linearGradient>
        </defs>
      </svg>
    )
  },
  {
    id: 'retro',
    name: 'Synthwave DJ',
    render: () => (
      <svg viewBox="0 0 100 100" className="w-full h-full object-cover rounded-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="url(#retro-grad)" stroke="#EC4899" strokeWidth="2.5" />
        {/* Skin */}
        <path d="M28 48 C28 66, 72 66, 72 48 C72 38, 28 38, 28 48Z" fill="#FFE082" />
        {/* Cool Hair */}
        <path d="M20 45 C15 30, 85 30, 80 45 C84 20, 16 20, 20 45Z" fill="#EC4899" />
        {/* Retro DJ Sunglasses */}
        <path d="M25 43 H75 V51 H25 Z" fill="#F43F5E" stroke="#1E1B4B" strokeWidth="2.5" />
        <line x1="25" y1="47" x2="75" y2="47" stroke="#FEF08A" strokeWidth="1.5" />
        {/* DJ Headphones */}
        <path d="M18 40 Q50 12 82 40" stroke="#06B6D4" strokeWidth="5.5" strokeLinecap="round" fill="none" />
        <rect x="13" y="38" width="8" height="16" rx="3" fill="#06B6D4" />
        <rect x="79" y="38" width="8" height="16" rx="3" fill="#06B6D4" />
        {/* Mouth */}
        <path d="M43 60 Q50 65 57 60" stroke="#111" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <defs>
          <linearGradient id="retro-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#311042" />
            <stop offset="100%" stopColor="#831843" />
          </linearGradient>
        </defs>
      </svg>
    )
  },
  {
    id: 'captain',
    name: 'Visor Captain',
    render: () => (
      <svg viewBox="0 0 100 100" className="w-full h-full object-cover rounded-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="url(#captain-grad)" stroke="#3B82F6" strokeWidth="2.5" />
        {/* Skin */}
        <path d="M28 48 C28 66, 72 66, 72 48 C72 38, 28 38, 28 48Z" fill="#FFCC80" />
        {/* Cap */}
        <path d="M15 42 H85 L78 28 H22 Z" fill="#1E3A8A" />
        <rect x="25" y="36" width="50" height="6" fill="#F59E0B" />
        <circle cx="50" cy="33" r="4.5" fill="#EF4444" />
        {/* Futuristic Vision Shield/Glasses */}
        <path d="M27 45 H73 L71 54 H29 Z" fill="#3B82F6" stroke="#1E1B4B" strokeWidth="2" opacity="0.95" />
        <circle cx="37" cy="49" r="2.5" fill="#FFE082" />
        <circle cx="63" cy="49" r="2.5" fill="#FFE082" />
        {/* Captain Beard */}
        <path d="M30 58 Q50 78 70 58 Q50 65 30 58Z" fill="#0F172A" />
        {/* Smirk */}
        <path d="M44 58 Q50 62 56 58" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" fill="none" />
        <defs>
          <linearGradient id="captain-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0B132E" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
        </defs>
      </svg>
    )
  },
  {
    id: 'star',
    name: 'VIP Star',
    render: () => (
      <svg viewBox="0 0 100 100" className="w-full h-full object-cover rounded-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="url(#star-grad)" stroke="#FBBF24" strokeWidth="2.5" />
        {/* Skin */}
        <path d="M28 48 C28 66, 72 66, 72 48 C72 38, 28 38, 28 48Z" fill="#FFE082" />
        {/* Crown/Golden Hair */}
        <path d="M20 40 L35 25 L50 38 L65 25 L80 40 C85 30, 15 30, 20 40Z" fill="#FBBF24" />
        {/* Golden Crown Gems */}
        <circle cx="35" cy="25" r="3" fill="#EF4444" />
        <circle cx="50" cy="38" r="3" fill="#3B82F6" />
        <circle cx="65" cy="25" r="3" fill="#EF4444" />
        {/* Star-shaped cool glasses */}
        <path d="M24 46 L30 40 L38 46 L35 54 L27 54 Z" fill="#EF4444" stroke="#111" strokeWidth="1.5" />
        <path d="M62 46 L68 40 L76 46 L73 54 L65 54 Z" fill="#EF4444" stroke="#111" strokeWidth="1.5" />
        <line x1="38" y1="46" x2="62" y2="46" stroke="#111" strokeWidth="2" />
        {/* Smile */}
        <path d="M42 61 Q50 67 58 61" stroke="#111" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <defs>
          <linearGradient id="star-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E1B4B" />
            <stop offset="100%" stopColor="#431407" />
          </linearGradient>
        </defs>
      </svg>
    )
  }
];

const renderAvatar = (avatarId: string, customAvatar: string | null) => {
  if (customAvatar) {
    return (
      <img 
        src={customAvatar} 
        alt="Avatar" 
        className="w-full h-full object-cover rounded-full" 
        referrerPolicy="no-referrer"
      />
    );
  }
  const avatarObj = AVATARS.find(a => a.id === avatarId) || AVATARS[0];
  return avatarObj.render();
};

const StylishTitle = ({ 
  rawName, 
  activeTmdbDetails, 
  isSeries = false,
  fallbackRating,
  episodeCount
}: { 
  rawName: string; 
  activeTmdbDetails: TmdbDetails | null; 
  isSeries?: boolean; 
  fallbackRating?: string | number;
  episodeCount?: number;
}) => {
  const { title: cleanedLocalTitle } = cleanMediaTitle(rawName);
  const officialTitle = activeTmdbDetails?.title || cleanedLocalTitle || rawName;
  const tags = getLanguageTags(rawName);
  const [logoError, setLogoError] = useState(false);

  const ratingVal = activeTmdbDetails?.rating || fallbackRating;
  const runtimeVal = activeTmdbDetails?.runtime;

  const formatRuntime = (minutes?: number) => {
    if (!minutes) return null;
    if (minutes < 60) return `${minutes}m`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 flex-wrap select-none w-full items-start">
      {/* Official TMDB Synchronized Title Logo or Text */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap items-start">
        {activeTmdbDetails?.logo_url && !logoError ? (
          <motion.img
            src={activeTmdbDetails.logo_url}
            alt={officialTitle}
            className="max-h-16 sm:max-h-24 md:max-h-32 lg:max-h-36 xl:max-h-40 w-auto max-w-[280px] sm:max-w-[380px] md:max-w-[550px] object-contain object-left drop-shadow-[0_6px_20px_rgba(0,0,0,0.9)] select-none self-start"
            onError={() => setLogoError(true)}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-display font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-100 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(6,182,212,0.15)] leading-tight">
            {officialTitle}
          </h2>
        )}

        {/* Rating and Runtime right next to/below the logo */}
        {(ratingVal || isSeries || (!isSeries && runtimeVal)) && (
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-300 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 w-fit shrink-0">
            {ratingVal && (
              <span className="flex items-center gap-1 text-amber-400">
                <Star size={13} className="fill-amber-400 text-amber-400" />
                <span>{ratingVal}</span>
              </span>
            )}
            {ratingVal && (isSeries || (!isSeries && runtimeVal)) && <span className="text-white/20">|</span>}
            {isSeries ? (
              <span className="flex items-center gap-1 text-[#00D1FF]">
                <Tv size={13} />
                <span>{episodeCount ? `Total Episodes: ${episodeCount}` : 'Episodes: Live Feed'}</span>
              </span>
            ) : (
              runtimeVal && (
                <span className="flex items-center gap-1 text-cyan-400">
                  <Clock size={13} />
                  <span>{formatRuntime(runtimeVal)}</span>
                </span>
              )
            )}
          </div>
        )}
      </div>
      
      {/* Beautiful Language Badges */}
      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5 lg:pt-0">
          {tags.map((tag, idx) => {
            const cleanText = tag.replace(/[()\[\]]/g, '').trim();
            return (
              <span 
                key={idx} 
                className="px-2 md:px-2.5 py-1 bg-gradient-to-r from-cyan-500/10 to-cyan-500/5 hover:from-cyan-500/20 hover:to-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[9px] md:text-xs font-bold uppercase tracking-wider rounded-md transition-all duration-300 select-none shadow-[0_0_12px_rgba(6,182,212,0.15)] hover:border-cyan-500/50"
              >
                {cleanText}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

const renderStylishTitle = (
  rawName: string, 
  activeTmdbDetails: TmdbDetails | null, 
  isSeries: boolean = false,
  fallbackRating?: string | number,
  episodeCount?: number
) => {
  return (
    <StylishTitle 
      rawName={rawName} 
      activeTmdbDetails={activeTmdbDetails} 
      isSeries={isSeries} 
      fallbackRating={fallbackRating} 
      episodeCount={episodeCount}
    />
  );
};

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const parseKeysFromUrl = (url: string) => {
  if (!url) return { base: '', keys: '' };
  const pipeIdx = url.indexOf('|');
  if (pipeIdx !== -1) {
    const base = url.substring(0, pipeIdx);
    const drmStr = url.substring(pipeIdx + 1);
    const params = new URLSearchParams(drmStr);
    const license = params.get('drmLicense') || params.get('license') || '';
    return { base, keys: license };
  }
  const questionIdx = url.indexOf('?');
  if (questionIdx !== -1) {
    const base = url.substring(0, questionIdx);
    const searchStr = url.substring(questionIdx + 1);
    if (searchStr.includes('drmScheme') || searchStr.includes('drmLicense')) {
      const params = new URLSearchParams(searchStr);
      const license = params.get('drmLicense') || params.get('license') || '';
      return { base, keys: license };
    }
  }
  return { base: url, keys: '' };
};

const buildUrlWithKeys = (base: string, keys: string) => {
  const trimmedBase = base.trim();
  const trimmedKeys = keys.trim();
  if (!trimmedKeys) return trimmedBase;
  const cleanBase = parseKeysFromUrl(trimmedBase).base;
  return `${cleanBase}|drmScheme=clearkey&drmLicense=${trimmedKeys}`;
};

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
      <>
        <span className="text-cyan-400">{parts[0]}</span>
        <span className="text-white/40 font-normal mx-0.5">{sepFound}</span>
        <span className="text-white">{parts.slice(1).join(sepFound)}</span>
      </>
    );
  }

  if (name.includes(' ')) {
    const parts = name.split(' ');
    return (
      <>
        <span className="text-cyan-400">{parts[0]}</span>
        <span className="text-white font-normal mx-1"> </span>
        <span className="text-white">{parts.slice(1).join(' ')}</span>
      </>
    );
  }

  if (name.length > 3) {
    const splitIndex = Math.min(2, Math.floor(name.length / 2));
    return (
      <>
        <span className="text-cyan-400">{name.substring(0, splitIndex)}</span>
        <span className="text-white">{name.substring(splitIndex)}</span>
      </>
    );
  }

  return <span className="text-cyan-400">{name}</span>;
};

const getResellerKey = () => {
  if (typeof window === 'undefined') return '';
  
  // 1. Try standard URL query params
  let urlParams = new URLSearchParams(window.location.search);
  let ref = urlParams.get('ref') || urlParams.get('reseller');
  if (ref) {
    const key = ref.toLowerCase();
    if (key !== 'sj' && key !== 'www') return key;
  }

  // 2. Try hash query params
  const hash = window.location.hash;
  if (hash && hash.includes('?')) {
    const hashSearch = hash.split('?')[1];
    urlParams = new URLSearchParams(hashSearch);
    ref = urlParams.get('ref') || urlParams.get('reseller');
    if (ref) {
      const key = ref.toLowerCase();
      if (key !== 'sj' && key !== 'www') return key;
    }
  }

  // 3. Try document.referrer (crucial for iframes e.g. Hugging Face spaces embeds)
  try {
    if (document.referrer) {
      const refUrl = new URL(document.referrer);
      const refFromReferrer = refUrl.searchParams.get('ref') || refUrl.searchParams.get('reseller');
      if (refFromReferrer) {
        const key = refFromReferrer.toLowerCase();
        if (key !== 'sj' && key !== 'www') return key;
      }
    }
  } catch (e) {
    // Ignore URL parse errors
  }

  // 4. Try hostname subdomain for custom domains
  const hostname = window.location.hostname;
  if (!hostname) return '';
  const parts = hostname.split('.');
  
  if (
    hostname.includes('run.app') || 
    hostname.includes('hf.space') || 
    hostname.includes('github.io') || 
    hostname.includes('localhost') || 
    hostname.includes('127.0.0.1')
  ) {
    return '';
  }

  if (parts.length > 2) {
    const key = parts[0].toLowerCase();
    if (key !== 'sj' && key !== 'www') {
      return key;
    }
  }
  return '';
};

const guessBrandNameFromKey = (key: string): string => {
  if (!key) return "4K•SJ";
  let guessed = key.replace(/[-_]/g, ' ').toUpperCase();
  if (guessed.endsWith("STORE") && guessed.length > 5 && !guessed.includes(" ")) {
    guessed = guessed.replace("STORE", " STORE");
  }
  return guessed;
};

export default function App() {
  // Reseller states
  const [resellers, setResellers] = useState<any[]>([]);
  const [activeReseller, setActiveReseller] = useState<any | null>(() => {
    if (typeof window === 'undefined') return null;
    const key = getResellerKey();
    if (!key) return null;
    try {
      const cached = localStorage.getItem(`cached_reseller_${key}`);
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });
  const [isResellersLoading, setIsResellersLoading] = useState(true);
  
  const [newReseller, setNewReseller] = useState({
    subdomain: '',
    brand_name: '',
    tagline: '',
    whatsapp_number: '',
    whatsapp_group_link: '',
    logo_url: '',
    server_url: '',
    app_link: '',
    password: '',
    license_type: '1 Year'
  });
  const [editingResellerId, setEditingResellerId] = useState<string | null>(null);

  const [loggedInReseller, setLoggedInReseller] = useState<any | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('logged_in_reseller');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [creds, setCreds] = useState<XtreamCredentials>(() => {
    const saved = localStorage.getItem('iptv_creds');
    const loggedIn = localStorage.getItem('iptv_logged_in') === 'true';
    if (loggedIn && saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.host?.includes('lb-skip.vercel.app') || parsed.host?.includes('4ksjpun-lbff.hf.space') || !parsed.host)) {
          parsed.host = 'https://sjstorehot-lbskip.hf.space';
          localStorage.setItem('iptv_creds', JSON.stringify(parsed));
        }
        return parsed;
      } catch (e) {
        return DEFAULT_CREDENTIALS;
      }
    }
    return DEFAULT_CREDENTIALS;
  });
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('iptv_logged_in') === 'true';
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [profileData, setProfileData] = useState<any>({
    avatarId: 'cinephile',
    customAvatar: null
  });
  const [activeTab, setActiveTab] = useState<'home' | 'movies' | 'series' | 'live' | 'free' | 'fifa'>('home');
  const [activeFreeTab, setActiveFreeTab] = useState<'menu' | 'movies' | 'series' | 'live_events'>('menu');
  const [movieCategories, setMovieCategories] = useState<Category[]>([]);
  const [seriesCategories, setSeriesCategories] = useState<Category[]>([]);
  const [liveCategories, setLiveCategories] = useState<Category[]>([]);
  const [selectedMovieCategory, setSelectedMovieCategory] = useState<string>('0');
  const [selectedSeriesCategory, setSelectedSeriesCategory] = useState<string>('0');
  const [selectedLiveCategory, setSelectedLiveCategory] = useState<string>('0');
  const [isMobileCategoriesOpen, setIsMobileCategoriesOpen] = useState(false);
  const [movieItems, setMovieItems] = useState<Stream[]>([]);
  const [seriesItems, setSeriesItems] = useState<Series[]>([]);
  const [liveItems, setLiveItems] = useState<LiveStream[]>([]);
  const [totalMovieCount, setTotalMovieCount] = useState(0);
  const [totalSeriesCount, setTotalSeriesCount] = useState(0);
  const [totalLiveCount, setTotalLiveCount] = useState(0);
  const [homeData, setHomeData] = useState<{
    popularMovies: any[],
    popularSeries: any[]
  }>(() => {
    const saved = localStorage.getItem('iptv_home_cache');
    return saved ? JSON.parse(saved) : { popularMovies: [], popularSeries: [] };
  });
  const [loadingHome, setLoadingHome] = useState(false);
  const [loadingMovies, setLoadingMovies] = useState(false);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [loadingLive, setLoadingLive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingOnServer, setSearchingOnServer] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Stream | Series | null>(null);
  const [seriesInfo, setSeriesInfo] = useState<any>(null);
  const [movieInfo, setMovieInfo] = useState<any>(null);
  const [tmdbDetails, setTmdbDetails] = useState<TmdbDetails | null>(null);
  const [loadingTmdb, setLoadingTmdb] = useState(false);
  const [isSyncingDetails, setIsSyncingDetails] = useState(false);
  const [syncingItemName, setSyncingItemName] = useState("");
  const [isMinLoadPassed, setIsMinLoadPassed] = useState(true);
  const [trendingMovies, setTrendingMovies] = useState<TmdbTrendingItem[]>([]);
  const [trendingSeries, setTrendingSeries] = useState<TmdbTrendingItem[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const [trendingSelectorData, setTrendingSelectorData] = useState<{
    show: boolean;
    title: string;
    items: any[];
    isSeries: boolean;
  } | null>(null);

  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [playingLiveStream, setPlayingLiveStream] = useState<LiveStream | null>(null);
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);
  const [pendingDownload, setPendingDownload] = useState<{item: any, episodeId?: string, episodeExt?: string} | null>(null);
  const [showPSLPlayer, setShowPSLPlayer] = useState(false);
  const [showIPLPlayer, setShowIPLPlayer] = useState(false);
  const [selectedFreeMovie, setSelectedFreeMovie] = useState<any>(null);
  const [selectedFreeSeries, setSelectedFreeSeries] = useState<any>(null);
  const [playingFreeMovie, setPlayingFreeMovie] = useState<any | null>(null);
  const [playingFreeSeries, setPlayingFreeSeries] = useState<any | null>(null);
  const [freeMovies, setFreeMovies] = useState<any[]>([]);
  const [freeSeries, setFreeSeries] = useState<any[]>([]);
  const [isMoviesLoading, setIsMoviesLoading] = useState(true);
  const [isSeriesLoading, setIsSeriesLoading] = useState(true);
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null);
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);

  // FIFA 2026 States
  const [fifaChannels, setFifaChannels] = useState<any[]>([]);
  const [isFifaChannelsLoading, setIsFifaChannelsLoading] = useState(true);
  const [selectedFifaChannel, setSelectedFifaChannel] = useState<any | null>(null);
  const [playingFifaChannel, setPlayingFifaChannel] = useState<any | null>(null);
  const [showFifaModal, setShowFifaModal] = useState(false);
  const [editingFifaChannelId, setEditingFifaChannelId] = useState<string | null>(null);
  const [newFifaChannel, setNewFifaChannel] = useState({
    name: '',
    play_url: '',
    is_mpd: false,
    is_embed: false,
    is_webpage: false,
    sandbox_disabled: false,
    status: 'Live',
    order: '',
    stream_id: '',
    feed_type: 'iptv', // 'iptv' or 'custom'
    is_premium: true
  });

  // FIFA Drag and Drop Reordering States
  const [draggedFifaIndex, setDraggedFifaIndex] = useState<number | null>(null);
  const [draggedOverFifaIndex, setDraggedOverFifaIndex] = useState<number | null>(null);

  const [selectedLiveEvent, setSelectedLiveEvent] = useState<any>(null);
  const [playingLiveEvent, setPlayingLiveEvent] = useState<any | null>(null);
  const [selectedLiveEventChannel, setSelectedLiveEventChannel] = useState<any | null>(null);
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [isLiveEventsLoading, setIsLiveEventsLoading] = useState(true);
  const [editingLiveEventId, setEditingLiveEventId] = useState<string | null>(null);
  const [activeLiveChannelIndex, setActiveLiveChannelIndex] = useState<number>(0);
  const [newLiveEvent, setNewLiveEvent] = useState<{
    name: string;
    poster_url: string;
    channels: Array<{ name: string; play_url: string; is_embed?: boolean; is_mpd?: boolean; is_webpage?: boolean; sandbox_disabled?: boolean; drm_license_url?: string }>;
  }>({
    name: '',
    poster_url: '',
    channels: [{ name: 'Urdu', play_url: '', is_embed: false, is_mpd: false, is_webpage: false, sandbox_disabled: false }]
  });

  const [newFreeMovie, setNewFreeMovie] = useState({ tmdb_id: '', name: '', poster_url: '', play_url: '', download_url: '', is_embed: false, is_webpage: false, password: '' });
  const [newFreeSeries, setNewFreeSeries] = useState({ 
    tmdb_id: '', 
    name: '', 
    poster_url: '', 
    play_url: '', 
    download_url: '', 
    playlist_url: '', 
    is_embed: false, 
    is_webpage: false, 
    password: '', 
    episodes: [] as Array<{ id: string, season: string, episode_num: string, title: string, play_url: string, download_url?: string }>
  });
  const [manualEpisodeInput, setManualEpisodeInput] = useState({ season: '1', episode_num: '1', title: '', play_url: '', download_url: '' });
  const [passwordProtectedItem, setPasswordProtectedItem] = useState<{ item: any; type: 'movie' | 'series'; callback: () => void } | null>(null);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [isFetchingTmdb, setIsFetchingTmdb] = useState(false);
  const [freeSeriesEpisodesMap, setFreeSeriesEpisodesMap] = useState<Record<string, any[]> | null>(null);
  const [selectedFreeSeason, setSelectedFreeSeason] = useState<string | null>(null);
  const [freeCopiedId, setFreeCopiedId] = useState<string | null>(null);
  const [playingFreeEpisode, setPlayingFreeEpisode] = useState<any>(null);
  const [freeSeriesActiveUrl, setFreeSeriesActiveUrl] = useState<string>('');
  const [isM3uLoading, setIsM3uLoading] = useState(false);
  const [showFreeDownloadModal, setShowFreeDownloadModal] = useState(false);
  const [freeDownloadModalEpisodes, setFreeDownloadModalEpisodes] = useState<any[]>([]);
  const [isFreeDownloadLoading, setIsFreeDownloadLoading] = useState(false);
  const [playingTrailerUrl, setPlayingTrailerUrl] = useState<string | null>(null);
  const [selectedPslLanguage, setSelectedPslLanguage] = useState<'urdu' | 'english' | 'custom' | null>(null);
  const [pslUrlUrdu, setPslUrlUrdu] = useState('');
  const [pslUrlEnglish, setPslUrlEnglish] = useState('');
  const [pslChannel3Name, setPslChannel3Name] = useState('Channel 3');
  const [pslChannel3Url, setPslChannel3Url] = useState('');
  const [pslChannel3IsEmbed, setPslChannel3IsEmbed] = useState(false);
  const [pslChannel3ShowLiveIcon, setPslChannel3ShowLiveIcon] = useState(true);
  const [iplUrl, setIplUrl] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [appSettings, setAppSettings] = useState({
    psl_enabled: true,
    ipl_enabled: true,
    free_movies_enabled: true,
    free_series_enabled: true,
    live_events_enabled: true,
    anti_popup_enabled: true,
    psl_title: 'PSL',
    ipl_title: 'IPL',
    free_movies_title: 'FREE CINEMA',
    free_series_title: 'FREE BINGE',
    live_events_title: 'LIVE EVENTS'
  });
  const [newAppSettings, setNewAppSettings] = useState(appSettings);
  const [isAntiPopupActive, setIsAntiPopupActive] = useState(() => {
    const saved = localStorage.getItem('anti_popup_enabled');
    return saved !== 'false';
  });

  // Reactive reseller helper values
  const currentBrandName = activeReseller?.brand_name || (getResellerKey() ? guessBrandNameFromKey(getResellerKey()) : "4K•SJ");
  const currentTagline = activeReseller?.tagline || (getResellerKey() ? "Loading Premium Experience..." : "Premium Experience");
  const currentServerHost = activeReseller?.server_url || "https://sjstorehot-lbskip.hf.space";
  
  // If an active reseller is matched, we MUST NOT fall back to the main admin's details.
  // We keep it empty if the reseller hasn't specified their whatsapp_number or set it to 'N/A'.
  const currentWhatsappNumber = activeReseller
    ? (activeReseller.whatsapp_number && activeReseller.whatsapp_number !== 'N/A' ? activeReseller.whatsapp_number : '')
    : "923161611304";

  // If an active reseller is matched, we keep it empty if the reseller hasn't specified their whatsapp_group_link or set it to 'N/A'.
  const currentWhatsappGroupLink = activeReseller
    ? (activeReseller.whatsapp_group_link && activeReseller.whatsapp_group_link !== 'N/A' ? activeReseller.whatsapp_group_link : '')
    : "https://chat.whatsapp.com/I1UPXfxwMDR6XhG1DNg2lE";

  const getResellerAdjustedUrl = (url: string, action: string = 'play') => {
    if (!url) return '';
    // If there is an active reseller with a custom server URL, replace the default host
    if (activeReseller?.server_url) {
      const resellerHost = activeReseller.server_url.replace(/\/$/, ''); // strip trailing slash
      return url
        .replace(/https:\/\/sjstorehot-lbskip\.hf\.space/g, resellerHost)
        .replace(/http:\/\/sjstorehot-lbskip\.hf\.space/g, resellerHost);
    }
    return url;
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).activeResellerBrandName = activeReseller?.brand_name || '';
      (window as any).activeResellerServerUrl = activeReseller?.server_url || '';
    }
  }, [activeReseller]);

  // Real-time Firestore Sync for Resellers
  useEffect(() => {
    const q = query(collection(db, 'resellers'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setResellers(list);
      setIsResellersLoading(false);

      // Determine the active reseller
      const resellerKey = getResellerKey();
      const currentHost = window.location.hostname.toLowerCase();
      
      const matched = list.find(r => 
        (r.subdomain && r.subdomain.toLowerCase() === resellerKey) || 
        (r.subdomain && r.subdomain.toLowerCase() === currentHost)
      );
      
      if (matched) {
        setActiveReseller(matched);
        if (typeof window !== 'undefined') {
          (window as any).activeResellerServerUrl = matched.server_url || '';
          (window as any).activeResellerBrandName = matched.brand_name || '';
          if (resellerKey) {
            localStorage.setItem(`cached_reseller_${resellerKey}`, JSON.stringify(matched));
          }
        }
      } else {
        setActiveReseller(null);
        if (typeof window !== 'undefined') {
          (window as any).activeResellerServerUrl = '';
          (window as any).activeResellerBrandName = '';
          if (resellerKey) {
            localStorage.removeItem(`cached_reseller_${resellerKey}`);
          }
        }
      }
    }, (error) => {
      console.error("Firestore Error (Resellers):", error);
      setIsResellersLoading(false);
      handleFirestoreError(error, OperationType.GET, 'resellers');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      setIsAntiPopupActive(localStorage.getItem('anti_popup_enabled') !== 'false');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleAntiPopup = () => {
    const next = !isAntiPopupActive;
    localStorage.setItem('anti_popup_enabled', next ? 'true' : 'false');
    setIsAntiPopupActive(next);
    window.dispatchEvent(new Event('storage'));
  };
  const [showWebPlayer, setShowWebPlayer] = useState(false);
  const [webPlayUrl, setWebPlayUrl] = useState('');
  const [webPlayTitle, setWebPlayTitle] = useState('');
  const [playingEpisode, setPlayingEpisode] = useState<any>(null);

  const handleCloseWebPlayer = () => {
    setShowWebPlayer(false);
    setPlayingEpisode(null);
  };

  const getNextEpisode = (currentEp: any) => {
    if (!currentEp || !seriesInfo || !seriesInfo.episodes) return null;
    const currentSeason = currentEp.season || selectedSeason;
    if (!currentSeason) return null;

    const currentSeasonEps = seriesInfo.episodes[currentSeason];
    if (!currentSeasonEps) return null;

    // Find current episode index in currentSeasonEps
    const currentIndex = currentSeasonEps.findIndex(
      (ep: any) => String(ep.id) === String(currentEp.id)
    );

    if (currentIndex !== -1 && currentIndex < currentSeasonEps.length - 1) {
      return {
        episode: currentSeasonEps[currentIndex + 1],
        season: currentSeason
      };
    }

    // Try next season
    const seasons = Object.keys(seriesInfo.episodes).sort((a, b) => Number(a) - Number(b));
    const currentSeasonIdx = seasons.indexOf(currentSeason);
    if (currentSeasonIdx !== -1 && currentSeasonIdx < seasons.length - 1) {
      const nextSeason = seasons[currentSeasonIdx + 1];
      const nextSeasonEps = seriesInfo.episodes[nextSeason];
      if (nextSeasonEps && nextSeasonEps.length > 0) {
        return {
          episode: nextSeasonEps[0],
          season: nextSeason
        };
      }
    }

    return null;
  };

  const handlePlayNextEpisode = () => {
    const nextEpInfo = getNextEpisode(playingEpisode);
    if (nextEpInfo) {
      const { episode, season } = nextEpInfo;
      if (season !== selectedSeason) {
        setSelectedSeason(season);
      }
      handleAction('web_play', selectedItem, episode.id, episode.container_extension);
    }
  };

  const handleSelectEpisode = (episode: any, seasonNum: string) => {
    if (seasonNum !== selectedSeason) {
      setSelectedSeason(seasonNum);
    }
    handleAction('web_play', selectedItem, episode.id, episode.container_extension);
  };

  const handlePlayFullSeries = () => {
    if (!seriesInfo || !seriesInfo.episodes) return;
    
    // Sort seasons numerically
    const seasons = Object.keys(seriesInfo.episodes).sort((a, b) => Number(a) - Number(b));
    if (seasons.length === 0) return;
    
    // Use selected season if it has episodes, otherwise resort to first season
    const targetSeason = (selectedSeason && seriesInfo.episodes[selectedSeason]?.length > 0)
      ? selectedSeason
      : seasons[0];
      
    const episodes = seriesInfo.episodes[targetSeason];
    if (episodes && episodes.length > 0) {
      const firstEp = episodes[0];
      if (targetSeason !== selectedSeason) {
        setSelectedSeason(targetSeason);
      }
      handleAction('web_play', selectedItem, firstEp.id, firstEp.container_extension);
    }
  };

  // Helper to determine if the bottom navigation should be hidden
  const shouldHideNav = !!(
    selectedItem || 
    selectedFreeMovie || 
    selectedFreeSeries || 
    selectedLiveEvent ||
    playingLiveEvent ||
    showPSLPlayer || 
    showIPLPlayer || 
    showWebPlayer ||
    showLoginModal ||
    showAdminLogin ||
    showDownloadConfirm ||
    showProfileModal ||
    isMobileCategoriesOpen
  );
  const [newPslUrlUrdu, setNewPslUrlUrdu] = useState(pslUrlUrdu);
  const [newPslUrlEnglish, setNewPslUrlEnglish] = useState(pslUrlEnglish);
  const [newPslChannel3Name, setNewPslChannel3Name] = useState(pslChannel3Name);
  const [newPslChannel3Url, setNewPslChannel3Url] = useState(pslChannel3Url);
  const [newPslChannel3IsEmbed, setNewPslChannel3IsEmbed] = useState(pslChannel3IsEmbed);
  const [newPslChannel3ShowLiveIcon, setNewPslChannel3ShowLiveIcon] = useState(pslChannel3ShowLiveIcon);
  const [newIplUrl, setNewIplUrl] = useState(iplUrl);
  const [activeAdminTab, setActiveAdminTab] = useState<'psl' | 'ipl' | 'free_movies' | 'free_series' | 'live_events' | 'app' | 'fifa' | 'analytics' | 'resellers'>('psl');
  
  // Analytics State Hooks
  const [userActivities, setUserActivities] = useState<any[]>([]);
  const [mediaStats, setMediaStats] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsSearchQuery, setAnalyticsSearchQuery] = useState('');
  const [analyticsCategoryFilter, setAnalyticsCategoryFilter] = useState<'all' | 'movie' | 'series' | 'live_event' | 'fifa'>('all');
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'users' | 'media'>('media');

  // Analytics Tracking Functions
  const trackUserActivity = async (username: string) => {
    if (!username) return;
    const lowerUsername = username.toLowerCase();
    console.log("[Analytics] Tracking user activity for:", lowerUsername);
    try {
      const userDocRef = doc(db, 'user_activity', lowerUsername);
      const docSnap = await getDoc(userDocRef).catch((e) => {
        console.warn("[Analytics] Offline cache fallback for user activity:", e);
        return null;
      });
      
      let loginCount = 1;
      let firstActive = new Date().toISOString();
      
      if (docSnap && docSnap.exists()) {
        const data = docSnap.data();
        loginCount = (data.loginCount || 0) + 1;
        firstActive = data.firstActive || firstActive;
      }
      
      await setDoc(userDocRef, {
        username: lowerUsername,
        lastLogin: new Date().toISOString(),
        loginCount,
        firstActive,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log("[Analytics] Successfully saved login activity for:", lowerUsername);
    } catch (error) {
      console.error("Analytics Error (trackUserActivity):", error);
    }
  };

  const trackMediaPlayback = async (
    item: any, 
    category: 'movie' | 'series' | 'live_event' | 'fifa', 
    channelName?: string
  ) => {
    if (!item) return;
    
    const username = (creds && creds.username) ? creds.username.toLowerCase() : 'anonymous';
    const itemId = String(item.id || item.stream_id || item.series_id || item.channelId || 'unknown_item');
    let itemName = item.name || item.title || 'Unknown Title';
    
    if (category === 'live_event' && channelName) {
      itemName = `${itemName} (${channelName})`;
    } else if (category === 'series' && channelName) {
      itemName = `${itemName} (${channelName})`;
    }
    
    const statId = `${category}_${itemId}`;
    console.log("[Analytics] Recording playback for:", itemName, "under ID:", statId, "by user:", username);
    
    try {
      // 1. Log Click
      await addDoc(collection(db, 'playback_logs'), {
        username,
        itemId,
        itemName,
        category,
        channelName: channelName || null,
        timestamp: new Date().toISOString()
      }).catch(err => console.error("[Analytics] Error logging click to playback_logs:", err));

      // 2. Increment stats
      const statsDocRef = doc(db, 'playback_stats', statId);
      const docSnap = await getDoc(statsDocRef).catch((e) => {
        console.warn("[Analytics] Offline cache/read fallback for stats:", e);
        return null;
      });
      
      let totalPlays = 1;
      let usersMap: Record<string, boolean> = {};
      
      if (docSnap && docSnap.exists()) {
        const data = docSnap.data();
        totalPlays = (data.totalPlays || 0) + 1;
        usersMap = data.users || {};
      }
      
      usersMap[username] = true;
      
      await setDoc(statsDocRef, {
        itemId,
        itemName,
        category,
        totalPlays,
        users: usersMap,
        lastPlayed: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log("[Analytics] Successfully saved statistics increment for:", itemName);
    } catch (error) {
      console.error("Analytics Error (trackMediaPlayback):", error);
    }
  };

  // Real-time Firestore Sync for Analytics data
  useEffect(() => {
    if (!isAdminLoggedIn) return;
    
    setAnalyticsLoading(true);
    // 1. User activities query
    const userActQuery = query(collection(db, 'user_activity'), orderBy('lastLogin', 'desc'));
    const unsubscribeUsers = onSnapshot(userActQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data());
      setUserActivities(list);
    }, (err) => {
      console.error("Error loading user activities", err);
    });

    // 2. Playback/media stats query
    const statsQuery = query(collection(db, 'playback_stats'), orderBy('totalPlays', 'desc'));
    const unsubscribeStats = onSnapshot(statsQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data());
      setMediaStats(list);
      setAnalyticsLoading(false);
    }, (err) => {
      console.error("Error loading playback stats", err);
      setAnalyticsLoading(false);
    });

    return () => {
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeStats) unsubscribeStats();
    };
  }, [isAdminLoggedIn]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showIntro, setShowIntro] = useState(() => {
    return localStorage.getItem('has_seen_intro') !== 'true';
  });
  const [introProgress, setIntroProgress] = useState(0);
  const [visibleCount, setVisibleCount] = useState(40);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Connection Test
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDoc(doc(db, 'settings', 'psl'));
        console.log("Firestore Connection Test: Success");
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.warn("Firestore Connection Test: Using offline local cache");
        } else {
          console.warn("Firestore Connection Test: Cache-enabled or offline mode", error);
        }
      }
    };
    testConnection();
  }, []);

  // Real-time Firestore Sync for App Settings
  useEffect(() => {
    const appDocRef = doc(db, 'settings', 'app');
    const unsubscribe = onSnapshot(appDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const updated = {
          psl_enabled: data.psl_enabled ?? true,
          ipl_enabled: data.ipl_enabled ?? true,
          free_movies_enabled: data.free_movies_enabled ?? true,
          free_series_enabled: data.free_series_enabled ?? true,
          live_events_enabled: data.live_events_enabled ?? true,
          anti_popup_enabled: data.anti_popup_enabled ?? true,
          psl_title: data.psl_title || 'PSL',
          ipl_title: data.ipl_title || 'IPL',
          free_movies_title: data.free_movies_title || 'FREE CINEMA',
          free_series_title: data.free_series_title || 'FREE BINGE',
          live_events_title: data.live_events_title || 'LIVE EVENTS'
        };
        setAppSettings(updated);
        setNewAppSettings(updated);
      }
    }, (error) => {
      console.error("Firestore Error (App Settings):", error);
    });

    return () => unsubscribe();
  }, []);

  // Real-time Firestore Sync for PSL URL
  useEffect(() => {
    const pslDocRef = doc(db, 'settings', 'psl');
    const unsubscribe = onSnapshot(pslDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.psl_live_url_urdu) {
          setPslUrlUrdu(data.psl_live_url_urdu);
          setNewPslUrlUrdu(data.psl_live_url_urdu);
        }
        if (data.psl_live_url_english) {
          setPslUrlEnglish(data.psl_live_url_english);
          setNewPslUrlEnglish(data.psl_live_url_english);
        }
        if (data.psl_channel3_name) {
          setPslChannel3Name(data.psl_channel3_name);
          setNewPslChannel3Name(data.psl_channel3_name);
        }
        if (data.psl_channel3_url) {
          setPslChannel3Url(data.psl_channel3_url);
          setNewPslChannel3Url(data.psl_channel3_url);
        }
        setPslChannel3IsEmbed(!!data.psl_channel3_is_embed);
        setNewPslChannel3IsEmbed(!!data.psl_channel3_is_embed);
        if (data.psl_channel3_show_live_icon !== undefined) {
          setPslChannel3ShowLiveIcon(data.psl_channel3_show_live_icon);
          setNewPslChannel3ShowLiveIcon(data.psl_channel3_show_live_icon);
        }
      }
    }, (error) => {
      console.error("Firestore Error (PSL):", error);
    });

    return () => unsubscribe();
  }, []);

  // Real-time Firestore Sync for IPL URL
  useEffect(() => {
    const iplDocRef = doc(db, 'settings', 'ipl');
    const unsubscribe = onSnapshot(iplDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.ipl_live_url) {
          setIplUrl(data.ipl_live_url);
          setNewIplUrl(data.ipl_live_url);
        }
      }
    }, (error) => {
      console.error("Firestore Error (IPL):", error);
    });

    return () => unsubscribe();
  }, []);

  // Real-time Firestore Sync for Free Movies
  useEffect(() => {
    const freeMoviesRef = collection(db, 'free_movies');
    const q = query(freeMoviesRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const movies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFreeMovies(movies);
      setIsMoviesLoading(false);
    }, (error) => {
      console.error("Firestore Error (Free Movies):", error);
      setIsMoviesLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time Firestore Sync for Free Web Series
  useEffect(() => {
    const freeSeriesRef = collection(db, 'free_series');
    const q = query(freeSeriesRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const series = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFreeSeries(series);
      setIsSeriesLoading(false);
    }, (error) => {
      console.error("Firestore Error (Free Series):", error);
      setIsSeriesLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time Firestore Sync for Live Events
  useEffect(() => {
    const liveEventsRef = collection(db, 'live_events');
    const q = query(liveEventsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLiveEvents(dbEvents);
      setIsLiveEventsLoading(false);
    }, (error) => {
      console.error("Firestore Error (Live Events):", error);
      setIsLiveEventsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time Firestore Sync for FIFA Channels
  useEffect(() => {
    const fifaChannelsRef = collection(db, 'fifa_channels');
    const q = query(fifaChannelsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbChannels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      dbChannels.sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : (a.order !== undefined && a.order !== null && a.order !== '' ? Number(a.order) : 999999);
        const orderB = typeof b.order === 'number' ? b.order : (b.order !== undefined && b.order !== null && b.order !== '' ? Number(b.order) : 999999);
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setFifaChannels(dbChannels);
      setIsFifaChannelsLoading(false);
    }, (error) => {
      console.error("Firestore Error (FIFA Channels):", error);
      setIsFifaChannelsLoading(false);
      handleFirestoreError(error, OperationType.GET, 'fifa_channels');
    });

    return () => unsubscribe();
  }, []);

  // Test connection
  useEffect(() => {
    const testConnection = async () => {
      try {
        const pslDocRef = doc(db, 'settings', 'psl');
        await getDoc(pslDocRef);
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.warn("Firebase connection operating in offline/cached mode.");
        }
      }
    };
    testConnection();
  }, []);

  const pslOptions = useMemo(() => {
    let url = '';
    let isEmbed = false;

    if (selectedPslLanguage === 'urdu') {
      url = pslUrlUrdu;
    } else if (selectedPslLanguage === 'english') {
      url = pslUrlEnglish;
    } else if (selectedPslLanguage === 'custom') {
      url = pslChannel3Url;
      isEmbed = pslChannel3IsEmbed;
    }

    // Ensure .ts for Live TV if not an embed and not already present
    if (url && !isEmbed && !url.toLowerCase().includes('.m3u8') && !url.toLowerCase().includes('.mp4') && !url.toLowerCase().includes('.mkv') && !url.toLowerCase().includes('.ts')) {
      url = url.endsWith('/') ? `${url.slice(0, -1)}.ts` : `${url}.ts`;
    }

    const isMp4 = url.toLowerCase().includes('.mp4');
    const isHls = url.toLowerCase().includes('.m3u8');
    const isTs = url.toLowerCase().includes('.ts');
    
    return {
      autoplay: true,
      controls: true,
      responsive: true,
      fluid: false,
      fill: true,
      preload: 'auto',
      is_embed: isEmbed,
      skipProxy: true,
      sources: [{
        src: url,
        type: isHls ? 'application/x-mpegURL' : (isMp4 ? 'video/mp4' : (isTs ? 'video/mp2t' : 'video/mp4'))
      }]
    };
  }, [pslUrlUrdu, pslUrlEnglish, pslChannel3Url, pslChannel3IsEmbed, selectedPslLanguage]);

  const iplOptions = useMemo(() => {
    let url = iplUrl;
    // Ensure .ts for Live TV if not already present
    if (url && !url.toLowerCase().includes('.m3u8') && !url.toLowerCase().includes('.mp4') && !url.toLowerCase().includes('.mkv') && !url.toLowerCase().includes('.ts')) {
      url = url.endsWith('/') ? `${url.slice(0, -1)}.ts` : `${url}.ts`;
    }

    const isMp4 = url.toLowerCase().includes('.mp4');
    const isHls = url.toLowerCase().includes('.m3u8');
    const isTs = url.toLowerCase().includes('.ts');
    
    return {
      autoplay: true,
      controls: true,
      responsive: true,
      fluid: false,
      fill: true,
      preload: 'auto',
      skipProxy: true,
      sources: [{
        src: url,
        type: isHls ? 'application/x-mpegURL' : (isMp4 ? 'video/mp4' : (isTs ? 'video/mp2t' : 'video/mp4'))
      }]
    };
  }, [iplUrl]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'sajid122') {
      setIsAdminLoggedIn(true);
      setLoggedInReseller(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('logged_in_reseller');
      }
      setShowAdminLogin(false);
      setAdminPassword('');
    } else {
      // Find matching reseller by password
      const matchedReseller = resellers.find(r => r.password && r.password.trim() !== '' && r.password === adminPassword);
      if (matchedReseller) {
        setLoggedInReseller(matchedReseller);
        setIsAdminLoggedIn(false);
        if (typeof window !== 'undefined') {
          localStorage.setItem('logged_in_reseller', JSON.stringify(matchedReseller));
        }
        setShowAdminLogin(false);
        setAdminPassword('');
      } else {
        alert('Invalid password');
      }
    }
  };

  const handleUpdateUrl = async () => {
    try {
      if (activeAdminTab === 'app') {
        const docRef = doc(db, 'settings', 'app');
        await setDoc(docRef, { ...newAppSettings, updatedAt: new Date().toISOString() });
        alert("App Settings Updated Globally!");
        return;
      }

      const docId = activeAdminTab === 'psl' ? 'psl' : 'ipl';
      const docRef = doc(db, 'settings', docId);
      const data = activeAdminTab === 'psl' 
        ? { 
            psl_live_url_urdu: newPslUrlUrdu, 
            psl_live_url_english: newPslUrlEnglish, 
            psl_channel3_name: newPslChannel3Name,
            psl_channel3_url: newPslChannel3Url,
            psl_channel3_is_embed: newPslChannel3IsEmbed,
            psl_channel3_show_live_icon: newPslChannel3ShowLiveIcon,
            updatedAt: new Date().toISOString() 
          }
        : { ipl_live_url: newIplUrl, updatedAt: new Date().toISOString() };
      
      await setDoc(docRef, data);
      alert(`${activeAdminTab.toUpperCase()} URL Updated Globally!`);
    } catch (err: any) {
      console.error("Update failed", err);
      alert(`Failed to update. Error: ${err.message}`);
    }
  };

  // Fetch series or movie info when a series or movie is selected
  useEffect(() => {
    if (selectedItem) {
      if ('series_id' in selectedItem) {
        const fetchInfo = async () => {
          setLoadingInfo(true);
          try {
            const info = await xtreamApi.getSeriesInfo(creds, (selectedItem as Series).series_id);
            setSeriesInfo(info);
            // Default to first season
            if (info.seasons && info.seasons.length > 0) {
              setSelectedSeason(info.seasons[0].season_number.toString());
            } else if (info.episodes && Object.keys(info.episodes).length > 0) {
              setSelectedSeason(Object.keys(info.episodes)[0]);
            }
          } catch (err) {
            console.error("Failed to fetch series info", err);
          } finally {
            setLoadingInfo(false);
          }
        };
        fetchInfo();
        setMovieInfo(null);
      } else if ('stream_id' in selectedItem && (selectedItem as any).stream_type !== 'live') {
        const fetchInfo = async () => {
          setLoadingInfo(true);
          try {
            const info = await xtreamApi.getMovieInfo(creds, (selectedItem as any).stream_id);
            setMovieInfo(info);
          } catch (err) {
            console.error("Failed to fetch movie info", err);
          } finally {
            setLoadingInfo(false);
          }
        };
        fetchInfo();
        setSeriesInfo(null);
        setSelectedSeason(null);
      } else {
        setSeriesInfo(null);
        setMovieInfo(null);
        setSelectedSeason(null);
      }
    } else {
      setSeriesInfo(null);
      setMovieInfo(null);
      setSelectedSeason(null);
    }
  }, [selectedItem, creds]);

  // Fetch TMDB metadata on selectedItem, selectedFreeMovie, or selectedFreeSeries change
  useEffect(() => {
    const activeItem = selectedItem || selectedFreeMovie || selectedFreeSeries;
    if (activeItem) {
      const isSeries = !!selectedFreeSeries || (selectedItem && 'series_id' in selectedItem);
      const isLive = selectedItem && 'stream_type' in selectedItem && (selectedItem as any).stream_type === 'live';
      
      if (isLive) {
        setTmdbDetails(null);
        return;
      }

      // Check synchronous cache first to avoid state layout flicker
      let preFetchedDetails = null;
      if (activeItem && 'tmdb_id' in activeItem && activeItem.tmdb_id) {
        preFetchedDetails = getStoredTmdbDetailsById(activeItem.tmdb_id, isSeries);
      } else {
        preFetchedDetails = getStoredTmdbDetails(activeItem.name, isSeries);
      }

      if (preFetchedDetails) {
        setTmdbDetails(preFetchedDetails);
        setLoadingTmdb(false);
        return;
      }

      const fetchTmdb = async () => {
        setLoadingTmdb(true);
        try {
          let details = null;
          if (activeItem && 'tmdb_id' in activeItem && activeItem.tmdb_id) {
            details = await fetchTmdbDetailsById(activeItem.tmdb_id, isSeries);
          } else {
            details = await fetchTmdbDetails(activeItem.name, isSeries);
          }
          setTmdbDetails(details);
        } catch (err) {
          console.error("Failed to fetch TMDB details:", err);
          setTmdbDetails(null);
        } finally {
          setLoadingTmdb(false);
        }
      };
      fetchTmdb();
    } else {
      setTmdbDetails(null);
    }
  }, [selectedItem, selectedFreeMovie, selectedFreeSeries]);

  // Listen for Escape key to close the trailer overlay player
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPlayingTrailerUrl(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Synchronize favorites from Firestore
  useEffect(() => {
    if (!isLoggedIn || !creds || !creds.username) {
      setFavorites([]);
      return;
    }

    const favoritesRef = collection(db, 'favorites');
    const q = query(favoritesRef, where('username', '==', creds.username.toLowerCase()));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setFavorites(docs);
    }, (error) => {
      console.error("Error subscribing to favorites:", error);
    });

    return () => unsubscribe();
  }, [isLoggedIn, creds]);

  // Synchronize user profile from Firestore
  useEffect(() => {
    if (!isLoggedIn || !creds || !creds.username) {
      setProfileData({ avatarId: 'cinephile', customAvatar: null });
      return;
    }

    const profileRef = doc(db, 'user_profiles', creds.username.toLowerCase());
    const unsubscribe = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfileData({
          avatarId: data.avatarId || 'cinephile',
          customAvatar: data.customAvatar || null,
          username: data.username || creds.username
        });
      } else {
        setProfileData({ avatarId: 'cinephile', customAvatar: null });
      }
    }, (error) => {
      console.error("Error subscribing to profile details:", error);
    });

    return () => unsubscribe();
  }, [isLoggedIn, creds]);

  const updateProfile = async (avatarId: string, customAvatar: string | null) => {
    if (!isLoggedIn || !creds || !creds.username) return;
    try {
      const docRef = doc(db, 'user_profiles', creds.username.toLowerCase());
      await setDoc(docRef, {
        username: creds.username.toLowerCase(),
        avatarId,
        customAvatar,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error("Failed to update profile:", e);
    }
  };

  const handleCustomAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800 * 1024) { // limit to ~800KB for firestore document safety
      alert("Image is too large. Please select an image smaller than 800 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      if (base64) {
        await updateProfile('custom', base64);
      }
    };
    reader.onerror = (error) => {
      console.error("Error reading file:", error);
    };
    reader.readAsDataURL(file);
  };

  const [error, setError] = useState<string | null>(null);
  const isInitialMount = React.useRef(true);

  // Initialize data
  useEffect(() => {
    const initData = async () => {
      setLoadingHome(true);
      setError(null);
      setIntroProgress(5);

      try {
        // 0. Verify credentials first
        try {
          const loginRes = await xtreamApi.login(creds);
          if (loginRes) {
            if (loginRes.user_info) setUserInfo(loginRes.user_info);
            if (loginRes.server_info) setServerInfo(loginRes.server_info);
            // Track session login on mount
            if (creds && creds.username) {
              const sessionKey = `tracked_session_${creds.username.toLowerCase()}`;
              if (!sessionStorage.getItem(sessionKey)) {
                trackUserActivity(creds.username);
                sessionStorage.setItem(sessionKey, 'true');
              }
            }
          }
          setIntroProgress(15);
        } catch (loginErr) {
          console.warn("Login verification failed:", loginErr);
        }

        // 1. Fetch categories
        const [mCats, sCats, lCats] = await Promise.all([
          xtreamApi.getMovieCategories(creds),
          xtreamApi.getSeriesCategories(creds),
          xtreamApi.getLiveCategories(creds)
        ]).catch(err => {
          console.error("Failed to fetch categories", err);
          return [[], [], []];
        });
        
        setMovieCategories([{ category_id: '0', category_name: 'All Movies', parent_id: 0 }, ...mCats]);
        setSeriesCategories([{ category_id: '0', category_name: 'All Series', parent_id: 0 }, ...sCats]);
        setLiveCategories([{ category_id: '0', category_name: 'All Channels', parent_id: 0 }, ...lCats]);
        setIntroProgress(35);

        // 2. Fetch Home Data (Movies & Series sequentially to avoid 429)
        setLoadingMovies(true);
        let mItems: Stream[] = [];
        try {
          mItems = await xtreamApi.getMovies(creds, '0');
          const sortedMItems = [...mItems].sort((a, b) => (parseInt(b.added) || 0) - (parseInt(a.added) || 0));
          setMovieItems(sortedMItems);
          setTotalMovieCount(mItems.length);
          setIntroProgress(55);
        } catch (mErr) {
          console.error("Failed to fetch movies", mErr);
        } finally {
          setLoadingMovies(false);
        }

        // Small delay between heavy requests
        await new Promise(resolve => setTimeout(resolve, 500));

        setLoadingSeries(true);
        let sItems: Series[] = [];
        try {
          sItems = await xtreamApi.getSeries(creds, '0');
          const sortedSItems = [...sItems].sort((a, b) => (parseInt(b.last_modified) || 0) - (parseInt(a.last_modified) || 0));
          setSeriesItems(sortedSItems);
          setTotalSeriesCount(sItems.length);
          setIntroProgress(75);
        } catch (sErr) {
          console.error("Failed to fetch series", sErr);
        } finally {
          setLoadingSeries(false);
        }

        // Live items are fetched only when tab active or after a longer delay
        setIntroProgress(90);

        // 3. Set Home Data
        if (mItems.length > 0 || sItems.length > 0) {
          const sortedMovies = [...mItems].sort((a, b) => (parseInt(b.added) || 0) - (parseInt(a.added) || 0));
          const sortedSeries = [...sItems].sort((a, b) => (parseInt(b.last_modified) || 0) - (parseInt(a.last_modified) || 0));

          const newData = {
            popularMovies: sortedMovies.slice(0, 20),
            popularSeries: sortedSeries.slice(0, 20)
          };
          
          setHomeData(newData);
          localStorage.setItem('iptv_home_cache', JSON.stringify(newData));
          setIntroProgress(100);
        } else if (homeData.popularMovies.length === 0) {
          // If completely empty after wait, show error
          if (!loadingMovies && !loadingSeries) {
            setError("No content found on the server. Please check your IPTV subscription.");
          }
          setIntroProgress(100);
        }
      } catch (err: any) {
        console.error("Critical failure during initialization", err);
        setError(err.message || "Failed to connect to IPTV server.");
        setIntroProgress(100);
      } finally {
        setLoadingHome(false);
      }
    };

    initData();
    isInitialMount.current = false;
  }, [creds]);

  // Fetch Trending Movies & TV Series from TMDB
  useEffect(() => {
    if (!creds) return;
    const loadTrendingContent = async () => {
      setLoadingTrending(true);
      try {
        const [movies, series] = await Promise.all([
          fetchTrendingMovies(),
          fetchTrendingSeries()
        ]);
        setTrendingMovies(movies);
        setTrendingSeries(series);
      } catch (err) {
        console.error("Failed to load TMDB trending content", err);
      } finally {
        setLoadingTrending(false);
      }
    };
    loadTrendingContent();
  }, [creds]);

  // Fetch Movie items when category changes
  useEffect(() => {
    if (selectedMovieCategory === 'favorites') return;
    // Skip if it's initial mount and category is 0 (already fetched in initData)
    // Also skip if we already have items for category 0
    if (selectedMovieCategory === '0' && movieItems.length > 0) return;

    const fetchMovies = async () => {
      setLoadingMovies(true);
      setError(null);
      try {
        const data = await xtreamApi.getMovies(creds, selectedMovieCategory);
        const sortedData = [...data].sort((a: any, b: any) => (parseInt(b.added) || 0) - (parseInt(a.added) || 0));
        setMovieItems(sortedData);
      } catch (err: any) {
        console.error("Failed to fetch movies", err);
        setError(err.message || "Failed to fetch movies for this category.");
      } finally {
        setLoadingMovies(false);
      }
    };
    fetchMovies();
  }, [creds, selectedMovieCategory]);

  // Fetch Series items when category changes
  useEffect(() => {
    if (selectedSeriesCategory === 'favorites') return;
    // Skip if it's initial mount and category is 0 (already fetched in initData)
    if (selectedSeriesCategory === '0' && seriesItems.length > 0) return;

    const fetchSeries = async () => {
      setLoadingSeries(true);
      setError(null);
      try {
        const data = await xtreamApi.getSeries(creds, selectedSeriesCategory);
        const sortedData = [...data].sort((a: any, b: any) => (parseInt(b.last_modified) || 0) - (parseInt(a.last_modified) || 0));
        setSeriesItems(sortedData);
      } catch (err: any) {
        console.error("Failed to fetch series", err);
        setError(err.message || "Failed to fetch series for this category.");
      } finally {
        setLoadingSeries(false);
      }
    };
    fetchSeries();
  }, [creds, selectedSeriesCategory]);

  // Fetch Live TV items when category changes or when live tab is active and items are empty
  useEffect(() => {
    if (selectedLiveCategory === 'favorites') return;
    // Only fetch if tab is live OR if it's category change
    if (activeTab !== 'live' && selectedLiveCategory === '0') return;
    if (selectedLiveCategory === '0' && liveItems.length > 0) return;

    const fetchLive = async () => {
      setLoadingLive(true);
      setError(null);
      try {
        const data = await xtreamApi.getLiveStreams(creds, selectedLiveCategory);
        setLiveItems(data);
        setTotalLiveCount(data.length);
      } catch (err: any) {
        console.error("Failed to fetch live streams", err);
        setError(err.message || "Failed to fetch channels for this category.");
      } finally {
        setLoadingLive(false);
      }
    };
    fetchLive();
  }, [creds, selectedLiveCategory, activeTab]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('info');

  const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleTrendingClick = (trendingItem: TmdbTrendingItem, isSeries: boolean) => {
    const cleanTarget = cleanMediaTitle(trendingItem.title).title.toLowerCase().trim();
    if (!cleanTarget) {
      showToast(`Cannot search empty title`, 'error');
      return;
    }

    showToast(`Matching "${trendingItem.title}" with IPTV Server database...`, 'info');

    // Smart precise match matching function
    const isSmartMatch = (itemName: string): boolean => {
      const cleanItemResult = cleanMediaTitle(itemName);
      const cleanTgtResult = cleanMediaTitle(trendingItem.title);

      let cleanItem = cleanItemResult.title.toLowerCase().trim();
      let cleanTgt = cleanTgtResult.title.toLowerCase().trim();

      if (!cleanItem || !cleanTgt) return false;

      // 1. Year Compatibility check (super important!)
      const itemYearStr = cleanItemResult.year;
      const tgtYearStr = trendingItem.year || cleanTgtResult.year;

      if (itemYearStr && tgtYearStr) {
        const itemY = parseInt(itemYearStr, 10);
        const tgtY = parseInt(tgtYearStr, 10);
        if (!isNaN(itemY) && !isNaN(tgtY)) {
          // If the years differ by more than 1, they are not the same movie/series
          if (Math.abs(itemY - tgtY) > 1) {
            return false;
          }
        }
      }

      // 2. Remove typical IPTV country/lang prefixes from start (e.g., "EN:", "AR_", etc.)
      const stripPrefixes = (s: string) => {
        let rs = s;
        rs = rs.replace(/^([a-z]{2,5}[:_-\s])+/gi, ' ');
        rs = rs.replace(/\s+/g, ' ').trim();
        return rs;
      };

      cleanItem = stripPrefixes(cleanItem);
      cleanTgt = stripPrefixes(cleanTgt);

      // 3. Exact matches are 100% true
      if (cleanItem === cleanTgt) return true;

      // Helper to split into words, ignoring common stop words
      const getCoreWords = (s: string): string[] => {
        const stopWords = new Set(['the', 'a', 'an', 'and', 'of', 'to', 'or', 'for', 'with', 'in', 'on', 'at', 'by', 'from', 'is']);
        return s.split(/\s+/)
          .map(w => w.replace(/[^a-z0-9]/gi, '')) // remove trailing punctuation inside word split
          .filter(w => w.length > 0 && !stopWords.has(w));
      };

      const itemWords = getCoreWords(cleanItem);
      const targetWords = getCoreWords(cleanTgt);

      if (itemWords.length === 0 || targetWords.length === 0) return false;

      // 4. Overlap checks:
      // Item words should be a subset of target words (to match things like "Pushpa 2" vs "Pushpa 2 the Rule")
      // BUT they must have extremely high coverage.
      // Specifically, we do not want to allow ANY extra core words in the item that are not in the target!
      // This prevents "System" matching "The Milk System" or "System Crasher"
      const extraWordsInItem = itemWords.filter(w => !targetWords.includes(w));

      if (extraWordsInItem.length > 0) {
        return false;
      }

      // If the item is a subset of target, ensure it covers at least 50% of target core words to filter noise
      if (itemWords.every(w => targetWords.includes(w))) {
        if (itemWords.length >= targetWords.length * 0.5) {
          return true;
        }
      }

      return false;
    };

    let matches = [];
    if (!isSeries) {
      matches = movieItems.filter(item => isSmartMatch(item.name));
    } else {
      matches = seriesItems.filter(item => isSmartMatch(item.name));
    }

    if (matches.length > 1) {
      setTimeout(() => {
        showToast(`Found ${matches.length} versions of "${trendingItem.title}"! Choose your language.`, 'success');
        setTrendingSelectorData({
          show: true,
          title: trendingItem.title,
          items: matches,
          isSeries
        });
      }, 500);
    } else if (matches.length === 1) {
      setTimeout(() => {
        showToast(`Line connected! Loading Media: ${matches[0].name}`, 'success');
        handleItemClick(matches[0]);
      }, 700);
    } else {
      setTimeout(() => {
        showToast(`No exact matchup! Go to ${isSeries ? 'Web Series' : 'Movies'} section and search manually...`, 'error');
        const cleanTitleQuery = cleanMediaTitle(trendingItem.title).title;
        setSearchQuery(cleanTitleQuery);
        setActiveTab(isSeries ? 'series' : 'movies');
      }, 1500);
    }
  };

  const selectMedia = (item: any, type: 'selectedItem' | 'free_movie' | 'free_series') => {
    setTmdbDetails(null);
    setSeriesInfo(null);
    setMovieInfo(null);
    
    setSyncingItemName(item.name || item.title || "Media");
    setIsSyncingDetails(true);
    setIsMinLoadPassed(false);
    setTimeout(() => {
      setIsMinLoadPassed(true);
    }, 1000);

    const isLive = type === 'selectedItem' && 'stream_type' in item && item.stream_type === 'live';
    
    if (isLive) {
      setLoadingTmdb(false);
      setLoadingInfo(false);
      setSelectedItem(item);
    } else if (type === 'selectedItem') {
      setLoadingTmdb(true);
      setLoadingInfo(true);
      setSelectedItem(item);
    } else if (type === 'free_movie') {
      setLoadingTmdb(true);
      setLoadingInfo(false);
      setSelectedFreeMovie(item);
    } else if (type === 'free_series') {
      setLoadingTmdb(true);
      setLoadingInfo(false);
      handlePlayFreeSeries(item);
    }
  };

  const handleItemClick = (item: any) => {
    selectMedia(item, 'selectedItem');
  };

  useEffect(() => {
    if (isSyncingDetails) {
      const active = selectedItem || selectedFreeMovie || selectedFreeSeries;
      if (!active) {
        setIsSyncingDetails(false);
        return;
      }
      
      const isLive = selectedItem && 'stream_type' in selectedItem && (selectedItem as any).stream_type === 'live';
      if (isLive) {
        setIsSyncingDetails(false);
        return;
      }

      const isSeries = !!selectedFreeSeries || (selectedItem && 'series_id' in selectedItem);

      // We wait for all loading flags to settle to false and minimum load time to pass
      if (!loadingInfo && !loadingTmdb && !isM3uLoading && isMinLoadPassed) {
        setIsSyncingDetails(false);
      }
    }
  }, [loadingInfo, loadingTmdb, isM3uLoading, selectedItem, selectedFreeMovie, selectedFreeSeries, isSyncingDetails, isMinLoadPassed]);

  const isItemFavorite = (item: any) => {
    if (!item) return false;
    const itemId = String('stream_id' in item ? item.stream_id : (item.series_id || (item as any).id));
    return favorites.some((fav: any) => String(fav.itemId) === itemId);
  };

  const toggleItemFavorite = async (item: any) => {
    if (!isLoggedIn || !creds || !creds.username || !item) return;

    const itemId = String('stream_id' in item ? item.stream_id : (item.series_id || (item as any).id));
    const type = 'series_id' in item ? 'series' : ('stream_type' in item && (item as any).stream_type === 'live' ? 'live' : 'movie');

    try {
      if (isItemFavorite(item)) {
        const favDoc = favorites.find((fav: any) => String(fav.itemId) === itemId && fav.type === type);
        if (favDoc && favDoc.id) {
          await deleteDoc(doc(db, 'favorites', favDoc.id));
        }
      } else {
        const newFav = {
          username: creds.username.toLowerCase(),
          itemId: itemId,
          type: type,
          itemData: item,
          addedAt: new Date().toISOString()
        };
        const safeDocId = `${creds.username.toLowerCase()}_${type}_${itemId}`.replace(/[^a-zA-Z0-9_]/g, '_');
        await setDoc(doc(db, 'favorites', safeDocId), newFav);
      }
    } catch (e) {
      console.error("Failed to toggle favorite:", e);
    }
  };

  const isFavorite = useMemo(() => isItemFavorite(selectedItem), [selectedItem, favorites]);
  const toggleFavorite = () => toggleItemFavorite(selectedItem);

  const stringToColorGradient = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      { from: 'from-amber-500/25', to: 'to-orange-500/25', border: 'border-amber-500/30', text: 'text-amber-400' },
      { from: 'from-cyan-500/25', to: 'to-blue-500/25', border: 'border-cyan-500/30', text: 'text-cyan-400' },
      { from: 'from-purple-500/25', to: 'to-indigo-500/25', border: 'border-purple-500/30', text: 'text-purple-400' },
      { from: 'from-emerald-500/25', to: 'to-teal-500/25', border: 'border-emerald-500/30', text: 'text-emerald-400' },
      { from: 'from-rose-500/25', to: 'to-pink-500/25', border: 'border-rose-500/30', text: 'text-rose-400' },
      { from: 'from-fuchsia-500/25', to: 'to-purple-500/25', border: 'border-fuchsia-500/30', text: 'text-fuchsia-400' },
    ];
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const posterUrl = useMemo<string | null>(() => {
    const activeItem = selectedItem || selectedFreeMovie || selectedFreeSeries;
    if (!activeItem) return null;
    if (tmdbDetails?.poster_url) return tmdbDetails.poster_url;
    if (selectedFreeMovie || selectedFreeSeries) return activeItem.poster_url || null;
    return ('stream_icon' in activeItem ? activeItem.stream_icon : (activeItem as Series).cover) || null;
  }, [selectedItem, selectedFreeMovie, selectedFreeSeries, tmdbDetails]);

  const backdropUrl = useMemo<string | null>(() => {
    const activeItem = selectedItem || selectedFreeMovie || selectedFreeSeries;
    if (!activeItem) return null;
    if (tmdbDetails?.backdrop_url) return tmdbDetails.backdrop_url;

    // Try seriesInfo
    if (seriesInfo) {
      const info = seriesInfo.info || {};
      if (info.backdrop_path && Array.isArray(info.backdrop_path) && info.backdrop_path.length > 0) {
        return info.backdrop_path[0] || null;
      }
      if (seriesInfo.backdrop_path && Array.isArray(seriesInfo.backdrop_path) && seriesInfo.backdrop_path.length > 0) {
        return seriesInfo.backdrop_path[0] || null;
      }
      if (typeof info.backdrop_path === 'string' && info.backdrop_path) {
        return info.backdrop_path;
      }
    }
    // Try movieInfo
    if (movieInfo) {
      const info = movieInfo.info || {};
      if (info.backdrop_path && Array.isArray(info.backdrop_path) && info.backdrop_path.length > 0) {
        return info.backdrop_path[0] || null;
      }
      if (movieInfo.backdrop_path && Array.isArray(movieInfo.backdrop_path) && movieInfo.backdrop_path.length > 0) {
        return movieInfo.backdrop_path[0] || null;
      }
      if (typeof info.backdrop_path === 'string' && info.backdrop_path) {
        return info.backdrop_path;
      }
      if (info.background_image) {
        return info.background_image;
      }
    }
    // Try activeItem properties
    if (activeItem && 'backdrop_path' in activeItem && Array.isArray((activeItem as any).backdrop_path) && (activeItem as any).backdrop_path.length > 0) {
      return (activeItem as any).backdrop_path[0] || null;
    }
    return posterUrl;
  }, [selectedItem, selectedFreeMovie, selectedFreeSeries, seriesInfo, movieInfo, posterUrl, tmdbDetails]);

  const castingList = useMemo(() => {
    if (tmdbDetails && tmdbDetails.cast && tmdbDetails.cast.length > 0) {
      return tmdbDetails.cast;
    }

    let castStr = '';
    if (seriesInfo?.info?.cast) {
      castStr = seriesInfo.info.cast;
    } else if (movieInfo?.info?.cast) {
      castStr = movieInfo.info.cast;
    } else {
      const activeItem = selectedItem || selectedFreeMovie || selectedFreeSeries;
      if (activeItem && 'cast' in activeItem && (activeItem as any).cast) {
        castStr = (activeItem as any).cast;
      }
    }
    
    if (!castStr) return [];
    
    return castStr
      .split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0)
      .slice(0, 10)
      .map(name => ({
        name,
        profile_url: undefined
      }));
  }, [selectedItem, selectedFreeMovie, selectedFreeSeries, seriesInfo, movieInfo, tmdbDetails]);

  const currentItems = useMemo(() => {
    const currentSelectedCategory = activeTab === 'movies' ? selectedMovieCategory : (activeTab === 'series' ? selectedSeriesCategory : selectedLiveCategory);
    if (isLoggedIn && currentSelectedCategory === 'favorites') {
      const typeMap = { 'movies': 'movie', 'series': 'series', 'live': 'live' };
      const currentType = typeMap[activeTab as 'movies' | 'series' | 'live'] || 'movie';
      const favsForCurrentTab = favorites
        .filter((fav: any) => fav.type === currentType)
        .map((fav: any) => fav.itemData);
      const filtered = searchQuery 
        ? favsForCurrentTab.filter((item: any) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : favsForCurrentTab;
      return filtered.slice(0, visibleCount);
    }

    const items = activeTab === 'movies' ? movieItems : (activeTab === 'series' ? seriesItems : liveItems);
    const filtered = searchQuery 
      ? items.filter((item: any) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : items;
    return filtered.slice(0, visibleCount);
  }, [activeTab, movieItems, seriesItems, liveItems, searchQuery, visibleCount, selectedMovieCategory, selectedSeriesCategory, selectedLiveCategory, favorites, isLoggedIn]);

  const hasMore = useMemo(() => {
    const currentSelectedCategory = activeTab === 'movies' ? selectedMovieCategory : (activeTab === 'series' ? selectedSeriesCategory : selectedLiveCategory);
    if (isLoggedIn && currentSelectedCategory === 'favorites') {
      const typeMap = { 'movies': 'movie', 'series': 'series', 'live': 'live' };
      const currentType = typeMap[activeTab as 'movies' | 'series' | 'live'] || 'movie';
      const favsForCurrentTab = favorites
        .filter((fav: any) => fav.type === currentType)
        .map((fav: any) => fav.itemData);
      const filtered = searchQuery 
        ? favsForCurrentTab.filter((item: any) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : favsForCurrentTab;
      return visibleCount < filtered.length;
    }

    const items = activeTab === 'movies' ? movieItems : (activeTab === 'series' ? seriesItems : liveItems);
    const filtered = searchQuery 
      ? items.filter((item: any) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : items;
    return visibleCount < filtered.length;
  }, [activeTab, movieItems, seriesItems, liveItems, searchQuery, visibleCount, selectedMovieCategory, selectedSeriesCategory, selectedLiveCategory, favorites, isLoggedIn]);

  const currentCategories = useMemo(() => {
    const cats = activeTab === 'movies' ? movieCategories : (activeTab === 'series' ? seriesCategories : liveCategories);
    if (isLoggedIn) {
      return [{ category_id: 'favorites', category_name: '❤️ Favorites' }, ...cats];
    }
    return cats;
  }, [activeTab, movieCategories, seriesCategories, liveCategories, isLoggedIn]);

  const currentSelectedCategory = activeTab === 'movies' ? selectedMovieCategory : (activeTab === 'series' ? selectedSeriesCategory : selectedLiveCategory);
  const setCurrentSelectedCategory = activeTab === 'movies' ? setSelectedMovieCategory : (activeTab === 'series' ? setSelectedSeriesCategory : setSelectedLiveCategory);
  const currentLoading = currentSelectedCategory === 'favorites' ? false : (activeTab === 'movies' ? loadingMovies : (activeTab === 'series' ? loadingSeries : loadingLive));

  // Reset visible items when category or search changes
  useEffect(() => {
    setVisibleCount(40);
  }, [activeTab, selectedMovieCategory, selectedSeriesCategory, selectedLiveCategory, searchQuery]);

  // Infinite scroll observer
  useEffect(() => {
    if (currentLoading) return;
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !currentLoading) {
        setVisibleCount(prev => prev + 40);
      }
    }, { threshold: 0.1 });

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [currentLoading, activeTab, selectedMovieCategory, selectedSeriesCategory, selectedLiveCategory, searchQuery]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const host = creds.host; // Use existing host, don't show in UI

    const userCreds = { host, username, password };

    try {
      const response = await xtreamApi.login(userCreds);
      if (response.user_info.status === 'Active' || response.user_info.auth === 1) {
        setCreds(userCreds);
        if (response.user_info) setUserInfo(response.user_info);
        if (response.server_info) setServerInfo(response.server_info);
        setIsLoggedIn(true);
        setShowLoginModal(false);
        setSelectedItem(null);
        localStorage.setItem('iptv_creds', JSON.stringify(userCreds));
        localStorage.setItem('iptv_logged_in', 'true');
        // Track manual login event
        trackUserActivity(username);
        sessionStorage.setItem(`tracked_session_${username.toLowerCase()}`, 'true');
      } else {
        setLoginError('Your username or password is not valid. Click here to register new account');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.response?.status === 404) {
        setLoginError('Your username or password is not valid. Click here to register new account');
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        setLoginError('Your username or password is not valid. Click here to register new account');
      } else {
        setLoginError('Failed to connect to server. Please check your internet and credentials.');
      }
    }
  };

  const handleLogout = () => {
    setCreds(DEFAULT_CREDENTIALS);
    setUserInfo(null);
    setServerInfo(null);
    setIsLoggedIn(false);
    localStorage.removeItem('iptv_creds');
    localStorage.removeItem('iptv_logged_in');
  };

  const formatExpiryDate = (expDateRaw: any) => {
    if (!expDateRaw || expDateRaw === 'null' || expDateRaw === '0') {
      return 'Unlimited / Lifetime';
    }
    const timestamp = Number(expDateRaw);
    if (isNaN(timestamp) || timestamp <= 0) {
      return expDateRaw || 'Unlimited';
    }
    try {
      const date = new Date(timestamp * 1000);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return expDateRaw;
    }
  };

  const formatCreationDate = (createdAtRaw: any) => {
    if (!createdAtRaw || createdAtRaw === 'null' || createdAtRaw === '0') {
      return 'N/A';
    }
    const timestamp = Number(createdAtRaw);
    if (isNaN(timestamp) || timestamp <= 0) {
      return createdAtRaw || 'N/A';
    }
    try {
      const date = new Date(timestamp * 1000);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return createdAtRaw;
    }
  };

  const handleFetchFreeItemTmdbDetails = async () => {
    const isSeries = activeAdminTab === 'free_series';
    const tmdbId = isSeries ? newFreeSeries.tmdb_id : newFreeMovie.tmdb_id;
    if (!tmdbId || !tmdbId.trim()) {
      alert("Please enter a valid TMDB ID first!");
      return;
    }
    setIsFetchingTmdb(true);
    try {
      const details = await fetchTmdbDetailsById(tmdbId.trim(), isSeries);
      if (details) {
        if (isSeries) {
          setNewFreeSeries({
            ...newFreeSeries,
            name: details.name || '',
            poster_url: details.poster_url || '',
          });
        } else {
          setNewFreeMovie({
            ...newFreeMovie,
            name: details.name || '',
            poster_url: details.poster_url || '',
          });
        }
      } else {
        alert("Could not load details for this TMDB ID. Please verify the ID is correct.");
      }
    } catch (err) {
      console.error("Error autofetching TMDB details in admin:", err);
      alert("An error occurred while fetching details.");
    } finally {
      setIsFetchingTmdb(false);
    }
  };

  const handleAddReseller = async () => {
    if (!newReseller.subdomain || !newReseller.brand_name) {
      alert("Please fill all required fields (Subdomain/Domain keyword, Brand Name)");
      return;
    }
    try {
      if (editingResellerId) {
        await updateDoc(doc(db, 'resellers', editingResellerId), {
          ...newReseller,
          updatedAt: new Date().toISOString()
        });
        setEditingResellerId(null);
      } else {
        await addDoc(collection(db, 'resellers'), {
          ...newReseller,
          createdAt: new Date().toISOString()
        });
      }
      setNewReseller({
        subdomain: '',
        brand_name: '',
        tagline: '',
        whatsapp_number: '',
        whatsapp_group_link: '',
        logo_url: '',
        server_url: '',
        app_link: '',
        password: '',
        license_type: '1 Year'
      });
    } catch (error) {
      console.error("Error saving reseller:", error);
      handleFirestoreError(error, OperationType.WRITE, 'resellers');
    }
  };

  const handleDeleteReseller = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this reseller?")) return;
    try {
      await deleteDoc(doc(db, 'resellers', id));
    } catch (error) {
      console.error("Error deleting reseller:", error);
      handleFirestoreError(error, OperationType.DELETE, `resellers/${id}`);
    }
  };

  const handleAddFreeMovie = async () => {
    if (!newFreeMovie.name || !newFreeMovie.poster_url || !newFreeMovie.play_url) {
      alert("Please fill all required fields (Name, Poster URL, Play URL)");
      return;
    }
    try {
      if (editingMovieId) {
        await updateDoc(doc(db, 'free_movies', editingMovieId), {
          ...newFreeMovie,
          updatedAt: new Date().toISOString()
        });
        setEditingMovieId(null);
      } else {
        await addDoc(collection(db, 'free_movies'), {
          ...newFreeMovie,
          createdAt: new Date().toISOString()
        });
      }
      setNewFreeMovie({ tmdb_id: '', name: '', poster_url: '', play_url: '', download_url: '', is_embed: false, password: '' });
    } catch (error) {
      console.error("Error saving free movie:", error);
    }
  };

  const handleDeleteFreeMovie = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this movie?")) return;
    try {
      await deleteDoc(doc(db, 'free_movies', id));
    } catch (error) {
      console.error("Error deleting free movie:", error);
    }
  };

  const handleAddLiveEvent = async () => {
    if (!newLiveEvent.name || !newLiveEvent.poster_url) {
      alert("Please fill all required fields (Name, Poster URL)");
      return;
    }
    const validChannels = newLiveEvent.channels.filter(ch => ch.play_url && ch.play_url.trim() !== '');
    if (validChannels.length === 0) {
      alert("Please add at least one channel with a play link (M3U8 link).");
      return;
    }
    try {
      if (editingLiveEventId) {
        await updateDoc(doc(db, 'live_events', editingLiveEventId), {
          name: newLiveEvent.name,
          poster_url: newLiveEvent.poster_url,
          channels: validChannels,
          updatedAt: new Date().toISOString()
        });
        setEditingLiveEventId(null);
      } else {
        await addDoc(collection(db, 'live_events'), {
          name: newLiveEvent.name,
          poster_url: newLiveEvent.poster_url,
          channels: validChannels,
          createdAt: new Date().toISOString()
        });
      }
      setNewLiveEvent({ name: '', poster_url: '', channels: [{ name: 'Urdu', play_url: '', is_embed: false, is_mpd: false, is_webpage: false, sandbox_disabled: false }] });
    } catch (error) {
      console.error("Error saving live event:", error);
      alert("Failed to save live event.");
    }
  };

  const handleDeleteLiveEvent = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this live event?")) return;
    try {
      await deleteDoc(doc(db, 'live_events', id));
    } catch (error) {
      console.error("Error deleting live event:", error);
    }
  };

  const handleAddFifaChannel = async () => {
    if (!newFifaChannel.name) {
      alert("Please enter a channel name!");
      return;
    }
    const isIptv = newFifaChannel.feed_type === 'iptv';
    if (isIptv && !newFifaChannel.stream_id) {
      alert("Please enter an IPTV Stream ID (Channel ID)!");
      return;
    }
    if (!isIptv && !newFifaChannel.play_url) {
      alert("Please enter a Stream Link / MPD Link / Embed URL!");
      return;
    }

    const pathForWrite = editingFifaChannelId ? `fifa_channels/${editingFifaChannelId}` : 'fifa_channels';
    const orderVal = (newFifaChannel.order !== undefined && newFifaChannel.order !== '' && !isNaN(Number(newFifaChannel.order))) ? Number(newFifaChannel.order) : 999999;
    
    const isPremiumVal = isIptv ? true : (newFifaChannel.is_premium !== undefined ? !!newFifaChannel.is_premium : true);

    const payload = {
      name: newFifaChannel.name,
      feed_type: newFifaChannel.feed_type || 'iptv',
      stream_id: isIptv ? newFifaChannel.stream_id : '',
      play_url: isIptv ? '' : newFifaChannel.play_url,
      is_mpd: isIptv ? false : !!newFifaChannel.is_mpd,
      is_embed: isIptv ? false : !!newFifaChannel.is_embed,
      is_webpage: isIptv ? false : !!newFifaChannel.is_webpage,
      sandbox_disabled: isIptv ? false : !!newFifaChannel.sandbox_disabled,
      status: newFifaChannel.status || 'Live',
      order: orderVal,
      is_premium: isPremiumVal,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingFifaChannelId) {
        await updateDoc(doc(db, 'fifa_channels', editingFifaChannelId), payload);
        setEditingFifaChannelId(null);
      } else {
        await addDoc(collection(db, 'fifa_channels'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
      }
      setNewFifaChannel({
        name: '',
        play_url: '',
        is_mpd: false,
        is_embed: false,
        is_webpage: false,
        sandbox_disabled: false,
        status: 'Live',
        order: '',
        stream_id: '',
        feed_type: 'iptv',
        is_premium: true
      });
    } catch (error) {
      console.error("Error saving FIFA channel:", error);
      alert("Failed to save FIFA channel.");
      handleFirestoreError(error, OperationType.WRITE, pathForWrite);
    }
  };

  const handleDeleteFifaChannel = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this FIFA channel?")) return;
    const pathForDelete = `fifa_channels/${id}`;
    try {
      await deleteDoc(doc(db, 'fifa_channels', id));
    } catch (error) {
      console.error("Error deleting FIFA channel:", error);
      handleFirestoreError(error, OperationType.DELETE, pathForDelete);
    }
  };

  const getFifaPlayUrl = (chan: any) => {
    if (!chan) return '';
    if (chan.feed_type === 'iptv' || chan.is_iptv || chan.stream_id) {
      if (creds && creds.username && creds.password) {
        return `${currentServerHost}/live/${creds.username}/${creds.password}/${chan.stream_id}.m3u8`;
      }
      return `${currentServerHost}/live/demo/demo/${chan.stream_id}.m3u8`;
    }
    return chan.play_url || '';
  };

  const handleFifaDragStart = (e: React.DragEvent, index: number) => {
    setDraggedFifaIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleFifaDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedOverFifaIndex !== index) {
      setDraggedOverFifaIndex(index);
    }
  };

  const handleFifaDragEnd = () => {
    setDraggedFifaIndex(null);
    setDraggedOverFifaIndex(null);
  };

  const handleFifaDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = draggedFifaIndex;
    setDraggedFifaIndex(null);
    setDraggedOverFifaIndex(null);

    if (sourceIndex === null || sourceIndex === targetIndex) return;

    // Create a copy of the list and reorder
    const updatedList = [...fifaChannels];
    const [draggedItem] = updatedList.splice(sourceIndex, 1);
    updatedList.splice(targetIndex, 0, draggedItem);

    // Assign new sequencing 1, 2, 3...
    const listWithNewOrders = updatedList.map((item, idx) => ({
      ...item,
      order: idx + 1
    }));

    // Update state locally for instant snappy feedback
    setFifaChannels(listWithNewOrders);

    // Save the new orders to Firestore using a batch
    const batch = writeBatch(db);
    listWithNewOrders.forEach((item) => {
      const channelRef = doc(db, 'fifa_channels', item.id);
      batch.update(channelRef, { order: item.order });
    });

    try {
      await batch.commit();
      console.log("FIFA channels reordered and saved successfully!");
    } catch (error) {
      console.error("Error saving new FIFA channels order:", error);
      handleFirestoreError(error, OperationType.WRITE, 'fifa_channels/reorder');
    }
  };

  const parseM3uPlaylist = (m3uText: string, seriesName: string): Record<string, any[]> => {
    const lines = m3uText.split('\n');
    const episodesBySeason: Record<string, any[]> = {};
    
    let currentGroup = '1';
    let title = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const upperLine = line.toUpperCase();
      if (upperLine.startsWith('#EXTINF:')) {
        // Parse info line
        // Check group-title attrs
        const groupMatch = line.match(/group-title="([^"]+)"/i);
        if (groupMatch) {
          const seasonNoMatch = groupMatch[1].match(/Season\s*(\d+)/i);
          currentGroup = seasonNoMatch ? seasonNoMatch[1] : groupMatch[1];
        } else {
          const tvgNameMatch = line.match(/tvg-name="([^"]+)"/i);
          if (tvgNameMatch) {
            const seasonNoMatch = tvgNameMatch[1].match(/Season\s*(\d+)/i);
            if (seasonNoMatch) currentGroup = seasonNoMatch[1];
          }
        }
        
        // Match string after comma (Episode title)
        const commaIdx = line.indexOf(',');
        if (commaIdx !== -1) {
          title = line.substring(commaIdx + 1).trim();
        } else {
          title = '';
        }
      } else if (upperLine.startsWith('#EXTGRP:')) {
        const groupVal = line.substring(8).trim();
        const seasonNoMatch = groupVal.match(/Season\s*(\d+)/i);
        currentGroup = seasonNoMatch ? seasonNoMatch[1] : groupVal;
      } else if (line.startsWith('#')) {
        continue;
      } else {
        // It's a streaming link
        const playUrl = getResellerAdjustedUrl(line);
        if (playUrl.startsWith('http')) {
          let seasonNum = currentGroup;
          
          // Try to discover season from title if group title wasn't numeric
          const seasonInTitle = title.match(/S(?:eason)?\s*(\d+)/i);
          if (seasonInTitle) {
            seasonNum = seasonInTitle[1];
          }
          
          let numericSeason = seasonNum.replace(/[^\d]/g, '');
          if (!numericSeason) {
            numericSeason = "1";
          }
          
          // Get episode number
          let epNum = '1';
          const epInTitle = title.match(/(?:E(?:pisode)?|Ep)\s*(\d+)/i) || title.match(/(?:^|\s|_)(\d+)(?:\s|_|$)/);
          if (epInTitle) {
            epNum = epInTitle[1];
          } else {
            const existingLen = episodesBySeason[numericSeason]?.length || 0;
            epNum = String(existingLen + 1);
          }

          // Format clean episode title if empty
          let cleanTitle = title || `Episode ${epNum}`;
          // Clean up redundantly long paths if the title matches stream names
          if (cleanTitle.startsWith('http') || cleanTitle.length > 80) {
            cleanTitle = `Episode ${epNum}`;
          }
          
          if (!episodesBySeason[numericSeason]) {
            episodesBySeason[numericSeason] = [];
          }
          
          episodesBySeason[numericSeason].push({
            id: `${numericSeason}-${epNum}-${episodesBySeason[numericSeason].length}`,
            title: cleanTitle,
            episode_num: epNum,
            play_url: playUrl,
            container_extension: playUrl.split('?')[0].split('.').pop() || 'mp4',
          });
        }
      }
    }
    
    // Sort seasons and episodes
    const sortedMap: Record<string, any[]> = {};
    Object.keys(episodesBySeason).sort((a,b)=>Number(a)-Number(b)).forEach(season => {
      sortedMap[season] = episodesBySeason[season].sort((a,b) => Number(a.episode_num) - Number(b.episode_num));
    });
    
    return sortedMap;
  };

  const handleSelectFreeMovieWithPass = (movie: any) => {
    if (movie.password && movie.password.trim() !== '' && !isAdminLoggedIn) {
      setPasswordProtectedItem({
        item: movie,
        type: 'movie',
        callback: () => {
          selectMedia(movie, 'free_movie');
        }
      });
      setEnteredPassword('');
      setPasswordError(false);
    } else {
      selectMedia(movie, 'free_movie');
    }
  };

  const handleSelectFreeSeriesWithPass = (series: any) => {
    if (series.password && series.password.trim() !== '' && !isAdminLoggedIn) {
      setPasswordProtectedItem({
        item: series,
        type: 'series',
        callback: () => {
          selectMedia(series, 'free_series');
        }
      });
      setEnteredPassword('');
      setPasswordError(false);
    } else {
      selectMedia(series, 'free_series');
    }
  };

  const handlePlayFreeSeries = async (series: any) => {
    setSelectedFreeSeries(series);
    setSelectedFreeSeason(null);
    if (series.playlist_url) {
      setIsM3uLoading(true);
      setFreeSeriesEpisodesMap(null);
      setPlayingFreeEpisode(null);
      setFreeSeriesActiveUrl('');
      try {
        const response = await axios.get(`/api/proxy?url=${encodeURIComponent(getResellerAdjustedUrl(series.playlist_url))}`);
        let m3uText = '';
        if (typeof response.data === 'string') {
          m3uText = response.data;
        } else if (response.data && typeof response.data.data === 'string') {
          m3uText = response.data.data;
        } else {
          m3uText = JSON.stringify(response.data);
        }
        
        const parsedMap = parseM3uPlaylist(m3uText, series.name);
        setFreeSeriesEpisodesMap(parsedMap);
        
        const seasons = Object.keys(parsedMap).sort((a,b)=>Number(a)-Number(b));
        if (seasons.length > 0) {
          const firstSeason = seasons[0];
          setSelectedFreeSeason(firstSeason);
          const firstEp = parsedMap[firstSeason]?.[0];
          if (firstEp) {
            setPlayingFreeEpisode({
              ...firstEp,
              season: firstSeason
            });
            setFreeSeriesActiveUrl(firstEp.play_url);
          }
        }
      } catch (err) {
        console.error("Error fetching or parsing M3U list:", err);
        // Fallback to single link if parsing fails or CORS proxy returns blank
        setFreeSeriesEpisodesMap(null);
        setPlayingFreeEpisode(null);
        setFreeSeriesActiveUrl(series.play_url || '');
      } finally {
        setIsM3uLoading(false);
      }
    } else if (series.episodes && series.episodes.length > 0) {
      const parsedMap: Record<string, any[]> = {};
      series.episodes.forEach((ep: any) => {
        const s = String(ep.season || '1');
        if (!parsedMap[s]) {
          parsedMap[s] = [];
        }
        parsedMap[s].push({
          id: ep.id || `ep_manual_${s}_${ep.episode_num}`,
          episode_num: ep.episode_num || '1',
          title: ep.title || `Episode ${ep.episode_num}`,
          play_url: ep.play_url,
          download_url: ep.download_url || ''
        });
      });
      // Sort episodes in each season by episode_num
      Object.keys(parsedMap).forEach((s) => {
        parsedMap[s].sort((a,b) => (Number(a.episode_num) || 0) - (Number(b.episode_num) || 0));
      });
      setFreeSeriesEpisodesMap(parsedMap);
      
      const seasons = Object.keys(parsedMap).sort((a,b)=>Number(a)-Number(b));
      if (seasons.length > 0) {
        const firstSeason = seasons[0];
        setSelectedFreeSeason(firstSeason);
        const firstEp = parsedMap[firstSeason]?.[0];
        if (firstEp) {
          setPlayingFreeEpisode({
            ...firstEp,
            season: firstSeason
          });
          setFreeSeriesActiveUrl(firstEp.play_url);
        }
      }
    } else {
      setFreeSeriesEpisodesMap(null);
      setPlayingFreeEpisode(null);
      setFreeSeriesActiveUrl(series.play_url || '');
    }
  };

  const getNextFreeEpisode = (currentEp: any) => {
    if (!currentEp || !freeSeriesEpisodesMap) return null;
    
    const currentSeason = currentEp.season || '1';
    const currentSeasonEps = freeSeriesEpisodesMap[currentSeason] || [];
    const currentIndex = currentSeasonEps.findIndex((e: any) => String(e.id) === String(currentEp.id));
    
    if (currentIndex !== -1 && currentIndex < currentSeasonEps.length - 1) {
      return {
        ...currentSeasonEps[currentIndex + 1],
        season: currentSeason
      };
    }
    
    // Move to next season
    const seasons = Object.keys(freeSeriesEpisodesMap).sort((a, b) => Number(a) - Number(b));
    const nextSeasonIdx = seasons.indexOf(currentSeason) + 1;
    if (nextSeasonIdx < seasons.length) {
      const nextSeason = seasons[nextSeasonIdx];
      const nextSeasonEps = freeSeriesEpisodesMap[nextSeason] || [];
      if (nextSeasonEps.length > 0) {
        return {
          ...nextSeasonEps[0],
          season: nextSeason
        };
      }
    }
    return null;
  };

  const handlePlayNextFreeEpisode = () => {
    const nextEp = getNextFreeEpisode(playingFreeEpisode);
    if (nextEp) {
      setPlayingFreeEpisode(nextEp);
      setFreeSeriesActiveUrl(nextEp.play_url);
    }
  };

  const handleSelectFreeEpisode = (episode: any, seasonNum: string) => {
    setPlayingFreeEpisode({
      ...episode,
      season: seasonNum
    });
    setFreeSeriesActiveUrl(episode.play_url);
  };

  const handleDownloadFreeEpisode = (episode: any) => {
    if (!episode || !episode.play_url) return;
    const seasonStr = episode.season ? `S${episode.season}` : '';
    const epStr = episode.episode_num ? `E${episode.episode_num}` : '';
    const partStr = [seasonStr, epStr].filter(Boolean).join('');
    const separator = partStr ? ` - ${partStr}` : '';
    const epTitle = episode.title || `Episode ${episode.episode_num}`;
    const filename = `${selectedFreeSeries?.name || 'Series'}${separator} - ${epTitle}.${episode.container_extension || 'mp4'}`;
    triggerDownload(episode.play_url, filename);

    // Track free series download click
    if (selectedFreeSeries) {
      trackMediaPlayback(selectedFreeSeries, 'series', `${partStr || 'Episode'}: ${epTitle} (Download)`);
    }
  };

  const handleOpenFreeSeriesDownloadModal = async (series: any) => {
    if (!series) return;
    if (!series.playlist_url) {
      if (series.episodes && series.episodes.length > 0) {
        // We have manually added episodes! Populate the list directly instead of requesting M3U
        const list: any[] = [];
        series.episodes.forEach((ep: any) => {
          list.push({
            ...ep,
            id: ep.id || `ep_manual_${ep.season || '1'}_${ep.episode_num}`,
            episode_num: ep.episode_num || '1',
            title: ep.title || `Episode ${ep.episode_num}`,
            play_url: ep.play_url,
            download_url: ep.download_url || '',
            season: ep.season || '1'
          });
        });
        setFreeDownloadModalEpisodes(list);
        setShowFreeDownloadModal(true);
        setIsFreeDownloadLoading(false);
        return;
      }
      // Direct file download fallback for simple movies/series
      const filename = `${series.name || 'series'}.${series.play_url?.split('.').pop() || 'mp4'}`;
      triggerDownload(series.download_url || series.play_url, filename);
      return;
    }

    setShowFreeDownloadModal(true);
    setIsFreeDownloadLoading(true);
    setFreeDownloadModalEpisodes([]);

    try {
      const response = await axios.get(`/api/proxy?url=${encodeURIComponent(getResellerAdjustedUrl(series.playlist_url))}`);
      let m3uText = '';
      if (typeof response.data === 'string') {
        m3uText = response.data;
      } else if (response.data && typeof response.data.data === 'string') {
        m3uText = response.data.data;
      } else {
        m3uText = JSON.stringify(response.data);
      }
      
      const parsedMap = parseM3uPlaylist(m3uText, series.name);
      const list: any[] = [];
      Object.keys(parsedMap).sort((a, b) => Number(a) - Number(b)).forEach(season => {
        parsedMap[season].forEach(ep => {
          list.push({
            ...ep,
            season
          });
        });
      });
      setFreeDownloadModalEpisodes(list);
    } catch (err) {
      console.error("Error loading free series episodes for download modal:", err);
      alert("Could not load episodes. Please check your internet connection.");
      setShowFreeDownloadModal(false);
    } finally {
      setIsFreeDownloadLoading(false);
    }
  };

  const handleAddManualEpisode = () => {
    if (!manualEpisodeInput.play_url) {
      alert("Episode play URL is required");
      return;
    }
    const episodeNum = manualEpisodeInput.episode_num || '1';
    const seasonVal = manualEpisodeInput.season || '1';
    const titleVal = manualEpisodeInput.title.trim() || `Episode ${episodeNum}`;
    
    // Generate unique ID
    const newEpId = `ep_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const newEp = {
      id: newEpId,
      season: seasonVal,
      episode_num: episodeNum,
      title: titleVal,
      play_url: manualEpisodeInput.play_url.trim(),
      download_url: manualEpisodeInput.download_url.trim()
    };
    
    // Append to free series episodes list
    const updatedEpisodes = [...(newFreeSeries.episodes || []), newEp];
    
    // Sort array by season and then by episode_num
    updatedEpisodes.sort((a, b) => {
      const sA = Number(a.season) || 1;
      const sB = Number(b.season) || 1;
      if (sA !== sB) return sA - sB;
      return (Number(a.episode_num) || 1) - (Number(b.episode_num) || 1);
    });
    
    setNewFreeSeries({
      ...newFreeSeries,
      episodes: updatedEpisodes
    });
    
    // Auto-increment episode number for the next addition
    const nextEpNum = (Number(episodeNum) + 1).toString();
    setManualEpisodeInput({
      season: seasonVal,
      episode_num: nextEpNum,
      title: '',
      play_url: '',
      download_url: ''
    });
  };

  const handleRemoveManualEpisode = (episodeId: string) => {
    const updatedEpisodes = (newFreeSeries.episodes || []).filter(ep => ep.id !== episodeId);
    setNewFreeSeries({
      ...newFreeSeries,
      episodes: updatedEpisodes
    });
  };

  const handleAddFreeSeries = async () => {
    const hasManualEpisodes = newFreeSeries.episodes && newFreeSeries.episodes.length > 0;
    if (!newFreeSeries.name || !newFreeSeries.poster_url || (!newFreeSeries.play_url && !newFreeSeries.playlist_url && !hasManualEpisodes)) {
      alert("Please fill name, poster URL, and either Streaming Link, Playlist M3U URL, or add at least one Manual Episode");
      return;
    }
    try {
      const finalSeries = {
        ...newFreeSeries,
        episodes: (newFreeSeries.playlist_url && newFreeSeries.playlist_url.trim() !== '') ? [] : newFreeSeries.episodes
      };

      if (editingSeriesId) {
        await updateDoc(doc(db, 'free_series', editingSeriesId), {
          ...finalSeries,
          updatedAt: new Date().toISOString()
        });
        setEditingSeriesId(null);
      } else {
        await addDoc(collection(db, 'free_series'), {
          ...finalSeries,
          createdAt: new Date().toISOString()
        });
      }
      setNewFreeSeries({ 
        tmdb_id: '', 
        name: '', 
        poster_url: '', 
        play_url: '', 
        download_url: '', 
        playlist_url: '', 
        is_embed: false, 
        password: '', 
        episodes: [] 
      });
    } catch (error) {
      console.error("Error saving free series:", error);
    }
  };

  const handleDeleteFreeSeries = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this series?")) return;
    try {
      await deleteDoc(doc(db, 'free_series', id));
    } catch (error) {
      console.error("Error deleting free series:", error);
    }
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const formatVlcUrl = (url: string) => {
    if (!url) return '';
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isAndroid = /Android/i.test(userAgent);

    if (isAndroid) {
      // Use the exact Intent format requested for Android
      return `intent:${url}#Intent;package=org.videolan.vlc;type=video/*;end;`;
    }

    // Fallback for non-Android (Desktop/iOS)
    return `vlc:${url}`;
  };

  const getAutoplayUrl = (url: string | undefined | null) => {
    if (!url) return '';
    try {
      let fullUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('//')) {
        fullUrl = 'https://' + url;
      }
      const parsedUrl = new URL(fullUrl);
      
      if (parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname.includes('youtu.be')) {
        parsedUrl.searchParams.set('autoplay', '1');
        parsedUrl.searchParams.set('mute', '0');
        parsedUrl.searchParams.set('playsinline', '1');
      } else if (parsedUrl.hostname.includes('vimeo.com')) {
        parsedUrl.searchParams.set('autoplay', '1');
        parsedUrl.searchParams.set('muted', '0');
        parsedUrl.searchParams.set('playsinline', '1');
      } else if (parsedUrl.hostname.includes('blogger.com')) {
        parsedUrl.searchParams.set('autoplay', 'true');
        parsedUrl.searchParams.set('muted', 'false');
      } else {
        parsedUrl.searchParams.set('autoplay', '1');
        parsedUrl.searchParams.set('autoPlay', 'true');
        parsedUrl.searchParams.set('autoplay_on_load', '1');
        parsedUrl.searchParams.set('autostart', 'true');
        parsedUrl.searchParams.set('mute', '0');
        parsedUrl.searchParams.set('muted', 'false');
        parsedUrl.searchParams.set('muted_state', '0');
        parsedUrl.searchParams.set('play', '1');
        parsedUrl.searchParams.set('volume', '100');
        parsedUrl.searchParams.set('playsinline', '1');
        parsedUrl.searchParams.set('sound', '1');
        parsedUrl.searchParams.set('unmute', 'true');
        parsedUrl.searchParams.set('audio', 'true');
      }
      return parsedUrl.toString();
    } catch (e) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}autoplay=1&autoPlay=true&autoplay_on_load=1&autostart=true&mute=0&muted=false&muted_state=0&play=1&volume=100&playsinline=1&sound=1&unmute=true&audio=true`;
    }
  };

  const triggerDownload = (url: string, filename: string) => {
    // Remove the download proxy and redirect directly to the original/reseller URL
    const finalUrl = getResellerAdjustedUrl(url, 'download');
    window.location.assign(finalUrl);
  };

  const handleAction = async (action: 'play' | 'download' | 'web_play' | 'copy', item: any, episodeId?: string, episodeExt?: string, isConfirmed = false) => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }

    if (!creds.username || !creds.password) {
      alert("Please enter a valid username and password in settings.");
      return;
    }
    // Set the New Base URL - Use the current server host (main or reseller's server)
    const host = currentServerHost;

    const isLive = !!(item as any).stream_type && (item as any).stream_type === 'live';
    const isSeries = !!(episodeId || (item as any).series_id);
    
    // If it's a series but no episodeId is provided, we can't play/download it directly
    if (isSeries && !episodeId && action !== 'web_play') {
      console.warn("Cannot perform action on series without an episode ID");
      return;
    }

    const streamId = episodeId || (item as any).stream_id || (item as any).id;
    
    if (!streamId) {
      console.error("No stream ID found for item", item);
      alert("Could not find the video file for this item. Please try an episode instead.");
      setDownloading(null);
      return;
    }

    // Force Live TV channels strictly use .m3u8 format, Movies and Series use standard extensions from sever API
    let ext = isLive ? 'm3u8' : (episodeExt || (item as any).container_extension || 'mp4');
    const type = isLive ? 'live' : (isSeries ? 'series' : 'movie');

    // For Download ONLY: strictly enforce the .mkv extension
    if (action === 'download' && !isLive) {
      ext = 'mkv';
    }
    
    // Correct Xtream URL format: http://host:port/type/user/pass/id.ext
    const url = `${host}/${type}/${creds.username}/${creds.password}/${streamId}.${ext}`;
    
    // Track premium playback analytics
    if (action === 'web_play' || action === 'play' || (action === 'download' && isConfirmed)) {
      const trackCategory = isLive ? 'live_event' : (isSeries ? 'series' : 'movie');
      let trackChannelName = undefined;
      
      if (isSeries && seriesInfo?.episodes) {
        // Find episode name
        let matchedEpName = null;
        for (const seasonNo of Object.keys(seriesInfo.episodes)) {
          const eps = seriesInfo.episodes[seasonNo];
          const found = eps?.find((e: any) => String(e.id) === String(streamId));
          if (found) {
            matchedEpName = `S${seasonNo} E${found.episode_num}: ${found.title}`;
            break;
          }
        }
        trackChannelName = matchedEpName || `Episode ID ${streamId}`;
      } else if (isLive) {
        trackChannelName = (item as any).name || 'Live Channel';
      }
      
      trackMediaPlayback(item, trackCategory, trackChannelName);
    }
    
    if (action === 'web_play') {
      setWebPlayUrl(url);
      setWebPlayTitle((item as any).name || (selectedItem as any)?.name || 'Title');
      
      // Find and set playingEpisode metadata if it's a web series
      if (isSeries && seriesInfo?.episodes) {
        let matchedEpisode = null;
        for (const seasonNo of Object.keys(seriesInfo.episodes)) {
          const eps = seriesInfo.episodes[seasonNo];
          const match = eps?.find((e: any) => String(e.id) === String(streamId));
          if (match) {
            matchedEpisode = {
              ...match,
              season: seasonNo
            };
            break;
          }
        }
        if (matchedEpisode) {
          setPlayingEpisode(matchedEpisode);
        } else {
          // Fallback if seriesInfo doesn't contain the episode ID
          setPlayingEpisode({ episode_num: 'Active', title: 'Web Episode' });
        }
      } else {
        setPlayingEpisode(null);
      }

      setShowWebPlayer(true);
      return;
    }

    if (action === 'download' && !isConfirmed) {
      if (downloading) {
        alert("Another download is already in progress. Please wait for it to complete.");
        return;
      }
      setPendingDownload({ item, episodeId, episodeExt });
      setShowDownloadConfirm(true);
      return;
    }

    if (action === 'copy') {
      try {
        await navigator.clipboard.writeText(url);
        setCopiedId(streamId);
        setTimeout(() => setCopiedId(null), 2000);
      } catch (err) {
        console.error('Failed to copy: ', err);
      }
      return;
    }

    if (action === 'download') {
      setDownloading(streamId);
      const filename = `${(item as any).name || 'video'}.${ext}`;
      triggerDownload(url, filename);

      // Reset after some time since we can't track completion
      setTimeout(() => setDownloading(null), 30000);
      return;
    } else {
      if (downloading) {
        alert("Download in progress. Please wait for it to complete before playing content.");
        return;
      }
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isAndroid = /Android/i.test(userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(userAgent);

      if (isMobile) {
        if (isAndroid) {
          // Use the consolidated VLC Intent/scheme formatter
          window.location.href = formatVlcUrl(url);
        } else if (isIOS) {
          // iOS - try vlc:// as a common player scheme
          const vlcUrl = formatVlcUrl(url);
          window.location.href = vlcUrl;
        } else {
          window.open(url, '_blank');
        }
      } else {
        // Desktop/PC - use vlc:// protocol scheme
        const vlcUrl = formatVlcUrl(url);
        window.location.href = vlcUrl;
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#020617] text-white selection:bg-cyan-500/30 selection:text-cyan-200">
      <AnimatePresence>
        {showIntro && (
          <IntroLoading 
            progress={introProgress} 
            brandName={currentBrandName}
            isResellersLoading={isResellersLoading}
            onComplete={() => {
              setShowIntro(false);
              localStorage.setItem('has_seen_intro', 'true');
            }} 
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-50 glass-dark px-4 md:px-6 py-3 md:py-4 safe-top flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-4 md:gap-8">
          <div className="flex flex-col -space-y-1">
            <h1 className="text-xl md:text-2xl font-display font-bold text-gradient tracking-tighter flex items-center italic">
              {renderBrandName(currentBrandName)}
            </h1>
            <span className="text-[8px] md:text-[10px] text-cyan-400/60 font-bold uppercase tracking-[0.2em] pl-1 italic">Premium Experience</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <button 
              onClick={() => { setActiveTab('home'); }}
              className={cn(
                "flex items-center gap-2 text-sm font-medium transition-all hover:scale-105",
                activeTab === 'home' ? "text-cyan-400" : "text-white/60 hover:text-white"
              )}
            >
              <Home size={18} /> Home
            </button>
            <button 
              onClick={() => { setActiveTab('movies'); setSelectedMovieCategory('0'); }}
              className={cn(
                "flex items-center gap-2 text-sm font-medium transition-all hover:scale-105",
                activeTab === 'movies' ? "text-cyan-400" : "text-white/60 hover:text-white"
              )}
            >
              <Film size={18} /> Movies
            </button>
            <button 
              onClick={() => { setActiveTab('series'); setSelectedSeriesCategory('0'); }}
              className={cn(
                "flex items-center gap-2 text-sm font-medium transition-all hover:scale-105",
                activeTab === 'series' ? "text-cyan-400" : "text-white/60 hover:text-white"
              )}
            >
              <Tv size={18} /> Web Series
            </button>
            <button 
              onClick={() => { setActiveTab('live'); setSelectedLiveCategory('0'); }}
              className={cn(
                "flex items-center gap-2 text-sm font-medium transition-all hover:scale-105",
                activeTab === 'live' ? "text-cyan-400" : "text-white/60 hover:text-white"
              )}
            >
              <LayoutGrid size={18} /> Live TV
            </button>
            <button 
              onClick={() => { setActiveTab('free'); setActiveFreeTab('menu'); }}
              className={cn(
                "flex items-center gap-2 text-sm font-medium transition-all hover:scale-105",
                activeTab === 'free' ? "text-cyan-400 font-bold" : "text-white/60 hover:text-white"
              )}
            >
              <div className="relative">
                <Play size={18} className="fill-current opacity-40 group-hover:opacity-100 transition-opacity" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full animate-pulse border border-black" />
              </div>
               Watch Free
            </button>
            <button 
              onClick={() => { 
                setActiveTab('fifa');
              }}
              className={cn(
                "flex items-center gap-2 text-sm font-medium transition-all hover:scale-105 relative group",
                activeTab === 'fifa' ? "text-emerald-400 font-bold" : "text-white/60 hover:text-white"
              )}
            >
              <div className="relative">
                <Trophy size={18} className="text-yellow-400 group-hover:scale-110 transition-transform duration-300" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full animate-pulse border border-black" />
              </div>
              FIFA 2026
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-cyan-400 transition-colors" size={14} />
            <input 
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-full py-1.5 md:py-2 pl-9 pr-4 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 w-24 sm:w-48 md:w-64 transition-all focus:w-32 sm:focus:w-64 md:focus:w-80"
            />
          </div>
          
          {isLoggedIn ? (
            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={() => setShowProfileModal(true)}
                className="flex items-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/25 rounded-full pr-4 pl-1.5 py-1.5 transition-all group cursor-pointer"
                title="View Profile Details"
                id="profile-trigger-btn"
              >
                <div className="w-8 h-8 rounded-full bg-[#083344] overflow-hidden flex items-center justify-center select-none shrink-0 border border-cyan-400/50 shadow-[0_0_8px_rgba(6,182,212,0.3)]">
                  {renderAvatar(profileData.avatarId, profileData.customAvatar)}
                </div>
                <span className="text-xs text-white/90 font-medium group-hover:text-[#00D1FF] transition-colors hidden sm:inline-block">
                  {creds.username}
                </span>
              </button>
              
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-white/10 rounded-full transition-all hover:rotate-12 text-white/60 hover:text-white"
                title="Logout"
                id="logout-btn"
              >
                <LogOut size={18} className="md:w-5 md:h-5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-semibold transition-all shadow-lg shadow-cyan-900/20 active:scale-95"
            >
              <LogIn size={14} className="md:w-4 md:h-4" /> Login
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 space-y-6 md:space-y-8 pb-24 md:pb-8">
        {activeTab === 'home' ? (
          <div className="space-y-10">
            {loadingHome && homeData.popularMovies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4">
                <Loader2 className="animate-spin text-cyan-500" size={48} />
                <p className="text-white/40 font-medium">Loading Home Content...</p>
              </div>
            ) : error && homeData.popularMovies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 gap-6 text-center max-w-md mx-auto px-6">
                <div className="p-4 bg-red-500/10 rounded-full">
                  <AlertCircle className="text-red-500" size={48} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold">Connection Issue</h3>
                  <p className="text-white/40 text-sm">{error}</p>
                </div>
                <button 
                  onClick={() => window.location.reload()}
                  className="bg-cyan-500 text-black px-8 py-3 rounded-xl font-bold hover:bg-cyan-400 transition-all"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                {/* 1. Trending Movies Section (Top 10 Pakistan & India) */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl md:text-3xl font-display font-bold flex items-center gap-3 tracking-tight">
                      <span className="w-1.5 h-6 bg-cyan-500 rounded-full" />
                      Trending Movies
                    </h3>
                    {activeReseller?.app_link && (
                      <motion.a
                        href={activeReseller.app_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        className="relative overflow-hidden flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 text-white font-black uppercase tracking-wider text-[10px] sm:text-xs rounded-full shadow-[0_0_20px_rgba(16,185,129,0.45)] hover:shadow-[0_0_30px_rgba(52,211,153,0.7)] border border-white/20 transition-all duration-300 cursor-pointer select-none group"
                      >
                        {/* Premium continuous shine sweeping effect */}
                        <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-premium-shine" />

                        {/* Beautiful live pulsing indicator point */}
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-200"></span>
                        </span>

                        <Download size={14} className="text-white group-hover:translate-y-0.5 transition-transform duration-300" />
                        
                        <span className="relative z-10 text-white font-display font-black tracking-widest text-[9px] sm:text-[11px] drop-shadow-md">
                          Download App
                        </span>
                      </motion.a>
                    )}
                  </div>
                  
                  {loadingTrending ? (
                    <div className="flex items-center justify-center py-16 gap-3">
                      <Loader2 className="animate-spin text-cyan-500" size={28} />
                      <p className="text-white/40 text-sm">Fetching TMDB Trending Movies...</p>
                    </div>
                  ) : trendingMovies.length === 0 ? (
                    <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-white/40 text-sm">No trending movies loaded.</p>
                    </div>
                  ) : (
                    <div className="flex gap-2 md:gap-4 overflow-x-auto pb-6 pt-4 px-4 no-scrollbar scroll-smooth snap-x">
                      {trendingMovies.map((item, idx) => (
                        <motion.div
                          key={`trending-movie-${item.id}-${idx}`}
                          initial={{ opacity: 0, x: 50 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          whileHover={{ scale: 1.05 }}
                          onClick={() => handleTrendingClick(item, false)}
                          className="relative w-[115px] sm:w-[145px] md:w-[185px] h-[160px] sm:h-[200px] md:h-[250px] shrink-0 cursor-pointer snap-start group select-none flex-none"
                        >
                          {/* Custom Vertical Aspect Card aligned to the right half to make space for the overlapping number */}
                          <div className="absolute right-0 top-0 bottom-0 left-[20px] sm:left-[28px] md:left-[36px] rounded-2xl overflow-hidden border border-white/10 group-hover:border-cyan-400 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] shadow-xl shadow-black/80 z-10 transition-all duration-300">
                            <img
                              src={item.poster_url || 'https://picsum.photos/seed/movie/300/450'}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/movie/300/450?blur=1'; }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5">
                              <p className="text-[10px] md:text-sm font-bold truncate text-white">{item.title}</p>
                              <div className="flex items-center gap-1 text-[8px] md:text-xs text-yellow-400 font-bold mt-0.5">
                                <span>★ {item.rating || '8.2'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Giant Outline Number overlay styled like Netflix/Prime */}
                          <span 
                            className="absolute bottom-[-18px] md:bottom-[-26px] left-[-8px] text-[100px] sm:text-[130px] md:text-[180px] font-black font-sans leading-none z-20 select-none pointer-events-none drop-shadow-[0_8px_24px_rgba(0,0,0,0.95)] tracking-tighter"
                            style={{ 
                              WebkitTextStroke: '2.5px rgba(255, 255, 255, 0.85)',
                              WebkitTextFillColor: '#0a0a0c', // Matches dark background seamlessly
                            }}
                          >
                            {idx + 1}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </section>

                {/* 2. Recently Added Movies Section (Exactly 8 Movies, 2 Rows x 4 Items) */}
                <section className="space-y-5 pt-2">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl md:text-3xl font-display font-bold flex items-center gap-3 tracking-tight">
                      <span className="w-1.5 h-6 bg-cyan-500 rounded-full" />
                      Recently Added Movies
                    </h3>
                    <button 
                      onClick={() => setActiveTab('movies')}
                      className="text-cyan-400 text-xs md:text-sm font-bold hover:text-cyan-300 transition-colors flex items-center gap-1 bg-cyan-500/10 hover:bg-cyan-500/20 px-3.5 py-1.5 rounded-full border border-cyan-500/20"
                    >
                      View All <ChevronRight size={14} />
                    </button>
                  </div>
                  
                  {homeData.popularMovies.length === 0 ? (
                    <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-white/40 text-sm">No local server movies available.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-6">
                      {homeData.popularMovies.slice(0, 12).map((item, idx) => (
                        <motion.div 
                          key={`home-movie-${item.stream_id}-${idx}`}
                          initial={{ opacity: 0, scale: 0.95, y: 15 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ 
                            type: "spring",
                            damping: 22,
                            stiffness: 110,
                            delay: idx * 0.04 
                          }}
                          whileHover={{ scale: 1.03, y: -4 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleItemClick(item)}
                          className="group cursor-pointer space-y-2.5"
                        >
                          <div className="premium-card aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 group-hover:border-cyan-400 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.35)] shadow-xl transition-all duration-300">
                            <img 
                              src={item.stream_icon || null} 
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/movie/400/600?blur=1'; }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
                              <div className="flex items-center gap-2 bg-cyan-500 text-black px-4 py-2 rounded-full text-xs font-bold mx-auto shadow-lg shadow-cyan-500/20 transform translate-y-3 group-hover:translate-y-0 transition-transform duration-305">
                                <Play size={12} fill="currentColor" /> Play Now
                              </div>
                            </div>
                          </div>
                          <div className="px-1.55">
                            <h4 className="text-[11px] md:text-sm font-bold line-clamp-1 group-hover:text-cyan-400 transition-colors uppercase tracking-wide">{item.name}</h4>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </section>

                {/* 3. Trending Web Series Section (Top 10 Pakistan & India) */}
                <section className="space-y-4 pt-6">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl md:text-3xl font-display font-bold flex items-center gap-3 tracking-tight">
                      <span className="w-1.5 h-6 bg-cyan-500 rounded-full" />
                      Trending Web Series
                    </h3>
                  </div>
                  
                  {loadingTrending ? (
                    <div className="flex items-center justify-center py-16 gap-3">
                      <Loader2 className="animate-spin text-cyan-500" size={28} />
                      <p className="text-white/40 text-sm">Fetching TMDB Trending Series...</p>
                    </div>
                  ) : trendingSeries.length === 0 ? (
                    <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-white/40 text-sm">No trending series loaded.</p>
                    </div>
                  ) : (
                    <div className="flex gap-2 md:gap-4 overflow-x-auto pb-6 pt-4 px-4 no-scrollbar scroll-smooth snap-x">
                      {trendingSeries.map((item, idx) => (
                        <motion.div
                          key={`trending-series-${item.id}-${idx}`}
                          initial={{ opacity: 0, x: 50 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          whileHover={{ scale: 1.05 }}
                          onClick={() => handleTrendingClick(item, true)}
                          className="relative w-[115px] sm:w-[145px] md:w-[185px] h-[160px] sm:h-[200px] md:h-[250px] shrink-0 cursor-pointer snap-start group select-none flex-none"
                        >
                          {/* Custom Vertical Aspect Card aligned to the right half to make space for the overlapping number */}
                          <div className="absolute right-0 top-0 bottom-0 left-[20px] sm:left-[28px] md:left-[36px] rounded-2xl overflow-hidden border border-white/10 group-hover:border-cyan-400 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] shadow-xl shadow-black/80 z-10 transition-all duration-300">
                            <img
                              src={item.poster_url || 'https://picsum.photos/seed/series/300/450'}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/series/300/450?blur=1'; }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5">
                              <p className="text-[10px] md:text-sm font-bold truncate text-white">{item.title}</p>
                              <div className="flex items-center gap-1 text-[8px] md:text-xs text-yellow-400 font-bold mt-0.5">
                                <span>★ {item.rating || '8.4'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Giant Outline Number overlay styled like Netflix/Prime */}
                          <span 
                            className="absolute bottom-[-18px] md:bottom-[-26px] left-[-8px] text-[100px] sm:text-[130px] md:text-[180px] font-black font-sans leading-none z-20 select-none pointer-events-none drop-shadow-[0_8px_24px_rgba(0,0,0,0.95)] tracking-tighter"
                            style={{ 
                              WebkitTextStroke: '2.5px rgba(255, 255, 255, 0.85)',
                              WebkitTextFillColor: '#0a0a0c', // Matches dark background seamlessly
                            }}
                          >
                            {idx + 1}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </section>

                {/* 4. Recently Added Web Series Section (Exactly 8 Series, 2 Rows x 4 Items) */}
                <section className="space-y-5 pt-2">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl md:text-3xl font-display font-bold flex items-center gap-3 tracking-tight">
                      <span className="w-1.5 h-6 bg-cyan-500 rounded-full" />
                      Recently Added Web Series
                    </h3>
                    <button 
                      onClick={() => setActiveTab('series')}
                      className="text-cyan-400 text-xs md:text-sm font-bold hover:text-cyan-300 transition-colors flex items-center gap-1 bg-cyan-500/10 hover:bg-cyan-500/20 px-3.5 py-1.5 rounded-full border border-cyan-500/20"
                    >
                      View All <ChevronRight size={14} />
                    </button>
                  </div>
                  
                  {homeData.popularSeries.length === 0 ? (
                    <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/5">
                      <p className="text-white/40 text-sm">No local server series available.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-6">
                      {homeData.popularSeries.slice(0, 12).map((item, idx) => (
                        <motion.div 
                          key={`home-series-${item.series_id}-${idx}`}
                          initial={{ opacity: 0, scale: 0.95, y: 15 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ 
                            type: "spring",
                            damping: 22,
                            stiffness: 110,
                            delay: idx * 0.04 
                          }}
                          whileHover={{ scale: 1.03, y: -4 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleItemClick(item)}
                          className="group cursor-pointer space-y-2.5"
                        >
                          <div className="premium-card aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 group-hover:border-cyan-400 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.35)] shadow-xl transition-all duration-300">
                            <img 
                              src={item.cover || null} 
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/series/400/600?blur=1'; }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
                              <div className="flex items-center gap-2 bg-cyan-500 text-black px-4 py-2 rounded-full text-xs font-bold mx-auto shadow-lg shadow-cyan-500/20 transform translate-y-3 group-hover:translate-y-0 transition-transform duration-305">
                                <Play size={12} fill="currentColor" /> Play Now
                              </div>
                            </div>
                          </div>
                          <div className="px-1.5">
                            <h4 className="text-[11px] md:text-sm font-bold line-clamp-1 group-hover:text-cyan-400 transition-colors uppercase tracking-wide">{item.name}</h4>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        ) : activeTab === 'live' ? (
          !isLoggedIn ? (
            <div className="flex flex-col items-center justify-center py-32 gap-6 text-center max-w-lg mx-auto px-6 glass rounded-[2.5rem] border border-white/20 shadow-2xl shadow-cyan-500/5">
              <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 mb-2">
                <Lock size={40} className="text-cyan-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-display font-black text-white italic tracking-tighter uppercase">Live TV Locked</h3>
                <p className="text-white/40 text-sm font-medium italic tracking-wide max-w-xs mx-auto">
                  Premium Live TV signals are only accessible to registered users. Please login to continue.
                </p>
              </div>
              <button 
                onClick={() => setShowLoginModal(true)}
                className="premium-button premium-button-primary px-10 py-4 text-base shadow-lg shadow-cyan-500/20"
              >
                <LogIn size={20} /> Login to Access
              </button>
            </div>
          ) : (
          <div className="flex flex-col gap-6">
            {/* IPTV Layout for Live TV */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Left Column: Player (Span 2) */}
              <div className="md:col-span-2 space-y-4">
                <div className="relative aspect-video rounded-[2rem] overflow-hidden bg-black border border-white/10 shadow-2xl group group-hover:border-cyan-500/50 transition-all duration-500">
                  {playingLiveStream ? (
                    <div className="w-full h-full">
                       <VideoPlayer 
                        key={`live-player-${playingLiveStream.stream_id}`}
                        options={{
                          autoplay: true,
                          controls: true,
                          responsive: true,
                          fluid: true,
                          is_embed: false,
                          isLive: true,
                          sources: [{
                            src: `${currentServerHost}/live/${creds.username}/${creds.password}/${playingLiveStream.stream_id}.m3u8`,
                            type: 'application/x-mpegURL'
                          }]
                        }} 
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a0b] group">
                      <div className="w-20 h-20 rounded-3xl bg-cyan-500/5 flex items-center justify-center border border-cyan-500/10 mb-6 group-hover:scale-110 transition-transform duration-500">
                        <Tv size={40} className="text-cyan-500/40" />
                      </div>
                      <h3 className="text-xl font-display font-bold text-white italic tracking-tight uppercase">Premium IPTV Player</h3>
                      <p className="text-white/30 text-xs mt-2 uppercase tracking-[0.2em] font-medium">Select a channel to start streaming</p>
                    </div>
                  )}
                </div>

                {playingLiveStream && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-row items-center justify-between p-2.5 sm:p-3 glass rounded-2xl border border-white/10 gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {playingLiveStream.stream_icon && (
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 bg-white/5 shrink-0 hidden xs:block">
                          <img 
                            src={playingLiveStream.stream_icon} 
                            alt=""
                            className="w-full h-full object-contain p-0.5"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/live/200/200?blur=1'; }}
                          />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h2 className="text-[11px] sm:text-xs font-display font-black text-white italic tracking-tight uppercase truncate">{playingLiveStream.name}</h2>
                        <span className="text-[8px] text-cyan-400 font-bold uppercase tracking-widest block opacity-60 leading-none">1080P Signal</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 font-sans">
                      {isLoggedIn && (
                        <button 
                          onClick={() => toggleItemFavorite(playingLiveStream)}
                          className={cn(
                            "p-1.5 sm:p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-lg active:scale-95 duration-200",
                            isItemFavorite(playingLiveStream)
                              ? "bg-red-500/15 border-red-500/40 text-red-500 hover:bg-red-500/25 shadow-red-500/10"
                              : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10 hover:border-white/20"
                          )}
                          title={isItemFavorite(playingLiveStream) ? "Remove from Favorites" : "Add to Favorites"}
                        >
                          <Heart size={12} fill={isItemFavorite(playingLiveStream) ? "currentColor" : "none"} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleAction('copy', playingLiveStream)}
                        className="p-1.5 sm:p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/10 text-white/60 hover:text-white"
                        title="Copy"
                      >
                        {copiedId === playingLiveStream.stream_id ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                      </button>
                      <button 
                        onClick={() => window.location.href = formatVlcUrl(`${currentServerHost}/live/${creds.username}/${creds.password}/${playingLiveStream.stream_id}.m3u8`)}
                        className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg font-black text-[9px] transition-all shadow-lg shadow-orange-500/20 uppercase tracking-widest italic"
                      >
                        <Play size={12} fill="white" /> VLC
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
 
              {/* Right Column: Categories & Channels List */}
              <div className="md:col-span-1 md:h-[calc(100vh-280px)] min-h-[500px] flex flex-col gap-6">
                {/* Categories Scroll */}
                <div className="flex flex-col gap-3 md:hidden">
                  <h3 className="text-xs font-black text-white/30 uppercase tracking-[0.3em] px-2 italic">Categories</h3>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    {currentCategories.map((cat, idx) => (
                      <button
                        key={`iptv-cat-${cat.category_id}-${idx}`}
                        onClick={() => setSelectedLiveCategory(cat.category_id)}
                        className={cn(
                          "whitespace-nowrap px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 italic",
                          selectedLiveCategory === cat.category_id 
                            ? "bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]" 
                            : "bg-white/5 text-white/40 hover:text-white border border-white/5 hover:border-white/10"
                        )}
                      >
                        {cat.category_name}
                      </button>
                    ))}
                  </div>
                </div>
 
                {/* Channels List Grid with Search */}
                <div className="flex-1 glass rounded-[2.5rem] border border-white/10 overflow-hidden flex flex-col min-h-[400px]">
                  <div className="p-4 border-b border-white/5 bg-white/5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-white uppercase tracking-widest italic flex items-center gap-2">
                        <Tv size={14} className="text-cyan-400" /> Live Grid
                      </h3>
                      <span className="text-[10px] font-bold text-white/30 tracking-tighter">Category: {currentCategories.find(c => c.category_id === selectedLiveCategory)?.category_name || "All"}</span>
                    </div>
                    
                    {/* Channel Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                      <input 
                        type="text"
                        placeholder="Search Channel..."
                        value={liveSearchQuery}
                        onChange={(e) => setLiveSearchQuery(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50 transition-all italic font-medium"
                      />
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto no-scrollbar p-4">
                    {loadingLive ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="animate-spin text-cyan-500" size={32} />
                        <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Scanning channels...</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {currentItems
                          .filter(item => item.name.toLowerCase().includes(liveSearchQuery.toLowerCase()))
                          .map((item, idx) => (
                          <motion.button
                            key={`iptv-channel-${(item as any).stream_id}-${idx}`}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: Math.min(idx * 0.005, 0.1) }}
                            onClick={() => {
                              setPlayingLiveStream(item as any);
                              trackMediaPlayback(item as any, 'live_event', (item as any).name || 'Live Channel');
                              // Scroll to top on mobile when selecting a channel
                              if (window.innerWidth < 1024) {
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }
                            }}
                            className={cn(
                              "flex flex-col items-center gap-2 p-2 rounded-2xl transition-all border group relative aspect-square justify-center text-center",
                              playingLiveStream?.stream_id === (item as any).stream_id
                                ? "bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                                : "bg-white/2 hover:bg-white/5 border-transparent hover:border-white/10"
                            )}
                          >
                            <div className="w-full aspect-square max-w-[50px] rounded-xl bg-black/40 border border-white/5 overflow-hidden flex items-center justify-center p-1.5 shrink-0 group-hover:scale-110 transition-transform duration-300">
                              {(item as any).stream_icon ? (
                                <img 
                                  src={(item as any).stream_icon} 
                                  alt="" 
                                  className="w-full h-full object-contain"
                                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/tv/100/100?blur=5'; }}
                                />
                              ) : (
                                <Tv size={20} className="text-white/20" />
                              )}
                            </div>
                            <h4 className={cn(
                              "text-[8px] font-black uppercase tracking-tight line-clamp-2 leading-tight px-1 italic",
                              playingLiveStream?.stream_id === (item as any).stream_id ? "text-cyan-400" : "text-white/60 group-hover:text-white"
                            )}>
                              {item.name}
                            </h4>
                            
                            {playingLiveStream?.stream_id === (item as any).stream_id && (
                              <div className="absolute top-1 right-1">
                                <motion.div 
                                  animate={{ scale: [1, 1.2, 1] }}
                                  transition={{ repeat: Infinity, duration: 2 }}
                                  className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" 
                                />
                              </div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                    )}
                    
                    {currentItems.length > 0 && currentItems.filter(item => item.name.toLowerCase().includes(liveSearchQuery.toLowerCase())).length === 0 && (
                      <div className="flex flex-col items-center justify-center py-20 text-white/20">
                        <Search size={32} className="mb-3 opacity-10" />
                        <span className="text-[10px] font-bold uppercase tracking-widest italic">No Channels Matching</span>
                      </div>
                    )}

                    {/* Scroll Sentinel for Lazy Loading */}
                    {hasMore && !loadingLive && (
                      <div 
                        ref={loadMoreRef} 
                        className="flex justify-center py-8"
                      >
                        <Loader2 className="animate-spin text-cyan-500/40" size={20} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Rightmost Column: Vertical Categories list (visible only on desktop) */}
              <div className="hidden md:flex flex-col gap-4 md:col-span-1 sticky top-24 self-start bg-black/25 p-4 rounded-[2rem] border border-white/5 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-2 px-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                    <LayoutGrid size={16} className="text-cyan-400" />
                  </div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest italic">Categories</h3>
                </div>
                <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-320px)] desktop-scrollbar pr-1">
                  {currentCategories.map((cat, idx) => (
                    <button
                      key={`iptv-cat-vertical-${cat.category_id}-${idx}`}
                      onClick={() => setSelectedLiveCategory(cat.category_id)}
                      className={cn(
                        "relative text-left px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 italic w-full",
                        selectedLiveCategory === cat.category_id 
                          ? "bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]" 
                          : "bg-white/5 text-white/40 hover:text-white border border-white/5 hover:border-white/10"
                      )}
                    >
                      {cat.category_name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) ) : activeTab === 'free' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeFreeTab === 'menu' ? (
              <div className="relative max-w-4xl mx-auto space-y-12 py-8 px-4">
                <div className="text-center space-y-8">
                  <div className="flex flex-col items-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-700 rounded-[2.5rem] flex items-center justify-center mb-6 border border-white/30 shadow-[0_0_50px_rgba(34,211,238,0.3)] relative group overflow-hidden">
                      <Play className="text-white relative z-10 fill-white" size={48} />
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-30" 
                      />
                    </div>
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex items-center justify-center gap-4 w-full">
                        <h2 className="text-5xl font-black text-white tracking-tighter italic uppercase whitespace-nowrap">
                          FREE <span className="text-cyan-400 uppercase">ACCESS</span>
                        </h2>
                        <motion.button 
                          whileHover={{ scale: 1.1, rotate: 180 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setShowAdminLogin(true)}
                          className="p-3 bg-white/5 hover:bg-cyan-500/20 rounded-2xl transition-all border border-white/10 group shadow-lg flex items-center justify-center"
                        >
                          <Settings size={28} className="text-white/40 group-hover:text-cyan-400" />
                        </motion.button>
                      </div>
                      <p className="text-white/40 font-medium tracking-[0.2em] uppercase text-xs italic">Experience {currentBrandName} Luxury Without Login</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 px-2 md:px-4 max-w-5xl mx-auto border-transparent">
                  {[
                    { 
                      id: 'psl',
                      label: 'CRICKET LIVE', 
                      title: appSettings.psl_title || 'PSL', 
                      icon: <Play size={28} className="text-white fill-white drop-shadow-lg" />, 
                      color: 'from-emerald-400 to-green-600', 
                      glow: 'shadow-emerald-500/20',
                      border: 'border-emerald-500/20',
                      enabled: appSettings.psl_enabled,
                      onClick: () => { setSelectedPslLanguage('urdu'); setShowPSLPlayer(true); }
                    },
                    { 
                      id: 'ipl',
                      label: 'IPL LIVE', 
                      title: appSettings.ipl_title || 'IPL', 
                      icon: (
                        <img 
                          src="https://upload.wikimedia.org/wikipedia/en/thumb/8/84/Indian_Premier_League_Official_Logo.svg/200px-Indian_Premier_League_Official_Logo.svg.png" 
                          className="w-10 h-10 md:w-14 md:h-14 object-contain brightness-110 contrast-125" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (target.src !== 'https://www.iplt20.com/assets/images/IPL-logo-new-old.png') {
                                target.src = 'https://www.iplt20.com/assets/images/IPL-logo-new-old.png';
                            }
                          }}
                        />
                      ), 
                      color: 'from-blue-400 to-indigo-600', 
                      glow: 'shadow-blue-500/20',
                      border: 'border-blue-500/20',
                      enabled: appSettings.ipl_enabled,
                      onClick: () => { setShowIPLPlayer(true); }
                    },
                    { 
                      id: 'movies',
                      label: 'MOVIES', 
                      title: appSettings.free_movies_title || 'M O V I E S', 
                      icon: <Film size={28} className="text-white drop-shadow-lg" />, 
                      color: 'from-cyan-400 to-blue-600', 
                      glow: 'shadow-cyan-500/20',
                      border: 'border-cyan-500/20',
                      enabled: appSettings.free_movies_enabled,
                      showLive: false,
                      onClick: () => { setActiveFreeTab('movies'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
                    },
                    { 
                      id: 'series',
                      label: 'WEB SERIES', 
                      title: appSettings.free_series_title || 'WEB SERIES', 
                      icon: <Tv size={28} className="text-white drop-shadow-lg" />, 
                      color: 'from-purple-400 to-indigo-600', 
                      glow: 'shadow-purple-500/20',
                      border: 'border-purple-500/20',
                      enabled: appSettings.free_series_enabled,
                      showLive: false,
                      onClick: () => { setActiveFreeTab('series'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
                    },
                    { 
                      id: 'live_events',
                      label: 'LIVE EVENTS', 
                      title: appSettings.live_events_title || 'LIVE EVENTS', 
                      icon: <Radio size={28} className="text-white drop-shadow-lg animate-pulse" />, 
                      color: 'from-rose-400 to-red-600', 
                      glow: 'shadow-rose-500/20',
                      border: 'border-rose-500/20',
                      enabled: appSettings.live_events_enabled,
                      showLive: true,
                      onClick: () => { setActiveFreeTab('live_events'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
                    }
                  ].filter(item => item.enabled).map((item, i) => (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1, duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
                      whileHover={{ y: -10, scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={item.onClick}
                      className={cn(
                        "group relative p-6 md:p-10 rounded-[2.5rem] bg-black/40 flex flex-col items-center justify-center gap-6 transition-all duration-500 shadow-2xl backdrop-blur-xl overflow-hidden min-h-[160px] md:min-h-[260px] border",
                        item.border,
                        item.glow
                      )}
                    >
                      {/* Animated Glow Background */}
                      <div className={cn(
                        "absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br opacity-10 group-hover:opacity-30 blur-3xl transition-opacity duration-700",
                        item.color
                      )} />
                      
                      <div className={cn(
                        "w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br rounded-3xl flex items-center justify-center shadow-2xl ring-1 ring-white/20 transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 relative overflow-hidden",
                        item.color
                      )}>
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        {item.icon}
                      </div>

                      <div className="text-center space-y-2 relative z-10">
                        <p className="text-[8px] md:text-[11px] text-white/50 font-black uppercase tracking-[0.3em] font-display">{item.label}</p>
                        <h4 className="text-white font-display font-black text-xs md:text-2xl italic tracking-tight uppercase leading-none">{item.title}</h4>
                      </div>

                      {/* Premium Badge - Only for Live sections */}
                      {(item.showLive !== false) && (
                        <div className="absolute top-4 right-4">
                          <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-full border border-white/5 backdrop-blur-md">
                            <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", `bg-${item.color.split('-')[1]}`)} />
                            <span className="text-[6px] font-black text-white/40 uppercase tracking-widest">Live</span>
                          </div>
                        </div>
                      )}
                    </motion.button>
                  ))}
                  { [appSettings.psl_enabled, appSettings.ipl_enabled, appSettings.free_movies_enabled, appSettings.free_series_enabled].every(e => !e) && (
                    <div className="col-span-full py-20 text-center space-y-6 animate-in fade-in zoom-in duration-500">
                      <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10 shadow-inner">
                        <AlertCircle className="text-white/10" size={48} />
                      </div>
                      <div className="space-y-2">
                        <p className="text-white/40 font-black uppercase tracking-[0.3em] text-xs">Service Maintenance</p>
                        <p className="text-white/20 text-[10px] uppercase font-medium tracking-widest">Premium Categories are currently private</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-center pt-8">
                  <div className="px-8 py-4 glass rounded-3xl border border-white/10 text-center max-w-sm mx-auto">
                    <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] italic">
                      Proprietary Delivery • Ultra-Stream Engine • {currentBrandName} Luxury Access
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8 pb-12">
                <div className="flex flex-col md:flex-row items-center justify-between px-4 gap-4">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setActiveFreeTab('menu')}
                      className="flex items-center gap-2 text-white/40 hover:text-white font-black uppercase text-xs tracking-widest transition-all bg-white/5 px-6 py-3 rounded-2xl border border-white/10"
                    >
                      <ArrowLeft size={18} /> Back to Free Menu
                    </button>
                    <button 
                      onClick={() => setShowAdminLogin(true)}
                      className="p-3 bg-white/5 hover:bg-cyan-500/20 rounded-2xl transition-all border border-white/10 group shadow-lg"
                    >
                      <Settings size={18} className="text-white/40 group-hover:text-cyan-400" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      activeFreeTab === 'movies' ? 'bg-cyan-500/20 text-cyan-400' : 
                      activeFreeTab === 'series' ? 'bg-purple-500/20 text-purple-400' : 
                      'bg-rose-500/20 text-rose-400'
                    }`}>
                      {activeFreeTab === 'movies' ? <Film size={20} /> : 
                       activeFreeTab === 'series' ? <Tv size={20} /> : 
                       <Radio size={20} className="animate-pulse" />}
                    </div>
                    <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">
                      {activeFreeTab === 'movies' ? (appSettings.free_movies_title || 'Free Movies') : 
                       activeFreeTab === 'series' ? (appSettings.free_series_title || 'Free Series') : 
                       (appSettings.live_events_title || 'Live Events')}
                    </h3>
                  </div>
                </div>

                <div className="px-4">
                  {activeFreeTab === 'movies' && (
                    isMoviesLoading ? (
                      <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Loader2 className="animate-spin text-cyan-500" size={48} />
                        <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Loading Premium Movies...</p>
                      </div>
                    ) : freeMovies.length === 0 ? (
                      <div className="text-center py-20 glass rounded-[3rem] border border-white/5">
                        <Film size={48} className="text-white/10 mx-auto mb-4" />
                        <p className="text-white/40 font-bold italic">No free movies found at this time.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {freeMovies.map((movie: any) => (
                          <motion.div 
                            key={movie.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -8, scale: 1.02 }}
                            className="group cursor-pointer"
                            onClick={() => { handleSelectFreeMovieWithPass(movie); }}
                          >
                            <div className="aspect-[2/3] rounded-[2rem] overflow-hidden border border-white/10 bg-white/5 relative shadow-2xl">
                              <img 
                                src={movie.poster_url || null} 
                                alt={movie.name} 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-5">
                                <h4 className="text-white font-black text-sm italic tracking-tighter line-clamp-2 uppercase leading-tight mb-2 group-hover:text-cyan-400 transition-colors">{movie.name}</h4>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/40 rounded-lg text-[8px] font-black text-cyan-400 uppercase tracking-widest">Premium</span>
                                </div>
                              </div>
                              <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                <div className="w-14 h-14 rounded-full bg-cyan-500 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.6)] scale-0 group-hover:scale-100 transition-transform duration-500">
                                  <Play size={28} className="text-white fill-white ml-1" />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )
                  )}

                  {activeFreeTab === 'series' && (
                    isSeriesLoading ? (
                      <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Loader2 className="animate-spin text-purple-500" size={48} />
                        <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Loading Premium Series...</p>
                      </div>
                    ) : freeSeries.length === 0 ? (
                      <div className="text-center py-20 glass rounded-[3rem] border border-white/5">
                        <Tv size={48} className="text-white/10 mx-auto mb-4" />
                        <p className="text-white/40 font-bold italic">No free series found at this time.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {freeSeries.map((series: any) => (
                          <motion.div 
                            key={series.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -8, scale: 1.02 }}
                            className="group cursor-pointer"
                            onClick={() => { handleSelectFreeSeriesWithPass(series); }}
                          >
                            <div className="aspect-[2/3] rounded-[2rem] overflow-hidden border border-white/10 bg-white/5 relative shadow-2xl">
                              <img 
                                src={series.poster_url || null} 
                                alt={series.name} 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-5">
                                <h4 className="text-white font-black text-sm italic tracking-tighter line-clamp-2 uppercase leading-tight mb-2 group-hover:text-purple-400 transition-colors">{series.name}</h4>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/40 rounded-lg text-[8px] font-black text-purple-400 uppercase tracking-widest">Premium</span>
                                </div>
                              </div>
                              <div className="absolute inset-0 bg-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                <div className="w-14 h-14 rounded-full bg-purple-500 flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.6)] scale-0 group-hover:scale-100 transition-transform duration-500">
                                  <Play size={28} className="text-white fill-white ml-1" />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )
                  )}

                  {activeFreeTab === 'live_events' && (
                    isLiveEventsLoading ? (
                      <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Loader2 className="animate-spin text-rose-500" size={48} />
                        <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Loading Live Events...</p>
                      </div>
                    ) : liveEvents.length === 0 ? (
                      <div className="text-center py-20 glass rounded-[3rem] border border-white/5">
                        <Radio size={48} className="text-white/10 mx-auto mb-4 animate-pulse" />
                        <p className="text-white/40 font-bold italic">No live events scheduled at the moment.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                        {liveEvents.map((item: any) => (
                          <motion.div 
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -8, scale: 1.02 }}
                            className="group cursor-pointer relative"
                            onClick={() => {
                              setSelectedLiveEvent(item);
                              trackMediaPlayback(item, 'live_event', item.channels?.[0]?.name || 'Primary Feed');
                            }}
                          >
                            <div className="aspect-[2/3] rounded-[2rem] overflow-hidden border border-white/10 bg-white/5 relative shadow-2xl">
                              <img 
                                src={item.poster_url || null} 
                                alt={item.name} 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                                referrerPolicy="no-referrer"
                              />
                              
                              {/* Live indicator tag */}
                              <div className="absolute top-4 left-4 bg-red-600/90 text-white font-black text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg shadow-red-600/30">
                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                                <span>LIVE</span>
                              </div>

                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-5">
                                <h4 className="text-white font-black text-sm italic tracking-tighter line-clamp-2 uppercase leading-tight mb-2 group-hover:text-rose-400 transition-colors">
                                  {item.name}
                                </h4>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-rose-500/20 border border-rose-500/40 rounded-lg text-[8px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1">
                                    <Radio size={10} className="animate-pulse" /> {item.channels?.length || 0} feeds
                                  </span>
                                </div>
                              </div>
                              <div className="absolute inset-0 bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                <div className="w-14 h-14 rounded-full bg-rose-600 flex items-center justify-center shadow-[0_0_30px_rgba(244,63,94,0.6)] scale-0 group-hover:scale-100 transition-transform duration-500">
                                  <Play size={28} className="text-white fill-white ml-1" />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'fifa' ? (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="relative overflow-hidden bg-gradient-to-br from-[#021f0b] via-[#040905] to-[#010903] border border-emerald-500/30 rounded-[2.5rem] p-6 md:p-8 shadow-[0_0_80px_rgba(16,185,129,0.15)] text-white">
              {/* Glowing background */}
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl animate-pulse" />
              <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />

              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10 pb-6 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-yellow-500/10 rounded-2xl flex items-center justify-center border border-yellow-500/30 shadow-lg shadow-yellow-500/5">
                    <Trophy size={28} className="text-yellow-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-display font-black text-white italic tracking-tight uppercase leading-none">
                      FIFA WORLD CUP 2026
                    </h2>
                    <span className="text-[10px] md:text-xs text-emerald-400 font-bold uppercase tracking-widest mt-2 block leading-none">
                      EXCLUSIVE PREMIUM FEEDS
                    </span>
                  </div>
                </div>
                
                <button 
                  onClick={() => setActiveTab('home')}
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all border border-white/10 hover:border-white/20 active:scale-95 cursor-pointer"
                >
                  <Home size={14} /> Back to Home
                </button>
              </div>

              <div className="py-6 space-y-8 relative z-10">
                {/* FIFA Channels Grid */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-l-4 border-emerald-500 pl-3">
                    <h3 className="text-xs font-black text-white/90 uppercase tracking-[0.25em] italic">
                      📡 Live FIFA Arena Signals
                    </h3>
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
                      SECURE LIVE
                    </span>
                  </div>

                  {isFifaChannelsLoading ? (
                    <div className="flex items-center justify-center py-12 gap-2 bg-emerald-950/5 border border-emerald-500/10 rounded-2xl">
                      <Loader2 className="animate-spin text-emerald-400" size={18} />
                      <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Connecting Live Feeds...</p>
                    </div>
                  ) : fifaChannels.length === 0 ? (
                    <div className="text-center py-12 px-4 border border-dashed border-emerald-500/10 rounded-2xl bg-emerald-950/5">
                      <Trophy size={18} className="text-white/20 mx-auto mb-2 animate-bounce" />
                      <p className="text-[10px] font-bold uppercase text-white/40 tracking-wider">No live channels mapped by admin yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {fifaChannels.map((chan, idx) => {
                        const isPremiumChan = chan.feed_type === 'iptv' || chan.is_iptv || !!chan.stream_id || chan.is_premium === true;
                        
                        return (
                          <div 
                            key={`fifa-signal-${chan.id}-${idx}`}
                            className="flex items-center justify-between bg-gradient-to-r from-[#031c0a]/40 to-[#040905] p-4 rounded-2xl border border-emerald-500/10 hover:border-emerald-500/30 hover:scale-[1.01] transition-all duration-300 group shadow-lg"
                          >
                            <div className="flex items-start gap-3 pr-2 min-w-0 flex-1">
                              {/* Visual Indicator of Connection Type */}
                              <div className="w-10 h-10 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                {chan.feed_type === 'iptv' || chan.is_iptv || chan.stream_id ? (
                                  <Crown size={16} className="text-yellow-400 animate-pulse" />
                                ) : (
                                  <Tv size={16} className="text-emerald-400" />
                                )}
                              </div>

                              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                <span className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                                  {chan.order !== undefined && chan.order !== 999999 ? `${chan.order}. ` : ''}{chan.name}
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase leading-none ${
                                    chan.status === 'Offline' ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-400 animate-pulse'
                                  }`}>
                                    {chan.status || 'Live'}
                                  </span>
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase leading-none flex items-center gap-1 ${
                                    isPremiumChan 
                                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/25' 
                                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                  }`}>
                                    {isPremiumChan ? <Lock size={9} /> : <Unlock size={9} />}
                                    {isPremiumChan ? 'Premium/لاگ ان' : 'Free/مفت'}
                                  </span>
                                  <span className="text-[7px] text-white/30 font-bold uppercase tracking-widest leading-none">
                                    {chan.feed_type === 'iptv' || chan.is_iptv || chan.stream_id ? '🌟 PREMIUM SUBSCRIPTION FEED' : '🔗 DIRECT STRETCH FEED'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <button 
                              onClick={() => {
                                if (isPremiumChan && !isLoggedIn) {
                                  showToast("یہ ایک پریمیم چیاینل ہے، براہ کرم پہلے لاگ ان کریں یا سبسکرپشن حاصل کریں۔", "error");
                                  setShowLoginModal(true);
                                  return;
                                }
                                const playUrl = getFifaPlayUrl(chan);
                                setPlayingFifaChannel({
                                  ...chan,
                                  play_url: playUrl
                                });
                                trackMediaPlayback(chan, 'fifa');
                              }}
                              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md cursor-pointer active:scale-95 shrink-0"
                            >
                              <Play size={10} fill="black" />
                              PLAY
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* WhatsApp community banner */}
              {currentWhatsappGroupLink && (
                <div className="pt-6 border-t border-emerald-500/20 bg-gradient-to-b from-transparent to-[#011d0b]/40 flex flex-col items-center justify-center gap-4 rounded-b-[2.5rem] p-4 text-center">
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-[0.25em] italic leading-relaxed max-w-lg">
                    Share Live Football Chats with {currentBrandName} Luxury Community
                  </p>
                  <a 
                    href={currentWhatsappGroupLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white px-8 py-3 rounded-xl font-bold text-[10px] transition-all shadow-[0_0_20px_rgba(37,211,102,0.3)] uppercase tracking-widest cursor-pointer active:scale-95"
                  >
                    <MessageCircle size={14} fill="white" />
                    JOIN FOOTBALL WHATSAPP
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-8 items-start w-full">
            {/* Premium Category Side Panel (Vertical on desktop, Drawer on mobile) */}
            <div className="w-full md:w-72 md:shrink-0 md:sticky md:top-24 space-y-4">
              
              {/* Desktop Header */}
              <div className="hidden md:flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                    <LayoutGrid size={16} className="text-cyan-400" />
                  </div>
                  <h3 className="text-lg font-display font-bold text-white tracking-tight">Categories</h3>
                </div>
                {!currentLoading && currentItems.length > 0 && (
                  <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                      {currentItems.length} {currentItems.length > 200 ? "Titles Available" : "Titles"}
                    </span>
                  </div>
                )}
              </div>

              {/* Mobile Beautiful Interactive Category Selector Card */}
              <div 
                onClick={() => setIsMobileCategoriesOpen(true)}
                className="flex md:hidden items-center justify-between bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl p-4 cursor-pointer active:scale-98 transition-all duration-300"
                id="mobile-category-selector-trigger"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                    <LayoutGrid size={20} className="text-cyan-400 animate-pulse" />
                  </div>
                  <div className="text-left">
                    <span className="text-[9px] text-cyan-400 font-black uppercase tracking-widest block leading-none mb-1">Select Category</span>
                    <h3 className="text-sm font-display font-bold text-white tracking-tight leading-none">
                      {currentCategories.find(c => c.category_id === currentSelectedCategory)?.category_name || "All Categories"}
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!currentLoading && currentItems.length > 0 && (
                    <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                      <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                        {currentItems.length} Titles
                      </span>
                    </div>
                  )}
                  <ChevronRight size={16} className="text-white/40" />
                </div>
              </div>

              {/* Desktop Categories Scroll List */}
              <div className="relative group w-full hidden md:block">
                <div className="flex flex-col items-stretch gap-2 overflow-y-auto max-h-[calc(100vh-240px)] desktop-scrollbar pr-1">
                  {currentCategories.map((cat, idx) => (
                    <button
                      key={`${activeTab}-cat-${cat.category_id}-${idx}`}
                      onClick={() => setCurrentSelectedCategory(cat.category_id)}
                      className={cn(
                        "relative text-left px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 w-full shrink-0 md:shrink",
                        currentSelectedCategory === cat.category_id 
                          ? "text-black" 
                          : "text-white/50 hover:text-white bg-white/5 border border-white/5 hover:border-white/20"
                      )}
                    >
                      {currentSelectedCategory === cat.category_id && (
                        <motion.div
                          layoutId="activeCategory"
                          className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                      <div className="relative z-10 flex items-center justify-between">
                        <span className="leading-tight truncate pr-2">{cat.category_name}</span>
                        {cat.category_id === '0' && (
                          <span className="text-[9px] opacity-60 font-medium mt-0.5 whitespace-nowrap shrink-0">
                            {activeTab === 'movies' ? totalMovieCount : (activeTab === 'series' ? totalSeriesCount : totalLiveCount)} Items
                          </span>
                        )}
                        {cat.category_id === 'favorites' && (
                          <span className="text-[9px] opacity-60 font-medium mt-0.5 whitespace-nowrap shrink-0">
                            {(() => {
                              const typeMap = { 'movies': 'movie', 'series': 'series', 'live': 'live' };
                              const currentType = typeMap[activeTab as 'movies' | 'series' | 'live'] || 'movie';
                              return favorites.filter((fav: any) => fav.type === currentType).length;
                            })()} Saved
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content Grid Container (Left side on desktop) */}
            <div className="flex-1 w-full">
              {currentLoading ? (
                <div className="flex flex-col items-center justify-center py-24 md:py-32 gap-4">
                  <Loader2 className="animate-spin text-cyan-500" size={40} md:size={48} />
                  <p className="text-white/40 text-sm md:text-base font-medium">Fetching premium content...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-24 md:py-32 gap-6 text-center max-w-md mx-auto px-6">
                  <div className="p-4 bg-red-500/10 rounded-full">
                    <AlertCircle className="text-red-500" size={40} md:size={48} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg md:text-xl font-bold">Connection Issue</h3>
                    <p className="text-white/40 text-xs md:text-sm">{error}</p>
                  </div>
                  <button 
                    onClick={() => setCurrentSelectedCategory(currentSelectedCategory)} // Trigger re-fetch
                    className="bg-cyan-500 text-black px-6 md:px-8 py-2.5 md:py-3 rounded-xl font-bold hover:bg-cyan-400 transition-all text-sm md:text-base"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-6">
                    {currentItems.map((item, idx) => (
                      <motion.div
                        key={`${activeTab}-${'stream_id' in item ? item.stream_id : (item as any).series_id}-${idx}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ 
                          duration: 0.3,
                          delay: Math.min(idx * 0.02, 0.3) 
                        }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleItemClick(item)}
                        className="group cursor-pointer space-y-1 md:space-y-3 gpu"
                      >
                        <div className="relative aspect-[2/3] rounded-lg md:rounded-xl overflow-hidden shadow-2xl transition-transform group-hover:scale-105 border border-white/5 group-hover:border-cyan-500/50 gpu">
                          <img 
                            src={('stream_icon' in item ? (item as any).stream_icon : (item as Series).cover) || null} 
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/movie/400/600?blur=2';
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 md:p-4">
                            <div className="flex items-center gap-1 md:gap-2 bg-cyan-500/20 backdrop-blur-md px-2 md:px-3 py-1 md:py-1.5 rounded-full text-[8px] md:text-xs font-bold text-cyan-400 border border-cyan-500/30">
                              <Play size={8} md:size={12} fill="currentColor" /> Watch
                            </div>
                          </div>
                        </div>
                        <div className="px-1">
                          <h3 className="text-[9px] md:text-sm font-semibold line-clamp-1 group-hover:text-cyan-400 transition-colors">{item.name}</h3>
                          <div className="flex items-center gap-1 md:gap-2 mt-0.5 md:mt-1">
                            <span className="text-[7px] md:text-[10px] uppercase tracking-wider text-white/40 font-bold">
                              {activeTab === 'movies' ? 'Movie' : (activeTab === 'series' ? 'Series' : 'Live TV')}
                            </span>
                            {item.rating && (
                              <span className="text-[7px] md:text-[10px] bg-cyan-500/10 text-cyan-400 px-1 md:px-1.5 rounded font-bold">
                                ★ {item.rating}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  
                  {/* Scroll Sentinel for Lazy Loading */}
                  {hasMore && !currentLoading && (
                    <div 
                      ref={loadMoreRef} 
                      className="flex justify-center py-12"
                    >
                      <div className="flex items-center gap-3 text-cyan-500 font-medium">
                        <Loader2 className="animate-spin" size={24} />
                        <span className="text-sm">Loading more titles...</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!currentLoading && currentItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 md:py-32 text-white/40">
                  <Search size={40} md:size={48} className="mb-4 opacity-20" />
                  <p className="text-sm">No titles found in this category.</p>
                </div>
              )}
            </div>
          </div>
      )}
    </main>

      {/* Dynamic Syncing details preloader with a modern cinematic loader */}
      <AnimatePresence>
        {isSyncingDetails && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 select-none">
            {/* Backdrop with heavy blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 backdrop-blur-2xl"
            />

            {/* Glowing card container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 180 }}
              className="relative max-w-sm w-full rounded-[2.5rem] bg-gradient-to-b from-[#121214] to-[#08080a] p-8 border border-white/10 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.9)] flex flex-col items-center justify-center text-center overflow-hidden"
            >
              {/* Spinning/pulsing neon radial circles representing media tune-in syncing */}
              <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
                {/* Glowing outermost ring */}
                <motion.div 
                  className="absolute inset-0 rounded-full border-2 border-dashed border-[#00D1FF]/20"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                />
                
                {/* Mid ring */}
                <motion.div 
                  className="absolute inset-2 rounded-full border border-double border-pink-500/30"
                  animate={{ rotate: -360 }}
                  transition={{ repeat: Infinity, duration: 5, ease: "linear" }}
                />

                {/* Inner glowing ring with gradient */}
                <motion.div 
                  className="absolute inset-4 rounded-full border-2 border-t-[#00D1FF] border-r-transparent border-b-purple-500 border-l-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                />

                {/* Sparkling dot */}
                <motion.div
                  className="absolute w-2 h-2 rounded-full bg-[#00D1FF] shadow-[0_0_12px_#00D1FF]"
                  animate={{ 
                    scale: [0.8, 1.4, 0.8],
                    opacity: [0.5, 1, 0.5] 
                  }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                />
              </div>

              {/* Progress Text */}
              <div className="space-y-3 z-10">
                <span className="text-[9px] font-black text-[#00D1FF] uppercase tracking-[0.25em] bg-[#00D1FF]/10 px-3.5 py-1 rounded-full border border-[#00D1FF]/20 block w-fit mx-auto self-center select-none shadow-[0_0_15px_rgba(6,182,212,0.15)] animate-pulse">
                  Connecting Securely
                </span>
                
                <h3 className="text-lg sm:text-xl font-display font-black text-white tracking-tight leading-snug px-2 line-clamp-2">
                  {syncingItemName}
                </h3>
                
                <p className="text-[11px] text-slate-400 font-medium">
                  Loading details, please wait...
                </p>
              </div>

              {/* Decorative background grid/ambient glows */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#00D1FF]/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Item Details Modal */}
      <AnimatePresence>
        {selectedItem && !isSyncingDetails && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm gpu"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ 
                duration: 0.3,
                ease: "easeOut"
              }}
              className="relative w-full max-w-4xl glass-dark rounded-2xl md:rounded-3xl overflow-y-auto no-scrollbar shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[92vh] md:max-h-[90vh] border border-white/10 gpu"
            >
              <button 
                onClick={() => setSelectedItem(null)}
                className="absolute top-4 right-4 z-30 p-2.5 bg-black/60 hover:bg-black text-white hover:text-[#00D1FF] rounded-full transition-all duration-200 border border-white/10 shadow-lg"
              >
                <X size={18} md:size={20} />
              </button>

              {/* Back backdrop cover */}
              <div className="absolute top-0 left-0 right-0 h-[170px] sm:h-[220px] md:h-[280px] z-0 pointer-events-none select-none overflow-hidden">
                <img 
                  src={backdropUrl || posterUrl} 
                  alt="Backdrop" 
                  className="w-full h-full object-cover opacity-85 scale-100 transition-all duration-500"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/movie/800/400?blur=8';
                  }}
                />
                {/* Backdrop gradient shading to blend into background */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0e] via-[#0c0c0e]/35 to-black/10" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0c0c0e]/60 via-transparent to-[#0c0c0e]/60" />
              </div>

              {/* Overlaid Poster, Cast Box & Details */}
              <div className="relative z-10 w-full px-4 sm:px-6 md:px-8 pt-[70px] sm:pt-[95px] md:pt-14 pb-5 flex flex-col">
                
                {/* Mobile/Tablet Layout (100% untouched & original) */}
                <div className="md:hidden flex flex-col gap-5">
                  {/* Poster & Compact Cast Row */}
                  <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[135px_1fr] gap-3 sm:gap-4 items-end">
                    {/* Overlapping Poster (Half on backdrop, half on details) */}
                    <div className="w-full aspect-[2/3] rounded-xl sm:rounded-2xl overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.95)] border-2 border-white/20 bg-neutral-900 transform hover:scale-[1.03] transition-all duration-300 shrink-0">
                      <img 
                        src={posterUrl} 
                        alt={selectedItem.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/movie/400/600?blur=2';
                        }}
                      />
                    </div>

                    {/* Cast Info Box (Adjacent to Poster) */}
                    <div className="flex-1 min-w-0 bg-black/45 backdrop-blur-md rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-white/10 flex flex-col gap-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-[#00D1FF] uppercase tracking-[0.2em] leading-none mb-1 block">
                        🎭 Cast & Stars
                      </span>
                      {castingList.length > 0 ? (
                        <div className="flex gap-2 sm:gap-3 overflow-x-auto no-scrollbar items-center py-0.5">
                          {castingList.map((actor, idx) => {
                            const grad = stringToColorGradient(actor.name);
                            return (
                              <div key={`actor-mob-${idx}`} className="flex flex-col items-center gap-1 shrink-0 text-center w-[45px] sm:w-[54px] group">
                                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden flex items-center justify-center text-[10px] sm:text-xs font-black shadow-lg shadow-black/40 group-hover:scale-105 transition-transform duration-200 border ${actor.profile_url ? 'border-white/15' : `bg-gradient-to-tr ${grad.from} ${grad.to} ${grad.border} ${grad.text}`}`}>
                                  {actor.profile_url ? (
                                    <img 
                                      src={actor.profile_url} 
                                      alt={actor.name} 
                                      className="w-full h-full object-cover" 
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        const parentHtml = (e.target as HTMLElement).parentElement;
                                        if (parentHtml) {
                                          parentHtml.className += ` bg-gradient-to-tr ${grad.from} ${grad.to} ${grad.border} ${grad.text}`;
                                          const initialsSpan = document.createElement('span');
                                          initialsSpan.innerText = getInitials(actor.name);
                                          parentHtml.appendChild(initialsSpan);
                                        }
                                      }}
                                    />
                                  ) : (
                                    <span>{getInitials(actor.name)}</span>
                                  )}
                                </div>
                                <span className="text-[7.5px] sm:text-[8px] text-white/70 font-semibold tracking-tight uppercase truncate w-full group-hover:text-white transition-colors">
                                  {actor.name}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-2 flex flex-col items-center justify-center text-center opacity-30 text-[8px] sm:text-[9.5px] gap-1">
                          <span>No Cast Information Available</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Details and Description */}
                  <div className="flex justify-between items-start gap-4 pt-1">
                    <div className="space-y-1 flex-1">
                      {loadingTmdb && (
                        <div className="text-white/40 text-[10px] flex items-center gap-1 mb-1 bg-black/20 px-2.5 py-1 rounded-md w-fit border border-white/5">
                          <Loader2 size={10} className="animate-spin text-cyan-400" /> 
                          <span className="font-semibold text-slate-300">Loading details...</span>
                        </div>
                      )}
                      {renderStylishTitle(
                        selectedItem.name, 
                        tmdbDetails, 
                        'series_id' in selectedItem, 
                        selectedItem.rating,
                        ('series_id' in selectedItem && seriesInfo?.episodes) 
                          ? (Object.values(seriesInfo.episodes) as any[]).reduce((acc: number, curr: any) => acc + (Array.isArray(curr) ? curr.length : 0), 0)
                          : undefined
                      )}
                      {tmdbDetails?.trailer_url && (
                        <div className="pt-1.5 select-none">
                          <button 
                            onClick={() => setPlayingTrailerUrl(tmdbDetails.trailer_url || null)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold text-[10px] transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(220,38,38,0.4)] cursor-pointer"
                          >
                            <Youtube size={14} className="fill-white text-white" />
                            <span>Watch Trailer</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {isLoggedIn && (
                      <button
                        onClick={toggleFavorite}
                        className={cn(
                          "p-3 rounded-full border transition-all cursor-pointer flex items-center justify-center shrink-0 self-start shadow-xl active:scale-95 duration-300 bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/30",
                          isFavorite && "bg-red-500/15 border-red-500/40 text-red-500 hover:bg-red-500/25 shadow-red-500/15"
                        )}
                        title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                        id="toggle-fav-btn"
                      >
                        <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
                      </button>
                    )}
                  </div>

                  <p className="text-white/60 text-[10px] leading-relaxed line-clamp-2">
                    {tmdbDetails?.plot || ('plot' in selectedItem ? selectedItem.plot : (seriesInfo?.info?.plot || "Enjoy high-quality streaming of this title. Experience the best in entertainment with 4K·SJ premium IPTV service."))}
                  </p>

                  {/* Action Buttons for Movies/Live */}
                  { !(selectedItem as any).series_id ? (
                    <div className="flex flex-col gap-2 pt-1">
                      <button 
                        onClick={() => handleAction('web_play', selectedItem)}
                        className="flex items-center justify-center gap-2 bg-[#00D1FF] text-black hover:bg-cyan-300 px-4 py-3 rounded-xl font-black transition-all transform hover:scale-105 text-sm shadow-[0_0_25px_rgba(0,209,255,0.4)] uppercase tracking-widest"
                      >
                        <Play size={20} fill="black" /> 
                        <span>Play Online</span>
                      </button>

                      <button 
                        onClick={() => handleAction('play', selectedItem)}
                        title="Play in External Player (Only for Mobile Users)"
                        className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white hover:bg-white/10 px-4 py-2.5 rounded-xl font-bold transition-all text-xs"
                      >
                        <Share2 size={16} /> 
                        <span>Open in External Player</span>
                      </button>
                      
                      {/* Copy Link for Movies/Live */}
                      <div className="space-y-1.5">
                        <button 
                          onClick={() => handleAction('copy', selectedItem)}
                          className={cn(
                            "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all border text-xs",
                            copiedId === ((selectedItem as any).stream_id || (selectedItem as any).id)
                              ? "bg-green-500/20 border-green-500/50 text-green-400" 
                              : "bg-white/5 hover:bg-white/10 border-white/5 text-white"
                          )}
                        >
                          {copiedId === ((selectedItem as any).stream_id || (selectedItem as any).id) ? <Check size={16} /> : <Copy size={16} />}
                          {copiedId === ((selectedItem as any).stream_id || (selectedItem as any).id) ? "Link Copied!" : ((selectedItem as any).stream_type === 'live' ? "Copy Channel Link" : "Copy Movie Link")}
                        </button>
                        <p className="text-[9px] text-white/40 text-center uppercase tracking-tighter">
                          Paste this link on VLC Player to play manually
                        </p>
                      </div>

                      { !(selectedItem as any).stream_type || (selectedItem as any).stream_type !== 'live' ? (
                        <button 
                          onClick={() => handleAction('download', selectedItem)}
                          className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl font-bold transition-all border border-white/5 text-xs"
                        >
                          <Download size={16} /> Download
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    /* Episode List for Series */
                    <div className="space-y-4 pt-1">
                      {loadingInfo ? (
                        <div className="flex items-center gap-3 text-white/40 py-4">
                          <Loader2 className="animate-spin" size={18} />
                          <span className="text-xs">Loading episodes...</span>
                        </div>
                      ) : seriesInfo?.episodes ? (
                        <>
                          {/* Seasons Selector */}
                          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                            {Object.keys(seriesInfo.episodes).map((seasonNum, idx) => (
                              <button
                                key={`season-mob-${seasonNum}-${idx}`}
                                onClick={() => setSelectedSeason(seasonNum)}
                                className={cn(
                                  "whitespace-nowrap px-3 py-1 rounded-lg text-[10px] font-bold transition-all border",
                                  selectedSeason === seasonNum 
                                    ? "bg-cyan-600 border-cyan-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]" 
                                    : "bg-white/5 border-white/10 text-white/60 hover:border-white/30"
                                )}
                              >
                                Season {seasonNum}
                              </button>
                            ))}
                          </div>

                          {/* Episodes List */}
                          <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1 no-scrollbar pb-10">
                            {seriesInfo.episodes[selectedSeason || '']?.map((episode: any, idx: number) => (
                              <div 
                                key={`episode-mob-${episode.id}-${idx}`}
                                className="group/ep flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold">
                                    {episode.episode_num}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs font-semibold line-clamp-1">{episode.title}</span>
                                    <span className="text-[9px] text-white/40 uppercase tracking-wider">Episode {episode.episode_num}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button 
                                    onClick={() => handleAction('web_play', selectedItem, episode.id, episode.container_extension)}
                                    className="p-1.5 bg-[#00D1FF]/10 text-[#00D1FF] hover:bg-[#00D1FF]/20 rounded-lg transition-colors border border-[#00D1FF]/20"
                                    title="Play Online"
                                  >
                                    <Play size={14} fill="currentColor" />
                                  </button>
                                  <button 
                                    onClick={() => handleAction('play', selectedItem, episode.id, episode.container_extension)}
                                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                    title="Play in External Player"
                                  >
                                    <Share2 size={14} />
                                  </button>
                                  <button 
                                    onClick={() => handleAction('copy', selectedItem, episode.id, episode.container_extension)}
                                    className={cn(
                                      "p-1.5 rounded-lg transition-all",
                                      copiedId === episode.id 
                                        ? "bg-green-500/20 text-green-400" 
                                        : "hover:bg-white/20 text-white/60"
                                    )}
                                    title="Copy Episode Link"
                                  >
                                    {copiedId === episode.id ? <Check size={14} /> : <Copy size={14} />}
                                  </button>
                                  <button 
                                    onClick={() => handleAction('download', selectedItem, episode.id, episode.container_extension)}
                                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                    title="Download Episode"
                                  >
                                    <Download size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-white/40 italic">No episodes found for this series.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Desktop/Laptop Layout (Horizontal, fits perfectly, no scrolling!) */}
                <div className="hidden md:grid md:grid-cols-12 md:gap-8 md:items-start pt-1">
                  
                  {/* Left Column (Poster + Cast, width 4 cols) */}
                  <div className="md:col-span-4 flex flex-col gap-4">
                    {/* Poster */}
                    <div className="w-full aspect-[2/3] max-h-[300px] rounded-2xl overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.95)] border-2 border-white/20 bg-neutral-900 transform hover:scale-[1.02] transition-all duration-300">
                      <img 
                        src={posterUrl} 
                        alt={selectedItem.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/movie/400/600?blur=2';
                        }}
                      />
                    </div>

                    {/* Cast Info Box (Desktop horizontal side scroll or tidy layout) */}
                    <div className="bg-black/45 backdrop-blur-md rounded-2xl p-3 border border-white/10 flex flex-col gap-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] relative">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-[#00D1FF] uppercase tracking-[0.2em] leading-none mb-1 block">
                          🎭 Cast & Stars
                        </span>
                        {/* Desktop-only Navigation Buttons */}
                        {castingList.length > 3 && (
                          <div className="hidden md:flex items-center gap-1 mb-1">
                            <button 
                              onClick={(e) => {
                                const container = e.currentTarget.closest('.relative')?.querySelector('.cast-scroll-container');
                                if (container) {
                                  container.scrollBy({ left: -120, behavior: 'smooth' });
                                }
                              }}
                              className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-[#00D1FF]/20 border border-white/10 hover:border-[#00D1FF]/30 text-white hover:text-[#00D1FF] rounded-full transition-all cursor-pointer shadow-md"
                              title="Previous"
                            >
                              <ChevronRight size={10} className="rotate-180" />
                            </button>
                            <button 
                              onClick={(e) => {
                                const container = e.currentTarget.closest('.relative')?.querySelector('.cast-scroll-container');
                                if (container) {
                                  container.scrollBy({ left: 120, behavior: 'smooth' });
                                }
                              }}
                              className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-[#00D1FF]/20 border border-white/10 hover:border-[#00D1FF]/30 text-white hover:text-[#00D1FF] rounded-full transition-all cursor-pointer shadow-md"
                              title="Next"
                            >
                              <ChevronRight size={10} />
                            </button>
                          </div>
                        )}
                      </div>
                      {castingList.length > 0 ? (
                        <div className="cast-scroll-container flex gap-3 overflow-x-auto no-scrollbar items-center py-0.5">
                          {castingList.map((actor, idx) => {
                            const grad = stringToColorGradient(actor.name);
                            return (
                              <div key={`actor-desk-${idx}`} className="flex flex-col items-center gap-1 shrink-0 text-center w-[54px] group">
                                <div className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-xs font-black shadow-lg shadow-black/40 group-hover:scale-105 transition-transform duration-200 border ${actor.profile_url ? 'border-white/15' : `bg-gradient-to-tr ${grad.from} ${grad.to} ${grad.border} ${grad.text}`}`}>
                                  {actor.profile_url ? (
                                    <img 
                                      src={actor.profile_url} 
                                      alt={actor.name} 
                                      className="w-full h-full object-cover" 
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        const parentHtml = (e.target as HTMLElement).parentElement;
                                        if (parentHtml) {
                                          parentHtml.className += ` bg-gradient-to-tr ${grad.from} ${grad.to} ${grad.border} ${grad.text}`;
                                          const initialsSpan = document.createElement('span');
                                          initialsSpan.innerText = getInitials(actor.name);
                                          parentHtml.appendChild(initialsSpan);
                                        }
                                      }}
                                    />
                                  ) : (
                                    <span>{getInitials(actor.name)}</span>
                                  )}
                                </div>
                                <span className="text-[8px] text-white/70 font-semibold tracking-tight uppercase truncate w-full group-hover:text-white transition-colors">
                                  {actor.name}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-2 flex flex-col items-center justify-center text-center opacity-30 text-[9.5px]">
                          <span>No Cast Information Available</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column (Info, Title, rating, plot, and action buttons, 8 cols) */}
                  <div className="md:col-span-8 flex flex-col gap-4 self-center">
                    
                    {/* Header Details with Favorite toggle button */}
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-2 flex-1">
                        {loadingTmdb && (
                          <div className="text-white/40 text-[10px] flex items-center gap-1 mb-1 bg-black/20 px-2.5 py-1 rounded-md w-fit border border-white/5 animate-pulse">
                            <Loader2 size={10} className="animate-spin text-cyan-400" /> 
                            <span className="font-semibold text-slate-300">Loading details...</span>
                          </div>
                        )}
                        {renderStylishTitle(
                          selectedItem.name, 
                          tmdbDetails, 
                          'series_id' in selectedItem, 
                          selectedItem.rating,
                          ('series_id' in selectedItem && seriesInfo?.episodes) 
                            ? (Object.values(seriesInfo.episodes) as any[]).reduce((acc: number, curr: any) => acc + (Array.isArray(curr) ? curr.length : 0), 0)
                            : undefined
                        )}
                        {tmdbDetails?.trailer_url && (
                          <div className="pt-1 select-none">
                            <button 
                              onClick={() => setPlayingTrailerUrl(tmdbDetails.trailer_url || null)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold text-xs transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(220,38,38,0.4)] cursor-pointer"
                            >
                              <Youtube size={12} className="fill-white text-white" />
                              <span>Watch Trailer</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {isLoggedIn && (
                        <button
                          onClick={toggleFavorite}
                          className={cn(
                            "p-3.5 rounded-full border transition-all cursor-pointer flex items-center justify-center shrink-0 self-start shadow-xl active:scale-95 duration-300 bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/30",
                            isFavorite && "bg-red-500/15 border-red-500/40 text-red-500 hover:bg-red-500/25 shadow-red-500/15"
                          )}
                          title={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                          id="toggle-fav-btn-desk"
                        >
                          <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
                        </button>
                      )}
                    </div>

                    {/* Plot Description with clamp for laptop height */}
                    <p className="text-white/60 text-sm leading-relaxed line-clamp-3">
                      {tmdbDetails?.plot || ('plot' in selectedItem ? selectedItem.plot : (seriesInfo?.info?.plot || "Enjoy high-quality streaming of this title. Experience the best in entertainment with 4K·SJ premium IPTV service."))}
                    </p>

                    {/* Actions Panel or Episode List */}
                    { !(selectedItem as any).series_id ? (
                      /* Movies action grid layout */
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button 
                          onClick={() => handleAction('web_play', selectedItem)}
                          className="col-span-2 flex items-center justify-center gap-3 bg-[#00D1FF] text-black hover:bg-cyan-300 px-5 py-3 rounded-xl font-black transition-all transform hover:scale-[1.01] text-sm shadow-[0_0_20px_rgba(0,209,255,0.3)] uppercase tracking-widest cursor-pointer"
                        >
                          <Play size={18} fill="black" /> 
                          <span>Play Online</span>
                        </button>

                        <button 
                          onClick={() => handleAction('play', selectedItem)}
                          title="Play in External Player (Only for Mobile Users)"
                          className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white hover:bg-white/10 py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer"
                        >
                          <Share2 size={14} /> 
                          <span>Open in External Player</span>
                        </button>
                        
                        { !(selectedItem as any).stream_type || (selectedItem as any).stream_type !== 'live' ? (
                          <button 
                            onClick={() => handleAction('download', selectedItem)}
                            className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 py-2.5 rounded-xl font-bold transition-all border border-white/5 text-xs cursor-pointer"
                          >
                            <Download size={14} /> Download Movie
                          </button>
                        ) : null}

                        <div className="col-span-2 space-y-1 bg-white/[0.02] border border-white/5 p-2 rounded-xl">
                          <button 
                            onClick={() => handleAction('copy', selectedItem)}
                            className={cn(
                              "w-full flex items-center justify-center gap-2 py-2 rounded-lg font-bold transition-all border text-xs cursor-pointer",
                              copiedId === ((selectedItem as any).stream_id || (selectedItem as any).id)
                                ? "bg-green-500/20 border-green-500/50 text-green-400" 
                                : "bg-white/5 hover:bg-white/10 border-white/5 text-white"
                            )}
                          >
                            {copiedId === ((selectedItem as any).stream_id || (selectedItem as any).id) ? <Check size={14} /> : <Copy size={14} />}
                            {copiedId === ((selectedItem as any).stream_id || (selectedItem as any).id) ? "Link Copied!" : ((selectedItem as any).stream_type === 'live' ? "Copy Channel Link" : "Copy Movie Link")}
                          </button>
                          <p className="text-[9px] text-white/40 text-center uppercase tracking-tighter leading-none">
                            Paste this link on VLC Player to play manually
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Episodes Selector for Series on Desktop */
                      <div className="space-y-3 pt-1">
                        {loadingInfo ? (
                          <div className="flex items-center gap-3 text-white/40 py-4">
                            <Loader2 className="animate-spin text-cyan-400" size={16} />
                            <span className="text-xs">Loading episodes...</span>
                          </div>
                        ) : seriesInfo?.episodes ? (
                          <>
                            {/* Seasons Selector (horizontal scroll) */}
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                              {Object.keys(seriesInfo.episodes).map((seasonNum, idx) => (
                                <button
                                  key={`season-desk-${seasonNum}-${idx}`}
                                  onClick={() => setSelectedSeason(seasonNum)}
                                  className={cn(
                                    "whitespace-nowrap px-3 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer",
                                    selectedSeason === seasonNum 
                                      ? "bg-cyan-600 border-cyan-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]" 
                                      : "bg-white/5 border-white/10 text-white/60 hover:border-white/30"
                                  )}
                                >
                                  Season {seasonNum}
                                </button>
                              ))}
                            </div>

                            {/* Episodes List (Compact Height to guarantee zero scrolling!) */}
                            <div className="space-y-1.5 max-h-[140px] lg:max-h-[180px] overflow-y-auto pr-1 desktop-scrollbar pb-1">
                              {seriesInfo.episodes[selectedSeason || '']?.map((episode: any, idx: number) => (
                                <div 
                                  key={`episode-desk-${episode.id}-${idx}`}
                                  className="group/ep flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold">
                                      {episode.episode_num}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-xs font-semibold line-clamp-1">{episode.title}</span>
                                      <span className="text-[9px] text-white/40 uppercase tracking-wider">Episode {episode.episode_num}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button 
                                      onClick={() => handleAction('web_play', selectedItem, episode.id, episode.container_extension)}
                                      className="p-1.5 bg-[#00D1FF]/10 text-[#00D1FF] hover:bg-[#00D1FF]/20 rounded-lg transition-colors border border-[#00D1FF]/20 cursor-pointer"
                                      title="Play Online"
                                    >
                                      <Play size={12} fill="currentColor" />
                                    </button>
                                    <button 
                                      onClick={() => handleAction('play', selectedItem, episode.id, episode.container_extension)}
                                      className="p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                                      title="Play in External Player"
                                    >
                                      <Share2 size={12} />
                                    </button>
                                    <button 
                                      onClick={() => handleAction('copy', selectedItem, episode.id, episode.container_extension)}
                                      className={cn(
                                        "p-1.5 rounded-lg transition-all cursor-pointer",
                                        copiedId === episode.id 
                                          ? "bg-green-500/20 text-green-400" 
                                          : "hover:bg-white/20 text-white/60"
                                      )}
                                      title="Copy Episode Link"
                                    >
                                      {copiedId === episode.id ? <Check size={12} /> : <Copy size={12} />}
                                    </button>
                                    <button 
                                      onClick={() => handleAction('download', selectedItem, episode.id, episode.container_extension)}
                                      className="p-1.5 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                                      title="Download Episode"
                                    >
                                      <Download size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-white/40 italic">No episodes found for this series.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Internal Web Player Modal */}
      <AnimatePresence>
        {showWebPlayer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-8 lg:p-12 gpu overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseWebPlayer}
              className="absolute inset-0 bg-black/90 backdrop-blur-2xl gpu"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-6xl aspect-video max-h-[85vh] lg:max-h-[80vh] glass-dark rounded-xl md:rounded-[2rem] overflow-hidden shadow-[0_0_100px_rgba(0,209,255,0.4)] border border-white/20 flex flex-col gpu"
            >
              {/* Minimalist Top Header with Gradient Overlay */}
              <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-3 md:p-8 bg-gradient-to-b from-black/95 via-black/60 to-transparent pointer-events-none group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center gap-3 md:gap-5 pointer-events-auto">
                  <div className="w-10 h-10 md:w-14 md:h-14 bg-cyan-500/10 backdrop-blur-2xl rounded-xl md:rounded-[1.5rem] flex items-center justify-center border border-cyan-500/40 shadow-[0_0_25px_rgba(0,209,255,0.3)]">
                    <Play size={20} className="text-[#00D1FF] fill-[#00D1FF] md:w-7 md:h-7" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-sm md:text-xl font-bold text-white truncate max-w-[160px] md:max-w-2xl drop-shadow-[0_2px_10px_rgba(0,0,0,1)] tracking-tight">
                      {webPlayTitle}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-[#00D1FF] rounded-full animate-pulse shadow-[0_0_10px_#00D1FF]" />
                      <p className="text-[9px] md:text-sm text-[#00D1FF] font-black uppercase tracking-[0.25em] drop-shadow-md">
                        {playingEpisode ? `Episode ${playingEpisode.episode_num} is playing` : "Theater Mode 4K"}
                      </p>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={handleCloseWebPlayer}
                  className="p-2.5 md:p-5 bg-black/50 hover:bg-red-500/95 text-white rounded-xl md:rounded-2xl backdrop-blur-2xl border border-white/20 transition-all duration-300 hover:scale-110 active:scale-90 group pointer-events-auto shadow-xl"
                >
                  <X size={20} className="md:w-7 md:h-7 group-hover:rotate-90 transition-transform duration-500" />
                </button>
              </div>

              <div className="flex-1 w-full h-full bg-black relative">
                <VideoPlayer 
                  key={selectedItem?.stream_id || selectedItem?.id || 'premium-player'}
                  options={{
                    autoplay: true,
                    controls: true,
                    isLive: !!(selectedItem as any)?.stream_type && (selectedItem as any).stream_type === 'live',
                    sources: [{
                      src: webPlayUrl,
                      type: webPlayUrl.toLowerCase().includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
                    }]
                  }} 
                  onClose={handleCloseWebPlayer}
                  playingEpisode={playingEpisode}
                  nextEpisode={getNextEpisode(playingEpisode)}
                  onPlayNext={handlePlayNextEpisode}
                  episodesMap={seriesInfo?.episodes}
                  onSelectEpisode={handleSelectEpisode}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md max-w-md w-[calc(100%-2rem)] md:w-auto"
            style={{
              backgroundColor: toastType === 'success' ? 'rgba(16, 185, 129, 0.95)' : toastType === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(14, 116, 144, 0.95)',
              borderColor: toastType === 'success' ? '#10B981' : toastType === 'error' ? '#EF4444' : '#0E7490',
              color: '#FFFFFF'
            }}
          >
            <span className="text-sm font-bold tracking-wide">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trending Language/Version Selector Modal */}
      <AnimatePresence>
        {trendingSelectorData && trendingSelectorData.show && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTrendingSelectorData(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md gpu"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: "spring", damping: 24, stiffness: 220 }}
              className="relative w-full max-w-2xl bg-zinc-950/95 border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-cyan-500/10 flex flex-col max-h-[85vh] z-10"
            >
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-white/5 relative flex justify-between items-start bg-gradient-to-b from-zinc-900 to-zinc-950">
                <div>
                  <span className="px-3 py-1 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold uppercase tracking-[0.2em] rounded-full">
                    SERVER CONNECTED
                  </span>
                  <h3 className="text-xl md:text-3xl font-display font-bold text-white mt-3 leading-tight">
                    {trendingSelectorData.title}
                  </h3>
                  <p className="text-white/40 text-xs md:text-sm mt-1.5 font-medium leading-relaxed">
                    Multiple language versions/variations of this {trendingSelectorData.isSeries ? 'web series' : 'movie'} are available on our server. Please select a match below:
                  </p>
                </div>
                <button
                  onClick={() => setTrendingSelectorData(null)}
                  className="p-2 md:p-3 bg-white/5 hover:bg-white/10 hover:text-red-400 text-white/60 rounded-full transition-all border border-white/5 shadow-xl shrink-0 ml-4 hover:scale-105 active:scale-95 flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Version/Language List */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3.5 no-scrollbar max-h-[50vh]">
                {(() => {
                  const getLanguageBadges = (name: string) => {
                    const nameLower = name.toLowerCase();
                    const badges: { text: string; bg: string; textCol: string }[] = [];
                    
                    if (nameLower.includes('hindi') || nameLower.includes('hin')) {
                      badges.push({ text: 'HINDI', bg: 'bg-red-500/20 border-red-500/30', textCol: 'text-red-400' });
                    }
                    if (nameLower.includes('urdu') || nameLower.includes('urd')) {
                      badges.push({ text: 'URDU', bg: 'bg-emerald-500/20 border-emerald-500/30', textCol: 'text-emerald-400' });
                    }
                    if (nameLower.includes('tamil') || nameLower.includes('tam')) {
                      badges.push({ text: 'TAMIL', bg: 'bg-amber-500/25 border-amber-500/35', textCol: 'text-amber-400' });
                    }
                    if (nameLower.includes('telugu') || nameLower.includes('tel')) {
                      badges.push({ text: 'TELUGU', bg: 'bg-orange-500/20 border-orange-500/30', textCol: 'text-orange-400' });
                    }
                    if (nameLower.includes('malayalam') || nameLower.includes('mal')) {
                      badges.push({ text: 'MALAYALAM', bg: 'bg-teal-500/20 border-teal-500/30', textCol: 'text-teal-400' });
                    }
                    if (nameLower.includes('kannada') || nameLower.includes('kan')) {
                      badges.push({ text: 'KANNADA', bg: 'bg-rose-500/20 border-rose-500/30', textCol: 'text-rose-400' });
                    }
                    if (nameLower.includes('dubbed') || nameLower.includes('dub')) {
                      badges.push({ text: 'DUBBED', bg: 'bg-pink-500/20 border-pink-500/30', textCol: 'text-pink-400' });
                    }
                    if (nameLower.includes('dual audio') || nameLower.includes('dual-audio') || nameLower.includes('multi audio') || nameLower.includes('multi-audio') || nameLower.includes('org-aud')) {
                      badges.push({ text: 'DUAL/MULTIPLEX', bg: 'bg-purple-500/20 border-purple-500/30', textCol: 'text-purple-400' });
                    }
                    if (nameLower.includes('4k') || nameLower.includes('uhd')) {
                      badges.push({ text: '4K UHD', bg: 'bg-lime-500/20 border-lime-500/30', textCol: 'text-lime-400' });
                    }

                    if (badges.length === 0) {
                      badges.push({ text: 'MULTILINGUAL', bg: 'bg-cyan-500/10 border-cyan-500/20', textCol: 'text-cyan-400' });
                    }
                    return badges;
                  };

                  return trendingSelectorData.items.map((item, idx) => {
                    const poster = ('stream_icon' in item ? item.stream_icon : item.cover) || '';
                    const badges = getLanguageBadges(item.name);
                    return (
                      <motion.div
                        key={`trending-selector-item-${idx}`}
                        whileHover={{ x: 6, backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
                        onClick={() => {
                          handleItemClick(item);
                          setTrendingSelectorData(null);
                        }}
                        className="flex items-center gap-4 p-3.5 bg-white/[0.02] border border-white/5 hover:border-cyan-500/40 rounded-2xl cursor-pointer transition-all duration-300 group"
                      >
                        {/* Poster */}
                        <div className="w-12 h-16 md:w-14 md:h-20 shrink-0 rounded-xl overflow-hidden border border-white/10 group-hover:border-cyan-400/30 shadow-md bg-zinc-900 relative">
                          <img
                            src={poster}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/movie/200/300?blur=1'; }}
                          />
                        </div>

                        {/* Title & Language Badges */}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs md:text-sm font-bold text-white group-hover:text-cyan-400 transition-colors uppercase tracking-wide truncate leading-tight">
                            {item.name}
                          </h4>
                          <p className="text-[10px] text-white/40 font-mono mt-1">
                            {('stream_id' in item) ? `MOVIE ID: ${item.stream_id}` : `SERIES ID: ${item.series_id}`}
                          </p>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {badges.map((b, bIdx) => (
                              <span
                                key={`badge-${idx}-${bIdx}`}
                                className={cn(
                                  "px-2 py-0.5 rounded text-[8px] md:text-[9px] font-bold tracking-wider uppercase border",
                                  b.bg,
                                  b.textCol
                                )}
                              >
                                {b.text}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Play Button */}
                        <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-cyan-500 text-white/60 group-hover:text-black flex items-center justify-center border border-white/5 group-hover:border-transparent transition-all duration-300 hover:scale-105 shadow-xl">
                          <Play size={16} fill="currentColor" />
                        </div>
                      </motion.div>
                    );
                  });
                })()}
              </div>

              {/* Action Bar */}
              <div className="p-4 bg-zinc-950 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40 px-6 md:px-8">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Live Syncing with IPTV Server
                </span>
                <span>Powered by 4K·SJ</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLoginModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 30 }}
              transition={{ 
                type: "spring",
                damping: 20,
                stiffness: 250
              }}
              className="relative w-full max-md glass rounded-3xl p-8 shadow-2xl border border-white/20"
            >
              <button 
                onClick={() => setShowLoginModal(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              <div className="text-center mb-8">
                <h2 className="text-2xl font-display font-bold mb-2 text-gradient">{currentBrandName} Login</h2>
                <p className="text-white/40 text-sm">Login is required to play or download premium content. You can browse all titles for free.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Username</label>
                  <input 
                    name="username"
                    type="text"
                    required
                    placeholder="Your username"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Password</label>
                  <input 
                    name="password"
                    type="password"
                    required
                    placeholder="Your password"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                  />
                </div>

                {loginError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex flex-col gap-2 text-red-400 text-xs">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} /> 
                      <span>{loginError.includes('Click here') ? loginError.split('Click here')[0] : loginError}</span>
                    </div>
                    {loginError.includes('Click here') && currentWhatsappNumber && (
                      <a 
                        href={`https://wa.me/${currentWhatsappNumber}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-cyan-400 font-bold underline hover:text-cyan-300 ml-6"
                      >
                        Click here to register new account
                      </a>
                    )}
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full bg-cyan-500 hover:bg-cyan-400 text-black py-4 rounded-xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] mt-4"
                >
                  Login to {currentBrandName}
                </button>
              </form>

              {currentWhatsappNumber && (
                <div className="mt-8 pt-6 border-t border-white/10 text-center">
                  <p className="text-white/40 text-xs mb-4 uppercase tracking-widest font-bold">Don't have an account?</p>
                  <a 
                    href={`https://wa.me/${currentWhatsappNumber}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 bg-green-500/10 hover:bg-green-500/20 text-green-400 px-6 py-3 rounded-xl font-bold transition-all border border-green-500/20 w-full justify-center"
                  >
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Register New Account
                  </a>
                  <p className="mt-4 text-[10px] text-white/20 uppercase tracking-tighter">Contact us on WhatsApp to get your premium credentials</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfileModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ 
                type: "spring",
                damping: 20,
                stiffness: 240
              }}
              className="relative w-full max-w-md bg-[#141414]/95 border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] z-[76]"
              id="profile-modal"
            >
              {/* Profile Background Banner with Premium Cinematic Cover Photo Illustration */}
              <div className="h-32 relative overflow-hidden select-none border-b border-white/5">
                <svg className="absolute inset-0 w-full h-full object-cover" viewBox="0 0 400 120" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Dark cinematic background */}
                  <rect width="400" height="120" fill="url(#cover-bg-grad)" />
                  
                  {/* Glowing spotlight beams (Retro Hollywood opening night!) */}
                  <path d="M-80 120 L80 -20 L160 -20 Z" fill="url(#spotlight-glow)" opacity="0.15" />
                  <path d="M480 120 L320 -20 L240 -20 Z" fill="url(#spotlight-glow)" opacity="0.12" />
                  
                  {/* Stylized Retro Cinema Film Roll strip along the bottom */}
                  <path d="M0 80 H400 V95 H0 Z" fill="#111" opacity="0.8" />
                  {/* Film Sprocket holes */}
                  <rect x="5" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="25" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="45" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="65" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="85" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="105" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="125" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="145" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="165" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="185" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="205" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="225" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="245" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="265" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="285" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="305" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="325" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="345" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="365" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />
                  <rect x="385" y="83" width="6" height="4" rx="1" fill="#FFF" opacity="0.3" />

                  <rect x="5" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="25" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="45" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="65" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="85" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="105" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="125" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="145" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="165" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="185" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="205" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="225" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="245" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="265" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="285" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="305" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="325" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="345" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="365" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />
                  <rect x="385" y="90" width="6" height="3" rx="0.5" fill="#FFF" opacity="0.3" />

                  {/* Floating cinema camera vector icon on the right side */}
                  <g transform="translate(320, 15)" stroke="#00D1FF" strokeWidth="1.5" fill="none" opacity="0.75" className="animate-pulse">
                    <rect x="5" y="15" width="22" height="15" rx="3" stroke="#00D1FF" strokeWidth="2" />
                    <circle cx="10" cy="8" r="7" stroke="#00D1FF" strokeWidth="1.5" />
                    <circle cx="10" cy="8" r="2" fill="#00D1FF" />
                    <line x1="10" y1="1" x2="10" y2="15" stroke="#00D1FF" strokeWidth="1" />
                    
                    <circle cx="22" cy="8" r="7" stroke="#00D1FF" strokeWidth="1.5" />
                    <circle cx="22" cy="8" r="2" fill="#00D1FF" />
                    <line x1="22" y1="1" x2="22" y2="15" stroke="#00D1FF" strokeWidth="1" />
                    
                    <path d="M27 20 L35 15 V25 Z" fill="#00D1FF" opacity="0.3" />
                    <path d="M27 20 L35 15 V25 Z" stroke="#00D1FF" strokeWidth="1.5" />
                  </g>

                  {/* High-contrast Cinema Tickets on the left side */}
                  <g transform="translate(30, 12) rotate(-15)" stroke="#F43F5E" strokeWidth="1.5" fill="none" opacity="0.75">
                    <rect x="0" y="0" width="36" height="20" rx="2" fill="#F43F5E" fillOpacity="0.1" strokeWidth="2" />
                    <circle cx="0" cy="10" r="3" fill="#0E131F" />
                    <circle cx="36" cy="10" r="3" fill="#0E131F" />
                    <line x1="8" y1="4" x2="8" y2="16" stroke="#F43F5E" strokeWidth="1" strokeDasharray="2 2" />
                    <line x1="28" y1="4" x2="28" y2="16" stroke="#F43F5E" strokeWidth="1" strokeDasharray="2 2" />
                    <circle cx="18" cy="10" r="2.5" fill="#F43F5E" />
                  </g>

                  {/* A nice overlapping popcorn bucket in the middle-right */}
                  <g transform="translate(195, 8)" opacity="0.7">
                    <path d="M5 26 L10 50 H24 L29 26 Z" fill="#EF4444" />
                    <path d="M9 26 L12 50 H15 L12 26 Z" fill="#FFF" />
                    <path d="M17 26 L18 50 H21 L20 26 Z" fill="#FFF" />
                    <circle cx="10" cy="24" r="5" fill="#FEF08A" />
                    <circle cx="16" cy="22" r="6" fill="#FEF08A" />
                    <circle cx="23" cy="24" r="5" fill="#FEF08A" />
                    <circle cx="13" cy="19" r="4.5" fill="#FDE047" />
                    <circle cx="19" cy="19" r="5" fill="#FDE047" />
                  </g>
                  
                  {/* Star sparkles in the dark night */}
                  <g opacity="0.5">
                    <path d="M120 15 L122 22 L129 24 L122 26 L120 33 L118 26 L111 24 L118 22 Z" fill="#FFE082" />
                    <path d="M260 40 L261 44 L265 45 L261 46 L260 50 L259 46 L255 45 L259 44 Z" fill="#00D1FF" />
                  </g>

                  {/* Big glowing "ENTERTAINMENT" lettering background ambient mask */}
                  <text x="50%" y="112" textAnchor="middle" fill="#FFFFFF" fillOpacity="0.04" fontSize="32" fontWeight="900" letterSpacing="4">VIP CINEMA</text>

                  {/* Modern fading dark vignette gradients */}
                  <rect width="400" height="120" fill="url(#vignette-grad)" />

                  <defs>
                    <linearGradient id="cover-bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0B1528" />
                      <stop offset="50%" stopColor="#122540" />
                      <stop offset="100%" stopColor="#1E1E2F" />
                    </linearGradient>
                    
                    <linearGradient id="spotlight-glow" x1="50%" y1="0%" x2="50%" y2="100%">
                      <stop offset="0%" stopColor="#00D1FF" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#000" stopOpacity="0" />
                    </linearGradient>

                    <linearGradient id="vignette-grad" x1="50%" y1="0%" x2="50%" y2="100%">
                      <stop offset="0%" stopColor="#000" stopOpacity="0" />
                      <stop offset="60%" stopColor="#141414" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#141414" stopOpacity="1" />
                    </linearGradient>
                  </defs>
                </svg>

                <button 
                  onClick={() => setShowProfileModal(false)}
                  className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/90 text-white hover:text-[#00D1FF] rounded-full transition-all border border-white/5 cursor-pointer z-[10]"
                  id="profile-close-btn"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="px-6 pb-6 pt-0 relative">
                {/* Netflix-Style Square Profile Avatar Overlap - Custom Animated Cartoon Character */}
                <div className="h-16 flex items-end mb-4 -translate-y-8 select-none">
                  <div className="w-16 h-16 rounded-2xl bg-[#083344] p-1 shadow-[0_4px_25px_rgba(0,209,255,0.4)] border border-[#00D1FF]/40 overflow-hidden shrink-0 flex items-center justify-center select-none">
                    {renderAvatar(profileData.avatarId, profileData.customAvatar)}
                  </div>
                  <div className="ml-4 pb-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#00D1FF]/10 text-[#00D1FF] border border-[#00D1FF]/30 text-[9px] font-black uppercase tracking-widest leading-none mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00D1FF] animate-pulse" />
                      Premium Account
                    </span>
                    <h2 className="text-xl font-black text-white leading-tight">{creds.username}</h2>
                  </div>
                </div>

                {/* Beautiful Avatar Choice Row */}
                <div className="-mt-4 mb-5 space-y-2.5">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-[#00D1FF] flex justify-between items-center">
                    <span>Choose Avatar / Profile Picture</span>
                    {profileData.customAvatar && (
                      <button 
                        onClick={() => updateProfile('cinephile', null)}
                        className="text-[10px] text-red-500 hover:text-red-300 transition-colors font-bold cursor-pointer uppercase font-sans"
                      >
                        Reset
                      </button>
                    )}
                  </h3>
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-3 flex flex-col gap-3">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                      {AVATARS.map((avatar) => {
                        const isSelected = !profileData.customAvatar && profileData.avatarId === avatar.id;
                        return (
                          <button
                            key={avatar.id}
                            onClick={() => updateProfile(avatar.id, null)}
                            className={cn(
                              "w-11 h-11 rounded-full p-0.5 transition-all relative shrink-0 active:scale-95 cursor-pointer hover:scale-105",
                              isSelected 
                                ? "ring-2 ring-[#00D1FF] ring-offset-2 ring-offset-[#141414] scale-105" 
                                : "opacity-60 hover:opacity-100"
                            )}
                            title={avatar.name}
                          >
                            {avatar.render()}
                          </button>
                        );
                      })}

                      {/* Custom Upload Button */}
                      <label 
                        className={cn(
                          "w-11 h-11 rounded-full flex flex-col items-center justify-center border-2 border-dashed transition-all relative shrink-0 cursor-pointer active:scale-95 hover:scale-105",
                          profileData.customAvatar 
                            ? "border-[#00D1FF] bg-[#00D1FF]/10 ring-2 ring-[#00D1FF] ring-offset-2 ring-offset-[#141414]" 
                            : "border-white/20 hover:border-white/45 bg-white/[0.02] hover:bg-white/[0.05]"
                        )}
                        title="Upload Custom Image"
                      >
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleCustomAvatarUpload}
                          className="hidden" 
                        />
                        {profileData.customAvatar ? (
                          <div className="w-full h-full rounded-full overflow-hidden">
                            <img 
                              src={profileData.customAvatar} 
                              alt="Custom" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <Plus size={18} className="text-white/60" />
                        )}
                      </label>
                    </div>
                    <p className="text-[10px] text-white/40 leading-relaxed font-medium">
                      Select one of the 5 built-in cartoon avatars or click the <span className="text-[#00D1FF] font-bold">+</span> to upload your own custom photo. Your choice is saved instantly to your account & synced across devices!
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-3.5">
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-[#00D1FF]">Subscription Settings</h3>
                    
                    {/* Detail Widgets */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-3.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/40 font-medium">Account Status</span>
                        <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                          <Check size={14} className="stroke-[3]" />
                          <span>Active / VIP</span>
                        </div>
                      </div>

                      <div className="h-[1px] bg-white/5" />

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/40 font-medium">Expiry Date</span>
                        <span className="text-white/90 font-bold tracking-wide">
                          {userInfo ? formatExpiryDate(userInfo.exp_date) : 'Unlimited / Lifetime'}
                        </span>
                      </div>

                      <div className="h-[1px] bg-white/5" />

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/40 font-medium">Max Connections</span>
                        <span className="text-white/90 font-mono font-bold">
                          {userInfo ? `${userInfo.active_cons || '0'} / ${userInfo.max_connections || '1'}` : '1 Connection'}
                        </span>
                      </div>

                      <div className="h-[1px] bg-white/5" />

                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/40 font-medium">Creation Date</span>
                        <span className="text-white/80 font-medium">
                          {userInfo ? formatCreationDate(userInfo.created_at) : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                   <div className="pt-2 flex flex-col gap-3">
                    {currentWhatsappNumber && (
                      <a 
                        href={`https://wa.me/${currentWhatsappNumber}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/10"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                        Renew / Upgrade Subscription
                      </a>
                    )}

                    <button 
                      onClick={() => {
                        setShowProfileModal(false);
                        handleLogout();
                      }}
                      className="w-full h-11 bg-white/5 hover:bg-red-500/15 border border-white/10 hover:border-red-500/35 text-white/70 hover:text-red-400 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer active:scale-[0.98]"
                    >
                      Sign Out from this Device
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Download Confirmation Modal */}
      <AnimatePresence>
        {showDownloadConfirm && pendingDownload && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDownloadConfirm(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 30 }}
              transition={{ type: "spring", damping: 20, stiffness: 250 }}
              className="relative w-full max-w-md glass rounded-3xl p-8 shadow-2xl border border-white/20"
            >
              <button 
                onClick={() => setShowDownloadConfirm(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-500/30">
                  <Download className="text-cyan-400" size={32} />
                </div>
                <h2 className="text-2xl font-display font-bold mb-2 text-gradient">Download Alert!</h2>
                <p className="text-white/60 text-sm">Please read the following instructions carefully before starting your download.</p>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center shrink-0 text-cyan-400 font-bold text-xs">1</div>
                  <p className="text-xs text-white/80 leading-relaxed">
                    Jab movie download per lagi ho Koi Aur movie download na Karen, ek Ko complete hone den.
                  </p>
                </div>
                <div className="flex gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="w-6 h-6 bg-cyan-500/20 rounded-full flex items-center justify-center shrink-0 text-cyan-400 font-bold text-xs">2</div>
                  <p className="text-xs text-white/80 leading-relaxed">
                    Jab movie download per lagi ho to koi movie ya web series na play Karen jab Tak ke vah download ho rahi hai.
                  </p>
                </div>
                <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20">
                  <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest mb-1">Warning:</p>
                  <p className="text-xs text-red-400/80 leading-relaxed">
                    Agar aap in rules par amal nahi karenge to aapki downloading ruk jayegi aur service block ho sakti hai.
                  </p>
                </div>
              </div>

              <button 
                onClick={() => {
                  handleAction('download', pendingDownload.item, pendingDownload.episodeId, pendingDownload.episodeExt, true);
                  setShowDownloadConfirm(false);
                }}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black py-4 rounded-xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)]"
              >
                Download Now
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Next-Level Mobile Floating Navigation - Ultra-Optimized & Premium UI */}
      <AnimatePresence>
        {!shouldHideNav && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] md:hidden w-auto pointer-events-none px-4"
          >
            <div className="relative flex items-center gap-1 p-2 bg-black/80 border border-white/10 rounded-[3rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,1)] backdrop-blur-3xl pointer-events-auto ring-1 ring-white/10">
              {[
                { id: 'home', label: 'HOME', icon: Home, color: 'cyan' },
                { id: 'movies', label: 'MOVIES', icon: Clapperboard, color: 'blue' },
                { id: 'series', label: 'WEB SERIES', icon: Tv, color: 'purple' },
                { id: 'live', label: 'LIVE TV', icon: Zap, color: 'orange' },
                { id: 'free', label: 'FREE', icon: Gift, color: 'yellow' }
              ].map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'movies') setSelectedMovieCategory('0');
                      if (item.id === 'series') setSelectedSeriesCategory('0');
                      if (item.id === 'live') setSelectedLiveCategory('0');
                      if (item.id === 'free') setActiveFreeTab('menu');
                      setActiveTab(item.id as any);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="relative flex flex-col items-center justify-center w-[72px] h-14 transition-transform active:scale-95"
                  >
                    <div className={cn(
                      "relative z-10 flex flex-col items-center gap-1 transition-all duration-300",
                      isActive ? "opacity-100" : "opacity-40"
                    )}>
                      <div className="p-1 rounded-xl">
                        <Icon 
                          size={20} 
                          className={cn(
                            "transition-all duration-300",
                            isActive ? `text-${item.color}-400` : "text-white"
                          )} 
                        />
                      </div>
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-wider leading-none transition-all duration-300",
                        isActive ? `text-${item.color}-400` : "text-white"
                      )}>
                        {item.label}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium Mobile Categories Side Drawer (Animate from left) */}
      <AnimatePresence>
        {isMobileCategoriesOpen && (
          <div className="fixed inset-0 z-[110] md:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileCategoriesOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />

            {/* Side Panel */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-[85%] max-w-[320px] h-full bg-[#020617]/95 border-r border-white/10 shadow-[20px_0_40px_rgba(0,0,0,0.8)] flex flex-col z-10 backdrop-blur-xl"
            >
              {/* Header */}
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                    <LayoutGrid size={16} className="text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-display font-black text-white uppercase tracking-wider">Categories</h3>
                    <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest">{currentCategories.length} available</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileCategoriesOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all cursor-pointer active:scale-90"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Categories list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[calc(100vh-80px)]">
                {currentCategories.map((cat, idx) => {
                  const isSelected = currentSelectedCategory === cat.category_id;
                  return (
                    <button
                      key={`mobile-cat-${cat.category_id}-${idx}`}
                      onClick={() => {
                        setCurrentSelectedCategory(cat.category_id);
                        setIsMobileCategoriesOpen(false); // Close drawer on selection!
                      }}
                      className={cn(
                        "relative w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-between group active:scale-[0.98]",
                        isSelected 
                          ? "text-black bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_4px_12px_rgba(6,182,212,0.3)] font-extrabold font-sans" 
                          : "text-white/60 hover:text-white bg-white/5 border border-white/5 font-sans"
                      )}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="activeCategoryMobile"
                          className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                      <span className="relative z-10 leading-tight truncate pr-4">{cat.category_name}</span>
                      
                      {cat.category_id === '0' && (
                        <span className={cn(
                          "relative z-10 text-[9px] font-bold px-2 py-0.5 rounded-full",
                          isSelected ? "bg-black/10 text-black" : "bg-white/5 text-white/40"
                        )}>
                          {activeTab === 'movies' ? totalMovieCount : (activeTab === 'series' ? totalSeriesCount : totalLiveCount)}
                        </span>
                      )}

                      {cat.category_id === 'favorites' && (
                        <span className={cn(
                          "relative z-10 text-[9px] font-bold px-2 py-0.5 rounded-full",
                          isSelected ? "bg-black/10 text-black" : "bg-white/5 text-white/40"
                        )}>
                          {(() => {
                            const typeMap = { 'movies': 'movie', 'series': 'series', 'live': 'live' };
                            const currentType = typeMap[activeTab as 'movies' | 'series' | 'live'] || 'movie';
                            return favorites.filter((fav: any) => fav.type === currentType).length;
                          })()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tab Content */}



      {/* Free Movie Details Modal */}
      <AnimatePresence>
        {selectedFreeMovie && !isSyncingDetails && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFreeMovie(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm gpu"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative w-full max-w-4xl glass-dark rounded-2xl md:rounded-3xl overflow-y-auto no-scrollbar shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[92vh] md:max-h-[90vh] border border-white/10 gpu"
            >
              <button 
                onClick={() => setSelectedFreeMovie(null)}
                className="absolute top-4 right-4 z-30 p-2.5 bg-black/60 hover:bg-black text-white hover:text-[#00D1FF] rounded-full transition-all duration-200 border border-white/10 shadow-lg cursor-pointer"
              >
                <X size={18} />
              </button>

              {/* Backdrop cover */}
              <div className="absolute top-0 left-0 right-0 h-[170px] sm:h-[220px] md:h-[280px] z-0 pointer-events-none select-none overflow-hidden">
                <img 
                  src={backdropUrl || posterUrl} 
                  alt="Backdrop" 
                  className="w-full h-full object-cover opacity-85 scale-100 transition-all duration-500"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/movie/800/400?blur=8';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0e] via-[#0c0c0e]/35 to-black/10" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0c0c0e]/60 via-transparent to-[#0c0c0e]/60" />
              </div>

              {/* Overlaid Poster, Cast Box & Details */}
              <div className="relative z-10 w-full px-4 sm:px-6 md:px-8 pt-[70px] sm:pt-[95px] md:pt-[125px] pb-6 flex flex-col gap-5">
                
                {/* Poster & Compact Cast Row */}
                <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[135px_1fr] md:grid-cols-[175px_1fr] gap-3 sm:gap-4 md:gap-6 items-end">
                  {/* Poster */}
                  <div className="w-full aspect-[2/3] rounded-xl sm:rounded-2xl overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.95)] border-2 border-white/20 bg-neutral-900 transform hover:scale-[1.03] transition-all duration-300 shrink-0">
                    <img 
                      src={posterUrl} 
                      alt={selectedFreeMovie.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/movie/400/600?blur=2';
                      }}
                    />
                  </div>

                  {/* Cast Info Box (Adjacent to Poster) */}
                  <div className="flex-1 min-w-0 bg-black/45 backdrop-blur-md rounded-xl sm:rounded-2xl p-2.5 sm:p-3 md:p-3.5 border border-white/10 flex flex-col gap-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-[#00D1FF] uppercase tracking-[0.2em] leading-none mb-1 block">
                        🎭 Cast & Stars
                      </span>
                      {/* Desktop-only Navigation Buttons */}
                      {castingList.length > 3 && (
                        <div className="hidden md:flex items-center gap-1 mb-1">
                          <button 
                            onClick={(e) => {
                              const container = e.currentTarget.closest('.relative')?.querySelector('.cast-scroll-container');
                              if (container) {
                                container.scrollBy({ left: -120, behavior: 'smooth' });
                              }
                            }}
                            className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-[#00D1FF]/20 border border-white/10 hover:border-[#00D1FF]/30 text-white hover:text-[#00D1FF] rounded-full transition-all cursor-pointer shadow-md"
                            title="Previous"
                          >
                            <ChevronRight size={10} className="rotate-180" />
                          </button>
                          <button 
                            onClick={(e) => {
                              const container = e.currentTarget.closest('.relative')?.querySelector('.cast-scroll-container');
                              if (container) {
                                container.scrollBy({ left: 120, behavior: 'smooth' });
                              }
                            }}
                            className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-[#00D1FF]/20 border border-white/10 hover:border-[#00D1FF]/30 text-white hover:text-[#00D1FF] rounded-full transition-all cursor-pointer shadow-md"
                            title="Next"
                          >
                            <ChevronRight size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                    {castingList.length > 0 ? (
                      <div className="cast-scroll-container flex gap-2 sm:gap-3 md:gap-4 overflow-x-auto no-scrollbar items-center py-0.5">
                        {castingList.map((actor, idx) => {
                          const grad = stringToColorGradient(actor.name);
                          return (
                            <div key={`actor-free-${idx}`} className="flex flex-col items-center gap-1 shrink-0 text-center w-[45px] sm:w-[54px] md:w-[60px] group">
                              <div className={`w-8 h-8 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded-full overflow-hidden flex items-center justify-center text-[10px] sm:text-xs font-black shadow-lg shadow-black/40 group-hover:scale-105 transition-transform duration-200 border ${actor.profile_url ? 'border-white/15' : `bg-gradient-to-tr ${grad.from} ${grad.to} ${grad.border} ${grad.text}`}`}>
                                {actor.profile_url ? (
                                  <img 
                                    src={actor.profile_url} 
                                    alt={actor.name} 
                                    className="w-full h-full object-cover" 
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                      const parentHtml = (e.target as HTMLElement).parentElement;
                                      if (parentHtml) {
                                        parentHtml.className += ` bg-gradient-to-tr ${grad.from} ${grad.to} ${grad.border} ${grad.text}`;
                                        const initialsSpan = document.createElement('span');
                                        initialsSpan.innerText = getInitials(actor.name);
                                        parentHtml.appendChild(initialsSpan);
                                      }
                                    }}
                                  />
                                ) : (
                                  <span>{getInitials(actor.name)}</span>
                                )}
                              </div>
                              <span className="text-[7.5px] sm:text-[8px] text-white/70 font-semibold tracking-tight uppercase truncate w-full group-hover:text-white transition-colors">
                                {actor.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-2 flex flex-col items-center justify-center text-center opacity-30 text-[8px] sm:text-[9.5px] gap-1">
                        <span>No Cast Information Available</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Details and Description */}
                <div className="flex justify-between items-start gap-4 pt-1">
                  <div className="space-y-1 md:space-y-2 flex-1">
                    {loadingTmdb && (
                      <div className="text-white/40 text-[10px] flex items-center gap-1 mb-1 bg-black/20 px-2.5 py-1 rounded-md w-fit border border-white/5">
                        <Loader2 size={10} className="animate-spin text-cyan-400" /> 
                        <span className="font-semibold text-slate-300">Loading details...</span>
                      </div>
                    )}
                    {renderStylishTitle(selectedFreeMovie.name, tmdbDetails, false, selectedFreeMovie.rating)}
                    {tmdbDetails?.trailer_url && (
                      <div className="pt-1.5 md:pt-2 select-none">
                        <button 
                          onClick={() => setPlayingTrailerUrl(tmdbDetails.trailer_url || null)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold text-[10px] md:text-xs transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(220,38,38,0.4)] cursor-pointer"
                        >
                          <Youtube size={14} className="fill-white text-white" />
                          <span>Watch Trailer</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-white/60 text-[10px] md:text-sm leading-relaxed line-clamp-2 md:line-clamp-4">
                  {tmdbDetails?.plot || `Enjoy high-quality streaming of this title. Experience the best in entertainment with ${currentBrandName} free service.`}
                </p>

                {/* Free Action Buttons */}
                <div className="flex flex-col gap-3 pt-2">
                  <button 
                    onClick={() => {
                      setPlayingFreeMovie(selectedFreeMovie);
                      trackMediaPlayback(selectedFreeMovie, 'movie');
                    }}
                    className="w-full flex items-center justify-center gap-2 md:gap-3 bg-[#00D1FF] text-black hover:bg-cyan-300 px-4 py-3 md:px-6 md:py-4 rounded-xl font-black transition-all transform hover:scale-[1.02] text-sm md:text-base shadow-[0_0_25px_rgba(0,209,255,0.4)] uppercase tracking-widest cursor-pointer"
                  >
                    <Play size={20} md:size={24} fill="black" /> 
                    <span>Watch Free Online</span>
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {selectedFreeMovie.download_url ? (
                      <button 
                        onClick={() => {
                          const filename = `${selectedFreeMovie.name || 'movie'}.${selectedFreeMovie.play_url.split('.').pop() || 'mp4'}`;
                          triggerDownload(selectedFreeMovie.download_url, filename);
                          trackMediaPlayback(selectedFreeMovie, 'movie', 'Download Link Clicked');
                        }}
                        className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-3 rounded-xl font-bold text-xs transition-all border border-white/5 cursor-pointer"
                      >
                        <Download size={16} /> Download Movie
                      </button>
                    ) : (
                      <div className="flex items-center justify-center text-white/20 select-none text-xs border border-dashed border-white/10 rounded-xl px-4 py-3">
                        No Download Available
                      </div>
                    )}

                    <a 
                      href={formatVlcUrl(getResellerAdjustedUrl(selectedFreeMovie.download_url || selectedFreeMovie.play_url))}
                      onClick={() => trackMediaPlayback(selectedFreeMovie, 'movie', 'Play in VLC Clicked')}
                      className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-xl font-bold text-xs transition-all shadow-lg shadow-orange-500/10"
                    >
                      <Play size={16} /> Play in VLC
                    </a>

                    {currentWhatsappGroupLink && (
                      <a 
                        href={currentWhatsappGroupLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white px-4 py-3 rounded-xl font-bold text-xs transition-all shadow-lg shadow-green-500/10"
                      >
                        <MessageCircle size={16} /> Join WhatsApp Group
                      </a>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Free Movie Player Modal */}
      <AnimatePresence>
        {playingFreeMovie && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 gpu">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPlayingFreeMovie(null)}
              className="absolute inset-0 bg-black/98 backdrop-blur-2xl gpu"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-6xl aspect-video max-h-[85vh] lg:max-h-[80vh] glass-dark rounded-xl md:rounded-[2rem] overflow-hidden shadow-[0_0_100px_rgba(0,209,255,0.4)] border border-white/20 flex flex-col gpu"
            >
              {/* Minimalist Top Header Overlay exactly matching Premium Player */}
              <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-3 md:p-8 bg-gradient-to-b from-black/95 via-black/60 to-transparent pointer-events-none group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center gap-3 md:gap-5 pointer-events-auto">
                  <div className="w-10 h-10 md:w-14 md:h-14 bg-cyan-500/10 backdrop-blur-2xl rounded-xl md:rounded-[1.5rem] flex items-center justify-center border border-cyan-500/40 shadow-[0_0_25px_rgba(0,209,255,0.3)]">
                    <Play size={20} className="text-[#00D1FF] fill-[#00D1FF] md:w-7 md:h-7" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-sm md:text-xl font-bold text-white truncate max-w-[160px] md:max-w-2xl drop-shadow-[0_2px_10px_rgba(0,0,0,1)] tracking-tight">
                      {playingFreeMovie.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-[#00D1FF] rounded-full animate-pulse shadow-[0_0_10px_#00D1FF]" />
                      <p className="text-[9px] md:text-sm text-[#00D1FF] font-black uppercase tracking-[0.25em] drop-shadow-md">
                        Theater Mode 4K
                      </p>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setPlayingFreeMovie(null)}
                  className="p-2.5 md:p-5 bg-black/50 hover:bg-red-500/95 text-white rounded-xl md:rounded-2xl backdrop-blur-2xl border border-white/20 transition-all duration-300 hover:scale-110 active:scale-90 group pointer-events-auto shadow-xl cursor-pointer"
                >
                  <X size={20} className="md:w-7 md:h-7 group-hover:rotate-90 transition-transform duration-500" />
                </button>
              </div>

              <div className="flex-1 w-full h-full bg-black relative">
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm z-0">
                  <Loader2 className="animate-spin text-cyan-500" size={40} />
                  <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Initializing Player...</p>
                </div>
                <div className="relative z-10 w-full h-full">
                  <VideoPlayer 
                    key={getResellerAdjustedUrl(playingFreeMovie.play_url)}
                    options={{
                      autoplay: true,
                      controls: true,
                      responsive: true,
                      fluid: true,
                      poster: playingFreeMovie.poster_url,
                      is_embed: playingFreeMovie.is_embed,
                      skipProxy: true,
                      isLive: false,
                      sources: [{
                        src: getResellerAdjustedUrl(playingFreeMovie.play_url),
                        type: getResellerAdjustedUrl(playingFreeMovie.play_url).includes('.m3u8') ? 'application/x-mpegURL' : 
                              getResellerAdjustedUrl(playingFreeMovie.play_url).toLowerCase().includes('.mp4') ? 'video/mp4' :
                              getResellerAdjustedUrl(playingFreeMovie.play_url).toLowerCase().includes('.webm') ? 'video/webm' :
                              'video/mp4' // Fallback
                      }]
                    }} 
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PSL Player Modal */}
      <AnimatePresence>
        {showPSLPlayer && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 gpu">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPSLPlayer(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-sm gpu"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[95vw] md:w-full md:max-w-5xl max-h-[85vh] lg:max-h-[80vh] glass rounded-3xl overflow-hidden shadow-2xl border border-white/20 flex flex-col gpu"
            >
              <div className="p-4 safe-top flex items-center justify-between border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center border border-green-500 shadow-lg shadow-green-600/20">
                    <span className="text-xs font-black text-white">PSL</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-bold text-white">PSL Live Stream</h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowPSLPlayer(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="relative w-full flex-1 aspect-video bg-black overflow-hidden min-h-[220px] lg:min-h-0">
                {pslOptions.sources[0].src ? (
                  <VideoPlayer key={pslOptions.sources[0].src} options={{...pslOptions, isLive: true}} />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm">
                    <Loader2 className="animate-spin text-cyan-500" size={40} />
                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Fetching Live Stream...</p>
                  </div>
                )}
                
                {/* Language Switcher Overlay */}
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1 p-1 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl">
                  {[
                    { id: 'urdu', label: 'Urdu', color: 'bg-yellow-500' },
                    { id: 'english', label: 'English', color: 'bg-cyan-500' },
                    ...(pslChannel3Url ? [{ id: 'custom' as const, label: pslChannel3Name, color: 'bg-purple-500' }] : [])
                  ].map((lang) => (
                    <button 
                      key={lang.id}
                      onClick={() => setSelectedPslLanguage(lang.id as any)}
                      className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${
                        selectedPslLanguage === lang.id 
                          ? `${lang.color} text-black font-black` 
                          : 'text-white/40 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
                
                {/* Live Indicator Overlay */}
                {((selectedPslLanguage === 'urdu' || selectedPslLanguage === 'english') || 
                  (selectedPslLanguage === 'custom' && pslChannel3ShowLiveIcon)) && (
                  <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-full shadow-lg shadow-red-600/20">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Live</span>
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-yellow-500/10 border-t border-yellow-500/20 flex flex-col items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <p className="text-sm text-yellow-400 font-bold uppercase tracking-[0.2em] text-center">
                    Enjoy the match in {selectedPslLanguage === 'urdu' ? 'Urdu' : 'English'} with {currentBrandName} Premium Experience
                  </p>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">High Quality HLS Stream Enabled</p>
                </div>
                
                {currentWhatsappGroupLink && (
                  <a 
                    href={currentWhatsappGroupLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-[#25D366] hover:bg-[#128C7E] text-white px-8 py-3 rounded-2xl font-black text-sm transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(37,211,102,0.4)] uppercase tracking-widest"
                  >
                    <MessageCircle size={20} fill="white" />
                    Join WhatsApp Group
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* IPL Player Modal */}
      <AnimatePresence>
        {showIPLPlayer && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 gpu">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowIPLPlayer(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-sm gpu"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[95vw] md:w-full md:max-w-5xl max-h-[85vh] lg:max-h-[80vh] glass rounded-3xl overflow-hidden shadow-2xl border border-white/20 flex flex-col gpu"
            >
              <div className="p-4 safe-top flex items-center justify-between border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-blue-600 shadow-lg shadow-white/10 overflow-hidden">
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/en/thumb/8/84/Indian_Premier_League_Official_Logo.svg/200px-Indian_Premier_League_Official_Logo.svg.png" 
                      alt="IPL" 
                      className="w-full h-full object-contain p-1"
                      referrerPolicy="no-referrer"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://www.iplt20.com/assets/images/IPL-logo-new-old.png'; }}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-bold text-white">IPL Live Stream</h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowIPLPlayer(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="relative w-full flex-1 aspect-video bg-black overflow-hidden min-h-[220px] lg:min-h-0">
                {iplOptions.sources[0].src ? (
                  <VideoPlayer 
                    key={iplOptions.sources[0].src}
                    options={{...iplOptions, isLive: true}}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm">
                    <Loader2 className="animate-spin text-blue-500" size={40} />
                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Fetching Live Stream...</p>
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-blue-600/10 border-t border-blue-600/20 flex flex-col items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <p className="text-sm text-blue-400 font-bold uppercase tracking-[0.2em] text-center">
                    Enjoy the match with {currentBrandName} Premium Experience
                  </p>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">High Quality HLS Stream Enabled</p>
                </div>

                {currentWhatsappGroupLink && (
                  <a 
                    href={currentWhatsappGroupLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-[#25D366] hover:bg-[#128C7E] text-white px-8 py-3 rounded-2xl font-black text-sm transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(37,211,102,0.4)] uppercase tracking-widest"
                  >
                    <MessageCircle size={20} fill="white" />
                    Join WhatsApp Group
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Live Event Player Modal */}
      <AnimatePresence>
        {selectedLiveEvent && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 gpu">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedLiveEvent(null);
                setActiveLiveChannelIndex(0);
              }}
              className="absolute inset-0 bg-black/95 backdrop-blur-sm gpu"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[95vw] md:w-full md:max-w-5xl max-h-[85vh] lg:max-h-[80vh] glass rounded-3xl overflow-hidden shadow-2xl border border-white/20 flex flex-col gpu text-white animate-in"
            >
              <div className="p-4 safe-top flex items-center justify-between border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-600 rounded-lg flex items-center justify-center border border-rose-500 shadow-lg shadow-rose-600/20">
                    <Radio size={20} className="text-white animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-black text-white italic tracking-tight">{selectedLiveEvent.name}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setSelectedLiveEvent(null);
                      setActiveLiveChannelIndex(0);
                    }}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white cursor-pointer"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="relative w-full flex-1 aspect-video bg-black overflow-hidden min-h-[220px] lg:min-h-0">
                {selectedLiveEvent.channels && selectedLiveEvent.channels.length > 0 ? (
                  (() => {
                    const activeChannel = selectedLiveEvent.channels[activeLiveChannelIndex] || selectedLiveEvent.channels[0];
                    return (
                      <VideoPlayer 
                        key={`${selectedLiveEvent.id}-${activeLiveChannelIndex}-${activeChannel.play_url}`}
                        options={{
                          autoplay: true,
                          controls: true,
                          responsive: true,
                          fluid: true,
                          poster: selectedLiveEvent.poster_url,
                          is_embed: !!activeChannel.is_embed,
                          is_webpage: !!activeChannel.is_webpage,
                          sandbox_disabled: !!activeChannel.sandbox_disabled,
                          skipProxy: true,
                          isLive: true,
                          sources: [{
                            src: activeChannel.play_url,
                            type: activeChannel.play_url.includes('.m3u8') 
                              ? 'application/x-mpegURL' 
                              : (activeChannel.play_url.includes('.mpd') || activeChannel.is_mpd)
                                ? 'application/dash+xml' 
                                : 'video/mp4'
                          }]
                        }} 
                      />
                    );
                  })()
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm">
                    <Loader2 className="animate-spin text-rose-500" size={40} />
                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest">No feeds configured...</p>
                  </div>
                )}
                
                {/* Channel / Feed switcher overlay */}
                {selectedLiveEvent.channels && selectedLiveEvent.channels.length > 1 && (
                  <div className="absolute top-4 right-4 z-10 flex flex-wrap items-center gap-1.5 p-1 bg-black/50 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl max-w-[80%] max-h-[85%] overflow-y-auto">
                    {selectedLiveEvent.channels.map((chan, cIdx) => (
                      <button 
                        key={`feed-switch-${cIdx}`}
                        onClick={() => {
                          setActiveLiveChannelIndex(cIdx);
                          trackMediaPlayback(selectedLiveEvent, 'live_event', chan.name || `Feed ${cIdx + 1}`);
                        }}
                        className={`px-3.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-300 cursor-pointer ${
                          activeLiveChannelIndex === cIdx 
                            ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' 
                            : 'text-white/50 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          <span className={`w-1 h-1 rounded-full ${activeLiveChannelIndex === cIdx ? 'bg-white animate-ping' : 'bg-white/60'}`} />
                          {chan.name || `Feed ${cIdx + 1}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Live Badge */}
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-full shadow-lg shadow-red-600/20">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Live</span>
                </div>
              </div>
              
              <div className="p-6 bg-rose-500/10 border-t border-rose-500/20 flex flex-col items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <p className="text-sm text-rose-400 font-bold uppercase tracking-[0.2em] text-center">
                    Enjoying {selectedLiveEvent.name} with {currentBrandName} Luxury Experience
                  </p>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">
                    Active Feed: {selectedLiveEvent.channels?.[activeLiveChannelIndex]?.name || 'Primary'} Feed
                  </p>
                </div>
                
                {currentWhatsappGroupLink && (
                  <a 
                    href={currentWhatsappGroupLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-[#25D366] hover:bg-[#128C7E] text-white px-8 py-3 rounded-2xl font-black text-sm transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(37,211,102,0.4)] uppercase tracking-widest cursor-pointer"
                  >
                    <MessageCircle size={20} fill="white" />
                    Join WhatsApp Group
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Movie/Series Password Verification Modal */}
      <AnimatePresence>
        {passwordProtectedItem && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm glass border border-white/20 rounded-[2.5rem] overflow-hidden p-6 text-white shadow-2xl flex flex-col items-center text-center"
            >
              <button 
                onClick={() => setPasswordProtectedItem(null)}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>

              <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center text-rose-500 mb-4 mt-2 shadow-lg shadow-rose-500/10">
                <Lock size={28} className="animate-pulse" />
              </div>

              <h3 className="text-xl font-display font-black tracking-tight italic uppercase text-rose-400 leading-tight mb-2">
                🔒 Locked Content
              </h3>
              
              <p className="text-xs text-white/70 font-medium px-4 mb-6 leading-relaxed">
                "{passwordProtectedItem.item.name}" is password protected. Enter correct access password to unlock.
              </p>

              <div className="w-full space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest px-1">Access Password</label>
                  <input
                    type="password"
                    value={enteredPassword}
                    onChange={(e) => {
                      setEnteredPassword(e.target.value);
                      setPasswordError(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (enteredPassword.trim() === passwordProtectedItem.item.password?.trim()) {
                          const cb = passwordProtectedItem.callback;
                          setPasswordProtectedItem(null);
                          cb();
                        } else {
                          setPasswordError(true);
                        }
                      }
                    }}
                    placeholder="Enter password..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-center text-white focus:outline-none focus:border-rose-500/50 transition-colors uppercase tracking-widest font-mono"
                  />
                  {passwordError && (
                    <p className="text-[10px] font-bold text-rose-500 text-center mt-1 uppercase tracking-wider animate-bounce">
                      ⚠ Incorrect Password! Try again.
                    </p>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (enteredPassword.trim() === passwordProtectedItem.item.password?.trim()) {
                      const cb = passwordProtectedItem.callback;
                      setPasswordProtectedItem(null);
                      cb();
                    } else {
                      setPasswordError(true);
                    }
                  }}
                  className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-rose-600/20"
                >
                  Unlock & Play
                </button>
              </div>

              {/* Divider lines */}
              <div className="w-full flex items-center my-6">
                <div className="flex-1 h-[1px] bg-white/10" />
                <span className="px-3 text-[9px] uppercase font-black text-white/30 tracking-widest">Get Password Link</span>
                <div className="flex-1 h-[1px] bg-white/10" />
              </div>

              {/* Get Password Contact & WhatsApp info */}
              {currentWhatsappNumber && (
                <div className="w-full flex flex-col items-center gap-3">
                  <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                    Don't have the password? Contact us below:
                  </p>
                  <a 
                    href={`https://wa.me/${currentWhatsappNumber}?text=Hello!%20I%20need%20the%20password%20for%20"${encodeURIComponent(passwordProtectedItem.item.name)}"`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white px-6 py-2.5 rounded-xl font-black text-[11px] transition-all transform hover:scale-105 shadow-[0_0_15px_rgba(37,211,102,0.3)] uppercase tracking-wider cursor-pointer"
                  >
                    <MessageCircle size={15} fill="white" />
                    Get password contact
                  </a>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Login Modal */}
      <AnimatePresence>
        {showAdminLogin && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-xs glass p-6 rounded-2xl border border-white/10"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">Login Portal</h3>
                  <p className="text-[9px] text-white/50">Enter admin or reseller license password</p>
                </div>
                <button onClick={() => setShowAdminLogin(false)} className="text-white/40 hover:text-white p-1">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/40 font-bold mb-1.5">Password</label>
                  <input 
                    type="password" 
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    autoFocus
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50"
                    placeholder="••••••••"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                >
                  Login
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Free Series Details Modal */}
      <AnimatePresence>
        {selectedFreeSeries && !isSyncingDetails && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFreeSeries(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm gpu"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative w-full max-w-4xl glass-dark rounded-2xl md:rounded-3xl overflow-y-auto no-scrollbar shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[92vh] md:max-h-[90vh] border border-white/10 gpu"
            >
              <button 
                onClick={() => setSelectedFreeSeries(null)}
                className="absolute top-4 right-4 z-30 p-2.5 bg-black/60 hover:bg-black text-white hover:text-[#00D1FF] rounded-full transition-all duration-200 border border-white/10 shadow-lg cursor-pointer"
              >
                <X size={18} />
              </button>

              {/* Backdrop cover */}
              <div className="absolute top-0 left-0 right-0 h-[170px] sm:h-[220px] md:h-[280px] z-0 pointer-events-none select-none overflow-hidden">
                <img 
                  src={backdropUrl || posterUrl} 
                  alt="Backdrop" 
                  className="w-full h-full object-cover opacity-85 scale-100 transition-all duration-500"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/series/800/400?blur=8';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0e] via-[#0c0c0e]/35 to-black/10" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0c0c0e]/60 via-transparent to-[#0c0c0e]/60" />
              </div>

              {/* Overlaid Poster, Cast Box & Details */}
              <div className="relative z-10 w-full px-4 sm:px-6 md:px-8 pt-[70px] sm:pt-[95px] md:pt-[125px] pb-6 flex flex-col gap-5">
                
                {/* Poster & Compact Cast Row */}
                <div className="grid grid-cols-[100px_1fr] sm:grid-cols-[135px_1fr] md:grid-cols-[175px_1fr] gap-3 sm:gap-4 md:gap-6 items-end">
                  {/* Poster */}
                  <div className="w-full aspect-[2/3] rounded-xl sm:rounded-2xl overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.95)] border-2 border-white/20 bg-neutral-900 transform hover:scale-[1.03] transition-all duration-300 shrink-0">
                    <img 
                      src={posterUrl} 
                      alt={selectedFreeSeries.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/series/400/600?blur=2';
                      }}
                    />
                  </div>

                  {/* Cast Info Box (Adjacent to Poster) */}
                  <div className="flex-1 min-w-0 bg-black/45 backdrop-blur-md rounded-xl sm:rounded-2xl p-2.5 sm:p-3 md:p-3.5 border border-white/10 flex flex-col gap-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)] relative">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] sm:text-[9.5px] font-black text-purple-400 uppercase tracking-[0.2em] leading-none mb-1 block">
                        🎭 Cast & Stars
                      </span>
                      {/* Desktop-only Navigation Buttons */}
                      {castingList.length > 3 && (
                        <div className="hidden md:flex items-center gap-1 mb-1">
                          <button 
                            onClick={(e) => {
                              const container = e.currentTarget.closest('.relative')?.querySelector('.cast-scroll-container');
                              if (container) {
                                container.scrollBy({ left: -120, behavior: 'smooth' });
                              }
                            }}
                            className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-[#00D1FF]/20 border border-white/10 hover:border-[#00D1FF]/30 text-white hover:text-[#00D1FF] rounded-full transition-all cursor-pointer shadow-md"
                            title="Previous"
                          >
                            <ChevronRight size={10} className="rotate-180" />
                          </button>
                          <button 
                            onClick={(e) => {
                              const container = e.currentTarget.closest('.relative')?.querySelector('.cast-scroll-container');
                              if (container) {
                                container.scrollBy({ left: 120, behavior: 'smooth' });
                              }
                            }}
                            className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-[#00D1FF]/20 border border-white/10 hover:border-[#00D1FF]/30 text-white hover:text-[#00D1FF] rounded-full transition-all cursor-pointer shadow-md"
                            title="Next"
                          >
                            <ChevronRight size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                    {castingList.length > 0 ? (
                      <div className="cast-scroll-container flex gap-2 sm:gap-3 md:gap-4 overflow-x-auto no-scrollbar items-center py-0.5">
                        {castingList.map((actor, idx) => {
                          const grad = stringToColorGradient(actor.name);
                          return (
                            <div key={`actor-freeseries-${idx}`} className="flex flex-col items-center gap-1 shrink-0 text-center w-[45px] sm:w-[54px] md:w-[60px] group">
                              <div className={`w-8 h-8 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded-full overflow-hidden flex items-center justify-center text-[10px] sm:text-xs font-black shadow-lg shadow-black/40 group-hover:scale-105 transition-transform duration-200 border ${actor.profile_url ? 'border-white/15' : `bg-gradient-to-tr ${grad.from} ${grad.to} ${grad.border} ${grad.text}`}`}>
                                {actor.profile_url ? (
                                  <img 
                                    src={actor.profile_url} 
                                    alt={actor.name} 
                                    className="w-full h-full object-cover" 
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                      const parentHtml = (e.target as HTMLElement).parentElement;
                                      if (parentHtml) {
                                        parentHtml.className += ` bg-gradient-to-tr ${grad.from} ${grad.to} ${grad.border} ${grad.text}`;
                                        const initialsSpan = document.createElement('span');
                                        initialsSpan.innerText = getInitials(actor.name);
                                        parentHtml.appendChild(initialsSpan);
                                      }
                                    }}
                                  />
                                ) : (
                                  <span>{getInitials(actor.name)}</span>
                                )}
                              </div>
                              <span className="text-[7.5px] sm:text-[8px] text-white/70 font-semibold tracking-tight uppercase truncate w-full group-hover:text-white transition-colors">
                                {actor.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-2 flex flex-col items-center justify-center text-center opacity-30 text-[8px] sm:text-[9.5px] gap-1">
                        <span>No Cast Information Available</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Details and Description */}
                <div className="flex justify-between items-start gap-4 pt-1">
                  <div className="space-y-1 md:space-y-2 flex-1">
                    {loadingTmdb && (
                      <div className="text-white/40 text-[10px] flex items-center gap-1 mb-1 bg-black/20 px-2.5 py-1 rounded-md w-fit border border-white/5">
                        <Loader2 size={10} className="animate-spin text-cyan-400" /> 
                        <span className="font-semibold text-slate-300">Loading details...</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 flex-wrap">
                      {renderStylishTitle(
                        selectedFreeSeries.name, 
                        tmdbDetails, 
                        true, 
                        selectedFreeSeries.rating,
                        freeSeriesEpisodesMap 
                          ? (Object.values(freeSeriesEpisodesMap) as any[]).reduce((acc: number, curr: any) => acc + (Array.isArray(curr) ? curr.length : 0), 0)
                          : undefined
                      )}
                      {currentWhatsappGroupLink && (
                        <a 
                          href={currentWhatsappGroupLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white px-3 py-1.5 rounded-full font-bold text-[10px] md:text-xs transition-all shadow-lg shadow-green-500/10 active:scale-95 cursor-pointer whitespace-nowrap"
                        >
                          <MessageCircle size={14} /> Join WhatsApp Group
                        </a>
                      )}
                      {tmdbDetails?.trailer_url && (
                        <button 
                          onClick={() => setPlayingTrailerUrl(tmdbDetails.trailer_url || null)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-full font-bold text-[10px] md:text-xs transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(220,38,38,0.4)] cursor-pointer whitespace-nowrap"
                        >
                          <Youtube size={14} className="fill-white text-white" />
                          <span>Watch Trailer</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-white/60 text-[10px] md:text-sm leading-relaxed line-clamp-2 md:line-clamp-4">
                  {tmdbDetails?.plot || `Enjoy high-quality streaming of this title. Experience the best in entertainment with ${currentBrandName} free service.`}
                </p>

                {/* Free Series Actions & Playlist Selector */}
                {!(isM3uLoading || freeSeriesEpisodesMap || (selectedFreeSeries.episodes && selectedFreeSeries.episodes.length > 0)) ? (
                  <div className="flex flex-col gap-3 pt-2">
                    <button 
                      onClick={() => {
                        setPlayingFreeSeries(selectedFreeSeries);
                        trackMediaPlayback(selectedFreeSeries, 'series');
                      }}
                      className="w-full flex items-center justify-center gap-2 md:gap-3 bg-[#00D1FF] text-black hover:bg-cyan-300 px-4 py-3 md:px-6 md:py-4 rounded-xl font-black transition-all transform hover:scale-[1.03] text-sm md:text-base shadow-[0_0_25px_rgba(0,209,255,0.4)] uppercase tracking-widest cursor-pointer"
                    >
                      <Play size={20} md:size={24} fill="black" /> 
                      <span>Watch Free Online</span>
                    </button>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedFreeSeries.download_url ? (
                        <button 
                          onClick={() => {
                            const filename = `${selectedFreeSeries.name || 'series'}.${selectedFreeSeries.play_url?.split('.').pop() || 'mp4'}`;
                            triggerDownload(selectedFreeSeries.download_url, filename);
                          }}
                          className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-3 rounded-xl font-bold text-xs transition-all border border-white/5 cursor-pointer"
                        >
                          <Download size={16} /> Download
                        </button>
                      ) : (
                        <div className="flex items-center justify-center text-white/20 select-none text-xs border border-dashed border-white/10 rounded-xl px-4 py-3">
                          No Download Available
                        </div>
                      )}

                      <a 
                        href={formatVlcUrl(getResellerAdjustedUrl(selectedFreeSeries.download_url || selectedFreeSeries.play_url))}
                        className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-xl font-bold text-xs transition-all shadow-lg shadow-orange-500/10"
                      >
                        <Play size={16} /> Play in VLC
                      </a>
                    </div>
                  </div>
                ) : (
                  /* Playlist episodes rendered beautifully inside the modal matching the mock */
                  <div className="space-y-4 md:space-y-6 pt-1 md:pt-2">
                    {isM3uLoading ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                        <Loader2 className="animate-spin text-[#00D1FF]" size={28} />
                        <span className="text-xs md:text-sm text-white/40 font-medium">Loading episodes list, please wait...</span>
                      </div>
                    ) : freeSeriesEpisodesMap ? (
                      <>
                        {/* Seasons Selector */}
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-2">
                          {Object.keys(freeSeriesEpisodesMap).map((seasonNum, idx) => (
                            <button
                              key={`free-season-${seasonNum}-${idx}`}
                              onClick={() => setSelectedFreeSeason(seasonNum)}
                              className={cn(
                                "whitespace-nowrap px-3 md:px-4 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all border cursor-pointer",
                                selectedFreeSeason === seasonNum 
                                  ? "bg-cyan-600 border-cyan-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]" 
                                  : "bg-white/5 border-white/10 text-white/60 hover:border-white/30"
                              )}
                            >
                              Season {seasonNum}
                            </button>
                          ))}
                        </div>

                        {/* Episodes List */}
                        <div className="space-y-2 max-h-[300px] md:max-h-[400px] overflow-y-auto pr-1 md:pr-2 desktop-scrollbar pb-4">
                          {freeSeriesEpisodesMap[selectedFreeSeason || '']?.map((episode: any, idx: number) => (
                            <div 
                              key={`free-episode-${episode.id}-${idx}`}
                              className="group/ep flex items-center justify-between p-2.5 md:p-3 rounded-lg md:rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all gap-4"
                            >
                              <div className="flex items-center gap-3 md:gap-4 min-w-0">
                                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/10 flex items-center justify-center text-[9px] md:text-[10px] font-bold shrink-0 text-white/85">
                                  {episode.episode_num}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs md:text-sm font-semibold line-clamp-1 text-white">{episode.title}</span>
                                  <span className="text-[9px] md:text-[10px] text-white/40 uppercase tracking-wider">Episode {episode.episode_num}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                                {/* Play Online */}
                                <button 
                                  onClick={() => {
                                    setPlayingFreeSeries(selectedFreeSeries);
                                    handleSelectFreeEpisode(episode, selectedFreeSeason || '');
                                    trackMediaPlayback(selectedFreeSeries, 'series', `S${selectedFreeSeason || '1'} E${episode.episode_num || '1'}: ${episode.title || ''}`);
                                  }}
                                  className="p-1.5 md:p-2 bg-[#00D1FF]/10 text-[#00D1FF] hover:bg-[#00D1FF]/20 rounded-lg transition-colors border border-[#00D1FF]/20 cursor-pointer"
                                  title="Play Online"
                                >
                                  <Play size={14} md:size={16} fill="currentColor" />
                                </button>
                                
                                {/* Share/URL button */}
                                <button 
                                  onClick={() => {
                                    window.location.href = formatVlcUrl(getResellerAdjustedUrl(episode.play_url));
                                    if (selectedFreeSeries) {
                                      const seasonStr = selectedFreeSeason ? `S${selectedFreeSeason}` : '';
                                      const epStr = episode.episode_num ? `E${episode.episode_num}` : '';
                                      const partStr = [seasonStr, epStr].filter(Boolean).join('');
                                      trackMediaPlayback(selectedFreeSeries, 'series', `${partStr || 'Episode'}: ${episode.title || ''} (VLC External)`);
                                    }
                                  }}
                                  className="p-1.5 md:p-2 hover:bg-white/20 text-white/60 hover:text-white rounded-lg transition-colors cursor-pointer"
                                  title="Play in External Player"
                                >
                                  <Share2 size={14} md:size={16} />
                                </button>

                                {/* Copy link */}
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(getResellerAdjustedUrl(episode.play_url));
                                    setFreeCopiedId(episode.id);
                                    setTimeout(() => setFreeCopiedId(null), 2000);
                                  }}
                                  className={cn(
                                    "p-1.5 md:p-2 rounded-lg transition-all cursor-pointer",
                                    freeCopiedId === episode.id 
                                      ? "bg-green-500/20 text-green-400" 
                                      : "hover:bg-white/20 text-white/60"
                                  )}
                                  title="Copy Episode Link"
                                >
                                  {freeCopiedId === episode.id ? <Check size={14} md:size={16} /> : <Copy size={14} md:size={16} />}
                                </button>

                                {/* Download */}
                                <button 
                                  onClick={() => handleDownloadFreeEpisode({ ...episode, season: selectedFreeSeason })}
                                  className="p-1.5 md:p-2 hover:bg-white/20 text-white/60 hover:text-white rounded-lg transition-colors cursor-pointer"
                                  title="Download Episode"
                                >
                                  <Download size={14} md:size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs md:text-sm text-white/40 italic text-center py-4">No episodes found for this free series.</p>
                    )}
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Free Series Episodes Download Modal */}
      <AnimatePresence>
        {showFreeDownloadModal && (
          <div className="fixed inset-0 z-[125] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFreeDownloadModal(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-md gpu"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl bg-zinc-950/95 border border-white/10 rounded-2xl sm:rounded-3xl shadow-[0_24px_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[85vh] z-10"
            >
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {selectedFreeSeries?.name}
                  </h3>
                  <p className="text-xs text-[#00D1FF] font-medium mt-0.5 uppercase tracking-wider font-mono">
                    Episodes Playlist
                  </p>
                </div>
                <button 
                  onClick={() => setShowFreeDownloadModal(false)}
                  className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content Box */}
              <div className="p-5 flex-1 overflow-y-auto select-none min-h-[250px] flex flex-col">
                {isFreeDownloadLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
                    <Loader2 className="animate-spin text-[#00D1FF]" size={42} />
                    <p className="text-white/60 text-sm font-medium animate-pulse">
                      Fetching episodes list, please wait...
                    </p>
                  </div>
                ) : freeDownloadModalEpisodes.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <p className="text-white/40 text-sm font-medium">
                      No episodes found in the playlist.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {freeDownloadModalEpisodes.map((ep) => {
                      const seasonStr = ep.season ? `S${ep.season}` : '';
                      const epStr = ep.episode_num ? `E${ep.episode_num}` : '';
                      const badgeStr = [seasonStr, epStr].filter(Boolean).join('');
                      
                      return (
                        <div 
                          key={ep.id}
                          className="bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-cyan-500/15 rounded-xl md:rounded-2xl p-3 md:p-4 flex items-center justify-between gap-4 transition-all duration-300"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {badgeStr && (
                              <span className="shrink-0 text-[10px] md:text-xs text-[#00D1FF] bg-cyan-500/10 border border-cyan-500/25 px-2 py-1 rounded font-mono font-black tracking-tight">
                                {badgeStr}
                              </span>
                            )}
                            <h4 className="text-xs md:text-sm font-medium text-white truncate pr-2">
                              {ep.title}
                            </h4>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Download Action */}
                            <button
                              onClick={() => handleDownloadFreeEpisode(ep)}
                              className="p-2 md:p-3 bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-black rounded-lg md:rounded-xl border border-cyan-500/20 hover:border-transparent transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center"
                              title="Download Episode"
                            >
                              <Download size={15} className="md:w-3.5 md:h-3.5" />
                            </button>

                            {/* External Player Action */}
                            <button
                              onClick={() => {
                                window.location.href = formatVlcUrl(ep.play_url);
                              }}
                              className="p-2 md:p-3 bg-orange-500/10 hover:bg-orange-500 text-orange-400 hover:text-white rounded-lg md:rounded-xl border border-orange-500/20 hover:border-transparent transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center"
                              title="Play in External Player (VLC)"
                            >
                              <ExternalLink size={15} className="md:w-3.5 md:h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Free Series Player Modal */}
      <AnimatePresence>
        {playingFreeSeries && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 gpu">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPlayingFreeSeries(null)}
              className="absolute inset-0 bg-black/98 backdrop-blur-2xl gpu"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-6xl aspect-video max-h-[85vh] lg:max-h-[80vh] glass-dark rounded-xl md:rounded-[2rem] overflow-hidden shadow-[0_0_100px_rgba(0,209,255,0.4)] border border-white/20 flex flex-col gpu"
            >
              {/* Minimalist Top Header Overlay exactly matching Premium Player */}
              <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-3 md:p-8 bg-gradient-to-b from-black/95 via-black/60 to-transparent pointer-events-none group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center gap-3 md:gap-5 pointer-events-auto">
                  <div className="w-10 h-10 md:w-14 md:h-14 bg-cyan-500/10 backdrop-blur-2xl rounded-xl md:rounded-[1.5rem] flex items-center justify-center border border-cyan-500/40 shadow-[0_0_25px_rgba(0,209,255,0.3)]">
                    <Tv size={20} className="text-[#00D1FF] md:w-7 md:h-7" />
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-sm md:text-xl font-bold text-white truncate max-w-[160px] md:max-w-2xl drop-shadow-[0_2px_10px_rgba(0,0,0,1)] tracking-tight">
                      {playingFreeSeries.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-[#00D1FF] rounded-full animate-pulse shadow-[0_0_10px_#00D1FF]" />
                      <p className="text-[9px] md:text-sm text-[#00D1FF] font-black uppercase tracking-[0.25em] drop-shadow-md">
                        Theater Mode 4K
                      </p>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setPlayingFreeSeries(null)}
                  className="p-2.5 md:p-5 bg-black/50 hover:bg-red-500/95 text-white rounded-xl md:rounded-2xl backdrop-blur-2xl border border-white/20 transition-all duration-300 hover:scale-110 active:scale-90 group pointer-events-auto shadow-xl cursor-pointer"
                >
                  <X size={20} className="md:w-7 md:h-7 group-hover:rotate-90 transition-transform duration-500" />
                </button>
              </div>

              <div className="flex-1 w-full h-full bg-black relative">
                {isM3uLoading && (
                  <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-[131] flex flex-col items-center justify-center gap-4">
                    <Loader2 className="animate-spin text-purple-400" size={54} />
                    <p className="text-[#00D1FF] font-black uppercase tracking-[0.2em] text-[10px] md:text-xs">Parsing Series Playlist M3U...</p>
                  </div>
                )}
                {playingFreeSeries.is_embed ? (
                  <div className="absolute inset-0 w-full h-full bg-black">
                    <iframe
                      src={getAutoplayUrl(playingFreeSeries.play_url) || undefined}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      referrerPolicy="no-referrer"
                      sandbox={isAntiPopupActive ? "allow-scripts allow-same-origin allow-presentation allow-forms allow-pointer-lock" : undefined}
                    />
                    {/* Floating Ad-Shield / Anti-Popup Controller */}
                    <div className="absolute top-[20px] left-[20px] z-[99] pointer-events-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleAntiPopup}
                        className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-300 shadow-lg cursor-pointer ${
                          isAntiPopupActive 
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25' 
                            : 'bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/25'
                        }`}
                        title={isAntiPopupActive ? "Disable Anti-Popup (If player fails)" : "Enable Anti-Popup AdBlocker"}
                      >
                        <Shield className={`w-4 h-4 ${isAntiPopupActive ? 'text-emerald-400' : 'text-rose-400 animate-pulse'}`} />
                      </button>
                    </div>
                  </div>
                ) : (
                  (!isM3uLoading && (freeSeriesActiveUrl || playingFreeSeries.play_url)) ? (
                    <VideoPlayer 
                      key={playingFreeSeries.id}
                      options={{
                        autoplay: true,
                        controls: true,
                        responsive: true,
                        fluid: true,
                        isLive: false,
                        poster: playingFreeSeries.poster_url,
                        is_embed: playingFreeSeries.is_embed,
                        skipProxy: true,
                        sources: [{
                          src: getResellerAdjustedUrl(freeSeriesActiveUrl || playingFreeSeries.play_url),
                          type: getResellerAdjustedUrl(freeSeriesActiveUrl || playingFreeSeries.play_url).includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
                        }]
                      }} 
                      playingEpisode={playingFreeEpisode}
                      nextEpisode={getNextFreeEpisode(playingFreeEpisode)}
                      onPlayNext={handlePlayNextFreeEpisode}
                      episodesMap={freeSeriesEpisodesMap || undefined}
                      onSelectEpisode={handleSelectFreeEpisode}
                      onDownloadEpisode={handleDownloadFreeEpisode}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/45 bg-black gap-2">
                       <Tv size={42} className="text-white/20" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-[#00D1FF]/60">Streaming Source Empty</span>
                    </div>
                  )
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Standalone Reseller Panel Modal */}
      <AnimatePresence>
        {loggedInReseller && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 gpu">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLoggedInReseller(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl gpu"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-xl bg-[#0a0a0b] rounded-[3rem] overflow-hidden shadow-[0_0_80px_rgba(168,85,247,0.2)] border border-white/10 flex flex-col gpu text-white"
            >
              {/* Header */}
              <div className="p-6 flex items-center justify-between border-b border-white/5 bg-white/5">
                <div className="flex flex-col">
                  <h3 className="text-xl font-black italic tracking-tighter uppercase text-purple-400">Reseller License Panel</h3>
                  <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Logged in as: {loggedInReseller.brand_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      setLoggedInReseller(null);
                      if (typeof window !== 'undefined') {
                        localStorage.removeItem('logged_in_reseller');
                      }
                    }}
                    className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-rose-500/20"
                  >
                    Log Out
                  </button>
                  <button 
                    onClick={() => setLoggedInReseller(null)}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/5 cursor-pointer text-white"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] desktop-scrollbar">
                
                {/* License Status Card */}
                <div className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 p-6">
                  {/* Background Glow */}
                  <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      ACTIVE RESELLER LICENSE
                    </span>
                    <span className="text-[10px] font-mono text-purple-400 font-bold">
                      ID: {loggedInReseller.id?.slice(0, 8)}
                    </span>
                  </div>

                  <div className="space-y-1 mb-6">
                    <h4 className="text-2xl font-black tracking-tight">{loggedInReseller.brand_name}</h4>
                    <p className="text-xs text-white/60">Subdomain Keyword: <span className="font-mono text-cyan-400 font-bold">{loggedInReseller.subdomain}</span></p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-black/40 p-4 rounded-2xl border border-white/5">
                    <div>
                      <p className="text-[9px] text-white/40 uppercase font-black tracking-widest">License Type</p>
                      <p className="text-lg font-black text-purple-300">{loggedInReseller.license_type || '1 Year'}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-white/40 uppercase font-black tracking-widest">Status</p>
                      <p className="text-lg font-black text-emerald-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Authorized
                      </p>
                    </div>
                  </div>

                  {/* Extend License Trigger Button with Sajid's WhatsApp contact */}
                  <div className="mt-6">
                    <a 
                      href={`https://wa.me/923161611304?text=Hello%20Sajid!%20I%20want%20to%20extend%20my%20reseller%20license%20for%20my%20brand%20"${encodeURIComponent(loggedInReseller.brand_name || '')}"`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-black uppercase tracking-widest text-xs py-3.5 px-6 rounded-2xl shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <MessageCircle size={16} fill="white" />
                      Extend Your License
                    </a>
                  </div>
                </div>

                {/* Configuration Details Box */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-white/40 px-1">Your Branded App Settings</h4>
                  
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-white/5">
                      <span className="text-white/50">Tagline / Slogan:</span>
                      <span className="text-white font-bold">{loggedInReseller.tagline || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-white/5">
                      <span className="text-white/50">WhatsApp Contact:</span>
                      <span className="text-white font-bold">{loggedInReseller.whatsapp_number || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-white/5">
                      <span className="text-white/50">Group Link:</span>
                      <span className="text-white font-bold truncate max-w-[200px] text-cyan-400">{loggedInReseller.whatsapp_group_link || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-white/5">
                      <span className="text-white/50">Custom IPTV Server URL:</span>
                      <span className="text-white font-bold truncate max-w-[200px] text-purple-400">{loggedInReseller.server_url || 'Default System'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-white/5">
                      <span className="text-white/50">App Download Link:</span>
                      <span className="text-white font-bold truncate max-w-[200px] text-emerald-400">{loggedInReseller.app_link || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-white/50">Custom Logo:</span>
                      <span className="text-white font-bold truncate max-w-[200px]">{loggedInReseller.logo_url ? 'Configured' : 'Default Logo'}</span>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Standalone Admin Panel Modal */}
      <AnimatePresence>
        {isAdminLoggedIn && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 gpu">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdminLoggedIn(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl gpu"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl bg-[#0a0a0b] rounded-[3rem] overflow-hidden shadow-[0_0_80px_rgba(34,211,238,0.2)] border border-white/10 flex flex-col gpu"
            >
              <div className="p-6 flex items-center justify-between border-b border-white/5 bg-white/5">
                <div className="flex flex-col">
                  <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">Admin Control Center</h3>
                  <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">Logged in: {currentUser?.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      setIsAdminLoggedIn(false);
                    }}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20"
                  >
                    Log Out
                  </button>
                  <button 
                    onClick={() => setIsAdminLoggedIn(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-6 bg-black/40 border-b border-white/5">
                <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 overflow-x-auto no-scrollbar">
                  {(['psl', 'ipl', 'app', 'free_movies', 'free_series', 'live_events', 'fifa', 'analytics', 'resellers'] as const).map((tab) => (
                    <button 
                      key={tab}
                      onClick={() => setActiveAdminTab(tab)}
                      className={`min-w-[80px] flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        activeAdminTab === tab 
                          ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' 
                          : 'text-white/40 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {tab === 'app' ? 'General' : tab === 'fifa' ? 'FIFA 2026' : tab === 'analytics' ? 'STATS & ANALYTICS' : tab === 'resellers' ? 'RESELLERS' : tab.replace('free_', '').replace('_', ' ').toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6 flex-1 overflow-y-auto no-scrollbar max-h-[60vh]">
                <div className="flex flex-col gap-6">
                  {activeAdminTab === 'app' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* PSL Toggle */}
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-cyan-400 uppercase tracking-widest">PSL Settings</h4>
                          <button 
                            onClick={() => setNewAppSettings(prev => ({ ...prev, psl_enabled: !prev.psl_enabled }))}
                            className={cn("w-12 h-6 rounded-full relative transition-all duration-300", newAppSettings.psl_enabled ? "bg-cyan-500" : "bg-white/10")}
                          >
                            <motion.div animate={{ x: newAppSettings.psl_enabled ? 26 : 2 }} className="w-5 h-5 bg-white rounded-full absolute top-0.5" />
                          </button>
                        </div>
                        <input 
                          type="text" 
                          value={newAppSettings.psl_title || ''}
                          onChange={(e) => setNewAppSettings(prev => ({ ...prev, psl_title: e.target.value }))}
                          placeholder="Category Title"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                      {/* IPL Toggle */}
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest">IPL Settings</h4>
                          <button 
                            onClick={() => setNewAppSettings(prev => ({ ...prev, ipl_enabled: !prev.ipl_enabled }))}
                            className={cn("w-12 h-6 rounded-full relative transition-all duration-300", newAppSettings.ipl_enabled ? "bg-blue-500" : "bg-white/10")}
                          >
                            <motion.div animate={{ x: newAppSettings.ipl_enabled ? 26 : 2 }} className="w-5 h-5 bg-white rounded-full absolute top-0.5" />
                          </button>
                        </div>
                        <input 
                          type="text" 
                          value={newAppSettings.ipl_title || ''}
                          onChange={(e) => setNewAppSettings(prev => ({ ...prev, ipl_title: e.target.value }))}
                          placeholder="Category Title"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500/50"
                        />
                      </div>
                      {/* Free Movies Toggle */}
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest">Free Movies</h4>
                          <button 
                            onClick={() => setNewAppSettings(prev => ({ ...prev, free_movies_enabled: !prev.free_movies_enabled }))}
                            className={cn("w-12 h-6 rounded-full relative transition-all duration-300", newAppSettings.free_movies_enabled ? "bg-indigo-500" : "bg-white/10")}
                          >
                            <motion.div animate={{ x: newAppSettings.free_movies_enabled ? 26 : 2 }} className="w-5 h-5 bg-white rounded-full absolute top-0.5" />
                          </button>
                        </div>
                        <input 
                          type="text" 
                          value={newAppSettings.free_movies_title || ''}
                          onChange={(e) => setNewAppSettings(prev => ({ ...prev, free_movies_title: e.target.value }))}
                          placeholder="Category Title"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500/50"
                        />
                      </div>
                      {/* Free Series Toggle */}
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-purple-400 uppercase tracking-widest">Free Series</h4>
                          <button 
                            onClick={() => setNewAppSettings(prev => ({ ...prev, free_series_enabled: !prev.free_series_enabled }))}
                            className={cn("w-12 h-6 rounded-full relative transition-all duration-300", newAppSettings.free_series_enabled ? "bg-purple-500" : "bg-white/10")}
                          >
                            <motion.div animate={{ x: newAppSettings.free_series_enabled ? 26 : 2 }} className="w-5 h-5 bg-white rounded-full absolute top-0.5" />
                          </button>
                        </div>
                        <input 
                          type="text" 
                          value={newAppSettings.free_series_title || ''}
                          onChange={(e) => setNewAppSettings(prev => ({ ...prev, free_series_title: e.target.value }))}
                          placeholder="Category Title"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/50"
                        />
                      </div>
                      {/* Live Events Toggle */}
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-rose-400 uppercase tracking-widest">Live Events</h4>
                          <button 
                            onClick={() => setNewAppSettings(prev => ({ ...prev, live_events_enabled: !prev.live_events_enabled }))}
                            className={cn("w-12 h-6 rounded-full relative transition-all duration-300", newAppSettings.live_events_enabled ? "bg-rose-500" : "bg-white/10")}
                          >
                            <motion.div animate={{ x: newAppSettings.live_events_enabled ? 26 : 2 }} className="w-5 h-5 bg-white rounded-full absolute top-0.5" />
                          </button>
                        </div>
                        <input 
                          type="text" 
                          value={newAppSettings.live_events_title || ''}
                          onChange={(e) => setNewAppSettings(prev => ({ ...prev, live_events_title: e.target.value }))}
                          placeholder="Category Title"
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-rose-500/50"
                        />
                      </div>
                      {/* Popup & Redirect Shield Toggle */}
                      <div className="p-4 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent rounded-2xl border border-emerald-500/20 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                            <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest">Popup & Ads Shield</h4>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setNewAppSettings(prev => ({ ...prev, anti_popup_enabled: !prev.anti_popup_enabled }))}
                            className={cn("w-12 h-6 rounded-full relative transition-all duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]", newAppSettings.anti_popup_enabled !== false ? "bg-emerald-500" : "bg-white/10")}
                          >
                            <motion.div animate={{ x: newAppSettings.anti_popup_enabled !== false ? 26 : 2 }} className="w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-md" />
                          </button>
                        </div>
                        <p className="text-[10px] text-white/50 font-medium leading-relaxed">
                          Blocks iframe-based players from opening popups, redirecting this page, or opening new windows. Note: If a stream fails to load, try disabling this.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                  {activeAdminTab === 'psl' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">PSL Urdu Stream URL</label>
                          <input 
                            type="text" 
                            value={newPslUrlUrdu}
                            onChange={(e) => setNewPslUrlUrdu(e.target.value)}
                            placeholder="Enter .m3u8 URL"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">PSL English Stream URL</label>
                          <input 
                            type="text" 
                            value={newPslUrlEnglish}
                            onChange={(e) => setNewPslUrlEnglish(e.target.value)}
                            placeholder="Enter .m3u8 URL"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-3xl space-y-4">
                        <div className="flex items-center justify-between px-1">
                          <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Custom Channel 3</h4>
                          <span className="text-[8px] text-white/20 uppercase font-bold tracking-widest italic font-mono">Premium Expansion</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Channel Name</label>
                            <input 
                              type="text" 
                              value={newPslChannel3Name}
                              onChange={(e) => setNewPslChannel3Name(e.target.value)}
                              placeholder="e.g. Hindi, PTV Sports, etc."
                              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500/50"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Stream URL</label>
                            <input 
                              type="text" 
                              value={newPslChannel3Url}
                              onChange={(e) => setNewPslChannel3Url(e.target.value)}
                              placeholder="URL or Embed Code"
                              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500/50"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
                            <input 
                              type="checkbox" 
                              id="psl_3_embed"
                              checked={newPslChannel3IsEmbed}
                              onChange={(e) => setNewPslChannel3IsEmbed(e.target.checked)}
                              className="w-4 h-4 accent-purple-500"
                            />
                            <label htmlFor="psl_3_embed" className="text-[10px] text-white/60 font-black uppercase tracking-widest cursor-pointer">Embed Mode</label>
                          </div>
                          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
                            <input 
                              type="checkbox" 
                              id="psl_3_live_icon"
                              checked={newPslChannel3ShowLiveIcon}
                              onChange={(e) => setNewPslChannel3ShowLiveIcon(e.target.checked)}
                              className="w-4 h-4 accent-purple-500"
                            />
                            <label htmlFor="psl_3_live_icon" className="text-[10px] text-white/60 font-black uppercase tracking-widest cursor-pointer">Show Live Icon</label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {activeAdminTab === 'ipl' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">IPL Stream URL</label>
                      <input 
                        type="text" 
                        value={newIplUrl}
                        onChange={(e) => setNewIplUrl(e.target.value)}
                        placeholder="Enter .m3u8 URL"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                  )}

                  {(activeAdminTab === 'free_movies' || activeAdminTab === 'free_series') && (
                    <div className="space-y-6">
                      {/* TMDB Autocomplete Field */}
                      <div className="bg-cyan-500/[0.03] border border-cyan-500/20 rounded-3xl p-5 space-y-3 shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
                        <div className="flex items-center gap-2 px-1">
                          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                          <label className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                            TMDB ID Autocomplete
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={activeAdminTab === 'free_movies' ? (newFreeMovie.tmdb_id || '') : (newFreeSeries.tmdb_id || '')}
                            onChange={(e) => activeAdminTab === 'free_movies' 
                              ? setNewFreeMovie({...newFreeMovie, tmdb_id: e.target.value}) 
                              : setNewFreeSeries({...newFreeSeries, tmdb_id: e.target.value})
                            }
                            placeholder="Enter TMDB ID (e.g. 550 for Fight Club, 1396 for Breaking Bad)"
                            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 placeholder-white/30 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                          />
                          <button
                            type="button"
                            onClick={handleFetchFreeItemTmdbDetails}
                            disabled={isFetchingTmdb}
                            className="px-5 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-zinc-800 text-black disabled:text-white/40 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/10 hover:shadow-cyan-400/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            {isFetchingTmdb ? (
                              <>
                                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                Loading...
                              </>
                            ) : (
                              'Fetch Details'
                            )}
                          </button>
                        </div>
                        <p className="text-[9px] text-white/30 italic px-1 leading-normal">
                          If you enter TMDB ID, the title and poster image will load instantly, so you do not have to write them manually.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Title</label>
                          <input 
                            type="text" 
                            value={activeAdminTab === 'free_movies' ? newFreeMovie.name : newFreeSeries.name}
                            onChange={(e) => activeAdminTab === 'free_movies' 
                              ? setNewFreeMovie({...newFreeMovie, name: e.target.value}) 
                              : setNewFreeSeries({...newFreeSeries, name: e.target.value})
                            }
                            placeholder="Display Name"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Poster URL</label>
                          <input 
                            type="text" 
                            value={activeAdminTab === 'free_movies' ? newFreeMovie.poster_url : newFreeSeries.poster_url}
                            onChange={(e) => activeAdminTab === 'free_movies' 
                              ? setNewFreeMovie({...newFreeMovie, poster_url: e.target.value}) 
                              : setNewFreeSeries({...newFreeSeries, poster_url: e.target.value})
                            }
                            placeholder="Image URL"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Streaming Link</label>
                        <input 
                          type="text" 
                          value={activeAdminTab === 'free_movies' ? newFreeMovie.play_url : newFreeSeries.play_url}
                          onChange={(e) => activeAdminTab === 'free_movies' 
                            ? setNewFreeMovie({...newFreeMovie, play_url: e.target.value}) 
                            : setNewFreeSeries({...newFreeSeries, play_url: e.target.value})
                          }
                          placeholder="Source Link"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>

                      {activeAdminTab === 'free_series' && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Playlist M3U URL (Optional)</label>
                          <input 
                            type="text" 
                            value={newFreeSeries.playlist_url || ''}
                            onChange={(e) => setNewFreeSeries({...newFreeSeries, playlist_url: e.target.value})}
                            placeholder="e.g. https://sjstorehot-lbskip.hf.space/series_links/spider/playlist.m3u"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Password Lock / Pin (Optional)</label>
                          <input 
                            type="text" 
                            value={activeAdminTab === 'free_movies' ? (newFreeMovie.password || '') : (newFreeSeries.password || '')}
                            onChange={(e) => activeAdminTab === 'free_movies' 
                              ? setNewFreeMovie({...newFreeMovie, password: e.target.value}) 
                              : setNewFreeSeries({...newFreeSeries, password: e.target.value})
                            }
                            placeholder="Leave empty for no password lock"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Download Link (Optional)</label>
                          <input 
                            type="text" 
                            value={activeAdminTab === 'free_movies' ? newFreeMovie.download_url : newFreeSeries.download_url}
                            onChange={(e) => activeAdminTab === 'free_movies' 
                              ? setNewFreeMovie({...newFreeMovie, download_url: e.target.value}) 
                              : setNewFreeSeries({...newFreeSeries, download_url: e.target.value})
                            }
                            placeholder="Optional Play/File Link"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 w-fit">
                        <input 
                          type="checkbox" 
                          id="is_embed_admin"
                          checked={activeAdminTab === 'free_movies' ? newFreeMovie.is_embed : newFreeSeries.is_embed}
                          onChange={(e) => activeAdminTab === 'free_movies' 
                            ? setNewFreeMovie({...newFreeMovie, is_embed: e.target.checked}) 
                            : setNewFreeSeries({...newFreeSeries, is_embed: e.target.checked})
                          }
                          className="w-4 h-4 accent-cyan-500"
                        />
                        <label htmlFor="is_embed_admin" className="text-[10px] text-white/60 font-black uppercase tracking-widest cursor-pointer select-none">Embed Mode</label>
                      </div>

                      {activeAdminTab === 'free_series' && (
                        <div className="border border-white/5 bg-white/[0.02] rounded-3xl p-6 space-y-5">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-widest">
                              Manually Managed / Weekly Episodes Panel
                            </h4>
                            <p className="text-[10px] text-white/40 mt-1 leading-normal">
                              Use this to input manual episodes week-by-week. If a series gets episodes every Monday, add them here. Leave the central "Playlist M3U URL" empty.
                            </p>
                          </div>

                          {newFreeSeries.playlist_url && newFreeSeries.playlist_url.trim() !== '' ? (
                            <div className="bg-purple-950/20 border border-purple-500/20 rounded-2xl p-5 text-center space-y-2">
                              <span className="text-xs font-black text-purple-400 uppercase tracking-widest block">
                                ℹ️ Manual Episodes Panel Disabled
                              </span>
                              <p className="text-[10px] text-white/50 leading-relaxed max-w-md mx-auto">
                                Since you have entered a <strong>Playlist M3U URL</strong> above, the system will load and parse episodes directly from your M3U link automatically. Single/Manual Episode entry is hidden to avoid conflicts.
                              </p>
                            </div>
                          ) : (
                            <>
                              {/* Existing Episodes List */}
                              {newFreeSeries.episodes && newFreeSeries.episodes.length > 0 && (
                                <div className="space-y-2">
                                  <label className="text-[9px] font-bold text-white/30 uppercase tracking-wider px-1">Added Episodes List ({newFreeSeries.episodes.length})</label>
                                  <div className="max-h-[220px] overflow-y-auto pr-2 no-scrollbar space-y-1.5">
                                    {newFreeSeries.episodes.map((ep, index) => (
                                      <div key={ep.id || index} className="flex items-center justify-between bg-white/5 border border-white/10 px-4 py-3 rounded-xl gap-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className="text-[10px] bg-cyan-500/10 text-cyan-400 font-bold px-2 py-1 rounded shrink-0">
                                            S{ep.season} E{ep.episode_num}
                                          </div>
                                          <div className="flex flex-col min-w-0">
                                            <span className="text-[11px] text-white font-bold truncate">{ep.title}</span>
                                            <span className="text-[9px] text-white/30 truncate">{ep.play_url}</span>
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveManualEpisode(ep.id)}
                                          className="p-1.5 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors cursor-pointer shrink-0"
                                          title="Remove Episode"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Add New Episode Inputs Row */}
                              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4">
                                <h5 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                                  <span>➕ Add New Episode</span>
                                </h5>

                                <div className="grid grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest px-1">Season</label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={manualEpisodeInput.season}
                                      onChange={(e) => setManualEpisodeInput({ ...manualEpisodeInput, season: e.target.value })}
                                      placeholder="Season"
                                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest px-1">Episode #</label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={manualEpisodeInput.episode_num}
                                      onChange={(e) => setManualEpisodeInput({ ...manualEpisodeInput, episode_num: e.target.value })}
                                      placeholder="Episode"
                                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest px-1">Title (Optional)</label>
                                    <input
                                      type="text"
                                      value={manualEpisodeInput.title}
                                      onChange={(e) => setManualEpisodeInput({ ...manualEpisodeInput, title: e.target.value })}
                                      placeholder={`Episode ${manualEpisodeInput.episode_num}`}
                                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest px-1">Stream / Play URL</label>
                                  <input
                                    type="text"
                                    value={manualEpisodeInput.play_url}
                                    onChange={(e) => setManualEpisodeInput({ ...manualEpisodeInput, play_url: e.target.value })}
                                    placeholder="Enter episode .m3u8 or .mp4 link"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest px-1">Download URL (Optional)</label>
                                  <input
                                    type="text"
                                    value={manualEpisodeInput.download_url}
                                    onChange={(e) => setManualEpisodeInput({ ...manualEpisodeInput, download_url: e.target.value })}
                                    placeholder="Enter episode direct file download link"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={handleAddManualEpisode}
                                  className="w-full py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-cyan-500/20 active:scale-[0.98] cursor-pointer"
                                >
                                  Add Episode to List
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      <button 
                        onClick={activeAdminTab === 'free_movies' ? handleAddFreeMovie : handleAddFreeSeries}
                        className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl ${
                          (activeAdminTab === 'free_movies' ? editingMovieId : editingSeriesId)
                            ? 'bg-yellow-500 text-black shadow-yellow-500/20' 
                            : 'bg-cyan-500 text-black shadow-cyan-500/20'
                        }`}
                      >
                        {(activeAdminTab === 'free_movies' ? editingMovieId : editingSeriesId) ? 'Update Entry' : 'Publish to Hub'}
                      </button>

                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Recent Management</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {(activeAdminTab === 'free_movies' ? freeMovies : freeSeries).map((item, idx) => (
                            <div key={`admin-v2-${item.id}-${idx}`} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10 group">
                              <div className="flex flex-col gap-0.5 max-w-[140px]">
                                <span className="text-[11px] text-white font-bold truncate">{item.name}</span>
                                <span className="text-[8px] text-white/30 uppercase tracking-widest font-black">Online Now</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => {
                                    if (activeAdminTab === 'free_movies') {
                                      setEditingMovieId(item.id);
                                      setNewFreeMovie({
                                        tmdb_id: item.tmdb_id || '',
                                        name: item.name || '',
                                        poster_url: item.poster_url || '',
                                        play_url: item.play_url || '',
                                        download_url: item.download_url || '',
                                        is_embed: !!item.is_embed,
                                        password: item.password || ''
                                      });
                                    } else {
                                      setEditingSeriesId(item.id);
                                      setNewFreeSeries({
                                        tmdb_id: item.tmdb_id || '',
                                        name: item.name || '',
                                        poster_url: item.poster_url || '',
                                        play_url: item.play_url || '',
                                        download_url: item.download_url || '',
                                        playlist_url: item.playlist_url || '',
                                        is_embed: !!item.is_embed,
                                        password: item.password || '',
                                        episodes: item.episodes || []
                                      });
                                    }
                                  }}
                                  className="w-8 h-8 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 flex items-center justify-center transition-all"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button 
                                  onClick={() => activeAdminTab === 'free_movies' ? handleDeleteFreeMovie(item.id) : handleDeleteFreeSeries(item.id)}
                                  className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-all"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeAdminTab === 'live_events' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Event Name</label>
                          <input 
                            type="text" 
                            value={newLiveEvent.name}
                            onChange={(e) => setNewLiveEvent({...newLiveEvent, name: e.target.value})}
                            placeholder="e.g. Pakistan vs Australia - 1st ODI"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Poster Image URL</label>
                          <input 
                            type="text" 
                            value={newLiveEvent.poster_url}
                            onChange={(e) => setNewLiveEvent({...newLiveEvent, poster_url: e.target.value})}
                            placeholder="e.g. Poster Image Link"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                      </div>

                      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                          <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Streams & Channels</h4>
                          <button
                            type="button"
                            onClick={() => {
                              setNewLiveEvent({
                                ...newLiveEvent,
                                channels: [...newLiveEvent.channels, { name: `Channel ${newLiveEvent.channels.length + 1}`, play_url: '', is_embed: false, is_mpd: false }]
                              });
                            }}
                            className="px-3 py-1.5 rounded-xl bg-cyan-500 text-black font-black text-[9px] uppercase tracking-wider hover:bg-cyan-400 transition-all cursor-pointer"
                          >
                            + Add Channel
                          </button>
                        </div>

                        <div className="space-y-3">
                          {newLiveEvent.channels.map((channel, cIdx) => (
                            <div key={`chan-edit-${cIdx}`} className="flex flex-col bg-black/40 p-4 rounded-xl border border-white/5 space-y-3">
                              <div className="flex flex-col md:flex-row gap-3 items-end md:items-center">
                                <div className="w-full md:w-1/4 space-y-1">
                                  <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Channel Name</label>
                                  <input 
                                    type="text" 
                                    value={channel.name}
                                    onChange={(e) => {
                                      const updatedCh = [...newLiveEvent.channels];
                                      updatedCh[cIdx].name = e.target.value;
                                      setNewLiveEvent({ ...newLiveEvent, channels: updatedCh });
                                    }}
                                    placeholder="e.g. English, Urdu"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                                  />
                                </div>

                                <div className="w-full md:flex-1 space-y-1">
                                  {channel.is_mpd ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest">MPD Manifest URL</label>
                                        <input 
                                          type="text" 
                                          value={parseKeysFromUrl(channel.play_url).base}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            const parsed = parseKeysFromUrl(val);
                                            const updatedCh = [...newLiveEvent.channels];
                                            if (parsed.keys) {
                                              updatedCh[cIdx].play_url = val;
                                            } else {
                                              const keys = parseKeysFromUrl(channel.play_url).keys;
                                              updatedCh[cIdx].play_url = buildUrlWithKeys(val, keys);
                                            }
                                            setNewLiveEvent({ ...newLiveEvent, channels: updatedCh });
                                          }}
                                          placeholder="e.g. .mpd manifest link"
                                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest">ClearKey (kid:key)</label>
                                        <input 
                                          type="text" 
                                          value={parseKeysFromUrl(channel.play_url).keys}
                                          onChange={(e) => {
                                            const keysVal = e.target.value;
                                            const base = parseKeysFromUrl(channel.play_url).base;
                                            const updatedCh = [...newLiveEvent.channels];
                                            updatedCh[cIdx].play_url = buildUrlWithKeys(base, keysVal);
                                            setNewLiveEvent({ ...newLiveEvent, channels: updatedCh });
                                          }}
                                          placeholder="e.g. kid:key (Paste Separately)"
                                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-mono placeholder:text-white/20"
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Stream / Play Link</label>
                                      <input 
                                        type="text" 
                                        value={channel.play_url}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const parsed = parseKeysFromUrl(val);
                                          const updatedCh = [...newLiveEvent.channels];
                                          if (parsed.keys || val.toLowerCase().includes('.mpd')) {
                                            updatedCh[cIdx].play_url = val;
                                            updatedCh[cIdx].is_mpd = true;
                                            updatedCh[cIdx].is_embed = false;
                                          } else {
                                            updatedCh[cIdx].play_url = val;
                                          }
                                          setNewLiveEvent({ ...newLiveEvent, channels: updatedCh });
                                        }}
                                        placeholder="e.g. m3u8 link, .mpd link, or embed stream"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                                      />
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2 h-[38px]">
                                  <input 
                                    type="checkbox" 
                                    id={`is_embed-${cIdx}`}
                                    checked={!!channel.is_embed}
                                    onChange={(e) => {
                                      const updatedCh = [...newLiveEvent.channels];
                                      updatedCh[cIdx].is_embed = e.target.checked;
                                      if (e.target.checked) {
                                        updatedCh[cIdx].is_mpd = false;
                                        updatedCh[cIdx].is_webpage = false;
                                      }
                                      setNewLiveEvent({ ...newLiveEvent, channels: updatedCh });
                                    }}
                                    className="w-4 h-4 accent-cyan-500"
                                  />
                                  <label htmlFor={`is_embed-${cIdx}`} className="text-[9px] text-white/60 font-black uppercase tracking-widest cursor-pointer select-none">Embed</label>
                                </div>

                                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2 h-[38px]">
                                  <input 
                                    type="checkbox" 
                                    id={`is_mpd-${cIdx}`}
                                    checked={!!channel.is_mpd}
                                    onChange={(e) => {
                                      const updatedCh = [...newLiveEvent.channels];
                                      updatedCh[cIdx].is_mpd = e.target.checked;
                                      if (e.target.checked) {
                                        updatedCh[cIdx].is_embed = false;
                                        updatedCh[cIdx].is_webpage = false;
                                      }
                                      setNewLiveEvent({ ...newLiveEvent, channels: updatedCh });
                                    }}
                                    className="w-4 h-4 accent-cyan-500"
                                  />
                                  <label htmlFor={`is_mpd-${cIdx}`} className="text-[9px] text-white/60 font-black uppercase tracking-widest cursor-pointer select-none">MPD</label>
                                </div>

                                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2 h-[38px]">
                                  <input 
                                    type="checkbox" 
                                    id={`is_webpage-${cIdx}`}
                                    checked={!!channel.is_webpage}
                                    onChange={(e) => {
                                      const updatedCh = [...newLiveEvent.channels];
                                      updatedCh[cIdx].is_webpage = e.target.checked;
                                      if (e.target.checked) {
                                        updatedCh[cIdx].is_embed = false;
                                        updatedCh[cIdx].is_mpd = false;
                                      }
                                      setNewLiveEvent({ ...newLiveEvent, channels: updatedCh });
                                    }}
                                    className="w-4 h-4 accent-cyan-500"
                                  />
                                  <label htmlFor={`is_webpage-${cIdx}`} className="text-[9px] text-white/60 font-black uppercase tracking-widest cursor-pointer select-none">Webpage</label>
                                </div>

                                {(channel.is_embed || channel.is_webpage) && (
                                  <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2 h-[38px]">
                                    <input 
                                      type="checkbox" 
                                      id={`sandbox_disabled-${cIdx}`}
                                      checked={!!channel.sandbox_disabled}
                                      onChange={(e) => {
                                        const updatedCh = [...newLiveEvent.channels];
                                        updatedCh[cIdx].sandbox_disabled = e.target.checked;
                                        setNewLiveEvent({ ...newLiveEvent, channels: updatedCh });
                                      }}
                                      className="w-4 h-4 accent-rose-500"
                                    />
                                    <label htmlFor={`sandbox_disabled-${cIdx}`} className="text-[9px] text-rose-400 font-black uppercase tracking-widest cursor-pointer select-none">Sandbox Off</label>
                                  </div>
                                )}

                                {newLiveEvent.channels.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedCh = newLiveEvent.channels.filter((_, i) => i !== cIdx);
                                      setNewLiveEvent({ ...newLiveEvent, channels: updatedCh });
                                    }}
                                    className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all cursor-pointer h-[38px] w-[38px]"
                                  >
                                    <X size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button 
                        onClick={handleAddLiveEvent}
                        className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl ${
                          editingLiveEventId
                            ? 'bg-yellow-500 text-black shadow-yellow-500/20' 
                            : 'bg-cyan-500 text-black shadow-cyan-500/20'
                        }`}
                      >
                        {editingLiveEventId ? 'Update Live Event' : 'Launch Live Event'}
                      </button>

                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Manage Live Events</label>
                        {isLiveEventsLoading ? (
                          <div className="flex justify-center p-6 text-white/40 text-xs">
                            <Loader2 className="animate-spin text-cyan-400 mr-2" size={16} /> Loading Events...
                          </div>
                        ) : liveEvents.length === 0 ? (
                          <div className="text-center p-6 text-white/30 text-xs font-bold border border-dashed border-white/10 rounded-2xl">
                            No Live Events Configured
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {liveEvents.map((item, idx) => (
                              <div key={`admin-live-${item.id}-${idx}`} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10 group">
                                <div className="flex flex-col gap-0.5 max-w-[140px]">
                                  <span className="text-[11px] text-white font-bold truncate">{item.name}</span>
                                  <span className="text-[8px] text-[#FF4C5E] uppercase tracking-widest font-black">
                                    {item.channels?.length || 0} Channels Active
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => {
                                      setEditingLiveEventId(item.id);
                                      setNewLiveEvent({
                                        name: item.name || '',
                                        poster_url: item.poster_url || '',
                                        channels: item.channels && item.channels.length > 0 
                                          ? item.channels.map((ch: any) => ({
                                              name: ch.name || '',
                                              play_url: ch.play_url || '',
                                              is_embed: !!ch.is_embed,
                                              is_mpd: !!ch.is_mpd,
                                              is_webpage: !!ch.is_webpage,
                                              sandbox_disabled: !!ch.sandbox_disabled
                                            }))
                                          : [{ name: 'Urdu', play_url: '', is_embed: false, is_mpd: false, is_webpage: false, sandbox_disabled: false }]
                                      });
                                    }}
                                    className="w-8 h-8 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 flex items-center justify-center transition-all"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteLiveEvent(item.id)}
                                    className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-all"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeAdminTab === 'fifa' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest border-b border-white/10 pb-2">
                          {editingFifaChannelId ? '✏️ Edit FIFA Channel' : '➕ Add New FIFA Channel'}
                        </h4>

                        {/* Feed Type Selection Tab Buttons */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Feed Type Selection</label>
                          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 max-w-sm">
                            <button
                              type="button"
                              onClick={() => setNewFifaChannel({ ...newFifaChannel, feed_type: 'iptv' })}
                              className={`flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                                newFifaChannel.feed_type === 'iptv'
                                  ? 'bg-emerald-500 text-black shadow-md'
                                  : 'text-white/40 hover:text-white/80'
                              }`}
                            >
                              🌟 Premium IPTV ID
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewFifaChannel({ ...newFifaChannel, feed_type: 'custom' })}
                              className={`flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                                newFifaChannel.feed_type === 'custom'
                                  ? 'bg-emerald-500 text-black shadow-md'
                                  : 'text-white/40 hover:text-white/80'
                              }`}
                            >
                              🔗 Custom play URL
                            </button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Channel Name</label>
                            <input 
                              type="text" 
                              value={newFifaChannel.name}
                              onChange={(e) => setNewFifaChannel({...newFifaChannel, name: e.target.value})}
                              placeholder="e.g. FIFA TV UHD - English"
                              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Channel No. (e.g. 1, 2, 3)</label>
                            <input 
                              type="number" 
                              value={newFifaChannel.order}
                              onChange={(e) => setNewFifaChannel({...newFifaChannel, order: e.target.value})}
                              placeholder="e.g. 1 (Top), 2, 3..."
                              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Channel Status</label>
                            <select 
                              value={newFifaChannel.status}
                              onChange={(e) => setNewFifaChannel({...newFifaChannel, status: e.target.value})}
                              className="w-full bg-[#141416] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                            >
                              <option value="Live">🟢 Live Now</option>
                              <option value="Offline">🔴 Offline</option>
                            </select>
                          </div>
                        </div>

                        {/* Access Requirement Selection */}
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Access Type (Eligibility check on play)</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                            <button
                              type="button"
                              onClick={() => setNewFifaChannel({ ...newFifaChannel, is_premium: false })}
                              disabled={newFifaChannel.feed_type === 'iptv'}
                              className={`py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 ${
                                !newFifaChannel.is_premium && newFifaChannel.feed_type !== 'iptv'
                                  ? 'bg-emerald-500 text-black border-emerald-500 shadow-md'
                                  : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white/80 disabled:opacity-20 disabled:pointer-events-none'
                              }`}
                            >
                              🔓 Free for Everyone (No login needed)
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewFifaChannel({ ...newFifaChannel, is_premium: true })}
                              className={`py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 ${
                                newFifaChannel.is_premium || newFifaChannel.feed_type === 'iptv'
                                  ? 'bg-rose-500 text-white border-rose-500 shadow-md'
                                  : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white/80'
                              }`}
                            >
                              🔒 Premium Only (Requires Subscription Login)
                            </button>
                          </div>
                          {newFifaChannel.feed_type === 'iptv' && (
                            <p className="text-[9px] text-[#FF4C5E] mt-1 font-bold">
                              ⚠️ IPTV ID channels utilize subscription streams and are forced to "Premium Only".
                            </p>
                          )}
                        </div>

                        {newFifaChannel.feed_type === 'iptv' ? (
                          <div className="space-y-2 animate-in fade-in duration-200">
                            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">IPTV Channel Stream ID</label>
                            <input 
                              type="text" 
                              value={newFifaChannel.stream_id}
                              onChange={(e) => setNewFifaChannel({ ...newFifaChannel, stream_id: e.target.value })}
                              placeholder="e.g. 1588 or 1452 (User credentials username/password injected live on play)"
                              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-emerald-300 placeholder-emerald-800/60 focus:outline-none focus:border-emerald-500/50 font-mono"
                            />
                            <p className="text-[9px] text-[#FF4C5E] mt-1 font-bold">
                              💡 Live TV subscriber credentials (username & password) will be automatically injected into the stream URL when user plays it.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4 animate-in fade-in duration-200">
                            {newFifaChannel.is_mpd ? (
                              <>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">MPD Manifest URL (Base Link)</label>
                                  <input 
                                    type="text" 
                                    value={parseKeysFromUrl(newFifaChannel.play_url).base}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const parsed = parseKeysFromUrl(val);
                                      if (parsed.keys) {
                                        setNewFifaChannel({
                                          ...newFifaChannel,
                                          play_url: val,
                                          is_mpd: true,
                                          is_embed: false
                                        });
                                      } else {
                                        const currentKeys = parseKeysFromUrl(newFifaChannel.play_url).keys;
                                        setNewFifaChannel({
                                          ...newFifaChannel,
                                          play_url: buildUrlWithKeys(val, currentKeys),
                                          is_mpd: true,
                                          is_embed: false
                                        });
                                      }
                                    }}
                                    placeholder="e.g. https://server.com/manifest.mpd"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">DRM ClearKey Keys (Paste Separately)</label>
                                    <span className="text-[9px] text-cyan-400/80 font-mono">Format: kid:key</span>
                                  </div>
                                  <input 
                                    type="text" 
                                    value={parseKeysFromUrl(newFifaChannel.play_url).keys}
                                    onChange={(e) => {
                                      const keysVal = e.target.value;
                                      const base = parseKeysFromUrl(newFifaChannel.play_url).base;
                                      setNewFifaChannel({
                                        ...newFifaChannel,
                                        play_url: buildUrlWithKeys(base, keysVal),
                                        is_mpd: true,
                                        is_embed: false
                                      });
                                    }}
                                    placeholder="e.g. ab12cd34ef567890ab12cd34ef567890:1234567890abcdef1234567890abcdef"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 font-mono placeholder:text-white/20"
                                  />
                                </div>
                              </>
                            ) : (
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Custom Stream Link / Embed URL</label>
                                <input 
                                  type="text" 
                                  value={newFifaChannel.play_url}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const parsed = parseKeysFromUrl(val);
                                    if (parsed.keys || val.toLowerCase().includes('.mpd')) {
                                      setNewFifaChannel({
                                        ...newFifaChannel, 
                                        play_url: val,
                                        is_mpd: true,
                                        is_embed: false
                                      });
                                    } else {
                                      setNewFifaChannel({
                                        ...newFifaChannel, 
                                        play_url: val,
                                        is_embed: val.toLowerCase().includes('iframe') || !val.toLowerCase().includes('.m3u8') && !val.toLowerCase().includes('.ts')
                                      });
                                    }
                                  }}
                                  placeholder="e.g. http://server.com/live.m3u8 or iframe embed URL"
                                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                                />
                              </div>
                            )}

                            <div className="flex flex-wrap gap-4 pt-1">
                              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
                                <input 
                                  type="checkbox" 
                                  id="is_mpd_fifa"
                                  checked={newFifaChannel.is_mpd}
                                  onChange={(e) => {
                                    setNewFifaChannel({
                                      ...newFifaChannel, 
                                      is_mpd: e.target.checked,
                                      is_embed: e.target.checked ? false : newFifaChannel.is_embed,
                                      is_webpage: e.target.checked ? false : newFifaChannel.is_webpage
                                    });
                                  }}
                                  className="w-4 h-4 accent-cyan-500"
                                />
                                <label htmlFor="is_mpd_fifa" className="text-[10px] text-white/60 font-black uppercase tracking-widest cursor-pointer select-none">MPD (DASH)</label>
                              </div>

                              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
                                <input 
                                  type="checkbox" 
                                  id="is_embed_fifa"
                                  checked={newFifaChannel.is_embed}
                                  onChange={(e) => {
                                    setNewFifaChannel({
                                      ...newFifaChannel, 
                                      is_embed: e.target.checked,
                                      is_mpd: e.target.checked ? false : newFifaChannel.is_mpd,
                                      is_webpage: e.target.checked ? false : newFifaChannel.is_webpage
                                    });
                                  }}
                                  className="w-4 h-4 accent-cyan-500"
                                />
                                <label htmlFor="is_embed_fifa" className="text-[10px] text-white/60 font-black uppercase tracking-widest cursor-pointer select-none">Embed Mode</label>
                              </div>

                              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-5 py-3">
                                <input 
                                  type="checkbox" 
                                  id="is_webpage_fifa"
                                  checked={newFifaChannel.is_webpage}
                                  onChange={(e) => {
                                    setNewFifaChannel({
                                      ...newFifaChannel, 
                                      is_webpage: e.target.checked,
                                      is_embed: e.target.checked ? false : newFifaChannel.is_embed,
                                      is_mpd: e.target.checked ? false : newFifaChannel.is_mpd
                                    });
                                  }}
                                  className="w-4 h-4 accent-cyan-500"
                                />
                                <label htmlFor="is_webpage_fifa" className="text-[10px] text-white/60 font-black uppercase tracking-widest cursor-pointer select-none">Website Page</label>
                              </div>

                              {(newFifaChannel.is_embed || newFifaChannel.is_webpage) && (
                                <div className="flex items-center gap-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl px-5 py-3">
                                  <input 
                                    type="checkbox" 
                                    id="sandbox_disabled_fifa"
                                    checked={!!newFifaChannel.sandbox_disabled}
                                    onChange={(e) => {
                                      setNewFifaChannel({
                                        ...newFifaChannel, 
                                        sandbox_disabled: e.target.checked
                                      });
                                    }}
                                    className="w-4 h-4 accent-rose-500"
                                  />
                                  <label htmlFor="sandbox_disabled_fifa" className="text-[10px] text-rose-400 font-black uppercase tracking-widest cursor-pointer select-none">Disable Sandbox (Allow Popups/Redirects)</label>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <button 
                          onClick={handleAddFifaChannel}
                          className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl ${
                            editingFifaChannelId
                              ? 'bg-yellow-500 text-black shadow-yellow-500/25' 
                              : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-emerald-500/20'
                          }`}
                        >
                          {editingFifaChannelId ? 'Update Channel' : 'Add Channel to FIFA list'}
                        </button>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-1">Manage FIFA Channels</label>
                        {isFifaChannelsLoading ? (
                          <div className="flex justify-center p-6 text-white/40 text-xs">
                            <Loader2 className="animate-spin text-cyan-400 mr-2" size={16} /> Loading FIFA channels...
                          </div>
                        ) : fifaChannels.length === 0 ? (
                          <div className="text-center p-6 text-white/30 text-xs font-bold border border-dashed border-white/10 rounded-2xl">
                            No FIFA channels configured yet
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {fifaChannels.map((item, idx) => (
                              <div 
                                key={`admin-fifa-${item.id}-${idx}`}
                                draggable
                                onDragStart={(e) => handleFifaDragStart(e, idx)}
                                onDragOver={(e) => handleFifaDragOver(e, idx)}
                                onDragEnd={handleFifaDragEnd}
                                onDrop={(e) => handleFifaDrop(e, idx)}
                                className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 select-none ${
                                  draggedFifaIndex === idx 
                                    ? 'opacity-40 bg-zinc-950/50 border-dashed border-white/20 scale-[0.98]' 
                                    : draggedOverFifaIndex === idx
                                      ? 'border-cyan-500/50 bg-cyan-950/20 scale-[1.02] shadow-lg shadow-cyan-500/5'
                                      : 'bg-white/5 border-white/10 hover:border-white/25 hover:bg-white/10 hover:scale-[1.01]'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  {/* Drag Indicator Handle icon */}
                                  <div className="cursor-grab active:cursor-grabbing p-1 rounded-lg text-white/30 hover:text-white/70 transition-colors flex items-center justify-center">
                                    <GripVertical size={14} />
                                  </div>

                                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                    <span className="text-[11px] text-white font-bold truncate">
                                      {item.order !== undefined && item.order !== 999999 ? `${item.order}. ` : ''}{item.name}
                                    </span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                                        item.status === 'Offline' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400 animate-pulse'
                                      }`}>
                                        {item.status || 'Live'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                  <button 
                                    onClick={() => {
                                      setEditingFifaChannelId(item.id);
                                      setNewFifaChannel({
                                        name: item.name || '',
                                        play_url: item.play_url || '',
                                        is_mpd: !!item.is_mpd,
                                        is_embed: !!item.is_embed,
                                        is_webpage: !!item.is_webpage,
                                        sandbox_disabled: !!item.sandbox_disabled,
                                        status: item.status || 'Live',
                                        order: item.order !== undefined && item.order !== 999999 ? String(item.order) : '',
                                        stream_id: item.stream_id || '',
                                        feed_type: item.feed_type || (item.stream_id ? 'iptv' : 'custom'),
                                        is_premium: item.is_premium !== undefined ? !!item.is_premium : (item.feed_type === 'iptv' || !!item.stream_id)
                                      });
                                    }}
                                    className="w-8 h-8 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 flex items-center justify-center transition-all"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteFifaChannel(item.id)}
                                    className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-all"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeAdminTab === 'analytics' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      {/* Sub-Navigation */}
                      <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
                        <button
                          onClick={() => setAnalyticsSubTab('media')}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                            analyticsSubTab === 'media'
                              ? 'bg-cyan-500 text-cyan-400 shadow-sm'
                              : 'text-white/40 hover:text-white'
                          }`}
                        >
                          Media Playback Stats
                        </button>
                        <button
                          onClick={() => setAnalyticsSubTab('users')}
                          className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${
                            analyticsSubTab === 'users'
                              ? 'bg-cyan-500 text-black font-extrabold shadow-sm'
                              : 'text-white/40 hover:text-white'
                          }`}
                        >
                          User Account Logins
                        </button>
                      </div>

                      {/* Search Bar / Filter Area */}
                      <div className="space-y-3">
                        <div className="relative">
                          <input 
                            type="text"
                            placeholder={analyticsSubTab === 'media' ? "Search played items..." : "Search registered usernames..."}
                            value={analyticsSearchQuery}
                            onChange={(e) => setAnalyticsSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 placeholder-white/20 pl-8"
                          />
                          <span className="absolute left-3 top-3 text-white/20 text-xs">🔍</span>
                          {analyticsSearchQuery && (
                            <button 
                              onClick={() => setAnalyticsSearchQuery('')} 
                              className="absolute right-3 top-2.5 text-white/40 hover:text-white text-xs border-0 bg-transparent cursor-pointer"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {analyticsSubTab === 'media' && (
                          <div className="flex flex-wrap gap-1.5 overflow-x-auto no-scrollbar py-1">
                            {(['all', 'movie', 'series', 'live_event', 'fifa'] as const).map((cat) => (
                              <button
                                key={`filter-${cat}`}
                                onClick={() => setAnalyticsCategoryFilter(cat)}
                                className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border cursor-pointer whitespace-nowrap transition-colors ${
                                  analyticsCategoryFilter === cat
                                    ? 'bg-cyan-500 border-cyan-500 text-black font-extrabold'
                                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                                }`}
                              >
                                {cat === 'all' ? 'All Sections' : cat.replace('_', ' ')}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Display Data */}
                      {analyticsLoading && (userActivities.length === 0 && mediaStats.length === 0) ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                          <Loader2 className="animate-spin text-cyan-400" size={24} />
                          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Gathering real-time stats...</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {analyticsSubTab === 'media' ? (
                            (() => {
                              const filtered = mediaStats.filter((stat: any) => {
                                const matchQuery = !analyticsSearchQuery || 
                                  stat.itemName?.toLowerCase().includes(analyticsSearchQuery.toLowerCase()) ||
                                  stat.itemId?.toLowerCase().includes(analyticsSearchQuery.toLowerCase());
                                const matchCategory = analyticsCategoryFilter === 'all' || stat.category === analyticsCategoryFilter;
                                return matchQuery && matchCategory;
                              });

                              if (filtered.length === 0) {
                                return (
                                  <div className="text-center py-8 bg-white/5 border border-dashed border-white/10 rounded-2xl">
                                    <span className="text-xs text-white/30 font-medium">No playback records found matching query</span>
                                  </div>
                                );
                              }

                              return (
                                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 no-scrollbar pb-6">
                                  {filtered.map((stat: any, index) => {
                                    const viewers = stat.users ? Object.keys(stat.users) : [];
                                    const viewersCount = viewers.length;
                                    
                                    return (
                                      <div 
                                        key={`stat-${stat.itemId}-${index}`}
                                        className="p-3 bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-2 hover:bg-white/10 transition-colors"
                                      >
                                        <div className="flex items-start justify-between gap-4">
                                          <div className="min-w-0">
                                            <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 bg-cyan-950/40 border border-cyan-800/30 px-1.5 py-0.5 rounded-md mr-2">
                                              {stat.category === 'live_event' ? 'LIVE EVENT' : stat.category?.toUpperCase()}
                                            </span>
                                            <h4 className="text-xs font-black text-white italic tracking-tight uppercase inline md:block mt-1 leading-normal">
                                              {stat.itemName}
                                            </h4>
                                          </div>
                                          <div className="text-right shrink-0">
                                            <div className="text-cyan-400 text-sm font-black italic tracking-tighter shadow-sm">
                                              {stat.totalPlays || 0} <span className="text-[9px] font-black uppercase text-white/40">PLAYS</span>
                                            </div>
                                            <div className="text-[9px] font-medium text-white/30 mt-0.5">
                                              {viewersCount} unique watcher{viewersCount === 1 ? '' : 's'}
                                            </div>
                                          </div>
                                        </div>

                                        {viewers.length > 0 && (
                                          <div className="flex flex-col gap-1.5 pt-1.5 border-t border-white/5">
                                            <span className="text-[8px] font-black uppercase text-white/30 tracking-widest text-left block">Viewers (Account Usernames):</span>
                                            <div className="flex flex-wrap gap-1">
                                              {viewers.map((usr: string) => (
                                                <span 
                                                  key={`viewer-${usr}`}
                                                  className="text-[9px] font-bold text-white/70 bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg"
                                                >
                                                  {usr}
                                                </span>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        <div className="text-[9px] text-white/20 text-right uppercase tracking-wider pt-0.5">
                                          Last Played: {stat.lastPlayed ? new Date(stat.lastPlayed).toLocaleString() : 'Never'}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()
                          ) : (
                            (() => {
                              const filtered = userActivities.filter((act: any) => {
                                return !analyticsSearchQuery || act.username?.toLowerCase().includes(analyticsSearchQuery.toLowerCase());
                              });

                              if (filtered.length === 0) {
                                return (
                                  <div className="text-center py-8 bg-white/5 border border-dashed border-white/10 rounded-2xl">
                                    <span className="text-xs text-white/30 font-medium font-bold">No user login accounts found matching query</span>
                                  </div>
                                );
                              }

                              return (
                                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 no-scrollbar pb-6">
                                  {filtered.map((act: any, index) => (
                                    <div 
                                      key={`user-${act.username}-${index}`}
                                      className="p-3 bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-2 hover:bg-white/10 transition-colors"
                                    >
                                      <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-black text-xs flex items-center justify-center uppercase shadow-inner">
                                            {act.username ? act.username.slice(0, 2) : 'U'}
                                          </div>
                                          <div className="flex flex-col">
                                            <span className="text-xs font-black text-white italic tracking-tight uppercase leading-none">{act.username}</span>
                                            <span className="text-[9px] text-white/30 uppercase tracking-widest mt-1">First active: {act.firstActive ? new Date(act.firstActive).toLocaleDateString() : 'N/A'}</span>
                                          </div>
                                        </div>

                                        <div className="text-right">
                                          <div className="text-cyan-400 text-sm font-black italic tracking-tighter">
                                            {act.loginCount || 1} <span className="text-[9px] uppercase font-black text-white/40">LOGINS</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex justify-between items-center text-[9px] text-white/30 bg-black/20 p-2 rounded-xl mt-1.5 border border-white/5">
                                        <div className="uppercase tracking-wider">
                                          Last login: {act.lastLogin ? new Date(act.lastLogin).toLocaleString() : 'N/A'}
                                        </div>
                                        <div className="font-bold text-cyan-400 flex items-center gap-1 select-none">
                                          Active Session Verified
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {activeAdminTab === 'resellers' && (
                    <div className="space-y-6">
                      <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-5">
                        <h4 className="text-cyan-400 font-bold uppercase text-[11px] tracking-widest mb-1">Reseller Custom Branding Engine</h4>
                        <p className="text-xs text-white/70 leading-relaxed">
                          Enter your reseller's subdomain or custom domain keyword. When visitors open the website via that subdomain or domain, all your default WhatsApp numbers, group links, and brand names will automatically change to their custom details. This allows multiple IPTV resellers to share your single app securely without any overlap!
                        </p>
                        <div className="mt-3 text-[10px] text-white/50 bg-black/40 p-3 rounded-xl border border-white/5 space-y-1">
                          <p className="font-bold text-white uppercase tracking-wider">How to connect subdomain/domain:</p>
                          <p>1. In Cloudflare DNS, add a <span className="text-cyan-400 font-mono font-bold">CNAME</span> record pointing your reseller's subdomain (e.g. <span className="font-mono text-cyan-400">reseller1.yourdomain.com</span>) to your main Hugging Face Space URL.</p>
                          <p>2. Add the subdomain prefix (<span className="text-cyan-400 font-mono font-bold">reseller1</span>) below as the "Subdomain Keyword".</p>
                          <p>3. Alternatively, you can share the link using a parameter: <span className="text-cyan-400 font-mono font-bold">https://sj.4kott.online/?ref=reseller1</span></p>
                        </div>
                      </div>

                      {/* Reseller Form Card */}
                      <div className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-white font-bold text-sm tracking-tight">
                            {editingResellerId ? '📝 Edit Reseller Settings' : '✨ Add New Reseller Domain Setup'}
                          </h4>
                          {editingResellerId && (
                            <button
                              onClick={() => {
                                setEditingResellerId(null);
                                setNewReseller({
                                  subdomain: '',
                                  brand_name: '',
                                  tagline: '',
                                  whatsapp_number: '',
                                  whatsapp_group_link: '',
                                  logo_url: '',
                                  server_url: '',
                                  password: '',
                                  license_type: '1 Year'
                                });
                              }}
                              className="text-xs text-rose-400 hover:underline font-bold"
                            >
                              Cancel Edit
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] text-white/50 font-black uppercase tracking-widest block mb-1">Subdomain / Domain Keyword <span className="text-rose-400">*</span></label>
                            <input
                              type="text"
                              placeholder="e.g. reseller1 or full subdomain"
                              value={newReseller.subdomain}
                              onChange={(e) => setNewReseller({ ...newReseller, subdomain: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-white/50 font-black uppercase tracking-widest block mb-1">Custom Brand Name <span className="text-rose-400">*</span></label>
                            <input
                              type="text"
                              placeholder="e.g. VIP IPTV"
                              value={newReseller.brand_name}
                              onChange={(e) => setNewReseller({ ...newReseller, brand_name: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-white/50 font-black uppercase tracking-widest block mb-1">Slogan / Tagline</label>
                            <input
                              type="text"
                              placeholder="e.g. Premium Live & VOD Experience"
                              value={newReseller.tagline}
                              onChange={(e) => setNewReseller({ ...newReseller, tagline: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-white/50 font-black uppercase tracking-widest block mb-1">WhatsApp Number (digits only, e.g. 923112223344)</label>
                            <input
                              type="text"
                              placeholder="e.g. 923161611304"
                              value={newReseller.whatsapp_number}
                              onChange={(e) => setNewReseller({ ...newReseller, whatsapp_number: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-white/50 font-black uppercase tracking-widest block mb-1">Custom WhatsApp Group Link</label>
                            <input
                              type="url"
                              placeholder="https://chat.whatsapp.com/..."
                              value={newReseller.whatsapp_group_link}
                              onChange={(e) => setNewReseller({ ...newReseller, whatsapp_group_link: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-white/50 font-black uppercase tracking-widest block mb-1">Custom Logo URL (Optional)</label>
                            <input
                              type="url"
                              placeholder="https://example.com/logo.png"
                              value={newReseller.logo_url}
                              onChange={(e) => setNewReseller({ ...newReseller, logo_url: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-white/50 font-black uppercase tracking-widest block mb-1">Custom IPTV Server URL / Host (Optional)</label>
                            <input
                              type="url"
                              placeholder="e.g. http://your-server-dns.com or https://sjstorehot-lbskip.hf.space"
                              value={newReseller.server_url || ''}
                              onChange={(e) => setNewReseller({ ...newReseller, server_url: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                            />
                            <p className="text-[9px] text-white/40 mt-1">If specified, all IPTV requests for this reseller's domain will bypass the default server and route through their custom IPTV server URL.</p>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-white/50 font-black uppercase tracking-widest block mb-1">Custom Application Download Link (Optional)</label>
                            <input
                              type="url"
                              placeholder="https://example.com/download-app.apk"
                              value={newReseller.app_link || ''}
                              onChange={(e) => setNewReseller({ ...newReseller, app_link: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                            />
                            <p className="text-[9px] text-white/40 mt-1">Provide an APK or application download URL. If present, a beautiful download button will appear for your users on the home screen next to Trending Movies.</p>
                          </div>

                          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                            <div>
                              <label className="text-[10px] text-cyan-400 font-black uppercase tracking-widest block mb-1">Reseller Login Password <span className="text-rose-400">*</span></label>
                              <input
                                type="text"
                                placeholder="e.g. resellerpass123"
                                value={newReseller.password || ''}
                                onChange={(e) => setNewReseller({ ...newReseller, password: e.target.value })}
                                className="w-full bg-black/40 border border-cyan-500/20 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] text-cyan-400 font-black uppercase tracking-widest block mb-1">License Duration <span className="text-rose-400">*</span></label>
                              <select
                                value={newReseller.license_type || '1 Year'}
                                onChange={(e) => setNewReseller({ ...newReseller, license_type: e.target.value })}
                                className="w-full bg-black/40 border border-cyan-500/20 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
                              >
                                <option value="1 Year" className="bg-neutral-900 text-white font-bold">1 Year</option>
                                <option value="Lifetime" className="bg-neutral-900 text-white font-bold">Lifetime</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={handleAddReseller}
                          className="w-full bg-cyan-500 hover:bg-cyan-400 text-black py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-98"
                        >
                          {editingResellerId ? '💾 Save Reseller Changes' : '➕ Register Reseller Custom Subdomain'}
                        </button>
                      </div>

                      {/* Reseller List */}
                      <div className="space-y-3">
                        <h4 className="text-white font-bold text-sm tracking-tight">👥 Active Reseller Domains ({resellers.length})</h4>
                        {resellers.length === 0 ? (
                          <div className="text-center p-6 bg-white/5 border border-white/10 rounded-2xl">
                            <p className="text-xs text-white/40 font-bold uppercase tracking-wider">No resellers configured yet</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {resellers.map((item, idx) => (
                              <div key={`reseller-row-${item.id}-${idx}`} className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-3 flex flex-col justify-between group">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono text-[9px] font-bold">
                                      {item.subdomain}
                                    </span>
                                    <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => {
                                          setEditingResellerId(item.id);
                                          setNewReseller({
                                            subdomain: item.subdomain || '',
                                            brand_name: item.brand_name || '',
                                            tagline: item.tagline || '',
                                            whatsapp_number: item.whatsapp_number || '',
                                            whatsapp_group_link: item.whatsapp_group_link || '',
                                            logo_url: item.logo_url || '',
                                            server_url: item.server_url || '',
                                            app_link: item.app_link || '',
                                            password: item.password || '',
                                            license_type: item.license_type || '1 Year'
                                          });
                                        }}
                                        className="p-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-white hover:text-cyan-400 transition-all cursor-pointer"
                                        title="Edit"
                                      >
                                        <Pencil size={12} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteReseller(item.id)}
                                        className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-white hover:text-rose-400 transition-all cursor-pointer"
                                        title="Delete"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </div>
                                  <h5 className="text-sm font-black text-white">{item.brand_name}</h5>
                                  <p className="text-[10px] text-white/40 italic">"{item.tagline || 'Premium experience'}"</p>
                                </div>

                                <div className="pt-2 border-t border-white/5 space-y-1 text-[10px] text-white/60">
                                  <div>📱 WA No: <span className="font-mono text-white">{item.whatsapp_number || 'N/A'}</span></div>
                                  <div className="truncate">🔗 Group: <a href={item.whatsapp_group_link} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline font-bold">{item.whatsapp_group_link || 'N/A'}</a></div>
                                  <div className="truncate">🖥️ Server: <span className="font-mono text-white">{item.server_url || 'Default'}</span></div>
                                  <div className="truncate">📥 App Link: <span className="font-mono text-emerald-400 font-bold truncate max-w-[200px]" title={item.app_link || 'N/A'}>{item.app_link || 'N/A'}</span></div>
                                  <div className="flex items-center gap-4 mt-1 pt-1 border-t border-white/5">
                                    <div>🔑 Pass: <span className="font-mono text-cyan-400 font-bold">{item.password || 'None'}</span></div>
                                    <div>📜 License: <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">{item.license_type || '1 Year'}</span></div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {(activeAdminTab === 'psl' || activeAdminTab === 'ipl' || activeAdminTab === 'app') && (
                    <button 
                      onClick={handleUpdateUrl}
                      className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black py-4 rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all shadow-xl shadow-cyan-500/20"
                    >
                      Update Hub Status
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 bg-white/5 text-center">
                 <p className="text-[9px] text-white/20 uppercase tracking-[0.3em] font-bold italic">Admin Surface v2.0 • Secure Session Exclusive</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Trailer Modal Player */}
      <AnimatePresence>
        {playingTrailerUrl && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPlayingTrailerUrl(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md gpu"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-5xl bg-black rounded-2xl md:rounded-3xl shadow-[0_24px_50px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col z-10 border border-white/10"
            >
              {/* Premium Floating Close Button */}
              <button 
                onClick={() => setPlayingTrailerUrl(null)}
                className="absolute top-3 right-3 md:top-4 md:right-4 z-50 p-2 md:p-3 bg-black/60 hover:bg-black text-white/80 hover:text-white rounded-full border border-white/10 backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 shadow-2xl cursor-pointer flex items-center justify-center group"
                title="Close Trailer"
              >
                <X size={18} className="group-hover:rotate-90 transition-transform duration-300" />
              </button>

              {/* Player Body (Aspect 16:9) */}
              <div className="w-full aspect-video bg-black relative">
                {playingTrailerUrl && (
                  <iframe
                    src={`${playingTrailerUrl}?autoplay=1&mute=0&rel=0&modestbranding=1&controls=1&showinfo=0&iv_load_policy=3&enablejsapi=1`}
                    title="Trailer Player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating FIFA 2026 Badge (on the right-side center) */}
      <AnimatePresence>
        {activeTab !== 'fifa' && !selectedItem && !selectedFreeMovie && !selectedFreeSeries && !isSyncingDetails && !playingFreeMovie && !playingFreeSeries && !playingLiveStream && !playingLiveEvent && !playingEpisode && !playingFreeEpisode && !playingTrailerUrl && (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.3 }}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-[90] pointer-events-auto"
          >
            <motion.button
              id="fifa-floating-badge"
              onClick={() => {
                setActiveTab('fifa');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              whileHover={{ scale: 1.08, x: -6 }}
              whileTap={{ scale: 0.95 }}
              className="relative overflow-hidden flex flex-col items-center gap-1.5 py-4 px-3 w-[72px] md:w-[84px] rounded-l-[1.8rem] bg-gradient-to-b from-[#012e12] via-[#021f0b] to-[#011406] border-y border-l border-emerald-500/30 shadow-[0_4px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_4px_40px_rgba(16,185,129,0.5)] group transition-all cursor-pointer"
            >
              {/* Shine reflection effect */}
              <div className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:left-[100%] transition-all duration-[1000ms] ease-out pointer-events-none" />

              {/* Glowing background */}
              <div className="absolute -top-6 -right-6 w-16 h-16 bg-yellow-500/20 rounded-full blur-xl animate-pulse" />

              <div className="relative p-1 bg-yellow-500/10 rounded-full border border-yellow-500/40 shadow-inner group-hover:border-yellow-400">
                <Trophy className="text-yellow-400 group-hover:scale-110 transition-transform duration-300" size={20} />
              </div>

              <div className="flex flex-col items-center text-center -space-y-0.5">
                <span className="text-[10px] md:text-[11px] font-display font-black text-emerald-400 italic tracking-tight uppercase leading-none">FIFA</span>
                <span className="text-[9px] md:text-[10px] font-mono font-black text-yellow-400 tracking-wider leading-none">2026</span>
              </div>

              {/* Pulse badge */}
              <div className="flex items-center gap-1 mt-1 bg-red-600/90 py-0.5 px-2 rounded-full border border-red-500/30">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                <span className="text-[8px] font-black tracking-widest text-white uppercase leading-none">LIVE</span>
              </div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>



      {/* FIFA 2026 Video Player Overlay Modal */}
      <AnimatePresence>
        {playingFifaChannel && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              id="fifa-player-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPlayingFifaChannel(null)}
              className="absolute inset-0 bg-black/95 backdrop-blur-sm gpu"
            />
            <motion.div
              id="fifa-player-container"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[95vw] md:w-full md:max-w-5xl max-h-[85vh] lg:max-h-[80vh] bg-[#030c05] rounded-3xl overflow-hidden shadow-2xl border border-emerald-500/30 flex flex-col text-white animate-in"
            >
              {/* Header */}
              <div className="p-4 flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-[#011a09] to-black">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center border border-yellow-500/30 shadow-lg animate-pulse">
                    <Trophy size={18} className="text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-display font-black text-white italic tracking-tight">{playingFifaChannel.name}</h3>
                    <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-widest leading-none mt-0.5">FIFA Arena • {currentBrandName} Premium Feed</p>
                  </div>
                </div>
                <button 
                  onClick={() => setPlayingFifaChannel(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Video Player Box */}
              <div className="relative w-full flex-1 aspect-video bg-black overflow-hidden min-h-[220px] lg:min-h-0">
                <VideoPlayer 
                  key={`fifa-stream-view-${playingFifaChannel.id}-${playingFifaChannel.play_url}`}
                  options={{
                    autoplay: true,
                    controls: true,
                    responsive: true,
                    fluid: true,
                    is_embed: !!playingFifaChannel.is_embed,
                    is_webpage: !!playingFifaChannel.is_webpage,
                    sandbox_disabled: !!playingFifaChannel.sandbox_disabled,
                    skipProxy: true,
                    isLive: true,
                    sources: [{
                      src: playingFifaChannel.play_url,
                      type: playingFifaChannel.play_url.includes('.m3u8') 
                        ? 'application/x-mpegURL' 
                        : (playingFifaChannel.play_url.includes('.mpd') || playingFifaChannel.is_mpd)
                          ? 'application/dash+xml' 
                          : 'video/mp4'
                    }]
                  }} 
                />
                
                {/* Visual Live Beacon */}
                <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1 bg-red-600 rounded-full shadow-lg border border-red-500/20">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                  <span className="text-[9px] font-black text-white uppercase tracking-wider">Live</span>
                </div>
              </div>
              
              {/* Stadium Banner Footer */}
              <div className="p-6 bg-[#011406] border-t border-emerald-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5 text-center md:text-left">
                  <p className="text-xs text-white/80 font-bold uppercase tracking-[0.2em] leading-normal">
                    Enjoying <span className="text-emerald-400 font-extrabold">{playingFifaChannel.name}</span> in Luxury 4K UHD
                  </p>
                  <p className="text-[9px] text-white/30 uppercase tracking-[0.1em] font-medium leading-none">
                    Streamed live from our exclusive multi-route football servers
                  </p>
                </div>
                
                {currentWhatsappGroupLink && (
                  <a 
                    href={currentWhatsappGroupLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white px-5 py-2.5 rounded-xl font-bold text-[10px] transition-all shadow-[0_0_20px_rgba(37,211,102,0.4)] uppercase tracking-widest cursor-pointer"
                  >
                    <MessageCircle size={16} fill="white" />
                    JOIN FOOTBALL WHATSAPP
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="p-8 pb-24 md:pb-8 text-center border-t border-white/5 bg-black/20">
        <div className="mb-4">
          <h2 className="text-xl font-display font-black tracking-tighter italic">{currentBrandName}</h2>
          <p className="text-[10px] text-cyan-500 font-bold uppercase tracking-[0.3em] mt-1">Premium Experience</p>
        </div>
        <p className="text-white/20 text-[10px] font-medium uppercase tracking-[0.2em]">
          Powered by {currentBrandName} Engine • Premium Content Delivery
        </p>
      </footer>
    </div>
  );
}
