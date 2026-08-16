# ChainJudge — Viva & Interview Preparation

> **15+ comprehensive technical questions and model answers for academic project defence, technical interviews, and hackathon pitch evaluations.**

---

## Table of Contents

1. [Core Blockchain Concepts](#core-blockchain-concepts)
2. [Smart Contract Design](#smart-contract-design)
3. [Cryptography & Security](#cryptography--security)
4. [Mathematical Fairness](#mathematical-fairness)
5. [Database & Caching](#database--caching)
6. [Frontend & System Integration](#frontend--system-integration)
7. [Design Trade-offs & Limitations](#design-trade-offs--limitations)

---

## Core Blockchain Concepts

---

### Q1. Why did you build this on a blockchain instead of a traditional centralised database?

**Model Answer:**

A centralised database gives the database administrator — or whoever controls the server — the ability to silently modify any record at any time. In a hackathon context, that means an organiser could adjust scores after seeing the results, with no way for participants to detect or prove the manipulation.

A public blockchain like Ethereum solves this through **immutability and transparency**. Once a transaction is mined into a block, it cannot be altered without re-mining every subsequent block — which is computationally infeasible on a proof-of-stake network like Ethereum. Every score submission, every phase change, every dispute is permanently on the chain, with a timestamp and a cryptographic signature proving who sent it.

The key properties we gain:
- **Immutability**: Past scores cannot be changed
- **Transparency**: Anyone can audit the full scoring history
- **Trustlessness**: Participants don't need to trust the organiser — they can verify the results themselves
- **Censorship resistance**: The organiser cannot selectively hide a score

---

### Q2. Is a public blockchain really appropriate here? Aren't all transactions visible?

**Model Answer:**

This is exactly the right question, and it's the reason we implemented **commit-reveal blind scoring**.

A naive implementation would have judges submit their scores directly in plain text to the blockchain. Since all EVM transactions are publicly visible in the mempool, Judge #3 could watch Judge #1's transaction, see the scores, and anchor to them — defeating the entire purpose.

Commit-reveal solves this in two phases:
- **Phase 1 (Commit)**: The judge submits only a cryptographic hash — `keccak256(scores + salt)`. The hash reveals nothing about the actual scores.
- **Phase 2 (Reveal)**: After all judges have committed, the revealing phase opens. Judges submit the actual scores and salt. The contract verifies that `keccak256(submitted_scores + submitted_salt) == stored_hash`.

Between commit and reveal, no score is publicly readable. After reveal, all scores are permanently public — which is exactly what you want for a transparent result.

The salt prevents a brute-force attack: even if someone knows the score range is 0–10 across 4 criteria, they cannot pre-compute all possible hashes because the salt is a random 32-byte value.

---

### Q3. What happens if a judge commits a score but then refuses to reveal it?

**Model Answer:**

This is a known weakness of the commit-reveal pattern — the **"withhold attack"**.

In our current implementation, if a judge commits but doesn't reveal, their score simply doesn't contribute to the project's aggregate. The project is not penalised — it's as if that judge abstained.

Mitigations we could add (and worth mentioning for viva credit):
1. **Judge deposit / stake**: Require judges to deposit ETH at registration. Non-reveal loses the deposit.
2. **Reveal deadline**: `block.timestamp < revealDeadline` — after the deadline, unrevealed commits are automatically discarded.
3. **Minimum reveal threshold**: Require a minimum fraction of judges to have revealed before phase transition.

The trade-off is complexity vs. fairness. For an academic prototype, we accept the limitation and note it explicitly.

---

### Q4. How does your smart contract prevent the organiser from changing the winner after the fact?

**Model Answer:**

Three separate mechanisms make post-result manipulation impossible:

**1. Immutable score storage**: Once `revealScore()` is called and the transaction is mined, the scores are stored on-chain in `projectScores[projectId]`. There is no `editScore()` function — the ABI simply doesn't have one.

**2. Deterministic leaderboard computation**: `getLeaderboard()` is a `view` function that computes rankings directly from on-chain state every time it's called. There's no stored "rankings" array that an admin could modify. The leaderboard is always derived from raw scores.

**3. Phase lock**: Once `setPhase(Finalized)` is called, the state machine prevents transitioning back. There's no `setPhase(Judging)` from `Finalized`. The code enforces this because `newPhase` must equal `currentPhase + 1`, and `Finalized` is the maximum enum value.

A participant can verify the result by calling `getLeaderboard()` directly on the contract — using any Ethereum node — without going through our frontend at all. This is the gold standard of trustlessness.

---

## Smart Contract Design

---

### Q5. Explain the 4-phase state machine. Why use an enum instead of a bool?

**Model Answer:**

The original design used `bool hackathonActive`. This created a binary distinction — active or inactive — but couldn't express the finer-grained lifecycle we needed.

The problem: with a boolean, what prevents a judge from submitting scores before the judging phase opens? What prevents the admin from revealing scores before all judges have committed? Nothing, unless you add separate booleans for each capability — which becomes unmaintainable.

`enum Phase { Setup, Judging, Revealing, Finalized }` solves this cleanly. Each function checks `require(currentPhase == Phase.X)`. The phase is a single authoritative source of truth for what operations are currently permitted.

The enum also enables **forward-only transitions**. In `setPhase()`, we require `newPhase == currentPhase + 1`. This means you cannot skip phases (go from Setup to Finalized directly) and you cannot reverse phases (go from Judging back to Setup). The organiser cannot re-open judging to accept more scores after the reveal phase has started.

Solidity enums are stored as `uint8` — very gas-efficient.

---

### Q6. Walk me through the trimmed mean calculation. Why not use a simple average?

**Model Answer:**

A simple average is vulnerable to **outlier judges**. If five judges score a project [8, 8, 8, 8, 10], the outlier judge pulling a 10 increases the average from 8.0 to 8.4 — a meaningful shift.

The trimmed mean addresses this:
1. Sort all scores ascending
2. Remove the lowest score and the highest score
3. Average the remaining scores

For [8, 8, 8, 8, 10] sorted → [8, 8, 8, 8, 10]:
- Remove 8 (lowest) and 10 (highest)
- Mean of [8, 8, 8] = **8.0**

The outlier judge's 10 no longer affects the result.

**Edge cases we handle:**
- `n == 0`: Return 0 (no scores submitted)
- `n == 1` or `n == 2`: Not enough judges to trim — use simple average instead
- `n >= 3`: Full trimmed mean applies

**Percentage trim**: We trim 1 score from each end regardless of total count. For large judge panels, this could be extended to trim `floor(n * 0.15)` from each end (15% trim), making it more statistically robust.

**Fixed-point arithmetic**: Solidity has no floating-point. All scores are `uint256`. The weighted score is computed as `(score × weight) / 10`, where division is integer division. This introduces up to a 0.1% rounding error — acceptable for a judging context.

---

### Q7. Explain the 5-tier tie-breaking algorithm. Why do you need it?

**Model Answer:**

The original bubble sort implementation had **undefined behaviour on ties**. If two projects had the same trimmed mean, their relative order depended on whichever appeared first in the projects array — which is essentially arbitrary (insertion order). In a judging dispute, "we ranked you third because you were project ID 3 and they were project ID 1 in our array" is indefensible.

The 5-tier cascade in `_shouldSwap(a, b)` makes the tiebreaker **fully deterministic and mathematically justified**:

**Tier 1 — Quorum status**: A project evaluated by the minimum required number of judges always outranks a provisional project. A score from 5 judges is more credible than a score from 1 judge.

**Tier 2 — Trimmed score**: Higher trimmed mean wins. Primary ranking criterion.

**Tier 3 — Average score**: If trimmed means are equal (can happen due to integer division truncation), the simple average may still differ.

**Tier 4 — Judge count**: More judges = more statistical confidence. A project scored by 5 judges outranks one scored by 2 judges with equal trimmed means.

**Tier 5 — Project ID**: Lowest project ID wins as the final tiebreaker. Lower project ID = earlier submission — a small advantage for teams that submitted early. This is arbitrary but **deterministic** — every EVM node produces the same result.

The result is that every possible comparison between two projects has a unique, reproducible ordering. Disputes about ties are mathematically unambiguous.

---

## Cryptography & Security

---

### Q8. Can a judge change their score after committing but before revealing?

**Model Answer:**

No. This is the core security guarantee of the commit-reveal scheme.

When a judge commits, they store `commitHash[judge][projectId] = keccak256(scores + salt)`. The `hasCommitted[judge][projectId]` flag is set to `true`. The `commitScore()` function checks this flag and reverts if `hasCommitted` is already `true` — so a second commit call is rejected.

During reveal, the contract computes `keccak256(submittedScores + submittedSalt)` and checks `== commitHash[judge][projectId]`. If the judge tries to reveal different scores, the hashes won't match and the transaction reverts with `"Hash mismatch"`.

The only way to change a committed score is to:
1. Find a hash collision in keccak256 — computationally infeasible (2^256 security)
2. Control enough EVM validators to rewrite the blockchain — infeasible on Ethereum mainnet

**Important caveat**: The commit must be submitted **before** the judge knows other judges' scores. If judges can observe other commits and then choose their salt/scores accordingly, the system still has an information leak. Our implementation mitigates this because commits contain only hashes (no score information), and the score values are only revealed after the reveal phase opens for everyone simultaneously.

---

### Q9. How does the conflict-of-interest recusal system work? How is it enforced?

**Model Answer:**

The recusal system operates at two levels:

**On-chain enforcement** (cannot be bypassed):
```solidity
mapping(address => mapping(uint256 => bool)) public judgeConflicts;

// In commitScore():
require(!judgeConflicts[msg.sender][projectId], "Recused");
```

When the admin calls `setJudgeConflict(judgeAddress, projectId, true)`, the mapping is set to `true`. Every subsequent call to `commitScore()` for that project from that judge's wallet will revert — **at the EVM level**, not the UI level.

This means the judge cannot use a different frontend, a raw RPC call, or any other method to bypass the recusal. The Ethereum virtual machine itself enforces it.

**Why this matters mathematically**: Without recusal, the conflict-of-interest judge's score would be included in the trimmed mean calculation for that project. The recusal ensures the aggregate is computed only over unbiased evaluators — making the average statistically honest.

**Limitation**: We rely on the admin to correctly identify and mark conflicts. A compromise of the admin key could allow a recusal to be lifted. The `proposeAdminTransfer` 2-step ownership pattern mitigates admin key compromise risk.

---

### Q10. What is the dispute resolution mechanism and why can't the admin finalise with pending disputes?

**Model Answer:**

The dispute system consists of two layers:

**Layer 1 — On-chain (governance):**
- `pendingDisputeCount` is a uint256 counter incremented on `raiseDispute()` and decremented on `resolveDispute()`
- `setPhase(Finalized)` contains `require(pendingDisputeCount == 0, "Resolve all disputes before finalizing")`
- This is a hard EVM guard — **not a UI warning, not an admin override option**

**Layer 2 — Off-chain (rich text, audit trail):**
- MongoDB `disputes` collection stores the full reason text, timestamps, and resolution notes
- REST API allows the admin panel to display, filter, and resolve disputes with full human-readable context

**Why block finalisation?**
Consider what happens without this guard: an organiser could receive disputes alleging judge bias at 11pm, decide to ignore them, and call `setPhase(Finalized)` at midnight regardless. With the guard, they are **contractually obligated** by the EVM to process every dispute before the results can be locked. This is enforceable accountability at the protocol level.

The only escape hatch would be to reject all disputes (`resolveDispute(id, Rejected)` — which still decrements `pendingDisputeCount`). Rejecting a dispute is a documented on-chain action, creating an immutable audit trail of the decision.

---

## Mathematical Fairness

---

### Q11. Why does your minimum-quorum gate exist? Describe the specific scoring failure it prevents.

**Model Answer:**

Without a quorum gate, this scenario is possible:

- Project A: Scored by 5 judges → scores [7, 8, 7, 8, 7] → trimmed mean = **7.67**
- Project B: Scored by 1 judge → score [10] → average = **10.0**

Project B ranks first with a perfect score from a single judge. Project A, which has more comprehensive evaluation, ranks below it.

This isn't a hypothetical edge case — it's the natural consequence of averaging scores from different sample sizes without accounting for statistical significance.

`minJudgesForRanking` introduces a quorum requirement. Projects with fewer scores than `minJudgesForRanking` are flagged as `quorumMet = false`. In the 5-tier tie-breaking cascade, **Tier 1 is quorum status** — so any quorum-met project automatically outranks any provisional project, regardless of score.

In the frontend, provisional projects appear in a separate "Provisional" bucket below the main ranked leaderboard, with a clear visual indicator that they lack sufficient evaluation.

**Admin flexibility**: The admin can set `minJudgesForRanking` to any value via `setMinJudgesForRanking(n)`. Setting it to 1 effectively disables the gate. Setting it to 3 means every project needs at least 3 independent evaluations to be considered fully ranked.

---

## Database & Caching

---

### Q12. Why did you use MongoDB instead of PostgreSQL for the off-chain data?

**Model Answer:**

The choice between MongoDB and PostgreSQL comes down to **schema flexibility vs. relational integrity**.

For ChainJudge's off-chain data layer:

1. **User profiles** vary in structure — some users have linked wallets, some don't. Some have bios, some don't. MongoDB's document model handles optional fields naturally without NULL columns or schema migrations.

2. **Project application descriptions** are free-form rich text — well-suited to a document store.

3. **Disputes include arbitrary reason strings** — no fixed schema.

4. **We don't need JOIN operations** — the critical relational data (which judge scored which project) lives on-chain, not in MongoDB. MongoDB's denormalised documents are sufficient for our off-chain supplementary data.

5. **Rapid iteration** — as features are added (new fields to user profiles, new metadata for disputes), MongoDB's schemaless nature (managed through Mongoose optional fields) makes changes non-breaking.

**When PostgreSQL would be better**: If we needed complex reporting queries across tables (e.g., "all disputes raised by judges who have a conflict of interest with more than 2 projects"), a relational model with proper JOINs would be more efficient.

---

### Q13. Describe the 5 Redis caching strategies and which problem each one solves.

**Model Answer:**

| # | Cache Key Pattern | Strategy | Problem Solved |
|---|------------------|----------|----------------|
| 1 | `leaderboard:current` | Read-through with 30s TTL | EVM RPC calls for leaderboard take ~800ms. With Redis, repeated requests return in ~2ms. |
| 2 | `events:latest` | Redis Sorted Set (`ZADD` by block number) | Scanning block logs for events on every Tx History request is O(blocks). Redis Sorted Set gives O(log N) retrieval. |
| 3 | `session:<token>` | Key-value with 7d TTL | Validating JWT tokens requires MongoDB lookup on every protected request. Redis lookup is sub-millisecond. |
| 4 | `ratelimit:<path>:<ip>` | Counter with 60s TTL | Sliding-window rate limiting to protect auth, application, and dispute endpoints from spam. |
| 5 | `ipfs:<cid>` | Key-value with 1hr TTL | IPFS gateway resolution can take 2–10 seconds. Cached CIDs return instantly on subsequent requests. |

**The fallback design**: If the local Redis daemon is not running, `cacheService.js` automatically falls back to an in-memory `Map` with identical TTL semantics. The server never crashes — it simply operates with in-memory caching instead.

---

## Frontend & System Integration

---

### Q14. How does the frontend connect to both the blockchain and the MongoDB backend simultaneously?

**Model Answer:**

The frontend uses two parallel communication channels:

**Channel 1 — Blockchain (ethers.js):**
- `useWeb3.jsx` creates an `ethers.BrowserProvider` (MetaMask) or `ethers.JsonRpcProvider` (Hardhat local)
- Smart contract interactions use `new ethers.Contract(address, abi, signer)`
- All scoring, phase transitions, and governance operations go through this channel
- Results are authoritative — they come from the blockchain

**Channel 2 — REST API (fetch):**
- `frontend/src/api/client.js` provides typed async methods wrapping `fetch()`
- User signup, login, profile updates, application submissions, and dispute filing all go through `http://localhost:5000/api`
- Results are supplementary — MongoDB stores user experience data, not outcome-critical data

**Coordination in `signUpWithEmail()`:**
1. Call `apiClient.signUp()` → POST to MongoDB → receive JWT token
2. Call `connectLocalAccount(roleIndex)` → connect ethers.js wallet
3. Save profile to `localStorage` as `chainjudge_auth_session`

Both calls happen in the same function. If the MongoDB call fails (e.g. server offline), the ethers.js connection still proceeds — the user can interact with the blockchain even without MongoDB connectivity.

---

## Design Trade-offs & Limitations

---

### Q15. What are the main limitations of this system and how would you address them in production?

**Model Answer:**

This is the most important question to answer honestly. Every production system has trade-offs.

**Limitation 1 — On-chain randomness for judge assignment is weak.**
`block.prevrandao` (formerly `DIFFICULTY`) is the source of on-chain randomness for randomised judge assignment. However, `prevrandao` can be influenced by Ethereum validators who choose not to propose a block if the resulting randomness would be unfavourable. Production fix: Use **Chainlink VRF** (Verifiable Random Function) for cryptographically secure, manipulation-proof randomness.

**Limitation 2 — Commit-reveal withhold attack.**
A judge who commits but refuses to reveal prevents their score from counting. Production fix: Judge deposits + slash condition for non-reveal, or automatic score invalidation after a reveal deadline.

**Limitation 3 — Gas costs on Ethereum mainnet.**
Each judge score commit + reveal is two transactions. At 30 Gwei gas price and 100,000 gas per tx, each judge-project pair costs ~$5–10. For 10 judges × 20 projects = 400 transactions = ~$2,000–4,000. Production fix: Deploy on an L2 (Optimism, Arbitrum, Base) where gas costs are 10–100× lower.

**Limitation 4 — Admin key is a single point of failure.**
If the admin private key is compromised, an attacker can: register fake judges, lift conflict-of-interest recusals, reject all disputes, and transfer admin ownership. Production fix: Replace the `address public admin` with a **multi-sig wallet** (Gnosis Safe) requiring 2-of-3 or 3-of-5 keyholders to approve administrative actions.

**Limitation 5 — IPFS link rot.**
IPFS CIDs stored in project applications point to content that may become unavailable if no node pins it. Production fix: Use **Filecoin** for persistent, incentivised storage guarantees, or a dedicated IPFS pinning service (Pinata, web3.storage).

**Limitation 6 — No oracle for real-world identity.**
Any address can register as any team. Without KYC, a single bad actor could submit 50 applications from different addresses. Production fix: Integrate with **Worldcoin Proof-of-Personhood** or **ENS** identity verification.

---

### Q16. Why is the soulbound NFT important? What does it prove?

**Model Answer:**

A standard ERC-721 NFT is fully transferable. If we minted a hackathon winner certificate as a transferable NFT, the winner could immediately sell it to someone else. That person could then claim to have won the hackathon — the certificate proves nothing about the current holder.

A **Soulbound Token (SBT)** — conceptualised by Ethereum co-founder Vitalik Buterin — is a non-transferable NFT. Our implementation overrides the `_update()` function in OpenZeppelin's ERC-721:

```solidity
function _update(address to, uint256 tokenId, address auth)
    internal override returns (address)
{
    address from = _ownerOf(tokenId);
    if (from != address(0)) {
        revert("WinnerNFT: Soulbound — non-transferable");
    }
    return super._update(to, tokenId, auth);
}
```

This reverts on any transfer — `safeTransferFrom`, `transferFrom`, `approve`, everything — because they all flow through `_update()`. The only exception is minting (where `from == address(0)`).

**What it proves:**
- The holder's wallet address is the address that was awarded the certificate
- The certificate was issued by the `HackathonJudging` smart contract
- The award is permanently tied to a specific project, rank, and hackathon
- The on-chain SVG renders the certificate with no external dependencies

**Academic value**: This demonstrates understanding of ERC-721 internals, the emerging concept of digital identity on blockchain, and the ability to extend a standard OpenZeppelin contract with custom logic.

---

### Q17. How would you scale this system to handle 1,000 teams and 100 judges?

**Model Answer:**

At 1,000 teams × 100 judges = 100,000 potential judge-project pairs, several components break:

**Problem 1 — `getLeaderboard()` iteration over 1,000 projects**: The sorting loop is O(n²). At 1,000 projects, that's 1,000,000 comparisons — potentially exceeding the Ethereum block gas limit (30M gas).

Solution: Off-chain aggregation. Instead of computing the leaderboard on-chain, emit `ScoreRevealed` events and aggregate them in the backend (Node.js). Store the pre-computed leaderboard in Redis. Use the smart contract only for final validation before award distribution.

**Problem 2 — Judge assignment**: Not every judge should evaluate every project. At 100 judges × 1,000 projects, requiring everyone to score everything (100,000 evaluations) is impractical.

Solution: Randomised assignment using `block.prevrandao` or Chainlink VRF, assigning each judge 30–50 projects. Store assignments in `assignments[judge][project]` and require the mapping to be `true` before accepting a commit.

**Problem 3 — IPFS pitch deck loading**: 1,000 IPFS gateway requests without caching would be extremely slow.

Solution: Redis `ipfs:<cid>` cache (already implemented) with Filecoin persistent pinning.

**Problem 4 — Rate limiting at scale**: A Redis sliding window might need to be upgraded to a **token bucket** algorithm for smoother burst handling under high load.

**Infrastructure answer**: Deploy the Express server behind a load balancer (NGINX), use a MongoDB replica set for read scaling, and deploy the Ethereum contract on an L2 for affordable gas at scale.
