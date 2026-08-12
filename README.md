# ⛓️ ChainJudge: Blockchain-Based Hackathon Judging Platform

An undergraduate introductory blockchain project demonstrating decentralized, immutable, and transparent hackathon judging powered by EVM smart contracts.

---

## 🎯 Executive Summary & Problem Statement

In traditional hackathons and competitions, judging scores are typically recorded in centralized spreadsheets or private databases managed by organizers. This introduces several potential vulnerabilities and trust issues:

1. **Lack of Transparency**: Participants cannot independently verify if final scores were modified, corrupted, or miscalculated after submission.
2. **Centralized Tampering**: An administrator or rogue judge could alter scores after seeing intermediate results.
3. **No Audit Trail**: Traditional systems lack a permanent, cryptographic record of *who* submitted *what* score and *when*.

### Why Blockchain?

**ChainJudge** solves these challenges by anchoring judging records to an Ethereum Virtual Machine (EVM) blockchain smart contract:

* **Immutable Judging Records**: Once a score is written to the blockchain via a signed transaction, it cannot be modified, overwritten, or deleted by anyone — including the hackathon organizer.
* **Cryptographic Authorization**: Role-Based Access Control (RBAC) ensures only wallet addresses explicitly registered by the admin as authorized judges can submit scores.
* **On-Chain Leaderboard Aggregation**: Aggregate scores (average totals) are computed directly on-chain by the smart contract. The leaderboard is a direct window into contract state.
* **Permanent Audit Trail**: Every score submission emits an on-chain event (`ScoreSubmitted`) containing block numbers, transaction hashes, timestamps, and criterion breakdowns.

---

## 🏗️ System Architecture

The project maintains a strict separation of concerns between on-chain security/integrity and off-chain presentation:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Browser Web3 UI (React + Vite)             │
│  - Dashboard & Educational Value Prop                           │
│  - Projects Registry View                                       │
│  - Judge Scoring Form (Rubric Sliders 0–10)                     │
│  - Live On-Chain Leaderboard                                    │
│  - Admin Management Panel                                       │
│  - Blockchain Event Log & Transaction Explorer                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
               Ethers.js v6 (EIP-1193 / JSON-RPC)
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                   Hardhat Local EVM Node                        │
│                     (Chain ID: 31337)                           │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │             HackathonJudging.sol Smart Contract         │   │
│   │  - State: projects, judges, judgeHasScored, scores      │   │
│   │  - Modifiers: onlyAdmin, onlyAuthorizedJudge            │   │
│   │  - Validation: range 0–10, project exists, no duplicates │   │
│   │  - View: getLeaderboard() (On-chain bubble sort)        │   │
│   │  - Events: ScoreSubmitted, ProjectRegistered, etc.       │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### On-Chain vs. Off-Chain Boundaries

| Component | Location | Reason / Justification |
| :--- | :--- | :--- |
| **Score Storage** | On-Chain | Ensures immutability, tamper resistance, and public auditability. |
| **Judge Authorization** | On-Chain | Enforces cryptographic access control via `msg.sender` validation. |
| **Score Validation** | On-Chain | Prevents out-of-range (0–10) or duplicate submissions regardless of frontend behavior. |
| **Leaderboard Math** | On-Chain | Ensures aggregate scores and rankings cannot be manipulated off-chain. |
| **UI Presentation** | Off-Chain (React) | Fast rendering, interactive rubric sliders, responsive visual design. |

---

## 📋 Smart Contract Architecture & Scoring Rubric

### Scoring Model
Judges evaluate each project across 4 criteria on a **0 to 10 scale**:

1. **Technical Quality** (0–10): Technical complexity, code structure, and execution stability.
2. **Innovation** (0–10): Originality of concept and creative problem solving.
3. **User Experience** (0–10): Polishing, usability, and UI design.
4. **Real-World Impact** (0–10): Practical utility and potential societal/market impact.

$$\text{Judge Total Score} = \text{Technical} + \text{Innovation} + \text{UX} + \text{Impact} \quad (\text{Max } 40)$$

$$\text{Project Average Score} = \frac{\sum_{i=1}^{N} \text{Judge Total}_i}{N} \times 100$$

*(Note: Stored on-chain multiplied by 100 to preserve 2 decimal places without floating point math).*

### Access Control Matrix

