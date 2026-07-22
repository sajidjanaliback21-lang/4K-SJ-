import axios from 'axios';

const TMDB_API_KEY = (import.meta as any).env.VITE_TMDB_API_KEY || '883af49d85dd2b8944a8f0aa79a040eb';
const BASE_URL = 'https://api.themoviedb.org';

// Client-side cache for TMDB details and listings
const TMDB_CACHE_PREFIX = 'tmdb_cache_';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours client-side cache

const inMemoryCache = new Map<string, { data: any; timestamp: number }>();

function getCachedItem(key: string): any | null {
  // Try in-memory first
  const memCached = inMemoryCache.get(key);
  if (memCached && (Date.now() - memCached.timestamp < CACHE_EXPIRY_MS)) {
    return memCached.data;
  }

  // Try localStorage
  try {
    const cachedStr = localStorage.getItem(TMDB_CACHE_PREFIX + key);
    if (cachedStr) {
      const parsed = JSON.parse(cachedStr);
      if (Date.now() - parsed.timestamp < CACHE_EXPIRY_MS) {
        inMemoryCache.set(key, { data: parsed.data, timestamp: parsed.timestamp });
        return parsed.data;
      } else {
        localStorage.removeItem(TMDB_CACHE_PREFIX + key);
      }
    }
  } catch (e) {
    console.warn('Error reading from localStorage cache:', e);
  }
  return null;
}

function setCachedItem(key: string, data: any): void {
  const timestamp = Date.now();
  inMemoryCache.set(key, { data, timestamp });

  try {
    const cacheObj = { data, timestamp };
    localStorage.setItem(TMDB_CACHE_PREFIX + key, JSON.stringify(cacheObj));
  } catch (e) {
    console.warn('Error writing to localStorage cache:', e);
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(TMDB_CACHE_PREFIX)) {
          keys.push(k);
        }
      }
      for (const k of keys.slice(0, Math.ceil(keys.length / 2))) {
        localStorage.removeItem(k);
      }
    } catch (innerEx) {}
  }
}

async function getTmdbJson(url: string): Promise<any> {
  try {
    const isBrowser = typeof window !== 'undefined';
    const finalUrl = isBrowser ? `/api/proxy?url=${encodeURIComponent(url)}` : url;
    const response = await axios.get(finalUrl);
    return response.data;
  } catch (err) {
    if (typeof window !== 'undefined') {
      console.warn('Proxy request failed, trying direct fallback for URL:', url, err);
      const response = await axios.get(url);
      return response.data;
    }
    throw err;
  }
}

export interface TmdbCastMember {
  name: string;
  profile_url?: string;
  character?: string;
}

export interface TmdbDetails {
  backdrop_url?: string;
  poster_url?: string;
  rating?: number;
  cast: TmdbCastMember[];
  plot?: string;
  trailer_url?: string;
  title?: string;
  logo_url?: string;
  runtime?: number;
}

export interface TmdbTrendingItem {
  id: number;
  title: string;
  poster_url?: string;
  backdrop_url?: string;
  rating?: number;
  plot?: string;
  media_type: 'movie' | 'tv';
  year?: string;
}

export interface TrendingRegion {
  code: string;
  name: string;
  subtitle: string;
}

export const TRENDING_REGIONS: TrendingRegion[] = [
  { code: 'IN', name: 'India', subtitle: 'Bollywood & Indian Regional' },
  { code: 'PK', name: 'Pakistan', subtitle: 'Pakistani Movies & Dramas' },
  { code: 'US', name: 'United States', subtitle: 'Hollywood Blockbusters' },
  { code: 'GB', name: 'United Kingdom', subtitle: 'British Hits & Cinema' },
  { code: 'KR', name: 'South Korea', subtitle: 'K-Drama & Korean Hits' },
  { code: 'JP', name: 'Japan', subtitle: 'Anime & Japanese Hits' },
  { code: 'TR', name: 'Turkey', subtitle: 'Turkish Serials & Movies' },
  { code: 'ES', name: 'Spain', subtitle: 'Spanish Cinema & Shows' },
  { code: 'FR', name: 'France', subtitle: 'French Hits & Cinema' },
  { code: 'DE', name: 'Germany', subtitle: 'German Cinema & Shows' },
  { code: 'AE', name: 'UAE / Arab', subtitle: 'Middle Eastern Trending' },
  { code: 'ALL', name: 'Worldwide', subtitle: 'Global Top Trending' },
];

