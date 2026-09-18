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

// In-memory cache for stream redirect protocol checks
const redirectCheckCache = new Map<string, boolean>();

async function startServer() {
  const app = express();
  // Auto-detect Hugging Face environment (which always has SPACE_ID) and use Port 7860, else use PORT env or default to 3000
  const PORT = process.env.SPACE_ID ? 7860 : (process.env.PORT ? parseInt(process.env.PORT) : 3000);

  app.use(express.json());

  // Proxy Xtream API to avoid CORS
  app.get("/api/proxy", async (req, res) => {
    const { url, ...params } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });

    const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip || '';
    const clientIp = rawIp.split(',')[0].trim();

    const fullUrl = url as string;
    const cacheKey = fullUrl + JSON.stringify(params);

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      console.log(`Serving from cache: ${fullUrl}`);
      return res.json(cached.data);
    }

    console.log(`Proxying request to: ${url} (Client IP: ${clientIp || 'direct'})`);
    try {
      const targetUrl = new URL(url as string);
      const reqHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': '*/*',
      };

      // Only forward IP headers if clientIp is a valid external IP
      if (clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1' && clientIp !== 'localhost') {
        reqHeaders['X-Forwarded-For'] = clientIp;
        reqHeaders['X-Real-IP'] = clientIp;
      }

      const response = await axios.get(url as string, {
        params,
        timeout: 60000, // Increased timeout to 60s
        maxContentLength: 100 * 1024 * 1024, // 100MB limit
        httpsAgent,
        headers: reqHeaders
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
      // If we got a 429 and have stale cache, serve it anyway as fallback
      if (error.response?.status === 429 && cached) {
        console.warn(`Got 429, serving stale cache for: ${fullUrl}`);
        return res.json(cached.data);
      }

      const status = error.response?.status || 500;
      if (status === 404) {
        console.warn(`Proxy 404 (Not Found) for: ${url}`);
      } else if (status === 500) {
        console.warn(`Upstream provider server error (500) for: ${url} - ${error.message}`);
      } else {
        console.error(`Proxy error for ${url}:`, error.message);
      }
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

  // Check if an HTTPS stream redirects to HTTP (Mixed Content prevention)
  app.get("/api/check-redirect", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    const rawUrl = url.trim();
    // If it is already http://, it's obviously HTTP
    if (rawUrl.startsWith("http://")) {
      return res.json({ originalUrl: rawUrl, redirectsToHttp: true });
    }

    // Check in-memory cache
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
