# 🔍 ChainJudge — Full Config Audit & Setup Guide

## All Bugs Fixed (Code is Now Clean)

| Layer | Bug Found | Fix Applied |
|---|---|---|
| Vercel | Wrong server path `server/server.js` | → `api/index.js` ✅ |
| Vercel | SPA fallback `frontend/dist/index.html` | → `/index.html` ✅ |
| Vercel | API deps declared only in `api-server/package.json`, which `@vercel/node` never installs | → hoisted to root `package.json` ✅ |
| Hardhat | `hardhat.config.js` never loaded `.env`, so `PRIVATE_KEY` was always undefined | → `require('dotenv').config()` ✅ |
| Database | MongoDB and Redis removed; Supabase is the only datastore | → single backend ✅ |
| API | Missing Supabase config silently served empty arrays | → 503 from every route ✅ |
| API | Rate limit buckets collided across routers | → keyed by full route path ✅ |
| Blockchain | `getReadOnlyContract` hardcoded `localhost:8545` | → `VITE_RPC_URL` env var ✅ |
| Blockchain | `connectLocalAccount` hardcoded `localhost:8545` | → `VITE_LOCAL_RPC_URL` env var ✅ |
| Frontend | No API proxy for local dev | → Added Vite proxy ✅ |
| Git | `api-server/node_modules` not excluded | → Added to `.gitignore` ✅ |

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PART 1 — SUPABASE SETUP
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Step 1.1 — Create Supabase Project

