/**
 * Seed Script — Demo Users
 *
 * Creates 5 demo user accounts (Admin, 3 Judges, 1 Participant) in Supabase
 * for local development and testing. Idempotent — safe to run repeatedly.
 *
 * Usage (from the project root, with SUPABASE_URL / SUPABASE_ANON_KEY set):
 *   npm run seed:users
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_ANON_KEY must be set before seeding.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

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
  console.log('✅ Connected to Supabase:', SUPABASE_URL);

  let created = 0;
  let skipped = 0;

  for (const u of DEMO_USERS) {
    const { data: existing, error: lookupError } = await supabase
      .from('users')
      .select('id')
      .eq('email', u.email)
      .maybeSingle();
    if (lookupError) throw lookupError;

    if (existing) {
      console.log(`⏭️  Skipping (already exists): ${u.email}`);
      skipped++;
      continue;
    }

    const passwordHash = await bcrypt.hash(u.password, await bcrypt.genSalt(10));

    const { error: insertError } = await supabase.from('users').insert([{
      name: u.name,
      email: u.email,
      password_hash: passwordHash,
      role: u.role,
      wallet_address: u.walletAddress,
      bio: u.bio,
    }]);
    if (insertError) throw insertError;

    console.log(`✅ Created [${u.role.padEnd(11)}]: ${u.email}`);
    created++;
  }

  console.log(`
🌱 Seeding complete. Created: ${created} | Skipped: ${skipped}`);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
