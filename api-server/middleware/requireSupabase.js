const supabaseService = require('../services/supabaseService');

/**
 * Rejects requests when Supabase credentials are missing.
 *
 * Supabase is the only datastore, so an unconfigured deployment cannot serve
 * data. Returning 503 makes that obvious instead of handing back empty arrays
 * that look like a working-but-empty database.
 */
function requireSupabase(req, res, next) {
  if (!supabaseService.isConfigured()) {
    return res.status(503).json({
      error: 'Database not configured',
      message: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set on the server.',
    });
  }
  next();
}

module.exports = requireSupabase;
