/**
 * api/index.js
 * Vercel Serverless adapter — re-exports the Express app from api-server.
 * Vercel uses this file as the entry point for all /api/* routes.
 */
const app = require('../api-server/server');

module.exports = app;
