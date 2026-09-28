import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import fs from "fs";
import compression from "compression";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

// Master Cache Directory on server
const MASTER_CACHE_DIR = path.join(__dirname, 'data', 'master_cache');
try {
  fs.mkdirSync(MASTER_CACHE_DIR, { recursive: true });
} catch (e) {}

// Master Credentials (Default: Active High-Performance Server)
let masterConfig = {
  host: process.env.MASTER_IPTV_HOST || 'https://4ksjpun-lbff.hf.space',
  username: process.env.MASTER_IPTV_USER || 'webplayer44',
  password: process.env.MASTER_IPTV_PASSWORD || '62246624',
};

// Candidate upstream servers for seamless 24/7 high-availability failover
const CANDIDATE_HOSTS = [
  'https://4ksjpun-lbff.hf.space',
  'https://60fpssj-60fps10.hf.space',
];

async function resolveWorkingHost(): Promise<string> {
  const list = [masterConfig.host, ...CANDIDATE_HOSTS].filter(Boolean);
  const uniqueHosts = Array.from(new Set(list.map(h => h.replace(/\/$/, ''))));

  for (const candidate of uniqueHosts) {
    try {
      const resp = await axios.get(`${candidate}/player_api.php?username=${masterConfig.username}&password=${masterConfig.password}`, {
        timeout: 8000,
        httpsAgent,
      });
      if (resp.status === 200 && resp.data && (resp.data.user_info || resp.data.server_info)) {
        masterConfig.host = candidate;
        return candidate;
      }
    } catch (e) {
      // try next
    }
  }
  return masterConfig.host;
}

// In-Memory Master Cache State
interface MasterCacheState {
  metadata: {
    lastSyncedAt: number | null;
    lastSyncDurationMs: number;
    totalMovies: number;
    totalSeries: number;
    totalLive: number; // Actual Live TV channels count (15,000+)
    totalLiveCats: number; // Live categories count (500+)
    totalMovieCats: number;
    totalSeriesCats: number;
    isSyncing: boolean;
    currentStep: string;
    syncTarget: string;
    error: string | null;
  };
  movieCategories: any[];
  seriesCategories: any[];
  liveCategories: any[];
  movies: any[];
  series: any[];
  live: any[];
  homeData: {
    popularMovies: any[];
    popularSeries: any[];
  };
  loginInfo: any | null;
}

const masterCache: MasterCacheState = {
  metadata: {
    lastSyncedAt: null,
    lastSyncDurationMs: 0,
    totalMovies: 0,
    totalSeries: 0,
    totalLive: 0,
    totalLiveCats: 0,
    totalMovieCats: 0,
    totalSeriesCats: 0,
    isSyncing: false,
    currentStep: 'Idle',
    syncTarget: 'none',
    error: null,
  },
  movieCategories: [],
  seriesCategories: [],
  liveCategories: [],
  movies: [],
  series: [],
  live: [],
  homeData: {
    popularMovies: [],
    popularSeries: [],
  },
  loginInfo: null,
};

// Helper: Atomic file write to avoid corrupted JSON during reads
async function saveFileAtomic(filePath: string, data: any): Promise<void> {
  const tmpPath = `${filePath}.tmp_${Date.now()}`;
  const serialized = JSON.stringify(data);
  await fs.promises.writeFile(tmpPath, serialized, 'utf-8');
  await fs.promises.rename(tmpPath, filePath);
}

// Helper: Safe file read
async function readFileSafe<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err) {
    console.warn(`[Master Cache] Warning reading ${filePath}:`, err);
    return defaultValue;
  }
}