export async function fetchTrendingMovies(countryCode: string = 'IN'): Promise<TmdbTrendingItem[]> {
  const cacheKey = `trending_movies_${countryCode}`;
  const cached = getCachedItem(cacheKey);
  if (cached && Array.isArray(cached) && cached.length > 0) return cached;

  try {
    let url = '';
    if (countryCode === 'ALL') {
      url = `${BASE_URL}/3/trending/movie/day?api_key=${TMDB_API_KEY}`;
    } else {
      url = `${BASE_URL}/3/discover/movie?api_key=${TMDB_API_KEY}&sort_by=popularity.desc&with_origin_country=${countryCode}&page=1`;
    }
    const data = await getTmdbJson(url);
    const results = data.results || [];
    const formatted = results.slice(0, 10).map((item: any) => ({
      id: item.id,
      title: item.title || item.original_title || '',
      poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
      backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : undefined,
      rating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : undefined,
      plot: item.overview || undefined,
      media_type: 'movie',
      year: item.release_date ? item.release_date.substring(0, 4) : undefined,
    }));
    setCachedItem(cacheKey, formatted);
    return formatted;
  } catch (err) {
    console.error('Error fetching trending TMDB movies:', err);
    return [];
  }
}

export async function fetchTrendingSeries(countryCode: string = 'IN'): Promise<TmdbTrendingItem[]> {
  const cacheKey = `trending_series_${countryCode}`;
  const cached = getCachedItem(cacheKey);
  if (cached && Array.isArray(cached) && cached.length > 0) {
    const hasEmptyTitles = cached.some((item: any) => !item.title);
    if (!hasEmptyTitles) return cached;
  }

  try {
    let url = '';
    if (countryCode === 'ALL') {
      url = `${BASE_URL}/3/trending/tv/day?api_key=${TMDB_API_KEY}`;
    } else {
      url = `${BASE_URL}/3/discover/tv?api_key=${TMDB_API_KEY}&sort_by=popularity.desc&with_origin_country=${countryCode}&page=1`;
    }
    const data = await getTmdbJson(url);
    const results = data.results || [];
    const formatted = results.slice(0, 10).map((item: any) => ({
      id: item.id,
      title: item.name || item.original_name || item.title || item.original_title || '',
      poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
      backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : undefined,
      rating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : undefined,
      plot: item.overview || undefined,
      media_type: 'tv',
      year: item.first_air_date ? item.first_air_date.substring(0, 4) : undefined,
    }));
    setCachedItem(cacheKey, formatted);
    return formatted;
  } catch (err) {
    console.error('Error fetching trending TMDB web series:', err);
    return [];
  }
}

