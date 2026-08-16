const { ethers } = require("hardhat");
const path = require("path");
const fs = require("fs");

const HACKATHON_CONFIG = {
  name: "Web3 AI & Innovation Hackathon 2026",
  description:
    "A semester-long hackathon exploring the intersection of blockchain, AI, and real-world impact. " +
    "Teams are evaluated on technical quality, innovation, user experience, and societal impact.",
  active: true,
};

const PROJECTS = [
  {
    name: "ChainVault",
    description: "A decentralized multi-signature treasury management system for DAOs with on-chain access controls.",
    teamLead: "Alice Johnson",
    category: "DeFi",
    ipfsCID: "bafybeigdyr321chainvaultcid",
  },
  {
    name: "MediLink",
    description: "Blockchain-based patient record sharing platform with cryptographic consent and privacy controls.",
    teamLead: "Bob Singh",
    category: "HealthTech",
    ipfsCID: "bafybeigdyr321medilinkcid",
  },
  {
    name: "EduCred",
    description: "Tamper-proof academic credential verification for instant university degree validation.",
    teamLead: "Carol Williams",
    category: "EdTech",
    ipfsCID: "bafybeigdyr321educredcid",
  },
  {
    name: "GreenChain",
    description: "Carbon credit tracking system on blockchain preventing greenwashing and double counting.",
    teamLead: "David Park",
    category: "Sustainability",
    ipfsCID: "bafybeigdyr321greenchaincid",
  },
];

const JUDGES = [
  { name: "Dr. Emily Chen", accountIndex: 1 },
  { name: "Prof. Mark Rodriguez", accountIndex: 2 },
  { name: "Ms. Priya Patel", accountIndex: 3 },
];

function createScoreHash(projectId, tech, innov, ux, impact, saltHex) {
  return ethers.solidityPackedKeccak256(
    ["uint256", "uint8", "uint8", "uint8", "uint8", "bytes32"],
    [projectId, tech, innov, ux, impact, saltHex]
  );
}

