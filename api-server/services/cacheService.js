/**
 * cacheService.js
 * In-process TTL cache. No external cache server — Supabase is the only
 * backing store in this project, and a short-lived cache does not need one.
 *
 * NOTE: on Vercel each serverless instance holds its own copy, so entries are
 * per-instance and vanish when an instance is recycled. That is acceptable
 * here: everything cached is either recomputable (leaderboard) or advisory
 * (rate-limit counters).
 */

const store = new Map();

// Drop expired keys once the map grows, so a long-lived instance cannot leak.
const SWEEP_THRESHOLD = 500;

function sweep() {
  const now = Date.now();
  for (const [key, item] of store) {
    if (item.expiry && now > item.expiry) store.delete(key);
  }
}

const cacheService = {
  isReady() {
    return true;
  },

  getStatus() {
    return 'In-Process TTL Cache';
  },

  async get(key) {
    const item = store.get(key);
    if (!item) return null;
    if (item.expiry && Date.now() > item.expiry) {
      store.delete(key);
      return null;
    }
    return item.data;
  },

  async set(key, value, ttlSeconds = 60) {
    if (store.size > SWEEP_THRESHOLD) sweep();
    store.set(key, {
      data: value,
      expiry: Date.now() + ttlSeconds * 1000,
    });
    return true;
  },

  async del(key) {
    store.delete(key);
  },

  async flushPattern(pattern) {
    const prefix = pattern.replace('*', '');
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },
};

module.exports = cacheService;
