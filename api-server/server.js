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
const supabaseService = require('./services/supabaseService');
const rateLimiter = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chainjudge';

// Dynamic CORS configuration for Vercel and production deployments
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['*'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// State flag for MongoDB connection
let isMongoConnected = false;

// Connect to MongoDB if MONGO_URI is specified or present
if (process.env.MONGO_URI || process.env.NODE_ENV !== 'production') {
  mongoose.connect(MONGO_URI)
    .then(() => {
      isMongoConnected = true;
      console.log('✅ Connected to MongoDB at:', MONGO_URI);
    })
    .catch((err) => {
      isMongoConnected = false;
      console.warn('⚠️ Could not connect to local MongoDB:', err.message);
    });
}

// Health check endpoint with Supabase, MongoDB, & Redis status
app.get('/api/health', (req, res) => {
  let dbStatus = 'In-Memory Persistence Fallback';
  if (supabaseService.isConfigured()) {
    dbStatus = 'Supabase Database (Active)';
  } else if (isMongoConnected) {
    dbStatus = 'MongoDB (Active)';
  }

  res.json({
    status: 'ok',
    service: 'ChainJudge API Server',
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus,
    supabase: supabaseService.getStatus(),
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
  res.send('ChainJudge API Server Running on Vercel Serverless');
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  if (isMongoConnected) mongoose.connection.close(false);
});

// Export Express app for Vercel serverless execution
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 ChainJudge API Server running on http://localhost:${PORT}`);
    console.log(`⚡ Redis Cache Status: ${cacheService.getStatus()}`);
    console.log(`🗄️ Database Status: ${supabaseService.isConfigured() ? 'Supabase' : (isMongoConnected ? 'MongoDB' : 'In-Memory')}`);
  });
}

