// IndexedDB High-Speed Storage for Search Index & UI Cache
// Stores a stripped-down lightweight array containing ONLY {stream_id, name, stream_type, category_id}
// Zero posters, descriptions, or stream URLs stored in search index

const DB_NAME = 'iptv_player_cache_v2';
const DB_VERSION = 2;
const STORE_NAME = 'playlist_store';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export interface SearchIndexItem {
  stream_id: string | number;
  name: string;
  stream_type: 'movie' | 'series' | 'live';
  category_id: string | number;
  added?: number;
}

export interface CachedMasterPlaylist {
  movies?: any[];
  series?: any[];
  movieCategories?: any[];
  seriesCategories?: any[];
  liveCategories?: any[];
  homeData?: {
    popularMovies: any[];
    popularSeries: any[];
  };
  totalMovieCount?: number;
  totalSeriesCount?: number;
  savedAt?: number;
}

export const playlistStorage = {
  async get(key: string): Promise<any> {
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  async set(key: string, value: any): Promise<boolean> {
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(value, key);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  },

  // -------------------------------------------------------------
  // Full Library Sync Storage (For Search & Real Counts)
  // Stripped-down JSON array: ONLY {stream_id, name, stream_type, category_id, added}
  // Zero stream_icon (posters) or other heavy metadata stored.
  // -------------------------------------------------------------
  async getFullLibrary(): Promise<{
    movies: SearchIndexItem[];
    series: SearchIndexItem[];
    totalMovies: number;
    totalSeries: number;
    syncedAt?: number;
  } | null> {
    try {
      const [movies, series, totalMovies, totalSeries, syncedAt] = await Promise.all([
        this.get('library_movies'),
        this.get('library_series'),
        this.get('library_total_movies'),
        this.get('library_total_series'),
        this.get('library_synced_at')
      ]);

      if (Array.isArray(movies) || Array.isArray(series)) {
        const m = Array.isArray(movies) ? movies : [];
        const s = Array.isArray(series) ? series : [];
        return {
          movies: m,
          series: s,
          totalMovies: typeof totalMovies === 'number' ? totalMovies : m.length,
          totalSeries: typeof totalSeries === 'number' ? totalSeries : s.length,
          syncedAt
        };
      }
      return null;
    } catch (err) {
      console.warn('[PlaylistStorage] Error reading full library:', err);
      return null;
    }
  },

  async saveFullLibrary(
    movies: SearchIndexItem[],
    series: SearchIndexItem[]
  ): Promise<boolean> {
    try {
      const cleanMovies: SearchIndexItem[] = (movies || []).map(m => ({
        stream_id: m.stream_id,
        name: m.name,
        stream_type: 'movie',
        category_id: m.category_id || '0',
        added: m.added || 0
      }));

      const cleanSeries: SearchIndexItem[] = (series || []).map(s => ({
        stream_id: s.stream_id,
        name: s.name,
        stream_type: 'series',
        category_id: s.category_id || '0',
        added: s.added || 0
      }));

      await Promise.all([
        this.set('library_movies', cleanMovies),
        this.set('library_series', cleanSeries),
        this.set('library_total_movies', cleanMovies.length),
        this.set('library_total_series', cleanSeries.length),
        this.set('library_synced_at', Date.now()),
        // Keep combined index for backwards compatibility
        this.set('global_search_index', [...cleanMovies, ...cleanSeries])
      ]);

      console.log(`[PlaylistStorage] ⚡ Full library saved: ${cleanMovies.length} movies, ${cleanSeries.length} series in IndexedDB.`);
      return true;
    } catch (err) {
      console.warn('[PlaylistStorage] Error saving full library:', err);
      return false;
    }
  },

  // -------------------------------------------------------------
  // Minimal Global Search Index Storage
  // Stripped-down JSON array: ONLY {stream_id, name, stream_type, category_id}
  // -------------------------------------------------------------
  async getSearchIndex(): Promise<SearchIndexItem[]> {
    try {
      const data = await this.get('global_search_index');
      if (Array.isArray(data) && data.length > 0) {
        return data as SearchIndexItem[];
      }
      return [];
    } catch (err) {
      console.warn('[PlaylistStorage] Error reading search index:', err);
      return [];
    }
  },

  async saveSearchIndex(items: SearchIndexItem[]): Promise<boolean> {
    try {
      // Ensure only stripped-down properties are stored
      const sanitized: SearchIndexItem[] = items.map(item => ({
        stream_id: item.stream_id,
        name: item.name,
        stream_type: item.stream_type,
        category_id: item.category_id
      }));

      await this.set('global_search_index', sanitized);
      await this.set('search_index_saved_at', Date.now());
      console.log(`[PlaylistStorage] ⚡ Successfully stored ${sanitized.length} lightweight search index items in IndexedDB.`);
      return true;
    } catch (err) {
      console.warn('[PlaylistStorage] Failed to save search index:', err);
      return false;
    }
  },

  // -------------------------------------------------------------
  // Categories Cache
  // -------------------------------------------------------------
  async getStoredCategories(): Promise<{ movieCategories?: any[]; seriesCategories?: any[]; liveCategories?: any[] } | null> {
    try {
      return await this.get('stored_categories');
    } catch {
      return null;
    }
  },

  async saveStoredCategories(data: { movieCategories?: any[]; seriesCategories?: any[]; liveCategories?: any[] }): Promise<void> {
    try {
      await this.set('stored_categories', { ...data, savedAt: Date.now() });
    } catch (e) {
      console.warn('[PlaylistStorage] Error saving categories:', e);
    }
  },

  // -------------------------------------------------------------
  // Top 100 Recently Added (UI Lazy Loading Cache)
  // -------------------------------------------------------------
  async getStoredRecentlyAdded(): Promise<{ movies: any[]; series: any[] } | null> {
    try {
      return await this.get('stored_recently_added');
    } catch {
      return null;
    }
  },

  async saveStoredRecentlyAdded(data: { movies: any[]; series: any[] }): Promise<void> {
    try {
      await this.set('stored_recently_added', { ...data, savedAt: Date.now() });
    } catch (e) {
      console.warn('[PlaylistStorage] Error saving recently added cache:', e);
    }
  },

  // Backward compatibility
  async getStoredPlaylist(): Promise<CachedMasterPlaylist | null> {
    try {
      const data = await this.get('master_playlist_data');
      if (data && Array.isArray(data.movies) && data.movies.length > 0) {
        return data as CachedMasterPlaylist;
      }
      return null;
    } catch {
      return null;
    }
  },

  async saveStoredPlaylist(data: CachedMasterPlaylist): Promise<void> {
    try {
      await this.set('master_playlist_data', {
        ...data,
        savedAt: Date.now()
      });
    } catch {}
  },

  async clearAll(): Promise<void> {
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      });
    } catch {}
  }
};
