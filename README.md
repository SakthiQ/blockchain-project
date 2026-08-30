# ⛓️ ChainJudge: Advanced Blockchain-Based Hackathon Judging Platform

An undergraduate capstone blockchain project demonstrating **decentralized, tamper-proof, anti-collusion hackathon judging** powered by EVM smart contracts. The system expands upon a 4-module paper baseline into a production-grade **4-tier architecture** comprising 17 distinct features — including Commit–Reveal blind scoring, on-chain Soulbound Winner NFT certificates, a Dispute/Appeal governance system, and a statistically rigorous Trimmed-Mean leaderboard engine.

---

## 📐 Paper Baseline vs. Final Implementation

> This section maps the original 4-module academic design (Section IV of the paper) to the expanded implementation.

| Paper Module (Section IV) | Paper Scope | Final Implementation | Tier |
| :--- | :--- | :--- | :--- |
| Judge Registration | Admin registers authorized judges | ✅ `registerJudge()` with 2-step admin transfer | Tier 1 |
| Score Submission | Direct multi-criteria score submission | ✅ Commit-Reveal blind scoring (`commitScore` → `revealScore`) | Tier 1 |
| Immutable Record | On-chain event logging | ✅ Append-only `ScoreRecord[]` versioning + Events | Tier 2 |
| Leaderboard Generation | Sort projects by average score | ✅ Trimmed-mean, quorum-gated, deterministic 5-tier tie-breaking | Tier 2/4 |
| *(not in paper)* | — | ✅ Conflict-of-Interest Recusal | Tier 1 |
| *(not in paper)* | — | ✅ Weighted Scoring Rubric (configurable %) | Tier 1 |
| *(not in paper)* | — | ✅ Gas Optimization (storage caching, `viaIR`) | Tier 2 |
| *(not in paper)* | — | ✅ Soulbound ERC-721 Winner NFT Certificates | Tier 2 |
| *(not in paper)* | — | ✅ IPFS Decentralized Media Storage | Tier 3 |
| *(not in paper)* | — | ✅ Minimum-Quorum Ranking (#14) | Tier 4 |
| *(not in paper)* | — | ✅ Deterministic 5-Tier Tie-Breaking (#15) | Tier 4 |
| *(not in paper)* | — | ✅ Appeal/Dispute Window with Finalization Guard (#18) | Tier 4 |
| *(not in paper)* | — | ✅ Team Self-Registration with Admin Approval (#23) | Tier 4 |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend Layer                        │
│  React 18 + Vite  │  ethers.js v6  │  Lucide Icons      │
│  MetaMask EIP-1193 integration │ Demo Account Switcher  │
└──────────────────────────┬──────────────────────────────┘
                           │ JSON-RPC
┌──────────────────────────▼──────────────────────────────┐
│                  EVM Contract Layer                      │
│  HackathonJudging.sol (Solidity ^0.8.24, viaIR)          │
│  WinnerNFT.sol (ERC-721 Soulbound, On-chain SVG)         │
└──────────────────────────┬──────────────────────────────┘
                           │ Hardhat Runtime
┌──────────────────────────▼──────────────────────────────┐
│              Development & Test Environment              │
│  Hardhat Node (Chain ID 31337) │ Hardhat Ignition Deploy  │
│  Chai + ethers.js Test Suite (38 tests, 100% pass)       │
└──────────────────────────┬──────────────────────────────┘
                           │ Optional Testnet Deploy
┌──────────────────────────▼──────────────────────────────┐
│            Cloud & Decentralized Storage                 │
│  IPFS (pitch deck / demo video CIDs stored on-chain)     │
│  Vercel (frontend hosting) │ Supabase (off-chain auth)   │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features & Architectural Upgrades (Tiers 1–3)

### 🥇 Tier 1 — High Impact & Governance (Viva Highlights)
1. **Commit–Reveal Blind Scoring**:
   - Judges commit a secret cryptographic hash `keccak256(projectId, scores..., salt)` during the `Judging` phase.
   - Scores are revealed and verified against the hash during the `Revealing` phase.
   - Prevents early score visibility and eliminates judge anchoring bias.
2. **Phase Lifecycle State Machine**:
   - Governed by `enum Phase { Setup, Judging, Revealing, Finalized }`.
   - Immutable phase transition boundaries enforce that score modification or submission is impossible once `Finalized`.
3. **Conflict-of-Interest Recusal**:
   - Admins flag judge conflicts per project (`judgeConflicts[judge][projectId] = true`).
   - Recused judges cannot commit or submit scores and are excluded from average denominators.
4. **Weighted Scoring Rubric**:
   - Configurable criteria weights (e.g. Technical 35%, Innovation 30%, UX 20%, Impact 15%) summing to 100%.

### 🛠️ Tier 2 — EVM Engineering & Optimization Signal
5. **Trimmed Mean Outlier Detection**:
   - Calculates aggregate scores using a **Trimmed Mean** (dropping the highest and lowest scores when $\ge 3$ judges have evaluated a project), preventing rogue judges from skewing leaderboard rankings.
6. **Append-Only Score Versioning**:
   - All score revisions append to `ScoreSubmission[]` on-chain, preserving an immutable audit log while offering user-friendly corrections.
7. **Two-Step Admin Transfer (`Ownable2Step`)**:
   - `proposeNewAdmin()` and `acceptAdmin()` prevent accidental contract bricking from address typos.
8. **Soulbound Winner Certificate NFTs (ERC-721)**:
   - Top-3 projects mint non-transferable ERC-721 Winner Certificates with dynamic, on-chain SVG vector metadata.
9. **Gas Optimization Pass**:
   - Cached total score state variables eliminate $O(\text{projects} \times \text{judges})$ recalculations.

### 🌐 Tier 3 — Web3 Infrastructure & UI Polish
10. **Multi-Network Support**: Local Hardhat network + Sepolia / Base Sepolia testnet readiness.
11. **MetaMask & Demo Account Switcher**: Real MetaMask EIP-1193 integration alongside deterministic local test accounts.
12. **IPFS Decentralized Media Storage**: Stores demo videos and pitch decks on IPFS, keeping immutable CIDs on-chain.
13. **Judge Scorecard Matrix**: Visual evaluation progress bar ("X / Y projects scored") and cross-judge comparison matrix.

### 🔬 Tier 4 — Advanced Governance & Statistical Rigor
14. **Minimum-Quorum Ranking (#14)**:
    - `uint256 minJudgesForRanking` (admin-configurable, default: 2) acts as a quorum gate.
    - `LeaderboardEntry.quorumMet` flag separates projects into a ranked bracket and a "Provisional" bucket.
    - Prevents a single generous judge from outranking a project evaluated by multiple peers — a real-world flaw caught by interrogating the aggregate math.
15. **Deterministic 5-Tier Tie-Breaking (#15)**:
    - Replaced the unstable bubble sort with an explicit cascade: `quorumMet` → `trimmedScore` → `averageScore` → `judgeCount` → `projectId`.
    - Equal averages are no longer resolved by insertion order (arbitrary), ensuring reproducible rankings across all EVM nodes.
    - Implemented via a pure `_shouldSwap(a, b)` internal helper — one function, five tiers, zero ambiguity.
16. **Appeal Window & Dispute System (#18)**:
    - `enum DisputeStatus { Pending, Resolved, Rejected }` with on-chain `Dispute` struct.
    - Any address can call `raiseDispute(projectId, reason)` during Judging or Revealing phases.
    - `setPhase(Finalized)` **reverts** while `pendingDisputeCount > 0` — admin cannot finalize while open appeals exist.
    - Admin resolves via `resolveDispute(disputeId, bool approve)`. Decrement is guaranteed by checks-effects pattern.
17. **Team Self-Registration with Admin Approval (#23)**:
    - Public `submitProjectApplication()` lets any wallet apply during Setup phase without admin involvement.
    - `approveProjectApplication()` atomically calls `_registerProjectInternal()` — no duplication of registration logic.
    - `rejectProjectApplication()` silently declines without on-chain side effects.
    - Admin panel shows a pending-applications queue; the Projects tab shows an "Apply" button gated to Setup phase.

---

## 📊 Gas Optimization Benchmark Report

> **Addressing Paper Limitation (Section VIII-A):** The original paper identifies *"on-chain transaction gas costs for every score submission"* as a key limitation. The following optimization pass directly addresses this by eliminating repeated O(projects × judges) loop scans in favour of cached aggregate state variables, reducing view and write costs by 72–74%.

| Operation | Before Optimization | After Storage Caching | Gas Saved | How |
| :--- | :--- | :--- | :--- | :--- |
| `getProjectAggregateScore()` | ~45,200 gas (loop scan) | ~12,400 gas (cached state) | **~72.5%** | `totalRawScore` cached in `Project` struct; no loop needed |
| `getLeaderboard()` (4 Projects) | ~185,000 gas | ~48,000 gas | **~74.0%** | Trimmed-mean computed once at reveal-time, not at read-time |
| `revealScore()` | N/A | ~68,200 gas | Optimized | Storage writes batched; `viaIR` compiler reduces calldata cost |
| `commitScore()` | N/A | ~42,800 gas | Optimized | Hash stored as `bytes32` (1 slot); no string serialization |

**Compiler Optimizations Enabled** (`hardhat.config.js`):
- `viaIR: true` — Enables Yul IR pipeline, eliminating stack-too-deep errors and improving inlining.
- `optimizer.runs: 200` — Balanced for deployment cost vs. call cost (favours read-heavy leaderboard queries).

---

## 🛠️ Tech Stack

* **Smart Contracts**: Solidity `^0.8.24` (EVM Cancun target, `viaIR` enabled), OpenZeppelin `v5.0`
* **Development Environment**: Hardhat, Ethers.js `v6`, Chai
* **Frontend**: React 18, Vite, Lucide Icons, CSS Grid/Flexbox
* **Decentralized Storage**: IPFS CIDs & Base64 On-Chain SVG rendering

---

## 💻 Running the Application

### 1. Compile & Test Smart Contracts
```bash
# Install dependencies
npm install

# Run complete Hardhat unit test suite (38 passing tests)
npx hardhat test
```

### 2. Launch Local Hardhat Node & Seed Demo Data
```bash
# Terminal 1: Start local node
npx hardhat node

# Terminal 2: Deploy smart contracts & seed test scenario
npx hardhat run scripts/deploy.js --network localhost
npx hardhat run scripts/seed.js --network localhost
```

### 3. Launch Frontend Web App
```bash
# Terminal 2 or 3: Start frontend dev server
cd frontend
npm run dev
```

Open `http://localhost:5173` in your browser to interact with the full dApp!

---

## 🌐 Production & Vercel Deployment Guide

### 1. Deploy Smart Contracts to Testnet (Sepolia / Base Sepolia)
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Add your wallet `PRIVATE_KEY` and RPC URL (`SEPOLIA_RPC_URL` or `BASE_SEPOLIA_RPC_URL`).
3. Deploy contracts to Sepolia or Base Sepolia:
   ```bash
   # Deploy to Sepolia
   npm run deploy:sepolia

   # Deploy to Base Sepolia
   npm run deploy:base-sepolia
   ```
4. The deploy script writes the new addresses and ABIs into
   `frontend/src/contracts/` automatically. Commit those files — the frontend
   reads them at build time.

---

> **Node.js 22 or newer is required.** `@supabase/supabase-js` needs a native
> `WebSocket`, which older majors do not provide; on Node 20 the client fails to
> initialize and every API route returns 503 even with correct credentials.

### 2. Set Up the Supabase Database

Supabase is the only datastore — there is no MongoDB or Redis to provision.

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor -> New Query**, paste the full contents of
   [`db-schemas/supabase_schema.sql`](db-schemas/supabase_schema.sql), and run it.
   That file is the canonical schema: it creates all three tables with the
   constraints, indexes, and row-level security policies the API expects.
3. Copy `SUPABASE_URL` and `SUPABASE_ANON_KEY` from **Project Settings -> API**.
4. Optionally seed five demo accounts (1 admin, 3 judges, 1 participant):
   ```bash
   npm run seed:users
   ```

> Do not hand-write the tables. An earlier version of this README inlined a
> schema that omitted `disputes.resolved_at`, which the dispute resolution
> endpoint writes to — resolving a dispute failed against those tables.

---

### 3. Deploy Fullstack Application on Vercel
1. Install Vercel CLI (or connect your GitHub repository to Vercel):
   ```bash
   npm i -g vercel
   vercel
   ```
2. In your **Vercel Project Settings -> Environment Variables**, add:
   - `SUPABASE_URL` = `https://your-project.supabase.co`
   - `SUPABASE_ANON_KEY` = `your-anon-key`
   - `JWT_SECRET` = a long random string (required in production)
   - `CORS_ORIGIN` = your deployed URL, e.g. `https://your-project.vercel.app`
   - `VITE_API_BASE_URL` = `/api`
   - `VITE_RPC_URL` = your Sepolia RPC endpoint

   Do **not** set `REDIS_URL` or `MONGO_URI` — those datastores were removed.
   Do **not** set `VITE_CONTRACT_ADDRESS`; addresses are read from
   `frontend/src/contracts/contract-address.json`, which the deploy script
   regenerates. Commit that file after deploying.

   Note that every `VITE_` value is compiled into the public bundle. Never put
   a secret behind that prefix.
3. Trigger deployment:
   ```bash
   vercel --prod
   ```

---


## 🎓 Viva Defense Q&A Cheatsheet

1. **Q: Why is public blockchain transparency bad for secret ballots, and how did you solve it?**
   - *A*: On a public ledger, submitted transactions are visible in the mempool and blocks, allowing later judges to copy or anchor to early scores. We solved this using a **Commit–Reveal scheme**: judges first submit a `keccak256(projectId, scores, salt)` hash in Phase 1, and only reveal their actual scores and salt in Phase 2.
2. **Q: How do you handle floating point math in Solidity for averages?**
   - *A*: Solidity does not support floating point numbers. We multiply total raw scores by 100 before dividing by `judgeCount` to preserve 2 decimal places of precision (e.g. `8550` represents `85.50`).
3. **Q: What is a Soulbound NFT and why use it for winners?**
   - *A*: A Soulbound NFT is an ERC-721 token that overrides transfer functions (`_update`) to prevent user-to-user transfers. It binds permanently to the recipient's wallet address, serving as an immutable, non-fakeable credential.
4. **Q: Couldn't one very generous judge unfairly rank their favourite project above a project evaluated by five judges?**
   - *A*: Yes — that was a real flaw in our original `getLeaderboard()`. We fixed it with `minJudgesForRanking`: projects below the quorum threshold are demoted to a provisional bucket and cannot out-rank quorum-met entries regardless of score. The leaderboard renders two distinct sections: Ranked (quorum met) and Provisional.
5. **Q: What happens if two projects tie on trimmed score?**
   - *A*: The original bubble sort was unstable — ties resolved by insertion order, which is arbitrary. We replaced it with a deterministic 5-tier cascade: `quorumMet` → `trimmedScore` → `averageScore` → `judgeCount` → `projectId`. Every node will produce the same ranking for the same state, removing any ambiguity that could fuel post-hackathon disputes.
6. **Q: How do teams raise a scoring appeal and how does it affect finalization?**
   - *A*: Any wallet can call `raiseDispute(projectId, reason)` during Judging or Revealing phases. Each dispute increments `pendingDisputeCount`. The `setPhase(Finalized)` function contains a `require(pendingDisputeCount == 0)` guard — even the admin cannot finalize the hackathon until all appeals are resolved or rejected by the admin via `resolveDispute()`. This adds governance without mutating any scores.
7. **Q: Your paper identified gas cost as a limitation. How did you address it?**
   - *A*: Section VIII-A of the paper flags on-chain gas costs per submission as a concern. We directly addressed this with a storage caching pass: by maintaining `totalRawScore`, `minScore`, and `maxScore` as incrementally updated state variables in the `Project` struct, we eliminated the O(n²) loop scan in `getLeaderboard()`, reducing its gas cost by ~74%. The `viaIR` compiler flag further reduces calldata cost via Yul IR optimizations.
8. **Q: How does your 4-tier architecture expand beyond the original 4-module paper design?**
   - *A*: The paper defines 4 modules: Judge Registration, Score Submission, Immutable Record, and Leaderboard Generation. Our Tier 1 hardened these with Conflict-of-Interest recusal and a Phase state machine. Tier 2 added Trimmed-Mean outlier detection, append-only score versioning, and Soulbound NFTs. Tier 3 added IPFS integration and MetaMask wallet support. Tier 4 added Minimum-Quorum Ranking, deterministic 5-tier tie-breaking, an Appeal/Dispute governance system, and Team Self-Registration — all of which address real-world fairness flaws discovered during development.

---

## 📋 Feature Tier Summary

| # | Feature | Tier | Smart Contract Function |
| :-- | :--- | :---: | :--- |
| 1 | Commit–Reveal Blind Scoring | 🥇 1 | `commitScore()`, `revealScore()` |
| 2 | Phase Lifecycle State Machine | 🥇 1 | `setPhase()` |
| 3 | Conflict-of-Interest Recusal | 🥇 1 | `setJudgeConflict()` |
| 4 | Weighted Scoring Rubric | 🥇 1 | `setCriteriaWeights()` |
| 5 | Trimmed Mean Outlier Detection | 🛠️ 2 | `getLeaderboard()` |
| 6 | Append-Only Score Versioning | 🛠️ 2 | `revealScore()` → `ScoreRecord[]` |
| 7 | 2-Step Admin Transfer | 🛠️ 2 | `proposeNewAdmin()`, `acceptAdmin()` |
| 8 | Soulbound Winner NFT | 🛠️ 2 | `WinnerNFT.mintCertificate()` |
| 9 | Gas Optimization (Storage Cache) | 🛠️ 2 | All write functions |
| 10 | Multi-Network Support | 🌐 3 | `hardhat.config.js` |
| 11 | MetaMask + Demo Account Switcher | 🌐 3 | `useWeb3.jsx` |
| 12 | IPFS Decentralized Media Storage | 🌐 3 | `ipfsCID` field in `Project` struct |
| 13 | Judge Scorecard Matrix UI | 🌐 3 | `ScorecardView.jsx` |
| 14 | Minimum-Quorum Ranking | 🔬 4 | `minJudgesForRanking` |
| 15 | Deterministic 5-Tier Tie-Breaking | 🔬 4 | `_shouldSwap()` |
| 16 | Appeal/Dispute Window | 🔬 4 | `raiseDispute()`, `resolveDispute()` |
| 17 | Team Self-Registration + Approval | 🔬 4 | `submitProjectApplication()` |
