# ChainJudge — Project Overview

> **A decentralised hackathon operating system built on Ethereum smart contracts, designed to eliminate judge bias, prevent score anchoring, and produce tamper-proof, publicly verifiable results.**

---

## Table of Contents

1. [The Problem](#the-problem)
2. [The Solution](#the-solution)
3. [Core Innovations](#core-innovations)
4. [Key Features](#key-features)
5. [Real-World Impact](#real-world-impact)
6. [Technology at a Glance](#technology-at-a-glance)
7. [Who Is It For?](#who-is-it-for)

---

## The Problem

Traditional hackathon judging suffers from **five well-documented systemic flaws**:

| # | Problem | Root Cause |
|---|---------|------------|
| 1 | **Score anchoring** | Judge #3 sees Judge #1's scores and unconsciously anchors to them |
| 2 | **Opaque results** | Organisers can quietly adjust scores after the event |
| 3 | **Conflict of interest** | A mentor scores their own team's project |
| 4 | **Outlier dominance** | One extraordinarily generous (or harsh) judge skews the average |
| 5 | **Disputed outcomes** | Participants have no official channel to challenge results |

These problems are not theoretical — they occur at every level, from college fests to funded accelerator demo days. The result is **participant frustration, reputational damage to organisers, and misallocated prizes**.

---

## The Solution

**ChainJudge** uses Ethereum smart contracts as the **single source of truth** for every scoring decision. No central database, no spreadsheet, no silent amendment. Every action is:

- **Recorded on-chain** as an immutable event log
- **Cryptographically secured** using commit-reveal hashing
- **Mathematically fair** using trimmed-mean outlier filtering
- **Governance-protected** via a multi-phase state machine and dispute resolution council

---

## Core Innovations

### 1. Commit–Reveal Blind Scoring (Zero Anchor Bias)
Judges commit a `keccak256(scores + salt)` hash in **Phase 1 (Judging)**. No score is visible until all judges reveal in **Phase 2 (Revealing)**. This directly eliminates anchoring — mathematically impossible to anchor to numbers you cannot see.

### 2. Trimmed Mean Outlier Filtering
The platform trims the top and bottom 15% of judge scores before computing the mean. A single biased judge cannot move the final ranking by more than their proportional weight.

```
trimmedMean = (Σ scores — max score — min score) / (n — 2)   [when n ≥ 3]
```

### 3. Conflict-of-Interest Recusal
Admin marks `judgeConflicts[judge][projectId] = true`. Any attempt by a recused judge to score that project is reverted on-chain — not just warned, but **cryptographically blocked**.

### 4. Minimum-Quorum Ranking Gate
Projects scored by fewer than `minJudgesForRanking` judges are automatically placed in a **"Provisional"** bucket rather than competing against fully evaluated projects. Prevents a single generous judge from winning a hackathon.

### 5. 5-Tier Deterministic Tie-Breaking
Ties are resolved by a pure cascade:
1. `quorumMet` status → 2. `trimmedScore` → 3. `averageScore` → 4. `judgeCount` → 5. `projectId`

This ensures fully reproducible, dispute-resistant rankings across all EVM nodes.

### 6. Dispute / Appeal Window
During the appeal window (before finalisation), any participant can call `raiseDispute()`. The admin cannot call `setPhase(Finalized)` while disputes are pending — a **hard on-chain guard**, not a policy promise.

### 7. Soulbound Winner NFTs
Winners receive a non-transferable ERC-721 certificate with an on-chain generated SVG proving their achievement. Soulbound = cannot be sold, traded, or disputed after issuance.

### 8. Team Self-Registration
Teams submit `submitProjectApplication()` with IPFS-hosted pitch decks. Admin approves or rejects on-chain, creating a transparent admission pipeline with an immutable audit trail.

---

## Key Features

- ✅ **Blind scoring** — commit-reveal cryptographic pattern
- ✅ **Trimmed mean** — outlier-resistant aggregate math
- ✅ **5-tier tie-breaker** — fully deterministic ranking
- ✅ **Quorum gate** — minimum judges required per project
- ✅ **Dispute resolution** — on-chain appeal window with admin council
- ✅ **Conflict-of-interest recusal** — cryptographically enforced
- ✅ **Team self-registration** — IPFS-backed application pipeline
- ✅ **2-step admin transfer** — prevents hostile governance takeovers
- ✅ **Soulbound NFT certificates** — non-transferable achievement proofs
- ✅ **MongoDB backend** — persistent off-chain data layer
- ✅ **Redis caching** — sub-2ms leaderboard response with in-memory fallback
- ✅ **JWT authentication** — secure email + Web3 wallet auth
- ✅ **Rate limiting** — Redis sliding-window spam protection

---

## Real-World Impact

| Stakeholder | Benefit |
|-------------|---------|
| **Participants** | Verifiable, tamper-proof scores; formal dispute channel |
| **Judges** | Blind evaluation removes social pressure; mathematical protection against outlier blame |
| **Organisers** | Automated scoring pipeline; immutable audit trail protects reputation |
| **Sponsors** | Transparent prize allocation; reduced legal exposure |
| **Academic institutions** | Publishable, reproducible methodology; Soulbound certificates |

---

## Technology at a Glance

```
Layer          Technology            Purpose
─────────────────────────────────────────────────────────
Blockchain     Ethereum / Hardhat    Immutable scoring logic & event logs
Smart Contract Solidity 0.8.24       HackathonJudging.sol + WinnerNFT.sol
Frontend       React + Vite          Judging workspace, leaderboard, admin panel
Backend        Node.js + Express     REST API, JWT auth, rate limiting
Database       MongoDB + Mongoose    Persistent user, application & dispute store
Cache          Redis (ioredis)       Leaderboard caching, session lookup, rate limits
Testing        Hardhat + Mocha       38 unit tests — 100% passing
```

---

## Who Is It For?

- **University hackathon committees** looking for bias-free judging
- **Accelerator programmes** awarding equity to winning teams
- **Corporate innovation challenges** where result legitimacy is contractually required
- **Open-source grant committees** distributing on-chain treasury funds
- **Any event** where the integrity of a competitive evaluation process matters
