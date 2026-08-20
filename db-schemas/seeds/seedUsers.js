/**
 * Seed Script — Demo Users
 *
 * Creates 5 demo user accounts (Admin, 3 Judges, 1 Participant) for
 * local development and testing. Idempotent — safe to run multiple times.
 *
 * Usage:
 *   node database/seeds/seedUsers.js
 */

require('dotenv').config({ path: '../backend/.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chainjudge';

const DEMO_USERS = [
  {
    name: 'Admin Account',
    email: 'admin@chainjudge.org',
    password: 'admin123',
    role: 'admin',
    walletAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    bio: 'Lead Hackathon Administrator & Protocol Governance Supervisor',
  },
  {
    name: 'Dr. Emily Chen',
    email: 'emily.chen@stanford.edu',
    password: 'judge123',
    role: 'judge',
    walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    bio: 'Associate Professor of Computer Science & Web3 Security Researcher',
  },
  {
    name: 'Prof. Mark Rodriguez',
    email: 'm.rodriguez@mit.edu',
    password: 'judge123',
    role: 'judge',
    walletAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    bio: 'Fintech Director & Distributed Systems Specialist',
  },
  {
    name: 'Ms. Priya Patel',
    email: 'priya@blockchainlabs.io',
    password: 'judge123',
    role: 'judge',
    walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    bio: 'Venture Partner & Smart Contract Auditor',
  },
  {
    name: 'Alex Rivera',
    email: 'alex.rivera@dev.io',
    password: 'participant123',
    role: 'participant',
    walletAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    bio: 'Full-stack Web3 Builder & Decentralized Systems Enthusiast',
  },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB:', MONGO_URI);

  let created = 0;
  let skipped = 0;

  for (const u of DEMO_USERS) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`⏭️  Skipping (already exists): ${u.email}`);
      skipped++;
      continue;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(u.password, salt);

    await User.create({
      name: u.name,
      email: u.email,
      passwordHash,
      role: u.role,
      walletAddress: u.walletAddress,
      bio: u.bio,
    });

    console.log(`✅ Created [${u.role.padEnd(11)}]: ${u.email}`);
    created++;
  }

  console.log(`\n🌱 Seeding complete. Created: ${created} | Skipped: ${skipped}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
