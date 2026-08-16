const { ethers } = require("hardhat");
const path = require("path");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("\n========================================");
  console.log("  HackathonJudging & WinnerNFT Deploy");
  console.log("========================================");
  console.log(`Deployer address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} ETH`);

  // 1. Deploy HackathonJudging
  console.log("\n> Deploying HackathonJudging...");
  const HackathonJudging = await ethers.getContractFactory("HackathonJudging");
  const hackathonJudging = await HackathonJudging.deploy();
  await hackathonJudging.waitForDeployment();
  const hackathonJudgingAddress = await hackathonJudging.getAddress();
  console.log(`> HackathonJudging deployed at: ${hackathonJudgingAddress}`);

  // 2. Deploy WinnerNFT
  console.log("\n> Deploying WinnerNFT...");
  const WinnerNFT = await ethers.getContractFactory("WinnerNFT");
  const winnerNFT = await WinnerNFT.deploy(hackathonJudgingAddress);
  await winnerNFT.waitForDeployment();
  const winnerNFTAddress = await winnerNFT.getAddress();
  console.log(`> WinnerNFT deployed at: ${winnerNFTAddress}`);

  // 3. Link WinnerNFT in HackathonJudging
  console.log("\n> Linking WinnerNFT in HackathonJudging...");
  const tx = await hackathonJudging.setWinnerNFTContract(winnerNFTAddress);
  await tx.wait();
  console.log("> WinnerNFT linked successfully!");

  // 4. Export artifacts & addresses to frontend
  const frontendContractsDir = path.join(__dirname, "..", "frontend", "src", "contracts");
  if (!fs.existsSync(frontendContractsDir)) {
    fs.mkdirSync(frontendContractsDir, { recursive: true });
  }

  const addressFile = path.join(frontendContractsDir, "contract-address.json");
  fs.writeFileSync(
    addressFile,
    JSON.stringify(
      {
        HackathonJudging: hackathonJudgingAddress,
        WinnerNFT: winnerNFTAddress,
      },
      null,
      2
    )
  );
  console.log(`\n> Contract addresses exported to: ${addressFile}`);

  // Export HackathonJudging ABI
  const judgingArtifact = path.join(__dirname, "..", "artifacts", "contracts", "HackathonJudging.sol", "HackathonJudging.json");
  if (fs.existsSync(judgingArtifact)) {
    const artifact = JSON.parse(fs.readFileSync(judgingArtifact, "utf8"));
    fs.writeFileSync(path.join(frontendContractsDir, "HackathonJudging.json"), JSON.stringify({ abi: artifact.abi }, null, 2));
  }

  // Export WinnerNFT ABI
  const nftArtifact = path.join(__dirname, "..", "artifacts", "contracts", "WinnerNFT.sol", "WinnerNFT.json");
  if (fs.existsSync(nftArtifact)) {
    const artifact = JSON.parse(fs.readFileSync(nftArtifact, "utf8"));
    fs.writeFileSync(path.join(frontendContractsDir, "WinnerNFT.json"), JSON.stringify({ abi: artifact.abi }, null, 2));
  }

  console.log("\n========================================");
  console.log("  Deployment Complete!");
  console.log("========================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
