import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Check,
  Copy,
  Play, 
  Download, 
  Search, 
  LogIn, 
  LogOut, 
  Film, 
  Tv, 
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
  Trophy
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { xtreamApi, DEFAULT_CREDENTIALS } from './lib/api';
import { XtreamCredentials, Category, Stream, Series, LiveStream } from './types';
import VideoPlayer from './components/VideoPlayer';
import IntroLoading from './components/IntroLoading';
import { db, auth } from './firebase';
import { doc, onSnapshot, setDoc, getDocFromServer, collection, addDoc, deleteDoc } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';

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

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [creds, setCreds] = useState<XtreamCredentials>(() => {
    const saved = localStorage.getItem('iptv_creds');
    const loggedIn = localStorage.getItem('iptv_logged_in') === 'true';
    if (loggedIn && saved) {
      try {
        return JSON.parse(saved);
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
  const [activeTab, setActiveTab] = useState<'home' | 'movies' | 'series' | 'live'>('home');
  const [movieCategories, setMovieCategories] = useState<Category[]>([]);
  const [seriesCategories, setSeriesCategories] = useState<Category[]>([]);
  const [liveCategories, setLiveCategories] = useState<Category[]>([]);
  const [selectedMovieCategory, setSelectedMovieCategory] = useState<string>('0');
  const [selectedSeriesCategory, setSelectedSeriesCategory] = useState<string>('0');
  const [selectedLiveCategory, setSelectedLiveCategory] = useState<string>('0');
  const [movieItems, setMovieItems] = useState<Stream[]>([]);
  const [seriesItems, setSeriesItems] = useState<Series[]>([]);
  const [liveItems, setLiveItems] = useState<LiveStream[]>([]);
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
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);
  const [pendingDownload, setPendingDownload] = useState<{item: any, episodeId?: string, episodeExt?: string} | null>(null);
  const [showPSLPlayer, setShowPSLPlayer] = useState(false);
  const [showIPLPlayer, setShowIPLPlayer] = useState(false);
  const [showFreeAccessModal, setShowFreeAccessModal] = useState(false);
  const [selectedPslLanguage, setSelectedPslLanguage] = useState<'urdu' | 'english' | null>(null);
  const [pslUrlUrdu, setPslUrlUrdu] = useState('');
  const [pslUrlEnglish, setPslUrlEnglish] = useState('');
  const [iplUrl, setIplUrl] = useState('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [newPslUrlUrdu, setNewPslUrlUrdu] = useState(pslUrlUrdu);
  const [newPslUrlEnglish, setNewPslUrlEnglish] = useState(pslUrlEnglish);
  const [newIplUrl, setNewIplUrl] = useState(iplUrl);
  const [activeAdminTab, setActiveAdminTab] = useState<'psl' | 'ipl'>('psl');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showIntro, setShowIntro] = useState(() => {
    return localStorage.getItem('has_seen_intro') !== 'true';
  });
  const [introProgress, setIntroProgress] = useState(0);

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
        await getDocFromServer(doc(db, 'settings', 'psl'));
        console.log("Firestore Connection Test: Success");
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Firestore Connection Test: Failed (Client is offline)");
        } else {
          console.error("Firestore Connection Test: Error", error);
        }
      }
    };
    testConnection();
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

  // Test connection
  useEffect(() => {
    const testConnection = async () => {
      try {
        const pslDocRef = doc(db, 'settings', 'psl');
        await getDocFromServer(pslDocRef);
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Firebase connection error: check configuration.");
        }
      }
    };
    testConnection();
  }, []);

  const pslOptions = useMemo(() => {
    const url = selectedPslLanguage === 'urdu' ? pslUrlUrdu : pslUrlEnglish;
    const isMp4 = url.toLowerCase().includes('.mp4');
    const isHls = url.toLowerCase().includes('.m3u8');
    
    return {
      autoplay: true,
      controls: true,
      responsive: true,
      fluid: false,
      fill: true,
      preload: 'auto',
      sources: [{
        src: url,
        type: isHls ? 'application/x-mpegURL' : (isMp4 ? 'video/mp4' : 'video/mp4')
      }]
    };
  }, [pslUrlUrdu, pslUrlEnglish, selectedPslLanguage]);

  const iplOptions = useMemo(() => {
    const isMp4 = iplUrl.toLowerCase().includes('.mp4');
    const isHls = iplUrl.toLowerCase().includes('.m3u8');
    
    return {
      autoplay: true,
      controls: true,
      responsive: true,
      fluid: false,
      fill: true,
      preload: 'auto',
      sources: [{
        src: iplUrl,
        type: isHls ? 'application/x-mpegURL' : (isMp4 ? 'video/mp4' : 'video/mp4')
      }]
    };
  }, [iplUrl]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'admin123') { // Simple password for demo
      try {
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        // Force account selection so the user can pick the correct Gmail
        provider.setCustomParameters({ prompt: 'select_account' });
        
        const result = await signInWithPopup(auth, provider);
        const userEmail = result.user.email?.toLowerCase();
        
        console.log("Logged in user email:", result.user.email);
        console.log("Logged in user UID:", result.user.uid);
        
        if (userEmail === 'sjstoreuk17@gmail.com' || result.user.email === 'sjstoreuk17@gmail.com') {
          setIsAdminLoggedIn(true);
          setShowAdminLogin(false);
          setAdminPassword('');
        } else {
          alert(`Unauthorized: ${userEmail} is not the authorized admin email. Please login with sjstoreuk17@gmail.com`);
          await auth.signOut();
        }
      } catch (err) {
        console.error("Login failed", err);
        alert("Login failed. Popups might be blocked or the sign-in was cancelled.");
      }
    } else {
      alert('Invalid password');
    }
  };

  const handleUpdateUrl = async () => {
    if (!currentUser) {
      alert("Please login first.");
      return;
    }
    
    try {
      const docId = activeAdminTab === 'psl' ? 'psl' : 'ipl';
      const docRef = doc(db, 'settings', docId);
      const data = activeAdminTab === 'psl' 
        ? { 
            psl_live_url_urdu: newPslUrlUrdu, 
            psl_live_url_english: newPslUrlEnglish, 
            updatedAt: new Date().toISOString() 
          }
        : { ipl_live_url: newIplUrl, updatedAt: new Date().toISOString() };
      
      await setDoc(docRef, data);
      alert(`${activeAdminTab.toUpperCase()} URL Updated Globally!`);
    } catch (err) {
      console.error("Update failed", err);
      try {
        handleFirestoreError(err, OperationType.WRITE, `settings/${activeAdminTab}`);
      } catch (e: any) {
        const errorData = JSON.parse(e.message);
        alert(`Failed to update. Error: ${errorData.error}. Make sure you are the authorized admin.`);
      }
    }
  };

  // Fetch series info when a series is selected
  useEffect(() => {
    if (selectedItem && 'series_id' in selectedItem) {
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
    } else {
      setSeriesInfo(null);
      setSelectedSeason(null);
    }
  }, [selectedItem, creds]);

  const [error, setError] = useState<string | null>(null);
  const isInitialMount = React.useRef(true);

  // Initialize data
  useEffect(() => {
    const initData = async () => {
      setLoadingHome(true);
      setLoadingMovies(true);
      setLoadingSeries(true);
      setLoadingLive(true);
      setError(null);
      setIntroProgress(5);

      try {
        // 0. Verify credentials first
        try {
          await xtreamApi.login(creds);
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

        // 2. Fetch Movies
        let mItems: Stream[] = [];
        try {
          mItems = await xtreamApi.getMovies(creds, '0');
          setMovieItems(mItems);
          setIntroProgress(55);
        } catch (mErr) {
          console.error("Failed to fetch movies", mErr);
        } finally {
          setLoadingMovies(false);
        }

        // 3. Fetch Series
        let sItems: Series[] = [];
        try {
          sItems = await xtreamApi.getSeries(creds, '0');
          setSeriesItems(sItems);
          setIntroProgress(75);
        } catch (sErr) {
          console.error("Failed to fetch series", sErr);
        } finally {
          setLoadingSeries(false);
        }

        // 4. Fetch Live TV
        try {
          const lItems = await xtreamApi.getLiveStreams(creds, '0');
          setLiveItems(lItems);
          setIntroProgress(90);
        } catch (lErr) {
          console.error("Failed to fetch live streams", lErr);
        } finally {
          setLoadingLive(false);
        }

        // 5. Set Home Data
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
          setError("No content found on the server. Please check your IPTV subscription.");
          setIntroProgress(100);
        }
      } catch (err: any) {
        console.error("Critical failure during initialization", err);
        setError(err.message || "Failed to connect to IPTV server.");
        setIntroProgress(100);
      } finally {
        setLoadingHome(false);
        setLoadingMovies(false);
        setLoadingSeries(false);
        setLoadingLive(false);
      }
    };

    initData();
    isInitialMount.current = false;
  }, [creds]);

  // Fetch Movie items when category changes
  useEffect(() => {
    if (isInitialMount.current && selectedMovieCategory === '0') return;

    const fetchMovies = async () => {
      setLoadingMovies(true);
      setError(null);
      try {
        const data = await xtreamApi.getMovies(creds, selectedMovieCategory);
        setMovieItems(data);
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
    if (isInitialMount.current && selectedSeriesCategory === '0') return;

    const fetchSeries = async () => {
      setLoadingSeries(true);
      setError(null);
      try {
        const data = await xtreamApi.getSeries(creds, selectedSeriesCategory);
        setSeriesItems(data);
      } catch (err: any) {
        console.error("Failed to fetch series", err);
        setError(err.message || "Failed to fetch series for this category.");
      } finally {
        setLoadingSeries(false);
      }
    };
    fetchSeries();
  }, [creds, selectedSeriesCategory]);

  // Fetch Live TV items when category changes
  useEffect(() => {
    if (isInitialMount.current && selectedLiveCategory === '0') return;

    const fetchLive = async () => {
      setLoadingLive(true);
      setError(null);
      try {
        const data = await xtreamApi.getLiveStreams(creds, selectedLiveCategory);
        setLiveItems(data);
      } catch (err: any) {
        console.error("Failed to fetch live streams", err);
        setError(err.message || "Failed to fetch channels for this category.");
      } finally {
        setLoadingLive(false);
      }
    };
    fetchLive();
  }, [creds, selectedLiveCategory]);

  const handleItemClick = (item: any) => {
    setSelectedItem(item);
  };

  const currentItems = useMemo(() => {
    const items = activeTab === 'movies' ? movieItems : (activeTab === 'series' ? seriesItems : liveItems);
    const base = searchQuery 
      ? items.filter((item: any) => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : items;
    return base.slice(0, 200);
  }, [activeTab, movieItems, seriesItems, liveItems, searchQuery]);

  const currentCategories = activeTab === 'movies' ? movieCategories : (activeTab === 'series' ? seriesCategories : liveCategories);
  const currentSelectedCategory = activeTab === 'movies' ? selectedMovieCategory : (activeTab === 'series' ? selectedSeriesCategory : selectedLiveCategory);
  const setCurrentSelectedCategory = activeTab === 'movies' ? setSelectedMovieCategory : (activeTab === 'series' ? setSelectedSeriesCategory : setSelectedLiveCategory);
  const currentLoading = activeTab === 'movies' ? loadingMovies : (activeTab === 'series' ? loadingSeries : loadingLive);

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
        setIsLoggedIn(true);
        setShowLoginModal(false);
        setSelectedItem(null);
        localStorage.setItem('iptv_creds', JSON.stringify(userCreds));
        localStorage.setItem('iptv_logged_in', 'true');
      } else {
        setLoginError('Account is not active or invalid credentials');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.response?.status === 404) {
        setLoginError('Server returned 404. Please check if the host URL is correct.');
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        setLoginError('Invalid username or password.');
      } else {
        setLoginError('Failed to connect to server. Please check your internet and credentials.');
      }
    }
  };

  const handleLogout = () => {
    setCreds(DEFAULT_CREDENTIALS);
    setIsLoggedIn(false);
    localStorage.removeItem('iptv_creds');
    localStorage.removeItem('iptv_logged_in');
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleAction = async (action: 'play' | 'download' | 'web_play' | 'copy', item: any, episodeId?: string, episodeExt?: string, isConfirmed = false) => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }

    // Ensure host is valid
    let host = creds.host.trim();
    if (!host || !creds.username || !creds.password) {
      alert("Please enter a valid server host, username, and password in settings.");
      return;
    }
    if (!host.startsWith('http')) {
      host = `http://${host}`;
    }
    // Remove trailing slash if exists
    host = host.replace(/\/$/, '');

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

    const ext = isLive ? 'ts' : (episodeExt || (item as any).container_extension || 'mp4');
    const type = isLive ? 'live' : (isSeries ? 'series' : 'movie');
    
    // Correct Xtream URL format: http://host:port/type/user/pass/id.ext
    const url = `${host}/${type}/${creds.username}/${creds.password}/${streamId}.${ext}`;
    
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
      window.open(url, '_blank');
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
          // Intent for Android to show player chooser
          const intentUrl = `intent:${url}#Intent;action=android.intent.action.VIEW;type=video/*;S.title=${encodeURIComponent(item.name)};end`;
          window.location.href = intentUrl;
        } else if (isIOS) {
          // iOS - try vlc:// as a common player scheme
          const vlcUrl = `vlc://${url}`;
          window.location.href = vlcUrl;
        } else {
          window.open(url, '_blank');
        }
      } else {
        // Desktop/PC - use vlc:// protocol scheme
        const vlcUrl = `vlc://${url}`;
        window.location.href = vlcUrl;
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatePresence>
        {showIntro && (
          <IntroLoading 
            progress={introProgress} 
            onComplete={() => {
              setShowIntro(false);
              localStorage.setItem('has_seen_intro', 'true');
            }} 
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-50 glass-dark px-4 md:px-6 py-3 md:py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-4 md:gap-8">
          <div className="flex flex-col -space-y-1">
            <h1 className="text-xl md:text-2xl font-display font-bold text-gradient tracking-tighter flex items-center gap-1">
              <span className="text-cyan-400">4K</span><span className="text-white">·SJ</span>
            </h1>
            <span className="text-[8px] md:text-[10px] text-cyan-400/60 font-bold uppercase tracking-[0.2em] pl-1">Premium Experience</span>
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
              <span className="text-[10px] text-white/40 hidden lg:block">Logged in as: <span className="text-white/80 font-medium">{creds.username}</span></span>
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-white/10 rounded-full transition-all hover:rotate-12 text-white/60 hover:text-white"
                title="Logout"
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
                {/* Hero Slider (First Popular Movie) */}
                {homeData.popularMovies.length > 0 && (
                  <div className="relative h-[400px] md:h-[600px] rounded-2xl md:rounded-[2.5rem] overflow-hidden group shadow-2xl shadow-cyan-500/10">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={homeData.popularMovies[0].stream_id}
                        initial={{ opacity: 0, scale: 1.1 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.8 }}
                        className="absolute inset-0"
                      >
                        <img 
                          src={homeData.popularMovies[0].stream_icon || null}
                          alt={homeData.popularMovies[0].name}
                          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-[2s]"
                          onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/movie/1200/800?blur=2'; }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                        <div className="absolute bottom-0 left-0 p-8 md:p-16 space-y-4 md:space-y-6 max-w-2xl">
                          <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="flex items-center gap-3"
                          >
                            <span className="px-4 py-1 bg-cyan-500/20 text-cyan-400 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] rounded-full border border-cyan-500/30 backdrop-blur-md">
                              Featured Content
                            </span>
                            {homeData.popularMovies[0].rating && (
                              <span className="text-yellow-500 font-bold flex items-center gap-1 text-sm md:text-base">
                                ★ {homeData.popularMovies[0].rating}
                              </span>
                            )}
                          </motion.div>
                          <motion.h2 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="text-4xl md:text-7xl font-display font-bold leading-tight drop-shadow-2xl"
                          >
                            {homeData.popularMovies[0].name}
                          </motion.h2>
                          <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="flex items-center gap-4 pt-4"
                          >
                            <button 
                              onClick={() => handleItemClick(homeData.popularMovies[0])}
                              className="premium-button premium-button-primary md:px-10 md:py-4 md:text-lg"
                            >
                              <Play size={24} fill="black" /> Watch Now
                            </button>
                            <button 
                              onClick={() => handleItemClick(homeData.popularMovies[0])}
                              className="premium-button premium-button-secondary md:px-10 md:py-4 md:text-lg"
                            >
                              <Info size={24} /> Details
                            </button>
                          </motion.div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                )}

                {/* Popular Movies */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl md:text-3xl font-bold flex items-center gap-3">
                      <Film className="text-cyan-400" size={28} /> Popular Movies
                    </h3>
                    <button 
                      onClick={() => setActiveTab('movies')}
                      className="text-cyan-400 text-sm font-bold hover:text-cyan-300 transition-colors flex items-center gap-1"
                    >
                      View All <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-6">
                    {homeData.popularMovies.map((item, idx) => (
                      <motion.div 
                        key={item.stream_id}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ 
                          type: "spring",
                          damping: 20,
                          stiffness: 100,
                          delay: idx * 0.03 
                        }}
                        whileHover={{ scale: 1.05, y: -5 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleItemClick(item)}
                        className="group cursor-pointer space-y-2"
                      >
                        <div className="premium-card aspect-[2/3]">
                          <img 
                            src={item.stream_icon || null} 
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/movie/400/600?blur=2'; }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3">
                            <div className="flex items-center gap-2 bg-cyan-500 text-black px-3 py-1.5 rounded-full text-[10px] font-bold transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                              <Play size={10} fill="currentColor" /> Watch Now
                            </div>
                          </div>
                        </div>
                        <h4 className="text-[10px] md:text-sm font-bold line-clamp-1 group-hover:text-cyan-400 transition-colors px-1">{item.name}</h4>
                      </motion.div>
                    ))}
                  </div>
                </section>

                {/* Popular Series */}
                <section className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl md:text-3xl font-bold flex items-center gap-3">
                      <Tv className="text-cyan-400" size={28} /> Popular Web Series
                    </h3>
                    <button 
                      onClick={() => setActiveTab('series')}
                      className="text-cyan-400 text-sm font-bold hover:text-cyan-300 transition-colors flex items-center gap-1"
                    >
                      View All <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-6">
                    {homeData.popularSeries.map((item, idx) => (
                      <motion.div 
                        key={item.series_id}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ 
                          type: "spring",
                          damping: 20,
                          stiffness: 100,
                          delay: idx * 0.03 
                        }}
                        whileHover={{ scale: 1.05, y: -5 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleItemClick(item)}
                        className="group cursor-pointer space-y-2"
                      >
                        <div className="premium-card aspect-[2/3]">
                          <img 
                            src={item.cover || null} 
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/series/400/600?blur=2'; }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-3">
                            <div className="flex items-center gap-2 bg-cyan-500 text-black px-3 py-1.5 rounded-full text-[10px] font-bold transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                              <Play size={10} fill="currentColor" /> Watch Now
                            </div>
                          </div>
                        </div>
                        <h4 className="text-[10px] md:text-sm font-bold line-clamp-1 group-hover:text-cyan-400 transition-colors px-1">{item.name}</h4>
                      </motion.div>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Premium Category Bar */}
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex items-center justify-between">
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

              <div className="relative group">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory">
                  {currentCategories.map((cat) => (
                    <button
                      key={cat.category_id}
                      onClick={() => setCurrentSelectedCategory(cat.category_id)}
                      className={cn(
                        "relative whitespace-nowrap px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 snap-start",
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
                      <span className="relative z-10">{cat.category_name}</span>
                    </button>
                  ))}
                </div>
                {/* Fade edges */}
                <div className="absolute top-0 right-0 bottom-2 w-12 bg-gradient-to-l from-[#020617] to-transparent pointer-events-none" />
              </div>
            </div>

            {/* Content Grid */}
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
                <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 md:gap-6">
                  <AnimatePresence mode="popLayout">
                    {currentItems.map((item, idx) => (
                    <motion.div
                      key={'stream_id' in item ? item.stream_id : (item as any).series_id}
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ 
                        type: "spring",
                        damping: 20,
                        stiffness: 100,
                        delay: Math.min(idx * 0.03, 0.6) 
                      }}
                      whileHover={{ scale: 1.05, y: -5 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedItem(item)}
                      className="group cursor-pointer space-y-1 md:space-y-3"
                    >
                      <div className="relative aspect-[2/3] rounded-lg md:rounded-xl overflow-hidden shadow-2xl transition-transform group-hover:scale-105 border border-white/5 group-hover:border-cyan-500/50">
                        <img 
                          src={('stream_icon' in item ? (item as any).stream_icon : (item as Series).cover) || null} 
                          alt={item.name}
                          referrerPolicy="no-referrer"
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
                </AnimatePresence>
              </div>
            </div>
          )}

            {!currentLoading && currentItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 md:py-32 text-white/40">
                <Search size={40} md:size={48} className="mb-4 opacity-20" />
                <p className="text-sm">No titles found in this category.</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Item Details Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 40, rotateX: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 40, rotateX: 15 }}
              transition={{ 
                type: "spring",
                damping: 25,
                stiffness: 300,
                mass: 0.8
              }}
              className="relative w-full max-w-4xl glass-dark rounded-2xl md:rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col md:flex-row max-h-[90vh] md:max-h-none border border-white/10"
            >
              <button 
                onClick={() => setSelectedItem(null)}
                className="absolute top-3 right-3 md:top-4 md:right-4 z-20 p-2 bg-black/50 hover:bg-black rounded-full transition-colors"
              >
                <X size={18} md:size={20} />
              </button>

              <div className="w-full md:w-2/5 bg-black/40 p-6 md:p-0 flex items-center justify-center shrink-0">
                <div className="w-44 md:w-full aspect-[2/3] md:aspect-auto rounded-xl overflow-hidden shadow-2xl border border-white/10">
                  <img 
                    src={('stream_icon' in selectedItem ? selectedItem.stream_icon : (selectedItem as Series).cover) || null} 
                    alt={selectedItem.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/movie/400/600?blur=2';
                    }}
                  />
                </div>
              </div>

              <div className="flex-1 p-5 md:p-8 flex flex-col justify-start space-y-4 md:space-y-6 overflow-y-auto no-scrollbar pb-10 md:pb-8">
                <div>
                  <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
                    <span className="px-2 py-0.5 bg-cyan-600/20 text-cyan-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest rounded">
                      {('series_id' in selectedItem) ? 'Series' : 'Movie'}
                    </span>
                    {selectedItem.rating && (
                      <span className="text-yellow-500 font-bold flex items-center gap-1 text-xs md:text-sm">
                        ★ {selectedItem.rating}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl md:text-4xl font-display font-bold leading-tight line-clamp-2 md:line-clamp-none">{selectedItem.name}</h2>
                </div>

                <p className="text-white/60 text-[10px] md:text-sm leading-relaxed line-clamp-2 md:line-clamp-4">
                  {'plot' in selectedItem ? selectedItem.plot : (seriesInfo?.info?.plot || "Enjoy high-quality streaming of this title. Experience the best in entertainment with 4K·SJ premium IPTV service.")}
                </p>

                {/* Action Buttons for Movies/Live */}
                { !(selectedItem as any).series_id ? (
                  <div className="flex flex-col gap-2 md:gap-4 pt-1 md:pt-4">
                    <button 
                      onClick={() => handleAction('play', selectedItem)}
                      title="Play in External Player (Only for Mobile Users)"
                      className="flex items-center justify-center gap-2 md:gap-3 bg-cyan-500 text-black hover:bg-cyan-400 px-4 py-2.5 md:px-6 md:py-3 rounded-xl font-bold transition-all transform hover:scale-105 text-xs md:text-sm shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                    >
                      <Play size={16} md:size={18} fill="black" /> 
                      <span>Play in External Player</span>
                      <span className="text-[8px] md:text-[10px] opacity-70 font-normal ml-1">(Only for Mobile Users)</span>
                    </button>
                    
                    {/* Copy Link for Movies/Live */}
                    <div className="space-y-1.5 md:space-y-2">
                      <button 
                        onClick={() => handleAction('copy', selectedItem)}
                        className={cn(
                          "w-full flex items-center justify-center gap-2 md:gap-3 px-4 py-2.5 md:px-6 md:py-3 rounded-xl font-bold transition-all border text-xs md:text-sm",
                          copiedId === ((selectedItem as any).stream_id || (selectedItem as any).id)
                            ? "bg-green-500/20 border-green-500/50 text-green-400" 
                            : "bg-white/5 hover:bg-white/10 border-white/5 text-white"
                        )}
                      >
                        {copiedId === ((selectedItem as any).stream_id || (selectedItem as any).id) ? <Check size={16} md:size={18} /> : <Copy size={16} md:size={18} />}
                        {copiedId === ((selectedItem as any).stream_id || (selectedItem as any).id) ? "Link Copied!" : ((selectedItem as any).stream_type === 'live' ? "Copy Channel Link" : "Copy Movie Link")}
                      </button>
                      <p className="text-[9px] md:text-[10px] text-white/40 text-center uppercase tracking-tighter">
                        Paste this link on VLC Player to play manually
                      </p>
                    </div>

                    { !(selectedItem as any).stream_type || (selectedItem as any).stream_type !== 'live' ? (
                      <button 
                        onClick={() => handleAction('download', selectedItem)}
                        className="w-full flex items-center justify-center gap-2 md:gap-3 bg-white/5 hover:bg-white/10 px-4 py-2.5 md:px-6 md:py-3 rounded-xl font-bold transition-all border border-white/5 text-xs md:text-sm"
                      >
                        <Download size={16} md:size={18} /> Download
                      </button>
                    ) : null}
                  </div>
                ) : (
                  /* Episode List for Series */
                  <div className="space-y-4 md:space-y-6 pt-1 md:pt-2">
                    {loadingInfo ? (
                      <div className="flex items-center gap-3 text-white/40 py-4">
                        <Loader2 className="animate-spin" size={18} md:size={20} />
                        <span className="text-xs md:text-sm">Loading episodes...</span>
                      </div>
                    ) : seriesInfo?.episodes ? (
                      <>
                        {/* Seasons Selector */}
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-2">
                          {Object.keys(seriesInfo.episodes).map((seasonNum) => (
                            <button
                              key={seasonNum}
                              onClick={() => setSelectedSeason(seasonNum)}
                              className={cn(
                                "whitespace-nowrap px-3 md:px-4 py-1 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all border",
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
                        <div className="space-y-2 max-h-[300px] md:max-h-[400px] overflow-y-auto pr-1 md:pr-2 no-scrollbar pb-20 md:pb-10">
                          {seriesInfo.episodes[selectedSeason || '']?.map((episode: any) => (
                            <div 
                              key={episode.id}
                              className="group/ep flex items-center justify-between p-2.5 md:p-3 rounded-lg md:rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all"
                            >
                              <div className="flex items-center gap-3 md:gap-4">
                                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white/10 flex items-center justify-center text-[9px] md:text-[10px] font-bold">
                                  {episode.episode_num}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs md:text-sm font-semibold line-clamp-1">{episode.title}</span>
                                  <span className="text-[9px] md:text-[10px] text-white/40 uppercase tracking-wider">Episode {episode.episode_num}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 md:gap-2">
                                <button 
                                  onClick={() => handleAction('play', selectedItem, episode.id, episode.container_extension)}
                                  className="p-1.5 md:p-2 hover:bg-white/20 rounded-lg transition-colors"
                                  title="Play in External Player (Only for Mobile Users)"
                                >
                                  <Play size={14} md:size={16} fill="currentColor" />
                                </button>
                                <button 
                                  onClick={() => handleAction('copy', selectedItem, episode.id, episode.container_extension)}
                                  className={cn(
                                    "p-1.5 md:p-2 rounded-lg transition-all",
                                    copiedId === episode.id 
                                      ? "bg-green-500/20 text-green-400" 
                                      : "hover:bg-white/20 text-white/60"
                                  )}
                                  title="Copy Episode Link"
                                >
                                  {copiedId === episode.id ? <Check size={14} md:size={16} /> : <Copy size={14} md:size={16} />}
                                </button>
                                <button 
                                  onClick={() => handleAction('download', selectedItem, episode.id, episode.container_extension)}
                                  className="p-1.5 md:p-2 hover:bg-white/20 rounded-lg transition-colors"
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
                      <p className="text-xs md:text-sm text-white/40 italic">No episodes found for this series.</p>
                    )}
                  </div>
                )}
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
                <h2 className="text-2xl font-display font-bold mb-2 text-gradient">4K•SJ Login</h2>
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
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle size={14} /> {loginError}
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full bg-cyan-500 hover:bg-cyan-400 text-black py-4 rounded-xl font-bold text-lg transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] mt-4"
                >
                  Login to 4K•SJ
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-white/10 text-center">
                <p className="text-white/40 text-xs mb-4 uppercase tracking-widest font-bold">Don't have an account?</p>
                <a 
                  href="https://wa.me/923161611304" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 bg-green-500/10 hover:bg-green-500/20 text-green-400 px-6 py-3 rounded-xl font-bold transition-all border border-green-500/20 w-full justify-center"
                >
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Register New Account
                </a>
                <p className="mt-4 text-[10px] text-white/20 uppercase tracking-tighter">Contact us on WhatsApp to get your premium credentials</p>
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

      {/* Premium Mobile Bottom Navigation */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden w-[92%] max-w-sm">
        <div className="glass-dark border border-white/10 rounded-2xl p-1.5 flex items-center justify-around shadow-2xl shadow-black/50 backdrop-blur-3xl">
          <button 
            onClick={() => { setActiveTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className={cn(
              "relative flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all duration-300",
              activeTab === 'home' ? "text-cyan-400" : "text-white/40 hover:text-white/60"
            )}
          >
            {activeTab === 'home' && (
              <motion.div layoutId="mobileNav" className="absolute inset-0 bg-white/5 rounded-xl" />
            )}
            <Home size={20} className="relative z-10" />
            <span className="text-[9px] font-black uppercase tracking-tighter relative z-10">Home</span>
          </button>
          <button 
            onClick={() => { setActiveTab('movies'); setSelectedMovieCategory('0'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className={cn(
              "relative flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all duration-300",
              activeTab === 'movies' ? "text-cyan-400" : "text-white/40 hover:text-white/60"
            )}
          >
            {activeTab === 'movies' && (
              <motion.div layoutId="mobileNav" className="absolute inset-0 bg-white/5 rounded-xl" />
            )}
            <Film size={20} className="relative z-10" />
            <span className="text-[9px] font-black uppercase tracking-tighter relative z-10">Movies</span>
          </button>
          <button 
            onClick={() => { setActiveTab('series'); setSelectedSeriesCategory('0'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className={cn(
              "relative flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all duration-300",
              activeTab === 'series' ? "text-cyan-400" : "text-white/40 hover:text-white/60"
            )}
          >
            {activeTab === 'series' && (
              <motion.div layoutId="mobileNav" className="absolute inset-0 bg-white/5 rounded-xl" />
            )}
            <Tv size={20} className="relative z-10" />
            <span className="text-[9px] font-black uppercase tracking-tighter relative z-10">Series</span>
          </button>
          <button 
            onClick={() => { setActiveTab('live'); setSelectedLiveCategory('0'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className={cn(
              "relative flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all duration-300",
              activeTab === 'live' ? "text-cyan-400" : "text-white/40 hover:text-white/60"
            )}
          >
            {activeTab === 'live' && (
              <motion.div layoutId="mobileNav" className="absolute inset-0 bg-white/5 rounded-xl" />
            )}
            <LayoutGrid size={20} className="relative z-10" />
            <span className="text-[9px] font-black uppercase tracking-tighter relative z-10">Live</span>
          </button>
        </div>
      </div>

      {/* Free Access Floating Button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowFreeAccessModal(true)}
        className="fixed bottom-28 right-6 md:bottom-10 md:right-10 z-[55] w-20 h-20 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 rounded-full shadow-[0_0_40px_rgba(234,179,8,0.6)] flex items-center justify-center border-4 border-white/50 group overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity animate-pulse" />
        <div className="flex flex-col items-center justify-center text-center px-1">
          <span className="text-[10px] font-black text-white uppercase tracking-tighter leading-none mb-1">Unlock</span>
          <span className="text-xs font-black text-white leading-none drop-shadow-md">FREE</span>
          <span className="text-xs font-black text-white leading-none drop-shadow-md">ACCESS</span>
        </div>
        <div className="absolute -top-1 -left-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg">
          <Trophy size={10} className="text-white" />
        </div>
      </motion.button>

      {/* Free Access Selection Modal */}
      <AnimatePresence>
        {showFreeAccessModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFreeAccessModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md glass rounded-3xl overflow-hidden shadow-2xl border border-white/20 p-6"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg rotate-3">
                  <Play className="text-white fill-white" size={32} />
                </div>
                <h2 className="text-2xl font-display font-bold text-white mb-2">Free Live Access</h2>
                <p className="text-white/60 text-sm">Select a stream to watch live for free without any subscription.</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {/* PSL Option */}
                <button
                  onClick={() => {
                    setSelectedPslLanguage('urdu');
                    setShowPSLPlayer(true);
                    setShowFreeAccessModal(false);
                  }}
                  className="group relative flex items-center gap-4 p-4 bg-white/5 hover:bg-green-600/20 border border-white/10 hover:border-green-500/50 rounded-2xl transition-all duration-300"
                >
                  <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center border border-green-500 shadow-lg group-hover:scale-110 transition-transform">
                    <span className="text-sm font-black text-white">PSL</span>
                  </div>
                  <div className="text-left">
                    <h4 className="text-white font-bold text-lg">PSL Live</h4>
                    <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Pakistan Super League</p>
                  </div>
                  <div className="ml-auto w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-green-500 transition-colors">
                    <ChevronRight className="text-white/40 group-hover:text-white" size={20} />
                  </div>
                </button>

                {/* IPL Option */}
                <button
                  onClick={() => {
                    setShowIPLPlayer(true);
                    setShowFreeAccessModal(false);
                  }}
                  className="group relative flex items-center gap-4 p-4 bg-white/5 hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/50 rounded-2xl transition-all duration-300"
                >
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-blue-600 shadow-lg group-hover:scale-110 transition-transform overflow-hidden p-1">
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/en/thumb/8/84/Indian_Premier_League_Official_Logo.svg/1200px-Indian_Premier_League_Official_Logo.svg.png" 
                      alt="IPL" 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="text-left">
                    <h4 className="text-white font-bold text-lg">IPL Live</h4>
                    <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Indian Premier League</p>
                  </div>
                  <div className="ml-auto w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                    <ChevronRight className="text-white/40 group-hover:text-white" size={20} />
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowFreeAccessModal(false)}
                className="mt-8 w-full py-3 text-white/40 hover:text-white font-bold text-sm transition-colors"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PSL Player Modal */}
      <AnimatePresence>
        {showPSLPlayer && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPSLPlayer(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-2xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[95vw] md:w-full md:max-w-5xl glass rounded-3xl overflow-hidden shadow-2xl border border-white/20 flex flex-col"
            >
              <div className="p-4 flex items-center justify-between border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center border border-green-500 shadow-lg shadow-green-600/20">
                    <span className="text-xs font-black text-white">PSL</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-bold text-white">PSL Live Stream</h3>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-[10px] text-white/60 uppercase tracking-widest font-bold">Live Now</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => isAdminLoggedIn ? setIsAdminLoggedIn(false) : setShowAdminLogin(true)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/20 hover:text-white/60"
                    title="Admin Settings"
                  >
                    <User size={16} />
                  </button>
                  <button 
                    onClick={() => setShowPSLPlayer(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {isAdminLoggedIn && (
                <div className="p-4 bg-cyan-500/10 border-b border-cyan-500/20 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Admin Panel: Manage {activeAdminTab.toUpperCase()}</span>
                      <span className="text-[9px] text-white/40">Logged in as: {currentUser?.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex bg-black/40 p-1 rounded-lg border border-white/10">
                        <button 
                          onClick={() => setActiveAdminTab('psl')}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeAdminTab === 'psl' ? 'bg-cyan-500 text-black' : 'text-white/60 hover:text-white'}`}
                        >
                          PSL
                        </button>
                        <button 
                          onClick={() => setActiveAdminTab('ipl')}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeAdminTab === 'ipl' ? 'bg-cyan-500 text-black' : 'text-white/60 hover:text-white'}`}
                        >
                          IPL
                        </button>
                      </div>
                      <button 
                        onClick={async () => {
                          await auth.signOut();
                          setIsAdminLoggedIn(false);
                        }}
                        className="text-[10px] text-white/40 hover:text-white underline"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {activeAdminTab === 'psl' && (
                      <>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={newPslUrlUrdu}
                            onChange={(e) => setNewPslUrlUrdu(e.target.value)}
                            placeholder="Enter new PSL Urdu .m3u8 URL"
                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={newPslUrlEnglish}
                            onChange={(e) => setNewPslUrlEnglish(e.target.value)}
                            placeholder="Enter new PSL English .m3u8 URL"
                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                      </>
                    )}
                    
                    {activeAdminTab === 'ipl' && (
                      <input 
                        type="text" 
                        value={newIplUrl}
                        onChange={(e) => setNewIplUrl(e.target.value)}
                        placeholder="Enter new IPL .m3u8 URL"
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                      />
                    )}

                    <button 
                      onClick={handleUpdateUrl}
                      className="w-full bg-cyan-500 hover:bg-cyan-400 text-black py-2 rounded-lg text-xs font-bold transition-colors"
                    >
                      Update Globally
                    </button>
                  </div>
                </div>
              )}

              <div className="relative w-full aspect-video bg-black overflow-hidden min-h-[220px] md:min-h-[400px]">
                {pslOptions.sources[0].src ? (
                  <VideoPlayer key={pslOptions.sources[0].src} options={pslOptions} />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm">
                    <Loader2 className="animate-spin text-cyan-500" size={40} />
                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Fetching Live Stream...</p>
                  </div>
                )}
                
                {/* Language Switcher Overlay */}
                <div className="absolute top-4 right-4 z-10 flex items-center gap-1 p-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-full">
                  <button 
                    onClick={() => setSelectedPslLanguage('urdu')}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                      selectedPslLanguage === 'urdu' 
                        ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20' 
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Urdu
                  </button>
                  <button 
                    onClick={() => setSelectedPslLanguage('english')}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                      selectedPslLanguage === 'english' 
                        ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20' 
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    English
                  </button>
                </div>
                
                {/* Live Indicator Overlay */}
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-full shadow-lg shadow-red-600/20">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Live</span>
                </div>
              </div>
              
              <div className="p-6 bg-yellow-500/10 border-t border-yellow-500/20 flex flex-col items-center justify-center gap-2">
                <p className="text-sm text-yellow-400 font-bold uppercase tracking-[0.2em] text-center">
                  Enjoy the match in {selectedPslLanguage === 'urdu' ? 'Urdu' : 'English'} with 4K•SJ Premium Experience
                </p>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">High Quality HLS Stream Enabled</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* IPL Player Modal */}
      <AnimatePresence>
        {showIPLPlayer && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowIPLPlayer(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-2xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[95vw] md:w-full md:max-w-5xl glass rounded-3xl overflow-hidden shadow-2xl border border-white/20 flex flex-col"
            >
              <div className="p-4 flex items-center justify-between border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-blue-600 shadow-lg shadow-white/10 overflow-hidden">
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/en/thumb/8/84/Indian_Premier_League_Official_Logo.svg/1200px-Indian_Premier_League_Official_Logo.svg.png" 
                      alt="IPL" 
                      className="w-full h-full object-contain p-1"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-bold text-white">IPL Live Stream</h3>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-[10px] text-white/60 uppercase tracking-widest font-bold">Live Now</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setActiveAdminTab('ipl');
                      isAdminLoggedIn ? setIsAdminLoggedIn(false) : setShowAdminLogin(true);
                    }}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/20 hover:text-white/60"
                    title="Admin Settings"
                  >
                    <User size={16} />
                  </button>
                  <button 
                    onClick={() => setShowIPLPlayer(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {isAdminLoggedIn && (
                <div className="p-4 bg-cyan-500/10 border-b border-cyan-500/20 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Admin Panel: Manage {activeAdminTab.toUpperCase()}</span>
                      <span className="text-[9px] text-white/40">Logged in as: {currentUser?.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex bg-black/40 p-1 rounded-lg border border-white/10">
                        <button 
                          onClick={() => setActiveAdminTab('psl')}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeAdminTab === 'psl' ? 'bg-cyan-500 text-black' : 'text-white/60 hover:text-white'}`}
                        >
                          PSL
                        </button>
                        <button 
                          onClick={() => setActiveAdminTab('ipl')}
                          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${activeAdminTab === 'ipl' ? 'bg-cyan-500 text-black' : 'text-white/60 hover:text-white'}`}
                        >
                          IPL
                        </button>
                      </div>
                      <button 
                        onClick={async () => {
                          await auth.signOut();
                          setIsAdminLoggedIn(false);
                        }}
                        className="text-[10px] text-white/40 hover:text-white underline"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {activeAdminTab === 'psl' && (
                      <>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={newPslUrlUrdu}
                            onChange={(e) => setNewPslUrlUrdu(e.target.value)}
                            placeholder="Enter new PSL Urdu .m3u8 URL"
                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={newPslUrlEnglish}
                            onChange={(e) => setNewPslUrlEnglish(e.target.value)}
                            placeholder="Enter new PSL English .m3u8 URL"
                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                      </>
                    )}
                    
                    {activeAdminTab === 'ipl' && (
                      <input 
                        type="text" 
                        value={newIplUrl}
                        onChange={(e) => setNewIplUrl(e.target.value)}
                        placeholder="Enter new IPL .m3u8 URL"
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                      />
                    )}

                    <button 
                      onClick={handleUpdateUrl}
                      className="w-full bg-cyan-500 hover:bg-cyan-400 text-black py-2 rounded-lg text-xs font-bold transition-colors"
                    >
                      Update Globally
                    </button>
                  </div>
                </div>
              )}

              <div className="relative w-full aspect-video bg-black overflow-hidden min-h-[220px] md:min-h-[400px]">
                {iplOptions.sources[0].src ? (
                  <VideoPlayer 
                    key={iplOptions.sources[0].src}
                    options={iplOptions}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm">
                    <Loader2 className="animate-spin text-blue-500" size={40} />
                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Fetching Live Stream...</p>
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-blue-600/10 border-t border-blue-600/20 flex flex-col items-center justify-center gap-2">
                <p className="text-sm text-blue-400 font-bold uppercase tracking-[0.2em] text-center">
                  Enjoy the match with 4K•SJ Premium Experience
                </p>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">High Quality HLS Stream Enabled</p>
              </div>
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
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Admin Login</h3>
                <button onClick={() => setShowAdminLogin(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
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

      {/* Footer */}
      <footer className="p-8 pb-24 md:pb-8 text-center border-t border-white/5 bg-black/20">
        <div className="mb-4">
          <h2 className="text-xl font-display font-black tracking-tighter italic">4K•SJ</h2>
          <p className="text-[10px] text-cyan-500 font-bold uppercase tracking-[0.3em] mt-1">Premium Experience</p>
        </div>
        <p className="text-white/20 text-[10px] font-medium uppercase tracking-[0.2em]">
          Powered by 4K•SJ Engine • Premium Content Delivery
        </p>
      </footer>
    </div>
  );
}
