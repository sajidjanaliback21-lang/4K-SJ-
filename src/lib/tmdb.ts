import axios from 'axios';

const TMDB_API_KEY = (import.meta as any).env.VITE_TMDB_API_KEY || '883af49d85dd2b8944a8f0aa79a040eb';
const BASE_URL = 'https://api.themoviedb.org';

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

export async function fetchTrendingMovies(): Promise<TmdbTrendingItem[]> {
  try {
    const url = `${BASE_URL}/3/discover/movie?api_key=${TMDB_API_KEY}&sort_by=popularity.desc&with_origin_country=IN|PK&page=1`;
    const response = await axios.get(url);
    const results = response.data.results || [];
    return results.slice(0, 10).map((item: any) => ({
      id: item.id,
      title: item.title || item.original_title || '',
      poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
      backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : undefined,
      rating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : undefined,
      plot: item.overview || undefined,
      media_type: 'movie',
      year: item.release_date ? item.release_date.substring(0, 4) : undefined,
    }));
  } catch (err) {
    console.error('Error fetching trending TMDB movies:', err);
    return [];
  }
}

export async function fetchTrendingSeries(): Promise<TmdbTrendingItem[]> {
  try {
    const url = `${BASE_URL}/3/discover/tv?api_key=${TMDB_API_KEY}&sort_by=popularity.desc&page=1`;
    const response = await axios.get(url);
    const results = response.data.results || [];
    return results.slice(0, 10).map((item: any) => ({
      id: item.id,
      title: item.name || item.original_name || '',
      poster_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
      backdrop_url: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : undefined,
      rating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : undefined,
      plot: item.overview || undefined,
      media_type: 'tv',
      year: item.first_air_date ? item.first_air_date.substring(0, 4) : undefined,
    }));
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

export async function fetchTmdbDetails(rawTitle: string, isSeries: boolean): Promise<TmdbDetails | null> {
  const { title, year } = cleanMediaTitle(rawTitle);
  if (!title) return null;

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

    let response = await axios.get(url);
    let results = response.data.results || [];

    // Fallback: If no results with the year constraint, search with title query alone to be robust
    if (results.length === 0 && year) {
      const fallbackUrl = `${BASE_URL}/3/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
      const fallbackRes = await axios.get(fallbackUrl);
      results = fallbackRes.data.results || [];
    }

    if (results.length === 0) return null;

    // Grab the first matching entity
    const bestMatch = results[0];
    const mediaId = bestMatch.id;

    // Fetch credits for actors' profiles
    const creditsUrl = `${BASE_URL}/3/${searchType}/${mediaId}/credits?api_key=${TMDB_API_KEY}`;
    const creditsRes = await axios.get(creditsUrl);
    const tmdbCast = creditsRes.data.cast || [];

    const castList: TmdbCastMember[] = tmdbCast.slice(0, 10).map((member: any) => ({
      name: member.name,
      profile_url: member.profile_path ? `https://image.tmdb.org/t/p/w185${member.profile_path}` : undefined,
      character: member.character,
    }));

    return {
      backdrop_url: bestMatch.backdrop_path ? `https://image.tmdb.org/t/p/w1280${bestMatch.backdrop_path}` : undefined,
      poster_url: bestMatch.poster_path ? `https://image.tmdb.org/t/p/w500${bestMatch.poster_path}` : undefined,
      rating: bestMatch.vote_average ? parseFloat(bestMatch.vote_average.toFixed(1)) : undefined,
      plot: bestMatch.overview || undefined,
      cast: castList,
    };
  } catch (err) {
    console.error('Error fetching TMDB details in service:', err);
    return null;
  }
}
