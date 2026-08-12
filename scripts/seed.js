/**
 * Seed Script — Demo Data for HackathonJudging Contract
 * ======================================================
 * Usage:
 *   npx hardhat run scripts/seed.js --network localhost
 *
 * This script creates a full demo scenario so the application can be
 * demonstrated immediately without manual data entry. It:
 *   1. Configures the hackathon
 *   2. Registers 4 sample projects
 *   3. Registers 3 authorized judges (using local Hardhat accounts)
 *   4. Has each judge submit scores for all projects
 *   5. Prints the final leaderboard to the console
 *
 * NOTE: This script uses the actual deployed smart contract.
 *       All data interaction goes through real blockchain transactions.
 *       No fake or mocked data.
 */

const { ethers } = require("hardhat");
const path = require("path");
const fs = require("fs");

// Demo hackathon configuration
const HACKATHON_CONFIG = {
  name: "Web3 AI & Innovation Hackathon 2026",
  description:
    "A semester-long hackathon exploring the intersection of blockchain, AI, and real-world impact. " +
    "Teams are evaluated on technical quality, innovation, user experience, and societal impact.",
  active: true,
};

// Sample projects representing diverse hackathon entries
const PROJECTS = [
  {
    name: "ChainVault",
    description:
      "A decentralized multi-signature treasury management system for student organizations and DAOs. Ensures funds require multiple approvals before release.",
    teamLead: "Alice Johnson",
    category: "DeFi",
  },
  {
    name: "MediLink",
    description:
      "Blockchain-based patient record sharing platform. Patients own their records and grant hospitals access with cryptographic consent — eliminating medical data silos.",
    teamLead: "Bob Singh",
    category: "HealthTech",
  },
  {
    name: "EduCred",
    description:
      "Tamper-proof academic credential verification. Universities issue blockchain certificates that employers can verify instantly without contacting the institution.",
    teamLead: "Carol Williams",
    category: "EdTech",
  },
  {
    name: "GreenChain",
    description:
      "Carbon credit tracking system on blockchain. Transparent, verifiable offset marketplace that prevents double-counting and greenwashing.",
    teamLead: "David Park",
    category: "Sustainability",
  },
];

// Sample judging panel with realistic names
const JUDGES = [
  { name: "Dr. Emily Chen", accountIndex: 1 },   // Hardhat account #1
  { name: "Prof. Mark Rodriguez", accountIndex: 2 }, // Hardhat account #2
  { name: "Ms. Priya Patel", accountIndex: 3 },   // Hardhat account #3
];

// Sample scores — each judge scores each project
// Format: [technicalQuality, innovation, userExperience, impact] each 0-10
const JUDGING_SCORES = {
  // Judge 1 scores (Dr. Emily Chen) — technical focus, strict on UX
  judge0: [
    [8, 7, 7, 8],  // ChainVault   → total 30
    [7, 8, 6, 9],  // MediLink     → total 30
    [9, 7, 8, 8],  // EduCred      → total 32
    [6, 9, 7, 9],  // GreenChain   → total 31
  ],
  // Judge 2 scores (Prof. Mark Rodriguez) — innovation-focused
  judge1: [
    [7, 6, 8, 7],  // ChainVault   → total 28
    [8, 9, 7, 9],  // MediLink     → total 33
    [8, 7, 9, 7],  // EduCred      → total 31
    [7, 10, 8, 9], // GreenChain   → total 34
  ],
  // Judge 3 scores (Ms. Priya Patel) — impact and UX focused
  judge2: [
    [7, 7, 9, 7],  // ChainVault   → total 30
    [8, 8, 8, 10], // MediLink     → total 34
    [9, 8, 8, 8],  // EduCred      → total 33
    [7, 9, 9, 10], // GreenChain   → total 35
  ],
};

