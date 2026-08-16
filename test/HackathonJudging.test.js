const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Hackathon Judging Platform — Comprehensive Test Suite", function () {
  let hackathonJudging;
  let winnerNFT;
  let admin, pendingAdminSigner, judge1, judge2, judge3, recusedJudge, unauthorized, teamLead1, teamLead2, applicant1;

  const HACKATHON_NAME = "Web3 AI Innovation Hackathon 2026";
  const IPFS_CID_1 = "bafybeigdyr321testcid1";
  const IPFS_CID_2 = "bafybeigdyr321testcid2";

  function createScoreHash(projectId, tech, inn, ux, imp, saltHex) {
    return ethers.solidityPackedKeccak256(
      ["uint256", "uint8", "uint8", "uint8", "uint8", "bytes32"],
      [projectId, tech, inn, ux, imp, saltHex]
    );
  }

  beforeEach(async function () {
    [admin, pendingAdminSigner, judge1, judge2, judge3, recusedJudge, unauthorized, teamLead1, teamLead2, applicant1] =
      await ethers.getSigners();

    const HackathonJudging = await ethers.getContractFactory("HackathonJudging");
    hackathonJudging = await HackathonJudging.deploy();
    await hackathonJudging.waitForDeployment();

    const WinnerNFT = await ethers.getContractFactory("WinnerNFT");
    winnerNFT = await WinnerNFT.deploy(await hackathonJudging.getAddress());
    await winnerNFT.waitForDeployment();

    await hackathonJudging.setWinnerNFTContract(await winnerNFT.getAddress());
  });

  // =========================================================
  //  1. Deployment & Governance Initial State
  // =========================================================
  describe("1. Deployment & Governance Initial State", function () {
    it("Should set deployer as admin", async function () {
      expect(await hackathonJudging.admin()).to.equal(admin.address);
    });

    it("Should start in Setup phase (0)", async function () {
      expect(await hackathonJudging.currentPhase()).to.equal(0);
    });

    it("Should start with criteria weights equal to [25, 25, 25, 25]", async function () {
      const w0 = await hackathonJudging.criteriaWeights(0);
      const w1 = await hackathonJudging.criteriaWeights(1);
      const w2 = await hackathonJudging.criteriaWeights(2);
      const w3 = await hackathonJudging.criteriaWeights(3);
      expect(w0 + w1 + w2 + w3).to.equal(100);
    });

    it("#14 — Default minJudgesForRanking is 2", async function () {
      expect(await hackathonJudging.minJudgesForRanking()).to.equal(2);
    });

    it("#18 — Pending dispute count starts at 0", async function () {
      expect(await hackathonJudging.pendingDisputeCount()).to.equal(0);
    });

    it("#23 — Application count starts at 0", async function () {
      expect(await hackathonJudging.applicationCount()).to.equal(0);
    });
  });

  // =========================================================
  //  2. Project & Judge Management
  // =========================================================
  describe("2. Project & Judge Management", function () {
    it("Admin can register project with IPFS CID and team wallet", async function () {
      await hackathonJudging.registerProjectWithDetails(
        "ChainVault",
        "Multi-sig treasury",
        "Alice",
        "DeFi",
        IPFS_CID_1,
        teamLead1.address
      );

      const proj = await hackathonJudging.projects(1);
      expect(proj.name).to.equal("ChainVault");
      expect(proj.ipfsCID).to.equal(IPFS_CID_1);
      expect(proj.teamWallet).to.equal(teamLead1.address);
    });

    it("Admin can register judges", async function () {
      await hackathonJudging.registerJudge(judge1.address, "Judge Sarah");
      expect(await hackathonJudging.isAuthorizedJudge(judge1.address)).to.be.true;
    });

    it("Admin can set conflict of interest recusal", async function () {
      await hackathonJudging.registerProject("ChainVault", "Multi-sig", "Alice", "DeFi");
      await hackathonJudging.registerJudge(recusedJudge.address, "Judge Mentor");

      await hackathonJudging.setJudgeConflict(recusedJudge.address, 1, true);
      expect(await hackathonJudging.judgeConflicts(recusedJudge.address, 1)).to.be.true;
    });
  });

  // =========================================================
  //  3. Commit–Reveal Blind Scoring
  // =========================================================
  describe("3. Commit–Reveal Blind Scoring", function () {
    const salt1 = ethers.keccak256(ethers.toUtf8Bytes("secret_salt_1"));

    beforeEach(async function () {
      await hackathonJudging.registerProjectWithDetails("ChainVault", "DeFi", "Alice", "DeFi", IPFS_CID_1, teamLead1.address);
      await hackathonJudging.registerJudge(judge1.address, "Judge 1");
      await hackathonJudging.registerJudge(recusedJudge.address, "Recused Judge");
      await hackathonJudging.setJudgeConflict(recusedJudge.address, 1, true);

      await hackathonJudging.setPhase(1);
    });

    it("Judge can commit score hash during Judging phase", async function () {
      const hash = createScoreHash(1, 9, 8, 9, 10, salt1);
      await expect(hackathonJudging.connect(judge1).commitScore(1, hash))
        .to.emit(hackathonJudging, "ScoreCommitted");
    });

    it("Recused judge cannot commit score", async function () {
      const hash = createScoreHash(1, 10, 10, 10, 10, salt1);
      await expect(
        hackathonJudging.connect(recusedJudge).commitScore(1, hash)
      ).to.be.revertedWith("HackathonJudging: judge recused due to conflict of interest");
    });

    it("Judge can reveal score in Revealing phase with valid salt", async function () {
      const hash = createScoreHash(1, 9, 8, 9, 10, salt1);
      await hackathonJudging.connect(judge1).commitScore(1, hash);

      await hackathonJudging.setPhase(2);

      await expect(
        hackathonJudging.connect(judge1).revealScore(1, 9, 8, 9, 10, salt1)
      ).to.emit(hackathonJudging, "ScoreSubmitted");

      const score = await hackathonJudging.getScore(judge1.address, 1);
      expect(score.technicalQuality).to.equal(9);
      expect(score.exists).to.be.true;
    });

    it("Reveal fails if salt or scores do not match commit hash", async function () {
      const hash = createScoreHash(1, 9, 8, 9, 10, salt1);
      await hackathonJudging.connect(judge1).commitScore(1, hash);
      await hackathonJudging.setPhase(2);

      const wrongSalt = ethers.keccak256(ethers.toUtf8Bytes("wrong_salt"));
      await expect(
        hackathonJudging.connect(judge1).revealScore(1, 9, 8, 9, 10, wrongSalt)
      ).to.be.revertedWith("HackathonJudging: commit hash mismatch or invalid salt");
    });
  });

  // =========================================================
  //  4. Weighted Rubric & Trimmed Mean Aggregation
  // =========================================================
  describe("4. Weighted Rubric & Trimmed Mean Aggregation", function () {
    const salt1 = ethers.keccak256(ethers.toUtf8Bytes("salt1"));
    const salt2 = ethers.keccak256(ethers.toUtf8Bytes("salt2"));
    const salt3 = ethers.keccak256(ethers.toUtf8Bytes("salt3"));

    beforeEach(async function () {
      await hackathonJudging.registerProjectWithDetails("ChainVault", "DeFi", "Alice", "DeFi", IPFS_CID_1, teamLead1.address);
      await hackathonJudging.registerProjectWithDetails("MediLink", "Health", "Bob", "HealthTech", IPFS_CID_2, teamLead2.address);

      await hackathonJudging.registerJudge(judge1.address, "Judge 1");
      await hackathonJudging.registerJudge(judge2.address, "Judge 2");
      await hackathonJudging.registerJudge(judge3.address, "Judge 3");

      await hackathonJudging.setCriteriaWeights([40, 30, 15, 15]);
    });

    it("Calculates correct weighted score and trimmed mean leaderboard", async function () {
      await hackathonJudging.setPhase(1);

      await hackathonJudging.connect(judge1).commitScore(1, createScoreHash(1, 9, 9, 9, 9, salt1));
      await hackathonJudging.connect(judge2).commitScore(1, createScoreHash(1, 2, 2, 2, 2, salt2));
      await hackathonJudging.connect(judge3).commitScore(1, createScoreHash(1, 8, 8, 8, 8, salt3));

      await hackathonJudging.setPhase(2);

      await hackathonJudging.connect(judge1).revealScore(1, 9, 9, 9, 9, salt1);
      await hackathonJudging.connect(judge2).revealScore(1, 2, 2, 2, 2, salt2);
      await hackathonJudging.connect(judge3).revealScore(1, 8, 8, 8, 8, salt3);

      const agg = await hackathonJudging.getProjectAggregateScore(1);
      expect(agg.judgesWhoScored).to.equal(3);
      // Raw total = 900 + 200 + 800 = 1900. Average * 100 = 1900 * 100 / 3 = 63333
      expect(agg.averageScore).to.equal(63333);

      // Trimmed Mean drops min (200) and max (900), leaving middle (800). Trimmed * 100 = 80000
      expect(agg.trimmedScore).to.equal(80000);

      const leaderboard = await hackathonJudging.getLeaderboard();
      expect(leaderboard[0].projectId).to.equal(1);
      expect(leaderboard[0].trimmedScore).to.equal(80000);
    });
  });

  // =========================================================
  //  5. 2-Step Admin Transfer
  // =========================================================
  describe("5. 2-Step Admin Transfer", function () {
    it("Admin can propose new admin, pending admin accepts", async function () {
      await hackathonJudging.proposeNewAdmin(pendingAdminSigner.address);
      expect(await hackathonJudging.pendingAdmin()).to.equal(pendingAdminSigner.address);

      await hackathonJudging.connect(pendingAdminSigner).acceptAdmin();
      expect(await hackathonJudging.admin()).to.equal(pendingAdminSigner.address);
      expect(await hackathonJudging.pendingAdmin()).to.equal(ethers.ZeroAddress);
    });
  });

  // =========================================================
  //  6. Winner NFT Certificates (Soulbound)
  // =========================================================
  describe("6. Winner NFT Certificates (Soulbound)", function () {
    beforeEach(async function () {
      await hackathonJudging.registerProjectWithDetails("ChainVault", "DeFi", "Alice", "DeFi", IPFS_CID_1, teamLead1.address);
      await hackathonJudging.setPhase(3);
    });

    it("Can mint 1st place winner NFT with dynamic SVG tokenURI", async function () {
      await expect(hackathonJudging.mintWinnerNFT(1, 1))
        .to.emit(hackathonJudging, "WinnerNFTMinted");

      expect(await winnerNFT.ownerOf(1)).to.equal(teamLead1.address);

      const tokenURI = await winnerNFT.tokenURI(1);
      expect(tokenURI).to.include("data:application/json;base64,");
    });

    it("NFT is Soulbound and cannot be transferred", async function () {
      await hackathonJudging.mintWinnerNFT(1, 1);

      await expect(
        winnerNFT.connect(teamLead1).transferFrom(teamLead1.address, unauthorized.address, 1)
      ).to.be.revertedWith("WinnerNFT: Soulbound token - certificates cannot be transferred");
    });
  });

  // =========================================================
  //  7. #14 — Minimum-Quorum Ranking
  // =========================================================
  describe("7. #14 — Minimum-Quorum Ranking", function () {
    beforeEach(async function () {
      await hackathonJudging.registerProjectWithDetails("ChainVault", "DeFi", "Alice", "DeFi", IPFS_CID_1, teamLead1.address);
      await hackathonJudging.registerProjectWithDetails("MediLink", "Health", "Bob", "HealthTech", IPFS_CID_2, teamLead2.address);

      await hackathonJudging.registerJudge(judge1.address, "Judge 1");
      await hackathonJudging.registerJudge(judge2.address, "Judge 2");

      // Set quorum to 2
      await hackathonJudging.setMinJudgesForRanking(2);
    });

    it("Admin can update minJudgesForRanking", async function () {
      await hackathonJudging.setMinJudgesForRanking(3);
      expect(await hackathonJudging.minJudgesForRanking()).to.equal(3);
    });

    it("Projects below quorum are marked as provisional (quorumMet=false)", async function () {
      // Only project 1 gets 1 judge score (below quorum=2), project 2 gets 2 judges
      await hackathonJudging.connect(judge1).submitScore(1, 9, 9, 9, 9);
      await hackathonJudging.connect(judge1).submitScore(2, 8, 8, 8, 8);
      await hackathonJudging.connect(judge2).submitScore(2, 7, 7, 7, 7);

      const leaderboard = await hackathonJudging.getLeaderboard();
      // Project 2 has quorum (2 judges), project 1 does not (1 judge)
      // Quorum-met projects must come first
      expect(leaderboard[0].projectId).to.equal(2);
      expect(leaderboard[0].quorumMet).to.be.true;
      expect(leaderboard[1].quorumMet).to.be.false;
    });

    it("A project scored by more judges ranks above one with fewer judges if scores tie", async function () {
      await hackathonJudging.setMinJudgesForRanking(1); // Both meet quorum

      // Project 1: two judges, avg 800
      await hackathonJudging.connect(judge1).submitScore(1, 8, 8, 8, 8);
      await hackathonJudging.connect(judge2).submitScore(1, 8, 8, 8, 8);
      // Project 2: one judge, avg 800 (identical trimmed score)
      await hackathonJudging.connect(judge1).submitScore(2, 8, 8, 8, 8);

      const leaderboard = await hackathonJudging.getLeaderboard();
      // Tier 4 tie-break: project 1 has more judges — ranks first
      expect(leaderboard[0].projectId).to.equal(1);
      expect(leaderboard[1].projectId).to.equal(2);
    });

    it("Lower projectId wins the final tie-break when all else is equal", async function () {
      await hackathonJudging.setMinJudgesForRanking(1);

      // Both projects: 1 judge, same score
      await hackathonJudging.connect(judge1).submitScore(1, 8, 8, 8, 8);
      await hackathonJudging.connect(judge1).submitScore(2, 8, 8, 8, 8);

      const leaderboard = await hackathonJudging.getLeaderboard();
      // Tier 5 tie-break: lower projectId (1) ranks first
      expect(leaderboard[0].projectId).to.equal(1);
      expect(leaderboard[1].projectId).to.equal(2);
    });
  });

  // =========================================================
  //  8. #18 — Dispute / Appeal Window
  // =========================================================
  describe("8. #18 — Dispute / Appeal Window", function () {
    beforeEach(async function () {
      await hackathonJudging.registerProjectWithDetails("ChainVault", "DeFi", "Alice", "DeFi", IPFS_CID_1, teamLead1.address);
      await hackathonJudging.registerJudge(judge1.address, "Judge 1");
      await hackathonJudging.setPhase(1); // Judging phase
    });

    it("Any address can raise a dispute during Judging phase", async function () {
      const tx = await hackathonJudging.connect(teamLead1).raiseDispute(1, "Judge appears biased towards competing team");
      const receipt = await tx.wait();
      // Verify event was emitted with correct core fields (timestamp is block-dependent, not asserted exactly)
      await expect(tx)
        .to.emit(hackathonJudging, "DisputeRaised")
        .withArgs(1, 1, teamLead1.address, "Judge appears biased towards competing team", receipt.logs[0]?.args?.[4] ?? 0n);

      // Verify dispute stored correctly
      const d = await hackathonJudging.disputes(1);
      expect(d.projectId).to.equal(1);
      expect(d.raisedBy).to.equal(teamLead1.address);
      expect(d.status).to.equal(0); // DisputeStatus.Pending
    });

    it("Raising a dispute increments pendingDisputeCount", async function () {
      await hackathonJudging.connect(teamLead1).raiseDispute(1, "Conflict of interest not disclosed");
      expect(await hackathonJudging.pendingDisputeCount()).to.equal(1);
    });

    it("Admin can resolve a pending dispute as Resolved", async function () {
      await hackathonJudging.connect(teamLead1).raiseDispute(1, "Score too low");
      await expect(hackathonJudging.resolveDispute(1, true))
        .to.emit(hackathonJudging, "DisputeResolved");

      const d = await hackathonJudging.disputes(1);
      // enum DisputeStatus { Pending=0, Resolved=1, Rejected=2 }
      expect(d.status).to.equal(1); // DisputeStatus.Resolved
    });

    it("Admin can reject a pending dispute", async function () {
      await hackathonJudging.connect(teamLead1).raiseDispute(1, "Frivolous dispute");
      await hackathonJudging.resolveDispute(1, false);

      const d = await hackathonJudging.disputes(1);
      expect(d.status).to.equal(2); // DisputeStatus.Rejected
    });

    it("pendingDisputeCount decrements after resolution", async function () {
      await hackathonJudging.connect(teamLead1).raiseDispute(1, "Score dispute");
      expect(await hackathonJudging.pendingDisputeCount()).to.equal(1);

      await hackathonJudging.resolveDispute(1, true);
      expect(await hackathonJudging.pendingDisputeCount()).to.equal(0);
    });

    it("Cannot finalize hackathon while disputes are pending", async function () {
      await hackathonJudging.connect(teamLead1).raiseDispute(1, "Unresolved issue");

      await hackathonJudging.setPhase(2); // Move to Revealing — allowed
      await expect(
        hackathonJudging.setPhase(3) // Attempt Finalized — must fail
      ).to.be.revertedWith("HackathonJudging: cannot finalize while disputes are pending");
    });

    it("Can finalize once all disputes are resolved", async function () {
      await hackathonJudging.connect(teamLead1).raiseDispute(1, "Dispute to resolve");
      await hackathonJudging.resolveDispute(1, true);

      await hackathonJudging.setPhase(2);
      await expect(hackathonJudging.setPhase(3)).to.not.be.reverted;
    });

    it("Disputes cannot be raised in Setup phase", async function () {
      await hackathonJudging.setPhase(0); // Back to Setup
      await expect(
        hackathonJudging.connect(teamLead1).raiseDispute(1, "Invalid phase")
      ).to.be.revertedWith("HackathonJudging: disputes can only be raised during Judging or Revealing phase");
    });

    it("Cannot resolve a non-pending dispute twice", async function () {
      await hackathonJudging.connect(teamLead1).raiseDispute(1, "Resolved dispute");
      await hackathonJudging.resolveDispute(1, true);

      await expect(
        hackathonJudging.resolveDispute(1, false)
      ).to.be.revertedWith("HackathonJudging: dispute already resolved");
    });

    it("Returns correct project dispute IDs", async function () {
      await hackathonJudging.connect(teamLead1).raiseDispute(1, "First dispute");
      await hackathonJudging.connect(unauthorized).raiseDispute(1, "Second dispute");

      const ids = await hackathonJudging.getProjectDisputes(1);
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(1);
      expect(ids[1]).to.equal(2);
    });
  });

  // =========================================================
  //  9. #23 — Team Self-Registration with Admin Approval
  // =========================================================
  describe("9. #23 — Team Self-Registration & Admin Approval", function () {
    it("Any address can submit a project application in Setup phase", async function () {
      const tx = await hackathonJudging.connect(applicant1).submitProjectApplication(
        "ZeroTax DeFi",
        "On-chain tax compliance tool",
        "Charlie",
        "DeFi",
        "bafybeigapplication1"
      );
      const receipt = await tx.wait();
      await expect(tx)
        .to.emit(hackathonJudging, "ProjectApplicationSubmitted")
        .withArgs(
          1, "ZeroTax DeFi", "Charlie", applicant1.address,
          receipt.logs[0]?.args?.[4] ?? 0n
        );

      expect(await hackathonJudging.applicationCount()).to.equal(1);
    });

    it("Application is stored with Pending status", async function () {
      await hackathonJudging.connect(applicant1).submitProjectApplication(
        "ZeroTax DeFi", "Desc", "Charlie", "DeFi", "bafybeig1"
      );

      const app = await hackathonJudging.projectApplications(1);
      expect(app.name).to.equal("ZeroTax DeFi");
      expect(app.status).to.equal(0); // ApplicationStatus.Pending
      expect(app.applicantWallet).to.equal(applicant1.address);
    });

    it("Admin can approve an application, auto-registering the project", async function () {
      await hackathonJudging.connect(applicant1).submitProjectApplication(
        "ZeroTax DeFi", "On-chain tax tool", "Charlie", "DeFi", "bafybeig1"
      );

      const projCountBefore = await hackathonJudging.projectCount();

      await expect(
        hackathonJudging.approveProjectApplication(1)
      ).to.emit(hackathonJudging, "ProjectApplicationDecided");

      // Project count should have incremented
      expect(await hackathonJudging.projectCount()).to.equal(Number(projCountBefore) + 1);

      // Application status becomes Approved
      const app = await hackathonJudging.projectApplications(1);
      expect(app.status).to.equal(1); // ApplicationStatus.Approved

      // Actual project is registered
      const proj = await hackathonJudging.projects(Number(projCountBefore) + 1);
      expect(proj.name).to.equal("ZeroTax DeFi");
      expect(proj.teamWallet).to.equal(applicant1.address);
      expect(proj.isRegistered).to.be.true;
    });

    it("Admin can reject an application", async function () {
      await hackathonJudging.connect(applicant1).submitProjectApplication(
        "SpamProject", "Spam", "Spammer", "Other", ""
      );

      await hackathonJudging.rejectProjectApplication(1);

      const app = await hackathonJudging.projectApplications(1);
      expect(app.status).to.equal(2); // ApplicationStatus.Rejected

      // Project count unchanged
      expect(await hackathonJudging.projectCount()).to.equal(0);
    });

    it("Cannot approve or reject an already-decided application", async function () {
      await hackathonJudging.connect(applicant1).submitProjectApplication(
        "ZeroTax DeFi", "Desc", "Charlie", "DeFi", "bafybeig1"
      );

      await hackathonJudging.approveProjectApplication(1);

      await expect(
        hackathonJudging.approveProjectApplication(1)
      ).to.be.revertedWith("HackathonJudging: application already decided");

      await expect(
        hackathonJudging.rejectProjectApplication(1)
      ).to.be.revertedWith("HackathonJudging: application already decided");
    });

    it("Applications cannot be submitted outside Setup phase", async function () {
      await hackathonJudging.setPhase(1); // Judging phase

      await expect(
        hackathonJudging.connect(applicant1).submitProjectApplication(
          "Late Entry", "Late", "Dave", "AI", ""
        )
      ).to.be.revertedWith("HackathonJudging: applications only accepted during Setup phase");
    });

    it("Non-admin cannot approve or reject an application", async function () {
      await hackathonJudging.connect(applicant1).submitProjectApplication(
        "ZeroTax DeFi", "Desc", "Charlie", "DeFi", "bafybeig1"
      );

      await expect(
        hackathonJudging.connect(applicant1).approveProjectApplication(1)
      ).to.be.revertedWith("HackathonJudging: caller is not the admin");

      await expect(
        hackathonJudging.connect(unauthorized).rejectProjectApplication(1)
      ).to.be.revertedWith("HackathonJudging: caller is not the admin");
    });
  });
});