export function cleanMediaTitle(rawTitle: string): { title: string; year?: string } {
  if (!rawTitle) return { title: '' };

  let title = rawTitle;

  // 1. Remove brackets and parentheses containing common media language / audio qualities / channels
  // e.g. [Hindi], (Hindi), [Dual Audio], (Clean), [Eng], etc.
  const suffixesToRemove = [
    /\[[^\]]*(hindi|urdu|tamil|telugu|malayalam|kannada|punjabi|bengali|english|french|spanish|dual|multi|audio|dub|clean|org|web-dl|webrip|hdr|bluray|hevc|1080p|720p|4k|hd|sub|esub|dubbed|hq|copy|ts)[^\]]*\]/gi,
    /\((hindi|urdu|tamil|telugu|malayalam|kannada|punjabi|bengali|english|french|spanish|dual|multi|audio|dub|clean|org|web-dl|webrip|hdr|bluray|hevc|1080p|720p|4k|hd|sub|esub|dubbed|hq|netflix|amazon|disney|hotstar|geo|ary|hum|har\s*pal\s*geo|express|copy|ts)\)/gi,
    /\b(hindi|urdu|tamil|telugu|malayalam|kannada|english|dual\s+audio|multi\s+audio|dubbed|web-dl|webrip|1080p|720p|4k|hevc)\b/gi
  ];

  for (const pattern of suffixesToRemove) {
    title = title.replace(pattern, ' ');
  }

  // 2. Extract Year: find a 4 digit number starting with 19 or 20
  const yearPattern = /\b(19\d{2}|20\d{2})\b/;
  const match = title.match(yearPattern);
  let year: string | undefined = undefined;
  if (match) {
    year = match[1];
    // Cut the title up to the year to index the search query clean
    const idx = title.indexOf(year);
    if (idx > 0) {
      title = title.substring(0, idx);
    }
  }

  // 3. Remove web series season/episode numbering like S01E01, S1 E1, Episode 01, etc.
  title = title.replace(/\b(s\d+e\d+|s\d+\s+e\d+|ep\d+|episode\s*\d+|season\s*\d+|episodes\s*\d+|part\s*\d+)\b/gi, ' ');

  // 4. Final sanitization: strip any extra brackets, parens, hyphens, and whitespace collapses
  title = title
    .replace(/[()[\]{}_+\-.:|/\\*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { title, year };
}

export function getStoredTmdbDetails(rawTitle: string, isSeries: boolean): TmdbDetails | null {
  const { title, year } = cleanMediaTitle(rawTitle);
  if (!title) return null;
  const cacheKey = `details_${isSeries ? 'tv' : 'movie'}_${title.toLowerCase()}_${year || ''}`;
  return getCachedItem(cacheKey);
}

export function getStoredTmdbDetailsById(id: string | number, isSeries: boolean): any | null {
  const cacheKey = `details_id_${isSeries ? 'tv' : 'movie'}_${id}`;
  return getCachedItem(cacheKey);
}

function selectBestLogo(logos: any[]): string | undefined {
  if (!logos || logos.length === 0) return undefined;
  
  // Try to find logo in specific preferred languages first
  const preferredLangs = ['hi', 'ur', 'en'];
  for (const lang of preferredLangs) {
    const found = logos.find(logo => logo.iso_639_1 === lang && logo.file_path);
    if (found) {
      return `https://image.tmdb.org/t/p/w500${found.file_path}`;
    }
  }

  // Next, try to find single-language neutral logo
  const neutral = logos.find(logo => (!logo.iso_639_1 || logo.iso_639_1 === '') && logo.file_path);
  if (neutral) {
    return `https://image.tmdb.org/t/p/w500${neutral.file_path}`;
  }

  // Fallback to the first logo available
  const anyLogo = logos.find(logo => logo.file_path);
  if (anyLogo) {
    return `https://image.tmdb.org/t/p/w500${anyLogo.file_path}`;
  }
  
  return undefined;
}

export async function fetchTmdbDetails(rawTitle: string, isSeries: boolean): Promise<TmdbDetails | null> {
  const { title, year } = cleanMediaTitle(rawTitle);
  if (!title) return null;

  const cacheKey = `details_${isSeries ? 'tv' : 'movie'}_${title.toLowerCase()}_${year || ''}`;
  const cached = getCachedItem(cacheKey);
  if (cached) return cached;

  try {
    const searchType = isSeries ? 'tv' : 'movie';
    let url = `${BASE_URL}/3/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
    if (year) {
      if (isSeries) {
        url += `&first_air_date_year=${year}`;
      } else {
        url += `&year=${year}`;
      }
    }

    let data = await getTmdbJson(url);
    let results = data.results || [];

    // Fallback: If no results with the year constraint, search with title query alone to be robust
    if (results.length === 0 && year) {
      const fallbackUrl = `${BASE_URL}/3/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
      const fallbackData = await getTmdbJson(fallbackUrl);
      results = fallbackData.results || [];
    }

    if (results.length === 0) return null;

    // Grab the first matching entity
    const bestMatch = results[0];
    const mediaId = bestMatch.id;

    // Fetch full details with append_to_response to get credits, videos, and images in one request
    const detailsUrl = `${BASE_URL}/3/${searchType}/${mediaId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,images&include_image_language=en,hi,ur,null`;
    const fullDetails = await getTmdbJson(detailsUrl);

    const tmdbCast = fullDetails.credits?.cast || [];
    const castList: TmdbCastMember[] = tmdbCast.slice(0, 10).map((member: any) => ({
      name: member.name,
      profile_url: member.profile_path ? `https://image.tmdb.org/t/p/w185${member.profile_path}` : undefined,
      character: member.character,
    }));

    // Parse trailer
    const videosList = fullDetails.videos?.results || [];
    const trailer = videosList.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer') ||
                    videosList.find((v: any) => v.site === 'YouTube' && (v.type === 'Teaser' || v.type === 'Clip')) ||
                    videosList.find((v: any) => v.site === 'YouTube');
    const trailerUrl = trailer ? `https://www.youtube.com/embed/${trailer.key}` : undefined;

    // Get the first matching beautiful logo
    const logoUrl = fullDetails.images?.logos && fullDetails.images.logos.length > 0
      ? selectBestLogo(fullDetails.images.logos)
      : undefined;

    const result: TmdbDetails = {
      title: isSeries ? (fullDetails.name || fullDetails.original_name || '') : (fullDetails.title || fullDetails.original_title || ''),
      backdrop_url: fullDetails.backdrop_path ? `https://image.tmdb.org/t/p/w1280${fullDetails.backdrop_path}` : undefined,
      poster_url: fullDetails.poster_path ? `https://image.tmdb.org/t/p/w500${fullDetails.poster_path}` : undefined,
      rating: fullDetails.vote_average ? parseFloat(fullDetails.vote_average.toFixed(1)) : undefined,
      plot: fullDetails.overview || undefined,
      cast: castList,
      trailer_url: trailerUrl,
      logo_url: logoUrl,
      runtime: isSeries ? (fullDetails.episode_run_time && fullDetails.episode_run_time.length > 0 ? fullDetails.episode_run_time[0] : undefined) : (fullDetails.runtime || undefined),
    };

    setCachedItem(cacheKey, result);
    return result;
  } catch (err) {
    console.error('Error fetching TMDB details in service:', err);
    return null;
  }
}

