import express from "express";
import axios from "axios";
import https from "https";

const app = express();
app.use(express.json());

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_TTL = 30 * 60 * 1000;

app.get("/api/proxy", async (req, res) => {
  const { url, ...params } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });

  const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip || '';
  const clientIp = rawIp.split(',')[0].trim();

  const fullUrl = url as string;
  const cacheKey = fullUrl + JSON.stringify(params);

  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return res.json(cached.data);
  }

  try {
    const targetUrl = new URL(url as string);
    const response = await axios.get(url as string, {
      params,
      timeout: 30000,
      maxContentLength: 100 * 1024 * 1024,
      httpsAgent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': '*/*',
        'Host': targetUrl.host,
        'X-Forwarded-For': clientIp,
        'X-Real-IP': clientIp,
      }
    });

    if (response.status === 200) {
      cache.set(cacheKey, {
        data: response.data,
        expiry: Date.now() + CACHE_TTL
      });
    }

    res.json(response.data);
  } catch (error: any) {
    if (error.response?.status === 429 && cached) {
      return res.json(cached.data);
    }
    const status = error.response?.status || 500;
    const data = error.response?.data || { error: "Failed to fetch from IPTV server", details: error.message };
    res.status(status).json(data);
  }
});

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
    res.status(500).send("Streaming failed");
  }
});

export default app;
