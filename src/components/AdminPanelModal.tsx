import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Settings, Film, Tv, Radio, Users, MessageSquare, Plus, Trash2, Edit2, 
  Save, RefreshCw, Upload, Check, Copy, ExternalLink, Shield, Sparkles, Key, 
  Layers, Globe, CheckCircle2, AlertCircle, Search, Eye
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
}) => {
  const [activeTab, setActiveTab] = useState<'app' | 'free_movies' | 'free_series' | 'live_events' | 'resellers' | 'requests'>('app');
  
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
    available_for_resellers: true
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
    app_link: '',
    password: '',
    license_type: '1 Year'
  });

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
      if (editingMovieId) {
        await updateDoc(doc(db, 'free_movies', editingMovieId), {
          ...movieForm,
          updatedAt: new Date().toISOString()
        });
        setEditingMovieId(null);
      } else {
        await addDoc(collection(db, 'free_movies'), {
          ...movieForm,
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
        available_for_resellers: true
      });
      alert(editingMovieId ? 'Movie updated!' : 'Movie added!');
    } catch (err: any) {
      alert('Failed to save movie: ' + err.message);
    }
  };

  const handleEditMovieClick = (movie: any) => {
    setEditingMovieId(movie.id);
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
      available_for_resellers: movie.available_for_resellers !== false
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
      const finalSeries = {
        ...seriesForm,
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
        episodes: []
      });
      alert(editingSeriesId ? 'Series updated!' : 'Series added!');
    } catch (err: any) {
      alert('Failed to save series: ' + err.message);
    }
  };

  const handleEditSeriesClick = (series: any) => {
    setEditingSeriesId(series.id);
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
            { id: 'free_movies', label: 'Free Movies', icon: Film, count: freeMovies.length },
            { id: 'free_series', label: 'Web Series', icon: Tv, count: freeSeries.length },
            { id: 'live_events', label: 'Live Events', icon: Radio, count: liveEvents.length },
            { id: 'resellers', label: 'Resellers', icon: Users, count: resellers.length },
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
                          <div className="flex items-center gap-2 text-[10px] text-white/50 mt-1">
                            {m.is_embed && <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold">EMBED</span>}
                            {m.password && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">LOCK</span>}
                            {m.available_for_resellers !== false && <span className="text-emerald-400">Reseller OK</span>}
                          </div>
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
                          <div className="flex items-center gap-2 text-[10px] text-white/50 mt-1">
                            {s.episodes?.length > 0 && <span className="text-purple-400 font-bold">{s.episodes.length} Episodes</span>}
                            {s.playlist_url && <span className="text-cyan-400 font-bold">M3U Playlist</span>}
                            {s.password && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">LOCK</span>}
                          </div>
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
                      </div>
                    );
                  })}
                </div>
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
      </motion.div>
    </div>
  );
};

export default AdminPanelModal;
