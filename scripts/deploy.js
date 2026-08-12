/**
 * Deployment Script — HackathonJudging Contract
 * ==============================================
 * Usage:
 *   npx hardhat run scripts/deploy.js --network localhost
 *
 * What this script does:
 *   1. Compiles the HackathonJudging contract
 *   2. Deploys it to the target network
 *   3. Exports the contract address and ABI to the frontend
 *      so the React app can connect without manual configuration
 */

const { ethers } = require("hardhat");
const path = require("path");
const fs = require("fs");

async function main() {
  // Get the deployer account (first Hardhat account when running locally)
  const [deployer] = await ethers.getSigners();

  console.log("\n========================================");
  console.log("  HackathonJudging — Deployment Script");
  console.log("========================================");
  console.log(`\nDeployer address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} ETH`);

  // Deploy the contract
  console.log("\n> Deploying HackathonJudging...");
  const HackathonJudging = await ethers.getContractFactory("HackathonJudging");
  const contract = await HackathonJudging.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(`> Contract deployed at: ${contractAddress}`);

  // Export contract address and ABI to frontend directory
  const frontendContractsDir = path.join(
    __dirname,
    "..",
    "frontend",
    "src",
    "contracts"
  );

  // Create directory if it doesn't exist
  if (!fs.existsSync(frontendContractsDir)) {
    fs.mkdirSync(frontendContractsDir, { recursive: true });
  }

  // Write the contract address file
  const addressFile = path.join(frontendContractsDir, "contract-address.json");
  fs.writeFileSync(
    addressFile,
    JSON.stringify({ HackathonJudging: contractAddress }, null, 2)
  );
  console.log(`\n> Contract address exported to: ${addressFile}`);

  // Copy the ABI from Hardhat artifacts to the frontend
  const artifactPath = path.join(
    __dirname,
    "..",
    "artifacts",
    "contracts",
    "HackathonJudging.sol",
    "HackathonJudging.json"
  );

  const abiDestPath = path.join(frontendContractsDir, "HackathonJudging.json");

  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    // Only export the ABI (not the full artifact with bytecode)
    fs.writeFileSync(
      abiDestPath,
      JSON.stringify({ abi: artifact.abi }, null, 2)
    );
    console.log(`> Contract ABI exported to: ${abiDestPath}`);
  } else {
    console.warn(
      "> WARNING: Artifact not found. Run `npx hardhat compile` first."
    );
  }

  console.log("\n========================================");
  console.log("  Deployment Complete!");
  console.log("========================================");
  console.log(`\nContract Address: ${contractAddress}`);
  console.log(
    `\nNext step: Run the seed script to populate demo data:\n`
  );
  console.log(
    `  npx hardhat run scripts/seed.js --network localhost\n`
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
