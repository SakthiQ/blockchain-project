# ChainJudge — Workflow Diagrams

> **High-level and low-level workflow diagrams covering every user journey, data pipeline, and system interaction in the ChainJudge platform.**

---

## Table of Contents

1. [High-Level System Workflow](#1-high-level-system-workflow)
2. [High-Level User Journey Map](#2-high-level-user-journey-map)
3. [High-Level Hackathon Lifecycle](#3-high-level-hackathon-lifecycle)
4. [Low-Level: Team Registration Pipeline](#4-low-level-team-registration-pipeline)
5. [Low-Level: Commit–Reveal Blind Scoring](#5-low-level-commitreveal-blind-scoring)
6. [Low-Level: Leaderboard Computation & Caching](#6-low-level-leaderboard-computation--caching)
7. [Low-Level: User Authentication Flow](#7-low-level-user-authentication-flow)
8. [Low-Level: Dispute & Appeal Resolution](#8-low-level-dispute--appeal-resolution)
9. [Low-Level: Phase State Machine Transitions](#9-low-level-phase-state-machine-transitions)
10. [Low-Level: Winner NFT Minting](#10-low-level-winner-nft-minting)
11. [Low-Level: Redis Cache Decision Tree](#11-low-level-redis-cache-decision-tree)

---

## 1. High-Level System Workflow

The 10,000-foot view — how the three user roles interact with the three system layers.

```mermaid
flowchart TB
    subgraph USERS["👥 User Roles"]
        TEAM["🧑‍💻 Team / Participant"]
        JUDGE["⚖️ Judge"]
        ADMIN["🛡️ Admin / Organiser"]
    end

    subgraph FRONTEND["🖥️ Frontend — React + Vite (Port 5173)"]
        AUTH_UI["Auth Modal\nSign Up / Log In"]
        PROJ_UI["Projects View\nApply & Browse"]
        JUDGE_UI["Judge Workspace\nCommit → Reveal"]
        LEADER_UI["Leaderboard View\nRankings & NFTs"]
        ADMIN_UI["Admin Console\nPhase & Governance"]
    end

    subgraph BACKEND["🔌 Backend — Node.js + Express (Port 5000)"]
        AUTH_API["POST /api/auth/signup\nPOST /api/auth/login"]
        APP_API["GET/POST /api/applications"]
        DISPUTE_API["GET/POST /api/disputes"]
        LB_API["GET /api/leaderboard\n(Redis-cached)"]
        HEALTH_API["GET /api/health"]
    end

    subgraph CHAIN["⛓️ Blockchain — Ethereum / Hardhat (Port 8545)"]
        CONTRACT["HackathonJudging.sol\nPhase State Machine\nScoring Logic\nLeaderboard Math"]
        NFT_CONTRACT["WinnerNFT.sol\nSoulbound ERC-721\nOn-chain SVG"]
    end

    subgraph STORAGE["💾 Data Layer"]
        MONGO[("🍃 MongoDB\nchainjudge DB")]
        REDIS[("⚡ Redis\nCache + Rate Limit")]
    end

    TEAM --> AUTH_UI & PROJ_UI & LEADER_UI
    JUDGE --> AUTH_UI & JUDGE_UI & LEADER_UI
    ADMIN --> AUTH_UI & ADMIN_UI & LEADER_UI

    AUTH_UI --> AUTH_API --> MONGO
    PROJ_UI --> APP_API --> MONGO
    PROJ_UI --> CONTRACT
    JUDGE_UI --> CONTRACT
    LEADER_UI --> LB_API --> REDIS
    ADMIN_UI --> CONTRACT & DISPUTE_API
    DISPUTE_API --> MONGO

    CONTRACT --> NFT_CONTRACT
    LB_API -.->|Cache MISS| CONTRACT
    AUTH_API --> REDIS
```

---

## 2. High-Level User Journey Map

Each role's end-to-end journey from first visit to final result.

```mermaid
journey
    title ChainJudge — User Journey by Role

    section Team / Participant
      Visit platform & create account: 5: Team
      Browse registered projects: 4: Team
      Submit project application (IPFS pitch deck): 5: Team
      Wait for admin approval: 3: Team
      View leaderboard results: 5: Team
      Raise dispute if score seems unfair: 3: Team
      Receive Soulbound NFT if winner: 5: Team

    section Judge
      Create account & connect wallet: 5: Judge
      Review assigned projects: 4: Judge
      Commit blind score hash (Phase 1): 5: Judge
      Reveal scores + salt (Phase 2): 5: Judge
      View final ranked leaderboard: 5: Judge

    section Admin / Organiser
      Deploy smart contract & configure: 4: Admin
      Register judges & set conflicts: 5: Admin
      Approve or reject team applications: 4: Admin
      Advance hackathon through phases: 5: Admin
      Resolve pending disputes: 4: Admin
      Finalise hackathon & mint NFTs: 5: Admin
```

---

## 3. High-Level Hackathon Lifecycle

The four phases every hackathon goes through, with the key actions in each.

```mermaid
flowchart LR
    P0["🔧 Phase 0\nSETUP"]
    P1["⚖️ Phase 1\nJUDGING"]
    P2["👁️ Phase 2\nREVEALING"]
    P3["🏆 Phase 3\nFINALIZED"]

    P0 -->|"Admin: setPhase(1)"| P1
    P1 -->|"Admin: setPhase(2)"| P2
    P2 -->|"Admin: setPhase(3)\n[requires pendingDisputeCount == 0]"| P3

    subgraph A0["Setup Actions"]
        direction TB
        A01["Teams submit applications"]
        A02["Admin approves / rejects"]
        A03["Admin registers judges"]
        A04["Admin marks conflict-of-interest recusals"]
        A05["Admin configures rubric weights"]
        A01 --> A02 --> A03 --> A04 --> A05
    end

    subgraph A1["Judging Actions"]
        direction TB
        A11["Judges call commitScore(projectId, keccak256(scores+salt))"]
        A12["Hashes stored on-chain — scores invisible"]
        A13["block.timestamp checked against judgingDeadline"]
        A14["Participants can raise disputes"]
        A11 --> A12 --> A13 --> A14
    end

    subgraph A2["Revealing Actions"]
        direction TB
        A21["Judges call revealScore(projectId, scores, salt)"]
        A22["Contract verifies hash match"]
        A23["Weighted scores recorded on-chain"]
        A24["Admin resolves all pending disputes"]
        A25["Leaderboard computable in real-time"]
        A21 --> A22 --> A23 --> A24 --> A25
    end

    subgraph A3["Finalized Actions"]
        direction TB
        A31["Rankings permanently locked"]
        A32["Admin mints Soulbound NFTs for winners"]
        A33["Full audit trail publicly accessible"]
        A31 --> A32 --> A33
    end

    P0 --- A0
    P1 --- A1
    P2 --- A2
    P3 --- A3

    style P0 fill:#334155,stroke:#64748b,color:#f8fafc
    style P1 fill:#312e81,stroke:#6366f1,color:#f8fafc
    style P2 fill:#1e3a5f,stroke:#0ea5e9,color:#f8fafc
    style P3 fill:#14532d,stroke:#10b981,color:#f8fafc
```

---

## 4. Low-Level: Team Registration Pipeline

The detailed flow from a team submitting an application to their project appearing in the competition.

```mermaid
sequenceDiagram
    participant TEAM as 🧑‍💻 Team Wallet
    participant UI as React Frontend
    participant API as Express API
    participant MONGO as MongoDB
    participant EVM as HackathonJudging.sol

    TEAM->>UI: Fill application form\n(name, description, IPFS CID)

    UI->>API: POST /api/applications\n{name, teamLead, ipfsCID, applicantWallet}
    API->>MONGO: Insert ProjectApplication\n{status: "Pending"}
    MONGO-->>API: {applicationId: 1, status: "Pending"}
    API-->>UI: 201 Created

    UI->>EVM: submitProjectApplication(name, description, ipfsCID)
    Note over EVM: require(currentPhase == Phase.Setup)
    EVM-->>UI: ApplicationSubmitted event\n{appId: 1, applicant: 0x...}

    Note over TEAM,EVM: ── Admin Review ──

    participant ADMIN as 🛡️ Admin Wallet

    ADMIN->>UI: Opens Admin Console\nSees pending application

    ADMIN->>EVM: approveProjectApplication(appId)
    Note over EVM: require(status == Pending)\n_registerProject() called internally\nprojectCount++
    EVM-->>UI: ApplicationApproved event\n{appId: 1, projectId: 3}

    ADMIN->>API: PUT /api/applications/1/status\n{status: "Approved", registeredProjectId: 3}
    API->>MONGO: Update status → "Approved"\nregisteredProjectId = 3
    MONGO-->>API: OK
    API-->>UI: 200 Updated

    UI-->>ADMIN: ✅ Project #3 now live in competition
```

---

## 5. Low-Level: Commit–Reveal Blind Scoring

The two-phase cryptographic scoring process — the core privacy mechanism.

```mermaid
sequenceDiagram
    participant J1 as ⚖️ Judge 1
    participant J2 as ⚖️ Judge 2
    participant UI as React Frontend
    participant EVM as HackathonJudging.sol
    participant REDIS as Redis Cache

    rect rgb(30, 41, 59)
    Note over J1,REDIS: ━━━━━ PHASE 1 — JUDGING (Commit) ━━━━━

    J1->>UI: Open Judge Workspace\nSet scores [8,7,9,8] and generate random salt

    Note over UI: Client-side hash computation:\nhash = keccak256(abi.encode(8,7,9,8, salt))

    UI->>EVM: commitScore(projectId=1, hash=0x3f4a...)
    Note over EVM: ✅ require(Phase == Judging)\n✅ require(isAuthorizedJudge)\n✅ require(!judgeConflicts[judge][project])\n✅ require(!hasCommitted[judge][project])\n✅ require(block.timestamp < judgingDeadline)\nStores: commitHash[J1][1] = 0x3f4a...\nhasCommitted[J1][1] = true
    EVM-->>UI: ScoreCommitted event emitted

    J2->>UI: Open Judge Workspace\nSet scores [9,9,8,9] and generate random salt
    UI->>EVM: commitScore(projectId=1, hash=0x7b2c...)
    EVM-->>UI: ScoreCommitted event emitted

    Note over EVM: ⚠️ Scores 100% invisible on-chain\nOnly hashes are stored
    end

    Note over J1,REDIS: ── Admin advances to Phase 2 ──

    rect rgb(14, 30, 58)
    Note over J1,REDIS: ━━━━━ PHASE 2 — REVEALING ━━━━━

    J1->>UI: Click "Reveal Scores"\nRetrieve saved [8,7,9,8] + salt

    UI->>EVM: revealScore(projectId=1, 8, 7, 9, 8, salt)
    Note over EVM: Compute: keccak256(abi.encode(8,7,9,8,salt))\nCompare with stored commitHash[J1][1]\n✅ Hash matches!\nweightedScore = (8×25 + 7×25 + 9×25 + 8×25) / 10 = 80\nprojectScores[1].push(80)\nhasRevealed[J1][1] = true
    EVM-->>UI: ScoreRevealed(J1, projectId=1, score=80)

    J2->>UI: Click "Reveal Scores"
    UI->>EVM: revealScore(projectId=1, 9, 9, 8, 9, salt)
    Note over EVM: weightedScore = (9×25 + 9×25 + 8×25 + 9×25)/10 = 87.5 → 87
    EVM-->>UI: ScoreRevealed(J2, projectId=1, score=87)

    UI->>REDIS: POST /api/leaderboard/invalidate
    REDIS-->>UI: Cache cleared ✅
    Note over REDIS: Next leaderboard request\nwill recompute from chain
    end
```

---

## 6. Low-Level: Leaderboard Computation & Caching

How the leaderboard goes from raw on-chain scores to a cached API response in under 2ms.

```mermaid
flowchart TD
    START(["User opens Leaderboard View"])

    START --> REQ["GET /api/leaderboard"]

    REQ --> CACHE_CHECK{"Redis:\nGET leaderboard:current"}

    CACHE_CHECK -->|"Key exists (HIT)"| HIT["Return cached JSON\nX-Cache: HIT\n⚡ ~2ms response"]
    CACHE_CHECK -->|"Key missing (MISS)"| MISS["X-Cache: MISS\nQuery EVM chain"]

    MISS --> RPC["ethers.js:\ncontract.getLeaderboard()"]

    RPC --> GATHER["For each project:\n1. Collect projectScores array\n2. Collect projectJudges array"]

    GATHER --> TRIM["Compute Trimmed Mean:\n• Sort scores ascending\n• Remove min + max\n• Average remaining"]

    TRIM --> QUORUM{"judgeCount >=\nminJudgesForRanking?"}
    QUORUM -->|Yes| RANKED["quorumMet = true\nFull ranking entry"]
    QUORUM -->|No| PROV["quorumMet = false\nProvisional entry"]

    RANKED --> SORT
    PROV --> SORT

    SORT["Bubble Sort with _shouldSwap(a, b):\nTier 1: quorumMet desc\nTier 2: trimmedScore desc\nTier 3: averageScore desc\nTier 4: judgeCount desc\nTier 5: projectId asc"]

    SORT --> CACHE_SET["Redis SET leaderboard:current\nJSON result EX 30"]
    CACHE_SET --> RETURN["Return sorted LeaderboardEntry[]\n~800ms first load"]

    HIT --> UI_RENDER
    RETURN --> UI_RENDER

    UI_RENDER["Frontend renders:\n🥇 1st — ProjectA (trimmed: 91)\n🥈 2nd — ProjectB (trimmed: 87)\n🥉 3rd — ProjectC (trimmed: 84)\n─────────────────\n⚠️ Provisional (below quorum)\n📋 ProjectD (1 judge)"]

    INVALIDATE["On ScoreRevealed event:\nPOST /api/leaderboard/invalidate\nRedis DEL leaderboard:current"]
    INVALIDATE -.->|"Next request = fresh MISS"| CACHE_CHECK

    style HIT fill:#14532d,color:#f0fdf4
    style MISS fill:#7c2d12,color:#fff7ed
    style RANKED fill:#1e3a5f,color:#f0f9ff
    style PROV fill:#422006,color:#fffbeb
```

---

## 7. Low-Level: User Authentication Flow

Both Email/Password and Web3 Wallet authentication paths.

```mermaid
flowchart TD
    START(["User clicks 'Sign In'"])
    START --> CHOICE{"Auth method?"}

    subgraph EMAIL_FLOW["📧 Email / Password Path"]
        direction TB
        E1["Enter name, email, password, role"]
        E2["POST /api/auth/signup OR /login"]
        E3["bcryptjs.compare(password, storedHash)\nOR bcryptjs.hash(password, 10)"]
        E4{"Credentials\nvalid?"}
        E5["jwt.sign({id, role, email}, SECRET, {expiresIn: '7d'})"]
        E6["Redis SET session:<token> userData EX 604800"]
        E7["Return {token, user} to frontend"]
        E8["connectLocalAccount(roleIndex)\nethers.js Wallet connected"]
        E9["localStorage: chainjudge_auth_session"]
        E4_FAIL["401: Invalid credentials"]

        E1 --> E2 --> E3 --> E4
        E4 -->|Valid| E5 --> E6 --> E7 --> E8 --> E9
        E4 -->|Invalid| E4_FAIL
    end

    subgraph WEB3_FLOW["🦊 Web3 Wallet Path"]
        direction TB
        W1["Click 'Connect MetaMask'"]
        W2["window.ethereum.request\n(eth_requestAccounts)"]
        W3{"User approves\nin MetaMask?"}
        W4["ethers.BrowserProvider\n→ getSigner() → getAddress()"]
        W5["detectRole():\ncontract.admin() == address?\n→ 'admin'\ncontract.isAuthorizedJudge()?\n→ 'judge'\nelse → 'participant'"]
        W6["Save profile to localStorage\nchainjudge_user_profiles[address]"]
        W7["toast: Wallet Connected ✅"]
        W3_FAIL["toast: Connection rejected ❌"]

        W1 --> W2 --> W3
        W3 -->|Approved| W4 --> W5 --> W6 --> W7
        W3 -->|Rejected| W3_FAIL
    end

    CHOICE -->|Email| E1
    CHOICE -->|Web3| W1

    E9 --> DONE
    W7 --> DONE

    DONE(["✅ User authenticated\nUI updates: username, role badge, avatar"])

    style E4_FAIL fill:#7c2d12,color:#fff
    style W3_FAIL fill:#7c2d12,color:#fff
    style DONE fill:#14532d,color:#f0fdf4
```

---

## 8. Low-Level: Dispute & Appeal Resolution

End-to-end flow from a participant raising a dispute to admin resolution.

```mermaid
sequenceDiagram
    participant PART as 🧑‍💻 Participant
    participant UI as React Frontend
    participant API as Express API
    participant MONGO as MongoDB
    participant EVM as HackathonJudging.sol
    participant ADMIN as 🛡️ Admin

    Note over PART,ADMIN: ─── Raising a Dispute ───

    PART->>UI: Click "Raise Dispute" on project card
    UI->>UI: Open Dispute Modal\nParticipant enters reason text

    UI->>EVM: raiseDispute(projectId, reason)
    Note over EVM: require(Phase == Judging OR Revealing)\ndisputeCount++\npendingDisputeCount++\nStores Dispute{id, projectId, raisedBy, reason, Pending}\nEmits DisputeRaised event

    EVM-->>UI: DisputeRaised(disputeId=1, projectId=2)

    UI->>API: POST /api/disputes\n{projectId: 2, raisedBy: "0x...", reason: "..."}
    API->>MONGO: Insert Dispute document
    MONGO-->>API: {disputeId: 1, status: "Pending"}
    API-->>UI: 201 Created

    UI-->>PART: ✅ Dispute #1 filed successfully

    Note over PART,ADMIN: ─── Admin Resolution ───

    ADMIN->>UI: Open Admin Console\nDisputes Tab shows 1 pending

    ADMIN->>UI: Review dispute reason & evidence
    ADMIN->>UI: Click "Resolve" or "Reject"

    UI->>EVM: resolveDispute(disputeId=1, Resolved)
    Note over EVM: require(status == Pending)\ndisputes[1].status = Resolved\npendingDisputeCount--\nEmits DisputeResolved event

    Note over EVM: ⚠️ If pendingDisputeCount was the\nlast remaining dispute,\nsetPhase(Finalized) now unblocked

    UI->>API: PUT /api/disputes/1/status\n{status: "Resolved"}
    API->>MONGO: Update status → "Resolved"
    MONGO-->>API: OK
    API-->>UI: 200 Updated

    UI-->>ADMIN: ✅ All disputes resolved\nPhase → Finalized now available
```

---

## 9. Low-Level: Phase State Machine Transitions

Detailed guards and side-effects of each phase transition.

```mermaid
stateDiagram-v2
    [*] --> Setup: Contract constructor()

    Setup --> Judging: setPhase(1)
    note right of Setup
        PERMITTED IN SETUP:
        ✅ registerProject()
        ✅ registerJudge()
        ✅ setJudgeConflict()
        ✅ setCriteriaWeights()
        ✅ submitProjectApplication()
        ✅ approveProjectApplication()
        ✅ rejectProjectApplication()
        ✅ setMinJudgesForRanking()
        ✅ setJudgingDeadline()
        ❌ commitScore()
        ❌ revealScore()
        ❌ mintWinnerNFT()
    end note

    Judging --> Revealing: setPhase(2)
    note right of Judging
        PERMITTED IN JUDGING:
        ✅ commitScore()    [deadline gate]
        ✅ raiseDispute()
        ❌ revealScore()
        ❌ mintWinnerNFT()

        GUARDS ON commitScore:
        • isAuthorizedJudge[caller]
        • !judgeConflicts[caller][project]
        • !hasCommitted[caller][project]
        • block.timestamp < judgingDeadline
    end note

    Revealing --> Finalized: setPhase(3)\n[GUARD: pendingDisputeCount == 0]
    note right of Revealing
        PERMITTED IN REVEALING:
        ✅ revealScore()
        ✅ raiseDispute()
        ✅ resolveDispute()
        ❌ commitScore()
        ❌ mintWinnerNFT()

        GUARDS ON revealScore:
        • hasCommitted[caller][project]
        • !hasRevealed[caller][project]
        • keccak256(scores, salt) == commitHash
    end note

    note left of Finalized
        PERMITTED IN FINALIZED:
        ✅ mintWinnerNFT()
        ✅ getLeaderboard() [view]
        ✅ proposeAdminTransfer()
        ❌ Everything else

        IMMUTABLE STATE:
        All scores permanently locked.
        No phase reversal possible.
    end note
```

---

## 10. Low-Level: Winner NFT Minting

How the Soulbound certificate is generated and bound to a wallet.

```mermaid
flowchart TD
    START(["Admin clicks 'Mint NFT'\nfor 1st place winner"])

    START --> CHECK1{"currentPhase\n== Finalized?"}
    CHECK1 -->|No| ERR1["❌ Revert: Wrong phase"]
    CHECK1 -->|Yes| CHECK2{"caller\n== admin?"}
    CHECK2 -->|No| ERR2["❌ Revert: Not admin"]
    CHECK2 -->|Yes| MINT_CALL

    MINT_CALL["WinnerNFT.mintWinner(\n  winnerAddress,\n  projectId,\n  rank=1\n)"]

    MINT_CALL --> TOKEN_ID["tokenId = ++_tokenCounter"]
    TOKEN_ID --> STORE["Store TokenInfo:\n{projectId, projectName, rank, hackathonName}"]

    STORE --> ERC721_MINT["ERC721._safeMint(winnerAddress, tokenId)"]

    ERC721_MINT --> UPDATE["_update() called internally:\nfrom = _ownerOf(tokenId) = address(0)\n✅ Minting allowed (from == 0)"]

    UPDATE --> LOCK_EVENT["emit Locked(tokenId)\n[EIP-5192 Soulbound signal]"]

    LOCK_EVENT --> TOKEN_URI["tokenURI(tokenId) called by wallets"]

    TOKEN_URI --> SVG_GEN["Generate on-chain SVG:\n<svg>...<text>1st Place</text>...\n<text>ProjectName</text>...</svg>"]

    SVG_GEN --> BASE64_SVG["Base64.encode(svgBytes)"]

    BASE64_SVG --> JSON_META["Build metadata JSON:\n{name, description, image: data:image/svg+xml;base64,...}"]

    JSON_META --> BASE64_JSON["Base64.encode(jsonBytes)"]

    BASE64_JSON --> FINAL_URI["Return:\ndata:application/json;base64,<encoded>"]

    FINAL_URI --> WALLET["🏆 NFT appears in winner's wallet\nWith rendered SVG certificate\nNo IPFS, no external server needed"]

    TRANSFER_ATTEMPT(["Someone tries: safeTransferFrom()"])
    TRANSFER_ATTEMPT --> BLOCK_UPDATE["_update() called:\nfrom = _ownerOf(tokenId) ≠ address(0)"]
    BLOCK_UPDATE --> REVERT["❌ Revert:\n'WinnerNFT: Soulbound — non-transferable'"]

    style ERR1 fill:#7c2d12,color:#fff
    style ERR2 fill:#7c2d12,color:#fff
    style REVERT fill:#7c2d12,color:#fff
    style WALLET fill:#14532d,color:#f0fdf4
```

---

## 11. Low-Level: Redis Cache Decision Tree

The complete decision logic for every cache operation in `cacheService.js`.

```mermaid
flowchart TD
    REQ(["Incoming API Request"])

    REQ --> IS_READY{"cacheService.isReady()\nRedis connected?"}

    IS_READY -->|Yes — Redis Active| REDIS_PATH["Use Redis Client (ioredis)"]
    IS_READY -->|No — Offline| MEM_PATH["Use In-Memory Map fallback"]

    subgraph REDIS_OPS["Redis Operations"]
        direction TB
        R_GET["GET: redisClient.get(key)\nJSON.parse(result)"]
        R_SET["SET: redisClient.set(key, JSON.stringify(value), 'EX', ttl)"]
        R_DEL["DEL: redisClient.del(key)"]
        R_FLUSH["KEYS pattern* → DEL all matching"]
        R_ERR{"Redis error?"}
        R_ERR -->|Yes| MEM_PATH
        R_ERR -->|No| RESULT
    end

    subgraph MEM_OPS["In-Memory Map Operations"]
        direction TB
        M_GET["GET: inMemoryCache.get(key)\nCheck expiry timestamp"]
        M_EXPIRED{"item.expiry\n< Date.now()?"}
        M_EXPIRED -->|Yes| M_DELETE["Delete stale entry\nReturn null"]
        M_EXPIRED -->|No| M_RETURN["Return item.data"]
        M_SET["SET: inMemoryCache.set(key,\n{data: value, expiry: now + ttl*1000})"]
        M_DEL["DEL: inMemoryCache.delete(key)"]
    end

    REDIS_PATH --> REDIS_OPS
    REDIS_PATH --> R_ERR
    MEM_PATH --> MEM_OPS

    RESULT(["Return cached value\nor null on miss"])
    M_RETURN --> RESULT
    M_DELETE --> RESULT

    subgraph TTL_TABLE["TTL Reference Table"]
        direction TB
        T1["leaderboard:current → 30 seconds"]
        T2["ratelimit:<path>:<ip> → 60 seconds"]
        T3["session:<token> → 604800 seconds (7 days)"]
        T4["events:latest → 120 seconds"]
        T5["ipfs:<cid> → 3600 seconds (1 hour)"]
    end

    RESULT -.->|"Choose TTL based on key type"| TTL_TABLE

    style REDIS_PATH fill:#1e3a5f,color:#f0f9ff
    style MEM_PATH fill:#422006,color:#fffbeb
    style RESULT fill:#14532d,color:#f0fdf4
```

---

## Summary

| Diagram | Type | Covers |
|---------|------|--------|
| [1. System Workflow](#1-high-level-system-workflow) | High-Level | All 3 layers, 3 user roles, data flow |
| [2. User Journey Map](#2-high-level-user-journey-map) | High-Level | Step-by-step experience per role |
| [3. Hackathon Lifecycle](#3-high-level-hackathon-lifecycle) | High-Level | 4 phases, permitted actions per phase |
| [4. Team Registration](#4-low-level-team-registration-pipeline) | Low-Level | Sequence: UI → API → MongoDB → EVM |
| [5. Commit–Reveal Scoring](#5-low-level-commitreveal-blind-scoring) | Low-Level | Cryptographic two-phase scoring |
| [6. Leaderboard Caching](#6-low-level-leaderboard-computation--caching) | Low-Level | Redis HIT/MISS, trimmed mean sort |
| [7. Authentication](#7-low-level-user-authentication-flow) | Low-Level | Email + Web3 dual auth paths |
| [8. Dispute Resolution](#8-low-level-dispute--appeal-resolution) | Low-Level | Full dispute lifecycle sequence |
| [9. Phase State Machine](#9-low-level-phase-state-machine-transitions) | Low-Level | Guards, reverts, permitted ops |
| [10. NFT Minting](#10-low-level-winner-nft-minting) | Low-Level | Soulbound mint + on-chain SVG |
| [11. Redis Decision Tree](#11-low-level-redis-cache-decision-tree) | Low-Level | Cache get/set/del + fallback logic |