async function main() {
  console.log("\n========================================");
  console.log("  HackathonJudging — Advanced Seed");
  console.log("========================================\n");

  const addressFile = path.join(__dirname, "..", "frontend", "src", "contracts", "contract-address.json");
  if (!fs.existsSync(addressFile)) {
    console.error("ERROR: contract-address.json not found. Run deploy.js first.");
    process.exit(1);
  }

  const { HackathonJudging: contractAddress } = JSON.parse(fs.readFileSync(addressFile, "utf8"));
  const signers = await ethers.getSigners();
  const admin = signers[0];

  const HackathonJudging = await ethers.getContractFactory("HackathonJudging");
  const contract = HackathonJudging.attach(contractAddress);

  // 1. Configure Hackathon
  console.log("[1/6] Configuring hackathon & criteria weights...");
  await (await contract.connect(admin).configureHackathon(HACKATHON_CONFIG.name, HACKATHON_CONFIG.description, true)).wait();
  await (await contract.connect(admin).setCriteriaWeights([35, 30, 20, 15])).wait();

  // 2. Register Projects with IPFS CIDs
  console.log("\n[2/6] Registering projects with IPFS CIDs...");
  for (let i = 0; i < PROJECTS.length; i++) {
    const p = PROJECTS[i];
    const teamWallet = signers[5 + i] ? signers[5 + i].address : admin.address;
    await (
      await contract
        .connect(admin)
        .registerProjectWithDetails(p.name, p.description, p.teamLead, p.category, p.ipfsCID, teamWallet)
    ).wait();
    console.log(`  ✓ Project ${i + 1}: ${p.name} (${p.category}) [IPFS: ${p.ipfsCID}]`);
  }

  // 3. Register Judges & Set Conflict of Interest
  console.log("\n[3/6] Registering judges & configuring conflicts...");
  for (let i = 0; i < JUDGES.length; i++) {
    const j = JUDGES[i];
    const account = signers[j.accountIndex];
    await (await contract.connect(admin).registerJudge(account.address, j.name)).wait();
    console.log(`  ✓ Judge ${i + 1}: ${j.name} (${account.address})`);
  }
  // Recuse Judge 3 from Project 1
  await (await contract.connect(admin).setJudgeConflict(signers[3].address, 1, true)).wait();
  console.log(`  ✓ Recused Ms. Priya Patel from ChainVault due to Conflict of Interest`);

  // 4. Commit Phase
  console.log("\n[4/6] Transitioning to Phase.Judging & submitting Commit hashes...");
  await (await contract.connect(admin).setPhase(1)).wait(); // Judging

  const salts = [
    ethers.keccak256(ethers.toUtf8Bytes("salt_judge_1")),
    ethers.keccak256(ethers.toUtf8Bytes("salt_judge_2")),
    ethers.keccak256(ethers.toUtf8Bytes("salt_judge_3")),
  ];

  const rawScores = [
    // Judge 0
    [ [9, 8, 9, 8], [8, 9, 7, 9], [9, 9, 8, 8], [7, 8, 8, 9] ],
    // Judge 1
    [ [8, 7, 8, 7], [9, 9, 8, 9], [8, 8, 9, 7], [8, 9, 9, 9] ],
    // Judge 2 (Recused from project 1)
    [ null, [9, 8, 8, 10], [9, 8, 9, 9], [8, 9, 9, 10] ]
  ];

  for (let j = 0; j < JUDGES.length; j++) {
    const judgeSigner = signers[JUDGES[j].accountIndex];
    for (let p = 0; p < PROJECTS.length; p++) {
      if (rawScores[j][p] === null) continue;
      const [tech, innov, ux, impact] = rawScores[j][p];
      const hash = createScoreHash(p + 1, tech, innov, ux, impact, salts[j]);
      await (await contract.connect(judgeSigner).commitScore(p + 1, hash)).wait();
    }
  }
  console.log("  ✓ Commit hashes recorded on-chain for all non-recused judges.");

  // 5. Reveal Phase
  console.log("\n[5/6] Transitioning to Phase.Revealing & revealing scores...");
  await (await contract.connect(admin).setPhase(2)).wait(); // Revealing

  for (let j = 0; j < JUDGES.length; j++) {
    const judgeSigner = signers[JUDGES[j].accountIndex];
    for (let p = 0; p < PROJECTS.length; p++) {
      if (rawScores[j][p] === null) continue;
      const [tech, innov, ux, impact] = rawScores[j][p];
      await (await contract.connect(judgeSigner).revealScore(p + 1, tech, innov, ux, impact, salts[j])).wait();
    }
  }
  console.log("  ✓ Scores revealed & verified against commit hashes!");

  // 6. Finalize & Leaderboard
  console.log("\n[6/6] Finalizing hackathon...");
  await (await contract.connect(admin).setPhase(3)).wait(); // Finalized

  const leaderboard = await contract.getLeaderboard();
  console.log("\n========================================");
  console.log("  FINAL LEADERBOARD (Trimmed Mean)");
  console.log("========================================");
  console.log(`Rank | Project Name       | IPFS CID                   | Trimmed Score | Judges`);
  console.log(`-----|--------------------|----------------------------|---------------|-------`);

  for (let i = 0; i < leaderboard.length; i++) {
    const entry = leaderboard[i];
    const trimmedDisplay = (Number(entry.trimmedScore) / 100).toFixed(2);
    console.log(
      ` #${i + 1}  | ${entry.projectName.padEnd(18)} | ${entry.ipfsCID.padEnd(26)} | ${trimmedDisplay.padStart(13)} | ${entry.judgeCount}`
    );

    // Mint top 3 Winner NFTs
    if (i < 3) {
      await (await contract.connect(admin).mintWinnerNFT(entry.projectId, i + 1)).wait();
      console.log(`      🏆 Winner Certificate NFT (Rank #${i + 1}) minted for project ${entry.projectName}!`);
    }
  }

  console.log("\n========================================");
  console.log("  Advanced Seed Complete!");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n[ERROR]", error.message || error);
    process.exit(1);
  });
