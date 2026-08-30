# ChainJudge — Database Layer

Supabase (PostgreSQL) is the only datastore for this project. This directory
holds the canonical schema and the seed script.

---

## Structure

```
db-schemas/
├── supabase_schema.sql    ← canonical schema: tables, constraints, RLS, indexes
├── seeds/
│   └── seedUsers.js       ← demo accounts for local development
└── README.md              ← this file
```

---

## Applying the schema

In the Supabase dashboard, open **SQL Editor -> New Query**, paste the entire
contents of `supabase_schema.sql`, and run it. Re-running is safe: every table
uses `CREATE TABLE IF NOT EXISTS`.

This file is the single source of truth for the database shape. Do not
hand-write the tables from a doc — the API writes columns such as
`disputes.resolved_at` that are easy to miss, and a table missing one of them
fails only at runtime, on the request that touches it.

### Tables

| Table | Purpose |
|---|---|
| `users` | Accounts, roles (`participant` / `judge` / `admin`), wallet links, bcrypt hashes |
| `project_applications` | Team self-registration applications and their approval status |
| `disputes` | Scoring dispute and appeal records |

Row-level security is enabled on all three, with policies that allow the API
server's anon key to read and write. The blockchain remains the authority for
scores and results; these tables hold the off-chain application layer.

---

## Environment

The API server needs both of these, set in Vercel for the deployed app and in a
local `.env` for development:

```
SUPABASE_URL=https://XXXXXXXXXXXX.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

Without them, `/api/health` returns HTTP 503 with `"database": "Not Configured"`
and every data route returns 503.

---

## Seeding demo data

From the project root, with the two variables above available:

```bash
npm run seed:users
```

Creates five accounts — one admin, three judges, one participant. The script is
idempotent: it skips any email that already exists, so it is safe to re-run.
