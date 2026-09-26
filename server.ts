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

// Master Credentials (Default)
let masterConfig = {
  host: process.env.MASTER_IPTV_HOST || 'https://60fpssj-60fps10.hf.space',
  username: process.env.MASTER_IPTV_USER || 'webplayer44',
  password: process.env.MASTER_IPTV_PASSWORD || '62246624',
};

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

  const cleanHost = masterConfig.host.replace(/\/$/, '');
  const baseAuth = `username=${masterConfig.username}&password=${masterConfig.password}`;

  try {
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
      masterCache.metadata.currentStep = 'Fetching 244k+ Movies from upstream server...';
      console.log('[Master Cache] Fetching VOD streams (movies)...');
      try {
        const moviesResp = await axios.get(`${cleanHost}/player_api.php?${baseAuth}&action=get_vod_streams`, {
          timeout: 180000, // 3 minutes timeout for massive lists
          maxContentLength: 200 * 1024 * 1024,
          httpsAgent,
          headers: reqHeaders,
        });
        if (Array.isArray(moviesResp.data) && moviesResp.data.length > 0) {
          freshMovies = moviesResp.data;
          console.log(`[Master Cache] Upstream returned ${freshMovies.length} movies.`);
        }
      } catch (mErr: any) {
        console.warn(`[Master Cache] Warning fetching movies: ${mErr.message}. Retaining ${freshMovies.length} existing cached movies.`);
      }
    }

    // 4. Fetch Series if target is 'all' or 'series'
    let freshSeries = masterCache.series;
    if (target === 'all' || target === 'series') {
      masterCache.metadata.currentStep = 'Fetching 53k+ Web Series from upstream server...';
      console.log('[Master Cache] Fetching Series...');
      try {
        const seriesResp = await axios.get(`${cleanHost}/player_api.php?${baseAuth}&action=get_series`, {
          timeout: 180000,
          maxContentLength: 200 * 1024 * 1024,
          httpsAgent,
          headers: reqHeaders,
        });
        if (Array.isArray(seriesResp.data) && seriesResp.data.length > 0) {
          freshSeries = seriesResp.data;
          console.log(`[Master Cache] Upstream returned ${freshSeries.length} series.`);
        }
      } catch (sErr: any) {
        console.warn(`[Master Cache] Warning fetching series: ${sErr.message}. Retaining ${freshSeries.length} existing cached series.`);
      }
    }

    // 5. Fetch Live TV Channels (15,000+) if target is 'all' or 'live'
    let freshLive = masterCache.live;
    if (target === 'all' || target === 'live') {
      masterCache.metadata.currentStep = 'Fetching 15k+ Live TV Channels from upstream server...';
      console.log('[Master Cache] Fetching Live TV Streams (channels)...');
      try {
        const liveResp = await axios.get(`${cleanHost}/player_api.php?${baseAuth}&action=get_live_streams`, {
          timeout: 120000,
          maxContentLength: 100 * 1024 * 1024,
          httpsAgent,
          headers: reqHeaders,
        });
        if (Array.isArray(liveResp.data) && liveResp.data.length > 0) {
          freshLive = liveResp.data;
          console.log(`[Master Cache] Upstream returned ${freshLive.length} Live TV channels.`);
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

  // 3. 24/7 Background Auto-Sync every 10 minutes
  setInterval(() => {
    console.log('[Master Cache] 24/7 interval triggered: refreshing master playlist...');
    syncMasterPlaylist().catch(console.error);
  }, 10 * 60 * 1000);

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
        isReady: masterCache.movies.length > 0,
      });
    }

    if (type === 'bootstrap' || type === 'home') {
      return res.json({
        success: true,
        isReady: masterCache.movies.length > 0,
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
    const fullUrl = url;

    // Check if this request is for the master credentials
    const isMasterRequest = fullUrl.includes(`username=${masterConfig.username}`) ||
                           fullUrl.includes('username=webplayer44');

    if (isMasterRequest && masterCache.movies.length > 0) {
      const urlObj = new URL(fullUrl);
      const action = urlObj.searchParams.get('action') || (params.action as string);
      const categoryId = urlObj.searchParams.get('category_id') || (params.category_id as string);

      if (action === 'get_vod_categories') {
        res.setHeader('X-Cache-Lookup', 'HIT-MASTER-CATEGORIES');
        return res.json(masterCache.movieCategories);
      }
      if (action === 'get_series_categories') {
        res.setHeader('X-Cache-Lookup', 'HIT-MASTER-SERIES-CATEGORIES');
        return res.json(masterCache.seriesCategories);
      }
      if (action === 'get_live_categories') {
        res.setHeader('X-Cache-Lookup', 'HIT-MASTER-LIVE-CATEGORIES');
        return res.json(masterCache.liveCategories);
      }
      if (action === 'get_vod_streams') {
        res.setHeader('X-Cache-Lookup', 'HIT-MASTER-VOD');
        if (categoryId && categoryId !== '0') {
          return res.json(masterCache.movies.filter(m => String(m.category_id) === String(categoryId)));
        }
        return res.json(masterCache.movies);
      }
      if (action === 'get_series') {
        res.setHeader('X-Cache-Lookup', 'HIT-MASTER-SERIES');
        if (categoryId && categoryId !== '0') {
          return res.json(masterCache.series.filter(s => String(s.category_id) === String(categoryId)));
        }
        return res.json(masterCache.series);
      }
      if (action === 'get_live_streams') {
        res.setHeader('X-Cache-Lookup', 'HIT-MASTER-LIVE');
        return res.json(masterCache.live);
      }
      if (!action && masterCache.loginInfo) {
        res.setHeader('X-Cache-Lookup', 'HIT-MASTER-LOGIN');
        return res.json(masterCache.loginInfo);
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
        timeout: 60000,
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
      if (error.response?.status === 429 && cached) {
        console.warn(`Got 429, serving stale generic cache for: ${fullUrl}`);
        return res.json(cached.data);
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
