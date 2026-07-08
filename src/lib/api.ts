import axios from 'axios';
import { XtreamCredentials, Category, Stream, Series, LoginResponse, LiveStream } from '../types';

export const DEFAULT_CREDENTIALS: XtreamCredentials = {
  host: 'https://sjstorehot-lbskip.hf.space',
  username: 'webplayer44',
  password: '62246624',
};

const sanitizeHost = (host: string): string => {
  let resellerUrl = typeof window !== 'undefined' ? (window as any).activeResellerServerUrl : '';
  if (resellerUrl) {
    resellerUrl = resellerUrl.trim();
  }
  const isValidUrl = resellerUrl && (resellerUrl.startsWith('http://') || resellerUrl.startsWith('https://'));
  if (isValidUrl) {
    return resellerUrl;
  }
  if (!host || host.includes('lb-skip.vercel.app') || host.includes('4ksjpun-lbff.hf.space') || host === 'Default' || host === 'Default System') {
    return 'https://sjstorehot-lbskip.hf.space';
  }
  return host;
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
    return proxyRequest({ url });
  },

  getMovieInfo: async (creds: XtreamCredentials, movieId: string): Promise<any> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_vod_info&vod_id=${movieId}`;
    return proxyRequest({ url });
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
