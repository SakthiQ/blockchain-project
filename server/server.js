const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const authRoutes = require('./routes/authRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');

const cacheService = require('./services/cacheService');
const rateLimiter = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chainjudge';

// Middleware
app.use(cors());
app.use(express.json());

// State flag for MongoDB connection
let isMongoConnected = false;

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => {
    isMongoConnected = true;
    console.log('✅ Connected to MongoDB at:', MONGO_URI);
  })
  .catch((err) => {
    isMongoConnected = false;
    console.warn('⚠️ Could not connect to local MongoDB:', err.message);
    console.warn('⚠️ Server will operate with in-memory persistence fallback.');
  });

// Health check endpoint with Redis & MongoDB status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ChainJudge API Server',
    database: isMongoConnected ? 'MongoDB (Active)' : 'In-Memory Fallback',
    redisCache: cacheService.getStatus(),
    timestamp: new Date().toISOString(),
  });
});

// API Routes with Redis Rate Limiting on sensitive endpoints
app.use('/api/auth', rateLimiter(15, 60), authRoutes);
app.use('/api/applications', rateLimiter(10, 60), applicationRoutes);
app.use('/api/disputes', rateLimiter(10, 60), disputeRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.send('ChainJudge MongoDB & Redis API Server Running');
});

// Start Server
// Export Express app for Vercel serverless execution
module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 ChainJudge API Server running on http://localhost:${PORT}`);
    console.log(`⚡ Redis Cache Status: ${cacheService.getStatus()}`);
  });
}
