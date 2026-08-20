const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabaseService = require('../services/supabaseService');
const User = require('../models/User'); // Mongoose fallback

const JWT_SECRET = process.env.JWT_SECRET || 'chainjudge_super_secret_jwt_key_2026';

// ──────────────────────────────────────────────────────────────────────────────
// Helper: find user by email — Supabase first, Mongoose fallback
// ──────────────────────────────────────────────────────────────────────────────
async function findUserByEmail(email) {
  if (supabaseService.isConfigured()) {
    return await supabaseService.findUserByEmail(email);
  }
  return await User.findOne({ email: email.toLowerCase() });
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

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    let newUser;

    if (supabaseService.isConfigured()) {
      newUser = await supabaseService.createUser({
        name,
        email,
        passwordHash,
        role: role || 'participant',
        bio: bio || '',
        walletAddress: walletAddress || '',
      });
    } else {
      const mongoUser = new User({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: role || 'participant',
        bio: bio || '',
        walletAddress: walletAddress || '',
      });
      await mongoUser.save();
      newUser = mongoUser;
    }

    const token = jwt.sign(
      { id: newUser._id || newUser.id, role: newUser.role, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: newUser._id || newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        bio: newUser.bio,
        walletAddress: newUser.wallet_address || newUser.walletAddress,
      },
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

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const storedHash = user.passwordHash || user.password_hash;
    const isMatch = await bcrypt.compare(password, storedHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user._id || user.id, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
        walletAddress: user.wallet_address || user.walletAddress,
      },
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

    let user;

    if (supabaseService.isConfigured()) {
      const supabase = supabaseService.getClient();
      const updates = {};
      if (name) updates.name = name;
      if (bio !== undefined) updates.bio = bio;
      if (walletAddress !== undefined) updates.wallet_address = walletAddress;

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('email', email.toLowerCase())
        .select()
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'User not found.' });
      }
      user = data;
    } else {
      user = await User.findOne({ email: email.toLowerCase() });
      if (!user) return res.status(404).json({ error: 'User not found.' });
      if (name) user.name = name;
      if (bio !== undefined) user.bio = bio;
      if (walletAddress !== undefined) user.walletAddress = walletAddress;
      await user.save();
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
        walletAddress: user.wallet_address || user.walletAddress,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
