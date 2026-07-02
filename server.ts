import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Simple in-memory cache for proxy requests
const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes cache duration

// ==========================================
// Robust Server-Side Fallback Data
// ==========================================
const MOCK_LOGIN_RESPONSE = {
  user_info: {
    username: "webplayer44",
    status: "Active",
    auth: 1,
    exp_date: "4102444800", // Year 2100
    is_trial: "0",
    active_cons: "0",
    max_connections: "5",
    created_at: "1719921600",
    allowed_output_formats: ["mp4", "mkv", "m3u8", "ts"]
  },
  server_info: {
    url: "https://sjstorehot-lbskip.hf.space",
    port: "443",
    https_port: "443",
    server_protocol: "https",
    rtmp_port: "80",
    timezone: "UTC",
    timestamp_now: Math.floor(Date.now() / 1000),
    time_now: new Date().toISOString()
  }
};

const MOCK_MOVIE_CATEGORIES = [
  { category_id: "0", category_name: "All Movies", parent_id: 0 },
  { category_id: "1", category_name: "Trending Now", parent_id: 0 },
  { category_id: "2", category_name: "Action & Adventure", parent_id: 0 },
  { category_id: "3", category_name: "Sci-Fi & Fantasy", parent_id: 0 },
  { category_id: "4", category_name: "Documentaries", parent_id: 0 }
];

const MOCK_SERIES_CATEGORIES = [
  { category_id: "0", category_name: "All Series", parent_id: 0 },
  { category_id: "1", category_name: "Popular Series", parent_id: 0 },
  { category_id: "2", category_name: "Sci-Fi Specials", parent_id: 0 }
];

const MOCK_LIVE_CATEGORIES = [
  { category_id: "0", category_name: "All Channels", parent_id: 0 },
  { category_id: "1", category_name: "Sports Networks", parent_id: 0 },
  { category_id: "2", category_name: "Entertainment", parent_id: 0 },
  { category_id: "3", category_name: "News Networks", parent_id: 0 }
];

const MOCK_MOVIES = [
  {
    num: 1,
    name: "Sintel (Premium 4K Stream)",
    stream_type: "movie",
    stream_id: "sintel",
    stream_icon: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&auto=format&fit=crop&q=80",
    rating: "8.5",
    rating_5_control: 4.5,
    added: "1719921600",
    category_id: "1",
    container_extension: "mpd",
    custom_sid: "",
    direct_source: "https://storage.googleapis.com/shaka-demo-assets/sintel/dash.mpd"
  },
  {
    num: 2,
    name: "Tears of Steel (Ultra HD)",
    stream_type: "movie",
    stream_id: "tears_of_steel",
    stream_icon: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=400&auto=format&fit=crop&q=80",
    rating: "8.1",
    rating_5_control: 4.0,
    added: "1719921601",
    category_id: "3",
    container_extension: "mpd",
    custom_sid: "",
    direct_source: "https://storage.googleapis.com/shaka-demo-assets/tears-of-steel/dash.mpd"
  },
  {
    num: 3,
    name: "Big Buck Bunny (Family Fun)",
    stream_type: "movie",
    stream_id: "big_buck_bunny",
    stream_icon: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&auto=format&fit=crop&q=80",
    rating: "7.8",
    rating_5_control: 4.0,
    added: "1719921602",
    category_id: "1",
    container_extension: "mp4",
    custom_sid: "",
    direct_source: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
  },
  {
    num: 4,
    name: "Angel One (Space Voyage)",
    stream_type: "movie",
    stream_id: "angel_one",
    stream_icon: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&auto=format&fit=crop&q=80",
    rating: "7.9",
    rating_5_control: 4.0,
    added: "1719921603",
    category_id: "3",
    container_extension: "mpd",
    custom_sid: "",
    direct_source: "https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd"
  }
];

