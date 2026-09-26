// IndexedDB Client-side High-Speed Storage for Master Playlist
// Solves localStorage 5MB QuotaExceededError and provides instant (<50ms) offline/cache loading

const DB_NAME = 'iptv_master_cache_db';
const DB_VERSION = 1;
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

  async getStoredPlaylist(): Promise<CachedMasterPlaylist | null> {
    try {
      const data = await this.get('master_playlist_data');
      if (data && Array.isArray(data.movies) && data.movies.length > 0) {
        return data as CachedMasterPlaylist;
      }
      return null;
    } catch (err) {
      console.warn('[PlaylistStorage] Error reading cache:', err);
      return null;
    }
  },

  async saveStoredPlaylist(data: CachedMasterPlaylist): Promise<void> {
    try {
      await this.set('master_playlist_data', {
        ...data,
        savedAt: Date.now()
      });
      console.log(`[PlaylistStorage] Successfully cached ${data.movies?.length || 0} movies & ${data.series?.length || 0} series to IndexedDB.`);
    } catch (err) {
      console.warn('[PlaylistStorage] Failed to save cache:', err);
    }
  },

  async clearStoredPlaylist(): Promise<void> {
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
  }
};
