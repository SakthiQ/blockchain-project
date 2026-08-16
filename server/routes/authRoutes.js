const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'chainjudge_super_secret_jwt_key_2026';

// Sign Up
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, bio, walletAddress } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: role || 'participant',
      bio: bio || '',
      walletAddress: walletAddress || '',
    });

    await newUser.save();

    const token = jwt.sign({ id: newUser._id, role: newUser.role, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        bio: newUser.bio,
        walletAddress: newUser.walletAddress,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log In
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Logged in successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
        walletAddress: user.walletAddress,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Profile
router.put('/profile', async (req, res) => {
  try {
    const { email, name, bio, walletAddress } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required to locate user profile.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;
    if (walletAddress !== undefined) user.walletAddress = walletAddress;

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
        walletAddress: user.walletAddress,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
