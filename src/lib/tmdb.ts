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
  } catch (err: any) {
    // If 404 (Resource Not Found on TMDB), return null cleanly without noisy warnings
    if (err?.response?.status === 404 || err?.status === 404) {
      return null;
    }
    if (typeof window !== 'undefined') {
      try {
        const response = await axios.get(url);
        return response.data;
      } catch (fallbackErr: any) {
        if (fallbackErr?.response?.status === 404 || fallbackErr?.status === 404) {
          return null;
        }
        throw fallbackErr;
      }
    }
    throw err;
  }
}

export interface TmdbCastMember {
  name: string;
  profile_url?: string;
  character?: string;
}

export interface TmdbEpisodeInfo {
  episode_number: number;
  name: string;
  overview?: string;
  still_url?: string;
  runtime?: number;
  vote_average?: number;
  air_date?: string;
  season_number?: number;
}

export interface TmdbDetails {
  id?: number;
  backdrop_url?: string;
  poster_url?: string;
  rating?: number;
  cast: TmdbCastMember[];
  plot?: string;
  trailer_url?: string;
  title?: string;
  name?: string;
  logo_url?: string;
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: any[];
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
      id: mediaId,
      title: isSeries ? (fullDetails.name || fullDetails.original_name || '') : (fullDetails.title || fullDetails.original_title || ''),
      name: isSeries ? (fullDetails.name || fullDetails.original_name || '') : (fullDetails.title || fullDetails.original_title || ''),
      backdrop_url: fullDetails.backdrop_path ? `https://image.tmdb.org/t/p/w1280${fullDetails.backdrop_path}` : undefined,
      poster_url: fullDetails.poster_path ? `https://image.tmdb.org/t/p/w500${fullDetails.poster_path}` : undefined,
      rating: fullDetails.vote_average ? parseFloat(fullDetails.vote_average.toFixed(1)) : undefined,
      plot: fullDetails.overview || undefined,
      cast: castList,
      trailer_url: trailerUrl,
      logo_url: logoUrl,
      runtime: isSeries ? (fullDetails.episode_run_time && fullDetails.episode_run_time.length > 0 ? fullDetails.episode_run_time[0] : undefined) : (fullDetails.runtime || undefined),
      number_of_seasons: fullDetails.number_of_seasons,
      number_of_episodes: fullDetails.number_of_episodes,
      seasons: fullDetails.seasons,
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
      id: Number(id) || fullDetails.id,
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
      number_of_seasons: fullDetails.number_of_seasons,
      number_of_episodes: fullDetails.number_of_episodes,
      seasons: fullDetails.seasons,
    };

    setCachedItem(cacheKey, result);
    return result;
  } catch (err) {
    console.error('Error fetching TMDB details by ID:', err);
    return null;
  }
}

/**
 * Fetch episode details for a specific TV Season from TMDB API
 */
