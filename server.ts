import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  // Use PORT from environment (Hugging Face uses 7860, AI Studio uses 3000)
  const PORT = Number(process.env.PORT) || 7860;

  app.use(express.json());

  // Proxy Xtream API to avoid CORS
  app.get("/api/proxy", async (req, res) => {
    const { url, ...params } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });

    console.log(`Proxying request to: ${url}`);
    try {
      const targetUrl = new URL(url as string);
      const response = await axios.get(url as string, {
        params,
        timeout: 60000, // Increased timeout to 60s
        maxContentLength: 100 * 1024 * 1024, // 100MB limit
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': '*/*',
          'Host': targetUrl.host,
        }
      });
      console.log(`Successfully fetched data from: ${url} (Size: ${JSON.stringify(response.data).length} bytes)`);
      res.json(response.data);
    } catch (error: any) {
      console.error(`Proxy error for ${url}:`, error.message);
      const status = error.response?.status || 500;
      const data = error.response?.data || { error: "Failed to fetch from IPTV server", details: error.message };
      res.status(status).json(data);
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
