import axios from 'axios';
import { XtreamCredentials, Category, Stream, Series, LoginResponse, LiveStream } from '../types';

export const DEFAULT_CREDENTIALS: XtreamCredentials = {
  host: 'https://4ksjpun-lbff.hf.space',
  username: 'webplayer44',
  password: '62246624',
};

const sanitizeHost = (host: string): string => {
  // 1. If an active live server URL is set globally (via real-time Firestore sync for active reseller or global settings), ALWAYS prioritize it!
  if (typeof window !== 'undefined') {
    if ((window as any).activeServerUrl) {
      const live = ((window as any).activeServerUrl || '').trim();
      if (live && live !== 'N/A') {
        const clean = live.startsWith('http') ? live : `https://${live}`;
        return clean.replace(/\/$/, '').replace(/:8443(?=[\/?#]|$)/g, '');
      }
    }
    if ((window as any).activeResellerServerUrl) {
      const resellerHost = ((window as any).activeResellerServerUrl || '').trim();
      if (resellerHost && resellerHost !== 'N/A') {
        const clean = resellerHost.startsWith('http') ? resellerHost : `https://${resellerHost}`;
        return clean.replace(/\/$/, '').replace(/:8443(?=[\/?#]|$)/g, '');
      }
    }
    if ((window as any).appSettingsDefaultServerUrl) {
      const defaultHost = ((window as any).appSettingsDefaultServerUrl || '').trim();
      if (defaultHost && defaultHost !== 'N/A') {
        const clean = defaultHost.startsWith('http') ? defaultHost : `https://${defaultHost}`;
        return clean.replace(/\/$/, '').replace(/:8443(?=[\/?#]|$)/g, '');
      }
    }
  }

  // 2. Otherwise sanitize the passed host
  let cleanHost = host || '';
  if (!cleanHost || cleanHost.includes('lb-skip.vercel.app')) {
    return 'https://4ksjpun-lbff.hf.space';
  }
  if (!cleanHost.startsWith('http://') && !cleanHost.startsWith('https://')) {
    cleanHost = `https://${cleanHost}`;
  }
  return cleanHost.replace(/\/$/, '').replace(/:8443(?=[\/?#]|$)/g, '');
};

const proxyRequest = async (params: any, retries = 3, backoff = 1000): Promise<any> => {
  try {
    const response = await axios.get('/api/proxy', { params });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 429 && retries > 0) {
      console.warn(`Got 429, retrying in ${backoff}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return proxyRequest(params, retries - 1, backoff * 2);
    }
    const urlStr = String(params?.url || '');
    if (
      urlStr.includes('action=get_vod_streams') ||
      urlStr.includes('action=get_series') ||
      urlStr.includes('action=get_live_streams') ||
      urlStr.includes('action=get_vod_categories') ||
      urlStr.includes('action=get_series_categories') ||
      urlStr.includes('action=get_live_categories') ||
      /action=(get_vod_streams|get_series|get_live_streams|get_vod_categories|get_series_categories|get_live_categories)/i.test(urlStr)
    ) {
      console.warn(`[API Fallback] Recovering gracefully from error on list endpoint:`, error?.message);
      return [];
    }
    if (urlStr.includes('action=get_vod_info') || urlStr.includes('action=get_series_info') || /action=(get_vod_info|get_series_info)/i.test(urlStr)) {
      return null;
    }
    throw error;
  }
};

export const xtreamApi = {
  login: async (creds: XtreamCredentials): Promise<LoginResponse> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}`;
    return proxyRequest({ url });
  },

  getMovieCategories: async (creds: XtreamCredentials): Promise<Category[]> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_vod_categories`;
    const data = await proxyRequest({ url });
    return Array.isArray(data) ? data : [];
  },

  getMovies: async (creds: XtreamCredentials, categoryId: string = '0'): Promise<Stream[]> => {
    const host = sanitizeHost(creds.host);
    const catParam = categoryId && categoryId !== '0' ? `&category_id=${categoryId}` : '&category_id=0';
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_vod_streams${catParam}`;
    const data = await proxyRequest({ url });
    return Array.isArray(data) ? data : [];
  },

  getSeriesCategories: async (creds: XtreamCredentials): Promise<Category[]> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_series_categories`;
    const data = await proxyRequest({ url });
    return Array.isArray(data) ? data : [];
  },

  getSeries: async (creds: XtreamCredentials, categoryId: string = '0'): Promise<Series[]> => {
    const host = sanitizeHost(creds.host);
    const catParam = categoryId && categoryId !== '0' ? `&category_id=${categoryId}` : '&category_id=0';
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_series${catParam}`;
    const data = await proxyRequest({ url });
    return Array.isArray(data) ? data : [];
  },

  getSeriesInfo: async (creds: XtreamCredentials, seriesId: string): Promise<any> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_series_info&series_id=${seriesId}`;
    try {
      return await proxyRequest({ url });
    } catch (err: any) {
      console.warn(`Upstream series info unavailable for series ${seriesId}:`, err?.message || err);
      return null;
    }
  },

  getMovieInfo: async (creds: XtreamCredentials, movieId: string): Promise<any> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_vod_info&vod_id=${movieId}`;
    try {
      return await proxyRequest({ url });
    } catch (err: any) {
      console.warn(`Upstream VOD info unavailable for movie ${movieId}:`, err?.message || err);
      return null;
    }
  },

  getLiveCategories: async (creds: XtreamCredentials): Promise<Category[]> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_live_categories`;
    const data = await proxyRequest({ url });
    return Array.isArray(data) ? data : [];
  },

  getLiveStreams: async (creds: XtreamCredentials, categoryId: string = '0'): Promise<LiveStream[]> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_live_streams${categoryId !== '0' ? `&category_id=${categoryId}` : ''}`;
    const data = await proxyRequest({ url });
    return Array.isArray(data) ? data : [];
  },

  getStreamUrl: (creds: XtreamCredentials, streamId: string, extension: string = 'mp4', type: 'movie' | 'series' | 'live' = 'movie') => {
    const host = sanitizeHost(creds.host);
    if (type === 'live') {
      return `${host}/live/${creds.username}/${creds.password}/${streamId}.m3u8`;
    }
    return `${host}/${type}/${creds.username}/${creds.password}/${streamId}.${extension}`;
  },

  // Optimized Lazy-Loading: Top 100 Recently Added items (with posters & metadata)
  getRecentlyAdded: async (creds: XtreamCredentials, type: 'movies' | 'series', limit: number = 100): Promise<any[]> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}`;
    try {
      const response = await axios.get('/api/recently-added', {
        params: { url, type, limit },
        timeout: 30000
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (e: any) {
      console.warn(`[API] Recently added fetch error for ${type}:`, e.message);
      return [];
    }
  },

  // Lightweight Global Search Index: Stripped down JSON array of ONLY {stream_id, name, stream_type, category_id}
  // No posters, no descriptions, no stream URLs
  getSearchIndex: async (creds: XtreamCredentials, type: 'all' | 'movies' | 'series' = 'all'): Promise<any[]> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}`;
    try {
      const response = await axios.get('/api/search-index', {
        params: { url, type },
        timeout: 45000
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (e: any) {
      console.warn(`[API] Search index fetch error:`, e.message);
      return [];
    }
  },

  // Full Library Sync: Fetches complete list of VODs and Series and keeps ONLY {stream_id, name, category_id, added}
  // Completely strips out posters and heavy metadata for ultra-low memory & fast sync
  syncLibrary: async (creds: XtreamCredentials): Promise<{
    movies: Array<{ stream_id: string | number; name: string; category_id: string | number; added: number; stream_type: 'movie' }>;
    series: Array<{ stream_id: string | number; name: string; category_id: string | number; added: number; stream_type: 'series' }>;
    totalMovies: number;
    totalSeries: number;
  }> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}`;
    try {
      const response = await axios.get('/api/library-sync', {
        params: { url },
        timeout: 60000
      });
      if (response.data && Array.isArray(response.data.movies)) {
        return response.data;
      }
    } catch (err: any) {
      console.warn('[API] /api/library-sync notice, falling back to direct client strip:', err.message);
    }

    // Direct client-side strip fallback if server route is unavailable
    try {
      const [rawMovies, rawSeries] = await Promise.all([
        xtreamApi.getMovies(creds, '0').catch(() => []),
        xtreamApi.getSeries(creds, '0').catch(() => [])
      ]);

      const strippedMovies = (rawMovies || []).map((m: any) => ({
        stream_id: m.stream_id || m.num,
        name: String(m.name || '').trim(),
        category_id: m.category_id || '0',
        added: parseInt(m.added) || 0,
        stream_type: 'movie' as const
      }));

      const strippedSeries = (rawSeries || []).map((s: any) => ({
        stream_id: s.series_id || s.stream_id || s.num,
        name: String(s.name || '').trim(),
        category_id: s.category_id || '0',
        added: parseInt(s.last_modified) || parseInt(s.added) || 0,
        stream_type: 'series' as const
      }));

      return {
        movies: strippedMovies,
        series: strippedSeries,
        totalMovies: strippedMovies.length,
        totalSeries: strippedSeries.length
      };
    } catch (fallbackErr: any) {
      console.warn('[API] Direct sync error:', fallbackErr.message);
      return { movies: [], series: [], totalMovies: 0, totalSeries: 0 };
    }
  },

  // On-demand poster & stream URL enrichment for top search matches (up to 30)
  enrichMatches: async (creds: XtreamCredentials, items: Array<{ stream_id: string | number; stream_type: 'movie' | 'series'; name?: string }>): Promise<Record<string, any>> => {
    if (!items || items.length === 0) return {};
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}`;
    try {
      const response = await axios.post('/api/enrich-matches', {
        url,
        items: items.slice(0, 30)
      }, { timeout: 15000 });
      return response.data?.matches || {};
    } catch (e: any) {
      console.warn('[API] Error enriching search matches:', e.message);
      return {};
    }
  }
};
