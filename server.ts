import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import compression from "compression";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

// In-memory proxy cache for fast client navigation
const proxyGenericCache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const redirectCheckCache = new Map<string, boolean>();

async function startServer() {
  const app = express();
  const PORT = process.env.SPACE_ID ? 7860 : (process.env.PORT ? parseInt(process.env.PORT) : 3000);

  // Enable HTTP Compression (Gzip / Deflate) to accelerate JSON transfers
  app.use(compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  }));

  app.use(express.json());

  // -------------------------------------------------------------
  // HIGH-PERFORMANCE SMART PROXY ENDPOINT
  // Proxies requests from client browser directly to upstream IPTV server
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

    // In-memory cache lookup for repeated queries
    const cacheKey = fullUrl + JSON.stringify(params);
    const cached = proxyGenericCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      res.setHeader('X-Cache-Lookup', 'HIT');
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
        timeout: 35000,
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
        console.warn(`Upstream error (${error.message}), serving cache for: ${fullUrl}`);
        return res.json(cached.data);
      }

      const isListEndpoint = /action=(get_vod_streams|get_series|get_live_streams|get_vod_categories|get_series_categories|get_live_categories)/i.test(fullUrl);
      if (isListEndpoint) {
        console.warn(`[Proxy Fallback] Upstream error (${error.message}) on list endpoint, returning graceful empty list.`);
        return res.json([]);
      }

      if (/action=(get_vod_info|get_series_info)/i.test(fullUrl)) {
        return res.json({});
      }

      const status = error.response?.status || 500;
      const data = error.response?.data || { error: "Failed to fetch from IPTV server", details: error.message };
      res.status(status).json(data);
    }
  });

  // -------------------------------------------------------------
  // RECENTLY ADDED API (Top 100 with Posters & Metadata for instant homepage rendering)
  // -------------------------------------------------------------
  app.get("/api/recently-added", async (req, res) => {
    const { url, type = 'movies', limit: limitParam } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: "URL is required" });

    const limit = Math.min(parseInt(limitParam as string) || 100, 200);
    const action = type === 'series' ? 'get_series' : 'get_vod_streams';
    
    let targetUrl = url;
    try { targetUrl = decodeURIComponent(url); } catch (_) {}
    const parsed = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
    parsed.searchParams.set('action', action);

    const cacheKey = `recent_${type}_${parsed.origin}${parsed.searchParams.get('username')}_${limit}`;
    const cached = proxyGenericCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return res.json(cached.data);
    }

    try {
      const response = await axios.get(parsed.toString(), {
        timeout: 45000,
        httpsAgent,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
        }
      });

      if (Array.isArray(response.data)) {
        let sorted = response.data;
        if (type === 'series') {
          sorted = [...response.data].sort((a, b) => (parseInt(b.last_modified) || 0) - (parseInt(a.last_modified) || 0));
        } else {
          sorted = [...response.data].sort((a, b) => (parseInt(b.added) || 0) - (parseInt(a.added) || 0));
        }
        const topRecent = sorted.slice(0, limit);
        proxyGenericCache.set(cacheKey, { data: topRecent, expiry: Date.now() + 15 * 60 * 1000 });
        return res.json(topRecent);
      }
      return res.json([]);
    } catch (err: any) {
      console.warn(`[Recently-Added] Error fetching ${type}:`, err.message);
      if (cached) return res.json(cached.data);
      return res.json([]);
    }
  });

  // -------------------------------------------------------------
  // FULL LIBRARY SYNC API (For Search & Real Counts)
  // Fetches COMPLETE list of VODs and Series using action=get_vod_streams and action=get_series.
  // Immediately maps and keeps ONLY: stream_id, name, category_id, added, stream_type.
  // COMPLETELY STRIPS OUT stream_icon (posters) & all heavy metadata to prevent size bloat.
  // -------------------------------------------------------------
  app.get("/api/library-sync", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: "URL is required" });

    let targetUrl = url;
    try { targetUrl = decodeURIComponent(url); } catch (_) {}
    const parsed = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
    const cacheKey = `library_sync_${parsed.origin}${parsed.searchParams.get('username')}`;
    const cached = proxyGenericCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return res.json(cached.data);
    }

    try {
      const strippedMovies: Array<{ stream_id: string | number; name: string; category_id: string | number; added: number; stream_type: 'movie' }> = [];
      const strippedSeries: Array<{ stream_id: string | number; name: string; category_id: string | number; added: number; stream_type: 'series' }> = [];

      const vodUrl = new URL(parsed.toString());
      vodUrl.searchParams.set('action', 'get_vod_streams');

      const seriesUrl = new URL(parsed.toString());
      seriesUrl.searchParams.set('action', 'get_series');

      const [vodRes, seriesRes] = await Promise.all([
        axios.get(vodUrl.toString(), {
          timeout: 60000,
          httpsAgent,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }).catch(e => {
          console.warn('[Library-Sync] VOD fetch warning:', e.message);
          return { data: [] };
        }),
        axios.get(seriesUrl.toString(), {
          timeout: 60000,
          httpsAgent,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        }).catch(e => {
          console.warn('[Library-Sync] Series fetch warning:', e.message);
          return { data: [] };
        })
      ]);

      if (Array.isArray(vodRes.data)) {
        for (const m of vodRes.data) {
          const sId = m.stream_id || m.num;
          if (sId && m.name) {
            strippedMovies.push({
              stream_id: sId,
              name: String(m.name).trim(),
              category_id: m.category_id || '0',
              added: parseInt(m.added) || 0,
              stream_type: 'movie'
            });
          }
        }
      }

      if (Array.isArray(seriesRes.data)) {
        for (const s of seriesRes.data) {
          const sId = s.series_id || s.num;
          if (sId && s.name) {
            strippedSeries.push({
              stream_id: sId,
              name: String(s.name).trim(),
              category_id: s.category_id || '0',
              added: parseInt(s.last_modified) || parseInt(s.added) || 0,
              stream_type: 'series'
            });
          }
        }
      }

      const payload = {
        movies: strippedMovies,
        series: strippedSeries,
        totalMovies: strippedMovies.length,
        totalSeries: strippedSeries.length,
        syncedAt: Date.now()
      };

      // Cache for 30 minutes in memory
      proxyGenericCache.set(cacheKey, { data: payload, expiry: Date.now() + 30 * 60 * 1000 });
      return res.json(payload);
    } catch (err: any) {
      console.warn('[Library-Sync] Error during library sync:', err.message);
      if (cached) return res.json(cached.data);
      return res.status(500).json({ error: "Failed to sync library", details: err.message });
    }
  });

  // -------------------------------------------------------------
  // ON-DEMAND POSTER & STREAM URL ENRICHER FOR SEARCH MATCHES (Top 30 matches)
  // Takes matched lightweight items and fetches posters/metadata on demand
  // -------------------------------------------------------------
  app.post("/api/enrich-matches", async (req, res) => {
    const { url, items } = req.body;
    if (!url || !Array.isArray(items)) return res.status(400).json({ error: "URL and items array are required" });

    let targetUrl = url;
    try { targetUrl = decodeURIComponent(url); } catch (_) {}
    const parsed = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
    const username = parsed.searchParams.get('username') || '';
    const password = parsed.searchParams.get('password') || '';
    const host = parsed.origin;

    const slice = items.slice(0, 30);
    const enrichedResults: Record<string, any> = {};

    await Promise.all(
      slice.map(async (item: any) => {
        const key = `enrich_${item.stream_type}_${item.stream_id}`;
        const cached = proxyGenericCache.get(key);
        if (cached && cached.expiry > Date.now()) {
          enrichedResults[item.stream_id] = cached.data;
          return;
        }

        try {
          if (item.stream_type === 'series') {
            const seriesInfoUrl = `${host}/player_api.php?username=${username}&password=${password}&action=get_series_info&series_id=${item.stream_id}`;
            const r = await axios.get(seriesInfoUrl, { timeout: 10000, httpsAgent });
            const info = r.data?.info || {};
            const poster = info.cover || info.poster || r.data?.series_info?.cover || '';
            const data = {
              stream_id: item.stream_id,
              stream_type: 'series',
              poster,
              plot: info.plot || '',
              rating: info.rating || '',
              cast: info.cast || '',
              genre: info.genre || '',
              stream_url: `${host}/series/${username}/${password}/${item.stream_id}.mp4`
            };
            proxyGenericCache.set(key, { data, expiry: Date.now() + 60 * 60 * 1000 });
            enrichedResults[item.stream_id] = data;
          } else {
            // movie
            const vodInfoUrl = `${host}/player_api.php?username=${username}&password=${password}&action=get_vod_info&vod_id=${item.stream_id}`;
            const r = await axios.get(vodInfoUrl, { timeout: 10000, httpsAgent });
            const info = r.data?.info || {};
            const movieData = r.data?.movie_data || {};
            const poster = info.movie_image || info.cover_big || movieData.stream_icon || '';
            const ext = movieData.container_extension || info.container_extension || 'mp4';
            const data = {
              stream_id: item.stream_id,
              stream_type: 'movie',
              poster,
              plot: info.plot || '',
              rating: info.rating || '',
              cast: info.cast || '',
              genre: info.genre || '',
              container_extension: ext,
              stream_url: `${host}/movie/${username}/${password}/${item.stream_id}.${ext}`
            };
            proxyGenericCache.set(key, { data, expiry: Date.now() + 60 * 60 * 1000 });
            enrichedResults[item.stream_id] = data;
          }
        } catch (e: any) {
          // Fallback with minimal construction
          const ext = 'mp4';
          const type = item.stream_type === 'series' ? 'series' : 'movie';
          enrichedResults[item.stream_id] = {
            stream_id: item.stream_id,
            stream_type: item.stream_type,
            poster: '',
            stream_url: `${host}/${type}/${username}/${password}/${item.stream_id}.${ext}`
          };
        }
      })
    );

    return res.json({ matches: enrichedResults });
  });

  // -------------------------------------------------------------
  // LIGHTWEIGHT SEARCH INDEX API (Backward compatible)
  // Stripped-down JSON array: ONLY {stream_id, name, stream_type, category_id}
  // NO posters, NO descriptions, NO stream URLs -> shrinks 150MB down to ~1MB
  // -------------------------------------------------------------
  app.get("/api/search-index", async (req, res) => {
    const { url, type = 'all' } = req.query;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: "URL is required" });

    let targetUrl = url;
    try { targetUrl = decodeURIComponent(url); } catch (_) {}
    const parsed = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
    const cacheKey = `search_index_${type}_${parsed.origin}${parsed.searchParams.get('username')}`;
    const cached = proxyGenericCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return res.json(cached.data);
    }

    try {
      const results: Array<{ stream_id: string | number; name: string; stream_type: 'movie' | 'series' | 'live'; category_id: string | number }> = [];

      const fetchVod = type === 'all' || type === 'movies';
      const fetchSeries = type === 'all' || type === 'series';
      const fetchLive = type === 'all' || type === 'live';

      const promises: Promise<any>[] = [];

      if (fetchVod) {
        const vodUrl = new URL(parsed.toString());
        vodUrl.searchParams.set('action', 'get_vod_streams');
        promises.push(
          axios.get(vodUrl.toString(), {
            timeout: 50000,
            httpsAgent,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          }).then(r => {
            if (Array.isArray(r.data)) {
              for (const m of r.data) {
                const sId = m.stream_id || m.num;
                if (sId && m.name) {
                  results.push({
                    stream_id: sId,
                    name: String(m.name).trim(),
                    stream_type: 'movie',
                    category_id: m.category_id || '0'
                  });
                }
              }
            }
          }).catch(e => console.warn('[Search-Index] VOD fetch warning:', e.message))
        );
      }

      if (fetchSeries) {
        const seriesUrl = new URL(parsed.toString());
        seriesUrl.searchParams.set('action', 'get_series');
        promises.push(
          axios.get(seriesUrl.toString(), {
            timeout: 50000,
            httpsAgent,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          }).then(r => {
            if (Array.isArray(r.data)) {
              for (const s of r.data) {
                const sId = s.series_id || s.num;
                if (sId && s.name) {
                  results.push({
                    stream_id: sId,
                    name: String(s.name).trim(),
                    stream_type: 'series',
                    category_id: s.category_id || '0'
                  });
                }
              }
            }
          }).catch(e => console.warn('[Search-Index] Series fetch warning:', e.message))
        );
      }

      if (fetchLive) {
        const liveUrl = new URL(parsed.toString());
        liveUrl.searchParams.set('action', 'get_live_streams');
        promises.push(
          axios.get(liveUrl.toString(), {
            timeout: 50000,
            httpsAgent,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          }).then(r => {
            if (Array.isArray(r.data)) {
              for (const l of r.data) {
                const sId = l.stream_id || l.num;
                if (sId && l.name) {
                  results.push({
                    stream_id: sId,
                    name: String(l.name).trim(),
                    stream_type: 'live',
                    category_id: l.category_id || '0'
                  });
                }
              }
            }
          }).catch(e => console.warn('[Search-Index] Live fetch warning:', e.message))
        );
      }

      await Promise.all(promises);

      // Cache search index for 30 minutes
      proxyGenericCache.set(cacheKey, { data: results, expiry: Date.now() + 30 * 60 * 1000 });
      return res.json(results);
    } catch (err: any) {
      console.warn('[Search-Index] Error building search index:', err.message);
      if (cached) return res.json(cached.data);
      return res.json([]);
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