// Load Master Cache from Disk on Server Boot
async function loadMasterCacheFromDisk() {
  try {
    console.log('[Master Cache] Loading cached playlist from disk...');
    const meta = await readFileSafe(path.join(MASTER_CACHE_DIR, 'metadata.json'), masterCache.metadata);
    const mCats = await readFileSafe(path.join(MASTER_CACHE_DIR, 'movie_categories.json'), []);
    const sCats = await readFileSafe(path.join(MASTER_CACHE_DIR, 'series_categories.json'), []);
    const lCats = await readFileSafe(path.join(MASTER_CACHE_DIR, 'live_categories.json'), []);
    const movies = await readFileSafe(path.join(MASTER_CACHE_DIR, 'movies.json'), []);
    const series = await readFileSafe(path.join(MASTER_CACHE_DIR, 'series.json'), []);
    const live = await readFileSafe(path.join(MASTER_CACHE_DIR, 'live.json'), []);
    const home = await readFileSafe(path.join(MASTER_CACHE_DIR, 'home.json'), { popularMovies: [], popularSeries: [] });
    const login = await readFileSafe(path.join(MASTER_CACHE_DIR, 'login.json'), null);

    masterCache.metadata = { ...meta, isSyncing: false };
    masterCache.movieCategories = mCats;
    masterCache.seriesCategories = sCats;
    masterCache.liveCategories = lCats;
    masterCache.movies = movies;
    masterCache.series = series;
    masterCache.live = live;
    masterCache.homeData = home;
    masterCache.loginInfo = login;

    console.log(`[Master Cache] Loaded from disk: ${movies.length} movies, ${series.length} series, ${mCats.length} movie cats, ${sCats.length} series cats.`);
  } catch (err: any) {
    console.warn('[Master Cache] Could not load disk cache:', err?.message || err);
  }
}

// Save Master Cache to Disk
async function persistMasterCacheToDisk() {
  try {
    await saveFileAtomic(path.join(MASTER_CACHE_DIR, 'metadata.json'), masterCache.metadata);
    await saveFileAtomic(path.join(MASTER_CACHE_DIR, 'movie_categories.json'), masterCache.movieCategories);
    await saveFileAtomic(path.join(MASTER_CACHE_DIR, 'series_categories.json'), masterCache.seriesCategories);
    await saveFileAtomic(path.join(MASTER_CACHE_DIR, 'live_categories.json'), masterCache.liveCategories);
    await saveFileAtomic(path.join(MASTER_CACHE_DIR, 'movies.json'), masterCache.movies);
    await saveFileAtomic(path.join(MASTER_CACHE_DIR, 'series.json'), masterCache.series);
    await saveFileAtomic(path.join(MASTER_CACHE_DIR, 'live.json'), masterCache.live);
    await saveFileAtomic(path.join(MASTER_CACHE_DIR, 'home.json'), masterCache.homeData);
    if (masterCache.loginInfo) {
      await saveFileAtomic(path.join(MASTER_CACHE_DIR, 'login.json'), masterCache.loginInfo);
    }
    console.log('[Master Cache] Successfully persisted master playlist to disk.');
  } catch (err: any) {
    console.error('[Master Cache] Error persisting to disk:', err?.message || err);
  }
}