1. Go to **[supabase.com](https://supabase.com)** → Sign in
2. Click **"New Project"**
3. Set:
   - **Name**: `chainjudge`
   - **Database Password**: create a strong password (save it!)
   - **Region**: `Southeast Asia (Singapore)` ← closest to India
4. Wait ~2 minutes for provisioning

### Step 1.2 — Run SQL Schema

1. Sidebar → **"SQL Editor"** → **"New Query"**
2. Open [`db-schemas/supabase_schema.sql`](file:///c:/Users/Administrator/.gemini/antigravity/playground/metallic-rocket/blockchain%20project/db-schemas/supabase_schema.sql) → copy all contents
3. Paste into SQL Editor → click **Run** (`Ctrl+Enter`)
4. ✅ Expected: `Success. No rows returned`

> [!CAUTION]
> If you see `ERROR: relation "users" already exists`, the tables are already created. Safe to ignore.

### Step 1.3 — Get Your API Keys

Sidebar → **"Project Settings"** (gear icon) → **"API"**

Copy these **two values**:

```
Project URL:   https://XXXXXXXXXXXX.supabase.co
anon key:      eyJhbGciOiJIUzI1NiIsInR5cCI6...  (very long JWT)
```

> [!WARNING]
> Use the `anon` public key — NOT the `service_role` key.
> The service_role key bypasses all security and must never be exposed.

### Step 1.4 — Verify Table Structure

Sidebar → **"Table Editor"** — you should see three tables:
- `users`
- `project_applications`
- `disputes`

### ❌ Common Supabase Errors

| Error | Cause | Fix |
|---|---|---|
| `database: "Not Configured"` | Wrong or missing env vars | Verify `SUPABASE_URL` starts with `https://` |
| `500` on signup | Tables don't exist | Re-run `supabase_schema.sql` |
| `duplicate key` on signup | Email already registered | Use a different test email |
| `new row violates row-level security` | RLS policies not created | Re-run the full SQL schema (includes RLS policies) |
| `Invalid API key` | Using wrong key | Use `anon` key, not `service_role` |

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PART 2 — VERCEL DEPLOYMENT SETUP
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Step 2.1 — Import Project

1. **[vercel.com](https://vercel.com)** → **"Add New"** → **"Project"**
2. Connect GitHub → find `blockchain-project` repo → **"Import"**

### Step 2.2 — Configure Project (CRITICAL)

On the configuration screen:

| Setting | Value |
|---|---|
| **Framework Preset** | `Other` (NOT Vite — we have a monorepo) |
| **Root Directory** | ` ` ← Leave **BLANK** (project root) |
| **Build Command** | `npm run vercel-build` |
| **Output Directory** | `frontend/dist` |
| **Install Command** | `npm install` |

> [!CAUTION]
> Do NOT set Root Directory to `frontend`. The `vercel.json` is at the root and controls
> BOTH the API serverless function AND the frontend build. Setting root to `frontend`
> will make Vercel ignore `vercel.json` and break the API.

### Step 2.3 — Add Environment Variables

Click **"Environment Variables"** and add ALL of these:

**Backend (API Server) Variables:**
| Name | Value |
|---|---|
| `SUPABASE_URL` | `https://XXXX.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJ...` (anon key from Supabase) |
| `JWT_SECRET` | run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | `https://your-project.vercel.app` ← update after first deploy |

**Frontend (VITE) Variables:**
| Name | Value |
|---|---|
| `VITE_API_BASE_URL` | `/api` |
| `VITE_RPC_URL` | `https://rpc.sepolia.org` |

> [!WARNING]
> Every `VITE_` value is compiled into the public JS bundle and is readable by anyone
> who opens the site. Never put a secret behind that prefix.
>
> Do **not** set `VITE_CONTRACT_ADDRESS` or `VITE_CHAIN_ID` — nothing reads them.
> Contract addresses come from `frontend/src/contracts/contract-address.json`.
>
> Do **not** set `REDIS_URL` or `MONGO_URI` — both datastores were removed.
> Supabase is the only one. If either is already set in your project, delete it.

> [!TIP]
> Set all env vars to apply to **"Production"**, **"Preview"**, and **"Development"** environments
> (tick all three checkboxes when adding each var).

### Step 2.4 — Deploy

Click **"Deploy"** → Wait ~3 minutes

### Step 2.5 — Update CORS After Deploy

Once you have your URL (e.g. `https://chainjudge-abc123.vercel.app`):

1. Vercel → Project → **Settings** → **Environment Variables**
2. Edit `CORS_ORIGIN` → set to your exact URL
3. **Deployments** → latest → **"Redeploy"**

### ❌ Common Vercel Errors

| Error | Cause | Fix |
|---|---|---|
| `Build failed: Cannot find module` | Wrong Root Directory set | Set Root Directory to blank (project root) |
| `404` on all `/api/*` routes | `vercel.json` not found or wrong | Ensure Root Directory is blank so Vercel reads `vercel.json` |
| Frontend loads but API returns `CORS error` | `CORS_ORIGIN` mismatch | Set exact URL + redeploy |
| `Function timeout` | Serverless function took >10s | Free tier limit — check for slow DB queries |
| `Module not found: api-server` | `api/index.js` path wrong | Verify `../api-server/server` path in `api/index.js` |
| White screen on refresh | SPA fallback broken | `vercel.json` route `/(.*) → /index.html` must be present |

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## PART 3 — BLOCKCHAIN / CONTRACT SETUP
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Step 3.1 — Set Up Root .env

Create a `.env` file in the **project root** (NOT inside `api-server/` or `frontend/`):

```env
SEPOLIA_RPC_URL="https://rpc.sepolia.org"
PRIVATE_KEY="0xYOUR_WALLET_PRIVATE_KEY"
ETHERSCAN_API_KEY=""
```

> [!CAUTION]
> Export private key from MetaMask: Account → 3-dot menu → Account Details → Show Private Key.
> NEVER share or commit this file. `.gitignore` already excludes `.env`.

### Step 3.2 — Get Sepolia Testnet ETH (Free)

You need at least **0.05 ETH** to deploy both contracts. Get it free from:
- [sepoliafaucet.com](https://sepoliafaucet.com) — requires Alchemy account
- [faucets.chain.link](https://faucets.chain.link/sepolia) — requires 1 LINK
- [faucet.sepolia.dev](https://faucet.sepolia.dev) — Google/GitHub login

### Step 3.3 — Install Dependencies & Deploy

```bash
# In the project root
npm install

# Compile contracts first
npm run compile

# Deploy to Sepolia
npm run deploy:sepolia
```

Expected output:
```
========================================
  HackathonJudging & WinnerNFT Deploy
========================================
Network Name: sepolia (Chain ID: 11155111)
Deployer address: 0xYourAddress
Deployer balance: 0.12 ETH

> Deploying HackathonJudging...
> HackathonJudging deployed at: 0xNEW_ADDRESS_1

> Deploying WinnerNFT...
> WinnerNFT deployed at: 0xNEW_ADDRESS_2

> WinnerNFT linked successfully!
> Contract addresses exported to: frontend/src/contracts/contract-address.json
```

### Step 3.4 — Commit the New Addresses

The deploy script auto-updates `contract-address.json`. Now push it:

```bash
git add frontend/src/contracts/contract-address.json
git add frontend/src/contracts/HackathonJudging.json
git add frontend/src/contracts/WinnerNFT.json
git commit -m "feat: deploy contracts to Sepolia testnet"
git push
```

Then trigger a **Redeploy** on Vercel.

### Step 3.5 — Add Contract to MetaMask Network

In MetaMask → Settings → Networks → Add Network:
- **Network Name**: Sepolia Testnet
- **RPC URL**: `https://rpc.sepolia.org`
- **Chain ID**: `11155111`
- **Currency Symbol**: `ETH`
- **Block Explorer**: `https://sepolia.etherscan.io`

### ❌ Common Blockchain Errors

| Error | Cause | Fix |
|---|---|---|
| `insufficient funds` on deploy | Not enough Sepolia ETH | Get more from faucet |
| `no accounts` on deploy | `PRIVATE_KEY` missing in `.env` | Add `PRIVATE_KEY` to root `.env` |
| Contract calls return wrong data | Old local addresses in `contract-address.json` | Re-run `npm run deploy:sepolia` |
| MetaMask shows wrong network | User on wrong chain | App should prompt network switch; if not, add Sepolia manually |
| `call revert exception` | Wrong ABI or wrong address | Verify `contract-address.json` has current Sepolia addresses |
| `getReadOnlyContract` fails silently | RPC URL unreachable | Set `VITE_RPC_URL` env var in Vercel to a reliable RPC |

---

## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## FINAL CHECKLIST — Before Deploying
## ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
□ Supabase project created
□ SQL schema executed (3 tables visible in Table Editor)
□ SUPABASE_URL and SUPABASE_ANON_KEY copied
□ Root .env created with PRIVATE_KEY
□ npm run deploy:sepolia ran successfully
□ contract-address.json has real Sepolia addresses (not 0x5FbDB...)
□ git add + commit + push done
□ Vercel project created with Root Directory = BLANK
□ All 6 env vars added in Vercel dashboard
□ Vercel build succeeded
□ /api/health returns HTTP 200 and database: "Supabase Database (Active)"
□ CORS_ORIGIN updated to actual Vercel URL + redeployed
□ MetaMask connected to Sepolia testnet
□ Signup/Login works in production
```

---

## Quick Health Check URLs

After deploy, open these in browser:

```
https://your-project.vercel.app/api/health    ← API + database status
https://your-project.vercel.app/              ← Frontend React app
```

Expected `/api/health` response:
```json
{
  "status": "ok",
  "service": "ChainJudge API Server",
  "environment": "production",
  "database": "Supabase Database (Active)",
  "cache": "In-Process TTL Cache"
}
```

If Supabase credentials are missing or wrong, `/api/health` returns **HTTP 503**
with `"status": "degraded"` and `"database": "Not Configured"`, and every data
route returns 503. That is the fastest way to tell a bad env var from a bad build.