| Function | Admin | Authorized Judge | Unauthorized / Public |
| :--- | :---: | :---: | :---: |
| `configureHackathon()` | ✅ | ❌ | ❌ |
| `registerProject()` | ✅ | ❌ | ❌ |
| `registerJudge()` | ✅ | ❌ | ❌ |
| `revokeJudge()` / `reauthorizeJudge()` | ✅ | ❌ | ❌ |
| `submitScore()` | ❌ | ✅ | ❌ |
| `getLeaderboard()` | ✅ | ✅ | ✅ |
| `getProjectAggregateScore()` | ✅ | ✅ | ✅ |

---

## 🚀 Quickstart & Setup Guide

### Prerequisites
* **Node.js**: v18.0.0 or higher (`node -v`)
* **npm**: v9.0.0 or higher (`npm -v`)

### Step 1: Install Dependencies
```bash
# Install root (Hardhat) dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Step 2: Run Unit Tests
Verify smart contract compilation and safety checks:
```bash
npx hardhat test
```

### Step 3: Start Local Blockchain Node
In Terminal 1:
```bash
npx hardhat node
```
*This starts a local EVM node at `http://127.0.0.1:8545` with 20 pre-funded accounts (10,000 ETH each).*

### Step 4: Deploy Contract & Seed Demo Data
In Terminal 2:
```bash
# 1. Deploy smart contract
npx hardhat run scripts/deploy.js --network localhost

# 2. Seed realistic demo hackathon data (4 projects, 3 judges, sample scores)
npx hardhat run scripts/seed.js --network localhost
```

### Step 5: Launch Frontend UI
In Terminal 2:
```bash
cd frontend
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## 🎓 Viva / Presentation Guide for Students

When presenting this project for an academic evaluation, be prepared to answer these common questions:

### Q1: Why not just use a traditional backend database like PostgreSQL or Firebase?
> **Answer**: A traditional database relies on a centralized administrator who has full `UPDATE` and `DELETE` access. Even with row-level permissions, an IT admin or hacker with database credentials can silently alter score records. On the blockchain, once `submitScore()` executes, the state is permanently saved across all nodes. There is no update or delete function in the contract code, making score tampering mathematically impossible.

### Q2: How does the smart contract prevent duplicate score submissions?
> **Answer**: The contract uses a nested mapping `mapping(address => mapping(uint256 => bool)) public judgeHasScored;`. Before writing any score, `submitScore()` checks `require(!judgeHasScored[msg.sender][_projectId])`. If `true`, the transaction reverts instantly, refunding unspent gas.

### Q3: What happens if someone tries to bypass the React frontend and call `submitScore()` directly via script?
> **Answer**: All security constraints are enforced **on-chain inside the Solidity smart contract**. Even if an attacker calls the contract directly using `web3.js` or `curl`, the EVM executes the exact same `require()` checks: judge authorization, project registration, valid score bounds (0–10), and duplicate checks.

### Q4: How are floating-point numbers handled in the Solidity leaderboard calculation?
> **Answer**: Solidity does not natively support floating-point numbers to prevent non-deterministic division across different CPU architectures. We solve this by multiplying the total raw score by `100` before dividing by the judge count (`averageScore = (totalRawScore * 100) / judgesWhoScored`). The frontend then divides by 100 to display two clean decimal places (e.g. `3250` $\rightarrow$ `32.50`).

---

## 📁 Repository Directory Structure

```
blockchain-project/
├── contracts/
│   └── HackathonJudging.sol    # Core smart contract
├── test/
│   └── HackathonJudging.test.js # Hardhat test suite (100% pass)
├── scripts/
│   ├── deploy.js               # Contract deployment & ABI export
│   └── seed.js                 # Demo data seeder
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx          # Header with account switcher
│   │   │   ├── DashboardView.jsx   # Landing & value prop cards
│   │   │   ├── ProjectsView.jsx    # Projects listing
│   │   │   ├── JudgingView.jsx     # Rubric sliders & score submit
│   │   │   ├── LeaderboardView.jsx # Live rankings & aggregate math
│   │   │   ├── AdminView.jsx       # Admin panel (projects, judges)
│   │   │   ├── TxHistoryView.jsx   # Event log & tx explorer
│   │   │   └── ToastContainer.jsx  # Notification toasts
│   │   ├── hooks/
│   │   │   └── useWeb3.jsx         # Web3 context, Ethers.js & local accounts
│   │   ├── contracts/              # Exported ABI & address (auto-generated)
│   │   ├── App.jsx
│   │   ├── index.css               # Dark glassmorphism design system
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── hardhat.config.js           # Hardhat network & Solidity settings
├── package.json
└── README.md                   # Complete documentation
```

---

## 📄 License
MIT License — Free for academic, non-commercial, and student demonstration use.