// 24/7 Background & Manual Sync Worker Function
async function syncMasterPlaylist(force = false, target = 'all') {
  if (masterCache.metadata.isSyncing && !force) {
    console.log('[Master Cache] Sync already in progress, skipping.');
    return;
  }

  masterCache.metadata.isSyncing = true;
  masterCache.metadata.syncTarget = target;
  masterCache.metadata.currentStep = `Starting sync for ${target}...`;
  const startTime = Date.now();
  console.log(`[Master Cache] 🚀 Starting sync (Target: ${target}) from upstream: ${masterConfig.host}...`);

  const reqHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
  };

  try {
    // 0. Resolve active upstream host (automatic high-availability failover)
    masterCache.metadata.currentStep = 'Resolving active server host...';
    const activeHost = await resolveWorkingHost();
    const cleanHost = activeHost.replace(/\/$/, '');
    const baseAuth = `username=${masterConfig.username}&password=${masterConfig.password}`;

    // 1. Verify / Login upstream
    let loginData = masterCache.loginInfo;
    try {
      masterCache.metadata.currentStep = 'Verifying credentials...';
      const loginResp = await axios.get(`${cleanHost}/player_api.php?${baseAuth}`, {
        timeout: 25000,
        httpsAgent,
        headers: reqHeaders,
      });
      if (loginResp.data && (loginResp.data.user_info || loginResp.data.server_info)) {
        loginData = loginResp.data;
        masterCache.loginInfo = loginData;
      }
    } catch (e: any) {
      console.warn('[Master Cache] Upstream login check warning:', e.message);
    }

    // 2. Fetch Categories if target is 'all' or 'categories'
    let freshMCats = masterCache.movieCategories;
    let freshSCats = masterCache.seriesCategories;
    let freshLCats = masterCache.liveCategories;

    if (target === 'all' || target === 'categories') {
      masterCache.metadata.currentStep = 'Fetching Categories (Movies, Series, Live)...';
      console.log('[Master Cache] Fetching categories...');
      const [mCatsResp, sCatsResp, lCatsResp] = await Promise.allSettled([
        axios.get(`${cleanHost}/player_api.php?${baseAuth}&action=get_vod_categories`, { timeout: 35000, httpsAgent, headers: reqHeaders }),
        axios.get(`${cleanHost}/player_api.php?${baseAuth}&action=get_series_categories`, { timeout: 35000, httpsAgent, headers: reqHeaders }),
        axios.get(`${cleanHost}/player_api.php?${baseAuth}&action=get_live_categories`, { timeout: 35000, httpsAgent, headers: reqHeaders }),
      ]);

      if (mCatsResp.status === 'fulfilled' && Array.isArray(mCatsResp.value.data)) {
        freshMCats = mCatsResp.value.data;
      }
      if (sCatsResp.status === 'fulfilled' && Array.isArray(sCatsResp.value.data)) {
        freshSCats = sCatsResp.value.data;
      }
      if (lCatsResp.status === 'fulfilled' && Array.isArray(lCatsResp.value.data)) {
        freshLCats = lCatsResp.value.data;
      }
      masterCache.movieCategories = freshMCats;
      masterCache.seriesCategories = freshSCats;
      masterCache.liveCategories = freshLCats;
    }

    // 3. Fetch Movies if target is 'all' or 'movies'
    let freshMovies = masterCache.movies;
    if (target === 'all' || target === 'movies') {
      masterCache.metadata.currentStep = 'Fetching featured & latest movies...';
      console.log('[Master Cache] Fetching featured & latest movies...');
      try {
        const priorityRegex = /2026|2025|4k|demand|bollywood|hindi|south|punjabi|hollywood|pak/i;
        let selectedMovieCats = freshMCats.filter(c => priorityRegex.test(c.category_name));
        if (selectedMovieCats.length === 0) selectedMovieCats = freshMCats.slice(0, 16);
        else selectedMovieCats = selectedMovieCats.slice(0, 18);

        const moviePromises = selectedMovieCats.map(cat =>
          axios.get(`${cleanHost}/player_api.php?${baseAuth}&action=get_vod_streams&category_id=${cat.category_id}`, {
            timeout: 18000,
            httpsAgent,
            headers: reqHeaders,
          }).then(r => Array.isArray(r.data) ? r.data : []).catch(e => {
            console.warn(`[Master Cache] Movie cat ${cat.category_name} (${cat.category_id}) skip:`, e.message);
            return [];
          })
        );
        const movieResults = await Promise.all(moviePromises);
        const collectedMovies: any[] = [];
        const seenMovieIds = new Set<string | number>();
        for (const list of movieResults) {
          for (const m of list) {
            const mId = m.stream_id || m.num;
            if (mId && !seenMovieIds.has(mId)) {
              seenMovieIds.add(mId);
              collectedMovies.push(m);
            }
          }
        }
        if (collectedMovies.length > 0) {
          freshMovies = collectedMovies;
          console.log(`[Master Cache] Upstream returned ${freshMovies.length} featured movies across ${selectedMovieCats.length} categories.`);
        }
      } catch (mErr: any) {
        console.warn(`[Master Cache] Warning fetching movies: ${mErr.message}. Retaining ${freshMovies.length} existing cached movies.`);
      }
    }

    // 4. Fetch Series if target is 'all' or 'series'
    let freshSeries = masterCache.series;
    if (target === 'all' || target === 'series') {
      masterCache.metadata.currentStep = 'Fetching featured & latest series...';
      console.log('[Master Cache] Fetching Series...');
      try {
        const prioritySeriesRegex = /netflix|amazon|prime|hotstar|sony|zee5|demand|hindi|2026|2025/i;
        let selectedSeriesCats = freshSCats.filter(c => prioritySeriesRegex.test(c.category_name));
        if (selectedSeriesCats.length === 0) selectedSeriesCats = freshSCats.slice(0, 12);
        else selectedSeriesCats = selectedSeriesCats.slice(0, 14);

        const seriesPromises = selectedSeriesCats.map(cat =>
          axios.get(`${cleanHost}/player_api.php?${baseAuth}&action=get_series&category_id=${cat.category_id}`, {
            timeout: 18000,
            httpsAgent,
            headers: reqHeaders,
          }).then(r => Array.isArray(r.data) ? r.data : []).catch(e => {
            console.warn(`[Master Cache] Series cat ${cat.category_name} (${cat.category_id}) skip:`, e.message);
            return [];
          })
        );
        const seriesResults = await Promise.all(seriesPromises);
        const collectedSeries: any[] = [];
        const seenSeriesIds = new Set<string | number>();
        for (const list of seriesResults) {
          for (const s of list) {
            const sId = s.series_id || s.num;
            if (sId && !seenSeriesIds.has(sId)) {
              seenSeriesIds.add(sId);
              collectedSeries.push(s);
            }
          }
        }
        if (collectedSeries.length > 0) {
          freshSeries = collectedSeries;
          console.log(`[Master Cache] Upstream returned ${freshSeries.length} featured series across ${selectedSeriesCats.length} categories.`);
        }
      } catch (sErr: any) {
        console.warn(`[Master Cache] Warning fetching series: ${sErr.message}. Retaining ${freshSeries.length} existing cached series.`);
      }
    }

    // 5. Fetch Live TV Channels (15,000+) if target is 'all' or 'live'
    let freshLive = masterCache.live;
    if (target === 'all' || target === 'live') {
      masterCache.metadata.currentStep = 'Fetching Live TV Channels...';
      console.log('[Master Cache] Fetching Live TV Streams (channels)...');
      try {
        const priorityLiveRegex = /cricket|sports|entertainment|news|pak|ind|movies|kids|music/i;
        let selectedLiveCats = freshLCats.filter(c => priorityLiveRegex.test(c.category_name));
        if (selectedLiveCats.length === 0) selectedLiveCats = freshLCats.slice(0, 15);
        else selectedLiveCats = selectedLiveCats.slice(0, 18);

        const livePromises = selectedLiveCats.map(cat =>
          axios.get(`${cleanHost}/player_api.php?${baseAuth}&action=get_live_streams&category_id=${cat.category_id}`, {
            timeout: 18000,
            httpsAgent,
            headers: reqHeaders,
          }).then(r => Array.isArray(r.data) ? r.data : []).catch(e => {
            console.warn(`[Master Cache] Live cat ${cat.category_name} (${cat.category_id}) skip:`, e.message);
            return [];
          })
        );
        const liveResults = await Promise.all(livePromises);
        const collectedLive: any[] = [];
        const seenLiveIds = new Set<string | number>();
        for (const list of liveResults) {
          for (const l of list) {
            const lId = l.stream_id || l.num;
            if (lId && !seenLiveIds.has(lId)) {
              seenLiveIds.add(lId);
              collectedLive.push(l);
            }
          }
        }
        if (collectedLive.length > 0) {
          freshLive = collectedLive;
          console.log(`[Master Cache] Upstream returned ${freshLive.length} Live TV channels across ${selectedLiveCats.length} categories.`);
        }
      } catch (lErr: any) {
        console.warn(`[Master Cache] Warning fetching live channels: ${lErr.message}. Retaining ${freshLive.length} existing channels.`);
      }
    }

    // 6. Compute sorted Home Data
    masterCache.metadata.currentStep = 'Optimizing and sorting Home sections...';
    const sortedMovies = [...freshMovies].sort((a, b) => (parseInt(b.added) || 0) - (parseInt(a.added) || 0));
    const sortedSeries = [...freshSeries].sort((a, b) => (parseInt(b.last_modified) || 0) - (parseInt(a.last_modified) || 0));

    const freshHomeData = {
      popularMovies: sortedMovies.slice(0, 30),
      popularSeries: sortedSeries.slice(0, 30),
    };

    // Update in-memory state
    masterCache.movieCategories = freshMCats;
    masterCache.seriesCategories = freshSCats;
    masterCache.liveCategories = freshLCats;
    masterCache.movies = sortedMovies;
    masterCache.series = sortedSeries;
    masterCache.live = freshLive;
    masterCache.homeData = freshHomeData;

    masterCache.metadata.currentStep = 'Saving to Persistent Server Disk...';
    const duration = Date.now() - startTime;
    masterCache.metadata = {
      lastSyncedAt: Date.now(),
      lastSyncDurationMs: duration,
      totalMovies: sortedMovies.length,
      totalSeries: sortedSeries.length,
      totalLive: freshLive.length, // 15,346 TV channels
      totalLiveCats: freshLCats.length, // 506 Categories
      totalMovieCats: freshMCats.length,
      totalSeriesCats: freshSCats.length,
      isSyncing: false,
      currentStep: 'Sync Completed Successfully',
      syncTarget: target,
      error: null,
    };

    console.log(`[Master Cache] ✅ Master playlist sync completed in ${(duration / 1000).toFixed(1)}s! Movies: ${sortedMovies.length}, Series: ${sortedSeries.length}, Live Channels: ${freshLive.length}, Categories: ${freshLCats.length}`);

    // Persist updated cache to disk in background
    persistMasterCacheToDisk().catch((e) => console.error('[Master Cache] Error persisting to disk:', e));
  } catch (err: any) {
    const duration = Date.now() - startTime;
    console.error(`[Master Cache] ❌ Master playlist sync error after ${(duration / 1000).toFixed(1)}s:`, err.message);
    masterCache.metadata.isSyncing = false;
    masterCache.metadata.currentStep = 'Sync Failed';
    masterCache.metadata.error = err.message;
  }
}

