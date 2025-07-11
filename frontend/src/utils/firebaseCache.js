const CACHE_PREFIX = 'firebase_cache_';
const DEFAULT_EXPIRY = 30 * 60 * 1000; // 30 minutes

export const firebaseCache = {
  // Save data to cache with expiration
  set: (key, data, expiryMs = DEFAULT_EXPIRY) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + expiryMs
      };
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheData));
      console.log(`📦 Cached ${key} (expires in ${Math.round(expiryMs / 60000)} minutes)`);
    } catch (error) {
      console.warn('Failed to save to cache:', error);
    }
  },

  // Get data from cache if not expired
  get: (key) => {
    try {
      const cached = localStorage.getItem(CACHE_PREFIX + key);
      if (!cached) return null;

      const cacheData = JSON.parse(cached);
      const now = Date.now();

      if (now > cacheData.expiry) {
        // Cache expired, remove it
        localStorage.removeItem(CACHE_PREFIX + key);
        console.log(`⏰ Cache expired for ${key}`);
        return null;
      }

      console.log(`📦 Retrieved ${key} from cache`);
      return cacheData.data;
    } catch (error) {
      console.warn('Failed to read from cache:', error);
      return null;
    }
  },

  // Check if cache exists and is valid
  has: (key) => {
    try {
      const cached = localStorage.getItem(CACHE_PREFIX + key);
      if (!cached) return false;

      const cacheData = JSON.parse(cached);
      return Date.now() <= cacheData.expiry;
    } catch (error) {
      return false;
    }
  },

  // Clear specific cache entry
  clear: (key) => {
    try {
      localStorage.removeItem(CACHE_PREFIX + key);
      console.log(`🗑️ Cleared cache for ${key}`);
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  },

  // Clear all Firebase cache
  clearAll: () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      console.log('🗑️ Cleared all Firebase cache');
    } catch (error) {
      console.warn('Failed to clear all cache:', error);
    }
  },

  // Get cache info
  getInfo: () => {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      const cacheInfo = cacheKeys.map(key => {
        const cached = localStorage.getItem(key);
        if (cached) {
          const cacheData = JSON.parse(cached);
          const remaining = Math.max(0, cacheData.expiry - Date.now());
          return {
            key: key.replace(CACHE_PREFIX, ''),
            remaining: Math.round(remaining / 60000), // minutes
            size: cached.length
          };
        }
        return null;
      }).filter(Boolean);

      return cacheInfo;
    } catch (error) {
      console.warn('Failed to get cache info:', error);
      return [];
    }
  }
}; 