const MOCK_SERIES = [
  {
    num: 1,
    name: "Tears of Steel: Behind the Scenes",
    series_id: "tears_bts",
    cover: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=400&auto=format&fit=crop&q=80",
    plot: "An exclusive look at the groundbreaking special effects and filmmaking behind the sci-fi short film Tears of Steel.",
    cast: "Derek de Lint, Sergio Hasselbaink, Rogier Schippers",
    director: "Ian Hubert",
    genre: "Documentary, Sci-Fi",
    releaseDate: "2012-09-26",
    last_modified: "1719921600",
    rating: "8.0",
    rating_5_control: 4.0,
    backdrop_path: ["https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=800&auto=format&fit=crop&q=80"],
    youtube_trailer: "https://www.youtube.com/watch?v=R6MlUcmO1Mc",
    episode_run_time: "12",
    category_id: "1"
  },
  {
    num: 2,
    name: "Sintel Chronicles",
    series_id: "sintel_chronicles",
    cover: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&auto=format&fit=crop&q=80",
    plot: "A series following Sintel, a lone wanderer, who searches for her companion baby dragon, Scales.",
    cast: "Halina Reijn, Thom Hoffman",
    director: "Colin Levy",
    genre: "Fantasy, Animation",
    releaseDate: "2010-09-27",
    last_modified: "1719921601",
    rating: "8.3",
    rating_5_control: 4.2,
    backdrop_path: ["https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&auto=format&fit=crop&q=80"],
    youtube_trailer: "https://www.youtube.com/watch?v=eRsGy_TZJyM",
    episode_run_time: "15",
    category_id: "2"
  }
];

const MOCK_LIVE_STREAMS = [
  {
    num: 1,
    name: "NASA TV Direct (Space Feed)",
    stream_type: "live",
    stream_id: "nasa_tv",
    stream_icon: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&auto=format&fit=crop&q=80",
    epg_channel_id: "NASA",
    added: "1719921600",
    category_id: "3",
    custom_sid: "",
    tv_archive: 0,
    direct_source: "https://ntv1.nasatv.net/hls/main/nasa_main.m3u8",
    tv_archive_duration: 0
  },
  {
    num: 2,
    name: "Red Bull TV Live (Extreme Sports)",
    stream_type: "live",
    stream_id: "redbull_tv",
    stream_icon: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&auto=format&fit=crop&q=80",
    epg_channel_id: "RedBull",
    added: "1719921601",
    category_id: "1",
    custom_sid: "",
    tv_archive: 0,
    direct_source: "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8",
    tv_archive_duration: 0
  }
];

const MOCK_SERIES_INFO_BTS = {
  seasons: [{ name: "Season 1", season_number: 1, episode_count: 2 }],
  episodes: {
    "1": [
      {
        id: "tears_ep1",
        episode_num: 1,
        title: "Tears of Steel Part 1",
        container_extension: "mpd",
        info: { plot: "First half of Tears of Steel", duration: "06:00" }
      }
    ]
  }
};

const MOCK_SERIES_INFO_SINTEL = {
  seasons: [{ name: "Season 1", season_number: 1, episode_count: 2 }],
  episodes: {
    "1": [
      {
        id: "sintel_ep1",
        episode_num: 1,
        title: "Sintel Part 1",
        container_extension: "mpd",
        info: { plot: "First half of Sintel's journey", duration: "07:30" }
      }
    ]
  }
};

