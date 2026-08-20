# ChainJudge — Smart Contracts Guide

> **Deep-dive technical reference for `HackathonJudging.sol` and `WinnerNFT.sol` — covering every state variable, function, mathematical formula, security pattern, and design decision.**

---

## Table of Contents

1. [Contract Overview](#contract-overview)
2. [HackathonJudging.sol — In Depth](#hackathon-judging-in-depth)
   - [State Variables](#state-variables)
   - [Phase State Machine](#phase-state-machine)
   - [Commit–Reveal Scoring](#commitreveal-scoring)
   - [Weighted Rubric & Score Calculation](#weighted-rubric--score-calculation)
   - [Trimmed Mean Aggregation](#trimmed-mean-aggregation)
   - [5-Tier Tie-Breaking Algorithm](#5-tier-tie-breaking-algorithm)
   - [Minimum-Quorum Gate](#minimum-quorum-gate)
   - [Conflict-of-Interest Recusal](#conflict-of-interest-recusal)
   - [Dispute & Appeal System](#dispute--appeal-system)
   - [Team Self-Registration](#team-self-registration)
   - [2-Step Admin Transfer](#2-step-admin-transfer)
   - [Function Reference](#function-reference)
3. [WinnerNFT.sol — In Depth](#winnernft-in-depth)
   - [Soulbound Implementation](#soulbound-implementation)
   - [On-Chain SVG Generation](#on-chain-svg-generation)
4. [Gas Optimisation Notes](#gas-optimisation-notes)
5. [Events Reference](#events-reference)
6. [Error & Revert Messages](#error--revert-messages)

---

## Contract Overview

| Contract | Compiler | Lines | Primary Pattern |
|----------|----------|-------|-----------------|
| `HackathonJudging.sol` | Solidity ^0.8.24 | ~650 | Phase state machine + commit-reveal |
| `WinnerNFT.sol` | Solidity ^0.8.24 | ~123 | Soulbound ERC-721 + on-chain SVG |

Both contracts are compiled with `viaIR: true` (Intermediate Representation) to enable cross-function optimisations and reduce stack-depth issues on complex functions.

---

## HackathonJudging.sol — In Depth

### State Variables

```solidity
// ─── GOVERNANCE ──────────────────────────────────────────────────────────────
address public admin;
address public pendingAdmin;          // For 2-step ownership transfer

// ─── HACKATHON METADATA ──────────────────────────────────────────────────────
string public hackathonName;
string public hackathonDescription;
bool public hackathonActive;

// ─── PHASE STATE MACHINE ─────────────────────────────────────────────────────
enum Phase { Setup, Judging, Revealing, Finalized }
Phase public currentPhase;
uint256 public judgingDeadline;       // Unix timestamp

// ─── PROJECTS ────────────────────────────────────────────────────────────────
uint256 public projectCount;
mapping(uint256 => Project) public projects;

// ─── JUDGES ──────────────────────────────────────────────────────────────────
uint256 public judgeCount;
mapping(address => bool) public isAuthorizedJudge;
mapping(address => mapping(uint256 => bool)) public judgeConflicts;  // recusal

// ─── COMMIT–REVEAL SCORING ───────────────────────────────────────────────────
mapping(address => mapping(uint256 => bytes32)) public commitHash;
mapping(address => mapping(uint256 => bool)) public hasCommitted;
mapping(address => mapping(uint256 => bool)) public hasRevealed;
mapping(uint256 => uint256[]) public projectScores;
mapping(uint256 => address[]) public projectJudges;

// ─── WEIGHTED RUBRIC ─────────────────────────────────────────────────────────
uint256[4] public criteriaWeights;   // Must sum to 100

// ─── QUORUM ──────────────────────────────────────────────────────────────────
uint256 public minJudgesForRanking;

// ─── DISPUTES ────────────────────────────────────────────────────────────────
uint256 public disputeCount;
uint256 public pendingDisputeCount;  // Blocks finalisation
mapping(uint256 => Dispute) public disputes;

// ─── APPLICATIONS ────────────────────────────────────────────────────────────
uint256 public applicationCount;
mapping(uint256 => ProjectApplication) public applications;
```

---

### Phase State Machine

```solidity
enum Phase { Setup, Judging, Revealing, Finalized }
```

Transitions are strictly forward-only. Admin calls `setPhase(Phase newPhase)`:

```
Setup  →  Judging  →  Revealing  →  Finalized
  0          1            2              3
```

**Critical guards on `setPhase`:**
- `Finalized` transition requires `pendingDisputeCount == 0`
- `newPhase` must equal `uint(currentPhase) + 1` (no phase-skipping)

**Why phases matter**: Without a state machine, a malicious admin could re-open scoring after viewing all scores. The EVM enforces the lifecycle.

---

### Commit–Reveal Scoring

This is the **core privacy mechanism**. Scoring happens in two on-chain phases:

#### Phase 1 — Commit (During `Judging`)

```solidity
function commitScore(
    uint256 projectId,
    bytes32 hash
) external {
    require(currentPhase == Phase.Judging);
    require(isAuthorizedJudge[msg.sender]);
    require(!judgeConflicts[msg.sender][projectId], "Recused");
    require(!hasCommitted[msg.sender][projectId], "Already committed");
    require(block.timestamp < judgingDeadline, "Deadline passed");

    commitHash[msg.sender][projectId] = hash;
    hasCommitted[msg.sender][projectId] = true;
    emit ScoreCommitted(msg.sender, projectId, hash);
}
```

**The hash is computed client-side:**
```javascript
const hash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
        ['uint256', 'uint256', 'uint256', 'uint256', 'bytes32'],
        [innovation, execution, presentation, impact, salt]
    )
);
```

#### Phase 2 — Reveal (During `Revealing`)

```solidity
function revealScore(
    uint256 projectId,
    uint256 innovation,
    uint256 execution,
    uint256 presentation,
    uint256 impact,
    bytes32 salt
) external {
    require(currentPhase == Phase.Revealing);
    require(hasCommitted[msg.sender][projectId]);
    require(!hasRevealed[msg.sender][projectId]);

    // Cryptographic verification
    bytes32 expectedHash = keccak256(abi.encode(
        innovation, execution, presentation, impact, salt
    ));
    require(expectedHash == commitHash[msg.sender][projectId], "Hash mismatch");

    uint256 weighted = _computeWeightedScore(
        innovation, execution, presentation, impact
    );
    projectScores[projectId].push(weighted);
    projectJudges[projectId].push(msg.sender);
    hasRevealed[msg.sender][projectId] = true;
    emit ScoreRevealed(msg.sender, projectId, weighted);
}
```

**Security property**: If a judge tries to change their scores after committing, the reveal fails because `keccak256(new_scores, salt) ≠ storedHash`.

---

### Weighted Rubric & Score Calculation

Scores are submitted across **4 criteria**, each weighted by `criteriaWeights[i]`:

```solidity
function _computeWeightedScore(
    uint256 innovation,
    uint256 execution,
    uint256 presentation,
    uint256 impact
) internal view returns (uint256) {
    require(innovation <= 10 && execution <= 10 &&
            presentation <= 10 && impact <= 10, "Score out of range");

    uint256 weighted = (
        innovation    * criteriaWeights[0] +
        execution     * criteriaWeights[1] +
        presentation  * criteriaWeights[2] +
        impact        * criteriaWeights[3]
    );
    // Divide by 10 to normalise to 0-100 range
    return weighted / 10;
}
```

**Default weights**: `[25, 25, 25, 25]` (equal weighting across all criteria).

**Admin can reconfigure**: `setCriteriaWeights([40, 30, 20, 10])` to emphasise innovation.

**Max score**: `10 * (25+25+25+25) / 10 = 100`

---

### Trimmed Mean Aggregation

To filter outlier judges, the leaderboard function computes a **trimmed mean**:

```solidity
function _computeTrimmedMean(
    uint256[] memory scores
) internal pure returns (uint256) {
    uint256 n = scores.length;
    if (n == 0) return 0;
    if (n <= 2) {
        // Not enough judges to trim — use simple average
        uint256 sum = 0;
        for (uint256 i = 0; i < n; i++) sum += scores[i];
        return sum / n;
    }

    // Sort scores (ascending)
    uint256[] memory sorted = _sortAscending(scores);

    // Trim lowest and highest (1 each side)
    uint256 trimSum = 0;
    for (uint256 i = 1; i < n - 1; i++) {
        trimSum += sorted[i];
    }
    return trimSum / (n - 2);
}
```

**Mathematical property**: For `n` judges, the trimmed mean ignores the single highest and single lowest scores. With 5 judges, only 3 scores contribute to the final ranking. This makes it impossible for a single corrupt or biased judge to control the outcome.

---

### 5-Tier Tie-Breaking Algorithm

When two projects have identical trimmed means, the `_shouldSwap(a, b)` function resolves the tie via a pure cascade:

```solidity
function _shouldSwap(
    LeaderboardEntry memory a,
    LeaderboardEntry memory b
) internal pure returns (bool) {
    // Tier 1: Quorum status (fully ranked over provisional)
    if (a.quorumMet != b.quorumMet) return !a.quorumMet;

    // Tier 2: Trimmed score (higher wins)
    if (a.trimmedScore != b.trimmedScore)
        return a.trimmedScore < b.trimmedScore;

    // Tier 3: Simple average (higher wins)
    if (a.averageScore != b.averageScore)
        return a.averageScore < b.averageScore;

    // Tier 4: Judge count (more judges = more credible)
    if (a.judgeCount != b.judgeCount)
        return a.judgeCount < b.judgeCount;

    // Tier 5: ProjectId (lower = earlier submission = tiebreak)
    return a.projectId > b.projectId;
}
```

**Why this matters**: A bubble sort without a stable comparator produces arbitrary ordering for equal elements. This 5-tier cascade ensures results are **fully deterministic** — every EVM node in the world produces the same leaderboard from the same contract state.

---

### Minimum-Quorum Gate

```solidity
uint256 public minJudgesForRanking;  // Default: 2

// In getLeaderboard():
entry.quorumMet = (projectJudges[i].length >= minJudgesForRanking);
```

Projects below quorum are returned in the leaderboard array but sorted **after** all quorum-met projects regardless of score. In the frontend, these appear in a "Provisional" bucket.

**Rationale**: Without this gate, a project scored 38/40 by one judge would outrank a project scored 36/40 by five judges. The quorum gate prevents this mathematically.

---

### Conflict-of-Interest Recusal

```solidity
// Admin sets recusal
function setJudgeConflict(
    address judge,
    uint256 projectId,
    bool conflict
) external onlyAdmin {
    judgeConflicts[judge][projectId] = conflict;
    emit JudgeConflictSet(judge, projectId, conflict);
}

// Enforced at commit time
require(!judgeConflicts[msg.sender][projectId],
    "Judge has conflict of interest for this project");
```

**The critical distinction**: This is not a UI warning. The EVM reverts the transaction. The recused judge's wallet cannot submit any score for the flagged project, regardless of which client application they use.

---

### Dispute & Appeal System

```solidity
struct Dispute {
    uint256 disputeId;
    uint256 projectId;
    address raisedBy;
    string reason;
    DisputeStatus status;
    uint256 timestamp;
}

enum DisputeStatus { Pending, Resolved, Rejected }

function raiseDispute(
    uint256 projectId,
    string calldata reason
) external {
    require(
        currentPhase == Phase.Judging || currentPhase == Phase.Revealing,
        "Disputes only during active phases"
    );
    // ... store dispute
    pendingDisputeCount++;
    emit DisputeRaised(disputeCount, projectId, msg.sender, reason);
}

function resolveDispute(
    uint256 disputeId,
    DisputeStatus resolution
) external onlyAdmin {
    require(resolution != DisputeStatus.Pending, "Must resolve");
    disputes[disputeId].status = resolution;
    pendingDisputeCount--;
    emit DisputeResolved(disputeId, resolution);
}
```

**Finalisation guard**:
```solidity
function setPhase(Phase newPhase) external onlyAdmin {
    if (newPhase == Phase.Finalized) {
        require(pendingDisputeCount == 0,
            "Resolve all disputes before finalizing");
    }
    // ...
}
```

---

### Team Self-Registration

```solidity
struct ProjectApplication {
    uint256 applicationId;
    string name;
    string description;
    address applicant;
    string ipfsCID;          // IPFS hash of pitch deck
    ApplicationStatus status;
    uint256 timestamp;
}

function submitProjectApplication(
    string calldata name,
    string calldata description,
    string calldata ipfsCID
) external {
    require(currentPhase == Phase.Setup, "Applications only in Setup phase");
    // ... store application
    emit ApplicationSubmitted(applicationCount, msg.sender, name);
}

function approveProjectApplication(uint256 appId) external onlyAdmin {
    require(applications[appId].status == ApplicationStatus.Pending);
    applications[appId].status = ApplicationStatus.Approved;
    // Auto-register the project
    _registerProject(
        applications[appId].name,
        applications[appId].description,
        applications[appId].applicant,
        applications[appId].ipfsCID
    );
    emit ApplicationApproved(appId, ++projectCount);
}
```

---

### 2-Step Admin Transfer

```solidity
function proposeAdminTransfer(address newAdmin) external onlyAdmin {
    pendingAdmin = newAdmin;
    emit AdminTransferProposed(newAdmin);
}

function acceptAdminTransfer() external {
    require(msg.sender == pendingAdmin, "Not pending admin");
    emit AdminTransferred(admin, pendingAdmin);
    admin = pendingAdmin;
    pendingAdmin = address(0);
}
```

**Why 2-step?** A single `transferOwnership(wrongAddress)` call is irreversible. The 2-step pattern requires the new admin to actively accept — protecting against typos and phishing attacks.

---

### Function Reference

| Function | Phase | Caller | Description |
|----------|-------|--------|-------------|
| `setPhase(phase)` | Any | Admin | Advance lifecycle phase |
| `registerProject(...)` | Setup | Admin | Add project to competition |
| `registerJudge(addr)` | Setup | Admin | Authorise a judge |
| `setJudgeConflict(...)` | Setup | Admin | Mark recusal |
| `setMinJudgesForRanking(n)` | Any | Admin | Set quorum threshold |
| `setCriteriaWeights(...)` | Setup | Admin | Reconfigure rubric weights |
| `submitProjectApplication(...)` | Setup | Anyone | Team self-registration |
| `approveProjectApplication(id)` | Setup | Admin | Approve and auto-register |
| `rejectProjectApplication(id)` | Setup | Admin | Reject application |
| `commitScore(projectId, hash)` | Judging | Judge | Blind score commitment |
| `revealScore(projectId, scores, salt)` | Revealing | Judge | Score reveal + verify |
| `raiseDispute(projectId, reason)` | Judging/Revealing | Anyone | File scoring appeal |
| `resolveDispute(id, status)` | Revealing | Admin | Resolve or reject dispute |
| `getLeaderboard()` | Any | Anyone | Returns ranked entries array |
| `proposeAdminTransfer(addr)` | Any | Admin | Initiate ownership transfer |
| `acceptAdminTransfer()` | Any | PendingAdmin | Complete ownership transfer |
| `mintWinnerNFT(addr, projectId, rank)` | Finalized | Admin | Mint soulbound certificate |

---

## WinnerNFT.sol — In Depth

### Soulbound Implementation

```solidity
// Override ERC-721 _update to block all transfers
function _update(
    address to,
    uint256 tokenId,
    address auth
) internal override returns (address) {
    address from = _ownerOf(tokenId);
    // Allow minting (from == address(0)) but block all transfers
    if (from != address(0)) {
        revert("WinnerNFT: Soulbound — non-transferable");
    }
    return super._update(to, tokenId, auth);
}
```

**EIP-5192 compliance**: The `Locked` event is emitted on mint, signalling to wallets and marketplaces that this token is permanently non-transferable.

---

### On-Chain SVG Generation

The `tokenURI()` function generates a fully on-chain metadata JSON and SVG — **no IPFS, no external server** required:

```solidity
function tokenURI(uint256 tokenId)
    public view override returns (string memory)
{
    string memory rank = rankNames[tokenInfos[tokenId].rank];
    string memory svg = string(abi.encodePacked(
        '<svg xmlns="http://www.w3.org/2000/svg" ...',
        '<text>', rank, ' Place Winner</text>',
        '<text>', tokenInfos[tokenId].projectName, '</text>',
        '</svg>'
    ));

    string memory json = Base64.encode(bytes(string(abi.encodePacked(
        '{"name":"', rank, ' Place — ChainJudge Winner",',
        '"description":"Soulbound achievement certificate.",',
        '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '"}'
    ))));

    return string(abi.encodePacked("data:application/json;base64,", json));
}
```

**Why on-chain SVG?** IPFS metadata can become unavailable if gateways go offline. An on-chain SVG is permanently available as long as the Ethereum network exists — guaranteed forever for a Soulbound achievement certificate.

---

## Gas Optimisation Notes

| Technique | Applied Where | Benefit |
|-----------|---------------|---------|
| `viaIR: true` compilation | `hardhat.config.js` | Cross-function inlining, stack depth reduction |
| `calldata` parameters | All external view functions | Avoids memory copy overhead |
| `uint256` packing | Score arrays | Single slot per score value |
| `mapping` over arrays | Judge/project lookups | O(1) access vs O(n) array scan |
| View functions for leaderboard | `getLeaderboard()` | Zero gas reads for frontend |
| Events for history | All state changes | Off-chain indexing without on-chain storage |

---

## Events Reference

```solidity
event HackathonInitialized(string name, string description);
event PhaseChanged(Phase newPhase);
event JudgingDeadlineSet(uint256 deadline);
event ProjectRegistered(uint256 indexed projectId, string name, address teamWallet);
event JudgeRegistered(address indexed judge);
event JudgeConflictSet(address indexed judge, uint256 indexed projectId, bool conflict);
event ScoreCommitted(address indexed judge, uint256 indexed projectId, bytes32 hash);
event ScoreRevealed(address indexed judge, uint256 indexed projectId, uint256 weightedScore);
event MinJudgesUpdated(uint256 newMin);
event DisputeRaised(uint256 indexed disputeId, uint256 indexed projectId, address raisedBy, string reason);
event DisputeResolved(uint256 indexed disputeId, DisputeStatus status);
event ApplicationSubmitted(uint256 indexed appId, address applicant, string name);
event ApplicationApproved(uint256 indexed appId, uint256 projectId);
event ApplicationRejected(uint256 indexed appId);
event AdminTransferProposed(address indexed newAdmin);
event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
event WinnerNFTMinted(address indexed winner, uint256 tokenId, uint256 projectId, uint8 rank);
```

---

## Error & Revert Messages

| Revert Message | Trigger Condition |
|----------------|-------------------|
| `"Not admin"` | Non-admin calls admin-only function |
| `"Wrong phase"` | Function called in incorrect lifecycle phase |
| `"Not a judge"` | Non-judge attempts to commit/reveal |
| `"Already committed"` | Judge commits twice for same project |
| `"Already revealed"` | Judge reveals twice for same project |
| `"Hash mismatch"` | Revealed scores don't match commit hash |
| `"Recused"` | Conflict-of-interest judge tries to score |
| `"Deadline passed"` | Score submitted after `judgingDeadline` |
| `"Score out of range"` | Any criterion score > 10 |
| `"Weights must sum to 100"` | `setCriteriaWeights` called with bad sum |
| `"Resolve all disputes before finalizing"` | `setPhase(Finalized)` with pending disputes |
| `"Applications only in Setup phase"` | Application submitted after Setup |
| `"Not pending admin"` | Wrong address calls `acceptAdminTransfer` |
| `"WinnerNFT: Soulbound"` | Any attempt to transfer a Winner NFT |
