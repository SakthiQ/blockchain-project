-- ============================================================
-- ChainJudge — Supabase SQL Schema
-- Run this in Supabase → SQL Editor → New Query → Run
-- ============================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE,
  password_hash    TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'participant'
                     CHECK (role IN ('participant', 'judge', 'admin')),
  wallet_address   TEXT DEFAULT '',
  bio              TEXT DEFAULT '' CHECK (char_length(bio) <= 500),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROJECT APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS project_applications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id        INTEGER NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  description           TEXT DEFAULT '' CHECK (char_length(description) <= 2000),
  team_lead             TEXT NOT NULL,
  category              TEXT DEFAULT 'DeFi'
                          CHECK (category IN ('DeFi','NFT','DAO','Infrastructure','Gaming','AI','Other')),
  ipfs_cid              TEXT DEFAULT '',
  applicant_wallet      TEXT NOT NULL,
  status                TEXT DEFAULT 'Pending'
                          CHECK (status IN ('Pending','Approved','Rejected')),
  registered_project_id INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DISPUTES TABLE
CREATE TABLE IF NOT EXISTS disputes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  INTEGER NOT NULL UNIQUE,
  project_id  INTEGER NOT NULL,
  raised_by   TEXT NOT NULL,
  reason      TEXT NOT NULL CHECK (char_length(reason) <= 2000),
  status      TEXT DEFAULT 'Pending'
                CHECK (status IN ('Pending','Resolved','Rejected')),
  resolved_at TIMESTAMPTZ DEFAULT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — Enable but allow anon access
-- for the API server (which uses the service role key or anon key)
-- ============================================================

-- Users: allow insert for signup, select for login
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read"   ON users FOR SELECT USING (true);
CREATE POLICY "Allow anon insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anon update" ON users FOR UPDATE USING (true);

-- Project Applications: open read/write for API server
ALTER TABLE project_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on applications" ON project_applications FOR ALL USING (true) WITH CHECK (true);

-- Disputes: open read/write for API server
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on disputes" ON disputes FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_applications_id ON project_applications(application_id);
CREATE INDEX IF NOT EXISTS idx_disputes_id ON disputes(dispute_id);