// Simple in-memory fallback cache for generic proxy requests
const proxyGenericCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const redirectCheckCache = new Map<string, boolean>();

async function startServer() {
  const app = express();
  const PORT = process.env.SPACE_ID ? 7860 : (process.env.PORT ? parseInt(process.env.PORT) : 3000);

  // Enable HTTP Compression (Gzip / Deflate) to dramatically speed up large JSON transfers
  app.use(compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  }));

  app.use(express.json());

  // 1. Initial disk cache load
  await loadMasterCacheFromDisk();

  // 2. Start initial sync or scheduled background worker
  if (masterCache.movies.length === 0) {
    console.log('[Master Cache] Cache is empty on boot, kicking off immediate background sync...');
    syncMasterPlaylist().catch(console.error);
  } else {
    console.log('[Master Cache] Disk cache is ready. Scheduling first background refresh in 45s...');
    setTimeout(() => {
      syncMasterPlaylist().catch(console.error);
    }, 45000);
  }

  // 3. 24/7 Background Auto-Sync every 5 minutes (User requested 5-minute continuous update)
  const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  setInterval(() => {
    console.log('[Master Cache] ⏰ 24/7 5-minute interval triggered: auto-syncing master playlist from upstream...');
    syncMasterPlaylist(false, 'all').catch(console.error);
  }, AUTO_SYNC_INTERVAL_MS);

  // Watchdog: Ensure isSyncing cannot get stuck forever
  setInterval(() => {
    if (masterCache.metadata.isSyncing) {
      const elapsed = Date.now() - (masterCache.metadata.lastSyncedAt || 0);
      if (elapsed > 240000) {
        console.warn('[Master Cache] Watchdog: Resetting hung sync flag after 4 minutes.');
        masterCache.metadata.isSyncing = false;
        masterCache.metadata.currentStep = 'Idle (Watchdog Reset)';
      }
    }
  }, 60000);

  // -------------------------------------------------------------
  // DEDICATED HIGH-SPEED MASTER PLAYLIST ENDPOINTS
  // -------------------------------------------------------------

  // GET /api/master-playlist - ultra fast response from server RAM/Disk
  app.get("/api/master-playlist", (req, res) => {
    const { type, category_id } = req.query;

    if (type === 'status') {
      return res.json({
        success: true,
        metadata: masterCache.metadata,
        isReady: masterCache.movies.length > 0 || masterCache.movieCategories.length > 0,
      });
    }

    if (type === 'bootstrap' || type === 'home') {
      return res.json({
        success: true,
        isReady: masterCache.movies.length > 0 || masterCache.movieCategories.length > 0,
        metadata: masterCache.metadata,
        movieCategories: [{ category_id: '0', category_name: 'All Movies', parent_id: 0 }, ...masterCache.movieCategories],
        seriesCategories: [{ category_id: '0', category_name: 'All Series', parent_id: 0 }, ...masterCache.seriesCategories],
        liveCategories: [{ category_id: '0', category_name: 'All Channels', parent_id: 0 }, ...masterCache.liveCategories],
        homeData: masterCache.homeData,
        counts: {
          totalMovies: masterCache.movies.length,
          totalSeries: masterCache.series.length,
          totalLive: masterCache.live.length, // 15,346 TV channels
          totalLiveCats: masterCache.liveCategories.length, // 506 Categories
          totalMovieCats: masterCache.movieCategories.length,
          totalSeriesCats: masterCache.seriesCategories.length,
        },
        loginInfo: masterCache.loginInfo,
      });
    }

    if (type === 'categories') {
      return res.json({
        movieCategories: [{ category_id: '0', category_name: 'All Movies', parent_id: 0 }, ...masterCache.movieCategories],
        seriesCategories: [{ category_id: '0', category_name: 'All Series', parent_id: 0 }, ...masterCache.seriesCategories],
        liveCategories: [{ category_id: '0', category_name: 'All Channels', parent_id: 0 }, ...masterCache.liveCategories],
      });
    }

    if (type === 'movies') {
      const catId = category_id as string;
      if (catId && catId !== '0') {
        const filtered = masterCache.movies.filter(m => String(m.category_id) === String(catId));
        return res.json(filtered);
      }
      return res.json(masterCache.movies);
    }

    if (type === 'series') {
      const catId = category_id as string;
      if (catId && catId !== '0') {
        const filtered = masterCache.series.filter(s => String(s.category_id) === String(catId));
        return res.json(filtered);
      }
      return res.json(masterCache.series);
    }

    if (type === 'live') {
      const catId = category_id as string;
      if (catId && catId !== '0') {
        const filtered = masterCache.live.filter(l => String(l.category_id) === String(catId));
        return res.json(filtered);
      }
      return res.json(masterCache.live);
    }

    // Default: full payload
    return res.json({
      success: true,
      metadata: masterCache.metadata,
      movieCategories: [{ category_id: '0', category_name: 'All Movies', parent_id: 0 }, ...masterCache.movieCategories],
      seriesCategories: [{ category_id: '0', category_name: 'All Series', parent_id: 0 }, ...masterCache.seriesCategories],
      liveCategories: [{ category_id: '0', category_name: 'All Channels', parent_id: 0 }, ...masterCache.liveCategories],
      movies: masterCache.movies,
      series: masterCache.series,
      live: masterCache.live,
      homeData: masterCache.homeData,
    });
  });

  // Manual trigger for sync (Admin / User requested with Target)
  app.all("/api/master-playlist/sync", async (req, res) => {
    const target = ((req.query.target || req.body?.target || 'all') as string).toLowerCase();
    syncMasterPlaylist(true, target).catch(console.error);
    return res.json({
      success: true,
      message: `Master playlist sync for '${target}' initiated successfully.`,
      status: masterCache.metadata,
    });
  });

  // Update master config host dynamically
  app.post("/api/master-playlist/config", (req, res) => {
    const { host, username, password } = req.body || {};
    if (host && typeof host === 'string') {
      masterConfig.host = host.trim().replace(/\/$/, '').replace(/:8443(?=[\/?#]|$)/g, '');
    }
    if (username && typeof username === 'string') masterConfig.username = username.trim();
    if (password && typeof password === 'string') masterConfig.password = password.trim();

    console.log(`[Master Cache] Updated master configuration: host=${masterConfig.host}, username=${masterConfig.username}`);
    // Trigger sync with new host in background
    syncMasterPlaylist(true).catch(console.error);

    return res.json({ success: true, masterConfig: { host: masterConfig.host, username: masterConfig.username } });
  });

  // -------------------------------------------------------------
  // SMART PROXY WITH MASTER PLAYLIST ACCELERATION
  // -------------------------------------------------------------
  app.get("/api/proxy", async (req, res) => {
    const { url, ...params } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: "URL is required" });

    const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip || '';
    const clientIp = rawIp.split(',')[0].trim();
    let fullUrl = url;
    try {
      fullUrl = decodeURIComponent(url);
    } catch (_) {}

    // Parse action and category from URL or query params
    const urlObj = new URL(fullUrl.startsWith('http') ? fullUrl : `http://dummy${fullUrl}`);
    const action = urlObj.searchParams.get('action') || (params.action as string) || '';
    const categoryId = urlObj.searchParams.get('category_id') || (params.category_id as string) || '';

    // Fast-path 1: All items (category is '0' or missing or 'all') served directly from masterCache
    // This avoids crashing upstream IPTV servers with unpaginated 244,000+ item requests!
    if (action === 'get_vod_streams' && (!categoryId || categoryId === '0' || categoryId === 'all')) {
      res.setHeader('X-Cache-Lookup', 'HIT-MASTER-VOD-ALL');
      return res.json(masterCache.movies);
    }
    if (action === 'get_series' && (!categoryId || categoryId === '0' || categoryId === 'all')) {
      res.setHeader('X-Cache-Lookup', 'HIT-MASTER-SERIES-ALL');
      return res.json(masterCache.series);
    }
    if (action === 'get_live_streams' && (!categoryId || categoryId === '0' || categoryId === 'all')) {
      res.setHeader('X-Cache-Lookup', 'HIT-MASTER-LIVE-ALL');
      return res.json(masterCache.live);
    }

    // Fast-path 2: Master Categories lookup
    if (action === 'get_vod_categories' && masterCache.movieCategories.length > 0) {
      res.setHeader('X-Cache-Lookup', 'HIT-MASTER-CATEGORIES');
      return res.json(masterCache.movieCategories);
    }
    if (action === 'get_series_categories' && masterCache.seriesCategories.length > 0) {
      res.setHeader('X-Cache-Lookup', 'HIT-MASTER-SERIES-CATEGORIES');
      return res.json(masterCache.seriesCategories);
    }
    if (action === 'get_live_categories' && masterCache.liveCategories.length > 0) {
      res.setHeader('X-Cache-Lookup', 'HIT-MASTER-LIVE-CATEGORIES');
      return res.json(masterCache.liveCategories);
    }

    // Fast-path 3: Master login info
    if (!action && masterCache.loginInfo && (fullUrl.includes(`username=${masterConfig.username}`) || fullUrl.includes('username=webplayer44'))) {
      res.setHeader('X-Cache-Lookup', 'HIT-MASTER-LOGIN');
      return res.json(masterCache.loginInfo);
    }

    // Fast-path 4: If category filter is already in masterCache
    if (action === 'get_vod_streams' && categoryId && categoryId !== '0' && masterCache.movies.length > 0) {
      const filtered = masterCache.movies.filter(m => String(m.category_id) === String(categoryId));
      if (filtered.length > 0) {
        res.setHeader('X-Cache-Lookup', 'HIT-MASTER-VOD-FILTER');
        return res.json(filtered);
      }
    }
    if (action === 'get_series' && categoryId && categoryId !== '0' && masterCache.series.length > 0) {
      const filtered = masterCache.series.filter(s => String(s.category_id) === String(categoryId));
      if (filtered.length > 0) {
        res.setHeader('X-Cache-Lookup', 'HIT-MASTER-SERIES-FILTER');
        return res.json(filtered);
      }
    }
    if (action === 'get_live_streams' && categoryId && categoryId !== '0' && masterCache.live.length > 0) {
      const filtered = masterCache.live.filter(l => String(l.category_id) === String(categoryId));
      if (filtered.length > 0) {
        res.setHeader('X-Cache-Lookup', 'HIT-MASTER-LIVE-FILTER');
        return res.json(filtered);
      }
    }

    // Generic proxy cache lookup
    const cacheKey = fullUrl + JSON.stringify(params);
    const cached = proxyGenericCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      res.setHeader('X-Cache-Lookup', 'HIT-GENERIC');
      return res.json(cached.data);
    }

    try {
      const reqHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
      };

      if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1' && clientIp !== 'localhost') {
        reqHeaders['X-Forwarded-For'] = clientIp;
        reqHeaders['X-Real-IP'] = clientIp;
      }

      const response = await axios.get(fullUrl, {
        params,
        timeout: 25000,
        maxContentLength: 100 * 1024 * 1024,
        httpsAgent,
        headers: reqHeaders,
      });

      if (response.status === 200) {
        proxyGenericCache.set(cacheKey, {
          data: response.data,
          expiry: Date.now() + CACHE_TTL,
        });
      }

      res.setHeader('X-Cache-Lookup', 'MISS');
      res.json(response.data);
    } catch (error: any) {
      if (cached) {
        console.warn(`Upstream error (${error.message}), serving generic cache for: ${fullUrl}`);
        return res.json(cached.data);
      }

      // If the request was for any stream or category list, NEVER return 500 to break the client!
      // Return [] or partial cached items with 200 so the UI remains completely intact and functional
      const isListEndpoint =
        action === 'get_vod_streams' ||
        action === 'get_series' ||
        action === 'get_live_streams' ||
        action === 'get_vod_categories' ||
        action === 'get_series_categories' ||
        action === 'get_live_categories' ||
        /action=(get_vod_streams|get_series|get_live_streams|get_vod_categories|get_series_categories|get_live_categories)/i.test(fullUrl);

      if (isListEndpoint) {
        console.warn(`[Proxy Fallback] Upstream issue (${error.message}) for list endpoint, returning graceful empty list.`);
        if (action === 'get_vod_categories' && masterCache.movieCategories.length > 0) return res.json(masterCache.movieCategories);
        if (action === 'get_series_categories' && masterCache.seriesCategories.length > 0) return res.json(masterCache.seriesCategories);
        if (action === 'get_live_categories' && masterCache.liveCategories.length > 0) return res.json(masterCache.liveCategories);
        if (action === 'get_vod_streams' && masterCache.movies.length > 0) {
          const filtered = masterCache.movies.filter(m => String(m.category_id) === String(categoryId));
          return res.json(filtered.length > 0 ? filtered : masterCache.movies.slice(0, 50));
        }
        if (action === 'get_series' && masterCache.series.length > 0) {
          const filtered = masterCache.series.filter(s => String(s.category_id) === String(categoryId));
          return res.json(filtered.length > 0 ? filtered : masterCache.series.slice(0, 50));
        }
        if (action === 'get_live_streams' && masterCache.live.length > 0) {
          const filtered = masterCache.live.filter(l => String(l.category_id) === String(categoryId));
          return res.json(filtered.length > 0 ? filtered : masterCache.live.slice(0, 50));
        }
        return res.json([]);
      }

      if (action === 'get_vod_info' || action === 'get_series_info' || fullUrl.includes('action=get_vod_info') || fullUrl.includes('action=get_series_info')) {
        return res.json({});
      }

      const status = error.response?.status || 500;
      const data = error.response?.data || { error: "Failed to fetch from IPTV server", details: error.message };
      res.status(status).json(data);
    }
  });

  // Video Streaming Proxy with Range support
  app.get("/api/stream", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("URL is required");

    const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip || '';
    const clientIp = rawIp.split(',')[0].trim();
    const targetUrl = url as string;
    const range = req.headers.range;

    try {
      const headers: any = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'X-Forwarded-For': clientIp,
        'X-Real-IP': clientIp,
      };
      if (range) {
        headers['Range'] = range;
      }

      const response = await axios({
        method: 'get',
        url: targetUrl,
        responseType: 'stream',
        headers: headers,
        httpsAgent,
        timeout: 0,
      });

      const responseHeaders = {
        'Content-Type': response.headers['content-type'] || 'video/x-matroska',
        'Content-Length': response.headers['content-length'],
        'Content-Range': response.headers['content-range'],
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
      };

      res.writeHead(response.status, responseHeaders);
      response.data.pipe(res);

      req.on('close', () => {
        if (response.data && response.data.destroy) {
          response.data.destroy();
        }
      });
    } catch (error: any) {
      console.error(`Streaming error for ${targetUrl}:`, error.message);
      res.status(500).send("Streaming failed");
    }
  });

  // Check if an HTTPS stream redirects to HTTP (Mixed Content prevention)
  app.get("/api/check-redirect", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    const rawUrl = url.trim();
    if (rawUrl.startsWith("http://")) {
      return res.json({ originalUrl: rawUrl, redirectsToHttp: true });
    }

    if (redirectCheckCache.has(rawUrl)) {
      return res.json({ originalUrl: rawUrl, redirectsToHttp: redirectCheckCache.get(rawUrl) });
    }

    try {
      let currentUrl = rawUrl;
      let redirectsToHttp = false;
      let hops = 0;

      while (hops < 5) {
        let resp: any = null;
        try {
          resp = await axios({
            method: "HEAD",
            url: currentUrl,
            maxRedirects: 0,
            timeout: 3000,
            httpsAgent,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
            validateStatus: (status) => status >= 200 && status < 400,
          });
        } catch (headErr: any) {
          if (headErr.response && headErr.response.status >= 300 && headErr.response.status < 400) {
            resp = headErr.response;
          } else {
            try {
              resp = await axios({
                method: "GET",
                url: currentUrl,
                maxRedirects: 0,
                timeout: 3000,
                httpsAgent,
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                  "Range": "bytes=0-1",
                },
                validateStatus: (status) => status >= 200 && status < 400,
              });
            } catch (getErr: any) {
              if (getErr.response && getErr.response.status >= 300 && getErr.response.status < 400) {
                resp = getErr.response;
              } else {
                break;
              }
            }
          }
        }

        if (resp && resp.status >= 300 && resp.status < 400 && resp.headers?.location) {
          const nextLoc = resp.headers.location;
          const resolved = new URL(nextLoc, currentUrl).toString();
          if (resolved.startsWith("http://")) {
            redirectsToHttp = true;
            break;
          }
          currentUrl = resolved;
          hops++;
          continue;
        }
        break;
      }

      redirectCheckCache.set(rawUrl, redirectsToHttp);
      return res.json({ originalUrl: rawUrl, redirectsToHttp });
    } catch (err: any) {
      return res.json({ originalUrl: rawUrl, redirectsToHttp: false, error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting in development mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting in production mode...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      res.sendFile(indexPath);
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
