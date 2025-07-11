class ServerCache {
  constructor() {
    this.cache = new Map();
    this.defaultExpiry = 30 * 60 * 1000; // 30 minutes
  }

  set(key, data, expiryMs = this.defaultExpiry) {
    const expiry = Date.now() + expiryMs;
    this.cache.set(key, {
      data,
      expiry
    });
    console.log(`📦 Server cached: ${key} (expires in ${Math.round(expiryMs / 60000)} minutes)`);
  }

  get(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      console.log(`⏰ Server cache expired: ${key}`);
      return null;
    }

    console.log(`📦 Server cache hit: ${key}`);
    return cached.data;
  }

  has(key) {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() <= cached.expiry;
  }

  clear(key) {
    this.cache.delete(key);
    console.log(`🗑️ Server cache cleared: ${key}`);
  }

  clearAll() {
    this.cache.clear();
    console.log('🗑️ All server cache cleared');
  }

  getInfo() {
    const now = Date.now();
    const info = [];
    
    for (const [key, value] of this.cache.entries()) {
      const remaining = Math.max(0, value.expiry - now);
      info.push({
        key,
        remaining: Math.round(remaining / 60000), // minutes
        size: JSON.stringify(value.data).length
      });
    }
    
    return info;
  }
}

module.exports = new ServerCache(); 