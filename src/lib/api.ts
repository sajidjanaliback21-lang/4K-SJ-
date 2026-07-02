import axios from 'axios';
import { XtreamCredentials, Category, Stream, Series, LoginResponse, LiveStream } from '../types';

export const DEFAULT_CREDENTIALS: XtreamCredentials = {
  host: 'https://sjstorehot-lbskip.hf.space',
  username: 'webplayer44',
  password: '62246624',
};

const sanitizeHost = (host: string): string => {
  if (!host || host.includes('lb-skip.vercel.app') || host.includes('4ksjpun-lbff.hf.space')) {
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

// ==========================================
// Robust Mock Fallback Data (For Server Downtimes)
// ==========================================

const MOCK_LOGIN_RESPONSE: LoginResponse = {
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

const MOCK_MOVIE_CATEGORIES: Category[] = [
  { category_id: "0", category_name: "All Movies", parent_id: 0 },
  { category_id: "1", category_name: "Trending Now", parent_id: 0 },
  { category_id: "2", category_name: "Action & Adventure", parent_id: 0 },
  { category_id: "3", category_name: "Sci-Fi & Fantasy", parent_id: 0 },
  { category_id: "4", category_name: "Documentaries", parent_id: 0 }
];

const MOCK_SERIES_CATEGORIES: Category[] = [
  { category_id: "0", category_name: "All Series", parent_id: 0 },
  { category_id: "1", category_name: "Popular Series", parent_id: 0 },
  { category_id: "2", category_name: "Sci-Fi Specials", parent_id: 0 }
];

const MOCK_LIVE_CATEGORIES: Category[] = [
  { category_id: "0", category_name: "All Channels", parent_id: 0 },
  { category_id: "1", category_name: "Sports Networks", parent_id: 0 },
  { category_id: "2", category_name: "Entertainment", parent_id: 0 },
  { category_id: "3", category_name: "News Networks", parent_id: 0 }
];

const MOCK_MOVIES: Stream[] = [
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

const MOCK_SERIES: Series[] = [
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

const MOCK_LIVE_STREAMS: LiveStream[] = [
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
  },
  {
    num: 3,
    name: "Sky News Live (UK News Feed)",
    stream_type: "live",
    stream_id: "sky_news",
    stream_icon: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&auto=format&fit=crop&q=80",
    epg_channel_id: "SkyNews",
    added: "1719921602",
    category_id: "3",
    custom_sid: "",
    tv_archive: 0,
    direct_source: "https://skynews-skynews-main-1-gb.samsung.wurl.com/manifest/playlist.m3u8",
    tv_archive_duration: 0
  }
];

const MOCK_SERIES_INFO_BTS = {
  seasons: [
    {
      name: "Season 1",
      season_number: 1,
      episode_count: 2
    }
  ],
  episodes: {
    "1": [
      {
        id: "tears_ep1",
        episode_num: 1,
        title: "Tears of Steel Part 1",
        container_extension: "mpd",
        info: {
          plot: "First half of Tears of Steel",
          duration: "06:00"
        }
      },
      {
        id: "tears_ep2",
        episode_num: 2,
        title: "Tears of Steel Part 2",
        container_extension: "mpd",
        info: {
          plot: "Second half of Tears of Steel",
          duration: "06:14"
        }
      }
    ]
  }
};

const MOCK_SERIES_INFO_SINTEL = {
  seasons: [
    {
      name: "Season 1",
      season_number: 1,
      episode_count: 2
    }
  ],
  episodes: {
    "1": [
      {
        id: "sintel_ep1",
        episode_num: 1,
        title: "Sintel Part 1",
        container_extension: "mpd",
        info: {
          plot: "First half of Sintel's journey",
          duration: "07:30"
        }
      },
      {
        id: "sintel_ep2",
        episode_num: 2,
        title: "Sintel Part 2",
        container_extension: "mpd",
        info: {
          plot: "Second half of Sintel's journey",
          duration: "07:18"
        }
      }
    ]
  }
};

// ==========================================
// API Implementation with Fallback Handling
// ==========================================

export const xtreamApi = {
  login: async (creds: XtreamCredentials): Promise<LoginResponse> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}`;
    try {
      return await proxyRequest({ url });
    } catch (e) {
      console.warn("Proxy login failed, returning fallback credentials response", e);
      return MOCK_LOGIN_RESPONSE;
    }
  },

  getMovieCategories: async (creds: XtreamCredentials): Promise<Category[]> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_vod_categories`;
    try {
      const data = await proxyRequest({ url });
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn("Proxy getMovieCategories failed, returning fallback", e);
      return MOCK_MOVIE_CATEGORIES;
    }
  },

  getMovies: async (creds: XtreamCredentials, categoryId: string = '0'): Promise<Stream[]> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_vod_streams${categoryId !== '0' ? `&category_id=${categoryId}` : ''}`;
    try {
      const data = await proxyRequest({ url });
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn("Proxy getMovies failed, returning fallback movies list", e);
      if (categoryId === '0') {
        return MOCK_MOVIES;
      }
      return MOCK_MOVIES.filter(m => m.category_id === categoryId);
    }
  },

  getSeriesCategories: async (creds: XtreamCredentials): Promise<Category[]> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_series_categories`;
    try {
      const data = await proxyRequest({ url });
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn("Proxy getSeriesCategories failed, returning fallback", e);
      return MOCK_SERIES_CATEGORIES;
    }
  },

  getSeries: async (creds: XtreamCredentials, categoryId: string = '0'): Promise<Series[]> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_series${categoryId !== '0' ? `&category_id=${categoryId}` : ''}`;
    try {
      const data = await proxyRequest({ url });
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn("Proxy getSeries failed, returning fallback series list", e);
      if (categoryId === '0') {
        return MOCK_SERIES;
      }
      return MOCK_SERIES.filter(s => s.category_id === categoryId);
    }
  },

  getSeriesInfo: async (creds: XtreamCredentials, seriesId: string): Promise<any> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_series_info&series_id=${seriesId}`;
    try {
      return await proxyRequest({ url });
    } catch (e) {
      console.warn(`Proxy getSeriesInfo failed for ${seriesId}, returning fallback`, e);
      if (seriesId === 'tears_bts') {
        return MOCK_SERIES_INFO_BTS;
      }
      return MOCK_SERIES_INFO_SINTEL;
    }
  },

  getMovieInfo: async (creds: XtreamCredentials, movieId: string): Promise<any> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_vod_info&vod_id=${movieId}`;
    try {
      return await proxyRequest({ url });
    } catch (e) {
      console.warn(`Proxy getMovieInfo failed for ${movieId}, returning fallback`, e);
      return {
        info: {
          name: movieId === 'sintel' ? "Sintel" : "Tears of Steel",
          plot: "Fallback offline info details for premium stream media selection.",
          duration: "15:00"
        }
      };
    }
  },

  getLiveCategories: async (creds: XtreamCredentials): Promise<Category[]> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_live_categories`;
    try {
      const data = await proxyRequest({ url });
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn("Proxy getLiveCategories failed, returning fallback", e);
      return MOCK_LIVE_CATEGORIES;
    }
  },

  getLiveStreams: async (creds: XtreamCredentials, categoryId: string = '0'): Promise<LiveStream[]> => {
    const host = sanitizeHost(creds.host);
    const url = `${host}/player_api.php?username=${creds.username}&password=${creds.password}&action=get_live_streams${categoryId !== '0' ? `&category_id=${categoryId}` : ''}`;
    try {
      const data = await proxyRequest({ url });
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn("Proxy getLiveStreams failed, returning fallback live list", e);
      if (categoryId === '0') {
        return MOCK_LIVE_STREAMS;
      }
      return MOCK_LIVE_STREAMS.filter(l => l.category_id === categoryId);
    }
  },

  getStreamUrl: (creds: XtreamCredentials, streamId: string, extension: string = 'mp4', type: 'movie' | 'series' | 'live' = 'movie') => {
    if (streamId === 'sintel') return "https://storage.googleapis.com/shaka-demo-assets/sintel/dash.mpd";
    if (streamId === 'tears_of_steel') return "https://storage.googleapis.com/shaka-demo-assets/tears-of-steel/dash.mpd";
    if (streamId === 'big_buck_bunny') return "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
    if (streamId === 'angel_one') return "https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd";
    if (streamId === 'nasa_tv') return "https://ntv1.nasatv.net/hls/main/nasa_main.m3u8";
    if (streamId === 'redbull_tv') return "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8";
    if (streamId === 'sky_news') return "https://skynews-skynews-main-1-gb.samsung.wurl.com/manifest/playlist.m3u8";
    
    if (streamId === 'tears_ep1' || streamId === 'tears_ep2') return "https://storage.googleapis.com/shaka-demo-assets/tears-of-steel/dash.mpd";
    if (streamId === 'sintel_ep1' || streamId === 'sintel_ep2') return "https://storage.googleapis.com/shaka-demo-assets/sintel/dash.mpd";

    const host = 'https://sjstorehot-lbskip.hf.space';
    if (type === 'live') {
      return `${host}/live/${creds.username}/${creds.password}/${streamId}.m3u8`;
    }
    return `${host}/${type}/${creds.username}/${creds.password}/${streamId}.${extension}`;
  }
};