export async function fetchTmdbDetailsById(id: string | number, isSeries: boolean): Promise<any | null> {
  const cacheKey = `details_id_${isSeries ? 'tv' : 'movie'}_${id}`;
  const cached = getCachedItem(cacheKey);
  if (cached) return cached;

  try {
    const searchType = isSeries ? 'tv' : 'movie';
    const detailsUrl = `${BASE_URL}/3/${searchType}/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,images&include_image_language=en,hi,ur,null`;
    const fullDetails = await getTmdbJson(detailsUrl);

    const tmdbCast = fullDetails.credits?.cast || [];
    const castList: TmdbCastMember[] = tmdbCast.slice(0, 10).map((member: any) => ({
      name: member.name,
      profile_url: member.profile_path ? `https://image.tmdb.org/t/p/w185${member.profile_path}` : undefined,
      character: member.character,
    }));

    // Parse trailer
    const videosList = fullDetails.videos?.results || [];
    const trailer = videosList.find((v: any) => v.site === 'YouTube' && v.type === 'Trailer') ||
                    videosList.find((v: any) => v.site === 'YouTube' && (v.type === 'Teaser' || v.type === 'Clip')) ||
                    videosList.find((v: any) => v.site === 'YouTube');
    const trailerUrl = trailer ? `https://www.youtube.com/embed/${trailer.key}` : undefined;

    // Get the first matching beautiful logo
    const logoUrl = fullDetails.images?.logos && fullDetails.images.logos.length > 0
      ? selectBestLogo(fullDetails.images.logos)
      : undefined;

    const result = {
      name: isSeries ? (fullDetails.name || fullDetails.original_name || '') : (fullDetails.title || fullDetails.original_title || ''),
      title: isSeries ? (fullDetails.name || fullDetails.original_name || '') : (fullDetails.title || fullDetails.original_title || ''),
      backdrop_url: fullDetails.backdrop_path ? `https://image.tmdb.org/t/p/w1280${fullDetails.backdrop_path}` : undefined,
      poster_url: fullDetails.poster_path ? `https://image.tmdb.org/t/p/w500${fullDetails.poster_path}` : undefined,
      rating: fullDetails.vote_average ? parseFloat(fullDetails.vote_average.toFixed(1)) : undefined,
      plot: fullDetails.overview || undefined,
      cast: castList,
      trailer_url: trailerUrl,
      logo_url: logoUrl,
      runtime: isSeries ? (fullDetails.episode_run_time && fullDetails.episode_run_time.length > 0 ? fullDetails.episode_run_time[0] : undefined) : (fullDetails.runtime || undefined),
    };

    setCachedItem(cacheKey, result);
    return result;
  } catch (err) {
    console.error('Error fetching TMDB details by ID:', err);
    return null;
  }
}