async function main() {
  console.log("\n========================================");
  console.log("  HackathonJudging — Demo Data Seed");
  console.log("========================================\n");

  // Load deployed contract address from frontend contracts directory
  const addressFile = path.join(
    __dirname,
    "..",
    "frontend",
    "src",
    "contracts",
    "contract-address.json"
  );

  if (!fs.existsSync(addressFile)) {
    console.error(
      "ERROR: contract-address.json not found.\n" +
      "Please run the deploy script first:\n" +
      "  npx hardhat run scripts/deploy.js --network localhost\n"
    );
    process.exit(1);
  }

  const { HackathonJudging: contractAddress } = JSON.parse(
    fs.readFileSync(addressFile, "utf8")
  );

  console.log(`Using contract at: ${contractAddress}\n`);

  // Get signers — admin is account[0], judges use accounts 1-3
  const signers = await ethers.getSigners();
  const admin = signers[0];

  console.log(`Admin account: ${admin.address}`);

  // Connect to deployed contract
  const HackathonJudging = await ethers.getContractFactory("HackathonJudging");
  const contract = HackathonJudging.attach(contractAddress);

  // --- STEP 1: Configure Hackathon ---
  console.log("\n[1/4] Configuring hackathon...");
  const configTx = await contract
    .connect(admin)
    .configureHackathon(
      HACKATHON_CONFIG.name,
      HACKATHON_CONFIG.description,
      HACKATHON_CONFIG.active
    );
  await configTx.wait();
  console.log(`  ✓ Hackathon created: "${HACKATHON_CONFIG.name}"`);

  // --- STEP 2: Register Projects ---
  console.log("\n[2/4] Registering projects...");
  for (let i = 0; i < PROJECTS.length; i++) {
    const proj = PROJECTS[i];
    const tx = await contract
      .connect(admin)
      .registerProject(proj.name, proj.description, proj.teamLead, proj.category);
    await tx.wait();
    console.log(`  ✓ Project ${i + 1}: "${proj.name}" (${proj.category}) — Lead: ${proj.teamLead}`);
  }

  // --- STEP 3: Register Judges ---
  console.log("\n[3/4] Registering & authorizing judges...");
  for (let i = 0; i < JUDGES.length; i++) {
    const judgeConfig = JUDGES[i];
    const judgeAccount = signers[judgeConfig.accountIndex];
    const tx = await contract
      .connect(admin)
      .registerJudge(judgeAccount.address, judgeConfig.name);
    await tx.wait();
    console.log(
      `  ✓ Judge ${i + 1}: ${judgeConfig.name} (${judgeAccount.address})`
    );
  }

  // --- STEP 4: Submit Judging Scores ---
  console.log("\n[4/4] Submitting judging scores...");
  for (let j = 0; j < JUDGES.length; j++) {
    const judgeAccount = signers[JUDGES[j].accountIndex];
    const judgeName = JUDGES[j].name;
    const scores = JUDGING_SCORES[`judge${j}`];

    console.log(`\n  Scores from ${judgeName}:`);

    for (let p = 0; p < PROJECTS.length; p++) {
      const [tech, innov, ux, impact] = scores[p];
      const totalScore = tech + innov + ux + impact;

      const tx = await contract
        .connect(judgeAccount)
        .submitScore(p + 1, tech, innov, ux, impact);
      const receipt = await tx.wait();

      console.log(
        `    ✓ ${PROJECTS[p].name}: Tech=${tech} Innov=${innov} UX=${ux} Impact=${impact} → Total=${totalScore}/40 | TxHash: ${receipt.hash.slice(0, 20)}...`
      );
    }
  }

  // --- PRINT LEADERBOARD ---
  console.log("\n========================================");
  console.log("  FINAL LEADERBOARD (from blockchain)");
  console.log("========================================");

  const leaderboard = await contract.getLeaderboard();

  console.log(
    `\n  Rank | Project Name       | Team Lead         | Category      | Avg Score | Judges`
  );
  console.log(
    `  -----|--------------------|--------------------|---------------|-----------|-------`
  );

  for (let i = 0; i < leaderboard.length; i++) {
    const entry = leaderboard[i];
    const avgDisplay = (Number(entry.averageScore) / 100).toFixed(2);
    console.log(
      `  #${i + 1}   | ${entry.projectName.padEnd(18)} | ${entry.teamLead.padEnd(18)} | ${entry.category.padEnd(13)} | ${avgDisplay.padStart(9)} | ${entry.judgeCount}`
    );
  }

  console.log("\n========================================");
  console.log("  Seed Complete! Demo data ready.");
  console.log("========================================");
  console.log("\nNext step: Start the frontend:");
  console.log("  cd frontend && npm run dev\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n[ERROR]", error.message || error);
    process.exit(1);
  });
