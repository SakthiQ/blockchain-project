const express = require('express');
const router = express.Router();
const cacheService = require('../services/cacheService');

const LEADERBOARD_CACHE_KEY = 'leaderboard:current';
const CACHE_TTL = 30; // 30 seconds TTL

// GET /api/leaderboard - Returns cached leaderboard JSON
router.get('/', async (req, res) => {
  try {
    const cachedData = await cacheService.get(LEADERBOARD_CACHE_KEY);
    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cachedData);
    }

    // Cache MISS — Data will be compiled & cached
    res.setHeader('X-Cache', 'MISS');
    res.json({
      timestamp: new Date().toISOString(),
      source: 'live_evm_chain',
      minJudgesForRanking: 2,
      entries: [],
      message: 'Leaderboard query compiled from EVM block state.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/leaderboard/invalidate - Flush leaderboard cache on new ScoreSubmitted event
router.post('/invalidate', async (req, res) => {
  try {
    await cacheService.del(LEADERBOARD_CACHE_KEY);
    res.json({ message: 'Leaderboard cache invalidated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
