const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

let redisClient = null;
let isRedisConnected = false;

// Fallback in-memory LRU cache
const inMemoryCache = new Map();

try {
  const redisOptions = {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) {
        return null; // Stop retrying after 3 attempts, fallback to in-memory
      }
      return Math.min(times * 100, 2000);
    },
  };

  if (REDIS_URL) {
    redisClient = new Redis(REDIS_URL, redisOptions);
  } else {
    redisClient = new Redis({
      host: REDIS_HOST,
      port: Number(REDIS_PORT),
      ...redisOptions,
    });
  }

  redisClient.on('connect', () => {
    isRedisConnected = true;
    console.log(`✅ Connected to Redis Cache`);
  });

  redisClient.on('error', (err) => {
    isRedisConnected = false;
  });
} catch (e) {
  isRedisConnected = false;
}

const cacheService = {
  isReady() {
    return isRedisConnected && redisClient && redisClient.status === 'ready';
  },

  getStatus() {
    return this.isReady() ? 'Redis Cache (Active)' : 'In-Memory Cache Fallback';
  },

  async get(key) {
    if (this.isReady()) {
      try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
      } catch (err) {
        // Fallback to in-memory
      }
    }
    const memItem = inMemoryCache.get(key);
    if (memItem) {
      if (memItem.expiry && Date.now() > memItem.expiry) {
        inMemoryCache.delete(key);
        return null;
      }
      return memItem.data;
    }
    return null;
  },

  async set(key, value, ttlSeconds = 60) {
    const stringValue = JSON.stringify(value);
    if (this.isReady()) {
      try {
        await redisClient.set(key, stringValue, 'EX', ttlSeconds);
        return true;
      } catch (err) {
        // Fallback to in-memory
      }
    }
    inMemoryCache.set(key, {
      data: value,
      expiry: Date.now() + (ttlSeconds * 1000),
    });
    return true;
  },

  async del(key) {
    if (this.isReady()) {
      try {
        await redisClient.del(key);
      } catch (err) {}
    }
    inMemoryCache.delete(key);
  },

  async flushPattern(pattern) {
    if (this.isReady()) {
      try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } catch (err) {}
    }
    for (const key of inMemoryCache.keys()) {
      if (key.includes(pattern.replace('*', ''))) {
        inMemoryCache.delete(key);
      }
    }
  },
};

module.exports = cacheService;
