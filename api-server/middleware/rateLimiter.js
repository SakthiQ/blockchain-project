const cacheService = require('../services/cacheService');

/**
 * Sliding window rate limiter middleware, backed by the in-process cache.
 * @param {number} maxRequests - Max allowed requests per window
 * @param {number} windowSeconds - Time window in seconds
 */
function rateLimiter(maxRequests = 20, windowSeconds = 60) {
  return async (req, res, next) => {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const cacheKey = `ratelimit:${req.path}:${clientIp}`;

    try {
      const currentHits = (await cacheService.get(cacheKey)) || 0;

      if (currentHits >= maxRequests) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Please wait ${windowSeconds} seconds before trying again.`,
        });
      }

      await cacheService.set(cacheKey, currentHits + 1, windowSeconds);
      next();
    } catch (err) {
      next(); // On error, fail open to prevent blocking legitimate traffic
    }
  };
}

module.exports = rateLimiter;