export async function fetchTmdbSeasonEpisodes(
  tvId: number | string,
  seasonNumber: number | string
): Promise<Record<number, TmdbEpisodeInfo> | null> {
  if (!tvId) return null;
  const parsedSeason = parseInt(String(seasonNumber).replace(/\D/g, ''), 10);
  const cleanSeason = (!isNaN(parsedSeason) && parsedSeason >= 0) ? String(parsedSeason) : '1';
  const cacheKey = `tv_season_episodes_${tvId}_s${cleanSeason}`;
  const cached = getCachedItem(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/3/tv/${tvId}/season/${cleanSeason}?api_key=${TMDB_API_KEY}`;
    const data = await getTmdbJson(url);
    if (!data || !Array.isArray(data.episodes)) {
      setCachedItem(cacheKey, {});
      return null;
    }

    const episodesMap: Record<number, TmdbEpisodeInfo> = {};
    for (const ep of data.episodes) {
      if (ep && typeof ep.episode_number === 'number') {
        episodesMap[ep.episode_number] = {
          episode_number: ep.episode_number,
          name: ep.name ? ep.name.trim() : `Episode ${ep.episode_number}`,
          overview: ep.overview || undefined,
          still_url: ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : undefined,
          runtime: ep.runtime || undefined,
          vote_average: ep.vote_average ? parseFloat(ep.vote_average.toFixed(1)) : undefined,
          air_date: ep.air_date || undefined,
          season_number: Number(cleanSeason) || 1,
        };
      }
    }

    setCachedItem(cacheKey, episodesMap);
    return episodesMap;
  } catch (err: any) {
    // Gracefully cache empty on 404
    setCachedItem(cacheKey, {});
    return null;
  }
}

/**
 * Synchronous cache lookup for TMDB season episodes
 */
export function getStoredTmdbSeasonEpisodes(
  tvId: number | string,
  seasonNumber: number | string
): Record<number, TmdbEpisodeInfo> | null {
  if (!tvId) return null;
  const parsedSeason = parseInt(String(seasonNumber).replace(/\D/g, ''), 10);
  const cleanSeason = (!isNaN(parsedSeason) && parsedSeason >= 0) ? String(parsedSeason) : '1';
  const cacheKey = `tv_season_episodes_${tvId}_s${cleanSeason}`;
  return getCachedItem(cacheKey);
}

/**
 * Fetch episode details for multiple seasons of a TV series in parallel
 */
export async function fetchTmdbAllSeasonsEpisodes(
  tvId: number | string,
  seasonNumbers: (number | string)[],
  validTmdbSeasons?: (number | string)[]
): Promise<Record<string, Record<number, TmdbEpisodeInfo>>> {
  const result: Record<string, Record<number, TmdbEpisodeInfo>> = {};
  if (!tvId || !seasonNumbers || seasonNumbers.length === 0) return result;

  const validSet = validTmdbSeasons && validTmdbSeasons.length > 0
    ? new Set(validTmdbSeasons.map(s => {
        const num = parseInt(String(s).replace(/\D/g, ''), 10);
        return isNaN(num) ? -1 : num;
      }))
    : null;

  const uniqueParsed = Array.from(new Set(
    seasonNumbers
      .map(sNum => {
        const parsed = parseInt(String(sNum).replace(/\D/g, ''), 10);
        return isNaN(parsed) ? null : parsed;
      })
      .filter((n): n is number => n !== null && (validSet === null || validSet.has(n)))
  ));

  const promises = uniqueParsed.map(async (parsedNum) => {
    const cleanSeason = String(parsedNum);
    const eps = await fetchTmdbSeasonEpisodes(tvId, cleanSeason);
    if (eps && Object.keys(eps).length > 0) {
      result[cleanSeason] = eps;
      if (parsedNum < 10) {
        result[`0${parsedNum}`] = eps;
      }
    }
  });

  await Promise.all(promises);
  return result;
}

/**
 * Clean any messy release / container tags from an episode title
 */
export function cleanRawEpisodeTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let title = rawTitle;

  // Remove common video container extensions
  title = title.replace(/\.(mp4|mkv|avi|flv|ts|m3u8|mov|wmv|webm)$/i, '');

  // Replace dots, underscores with spaces
  title = title.replace(/[._]/g, ' ');

  // Remove common release tags (1080p, 720p, web-dl, hevc, x264, etc.)
  title = title.replace(/\b(1080p|720p|480p|2160p|4k|hd|fhd|uhd|web-dl|webrip|bluray|hevc|x264|x265|aac|dts|dual audio|hindi|eng|sub|esub)\b/gi, ' ');

  // Clean redundant whitespace
  title = title.replace(/\s+/g, ' ').trim();
  return title;
}

export interface ResolvedEpisode {
  displayTitle: string;
  episodeNum: number | string;
  seasonNum: string;
  tmdbTitle?: string;
  hasTmdbMatch: boolean;
  stillUrl?: string;
  overview?: string;
}

/**
 * Automatically resolves the genuine TMDB episode name if available,
 * replacing generic placeholders like "EP1", "E01", "Episode 1", "S01E01", etc.
 */
export function resolveEpisodeInfo(
  episode: any,
  seasonNum?: string | number,
  tmdbEpisodesMap?: Record<string, Record<number, TmdbEpisodeInfo>> | Record<number, TmdbEpisodeInfo> | null,
  tvId?: number | string
): ResolvedEpisode {
  if (!episode) {
    return {
      displayTitle: 'Episode',
      episodeNum: 1,
      seasonNum: '1',
      hasTmdbMatch: false,
    };
  }

  const rawTitle = (episode.title || episode.name || '').toString().trim();

  // 1. Extract Season Number
  let sNum = '1';
  if (seasonNum !== undefined && seasonNum !== null && String(seasonNum).trim() !== '') {
    sNum = String(seasonNum).replace(/\D/g, '') || '1';
  } else if (episode.season !== undefined && episode.season !== null) {
    sNum = String(episode.season).replace(/\D/g, '') || '1';
  } else {
    const sMatch = rawTitle.match(/\bS(?:eason)?\s*0*(\d+)/i);
    if (sMatch) {
      sNum = String(parseInt(sMatch[1], 10));
    }
  }

  // 2. Extract Episode Number
  let epNum: number | null = null;
  if (episode.episode_num !== undefined && episode.episode_num !== null && !isNaN(Number(episode.episode_num))) {
    epNum = parseInt(String(episode.episode_num), 10);
  } else {
    // Try matching E01, EP 1, Episode 01, #1
    const epMatch = rawTitle.match(/(?:(?:^|[\s._\-[\]()])(?:E|EP|Episode|Ep|Part|#)\s*0*(\d+)|(?:\bS\d+\s*E0*(\d+)\b))/i);
    if (epMatch) {
      const captured = epMatch[1] || epMatch[2];
      if (captured && !isNaN(Number(captured))) {
        epNum = parseInt(captured, 10);
      }
    } else {
      // Standalone single number
      const numMatch = rawTitle.match(/\b0*(\d{1,3})\b/);
      if (numMatch && !isNaN(Number(numMatch[1]))) {
        epNum = parseInt(numMatch[1], 10);
      }
    }
  }

  const finalEpNum = epNum !== null && epNum > 0 ? epNum : (episode.episode_num || 1);

  // 3. Lookup TMDB episode data
  let tmdbEp: TmdbEpisodeInfo | undefined = undefined;

  if (tmdbEpisodesMap) {
    // Check if tmdbEpisodesMap is structured as { [season]: { [ep]: info } }
    if ((tmdbEpisodesMap as any)[sNum]) {
      tmdbEp = (tmdbEpisodesMap as any)[sNum]?.[Number(finalEpNum)];
    } else if ((tmdbEpisodesMap as any)[`Season ${sNum}`]) {
      tmdbEp = (tmdbEpisodesMap as any)[`Season ${sNum}`]?.[Number(finalEpNum)];
    } else if ((tmdbEpisodesMap as any)[Number(finalEpNum)]?.name) {
      // Flat map for current season
      tmdbEp = (tmdbEpisodesMap as any)[Number(finalEpNum)];
    }
  }

  // If not found in prop map and tvId is present, check synchronous local cache
  if (!tmdbEp && tvId) {
    const cachedSeason = getStoredTmdbSeasonEpisodes(tvId, sNum);
    if (cachedSeason && cachedSeason[Number(finalEpNum)]) {
      tmdbEp = cachedSeason[Number(finalEpNum)];
    }
  }

  // 4. Determine display title
  if (tmdbEp && tmdbEp.name && tmdbEp.name.trim() !== '') {
    const cleanTmdbName = tmdbEp.name.trim();
    // Verify it's not a generic placeholder like "Episode 1" if we already have one
    return {
      displayTitle: cleanTmdbName,
      episodeNum: finalEpNum,
      seasonNum: sNum,
      tmdbTitle: cleanTmdbName,
      hasTmdbMatch: true,
      stillUrl: tmdbEp.still_url,
      overview: tmdbEp.overview,
    };
  }

  // Fallback: clean up the raw provider title
  let cleaned = cleanRawEpisodeTitle(rawTitle);
  if (!cleaned || cleaned.toLowerCase() === `episode ${finalEpNum}`.toLowerCase() || cleaned.toLowerCase() === `ep ${finalEpNum}`.toLowerCase() || cleaned.toLowerCase() === `e${finalEpNum}`.toLowerCase()) {
    cleaned = `Episode ${finalEpNum}`;
  }

  return {
    displayTitle: cleaned,
    episodeNum: finalEpNum,
    seasonNum: sNum,
    hasTmdbMatch: false,
  };
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

export interface OttPlatform {
  id: string;
  name: string;
  provider_id: number;
  provider_ids?: { [region: string]: number };
  bg_gradient: string;
  border_color: string;
  text_color: string;
  badge_color: string;
  logo_url?: string;
  keywords?: string[];
}

export const OTT_PLATFORMS: OttPlatform[] = [
  {
    id: 'netflix',
    name: 'Netflix',
    provider_id: 8,
    provider_ids: { IN: 8, US: 8, GB: 8 },
    bg_gradient: 'from-red-950/90 via-zinc-950 to-red-950/50',
    border_color: 'border-red-600/50 hover:border-red-500 shadow-red-950/50',
    text_color: 'text-red-500',
    badge_color: 'bg-red-600',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg',
    keywords: ['netflix']
  },
  {
    id: 'prime',
    name: 'Amazon Prime Video',
    provider_id: 119,
    provider_ids: { IN: 119, US: 9, GB: 9 },
    bg_gradient: 'from-cyan-950/90 via-zinc-950 to-blue-950/50',
    border_color: 'border-cyan-500/50 hover:border-cyan-400 shadow-cyan-950/50',
    text_color: 'text-cyan-400',
    badge_color: 'bg-cyan-500',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Prime_Video.png',
    keywords: ['prime', 'amazon']
  },
  {
    id: 'disney',
    name: 'Disney+ Hotstar',
    provider_id: 122,
    provider_ids: { IN: 122, US: 337, GB: 337 },
    bg_gradient: 'from-blue-950/90 via-zinc-950 to-indigo-950/50',
    border_color: 'border-blue-500/50 hover:border-blue-400 shadow-blue-950/50',
    text_color: 'text-blue-400',
    badge_color: 'bg-blue-600',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg',
    keywords: ['disney', 'hotstar']
  },
  {
    id: 'jiocinema',
    name: 'JioCinema',
    provider_id: 220,
    provider_ids: { IN: 220, US: 220 },
    bg_gradient: 'from-pink-950/90 via-zinc-950 to-rose-950/50',
    border_color: 'border-pink-500/50 hover:border-pink-400 shadow-pink-950/50',
    text_color: 'text-pink-400',
    badge_color: 'bg-pink-600',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/1/14/JioCinema_Logo.svg',
    keywords: ['jiocinema', 'jio']
  },
  {
    id: 'sonyliv',
    name: 'Sony LIV',
    provider_id: 237,
    provider_ids: { IN: 237, US: 237 },
    bg_gradient: 'from-orange-950/90 via-zinc-950 to-amber-950/50',
    border_color: 'border-orange-500/50 hover:border-orange-400 shadow-orange-950/50',
    text_color: 'text-orange-400',
    badge_color: 'bg-orange-500',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/SonyLIV_logo.svg',
    keywords: ['sonyliv', 'sony']
  },
  {
    id: 'zee5',
    name: 'Zee5',
    provider_id: 232,
    provider_ids: { IN: 232, US: 232 },
    bg_gradient: 'from-fuchsia-950/90 via-zinc-950 to-purple-950/50',
    border_color: 'border-fuchsia-500/50 hover:border-fuchsia-400 shadow-fuchsia-950/50',
    text_color: 'text-fuchsia-400',
    badge_color: 'bg-fuchsia-600',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/5/5a/ZEE5_logo.svg',
    keywords: ['zee5', 'zee']
  },
  {
    id: 'appletv',
    name: 'Apple TV+',
    provider_id: 350,
    provider_ids: { IN: 350, US: 2, GB: 2 },
    bg_gradient: 'from-zinc-900 via-zinc-950 to-zinc-900',
    border_color: 'border-white/30 hover:border-white shadow-zinc-800/40',
    text_color: 'text-white',
    badge_color: 'bg-white text-black',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg',
    keywords: ['apple', 'appletv']
  },
  {
    id: 'aha',
    name: 'Aha Video',
    provider_id: 532,
    provider_ids: { IN: 532, US: 532 },
    bg_gradient: 'from-amber-950/90 via-zinc-950 to-orange-950/50',
    border_color: 'border-amber-500/50 hover:border-amber-400 shadow-amber-950/50',
    text_color: 'text-amber-400',
    badge_color: 'bg-amber-500',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Aha_OTT_logo.svg',
    keywords: ['aha']
  },
  {
    id: 'lionsgate',
    name: 'Lionsgate Play',
    provider_id: 309,
    provider_ids: { IN: 309, US: 309 },
    bg_gradient: 'from-yellow-950/90 via-zinc-950 to-amber-950/50',
    border_color: 'border-yellow-500/50 hover:border-yellow-400 shadow-yellow-950/50',
    text_color: 'text-yellow-400',
    badge_color: 'bg-yellow-500',
    keywords: ['lionsgate']
  },
  {
    id: 'mxplayer',
    name: 'MX Player',
    provider_id: 488,
    provider_ids: { IN: 488, US: 488 },
    bg_gradient: 'from-blue-950/90 via-zinc-950 to-cyan-950/50',
    border_color: 'border-cyan-500/50 hover:border-cyan-400 shadow-cyan-950/50',
    text_color: 'text-cyan-400',
    badge_color: 'bg-cyan-500',
    keywords: ['mxplayer']
  },
  {
    id: 'hbomax',
    name: 'HBO Max',
    provider_id: 1899,
    provider_ids: { IN: 220, US: 1899 },
    bg_gradient: 'from-purple-950/90 via-zinc-950 to-indigo-950/50',
    border_color: 'border-purple-500/50 hover:border-purple-400 shadow-purple-950/50',
    text_color: 'text-purple-400',
    badge_color: 'bg-purple-600',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/1/17/HBO_Max_Logo.svg',
    keywords: ['hbo', 'max']
  },
  {
    id: 'hulu',
    name: 'Hulu',
    provider_id: 15,
    provider_ids: { IN: 122, US: 15 },
    bg_gradient: 'from-emerald-950/90 via-zinc-950 to-green-950/50',
    border_color: 'border-emerald-500/50 hover:border-emerald-400 shadow-emerald-950/50',
    text_color: 'text-emerald-400',
    badge_color: 'bg-emerald-500',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/e/e4/Hulu_Logo.svg',
    keywords: ['hulu']
  },
  {
    id: 'paramount',
    name: 'Paramount+ Premium',
    provider_id: 531,
    provider_ids: { IN: 119, US: 531 },
    bg_gradient: 'from-sky-950/90 via-zinc-950 to-blue-950/50',
    border_color: 'border-sky-500/50 hover:border-sky-400 shadow-sky-950/50',
    text_color: 'text-sky-400',
    badge_color: 'bg-sky-500',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Paramount%2B_logo.svg',
    keywords: ['paramount']
  },
  {
    id: 'peacock',
    name: 'Peacock Premium',
    provider_id: 386,
    provider_ids: { IN: 237, US: 386 },
    bg_gradient: 'from-teal-950/90 via-zinc-950 to-cyan-950/50',
    border_color: 'border-teal-500/50 hover:border-teal-400 shadow-teal-950/50',
    text_color: 'text-teal-400',
    badge_color: 'bg-teal-500',
    logo_url: 'https://upload.wikimedia.org/wikipedia/commons/d/d3/NBCUniversal_Peacock_Logo.svg',
    keywords: ['peacock']
  }
];

export async function fetchPlatformMedia(
  platform: OttPlatform,
  mediaType: 'all' | 'movie' | 'tv' = 'all',
  sortBy: string = 'popularity.desc',
  genreId?: number,
  regionCode: string = 'IN',
  page: number = 1
): Promise<TmdbTrendingItem[]> {
  const targetRegion = (regionCode && regionCode !== 'ALL') ? regionCode : 'IN';
  const targetProviderId = platform.provider_ids?.[targetRegion] || platform.provider_id;

  const cacheKey = `platform_media_${platform.id}_${targetProviderId}_${mediaType}_${sortBy}_${genreId || ''}_${targetRegion}_${page}`;
  const cached = getCachedItem(cacheKey);
  if (cached && Array.isArray(cached) && cached.length > 0) return cached;

  try {
    const regionParam = `&watch_region=${targetRegion}`;
    const genreParam = genreId ? `&with_genres=${genreId}` : '';
    const providerParam = `&with_watch_providers=${targetProviderId}&with_watch_monetization_types=flatrate|rent|buy|free|ads`;

    let movieResults: any[] = [];
    let tvResults: any[] = [];

    if (mediaType === 'movie' || mediaType === 'all') {
      const url = `${BASE_URL}/3/discover/movie?api_key=${TMDB_API_KEY}&sort_by=${sortBy}${providerParam}${regionParam}${genreParam}&page=${page}`;
      const data = await getTmdbJson(url);
      movieResults = (data.results || []).map((item: any) => ({
        id: item.id,
        title: item.title || item.original_title || '',
        poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
        backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : undefined,
        rating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : undefined,
        plot: item.overview || undefined,
        media_type: 'movie' as const,
        year: item.release_date ? item.release_date.substring(0, 4) : undefined,
      }));
    }

    if (mediaType === 'tv' || mediaType === 'all') {
      const url = `${BASE_URL}/3/discover/tv?api_key=${TMDB_API_KEY}&sort_by=${sortBy}${providerParam}${regionParam}${genreParam}&page=${page}`;
      const data = await getTmdbJson(url);
      tvResults = (data.results || []).map((item: any) => ({
        id: item.id,
        title: item.name || item.original_name || item.title || '',
        poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
        backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : undefined,
        rating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : undefined,
        plot: item.overview || undefined,
        media_type: 'tv' as const,
        year: item.first_air_date ? item.first_air_date.substring(0, 4) : undefined,
      }));
    }

    let combined: TmdbTrendingItem[] = [];
    if (mediaType === 'all') {
      const maxLen = Math.max(movieResults.length, tvResults.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < movieResults.length) combined.push(movieResults[i]);
        if (i < tvResults.length) combined.push(tvResults[i]);
      }
    } else if (mediaType === 'movie') {
      combined = movieResults;
    } else {
      combined = tvResults;
    }

    // Fallback if region returns 0 items and targetRegion is not US
    if (combined.length === 0 && targetRegion !== 'US') {
      const usProviderId = platform.provider_ids?.['US'] || platform.provider_id;
      const usCacheKey = `platform_media_${platform.id}_${usProviderId}_${mediaType}_${sortBy}_${genreId || ''}_US_${page}`;
      const usUrlMovie = `${BASE_URL}/3/discover/movie?api_key=${TMDB_API_KEY}&sort_by=${sortBy}&with_watch_providers=${usProviderId}&watch_region=US&with_watch_monetization_types=flatrate|rent|buy|free|ads${genreParam}&page=${page}`;
      const usUrlTv = `${BASE_URL}/3/discover/tv?api_key=${TMDB_API_KEY}&sort_by=${sortBy}&with_watch_providers=${usProviderId}&watch_region=US&with_watch_monetization_types=flatrate|rent|buy|free|ads${genreParam}&page=${page}`;
      
      const [movieData, tvData] = await Promise.all([
        mediaType !== 'tv' ? getTmdbJson(usUrlMovie) : Promise.resolve({ results: [] }),
        mediaType !== 'movie' ? getTmdbJson(usUrlTv) : Promise.resolve({ results: [] }),
      ]);

      const fbMovie = (movieData.results || []).map((item: any) => ({
        id: item.id,
        title: item.title || item.original_title || '',
        poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
        backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : undefined,
        rating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : undefined,
        plot: item.overview || undefined,
        media_type: 'movie' as const,
        year: item.release_date ? item.release_date.substring(0, 4) : undefined,
      }));

      const fbTv = (tvData.results || []).map((item: any) => ({
        id: item.id,
        title: item.name || item.original_name || item.title || '',
        poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
        backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : undefined,
        rating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : undefined,
        plot: item.overview || undefined,
        media_type: 'tv' as const,
        year: item.first_air_date ? item.first_air_date.substring(0, 4) : undefined,
      }));

      if (mediaType === 'all') {
        const maxLen = Math.max(fbMovie.length, fbTv.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < fbMovie.length) combined.push(fbMovie[i]);
          if (i < fbTv.length) combined.push(fbTv[i]);
        }
      } else if (mediaType === 'movie') {
        combined = fbMovie;
      } else {
        combined = fbTv;
      }
    }

    setCachedItem(cacheKey, combined);
    return combined;
  } catch (err) {
    console.error('Error fetching platform media from TMDB:', err);
    return [];
  }
}

export async function searchTmdbItems(query: string, mediaType: 'all' | 'movie' | 'tv' = 'all'): Promise<TmdbTrendingItem[]> {
  if (!query || !query.trim()) return [];
  const q = query.trim();
  const cacheKey = `search_tmdb_items_${mediaType}_${q.toLowerCase()}`;
  const cached = getCachedItem(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}&include_adult=false&language=en-US`;
    const data = await getTmdbJson(url);
    const results = data.results || [];

    const items: TmdbTrendingItem[] = results
      .filter((item: any) => {
        if (item.media_type !== 'movie' && item.media_type !== 'tv') return false;
        if (mediaType === 'movie' && item.media_type !== 'movie') return false;
        if (mediaType === 'tv' && item.media_type !== 'tv') return false;
        return true;
      })
      .map((item: any) => ({
        id: item.id,
        title: item.title || item.original_title || item.name || item.original_name || '',
        poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
        backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : undefined,
        rating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : undefined,
        plot: item.overview || undefined,
        media_type: item.media_type as 'movie' | 'tv',
        year: (item.release_date || item.first_air_date) ? (item.release_date || item.first_air_date).substring(0, 4) : undefined,
      }));

    setCachedItem(cacheKey, items);
    return items;
  } catch (err) {
    console.error('Error searching TMDB items:', err);
    return [];
  }
}
