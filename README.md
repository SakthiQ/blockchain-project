# ⛓️ ChainJudge: Advanced Blockchain-Based Hackathon Judging Platform

An undergraduate capstone blockchain project demonstrating decentralized, immutable, anti-collusion hackathon judging powered by EVM smart contracts, Commit–Reveal blind scoring, and Soulbound Winner NFT certificates.

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

| Operation | Before Optimization | After Storage Caching | Gas Saved |
| :--- | :--- | :--- | :--- |
| `getProjectAggregateScore()` | ~45,200 gas (Loop scan) | ~12,400 gas (Cached state) | **~72.5%** |
| `getLeaderboard()` (4 Projects) | ~185,000 gas | ~48,000 gas | **~74.0%** |
| `revealScore()` | N/A | ~68,200 gas | Optimized storage writes |

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
