const jwt = require('jsonwebtoken');

// A dev-only default keeps `npm run dev` working without a .env, but shipping
// that literal to production would mean every session token is signed with a
// value published in this repo.
const JWT_SECRET = process.env.JWT_SECRET
  || (process.env.NODE_ENV === 'production' ? null : 'chainjudge_dev_only_secret');

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production.');
}

/**
 * Requires a valid `Authorization: Bearer <token>` header whose role is one of
 * `roles` (any role when none are given). 401 means "no usable token"; 403 means "valid token, wrong role".
 * The verified claims are exposed as `req.user`.
 */
function requireRole(...roles) {
  return (req, res, next) => {
    const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!match) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    let claims;
    try {
      claims = jwt.verify(match[1], JWT_SECRET, { algorithms: ['HS256'] });
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    if (roles.length > 0 && !roles.includes(claims.role)) {
      return res.status(403).json({ error: 'You do not have permission to do this.' });
    }

    req.user = claims;
    next();
  };
}

/** Any signed-in user. */
const requireAuth = requireRole();

module.exports = { JWT_SECRET, requireRole, requireAuth };
