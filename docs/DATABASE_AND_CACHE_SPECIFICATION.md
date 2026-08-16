# ChainJudge — Database & Cache Specification

> **Technical reference for the MongoDB off-chain persistence layer and Redis caching infrastructure powering the ChainJudge platform.**

---

## Table of Contents

1. [Why Off-Chain Storage?](#why-off-chain-storage)
2. [MongoDB Architecture](#mongodb-architecture)
   - [Database Overview](#database-overview)
   - [User Schema](#user-schema)
   - [ProjectApplication Schema](#projectapplication-schema)
   - [Dispute Schema](#dispute-schema)
3. [REST API Specification](#rest-api-specification)
   - [Auth Endpoints](#auth-endpoints)
   - [Applications Endpoints](#applications-endpoints)
   - [Disputes Endpoints](#disputes-endpoints)
   - [Leaderboard Endpoints](#leaderboard-endpoints)
   - [Health Endpoint](#health-endpoint)
4. [Redis Caching Architecture](#redis-caching-architecture)
   - [Why Redis?](#why-redis)
   - [5 Caching Strategies](#5-caching-strategies)
   - [Cache Service Design](#cache-service-design)
   - [Resilient Fallback Pattern](#resilient-fallback-pattern)
5. [Rate Limiting](#rate-limiting)
6. [Authentication Flow](#authentication-flow)
7. [Data Consistency Model](#data-consistency-model)

---

## Why Off-Chain Storage?

Ethereum storage (SSTORE opcode) costs approximately **20,000 gas per 32-byte slot**. Storing user profiles, rich text descriptions, and application metadata on-chain would be prohibitively expensive and wasteful.

| Data Type | Where Stored | Why |
|-----------|--------------|-----|
| Scoring logic, rankings, scores | **On-chain (EVM)** | Tamper-proof, immutable, auditable |
| Project hashes, judge addresses | **On-chain (EVM)** | Critical governance data |
| User accounts, password hashes | **MongoDB** | Private, mutable, off-chain |
| Rich text descriptions, bios | **MongoDB** | Low-cost mutable storage |
| Application details, status | **MongoDB + On-chain hash** | Indexed for fast query |
| Dispute reasons, metadata | **MongoDB + On-chain event** | Human-readable off-chain |
| Leaderboard aggregations | **Redis (30s TTL)** | Sub-2ms read performance |
| Session tokens | **Redis (7d TTL)** | Fast auth verification |
| IPFS metadata | **Redis (1hr TTL)** | Gateway round-trip avoidance |

The **fundamental principle**: Everything that affects scoring fairness or prize allocation lives on-chain. Everything that improves user experience without affecting outcome integrity lives off-chain.

---

## MongoDB Architecture

### Database Overview

```
MongoDB Instance: mongodb://127.0.0.1:27017
Database Name:    chainjudge

Collections:
  ├── users                  (User accounts)
  ├── projectapplications    (Team registration pipeline)
  └── disputes               (Scoring appeal records)
```

---

### User Schema

```javascript
// server/models/User.js
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,         // Unique index on email
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,       // bcryptjs 10 salt rounds
  },
  role: {
    type: String,
    enum: ['participant', 'judge', 'admin'],
    default: 'participant',
  },
  walletAddress: {
    type: String,
    trim: true,
    default: '',          // Linked Ethereum wallet address
  },
  bio: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
```

**Indexes**: `email` field has a unique index enforced by MongoDB. This prevents duplicate registrations at the database level independently of application-level validation.

**Password Storage**: Passwords are **never stored in plaintext**. `bcryptjs` hashes with 10 salt rounds, producing a 60-character BCrypt hash string. BCrypt is intentionally slow — 10 rounds takes ~100ms, making brute-force dictionary attacks computationally infeasible.

---

### ProjectApplication Schema

```javascript
// server/models/ProjectApplication.js
const ProjectApplicationSchema = new mongoose.Schema({
  applicationId: {
    type: Number,
    required: true,
    unique: true,          // Sequential application IDs
  },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  teamLead: { type: String, required: true },
  category: {
    type: String,
    default: 'DeFi',       // DeFi, NFT, DAO, Infrastructure, etc.
  },
  ipfsCID: {
    type: String,
    default: '',           // IPFS Content Identifier for pitch deck
  },
  applicantWallet: {
    type: String,
    required: true,        // Ethereum address of applying team
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
  },
  registeredProjectId: {
    type: Number,
    default: 0,            // On-chain projectId after approval
  },
  createdAt: { type: Date, default: Date.now },
});
```

**Dual-chain consistency**: When admin approves an application (`PUT /api/applications/:id/status` with `status: Approved`), the on-chain transaction `approveProjectApplication(appId)` is called separately via ethers.js. Both the MongoDB status and the on-chain project registration must succeed for the workflow to be complete.

---

### Dispute Schema

```javascript
// server/models/Dispute.js
const DisputeSchema = new mongoose.Schema({
  disputeId: {
    type: Number,
    required: true,
    unique: true,
  },
  projectId: {
    type: Number,
    required: true,
  },
  raisedBy: {
    type: String,
    required: true,       // Ethereum address of disputing party
  },
  reason: {
    type: String,
    required: true,       // Human-readable dispute rationale
  },
  status: {
    type: String,
    enum: ['Pending', 'Resolved', 'Rejected'],
    default: 'Pending',
  },
  createdAt: { type: Date, default: Date.now },
});
```

**Dual-layer governance**: Every dispute exists both as an on-chain `Dispute` struct (affecting `pendingDisputeCount` which blocks finalisation) and as a MongoDB document (providing rich reason text, timestamp, and full resolution audit trail).

---

## REST API Specification

### Base URL

```
http://localhost:5000/api
```

### Auth Endpoints

#### `POST /api/auth/signup`

Register a new user account.

**Request Body:**
```json
{
  "name": "Alex Rivera",
  "email": "alex@dev.io",
  "password": "securepass123",
  "role": "participant",
  "bio": "Full-stack Web3 Developer",
  "walletAddress": "0x15d34...2A65"
}
```

**Response `201 Created`:**
```json
{
  "message": "Account created successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "64f3c2a1b3d4e5f6a7b8c9d0",
    "name": "Alex Rivera",
    "email": "alex@dev.io",
    "role": "participant",
    "bio": "Full-stack Web3 Developer",
    "walletAddress": "0x15d34...2A65"
  }
}
```

**Error Responses:**
- `400 Bad Request` — Missing required fields or email already exists
- `500 Internal Server Error` — Database connection error

---

#### `POST /api/auth/login`

Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "alex@dev.io",
  "password": "securepass123"
}
```

**Response `200 OK`:**
```json
{
  "message": "Logged in successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { ... }
}
```

**Error Responses:**
- `401 Unauthorized` — Invalid email or password
- `400 Bad Request` — Missing fields

---

#### `PUT /api/auth/profile`

Update user profile fields.

**Request Body:**
```json
{
  "email": "alex@dev.io",
  "name": "Alexander Rivera",
  "bio": "Senior Web3 Architect",
  "walletAddress": "0xNewWallet..."
}
```

**Response `200 OK`:**
```json
{
  "message": "Profile updated successfully",
  "user": { ... }
}
```

---

### Applications Endpoints

#### `GET /api/applications`

Retrieve all project applications, sorted by newest first.

**Response `200 OK`:**
```json
[
  {
    "applicationId": 1,
    "name": "DeFi Yield Aggregator",
    "teamLead": "Alex Rivera",
    "category": "DeFi",
    "ipfsCID": "QmXoypizjW3WknFiJnKLwHCnL...",
    "applicantWallet": "0x15d34...",
    "status": "Pending",
    "createdAt": "2026-08-13T14:30:00.000Z"
  }
]
```

#### `POST /api/applications`

Submit a new team application.

#### `PUT /api/applications/:id/status`

Update application status. Admin operation.

**Request Body:**
```json
{
  "status": "Approved",
  "registeredProjectId": 3
}
```

---

### Disputes Endpoints

#### `GET /api/disputes`

Retrieve all dispute records sorted newest first.

#### `POST /api/disputes`

File a new dispute appeal.

**Request Body:**
```json
{
  "projectId": 2,
  "raisedBy": "0x15d34...",
  "reason": "Judge #2 had a prior business relationship with this team."
}
```

#### `PUT /api/disputes/:id/status`

Resolve or reject a dispute. Admin operation.

**Request Body:**
```json
{ "status": "Resolved" }
```

---

### Leaderboard Endpoints

#### `GET /api/leaderboard`

Returns Redis-cached leaderboard JSON. Response includes `X-Cache: HIT` or `X-Cache: MISS` header.

**Cache HIT Response (~2ms):**
```json
{
  "timestamp": "2026-08-13T16:30:00.000Z",
  "source": "redis_cache",
  "minJudgesForRanking": 2,
  "entries": [ ... ],
  "cacheStatus": "HIT"
}
```

#### `POST /api/leaderboard/invalidate`

Flushes `leaderboard:current` Redis key. Called automatically whenever a judge reveals a score.

---

### Health Endpoint

#### `GET /api/health`

Returns operational status of all services.

**Response `200 OK`:**
```json
{
  "status": "ok",
  "service": "ChainJudge API Server",
  "database": "MongoDB (Active)",
  "redisCache": "Redis Cache (Active)",
  "timestamp": "2026-08-13T16:35:11.131Z"
}
```

---

## Redis Caching Architecture

### Why Redis?

| Alternative | Problem |
|-------------|---------|
| No cache | Every leaderboard view = full EVM RPC call (~800ms) |
| In-process memory | Dies on server restart; not shared across instances |
| MongoDB cache | Persistent but slow (disk I/O); wrong tool for ephemeral data |
| **Redis** | Sub-millisecond reads, configurable TTL, pub/sub, sorted sets |

---

### 5 Caching Strategies

#### Strategy 1 — Leaderboard Read-Through Cache

```
Cache Key:  leaderboard:current
TTL:        30 seconds
Invalidation: POST /api/leaderboard/invalidate (on ScoreRevealed event)

Read Flow:
  GET /api/leaderboard
    → Check Redis for leaderboard:current
    → HIT: return cached JSON (X-Cache: HIT, ~2ms)
    → MISS: query EVM RPC, cache result, return (X-Cache: MISS, ~800ms)
```

#### Strategy 2 — On-Chain Event Stream Cache

```
Cache Key:  events:latest (Redis Sorted Set, scored by block number)
TTL:        120 seconds
Population: Triggered by EVM event listeners (ScoreRevealed, PhaseChanged, etc.)

Usage:
  TxHistoryView queries ZADD events:latest <blockNum> <eventJSON>
  → ZREVRANGE events:latest 0 49  (latest 50 events, O(log N))
```

#### Strategy 3 — Auth Session Cache

```
Cache Key:  session:<jwtToken>
TTL:        7 days (matching JWT expiry)
Value:      Serialised user object {id, email, role, walletAddress}

Flow:
  POST /api/auth/login
    → Validate credentials
    → Store session in Redis: SET session:<token> <userData> EX 604800
    → Protected routes: GET from Redis before touching MongoDB
```

#### Strategy 4 — Rate Limit Sliding Window

```
Cache Key:  ratelimit:<endpoint>:<clientIp>
TTL:        60 seconds (window size)
Value:      Hit counter (integer)

Algorithm:
  1. GET ratelimit:key → currentHits
  2. if currentHits >= maxRequests → 429 Too Many Requests
  3. SET ratelimit:key (currentHits + 1) EX windowSeconds
  4. next()
```

#### Strategy 5 — IPFS Metadata Cache

```
Cache Key:  ipfs:<contentIdentifier>
TTL:        3600 seconds (1 hour)
Value:      Resolved IPFS JSON metadata {name, description, image, attributes}

Flow:
  Request for project pitch deck with CID QmXoypiz...
    → Check Redis: GET ipfs:QmXoypiz...
    → HIT: return cached metadata
    → MISS: fetch from IPFS gateway, cache result for 1 hour
```

---

### Cache Service Design

```javascript
// server/services/cacheService.js

const cacheService = {
  async get(key) {
    if (this.isReady()) {
      return JSON.parse(await redisClient.get(key));
    }
    // In-memory fallback with TTL check
    const item = inMemoryCache.get(key);
    if (item?.expiry && Date.now() > item.expiry) {
      inMemoryCache.delete(key);
      return null;
    }
    return item?.data ?? null;
  },

  async set(key, value, ttlSeconds = 60) {
    if (this.isReady()) {
      await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } else {
      inMemoryCache.set(key, {
        data: value,
        expiry: Date.now() + (ttlSeconds * 1000),
      });
    }
  },

  async del(key) { ... },
  async flushPattern(pattern) { ... },
};
```

**API surface**: `get(key)`, `set(key, value, ttlSeconds)`, `del(key)`, `flushPattern(pattern)`, `isReady()`, `getStatus()`

---

### Resilient Fallback Pattern

```
Connection Attempt (startup):
  ioredis → Redis at 127.0.0.1:6379
    ├── SUCCESS → isRedisConnected = true
    │     All cache ops use Redis
    └── FAILURE (3 retries) → isRedisConnected = false
          All cache ops use in-memory Map with identical TTL semantics

Fallback Properties:
  ✅ Same API surface (get/set/del)
  ✅ TTL semantics preserved (expiry timestamps)
  ✅ No server crash or restart required
  ✅ Automatic upgrade if Redis comes back online
  ⚠️  In-memory cache lost on server restart (acceptable for cache data)
  ⚠️  Not shared across multiple server instances
```

---

## Rate Limiting

```javascript
// Applied in server.js
app.use('/api/auth',         rateLimiter(15, 60), authRoutes);
app.use('/api/applications', rateLimiter(10, 60), applicationRoutes);
app.use('/api/disputes',     rateLimiter(10, 60), disputeRoutes);
```

| Endpoint Group | Max Requests | Window | Rationale |
|----------------|-------------|--------|-----------|
| `/api/auth/*` | 15 req | 60s | Prevent credential stuffing |
| `/api/applications` | 10 req | 60s | Prevent application spam |
| `/api/disputes` | 10 req | 60s | Prevent frivolous dispute flooding |
| `/api/leaderboard` | Unlimited | — | Read-only, cached, low risk |
| `/api/health` | Unlimited | — | Monitoring endpoint |

**Fail-open policy**: If the Redis client throws an error during rate-limit check, the middleware calls `next()` and allows the request through. This prevents legitimate users from being locked out due to a Redis timeout.

---

## Authentication Flow

```
1. User submits email + password to POST /api/auth/login
2. Server queries MongoDB for user by email
3. bcryptjs.compare(password, user.passwordHash)
   ├── FAIL → 401 Unauthorized ("Invalid email or password")
   └── PASS ↓
4. jwt.sign({ id, role, email }, JWT_SECRET, { expiresIn: '7d' })
5. Store session in Redis: SET session:<token> <userData> EX 604800
6. Return { token, user } to client
7. Client stores token in localStorage as chainjudge_auth_session
8. Subsequent API requests: Authorization: Bearer <token>
9. Server: GET session:<token> from Redis → validate without DB hit
```

---

## Data Consistency Model

ChainJudge uses an **"on-chain as oracle"** consistency model:

```
On-chain smart contract  →  Source of Truth (scoring, rankings, governance)
MongoDB                  →  Off-chain supplement (users, rich text, metadata)
Redis                    →  Ephemeral cache (leaderboard, sessions, rate limits)

Conflict Resolution Rule:
  If MongoDB and on-chain data disagree on scoring outcomes,
  the on-chain value is ALWAYS authoritative.
  MongoDB is never used to determine who won.
```

**Eventual consistency for applications:**
1. Team calls `submitProjectApplication()` on-chain → `ApplicationSubmitted` event emitted
2. Frontend simultaneously calls `POST /api/applications` → MongoDB document created
3. If MongoDB write fails, the on-chain event still provides the authoritative record
4. On next admin panel load, the application list reconciles from on-chain events

This design ensures the platform **cannot be manipulated** by a MongoDB compromise — the scoring outcome is always governed by on-chain state.
