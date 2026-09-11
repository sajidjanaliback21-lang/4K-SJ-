import axios from 'axios';
import { XtreamCredentials, Category, Stream, Series, LoginResponse, LiveStream } from '../types';

export const DEFAULT_CREDENTIALS: XtreamCredentials = {
  host: 'https://60fpssj-60fps10.hf.space',
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
  if (!cleanHost || cleanHost.includes('lb-skip.vercel.app') || cleanHost.includes('4ksjpun-lbff.hf.space')) {
    return 'https://60fpssj-60fps10.hf.space';
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
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_vod_streams${categoryId !== '0' ? `&category_id=${categoryId}` : ''}`;
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
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_series${categoryId !== '0' ? `&category_id=${categoryId}` : ''}`;
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
  }
};