async function startServer() {
  const app = express();
  // Auto-detect Hugging Face environment (which always has SPACE_ID) and use Port 7860, else use PORT env or default to 3000
  const PORT = process.env.SPACE_ID ? 7860 : (process.env.PORT ? parseInt(process.env.PORT) : 3000);

  app.use(express.json());

  // Proxy Xtream API to avoid CORS
  app.get("/api/proxy", async (req, res) => {
    const { url, ...params } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });

    const fullUrl = url as string;
    const cacheKey = fullUrl + JSON.stringify(params);

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      console.log(`Serving from cache: ${fullUrl}`);
      return res.json(cached.data);
    }

    console.log(`Proxying request to: ${url}`);
    try {
      const targetUrl = new URL(url as string);
      const response = await axios.get(url as string, {
        params,
        timeout: 25000, // Reduced from 60s to 25s for faster failover to fallback
        maxContentLength: 100 * 1024 * 1024, // 100MB limit
        httpsAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': '*/*',
          'Host': targetUrl.host,
        }
      });
      
      // Store in cache if successful
      if (response.status === 200) {
        cache.set(cacheKey, {
          data: response.data,
          expiry: Date.now() + CACHE_TTL
        });
      }

      console.log(`Successfully fetched data from: ${url} (Size: ${JSON.stringify(response.data).length} bytes)`);
      res.json(response.data);
    } catch (error: any) {
      console.warn(`Proxy error for ${url}, attempting server-side fallback:`, error.message);
      
      try {
        const parsedUrl = new URL(fullUrl);
        const action = parsedUrl.searchParams.get("action") || req.query.action as string;

        if (fullUrl.includes("player_api.php")) {
          if (!action) {
            console.log("Serving server-side mock login fallback");
            return res.json(MOCK_LOGIN_RESPONSE);
          }
          if (action === "get_vod_categories") {
            console.log("Serving server-side mock get_vod_categories fallback");
            return res.json(MOCK_MOVIE_CATEGORIES);
          }
          if (action === "get_series_categories") {
            console.log("Serving server-side mock get_series_categories fallback");
            return res.json(MOCK_SERIES_CATEGORIES);
          }
          if (action === "get_live_categories") {
            console.log("Serving server-side mock get_live_categories fallback");
            return res.json(MOCK_LIVE_CATEGORIES);
          }
          if (action === "get_vod_streams") {
            console.log("Serving server-side mock get_vod_streams fallback");
            return res.json(MOCK_MOVIES);
          }
          if (action === "get_series") {
            console.log("Serving server-side mock get_series fallback");
            return res.json(MOCK_SERIES);
          }
          if (action === "get_live_streams") {
            console.log("Serving server-side mock get_live_streams fallback");
            return res.json(MOCK_LIVE_STREAMS);
          }
          if (action === "get_series_info") {
            const seriesId = parsedUrl.searchParams.get("series_id") || req.query.series_id as string;
            console.log(`Serving server-side mock get_series_info fallback for ${seriesId}`);
            if (seriesId === 'tears_bts') {
              return res.json(MOCK_SERIES_INFO_BTS);
            }
            return res.json(MOCK_SERIES_INFO_SINTEL);
          }
          if (action === "get_vod_info") {
            const vodId = parsedUrl.searchParams.get("vod_id") || req.query.vod_id as string;
            console.log(`Serving server-side mock get_vod_info fallback for ${vodId}`);
            return res.json({
              info: {
                name: vodId === 'sintel' ? "Sintel" : "Tears of Steel",
                plot: "Fallback offline info details for premium stream media selection.",
                duration: "15:00"
              }
            });
          }
        }
      } catch (fallbackParseErr: any) {
        console.error("Failed to parse fallback parameters:", fallbackParseErr.message);
      }

      // If we got a 429 and have stale cache, serve it anyway as fallback
      if (error.response?.status === 429 && cached) {
        console.warn(`Got 429, serving stale cache for: ${fullUrl}`);
        return res.json(cached.data);
      }

      console.error(`Proxy error for ${url}:`, error.message);
      const status = error.response?.status || 500;
      const data = error.response?.data || { error: "Failed to fetch from IPTV server", details: error.message };
      res.status(status).json(data);
    }
  });

  // Video Streaming Proxy with Range support
  app.get("/api/stream", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("URL is required");

    const targetUrl = url as string;
    const range = req.headers.range;

    try {
      const headers: any = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
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
        timeout: 0, // No timeout for streaming
      });

      // Forward headers from target server
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
    
    // Handle SPA routing
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
