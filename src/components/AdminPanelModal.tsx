import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Settings, Film, Tv, Radio, Users, MessageSquare, Plus, Trash2, Edit2, 
  Save, RefreshCw, Upload, Check, Copy, ExternalLink, Shield, Sparkles, Key, 
  Layers, Globe, CheckCircle2, AlertCircle, Search, Eye, Download, Smartphone, Flame, Loader2,
  BarChart3, Activity, TrendingUp, Calendar, Clock, ArrowUpRight, UserCheck, History, Play, Filter,
  CheckCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { doc, setDoc, addDoc, updateDoc, deleteDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { fetchTmdbDetailsById } from '../lib/tmdb';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  appSettings: any;
  setAppSettings: (settings: any) => void;
  freeMovies: any[];
  freeSeries: any[];
  liveEvents: any[];
  resellers: any[];
  mediaRequests?: any[];
  appDownloads?: any[];
  userActivities?: any[];
  mediaStats?: any[];
  playbackLogs?: any[];
  resellerVisits?: any[];
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  appSettings,
  setAppSettings,
  freeMovies,
  freeSeries,
  liveEvents,
  resellers,
  mediaRequests = [],
  appDownloads = [],
  userActivities = [],
  mediaStats = [],
  playbackLogs = [],
  resellerVisits = [],
}) => {
  const [activeTab, setActiveTab] = useState<'app' | 'analytics' | 'free_movies' | 'free_series' | 'live_events' | 'resellers' | 'requests' | 'apps'>('app');
  
  // Analytics State
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'most_watched' | 'resellers_traffic' | 'live_logs' | 'users'>('most_watched');
  const [analyticsCategoryFilter, setAnalyticsCategoryFilter] = useState<'all' | 'movie' | 'series' | 'live_event'>('all');
  const [analyticsSearchQuery, setAnalyticsSearchQuery] = useState('');
  const [expandedUsersId, setExpandedUsersId] = useState<string | null>(null);
  const [selectedMediaViewers, setSelectedMediaViewers] = useState<{ title: string; category: string; views: number; users: string[] } | null>(null);

  // Helper to calculate total views, viewers count, and viewers list for any movie, series, or live event
  const getMediaViewsInfo = (item: any, category: 'movie' | 'series' | 'live_event') => {
    const directId = item.id ? String(item.id).toLowerCase() : '';
    const tmdbId = item.tmdb_id ? String(item.tmdb_id).toLowerCase() : '';
    const rawName = (item.name || item.title || '').trim().toLowerCase();

    let totalPlays = 0;
    const userSet = new Set<string>();
    let lastPlayedTime: string | null = null;

    mediaStats.forEach((st: any) => {
      if (st.category !== category) return;
      const sItemId = String(st.itemId || '').toLowerCase();
      const sItemName = String(st.itemName || '').trim().toLowerCase();

      const isMatch =
        (directId && (sItemId === directId || sItemId === `${category}_${directId}`)) ||
        (tmdbId && (sItemId === tmdbId || sItemId === `${category}_${tmdbId}`)) ||
        (rawName && (sItemName === rawName || sItemName.startsWith(rawName) || rawName.startsWith(sItemName)));

      if (isMatch) {
        totalPlays += (Number(st.totalPlays) || 0);
        if (st.users && typeof st.users === 'object') {
          Object.keys(st.users).forEach((u) => {
            if (u && u !== 'null' && u !== 'undefined' && u !== 'anonymous') userSet.add(u);
          });
        }
        if (st.lastPlayed) {
          if (!lastPlayedTime || new Date(st.lastPlayed) > new Date(lastPlayedTime)) {
            lastPlayedTime = st.lastPlayed;
          }
        }
      }
    });

    const directCount = Number(item.views || item.watch_count || 0);
    if (directCount > totalPlays) {
      totalPlays = directCount;
    }

    const usersList = Array.from(userSet);

    return {
      views: totalPlays,
      usersCount: usersList.length,
      usersList,
      lastPlayed: lastPlayedTime
    };
  };
  
  // App Settings state
  const [currentAppSettings, setCurrentAppSettings] = useState({ ...appSettings });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Movie Form State
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null);
  const [movieForm, setMovieForm] = useState({
    tmdb_id: '',
    name: '',
    poster_url: '',
    play_url: '',
    download_url: '',
    is_embed: false,
    is_webpage: false,
    iframe_cropping: false,
    show_live_viewer_count: false,
    password: '',
    available_for_resellers: true,
    expires_at: '',
    duration_days: 'none' // 'none', '1', '2', '3', '4', '7', '14', '30', 'custom'
  });
  const [isFetchingMovieTmdb, setIsFetchingMovieTmdb] = useState(false);
  const [movieSearchQuery, setMovieSearchQuery] = useState('');

  // Series Form State
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [seriesForm, setSeriesForm] = useState({
    tmdb_id: '',
    name: '',
    poster_url: '',
    play_url: '',
    download_url: '',
    playlist_url: '',
    is_embed: false,
    is_webpage: false,
    iframe_cropping: false,
    show_live_viewer_count: false,
    password: '',
    available_for_resellers: true,
    expires_at: '',
    duration_days: 'none',
    episodes: [] as Array<{ id: string; season: string; episode_num: string; title: string; play_url: string; download_url?: string }>
  });
  const [isFetchingSeriesTmdb, setIsFetchingSeriesTmdb] = useState(false);
  const [manualEpisode, setManualEpisode] = useState({ season: '1', episode_num: '1', title: '', play_url: '', download_url: '' });
  const [seriesSearchQuery, setSeriesSearchQuery] = useState('');

  // Live Event Form State
  const [editingLiveEventId, setEditingLiveEventId] = useState<string | null>(null);
  const [liveEventForm, setLiveEventForm] = useState<{
    name: string;
    poster_url: string;
    available_for_resellers: boolean;
    channels: Array<{ 
      name: string; 
      play_url: string; 
      is_embed?: boolean; 
      is_mpd?: boolean; 
      is_webpage?: boolean; 
      sandbox_disabled?: boolean; 
      iframe_cropping?: boolean; 
      show_live_viewer_count?: boolean; 
      drm_license_url?: string;
    }>;
  }>({
    name: '',
    poster_url: '',
    available_for_resellers: true,
    channels: [{ name: 'Urdu', play_url: '', is_embed: false, is_mpd: false, is_webpage: false, sandbox_disabled: false, iframe_cropping: false, show_live_viewer_count: false }]
  });

  // Reseller Form State
  const [editingResellerId, setEditingResellerId] = useState<string | null>(null);
  const [resellerForm, setResellerForm] = useState({
    subdomain: '',
    brand_name: '',
    tagline: '',
    whatsapp_number: '',
    whatsapp_group_link: '',
    whatsapp_channel_link: '',
    logo_url: '',
    server_url: '',
    download_url: '',
    proxy_url: '',
    app_link: '',
    password: '',
    license_type: '1 Year'
  });

  // App Downloads Form State
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [appForm, setAppForm] = useState({
    name: '',
    logo_url: '',
    download_url: '',
    downloader_code: '',
    version: '',
    description: '',
    device_type: 'android_tv',
    is_default: true,
    allowed_reseller_ids: [] as string[]
  });
  const [isSavingApp, setIsSavingApp] = useState(false);
  const [appSaveMsg, setAppSaveMsg] = useState<string | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Save Global Settings
  const handleSaveGlobalSettings = async () => {
    setIsSavingSettings(true);
    try {
      const docRef = doc(db, 'settings', 'app');
      await setDoc(docRef, { ...currentAppSettings, updatedAt: new Date().toISOString() });
      setAppSettings(currentAppSettings);
      setSaveSuccessMsg('App settings successfully updated globally!');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error('Settings update error:', err);
      alert('Failed to update settings: ' + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // TMDB fetch for movie
  const handleFetchMovieTmdb = async () => {
    if (!movieForm.tmdb_id?.trim()) {
      alert('Please enter a TMDB ID first');
      return;
    }
    setIsFetchingMovieTmdb(true);
    try {
      const details = await fetchTmdbDetailsById(movieForm.tmdb_id.trim(), false);
      if (details) {
        setMovieForm(prev => ({
          ...prev,
          name: details.name || prev.name,
          poster_url: details.poster_url || prev.poster_url
        }));
      } else {
        alert('No details found on TMDB for this ID.');
      }
    } catch (e) {
      alert('Error fetching from TMDB.');
    } finally {
      setIsFetchingMovieTmdb(false);
    }
  };

  // TMDB fetch for series
  const handleFetchSeriesTmdb = async () => {
    if (!seriesForm.tmdb_id?.trim()) {
      alert('Please enter a TMDB ID first');
      return;
    }
    setIsFetchingSeriesTmdb(true);
    try {
      const details = await fetchTmdbDetailsById(seriesForm.tmdb_id.trim(), true);
      if (details) {
        setSeriesForm(prev => ({
          ...prev,
          name: details.name || prev.name,
          poster_url: details.poster_url || prev.poster_url
        }));
      } else {
        alert('No details found on TMDB for this ID.');
      }
    } catch (e) {
      alert('Error fetching from TMDB.');
    } finally {
      setIsFetchingSeriesTmdb(false);
    }
  };

  // Add / Edit Movie
  const handleSaveMovie = async () => {
    if (!movieForm.name || !movieForm.poster_url || !movieForm.play_url) {
      alert('Please fill Name, Poster URL, and Play URL.');
      return;
    }
    try {
      let finalExpiresAt = movieForm.expires_at || '';
      
      // Calculate expires_at if duration_days preset was selected
      if (movieForm.duration_days && movieForm.duration_days !== 'none' && movieForm.duration_days !== 'custom') {
        const days = parseFloat(movieForm.duration_days);
        if (!isNaN(days) && days > 0) {
          finalExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        }
      } else if (movieForm.duration_days === 'none') {
        finalExpiresAt = '';
      }

      const moviePayload = {
        ...movieForm,
        expires_at: finalExpiresAt
      };

      if (editingMovieId) {
        await updateDoc(doc(db, 'free_movies', editingMovieId), {
          ...moviePayload,
          updatedAt: new Date().toISOString()
        });
        setEditingMovieId(null);
      } else {
        await addDoc(collection(db, 'free_movies'), {
          ...moviePayload,
          createdAt: new Date().toISOString()
        });
      }
      setMovieForm({
        tmdb_id: '',
        name: '',
        poster_url: '',
        play_url: '',
        download_url: '',
        is_embed: false,
        is_webpage: false,
        iframe_cropping: false,
        show_live_viewer_count: false,
        password: '',
        available_for_resellers: true,
        expires_at: '',
        duration_days: 'none'
      });
      alert(editingMovieId ? 'Movie updated!' : 'Movie added!');
    } catch (err: any) {
      alert('Failed to save movie: ' + err.message);
    }
  };

  const handleEditMovieClick = (movie: any) => {
    setEditingMovieId(movie.id);
    let durationSetting = movie.duration_days || (movie.expires_at ? 'custom' : 'none');
    setMovieForm({
      tmdb_id: movie.tmdb_id || '',
      name: movie.name || '',
      poster_url: movie.poster_url || '',
      play_url: movie.play_url || '',
      download_url: movie.download_url || '',
      is_embed: !!movie.is_embed,
      is_webpage: !!movie.is_webpage,
      iframe_cropping: !!movie.iframe_cropping,
      show_live_viewer_count: !!movie.show_live_viewer_count,
      password: movie.password || '',
      available_for_resellers: movie.available_for_resellers !== false,
      expires_at: movie.expires_at || '',
      duration_days: durationSetting
    });
  };

  const handleDeleteMovieClick = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this movie?')) return;
    try {
      await deleteDoc(doc(db, 'free_movies', id));
    } catch (err: any) {
      alert('Failed to delete movie: ' + err.message);
    }
  };

  // Add / Edit Series
  const handleAddManualEpisode = () => {
    if (!manualEpisode.play_url) {
      alert('Episode play URL is required');
      return;
    }
    const episodeNum = manualEpisode.episode_num || '1';
    const seasonVal = manualEpisode.season || '1';
    const titleVal = manualEpisode.title.trim() || `Episode ${episodeNum}`;
    const newEpId = `ep_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    const newEp = {
      id: newEpId,
      season: seasonVal,
      episode_num: episodeNum,
      title: titleVal,
      play_url: manualEpisode.play_url.trim(),
      download_url: manualEpisode.download_url?.trim() || ''
    };
    
    const updatedEpisodes = [...(seriesForm.episodes || []), newEp];
    updatedEpisodes.sort((a, b) => {
      const sA = Number(a.season) || 1;
      const sB = Number(b.season) || 1;
      if (sA !== sB) return sA - sB;
      return (Number(a.episode_num) || 1) - (Number(b.episode_num) || 1);
    });
    
    setSeriesForm({ ...seriesForm, episodes: updatedEpisodes });
    const nextEpNum = (Number(episodeNum) + 1).toString();
    setManualEpisode({
      season: seasonVal,
      episode_num: nextEpNum,
      title: '',
      play_url: '',
      download_url: ''
    });
  };

  const handleRemoveManualEpisode = (epId: string) => {
    setSeriesForm({
      ...seriesForm,
      episodes: (seriesForm.episodes || []).filter(ep => ep.id !== epId)
    });
  };

  const handleSaveSeries = async () => {
    const hasManualEpisodes = seriesForm.episodes && seriesForm.episodes.length > 0;
    if (!seriesForm.name || !seriesForm.poster_url || (!seriesForm.play_url && !seriesForm.playlist_url && !hasManualEpisodes)) {
      alert('Please fill Name, Poster URL, and either Streaming Link, Playlist M3U URL, or at least 1 Manual Episode');
      return;
    }
    try {
      let finalExpiresAt = seriesForm.expires_at || '';
      
      // Calculate expires_at if duration_days preset was selected
      if (seriesForm.duration_days && seriesForm.duration_days !== 'none' && seriesForm.duration_days !== 'custom') {
        const days = parseFloat(seriesForm.duration_days);
        if (!isNaN(days) && days > 0) {
          finalExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        }
      } else if (seriesForm.duration_days === 'none') {
        finalExpiresAt = '';
      }

      const finalSeries = {
        ...seriesForm,
        expires_at: finalExpiresAt,
        episodes: (seriesForm.playlist_url && seriesForm.playlist_url.trim() !== '') ? [] : seriesForm.episodes
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
      setSeriesForm({
        tmdb_id: '',
        name: '',
        poster_url: '',
        play_url: '',
        download_url: '',
        playlist_url: '',
        is_embed: false,
        is_webpage: false,
        iframe_cropping: false,
        show_live_viewer_count: false,
        password: '',
        available_for_resellers: true,
        expires_at: '',
        duration_days: 'none',
        episodes: []
      });
      alert(editingSeriesId ? 'Series updated!' : 'Series added!');
    } catch (err: any) {
      alert('Failed to save series: ' + err.message);
    }
  };

  const handleEditSeriesClick = (series: any) => {
    setEditingSeriesId(series.id);
    let durationSetting = series.duration_days || (series.expires_at ? 'custom' : 'none');
    setSeriesForm({
      tmdb_id: series.tmdb_id || '',
      name: series.name || '',
      poster_url: series.poster_url || '',
      play_url: series.play_url || '',
      download_url: series.download_url || '',
      playlist_url: series.playlist_url || '',
      is_embed: !!series.is_embed,
      is_webpage: !!series.is_webpage,
      iframe_cropping: !!series.iframe_cropping,
      show_live_viewer_count: !!series.show_live_viewer_count,
      password: series.password || '',
      available_for_resellers: series.available_for_resellers !== false,
      expires_at: series.expires_at || '',
      duration_days: durationSetting,
      episodes: Array.isArray(series.episodes) ? series.episodes : []
    });
  };

  const handleDeleteSeriesClick = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this series?')) return;
    try {
      await deleteDoc(doc(db, 'free_series', id));
    } catch (err: any) {
      alert('Failed to delete series: ' + err.message);
    }
  };

  // Add / Edit Live Event
  const handleSaveLiveEvent = async () => {
    if (!liveEventForm.name || !liveEventForm.poster_url) {
      alert('Please fill Event Name and Poster URL');
      return;
    }
    const validChannels = liveEventForm.channels.filter(ch => ch.play_url && ch.play_url.trim() !== '');
    if (validChannels.length === 0) {
      alert('Please add at least one channel with a stream link.');
      return;
    }
    try {
      if (editingLiveEventId) {
        await updateDoc(doc(db, 'live_events', editingLiveEventId), {
          name: liveEventForm.name,
          poster_url: liveEventForm.poster_url,
          channels: validChannels,
          available_for_resellers: liveEventForm.available_for_resellers !== false,
          updatedAt: new Date().toISOString()
        });
        setEditingLiveEventId(null);
      } else {
        await addDoc(collection(db, 'live_events'), {
          name: liveEventForm.name,
          poster_url: liveEventForm.poster_url,
          channels: validChannels,
          available_for_resellers: liveEventForm.available_for_resellers !== false,
          createdAt: new Date().toISOString()
        });
      }
      setLiveEventForm({
        name: '',
        poster_url: '',
        available_for_resellers: true,
        channels: [{ name: 'Urdu', play_url: '', is_embed: false, is_mpd: false, is_webpage: false, sandbox_disabled: false, iframe_cropping: false, show_live_viewer_count: false }]
      });
      alert(editingLiveEventId ? 'Live Event updated!' : 'Live Event added!');
    } catch (err: any) {
      alert('Failed to save live event: ' + err.message);
    }
  };

  const handleEditLiveEventClick = (event: any) => {
    setEditingLiveEventId(event.id);
    setLiveEventForm({
      name: event.name || '',
      poster_url: event.poster_url || '',
      available_for_resellers: event.available_for_resellers !== false,
      channels: Array.isArray(event.channels) && event.channels.length > 0 
        ? event.channels 
        : [{ name: 'Urdu', play_url: '', is_embed: false, is_mpd: false, is_webpage: false, sandbox_disabled: false, iframe_cropping: false, show_live_viewer_count: false }]
    });
  };

  const handleDeleteLiveEventClick = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this live event?')) return;
    try {
      await deleteDoc(doc(db, 'live_events', id));
    } catch (err: any) {
      alert('Failed to delete live event: ' + err.message);
    }
  };

  // Add / Edit Reseller
  const handleSaveReseller = async () => {
    if (!resellerForm.subdomain || !resellerForm.brand_name) {
      alert('Please fill Subdomain Keyword and Brand Name');
      return;
    }
    try {
      if (editingResellerId) {
        await updateDoc(doc(db, 'resellers', editingResellerId), {
          ...resellerForm,
          updatedAt: new Date().toISOString()
        });
        setEditingResellerId(null);
      } else {
        await addDoc(collection(db, 'resellers'), {
          ...resellerForm,
          createdAt: new Date().toISOString()
        });
      }
      setResellerForm({
        subdomain: '',
        brand_name: '',
        tagline: '',
        whatsapp_number: '',
        whatsapp_group_link: '',
        whatsapp_channel_link: '',
        logo_url: '',
        server_url: '',
        download_url: '',
        proxy_url: '',
        app_link: '',
        password: '',
        license_type: '1 Year'
      });
      alert(editingResellerId ? 'Reseller updated!' : 'Reseller license created!');
    } catch (err: any) {
      alert('Failed to save reseller: ' + err.message);
    }
  };

  const handleEditResellerClick = (r: any) => {
    setEditingResellerId(r.id);
    setResellerForm({
      subdomain: r.subdomain || '',
      brand_name: r.brand_name || '',
      tagline: r.tagline || '',
      whatsapp_number: r.whatsapp_number || '',
      whatsapp_group_link: r.whatsapp_group_link || '',
      whatsapp_channel_link: r.whatsapp_channel_link || '',
      logo_url: r.logo_url || '',
      server_url: r.server_url || '',
      download_url: r.download_url || '',
      proxy_url: r.proxy_url || '',
      app_link: r.app_link || '',
      password: r.password || '',
      license_type: r.license_type || '1 Year'
    });
  };

  const handleDeleteResellerClick = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this reseller?')) return;
    try {
      await deleteDoc(doc(db, 'resellers', id));
    } catch (err: any) {
      alert('Failed to delete reseller: ' + err.message);
    }
  };

  // Media requests
  const handleDeleteRequest = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this request?')) return;
    try {
      await deleteDoc(doc(db, 'media_requests', id));
    } catch (err: any) {
      alert('Failed to delete request: ' + err.message);
    }
  };

  const handleQuickAddMovieFromRequest = (req: any) => {
    setActiveTab('free_movies');
    setMovieForm(prev => ({
      ...prev,
      tmdb_id: req.tmdbId ? String(req.tmdbId) : '',
      name: req.title || '',
      poster_url: req.posterUrl || ''
    }));
  };

  const handleQuickAddSeriesFromRequest = (req: any) => {
    setActiveTab('free_series');
    setSeriesForm(prev => ({
      ...prev,
      tmdb_id: req.tmdbId ? String(req.tmdbId) : '',
      name: req.title || '',
      poster_url: req.posterUrl || ''
    }));
  };

  // App Downloads CRUD
  const handleSaveApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appForm.name.trim() || !appForm.download_url.trim()) {
      alert('Please provide both Application Name and Download URL.');
      return;
    }
    setIsSavingApp(true);
    try {
      if (editingAppId) {
        await updateDoc(doc(db, 'app_downloads', editingAppId), {
          ...appForm,
          name: appForm.name.trim(),
          download_url: appForm.download_url.trim(),
          downloader_code: appForm.downloader_code.trim(),
          updatedAt: new Date().toISOString()
        });
        setAppSaveMsg('Application updated successfully!');
      } else {
        await addDoc(collection(db, 'app_downloads'), {
          ...appForm,
          name: appForm.name.trim(),
          download_url: appForm.download_url.trim(),
          downloader_code: appForm.downloader_code.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        setAppSaveMsg('Application added successfully!');
      }
      setTimeout(() => setAppSaveMsg(null), 3000);
      setEditingAppId(null);
      setAppForm({
        name: '',
        logo_url: '',
        download_url: '',
        downloader_code: '',
        version: '',
        description: '',
        device_type: 'android_tv',
        is_default: true,
        allowed_reseller_ids: []
      });
    } catch (err: any) {
      console.error('Error saving app download:', err);
      alert('Failed to save application: ' + err.message);
    } finally {
      setIsSavingApp(false);
    }
  };

  const handleEditApp = (app: any) => {
    setEditingAppId(app.id);
    setAppForm({
      name: app.name || '',
      logo_url: app.logo_url || '',
      download_url: app.download_url || '',
      downloader_code: app.downloader_code || '',
      version: app.version || '',
      description: app.description || '',
      device_type: app.device_type || 'android_tv',
      is_default: app.is_default !== false,
      allowed_reseller_ids: Array.isArray(app.allowed_reseller_ids) ? app.allowed_reseller_ids : []
    });
  };

  const handleDeleteApp = async (appId: string) => {
    if (!confirm('Are you sure you want to delete this application?')) return;
    try {
      await deleteDoc(doc(db, 'app_downloads', appId));
    } catch (err: any) {
      console.error('Error deleting application:', err);
      alert('Failed to delete application: ' + err.message);
    }
  };

  const handleCancelEditApp = () => {
    setEditingAppId(null);
    setAppForm({
      name: '',
      logo_url: '',
      download_url: '',
      downloader_code: '',
      version: '',
      description: '',
      device_type: 'android_tv',
      is_default: true,
      allowed_reseller_ids: []
    });
  };

  const toggleResellerForApp = (resellerId: string, subdomain?: string) => {
    setAppForm(prev => {
      const idsToCheck = [resellerId, subdomain].filter(Boolean) as string[];
      const exists = idsToCheck.some(id => prev.allowed_reseller_ids.includes(id));
      return {
        ...prev,
        allowed_reseller_ids: exists
          ? prev.allowed_reseller_ids.filter(id => !idsToCheck.includes(id))
          : Array.from(new Set([...prev.allowed_reseller_ids, ...idsToCheck]))
      };
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-xl"
      />

      {/* Main Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-6xl h-[92vh] max-h-[900px] bg-[#0c0d12] border border-cyan-500/30 rounded-2xl md:rounded-[2rem] shadow-[0_0_60px_rgba(6,182,212,0.2)] flex flex-col overflow-hidden text-white z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10 bg-slate-900/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              <Shield size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-xl font-black tracking-tight text-white uppercase">
                  Admin Master Control
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[9px] font-black tracking-wider uppercase">
                  Super Admin
                </span>
              </div>
              <p className="text-[11px] text-white/50">
                Manage global settings, content databases, live events & resellers
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 text-white/70 transition-all border border-white/10 cursor-pointer"
            title="Close Admin Panel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 px-3 sm:px-6 py-2.5 bg-black/40 border-b border-white/5 overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'app', label: 'App Settings', icon: Settings, count: null },
            { id: 'analytics', label: 'Watch & Traffic Analytics', icon: BarChart3, count: mediaStats.length },
            { id: 'free_movies', label: 'Free Movies', icon: Film, count: freeMovies.length },
            { id: 'free_series', label: 'Web Series', icon: Tv, count: freeSeries.length },
            { id: 'live_events', label: 'Live Events', icon: Radio, count: liveEvents.length },
            { id: 'resellers', label: 'Resellers', icon: Users, count: resellers.length },
            { id: 'apps', label: 'App Downloads', icon: Download, count: appDownloads.length },
            { id: 'requests', label: 'User Requests', icon: MessageSquare, count: mediaRequests.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] border border-cyan-400/40'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-white' : 'text-cyan-400/70'} />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-black/30 text-white' : 'bg-white/10 text-white/60'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* TAB 1: GLOBAL APP SETTINGS */}
          {activeTab === 'app' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {saveSuccessMsg && (
                <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* Module Toggles */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Layers size={16} />
                  <span>Feature Module Visibility</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: 'free_movies_enabled', label: 'Free Movies Hub', desc: 'Enable free movie section' },
                    { key: 'free_series_enabled', label: 'Web Series Hub', desc: 'Enable free series section' },
                    { key: 'live_events_enabled', label: 'Live Events Hub', desc: 'Enable live cricket/sports' },
                    { key: 'anti_popup_enabled', label: 'Anti-Popup AdBlock', desc: 'Auto block popups on embeds' },
                  ].map((item) => (
                    <label
                      key={item.key}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                        currentAppSettings[item.key]
                          ? 'bg-cyan-500/10 border-cyan-500/40 text-white'
                          : 'bg-white/5 border-white/10 text-white/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold">{item.label}</span>
                        <input
                          type="checkbox"
                          checked={!!currentAppSettings[item.key]}
                          onChange={(e) =>
                            setCurrentAppSettings({
                              ...currentAppSettings,
                              [item.key]: e.target.checked
                            })
                          }
                          className="w-4 h-4 rounded text-cyan-500 focus:ring-0 cursor-pointer accent-cyan-500"
                        />
                      </div>
                      <span className="text-[10px] text-white/40">{item.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Titles and Display Labels */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Film size={16} />
                  <span>Section Titles & Badges</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-white/70 uppercase">Free Movies Title</label>
                    <input
                      type="text"
                      value={currentAppSettings.free_movies_title || ''}
                      onChange={(e) => setCurrentAppSettings({ ...currentAppSettings, free_movies_title: e.target.value })}
                      placeholder="FREE CINEMA"
                      className="w-full mt-1.5 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-white/70 uppercase">Web Series Title</label>
                    <input
                      type="text"
                      value={currentAppSettings.free_series_title || ''}
                      onChange={(e) => setCurrentAppSettings({ ...currentAppSettings, free_series_title: e.target.value })}
                      placeholder="WEB SERIES"
                      className="w-full mt-1.5 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-white/70 uppercase">Live Events Title</label>
                    <input
                      type="text"
                      value={currentAppSettings.live_events_title || ''}
                      onChange={(e) => setCurrentAppSettings({ ...currentAppSettings, live_events_title: e.target.value })}
                      placeholder="LIVE EVENTS"
                      className="w-full mt-1.5 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-cyan-400 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Server URLs & Download Links */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Globe size={16} />
                  <span>Default Server URLs & App Downloads</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-white/70 uppercase">Default Xtream Server URL</label>
                    <input
                      type="text"
                      value={currentAppSettings.default_server_url || ''}
                      onChange={(e) => setCurrentAppSettings({ ...currentAppSettings, default_server_url: e.target.value })}
                      placeholder="http://server.example.com:8080"
                      className="w-full mt-1.5 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-white/70 uppercase">Default Download URL</label>
                    <input
                      type="text"
                      value={currentAppSettings.default_download_url || ''}
                      onChange={(e) => setCurrentAppSettings({ ...currentAppSettings, default_download_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full mt-1.5 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-white/70 uppercase">WhatsApp Group Link</label>
                    <input
                      type="text"
                      value={currentAppSettings.whatsapp_group_link || ''}
                      onChange={(e) => setCurrentAppSettings({ ...currentAppSettings, whatsapp_group_link: e.target.value })}
                      placeholder="https://chat.whatsapp.com/..."
                      className="w-full mt-1.5 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-white/70 uppercase">WhatsApp Channel Link</label>
                    <input
                      type="text"
                      value={currentAppSettings.whatsapp_channel_link || ''}
                      onChange={(e) => setCurrentAppSettings({ ...currentAppSettings, whatsapp_channel_link: e.target.value })}
                      placeholder="https://whatsapp.com/channel/..."
                      className="w-full mt-1.5 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[11px] font-bold text-white/70 uppercase flex items-center justify-between">
                      <span>Video Stream Proxy URL (Auto-applied to all active users)</span>
                      <span className="text-cyan-400 font-medium text-[10px] uppercase tracking-wider">Live Real-time Sync</span>
                    </label>
                    <input
                      type="text"
                      value={currentAppSettings.default_proxy_url || ''}
                      onChange={(e) => setCurrentAppSettings({ ...currentAppSettings, default_proxy_url: e.target.value })}
                      placeholder="https://lb3.hdsj.store:2053/?url="
                      className="w-full mt-1.5 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-cyan-400 outline-none font-mono"
                    />
                    <p className="text-[10px] text-white/40 mt-1">Jab bhi aap naya server URL ya proxy URL update karenge, sabhi users (chahe wo pehle se login hon) ke paas bina logout kiye foran live apply ho jayega.</p>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSaveGlobalSettings}
                  disabled={isSavingSettings}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer disabled:opacity-50"
                >
                  {isSavingSettings ? <RefreshCw className="animate-spin" size={16} /> : <Save size={16} />}
                  <span>Save App Settings Globally</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: WATCH & TRAFFIC ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* KPI Counters Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Total Media Views */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900/60 to-slate-950/80 border border-cyan-500/30 flex flex-col justify-between relative overflow-hidden group shadow-lg">
                  <div className="absolute top-0 right-0 p-3 opacity-15 text-cyan-400 group-hover:opacity-25 transition-opacity">
                    <Play size={44} />
                  </div>
                  <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
                    <TrendingUp size={15} />
                    <span>Total Stream Plays</span>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-white">
                      {mediaStats.reduce((acc, curr) => acc + (Number(curr.totalPlays) || 0), 0).toLocaleString()}
                    </div>
                    <p className="text-[10px] text-white/50 mt-1">Across all movies, series & events</p>
                  </div>
                </div>

                {/* 2. Reseller Today Visits */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-slate-950/80 border border-emerald-500/30 flex flex-col justify-between relative overflow-hidden group shadow-lg">
                  <div className="absolute top-0 right-0 p-3 opacity-15 text-emerald-400 group-hover:opacity-25 transition-opacity">
                    <Activity size={44} />
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                    <Activity size={15} className="animate-pulse" />
                    <span>Reseller Today Visits</span>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-400">
                      {resellerVisits.reduce((acc, curr) => {
                        const todayStr = new Date().toISOString().split('T')[0];
                        const todayCount = (curr.todayDate === todayStr) ? (Number(curr.todayVisits) || 0) : 0;
                        return acc + todayCount;
                      }, 0).toLocaleString()}
                    </div>
                    <p className="text-[10px] text-white/50 mt-1">Daily active domain traffic</p>
                  </div>
                </div>

                {/* 3. Reseller Total Visits */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-950/40 via-slate-900/60 to-slate-950/80 border border-blue-500/30 flex flex-col justify-between relative overflow-hidden group shadow-lg">
                  <div className="absolute top-0 right-0 p-3 opacity-15 text-blue-400 group-hover:opacity-25 transition-opacity">
                    <Globe size={44} />
                  </div>
                  <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
                    <Globe size={15} />
                    <span>Total Reseller Visits</span>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-cyan-300">
                      {resellerVisits.reduce((acc, curr) => acc + (Number(curr.totalVisits) || 0), 0).toLocaleString()}
                    </div>
                    <p className="text-[10px] text-white/50 mt-1">Kul visits across all portals</p>
                  </div>
                </div>

                {/* 4. Active User Accounts */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900/60 to-slate-950/80 border border-purple-500/30 flex flex-col justify-between relative overflow-hidden group shadow-lg">
                  <div className="absolute top-0 right-0 p-3 opacity-15 text-purple-400 group-hover:opacity-25 transition-opacity">
                    <Users size={44} />
                  </div>
                  <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">
                    <Users size={15} />
                    <span>Active Users</span>
                  </div>
                  <div>
                    <div className="text-2xl sm:text-3xl font-black text-purple-300">
                      {userActivities.length.toLocaleString()}
                    </div>
                    <p className="text-[10px] text-white/50 mt-1">Logged-in user profiles</p>
                  </div>
                </div>
              </div>

              {/* Sub-Tab Navigation Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-black/40 border border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setAnalyticsSubTab('most_watched')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                      analyticsSubTab === 'most_watched'
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                        : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Flame size={14} className={analyticsSubTab === 'most_watched' ? 'text-amber-300' : 'text-white/40'} />
                    <span>Most Watched & Viewers</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px]">{mediaStats.length}</span>
                  </button>

                  <button
                    onClick={() => setAnalyticsSubTab('resellers_traffic')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                      analyticsSubTab === 'resellers_traffic'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                        : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Globe size={14} className={analyticsSubTab === 'resellers_traffic' ? 'text-emerald-300' : 'text-white/40'} />
                    <span>Reseller Traffic (Domains)</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px]">{resellers.length}</span>
                  </button>

                  <button
                    onClick={() => setAnalyticsSubTab('live_logs')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                      analyticsSubTab === 'live_logs'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                        : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <History size={14} className={analyticsSubTab === 'live_logs' ? 'text-pink-300' : 'text-white/40'} />
                    <span>Recent Watch History</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px]">{playbackLogs.length}</span>
                  </button>

                  <button
                    onClick={() => setAnalyticsSubTab('users')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                      analyticsSubTab === 'users'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                        : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <UserCheck size={14} className={analyticsSubTab === 'users' ? 'text-amber-300' : 'text-white/40'} />
                    <span>User Accounts</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px]">{userActivities.length}</span>
                  </button>
                </div>

                {/* Search Bar for Analytics */}
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={analyticsSearchQuery}
                    onChange={(e) => setAnalyticsSearchQuery(e.target.value)}
                    placeholder="Search by title, domain, user..."
                    className="w-full pl-9 pr-3 py-1.5 bg-black/50 border border-white/15 rounded-xl text-xs text-white placeholder-white/40 focus:border-cyan-400 outline-none"
                  />
                </div>
              </div>

              {/* SUB-PANEL 1: MOST WATCHED MEDIA & VIEWERS */}
              {analyticsSubTab === 'most_watched' && (
                <div className="space-y-4">
                  {/* Category Filter Chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: 'all', label: 'All Content' },
                      { id: 'movie', label: 'Movies' },
                      { id: 'series', label: 'Web Series' },
                      { id: 'live_event', label: 'Live Events & TV' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setAnalyticsCategoryFilter(f.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          analyticsCategoryFilter === f.id
                            ? 'bg-cyan-500 text-black font-black shadow-md'
                            : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* List / Cards of Most Watched Content */}
                  {(() => {
                    const filtered = mediaStats
                      .filter((st) => {
                        if (analyticsCategoryFilter !== 'all' && st.category !== analyticsCategoryFilter) return false;
                        if (!analyticsSearchQuery) return true;
                        const q = analyticsSearchQuery.toLowerCase();
                        const titleMatch = (st.itemName || '').toLowerCase().includes(q);
                        const userKeys = st.users ? Object.keys(st.users) : [];
                        const userMatch = userKeys.some((u) => u.toLowerCase().includes(q));
                        return titleMatch || userMatch;
                      })
                      .sort((a, b) => (Number(b.totalPlays) || 0) - (Number(a.totalPlays) || 0));

                    if (filtered.length === 0) {
                      return (
                        <div className="p-8 text-center rounded-2xl bg-white/5 border border-white/10 space-y-2">
                          <Eye size={32} className="mx-auto text-white/30" />
                          <p className="text-sm font-bold text-white/60">No media playback stats found</p>
                          <p className="text-xs text-white/40">Watch count will automatically appear here when users play movies, web series, or live TV events.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {filtered.map((st, index) => {
                          const usersMap = st.users && typeof st.users === 'object' ? st.users : {};
                          const usersList = Object.keys(usersMap).filter((u) => u && u !== 'null' && u !== 'undefined' && u !== 'anonymous');
                          const isExpanded = expandedUsersId === (st.itemId || index.toString());

                          // Rank styles
                          let rankBadgeClass = "bg-white/10 text-white/70 border-white/15";
                          if (index === 0) rankBadgeClass = "bg-amber-400 text-black border-amber-300 font-black shadow-[0_0_12px_rgba(251,191,36,0.5)]";
                          else if (index === 1) rankBadgeClass = "bg-slate-300 text-black border-slate-200 font-black";
                          else if (index === 2) rankBadgeClass = "bg-amber-700 text-white border-amber-600 font-black";

                          return (
                            <div
                              key={st.itemId || index}
                              className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-cyan-500/40 transition-all space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  {/* Rank Badge */}
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs border shrink-0 ${rankBadgeClass}`}>
                                    #{index + 1}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <h5 className="text-sm font-black text-white truncate">{st.itemName || 'Untitled Media'}</h5>
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 ${
                                        st.category === 'movie' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                                        st.category === 'series' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                                        'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                      }`}>
                                        {st.category === 'movie' ? 'Movie' : st.category === 'series' ? 'Web Series' : 'Live Event'}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-white/40 mt-0.5">
                                      Last played: {st.lastPlayed ? new Date(st.lastPlayed).toLocaleString() : 'Recently'}
                                    </p>
                                  </div>
                                </div>

                                {/* Counts */}
                                <div className="flex items-center gap-3 shrink-0">
                                  <div className="px-3.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center gap-1.5">
                                    <Play size={13} className="text-cyan-400 fill-cyan-400" />
                                    <span className="text-sm font-black">{st.totalPlays || 0}</span>
                                    <span className="text-[10px] text-cyan-400/80 font-bold uppercase">Plays</span>
                                  </div>

                                  <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5">
                                    <Users size={13} className="text-emerald-400" />
                                    <span className="text-sm font-black">{usersList.length}</span>
                                    <span className="text-[10px] text-emerald-400/80 font-bold uppercase">{usersList.length === 1 ? 'Viewer' : 'Viewers'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Viewers Usernames Section */}
                              <div className="pt-2 border-t border-white/5">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[10px] font-black uppercase tracking-wider text-white/50 flex items-center gap-1">
                                    <UserCheck size={12} className="text-emerald-400" />
                                    <span>Users Who Watched This ({usersList.length}):</span>
                                  </span>

                                  {usersList.length > 6 && (
                                    <button
                                      onClick={() => setExpandedUsersId(isExpanded ? null : (st.itemId || index.toString()))}
                                      className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                                    >
                                      <span>{isExpanded ? 'Show Less' : `View All ${usersList.length} Users`}</span>
                                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    </button>
                                  )}
                                </div>

                                {usersList.length === 0 ? (
                                  <p className="text-[11px] text-white/40 italic">Watched anonymously or before user authentication tracking.</p>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {(isExpanded ? usersList : usersList.slice(0, 8)).map((username, uIdx) => (
                                      <span
                                        key={uIdx}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-white text-xs font-mono font-semibold hover:border-cyan-400/40 transition-colors"
                                      >
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                        <span>@{username}</span>
                                      </span>
                                    ))}
                                    {!isExpanded && usersList.length > 8 && (
                                      <button
                                        onClick={() => setExpandedUsersId(st.itemId || index.toString())}
                                        className="inline-flex items-center px-2 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-xs font-bold hover:bg-cyan-500/30 cursor-pointer"
                                      >
                                        +{usersList.length - 8} more
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* SUB-PANEL 2: RESELLER DOMAIN TRAFFIC */}
              {analyticsSubTab === 'resellers_traffic' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs flex items-center gap-2">
                    <Globe size={18} className="shrink-0 text-cyan-400" />
                    <span>
                      Har reseller ke custom domain ya portal URL (jaise <b>filex.online</b>) ke through aane wale daily visitors aur kul (total) visits yahan live update hote hain.
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {resellers
                      .filter((r) => !analyticsSearchQuery || r.brand_name?.toLowerCase().includes(analyticsSearchQuery.toLowerCase()) || r.subdomain?.toLowerCase().includes(analyticsSearchQuery.toLowerCase()))
                      .map((r) => {
                        const visitData = resellerVisits?.find(v => v.resellerId === r.id || v.id === r.id || v.subdomain === r.subdomain);
                        const todayStr = new Date().toISOString().split('T')[0];
                        const todayVisits = (visitData?.todayDate === todayStr) ? (Number(visitData?.todayVisits) || 0) : 0;
                        const totalVisits = Number(visitData?.totalVisits) || 0;
                        const portalUrl = `${window.location.origin}?r=${r.subdomain}`;

                        return (
                          <div
                            key={r.id}
                            className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 hover:border-emerald-500/40 transition-all space-y-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h5 className="text-sm font-black text-white">{r.brand_name}</h5>
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                                    {r.license_type || 'Active License'}
                                  </span>
                                </div>
                                <p className="text-xs text-cyan-400 font-mono mt-0.5">
                                  Domain / Subdomain: <b>{r.subdomain}</b>
                                </p>
                              </div>
                            </div>

                            {/* Traffic Counters */}
                            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-black/50 border border-white/10">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                  <Activity size={12} className="animate-pulse" />
                                  <span>Today's Visits (Aaj)</span>
                                </span>
                                <span className="text-xl font-black text-white mt-1">
                                  {todayVisits.toLocaleString()}
                                </span>
                                <span className="text-[9px] text-white/40 mt-0.5">Visitors today</span>
                              </div>

                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                                  <Globe size={12} />
                                  <span>Total Visits (Kul)</span>
                                </span>
                                <span className="text-xl font-black text-cyan-300 mt-1">
                                  {totalVisits.toLocaleString()}
                                </span>
                                <span className="text-[9px] text-white/40 mt-0.5">All-time portal traffic</span>
                              </div>
                            </div>

                            {/* Portal URL and Quick Copy */}
                            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/5 border border-white/5">
                              <span className="text-[11px] font-mono text-white/70 truncate">{portalUrl}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(portalUrl);
                                  alert("Portal link copied to clipboard!");
                                }}
                                className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                <Copy size={11} />
                                <span>Copy Link</span>
                              </button>
                            </div>

                            {/* Additional Info */}
                            <div className="text-[10px] text-white/40 flex items-center justify-between pt-1 border-t border-white/5">
                              <span>Last active: {visitData?.lastVisit ? new Date(visitData.lastVisit).toLocaleString() : 'No visits recorded yet'}</span>
                              {r.server_url && <span className="truncate max-w-[150px] font-mono">Server: {r.server_url}</span>}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* SUB-PANEL 3: LIVE PLAYBACK HISTORY LOGS */}
              {analyticsSubTab === 'live_logs' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-white/60">
                      Recent Playback Logs ({playbackLogs.length})
                    </h4>
                    <span className="text-[10px] text-white/40 font-mono">Real-time watch stream</span>
                  </div>

                  {playbackLogs.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-white/5 border border-white/10 space-y-2">
                      <History size={32} className="mx-auto text-white/30" />
                      <p className="text-sm font-bold text-white/60">No recent watch events recorded</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-black/40 text-white/50 uppercase tracking-wider font-bold border-b border-white/10">
                          <tr>
                            <th className="p-3">User</th>
                            <th className="p-3">Media Title</th>
                            <th className="p-3">Category</th>
                            <th className="p-3">Feed / Channel</th>
                            <th className="p-3">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {playbackLogs
                            .filter(l => !analyticsSearchQuery || l.username?.toLowerCase().includes(analyticsSearchQuery.toLowerCase()) || l.itemName?.toLowerCase().includes(analyticsSearchQuery.toLowerCase()))
                            .map((log) => (
                              <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                <td className="p-3 font-mono font-bold text-cyan-300">
                                  @{log.username || 'anonymous'}
                                </td>
                                <td className="p-3 font-bold text-white max-w-xs truncate">
                                  {log.itemName || 'Untitled'}
                                </td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                    log.category === 'movie' ? 'bg-cyan-500/20 text-cyan-300' :
                                    log.category === 'series' ? 'bg-purple-500/20 text-purple-300' :
                                    'bg-rose-500/20 text-rose-300'
                                  }`}>
                                    {log.category}
                                  </span>
                                </td>
                                <td className="p-3 text-white/60">
                                  {log.channelName || '-'}
                                </td>
                                <td className="p-3 text-white/40 whitespace-nowrap">
                                  {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Recently'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-PANEL 4: USER ACCOUNTS ACTIVITY */}
              {analyticsSubTab === 'users' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-white/60">
                      User Accounts ({userActivities.length})
                    </h4>
                  </div>

                  {userActivities.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-white/5 border border-white/10 space-y-2">
                      <Users size={32} className="mx-auto text-white/30" />
                      <p className="text-sm font-bold text-white/60">No user activity accounts registered</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-black/40 text-white/50 uppercase tracking-wider font-bold border-b border-white/10">
                          <tr>
                            <th className="p-3">Username</th>
                            <th className="p-3">Login Count</th>
                            <th className="p-3">First Seen</th>
                            <th className="p-3">Last Active</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {userActivities
                            .filter(u => !analyticsSearchQuery || u.username?.toLowerCase().includes(analyticsSearchQuery.toLowerCase()))
                            .map((usr, uIdx) => (
                              <tr key={uIdx} className="hover:bg-white/5 transition-colors">
                                <td className="p-3 font-mono font-bold text-white flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                  <span>@{usr.username}</span>
                                </td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold text-[10px]">
                                    {usr.loginCount || 1} logins
                                  </span>
                                </td>
                                <td className="p-3 text-white/50">
                                  {usr.firstActive ? new Date(usr.firstActive).toLocaleDateString() : '-'}
                                </td>
                                <td className="p-3 text-white/70">
                                  {usr.lastLogin ? new Date(usr.lastLogin).toLocaleString() : 'Active'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FREE MOVIES */}
          {activeTab === 'free_movies' && (
            <div className="space-y-6">
              {/* Add / Edit Movie Box */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-cyan-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                    <Film size={16} />
                    <span>{editingMovieId ? 'Edit Free Movie' : 'Add New Free Movie'}</span>
                  </h3>
                  {editingMovieId && (
                    <button
                      onClick={() => {
                        setEditingMovieId(null);
                        setMovieForm({
                          tmdb_id: '',
                          name: '',
                          poster_url: '',
                          play_url: '',
                          download_url: '',
                          is_embed: false,
                          is_webpage: false,
                          iframe_cropping: false,
                          show_live_viewer_count: false,
                          password: '',
                          available_for_resellers: true
                        });
                      }}
                      className="text-xs text-rose-400 hover:underline font-bold"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                {/* TMDB Quick Autofill */}
                <div className="flex items-center gap-2 p-3 bg-black/40 rounded-xl border border-white/10">
                  <Sparkles size={16} className="text-amber-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Enter TMDB Movie ID (e.g. 1022789) for auto title & poster"
                    value={movieForm.tmdb_id}
                    onChange={(e) => setMovieForm({ ...movieForm, tmdb_id: e.target.value })}
                    className="flex-1 bg-transparent border-0 text-xs text-white placeholder:text-white/30 outline-none"
                  />
                  <button
                    onClick={handleFetchMovieTmdb}
                    disabled={isFetchingMovieTmdb}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold border border-cyan-500/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isFetchingMovieTmdb ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                    <span>Auto Fetch TMDB</span>
                  </button>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Movie Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Inception (2010)"
                      value={movieForm.name}
                      onChange={(e) => setMovieForm({ ...movieForm, name: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Poster Image URL *</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={movieForm.poster_url}
                      onChange={(e) => setMovieForm({ ...movieForm, poster_url: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Play Stream URL / Embed Link *</label>
                    <input
                      type="text"
                      placeholder="https://... (m3u8, mp4, iframe url)"
                      value={movieForm.play_url}
                      onChange={(e) => setMovieForm({ ...movieForm, play_url: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Direct Download URL (Optional)</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={movieForm.download_url}
                      onChange={(e) => setMovieForm({ ...movieForm, download_url: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-cyan-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Password Protection (Optional)</label>
                    <input
                      type="text"
                      placeholder="Leave blank for public access"
                      value={movieForm.password}
                      onChange={(e) => setMovieForm({ ...movieForm, password: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-cyan-400 outline-none"
                    />
                  </div>
                </div>

                {/* Expiry Timer Controls (Timer / Availability Setting) */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-cyan-500/10 to-blue-500/10 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-amber-300 flex items-center gap-1.5 tracking-wider">
                      <Clock size={14} className="text-amber-400" />
                      <span>Availability Duration / Expiry Timer (Self-Destruct Timer)</span>
                    </span>
                    <span className="text-[10px] text-white/50">
                      Timer khatam hone par ye movie users se automatic invisible ho jayegi
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-white/80 uppercase">Preset Duration (Days Timer)</label>
                      <select
                        value={movieForm.duration_days}
                        onChange={(e) => {
                          const val = e.target.value;
                          let exp = movieForm.expires_at;
                          if (val !== 'none' && val !== 'custom') {
                            const d = parseFloat(val);
                            if (!isNaN(d) && d > 0) {
                              exp = new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
                            }
                          } else if (val === 'none') {
                            exp = '';
                          }
                          setMovieForm({ ...movieForm, duration_days: val, expires_at: exp });
                        }}
                        className="w-full mt-1 px-3 py-2 bg-black/60 border border-amber-500/30 rounded-xl text-xs text-white focus:border-cyan-400 outline-none cursor-pointer"
                      >
                        <option value="none">Permanent (No Expiry / Hamesha Rahegi)</option>
                        <option value="1">1 Day (24 Hours / 1 Din)</option>
                        <option value="2">2 Days (48 Hours / 2 Din)</option>
                        <option value="3">3 Days (72 Hours / 3 Din)</option>
                        <option value="4">4 Days (96 Hours / 4 Din)</option>
                        <option value="7">7 Days (1 Week / 1 Hafta)</option>
                        <option value="14">14 Days (2 Weeks)</option>
                        <option value="30">30 Days (1 Month)</option>
                        <option value="custom">Custom Date & Time (Apni marzi ki tareekh)</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-white/80 uppercase">Exact Expiry Date & Time</label>
                      <input
                        type="datetime-local"
                        value={movieForm.expires_at ? (movieForm.expires_at.includes('T') ? movieForm.expires_at.slice(0, 16) : movieForm.expires_at) : ''}
                        onChange={(e) => {
                          setMovieForm({
                            ...movieForm,
                            expires_at: e.target.value ? new Date(e.target.value).toISOString() : '',
                            duration_days: 'custom'
                          });
                        }}
                        placeholder="Select expiry date"
                        className="w-full mt-1 px-3 py-2 bg-black/60 border border-amber-500/30 rounded-xl text-xs text-white focus:border-cyan-400 outline-none"
                      />
                    </div>
                  </div>

                  {movieForm.expires_at && (
                    <div className="flex items-center gap-2 text-[11px] text-amber-200 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                      <Clock size={12} className="text-amber-400 shrink-0" />
                      <span>
                        Movie will expire and hide on: <strong className="text-white font-mono">{new Date(movieForm.expires_at).toLocaleString()}</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Checkbox Options */}
                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={movieForm.is_embed}
                      onChange={(e) => setMovieForm({ ...movieForm, is_embed: e.target.checked })}
                      className="w-3.5 h-3.5 rounded accent-cyan-500"
                    />
                    <span>Is Embed / iframe Video</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={movieForm.iframe_cropping}
                      onChange={(e) => setMovieForm({ ...movieForm, iframe_cropping: e.target.checked })}
                      className="w-3.5 h-3.5 rounded accent-cyan-500"
                    />
                    <span>Crop Video Frame (Hide Headers/Ads)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={movieForm.available_for_resellers}
                      onChange={(e) => setMovieForm({ ...movieForm, available_for_resellers: e.target.checked })}
                      className="w-3.5 h-3.5 rounded accent-cyan-500"
                    />
                    <span>Available to Resellers</span>
                  </label>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveMovie}
                    className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer"
                  >
                    {editingMovieId ? <Save size={14} /> : <Plus size={14} />}
                    <span>{editingMovieId ? 'Update Movie' : 'Add Free Movie'}</span>
                  </button>
                </div>
              </div>

              {/* Movie List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-white/60">
                    Existing Free Movies ({freeMovies.length})
                  </h4>
                  <div className="w-64">
                    <input
                      type="text"
                      placeholder="Search movies..."
                      value={movieSearchQuery}
                      onChange={(e) => setMovieSearchQuery(e.target.value)}
                      className="w-full px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {freeMovies
                    .filter(m => !movieSearchQuery || m.name?.toLowerCase().includes(movieSearchQuery.toLowerCase()))
                    .map((m) => (
                      <div
                        key={m.id}
                        className="p-3 rounded-xl bg-slate-900/50 border border-white/10 hover:border-cyan-500/40 flex items-center justify-between gap-3 transition-all"
                      >
                        <img
                          src={m.poster_url || 'https://picsum.photos/seed/movie/100/150'}
                          alt={m.name}
                          className="w-12 h-16 rounded-lg object-cover bg-black/50 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-bold text-white truncate">{m.name}</h5>
                          <div className="flex items-center gap-2 text-[10px] text-white/50 mt-1 flex-wrap">
                            {m.is_embed && <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold">EMBED</span>}
                            {m.password && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">LOCK</span>}
                            {m.available_for_resellers !== false && <span className="text-emerald-400">Reseller OK</span>}
                            {m.expires_at ? (
                              (() => {
                                const isExp = new Date(m.expires_at).getTime() <= Date.now();
                                return (
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    isExp 
                                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  }`}>
                                    <Clock size={10} />
                                    {isExp ? 'EXPIRED (Hidden)' : `Expires: ${new Date(m.expires_at).toLocaleDateString()}`}
                                  </span>
                                );
                              })()
                            ) : (
                              <span className="text-white/30 text-[9px]">Permanent</span>
                            )}
                          </div>
                          {/* Live Views Counter & Viewers Badge */}
                          {(() => {
                            const viewInfo = getMediaViewsInfo(m, 'movie');
                            return (
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-black tracking-wide">
                                  <Eye size={11} className="text-cyan-400" />
                                  <span>{viewInfo.views} {viewInfo.views === 1 ? 'View' : 'Views'}</span>
                                </span>
                                {viewInfo.usersCount > 0 ? (
                                  <button
                                    onClick={() => setSelectedMediaViewers({
                                      title: m.name,
                                      category: 'Movie',
                                      views: viewInfo.views,
                                      users: viewInfo.usersList
                                    })}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold cursor-pointer transition-colors"
                                    title={`Click to view user list (${viewInfo.usersList.join(', ')})`}
                                  >
                                    <Users size={10} className="text-emerald-400" />
                                    <span>{viewInfo.usersCount} {viewInfo.usersCount === 1 ? 'User' : 'Users'}</span>
                                  </button>
                                ) : (
                                  <span className="text-[9px] text-white/30 italic">No users yet</span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditMovieClick(m)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-white/70 hover:text-cyan-400 cursor-pointer"
                            title="Edit Movie"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteMovieClick(m.id)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-white/70 hover:text-rose-400 cursor-pointer"
                            title="Delete Movie"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FREE WEB SERIES */}
          {activeTab === 'free_series' && (
            <div className="space-y-6">
              {/* Add / Edit Series Box */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-purple-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-purple-400 flex items-center gap-2">
                    <Tv size={16} />
                    <span>{editingSeriesId ? 'Edit Web Series' : 'Add New Web Series'}</span>
                  </h3>
                  {editingSeriesId && (
                    <button
                      onClick={() => {
                        setEditingSeriesId(null);
                        setSeriesForm({
                          tmdb_id: '',
                          name: '',
                          poster_url: '',
                          play_url: '',
                          download_url: '',
                          playlist_url: '',
                          is_embed: false,
                          is_webpage: false,
                          iframe_cropping: false,
                          show_live_viewer_count: false,
                          password: '',
                          available_for_resellers: true,
                          episodes: []
                        });
                      }}
                      className="text-xs text-rose-400 hover:underline font-bold"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                {/* TMDB Quick Autofill */}
                <div className="flex items-center gap-2 p-3 bg-black/40 rounded-xl border border-white/10">
                  <Sparkles size={16} className="text-purple-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Enter TMDB Series ID (e.g. 1399 for Game of Thrones) for auto title & poster"
                    value={seriesForm.tmdb_id}
                    onChange={(e) => setSeriesForm({ ...seriesForm, tmdb_id: e.target.value })}
                    className="flex-1 bg-transparent border-0 text-xs text-white placeholder:text-white/30 outline-none"
                  />
                  <button
                    onClick={handleFetchSeriesTmdb}
                    disabled={isFetchingSeriesTmdb}
                    className="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-bold border border-purple-500/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isFetchingSeriesTmdb ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                    <span>Auto Fetch TMDB</span>
                  </button>
                </div>

                {/* Main Series Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Series Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Mirzapur Season 3"
                      value={seriesForm.name}
                      onChange={(e) => setSeriesForm({ ...seriesForm, name: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-purple-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Poster Image URL *</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={seriesForm.poster_url}
                      onChange={(e) => setSeriesForm({ ...seriesForm, poster_url: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-purple-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Direct Stream / Embed Link</label>
                    <input
                      type="text"
                      placeholder="Single video URL or leave empty if using episodes"
                      value={seriesForm.play_url}
                      onChange={(e) => setSeriesForm({ ...seriesForm, play_url: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-purple-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Playlist M3U URL (Optional)</label>
                    <input
                      type="text"
                      placeholder="https://...playlist.m3u"
                      value={seriesForm.playlist_url}
                      onChange={(e) => setSeriesForm({ ...seriesForm, playlist_url: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-purple-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Password Protection (Optional)</label>
                    <input
                      type="text"
                      placeholder="Leave blank for public access"
                      value={seriesForm.password}
                      onChange={(e) => setSeriesForm({ ...seriesForm, password: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-purple-400 outline-none"
                    />
                  </div>
                </div>

                {/* Expiry Timer Controls (Timer / Availability Setting for Series) */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-indigo-500/10 border border-purple-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-purple-300 flex items-center gap-1.5 tracking-wider">
                      <Clock size={14} className="text-purple-400" />
                      <span>Availability Duration / Expiry Timer (Self-Destruct Timer)</span>
                    </span>
                    <span className="text-[10px] text-white/50">
                      Timer khatam hone par ye web series users se automatic invisible ho jayegi
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-white/80 uppercase">Preset Duration (Days Timer)</label>
                      <select
                        value={seriesForm.duration_days}
                        onChange={(e) => {
                          const val = e.target.value;
                          let exp = seriesForm.expires_at;
                          if (val !== 'none' && val !== 'custom') {
                            const d = parseFloat(val);
                            if (!isNaN(d) && d > 0) {
                              exp = new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
                            }
                          } else if (val === 'none') {
                            exp = '';
                          }
                          setSeriesForm({ ...seriesForm, duration_days: val, expires_at: exp });
                        }}
                        className="w-full mt-1 px-3 py-2 bg-black/60 border border-purple-500/30 rounded-xl text-xs text-white focus:border-purple-400 outline-none cursor-pointer"
                      >
                        <option value="none">Permanent (No Expiry / Hamesha Rahegi)</option>
                        <option value="1">1 Day (24 Hours / 1 Din)</option>
                        <option value="2">2 Days (48 Hours / 2 Din)</option>
                        <option value="3">3 Days (72 Hours / 3 Din)</option>
                        <option value="4">4 Days (96 Hours / 4 Din)</option>
                        <option value="7">7 Days (1 Week / 1 Hafta)</option>
                        <option value="14">14 Days (2 Weeks)</option>
                        <option value="30">30 Days (1 Month)</option>
                        <option value="custom">Custom Date & Time (Apni marzi ki tareekh)</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-white/80 uppercase">Exact Expiry Date & Time</label>
                      <input
                        type="datetime-local"
                        value={seriesForm.expires_at ? (seriesForm.expires_at.includes('T') ? seriesForm.expires_at.slice(0, 16) : seriesForm.expires_at) : ''}
                        onChange={(e) => {
                          setSeriesForm({
                            ...seriesForm,
                            expires_at: e.target.value ? new Date(e.target.value).toISOString() : '',
                            duration_days: 'custom'
                          });
                        }}
                        placeholder="Select expiry date"
                        className="w-full mt-1 px-3 py-2 bg-black/60 border border-purple-500/30 rounded-xl text-xs text-white focus:border-purple-400 outline-none"
                      />
                    </div>
                  </div>

                  {seriesForm.expires_at && (
                    <div className="flex items-center gap-2 text-[11px] text-purple-200 bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20">
                      <Clock size={12} className="text-purple-400 shrink-0" />
                      <span>
                        Series will expire and hide on: <strong className="text-white font-mono">{new Date(seriesForm.expires_at).toLocaleString()}</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Manual Episode Builder */}
                <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center justify-between">
                    <span>Manual Episode Manager ({seriesForm.episodes?.length || 0} episodes)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    <input
                      type="number"
                      placeholder="Season"
                      value={manualEpisode.season}
                      onChange={(e) => setManualEpisode({ ...manualEpisode, season: e.target.value })}
                      className="px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs text-white outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Ep #"
                      value={manualEpisode.episode_num}
                      onChange={(e) => setManualEpisode({ ...manualEpisode, episode_num: e.target.value })}
                      className="px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs text-white outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Title (Optional)"
                      value={manualEpisode.title}
                      onChange={(e) => setManualEpisode({ ...manualEpisode, title: e.target.value })}
                      className="px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs text-white outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Stream Play URL *"
                      value={manualEpisode.play_url}
                      onChange={(e) => setManualEpisode({ ...manualEpisode, play_url: e.target.value })}
                      className="px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualEpisode}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Add Ep</span>
                    </button>
                  </div>

                  {/* List of episodes */}
                  {seriesForm.episodes && seriesForm.episodes.length > 0 && (
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {seriesForm.episodes.map((ep) => (
                        <div
                          key={ep.id}
                          className="flex items-center justify-between px-3 py-1.5 bg-white/5 rounded-lg text-xs text-white/80"
                        >
                          <span className="font-mono text-purple-400 font-bold">
                            S{ep.season}:E{ep.episode_num}
                          </span>
                          <span className="truncate max-w-[200px] text-white/90">{ep.title}</span>
                          <span className="truncate max-w-[150px] text-white/40 font-mono text-[10px]">{ep.play_url}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveManualEpisode(ep.id)}
                            className="text-rose-400 hover:text-rose-300 p-1"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveSeries}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.4)] cursor-pointer"
                  >
                    {editingSeriesId ? <Save size={14} /> : <Plus size={14} />}
                    <span>{editingSeriesId ? 'Update Series' : 'Add Web Series'}</span>
                  </button>
                </div>
              </div>

              {/* Series List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-white/60">
                    Existing Web Series ({freeSeries.length})
                  </h4>
                  <div className="w-64">
                    <input
                      type="text"
                      placeholder="Search series..."
                      value={seriesSearchQuery}
                      onChange={(e) => setSeriesSearchQuery(e.target.value)}
                      className="w-full px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs text-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {freeSeries
                    .filter(s => !seriesSearchQuery || s.name?.toLowerCase().includes(seriesSearchQuery.toLowerCase()))
                    .map((s) => (
                      <div
                        key={s.id}
                        className="p-3 rounded-xl bg-slate-900/50 border border-white/10 hover:border-purple-500/40 flex items-center justify-between gap-3 transition-all"
                      >
                        <img
                          src={s.poster_url || 'https://picsum.photos/seed/series/100/150'}
                          alt={s.name}
                          className="w-12 h-16 rounded-lg object-cover bg-black/50 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-bold text-white truncate">{s.name}</h5>
                          <div className="flex items-center gap-2 text-[10px] text-white/50 mt-1 flex-wrap">
                            {s.episodes?.length > 0 && <span className="text-purple-400 font-bold">{s.episodes.length} Episodes</span>}
                            {s.playlist_url && <span className="text-cyan-400 font-bold">M3U Playlist</span>}
                            {s.password && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">LOCK</span>}
                            {s.expires_at ? (
                              (() => {
                                const isExp = new Date(s.expires_at).getTime() <= Date.now();
                                return (
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                    isExp 
                                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  }`}>
                                    <Clock size={10} />
                                    {isExp ? 'EXPIRED (Hidden)' : `Expires: ${new Date(s.expires_at).toLocaleDateString()}`}
                                  </span>
                                );
                              })()
                            ) : (
                              <span className="text-white/30 text-[9px]">Permanent</span>
                            )}
                          </div>
                          {/* Live Views Counter & Viewers Badge */}
                          {(() => {
                            const viewInfo = getMediaViewsInfo(s, 'series');
                            return (
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-black tracking-wide">
                                  <Eye size={11} className="text-purple-400" />
                                  <span>{viewInfo.views} {viewInfo.views === 1 ? 'View' : 'Views'}</span>
                                </span>
                                {viewInfo.usersCount > 0 ? (
                                  <button
                                    onClick={() => setSelectedMediaViewers({
                                      title: s.name,
                                      category: 'Web Series',
                                      views: viewInfo.views,
                                      users: viewInfo.usersList
                                    })}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold cursor-pointer transition-colors"
                                    title={`Click to view user list (${viewInfo.usersList.join(', ')})`}
                                  >
                                    <Users size={10} className="text-emerald-400" />
                                    <span>{viewInfo.usersCount} {viewInfo.usersCount === 1 ? 'User' : 'Users'}</span>
                                  </button>
                                ) : (
                                  <span className="text-[9px] text-white/30 italic">No users yet</span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditSeriesClick(s)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-purple-500/20 text-white/70 hover:text-purple-400 cursor-pointer"
                            title="Edit Series"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteSeriesClick(s.id)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-white/70 hover:text-rose-400 cursor-pointer"
                            title="Delete Series"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LIVE EVENTS */}
          {activeTab === 'live_events' && (
            <div className="space-y-6">
              {/* Add / Edit Live Event */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-rose-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-rose-400 flex items-center gap-2">
                    <Radio size={16} />
                    <span>{editingLiveEventId ? 'Edit Live Event' : 'Add New Live Event / Sports Stream'}</span>
                  </h3>
                  {editingLiveEventId && (
                    <button
                      onClick={() => {
                        setEditingLiveEventId(null);
                        setLiveEventForm({
                          name: '',
                          poster_url: '',
                          available_for_resellers: true,
                          channels: [{ name: 'Urdu', play_url: '', is_embed: false, is_mpd: false, is_webpage: false, sandbox_disabled: false, iframe_cropping: false, show_live_viewer_count: false }]
                        });
                      }}
                      className="text-xs text-rose-400 hover:underline font-bold"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Event Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. PAK vs IND Live T20"
                      value={liveEventForm.name}
                      onChange={(e) => setLiveEventForm({ ...liveEventForm, name: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-rose-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Event Poster / Banner Image URL *</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={liveEventForm.poster_url}
                      onChange={(e) => setLiveEventForm({ ...liveEventForm, poster_url: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-rose-400 outline-none"
                    />
                  </div>
                </div>

                {/* Multi Channels */}
                <div className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white/80">
                      Multi-Audio / Multi-Server Channels ({liveEventForm.channels.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setLiveEventForm({
                          ...liveEventForm,
                          channels: [
                            ...liveEventForm.channels,
                            { name: `Server ${liveEventForm.channels.length + 1}`, play_url: '', is_embed: false, is_mpd: false, is_webpage: false, sandbox_disabled: false, iframe_cropping: false, show_live_viewer_count: false }
                          ]
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-bold border border-rose-500/30 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>Add Channel</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {liveEventForm.channels.map((ch, idx) => (
                      <div key={idx} className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Channel Name (e.g. Urdu HD, Hindi, PTV Sports)"
                            value={ch.name}
                            onChange={(e) => {
                              const updated = [...liveEventForm.channels];
                              updated[idx].name = e.target.value;
                              setLiveEventForm({ ...liveEventForm, channels: updated });
                            }}
                            className="w-1/3 px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs text-white outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Stream URL (m3u8, mpd, embed url)"
                            value={ch.play_url}
                            onChange={(e) => {
                              const updated = [...liveEventForm.channels];
                              updated[idx].play_url = e.target.value;
                              setLiveEventForm({ ...liveEventForm, channels: updated });
                            }}
                            className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-white/10 rounded-lg text-xs text-white outline-none"
                          />
                          {liveEventForm.channels.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setLiveEventForm({
                                  ...liveEventForm,
                                  channels: liveEventForm.channels.filter((_, i) => i !== idx)
                                });
                              }}
                              className="text-rose-400 p-1 hover:text-rose-300"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        {/* Channel Options */}
                        <div className="flex flex-wrap gap-3 text-[11px] text-white/60">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!ch.is_embed}
                              onChange={(e) => {
                                const updated = [...liveEventForm.channels];
                                updated[idx].is_embed = e.target.checked;
                                setLiveEventForm({ ...liveEventForm, channels: updated });
                              }}
                              className="w-3 h-3 accent-rose-500"
                            />
                            <span>Embed / Webpage</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!ch.is_mpd}
                              onChange={(e) => {
                                const updated = [...liveEventForm.channels];
                                updated[idx].is_mpd = e.target.checked;
                                setLiveEventForm({ ...liveEventForm, channels: updated });
                              }}
                              className="w-3 h-3 accent-rose-500"
                            />
                            <span>MPD (Dash)</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!ch.show_live_viewer_count}
                              onChange={(e) => {
                                const updated = [...liveEventForm.channels];
                                updated[idx].show_live_viewer_count = e.target.checked;
                                setLiveEventForm({ ...liveEventForm, channels: updated });
                              }}
                              className="w-3 h-3 accent-rose-500"
                            />
                            <span>Live Viewer Counter</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveLiveEvent}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-[0_0_15px_rgba(244,63,94,0.4)] cursor-pointer"
                  >
                    {editingLiveEventId ? <Save size={14} /> : <Plus size={14} />}
                    <span>{editingLiveEventId ? 'Update Live Event' : 'Add Live Event'}</span>
                  </button>
                </div>
              </div>

              {/* Live Events List */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-white/60">
                  Existing Live Events ({liveEvents.length})
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {liveEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 rounded-xl bg-slate-900/50 border border-white/10 hover:border-rose-500/40 flex items-center justify-between gap-3 transition-all"
                    >
                      <img
                        src={evt.poster_url || 'https://picsum.photos/seed/live/100/150'}
                        alt={evt.name}
                        className="w-14 h-16 rounded-lg object-cover bg-black/50 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <h5 className="text-xs font-bold text-white truncate">{evt.name}</h5>
                        <p className="text-[10px] text-rose-400 font-bold mt-1">
                          {evt.channels?.length || 1} Channels
                        </p>
                        {/* Live Views Counter & Viewers Badge */}
                        {(() => {
                          const viewInfo = getMediaViewsInfo(evt, 'live_event');
                          return (
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-black tracking-wide">
                                <Eye size={11} className="text-rose-400" />
                                <span>{viewInfo.views} {viewInfo.views === 1 ? 'Stream View' : 'Stream Views'}</span>
                              </span>
                              {viewInfo.usersCount > 0 ? (
                                <button
                                  onClick={() => setSelectedMediaViewers({
                                    title: evt.name,
                                    category: 'Live Event / TV',
                                    views: viewInfo.views,
                                    users: viewInfo.usersList
                                  })}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] font-bold cursor-pointer transition-colors"
                                  title={`Click to view user list (${viewInfo.usersList.join(', ')})`}
                                >
                                  <Users size={10} className="text-amber-400" />
                                  <span>{viewInfo.usersCount} {viewInfo.usersCount === 1 ? 'User' : 'Users'}</span>
                                </button>
                              ) : (
                                <span className="text-[9px] text-white/30 italic">No users yet</span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditLiveEventClick(evt)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-white/70 hover:text-rose-400 cursor-pointer"
                          title="Edit Event"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteLiveEventClick(evt.id)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-white/70 hover:text-rose-400 cursor-pointer"
                          title="Delete Event"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: RESELLERS MANAGEMENT */}
          {activeTab === 'resellers' && (
            <div className="space-y-6">
              {/* Add / Edit Reseller */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-emerald-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                    <Users size={16} />
                    <span>{editingResellerId ? 'Edit Reseller License' : 'Create New Reseller License'}</span>
                  </h3>
                  {editingResellerId && (
                    <button
                      onClick={() => {
                        setEditingResellerId(null);
                        setResellerForm({
                          subdomain: '',
                          brand_name: '',
                          tagline: '',
                          whatsapp_number: '',
                          whatsapp_group_link: '',
                          whatsapp_channel_link: '',
                          logo_url: '',
                          server_url: '',
                          download_url: '',
                          proxy_url: '',
                          app_link: '',
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

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Subdomain / Domain Keyword *</label>
                    <input
                      type="text"
                      placeholder="e.g. star4k (accessed via ?r=star4k or domain)"
                      value={resellerForm.subdomain}
                      onChange={(e) => setResellerForm({ ...resellerForm, subdomain: e.target.value.toLowerCase().trim() })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Brand Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Star IPTV 4K"
                      value={resellerForm.brand_name}
                      onChange={(e) => setResellerForm({ ...resellerForm, brand_name: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Reseller Login Password *</label>
                    <input
                      type="text"
                      placeholder="Password for reseller login portal"
                      value={resellerForm.password}
                      onChange={(e) => setResellerForm({ ...resellerForm, password: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Tagline / Slogan</label>
                    <input
                      type="text"
                      placeholder="e.g. Premium HD Streaming"
                      value={resellerForm.tagline}
                      onChange={(e) => setResellerForm({ ...resellerForm, tagline: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">WhatsApp Number</label>
                    <input
                      type="text"
                      placeholder="+923001234567"
                      value={resellerForm.whatsapp_number}
                      onChange={(e) => setResellerForm({ ...resellerForm, whatsapp_number: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase flex items-center justify-between">
                      <span>WhatsApp Group / Community Link</span>
                      <span className="text-[9px] text-cyan-400 font-semibold lowercase">optional</span>
                    </label>
                    <input
                      type="url"
                      placeholder="https://chat.whatsapp.com/..."
                      value={resellerForm.whatsapp_group_link}
                      onChange={(e) => setResellerForm({ ...resellerForm, whatsapp_group_link: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase flex items-center justify-between">
                      <span>WhatsApp Channel Link</span>
                      <span className="text-[9px] text-emerald-400 font-semibold lowercase">optional</span>
                    </label>
                    <input
                      type="url"
                      placeholder="https://whatsapp.com/channel/..."
                      value={resellerForm.whatsapp_channel_link}
                      onChange={(e) => setResellerForm({ ...resellerForm, whatsapp_channel_link: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">License Duration</label>
                    <select
                      value={resellerForm.license_type}
                      onChange={(e) => setResellerForm({ ...resellerForm, license_type: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-emerald-400 outline-none"
                    >
                      <option value="1 Month">1 Month</option>
                      <option value="3 Months">3 Months</option>
                      <option value="6 Months">6 Months</option>
                      <option value="1 Year">1 Year</option>
                      <option value="Lifetime">Lifetime</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Custom Xtream Server URL</label>
                    <input
                      type="text"
                      placeholder="http://server.reseller.com:8080"
                      value={resellerForm.server_url}
                      onChange={(e) => setResellerForm({ ...resellerForm, server_url: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Custom Movie Download Server URL</label>
                    <input
                      type="text"
                      placeholder="https://download.reseller.com"
                      value={resellerForm.download_url}
                      onChange={(e) => setResellerForm({ ...resellerForm, download_url: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Custom APK / App Link</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={resellerForm.app_link}
                      onChange={(e) => setResellerForm({ ...resellerForm, app_link: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-white/70 uppercase">Custom Brand Logo URL</label>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={resellerForm.logo_url}
                      onChange={(e) => setResellerForm({ ...resellerForm, logo_url: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2 md:col-span-3">
                    <label className="text-[10px] font-bold text-white/70 uppercase flex items-center justify-between">
                      <span>Custom Video Streaming Proxy URL (Optional)</span>
                      <span className="text-white/40 font-normal lowercase text-[9px]">Leave empty to use global proxy</span>
                    </label>
                    <input
                      type="text"
                      placeholder="https://lb3.hdsj.store:2053/?url="
                      value={resellerForm.proxy_url || ''}
                      onChange={(e) => setResellerForm({ ...resellerForm, proxy_url: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:border-emerald-400 outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveReseller}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.4)] cursor-pointer"
                  >
                    {editingResellerId ? <Save size={14} /> : <Plus size={14} />}
                    <span>{editingResellerId ? 'Update Reseller' : 'Create Reseller'}</span>
                  </button>
                </div>
              </div>

              {/* Reseller List */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-white/60">
                  Active Resellers ({resellers.length})
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {resellers.map((r) => {
                    const resellerPortalUrl = `${window.location.origin}?r=${r.subdomain}`;
                    return (
                      <div
                        key={r.id}
                        className="p-4 rounded-xl bg-slate-900/60 border border-white/10 hover:border-emerald-500/40 space-y-3 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-sm font-black text-white">{r.brand_name}</h5>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                                {r.license_type || '1 Year'}
                              </span>
                            </div>
                            <p className="text-xs text-cyan-400 font-mono mt-0.5">
                              Subdomain Keyword: <b>{r.subdomain}</b>
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditResellerClick(r)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-white/70 hover:text-emerald-400 cursor-pointer"
                              title="Edit Reseller"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteResellerClick(r.id)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-white/70 hover:text-rose-400 cursor-pointer"
                              title="Delete Reseller"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="text-[11px] space-y-1.5 text-white/70 bg-black/40 p-3 rounded-xl border border-white/5 font-mono">
                          <div className="flex items-center justify-between">
                            <span className="text-white/40">Password:</span>
                            <span className="text-white font-bold">{r.password || 'Not set'}</span>
                          </div>
                          {r.whatsapp_number && (
                            <div className="flex items-center justify-between">
                              <span className="text-white/40">WhatsApp:</span>
                              <a 
                                href={`https://wa.me/${r.whatsapp_number.replace(/[^0-9]/g, '')}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-emerald-400 hover:underline font-bold flex items-center gap-1"
                              >
                                <span>{r.whatsapp_number}</span>
                                <ExternalLink size={10} />
                              </a>
                            </div>
                          )}
                          {r.whatsapp_group_link && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-white/40 shrink-0">Group/Community:</span>
                              <a 
                                href={r.whatsapp_group_link} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-cyan-400 hover:underline truncate max-w-[180px] font-bold flex items-center gap-1"
                                title={r.whatsapp_group_link}
                              >
                                <span className="truncate">{r.whatsapp_group_link}</span>
                                <ExternalLink size={10} className="shrink-0" />
                              </a>
                            </div>
                          )}
                          {r.whatsapp_channel_link && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-white/40 shrink-0">Channel:</span>
                              <a 
                                href={r.whatsapp_channel_link} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-emerald-300 hover:underline truncate max-w-[180px] font-bold flex items-center gap-1"
                                title={r.whatsapp_channel_link}
                              >
                                <span className="truncate">{r.whatsapp_channel_link}</span>
                                <ExternalLink size={10} className="shrink-0" />
                              </a>
                            </div>
                          )}
                          {r.server_url && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-white/40 shrink-0">Server:</span>
                              <span className="text-purple-300 truncate max-w-[180px]">{r.server_url}</span>
                            </div>
                          )}
                          {r.download_url && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-white/40 shrink-0">Download Host:</span>
                              <span className="text-pink-300 truncate max-w-[180px]">{r.download_url}</span>
                            </div>
                          )}
                          {r.app_link && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-white/40 shrink-0">App Link:</span>
                              <a 
                                href={r.app_link} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-amber-300 hover:underline truncate max-w-[180px] flex items-center gap-1"
                                title={r.app_link}
                              >
                                <span className="truncate">{r.app_link}</span>
                                <ExternalLink size={10} className="shrink-0" />
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Portal Link Copy */}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={resellerPortalUrl}
                            className="flex-1 px-2.5 py-1.5 bg-black/60 border border-white/10 rounded-lg text-[10px] text-cyan-300 font-mono outline-none"
                          />
                          <button
                            onClick={() => handleCopy(resellerPortalUrl, `reseller_${r.id}`)}
                            className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
                          >
                            {copiedKey === `reseller_${r.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                            <span>{copiedKey === `reseller_${r.id}` ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>

                        {/* Reseller Traffic Stats Box (Daily & Total Visits) */}
                        {(() => {
                          const visitData = resellerVisits?.find(v => v.resellerId === r.id || v.id === r.id || v.subdomain === r.subdomain);
                          const todayStr = new Date().toISOString().split('T')[0];
                          const todayVisits = (visitData?.todayDate === todayStr) ? (Number(visitData?.todayVisits) || 0) : 0;
                          const totalVisits = Number(visitData?.totalVisits) || 0;
                          return (
                            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                  <Activity size={10} className="animate-pulse" />
                                  <span>Today's Visits (Aaj)</span>
                                </span>
                                <span className="text-sm font-black text-white mt-0.5">{todayVisits.toLocaleString()}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[9px] font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                                  <Globe size={10} />
                                  <span>Total Visits (Kul)</span>
                                </span>
                                <span className="text-sm font-black text-cyan-300 mt-0.5">{totalVisits.toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: APP DOWNLOADS & DOWNLOADER CODES */}
          {activeTab === 'apps' && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                    <Download size={16} />
                    <span>Manage Applications & Downloader Codes ({appDownloads.length})</span>
                  </h3>
                  <p className="text-xs text-white/50 mt-0.5">
                    Post APK download links, custom logos, and FireStick 6-digit Downloader codes for your users & resellers.
                  </p>
                </div>

                {appSaveMsg && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30"
                  >
                    <CheckCircle2 size={14} />
                    <span>{appSaveMsg}</span>
                  </motion.div>
                )}
              </div>

              {/* Form Container */}
              <form onSubmit={handleSaveApp} className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    {editingAppId ? <Edit2 size={14} className="text-amber-400" /> : <Plus size={14} className="text-cyan-400" />}
                    <span>{editingAppId ? 'Edit Application Details' : 'Add New Application'}</span>
                  </h4>
                  {editingAppId && (
                    <button
                      type="button"
                      onClick={handleCancelEditApp}
                      className="text-xs text-white/50 hover:text-white underline cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {/* App Name */}
                  <div>
                    <label className="block text-[11px] font-bold text-white/70 uppercase mb-1">
                      Application Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SJ IPTV Official Player"
                      value={appForm.name}
                      onChange={(e) => setAppForm({ ...appForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  {/* Logo URL */}
                  <div>
                    <label className="block text-[11px] font-bold text-white/70 uppercase mb-1">
                      App Logo / Icon URL
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        placeholder="https://example.com/logo.png"
                        value={appForm.logo_url}
                        onChange={(e) => setAppForm({ ...appForm, logo_url: e.target.value })}
                        className="flex-1 px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:border-cyan-500 focus:outline-none"
                      />
                      {appForm.logo_url && (
                        <img
                          src={appForm.logo_url}
                          alt="preview"
                          className="w-8 h-8 rounded-lg object-contain bg-black/50 border border-white/10 shrink-0"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Version */}
                  <div>
                    <label className="block text-[11px] font-bold text-white/70 uppercase mb-1">
                      Version / Tag (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. v3.5.0 or Latest"
                      value={appForm.version}
                      onChange={(e) => setAppForm({ ...appForm, version: e.target.value })}
                      className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  {/* Download URL */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-white/70 uppercase mb-1">
                      APK / App Download URL *
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        required
                        placeholder="https://example.com/app.apk"
                        value={appForm.download_url}
                        onChange={(e) => setAppForm({ ...appForm, download_url: e.target.value })}
                        className="flex-1 px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:border-cyan-500 focus:outline-none"
                      />
                      {appForm.download_url && (
                        <a
                          href={appForm.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-cyan-300 border border-white/10 shrink-0"
                          title="Test Link"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* FireStick Downloader Code */}
                  <div>
                    <label className="block text-[11px] font-bold text-amber-400 uppercase mb-1 flex items-center gap-1">
                      <Flame size={12} className="text-amber-400" />
                      <span>Downloader Code (FireStick)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 782190"
                      value={appForm.downloader_code}
                      onChange={(e) => setAppForm({ ...appForm, downloader_code: e.target.value })}
                      className="w-full px-3 py-2 bg-black/60 border border-amber-500/30 rounded-xl text-xs text-amber-300 font-mono font-bold placeholder-white/30 focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  {/* Device Type Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-white/70 uppercase mb-1">
                      Optimized For Device
                    </label>
                    <select
                      value={appForm.device_type}
                      onChange={(e) => setAppForm({ ...appForm, device_type: e.target.value })}
                      className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="android_tv">Android TV & FireStick</option>
                      <option value="mobile">Mobile & Tablet (Android)</option>
                      <option value="all">All Devices (Universal)</option>
                      <option value="windows">Windows / PC</option>
                    </select>
                  </div>

                  {/* Description */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-white/70 uppercase mb-1">
                      Short Description / Installation Notes
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Recommended player for 4K streaming and sports with fast EPG."
                      value={appForm.description}
                      onChange={(e) => setAppForm({ ...appForm, description: e.target.value })}
                      className="w-full px-3 py-2 bg-black/60 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Reseller Visibility & Permission Controls */}
                <div className="pt-3 border-t border-white/5 space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Globe size={14} className="text-cyan-400" />
                        <span>Global Application (Show on All Resellers & Main Website)</span>
                      </div>
                      <p className="text-[11px] text-white/40 mt-0.5">
                        Always visible on the Main Website. If enabled, also appears on all resellers. If disabled, appears on Main Website + only the selected resellers below.
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={appForm.is_default}
                        onChange={(e) => setAppForm({ ...appForm, is_default: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {/* Selective Resellers list (if not default) */}
                  {!appForm.is_default && (
                    <div className="p-3.5 rounded-xl bg-black/40 border border-cyan-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Users size={13} />
                          <span>Select Resellers Allowed to Display this App:</span>
                        </label>

                        {resellers.length > 0 && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setAppForm({ ...appForm, allowed_reseller_ids: Array.from(new Set(resellers.flatMap(r => [r.id, r.subdomain].filter(Boolean)))) })}
                              className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                            >
                              Select All
                            </button>
                            <span className="text-white/20">•</span>
                            <button
                              type="button"
                              onClick={() => setAppForm({ ...appForm, allowed_reseller_ids: [] })}
                              className="text-[10px] text-white/40 hover:underline cursor-pointer"
                            >
                              Deselect All
                            </button>
                          </div>
                        )}
                      </div>

                      {resellers.length === 0 ? (
                        <p className="text-xs text-white/40 py-2">No resellers created yet. Add resellers in the Resellers tab.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 max-h-48 overflow-y-auto pr-1">
                          {resellers.map((r) => {
                            const resId = r.id || r.subdomain;
                            const isChecked = appForm.allowed_reseller_ids.includes(resId) || (r.subdomain && appForm.allowed_reseller_ids.includes(r.subdomain));
                            return (
                              <label
                                key={r.id}
                                className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                                  isChecked 
                                    ? 'bg-cyan-500/10 border-cyan-500/40 text-white font-semibold' 
                                    : 'bg-black/30 border-white/5 text-white/60 hover:text-white'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleResellerForApp(r.id, r.subdomain)}
                                  className="rounded border-white/20 text-cyan-500 focus:ring-0"
                                />
                                <span className="truncate">{r.brand_name || r.subdomain}</span>
                                <span className="text-[10px] text-white/40">({r.subdomain})</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  {editingAppId && (
                    <button
                      type="button"
                      onClick={handleCancelEditApp}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-bold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSavingApp}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingApp ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    <span>{editingAppId ? 'Update Application' : 'Save Application'}</span>
                  </button>
                </div>
              </form>

              {/* List of Configured Applications */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center justify-between">
                  <span>Current Applications ({appDownloads.length})</span>
                  <span className="text-[11px] font-normal text-white/40">Click edit to update or change reseller access</span>
                </h4>

                {appDownloads.length === 0 ? (
                  <div className="p-8 text-center bg-slate-900/30 rounded-2xl border border-white/5 text-white/40 text-xs">
                    No applications added yet. Use the form above to post your first app download and Downloader code.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {appDownloads.map((app) => {
                      const hasDownloaderCode = !!app.downloader_code && app.downloader_code.trim() !== '';
                      return (
                        <div
                          key={app.id}
                          className="p-4 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col justify-between gap-3 hover:border-cyan-500/30 transition-all"
                        >
                          <div className="flex items-start gap-3">
                            {app.logo_url ? (
                              <img
                                src={app.logo_url}
                                alt={app.name}
                                className="w-12 h-12 rounded-xl object-contain bg-black/60 border border-white/15 p-1 shrink-0"
                                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white font-black text-lg shrink-0">
                                {app.name?.charAt(0) || 'A'}
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h5 className="text-xs font-bold text-white truncate">{app.name}</h5>
                                {app.version && (
                                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 text-[10px] font-mono">
                                    {app.version}
                                  </span>
                                )}
                              </div>

                              <p className="text-[11px] text-white/40 line-clamp-1 mt-0.5">
                                {app.description || 'No description provided.'}
                              </p>

                              {/* Downloader Code Badge */}
                              {hasDownloaderCode && (
                                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-mono font-bold">
                                  <Flame size={12} className="text-amber-400" />
                                  <span>Downloader: {app.downloader_code}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Reseller Permissions Status & Actions */}
                          <div className="flex items-center justify-between border-t border-white/5 pt-2.5 text-xs">
                            <div className="flex items-center gap-1.5">
                              {app.is_default !== false ? (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                                  ✓ Main Site + All Resellers
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-[10px] font-bold border border-cyan-500/30">
                                  Main Site + {Array.isArray(app.allowed_reseller_ids) ? app.allowed_reseller_ids.length : 0} Resellers
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <a
                                href={app.download_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-white/50 hover:text-cyan-300 border border-white/5 cursor-pointer"
                                title="Download Link"
                              >
                                <ExternalLink size={13} />
                              </a>
                              <button
                                onClick={() => handleEditApp(app)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-amber-500/20 text-white/50 hover:text-amber-400 border border-white/5 cursor-pointer"
                                title="Edit App"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteApp(app.id)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-white/50 hover:text-rose-400 border border-white/5 cursor-pointer"
                                title="Delete App"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: USER REQUESTS */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <MessageSquare size={16} />
                  <span>User Media Requests ({mediaRequests.length})</span>
                </h3>
              </div>

              {mediaRequests.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/30 rounded-2xl border border-white/5 text-white/40 text-xs">
                  No active requests from users currently.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {mediaRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={req.posterUrl || 'https://picsum.photos/seed/req/100/150'}
                          alt={req.title}
                          className="w-12 h-16 rounded-lg object-cover bg-black/50 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-bold text-white truncate">{req.title}</h5>
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-black uppercase">
                            {req.mediaType === 'tv' ? 'Series' : 'Movie'}
                          </span>
                          <p className="text-[10px] text-white/40 mt-1">Requested by: {req.username || 'User'}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-2">
                        <button
                          onClick={() => req.mediaType === 'tv' ? handleQuickAddSeriesFromRequest(req) : handleQuickAddMovieFromRequest(req)}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[10px] font-bold border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={12} />
                          <span>Quick Add</span>
                        </button>
                        <button
                          onClick={() => handleDeleteRequest(req.id)}
                          className="p-1 rounded-lg bg-white/5 hover:bg-rose-500/20 text-white/50 hover:text-rose-400 cursor-pointer"
                          title="Delete Request"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Viewers Usernames Detail Modal */}
        <AnimatePresence>
          {selectedMediaViewers && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-lg bg-[#0e111a] border border-cyan-500/30 rounded-2xl p-5 shadow-[0_0_50px_rgba(0,0,0,0.8)] space-y-4"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
                      <UserCheck size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white line-clamp-1">{selectedMediaViewers.title}</h4>
                      <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">
                        {selectedMediaViewers.category} • {selectedMediaViewers.views} Total Plays • {selectedMediaViewers.users.length} Users
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedMediaViewers(null)}
                    className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-white/60">
                    Neeche un sabhi registered users ke usernames hain jinhone is media ko play ya watch kiya hai:
                  </p>
                  
                  {selectedMediaViewers.users.length === 0 ? (
                    <div className="p-6 text-center rounded-xl bg-black/40 border border-white/5 text-white/40 text-xs italic">
                      No usernames recorded yet (played anonymously or before user login tracking).
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                      {selectedMediaViewers.users.map((username, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-cyan-500/30 transition-all"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            <span className="text-xs font-mono font-bold text-white">@{username}</span>
                          </div>
                          <span className="text-[10px] font-bold text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            Verified Viewer
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2 border-t border-white/10">
                  <button
                    onClick={() => setSelectedMediaViewers(null)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default AdminPanelModal;
