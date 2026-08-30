const express = require('express');
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

// Health check endpoint — reports Supabase reachability and cache mode
app.get('/api/health', (req, res) => {
  const configured = supabaseService.isConfigured();

  res.status(configured ? 200 : 503).json({
    status: configured ? 'ok' : 'degraded',
    service: 'ChainJudge API Server',
    environment: process.env.NODE_ENV || 'development',
    database: supabaseService.getStatus(),
    cache: cacheService.getStatus(),
    timestamp: new Date().toISOString(),
  });
});

// API Routes with rate limiting on sensitive endpoints
app.use('/api/auth', rateLimiter(15, 60), authRoutes);
app.use('/api/applications', rateLimiter(10, 60), applicationRoutes);
app.use('/api/disputes', rateLimiter(10, 60), disputeRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.send('ChainJudge API Server Running on Vercel Serverless');
});

// Export Express app for Vercel serverless execution
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 ChainJudge API Server running on http://localhost:${PORT}`);
    console.log(`⚡ Cache: ${cacheService.getStatus()}`);
    console.log(`🗄️ Database: ${supabaseService.getStatus()}`);
  });
}