export function getLanguageTags(rawTitle: string): string[] {
  if (!rawTitle) return [];
  // Match any parenthesized or bracketed text, e.g. (Hindi), [Tamil], (Eng-Dubbed), (Dual Audio), etc.
  const regex = /(\([^\)]*\)|\[[^\]]*\])/g;
  const matches = rawTitle.match(regex);
  if (!matches) return [];

  // Filter only those parts that contain language terms or are clearly language tags
  const langKeywords = /\b(hindi|tamil|telugu|bengali|punjabi|malayalam|kannada|urdu|gujarati|marathi|bhojpuri|english|eng|dual|multi|dub|org|clean|chinese|korean|japanese|spanish|french|tel|tam|hin)\b/i;
  
  return matches.filter(tag => langKeywords.test(tag));
}

export interface LanguageBadge {
  label: string;
  color: string;
  barColor: string;
}

export function getLanguageBadge(rawTitle?: string, categoryName?: string): LanguageBadge | null {
  const combined = `${rawTitle || ''} ${categoryName || ''}`;
  if (!combined.trim()) return null;

  const text = combined.toLowerCase();

  // Explicit check for Hindi
  if (/\b(hindi|hin)\b/i.test(text)) {
    if (/\b(dual\s*audio|dual)\b/i.test(text)) {
      return { 
        label: 'HIN · DUAL', 
        color: 'text-amber-300',
        barColor: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]'
      };
    }
    if (/\b(dubbed|dub)\b/i.test(text)) {
      return { 
        label: 'HIN · DUB', 
        color: 'text-orange-300',
        barColor: 'bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.9)]'
      };
    }
    return { 
      label: 'HINDI', 
      color: 'text-rose-300',
      barColor: 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.9)]'
    };
  }

  if (/\b(tamil|tam)\b/i.test(text)) {
    return { 
      label: 'TAMIL', 
      color: 'text-amber-300',
      barColor: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]'
    };
  }

  if (/\b(telugu|tel)\b/i.test(text)) {
    return { 
      label: 'TELUGU', 
      color: 'text-purple-300',
      barColor: 'bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.9)]'
    };
  }

  if (/\b(punjabi|pun)\b/i.test(text)) {
    return { 
      label: 'PUNJABI', 
      color: 'text-emerald-300',
      barColor: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]'
    };
  }

  if (/\b(malayalam|mal)\b/i.test(text)) {
    return { 
      label: 'MALAYALAM', 
      color: 'text-teal-300',
      barColor: 'bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.9)]'
    };
  }

  if (/\b(kannada|kan)\b/i.test(text)) {
    return { 
      label: 'KANNADA', 
      color: 'text-yellow-300',
      barColor: 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.9)]'
    };
  }

  if (/\b(turkish|turk)\b/i.test(text)) {
    return { 
      label: 'TURKISH', 
      color: 'text-red-300',
      barColor: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]'
    };
  }

  if (/\b(korean|k-drama|kdrama)\b/i.test(text)) {
    return { 
      label: 'KOREAN', 
      color: 'text-pink-300',
      barColor: 'bg-pink-400 shadow-[0_0_6px_rgba(244,114,182,0.9)]'
    };
  }

  if (/\b(chinese|c-drama|cdrama)\b/i.test(text)) {
    return { 
      label: 'CHINESE', 
      color: 'text-red-300',
      barColor: 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.9)]'
    };
  }

  if (/\b(urdu)\b/i.test(text)) {
    return { 
      label: 'URDU', 
      color: 'text-emerald-300',
      barColor: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]'
    };
  }

  if (/\b(bengali|ben)\b/i.test(text)) {
    return { 
      label: 'BENGALI', 
      color: 'text-sky-300',
      barColor: 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.9)]'
    };
  }

  if (/\b(marathi)\b/i.test(text)) {
    return { 
      label: 'MARATHI', 
      color: 'text-indigo-300',
      barColor: 'bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.9)]'
    };
  }

  if (/\b(bhojpuri)\b/i.test(text)) {
    return { 
      label: 'BHOJPURI', 
      color: 'text-amber-300',
      barColor: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)]'
    };
  }

  if (/\b(gujarati)\b/i.test(text)) {
    return { 
      label: 'GUJARATI', 
      color: 'text-orange-300',
      barColor: 'bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.9)]'
    };
  }

  if (/\b(english|eng)\b/i.test(text)) {
    return { 
      label: 'ENGLISH', 
      color: 'text-sky-300',
      barColor: 'bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.9)]'
    };
  }

  if (/\b(spanish)\b/i.test(text)) {
    return { 
      label: 'SPANISH', 
      color: 'text-yellow-300',
      barColor: 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.9)]'
    };
  }

  if (/\b(french)\b/i.test(text)) {
    return { 
      label: 'FRENCH', 
      color: 'text-indigo-300',
      barColor: 'bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.9)]'
    };
  }

  if (/\b(dual\s*audio|dual)\b/i.test(text)) {
    return { 
      label: 'DUAL', 
      color: 'text-cyan-300',
      barColor: 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)]'
    };
  }

  if (/\b(multi\s*audio|multi)\b/i.test(text)) {
    return { 
      label: 'MULTI', 
      color: 'text-cyan-300',
      barColor: 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)]'
    };
  }

  if (/\b(dubbed|dub)\b/i.test(text)) {
    return { 
      label: 'DUBBED', 
      color: 'text-cyan-300',
      barColor: 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)]'
    };
  }

  // Fallback: Check regex brackets in title e.g. [Hindi], (Hindi)
  const regex = /(\([^\)]*\)|\[[^\]]*\])/g;
  const matches = rawTitle ? rawTitle.match(regex) : null;
  if (matches && matches.length > 0) {
    const rawTag = matches[0].replace(/[()[\]{}]/g, '').trim();
    if (rawTag && rawTag.length <= 10) {
      return { 
        label: rawTag.toUpperCase(), 
        color: 'text-cyan-300',
        barColor: 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)]'
      };
    }
  }

  return null;
}
