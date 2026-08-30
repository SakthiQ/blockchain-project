const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabaseService = require('../services/supabaseService');
const requireSupabase = require('../middleware/requireSupabase');

// A dev-only default keeps `npm run dev` working without a .env, but shipping
// that literal to production would mean every session token is signed with a
// value published in this repo.
const JWT_SECRET = process.env.JWT_SECRET
  || (process.env.NODE_ENV === 'production' ? null : 'chainjudge_dev_only_secret');

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production.');
}

router.use(requireSupabase);

/** Shape a Supabase user row into the JSON the frontend expects. */
function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio,
    walletAddress: user.wallet_address,
  };
}

function issueToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/signup
// ──────────────────────────────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, bio, walletAddress } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existingUser = await supabaseService.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(10));

    const newUser = await supabaseService.createUser({
      name,
      email,
      passwordHash,
      role: role || 'participant',
      bio: bio || '',
      walletAddress: walletAddress || '',
    });

    res.status(201).json({
      message: 'Account created successfully',
      token: issueToken(newUser),
      user: serializeUser(newUser),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ──────────────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await supabaseService.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    res.json({
      message: 'Logged in successfully',
      token: issueToken(user),
      user: serializeUser(user),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/profile
// ──────────────────────────────────────────────────────────────────────────────
router.put('/profile', async (req, res) => {
  try {
    const { email, name, bio, walletAddress } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required to locate user profile.' });
    }

    const updates = {};
    if (name) updates.name = name;
    if (bio !== undefined) updates.bio = bio;
    if (walletAddress !== undefined) updates.wallet_address = walletAddress;

    const user = await supabaseService.updateUserByEmail(email, updates);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({
      message: 'Profile updated successfully',
      user: serializeUser(user),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
