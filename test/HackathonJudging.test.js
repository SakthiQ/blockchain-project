const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Comprehensive Test Suite for HackathonJudging Smart Contract
 * ============================================================
 * Tests cover:
 *   1. Contract deployment & initial state
 *   2. Hackathon configuration
 *   3. Project registration
 *   4. Judge registration & authorization
 *   5. Valid score submission & event emission
 *   6. Unauthorized score rejection
 *   7. Duplicate score rejection
 *   8. Out-of-range score rejection
 *   9. Score aggregation & leaderboard accuracy
 *  10. Edge cases & admin access control
 */
describe("HackathonJudging", function () {
  // Shared fixtures
  let hackathonJudging;
  let admin, judge1, judge2, judge3, unauthorized, accounts;

  // Sample test data
  const HACKATHON_NAME = "Web3 AI Innovation Hackathon 2026";
  const HACKATHON_DESC = "Showcasing the future of decentralized technology";

  const PROJECT_1 = {
    name: "ChainVault",
    description: "Decentralized multi-sig treasury management",
    teamLead: "Alice Johnson",
    category: "DeFi",
  };

  const PROJECT_2 = {
    name: "MediLink",
    description: "Blockchain-based patient records",
    teamLead: "Bob Singh",
    category: "HealthTech",
  };

  // Deploy fresh contract before each test
  beforeEach(async function () {
    [admin, judge1, judge2, judge3, unauthorized, ...accounts] =
      await ethers.getSigners();

    const HackathonJudging = await ethers.getContractFactory(
      "HackathonJudging"
    );
    hackathonJudging = await HackathonJudging.deploy();
    await hackathonJudging.waitForDeployment();
  });

  // ===========================================================
  //  1. DEPLOYMENT & INITIAL STATE
  // ===========================================================
  describe("Deployment", function () {
    it("Should set the deployer as admin", async function () {
      expect(await hackathonJudging.admin()).to.equal(admin.address);
    });

    it("Should start with zero projects and zero judges", async function () {
      expect(await hackathonJudging.projectCount()).to.equal(0);
      expect(await hackathonJudging.judgeCount()).to.equal(0);
    });

    it("Should start with hackathon inactive", async function () {
      expect(await hackathonJudging.hackathonActive()).to.equal(false);
    });

    it("Should expose correct MAX_SCORE constant", async function () {
      expect(await hackathonJudging.MAX_SCORE()).to.equal(10);
    });

    it("Should expose correct CRITERIA_COUNT constant", async function () {
      expect(await hackathonJudging.CRITERIA_COUNT()).to.equal(4);
    });
  });

  // ===========================================================
  //  2. HACKATHON CONFIGURATION
  // ===========================================================
  describe("Hackathon Configuration", function () {
    it("Admin can configure a hackathon", async function () {
      await hackathonJudging.configureHackathon(
        HACKATHON_NAME,
        HACKATHON_DESC,
        true
      );
      const info = await hackathonJudging.getHackathonInfo();
      expect(info.name).to.equal(HACKATHON_NAME);
      expect(info.description).to.equal(HACKATHON_DESC);
      expect(info.active).to.equal(true);
    });

    it("Should emit HackathonConfigured event", async function () {
      await expect(
        hackathonJudging.configureHackathon(HACKATHON_NAME, HACKATHON_DESC, true)
      )
        .to.emit(hackathonJudging, "HackathonConfigured")
        .withArgs(
          HACKATHON_NAME,
          HACKATHON_DESC,
          admin.address,
          // timestamp is block.timestamp — match any value
          (timestamp) => timestamp > 0
        );
    });

    it("Non-admin CANNOT configure the hackathon", async function () {
      await expect(
        hackathonJudging
          .connect(unauthorized)
          .configureHackathon(HACKATHON_NAME, HACKATHON_DESC, true)
      ).to.be.revertedWith("HackathonJudging: caller is not the admin");
    });

    it("Should reject empty hackathon name", async function () {
      await expect(
        hackathonJudging.configureHackathon("", HACKATHON_DESC, true)
      ).to.be.revertedWith("HackathonJudging: name cannot be empty");
    });

    it("Admin can toggle hackathon active/inactive", async function () {
      await hackathonJudging.configureHackathon(
        HACKATHON_NAME,
        HACKATHON_DESC,
        true
      );
      expect((await hackathonJudging.getHackathonInfo()).active).to.equal(true);

      await hackathonJudging.configureHackathon(
        HACKATHON_NAME,
        HACKATHON_DESC,
        false
      );
      expect((await hackathonJudging.getHackathonInfo()).active).to.equal(false);
    });
  });

  // ===========================================================
  //  3. PROJECT REGISTRATION
  // ===========================================================
  describe("Project Registration", function () {
    beforeEach(async function () {
      await hackathonJudging.configureHackathon(
        HACKATHON_NAME,
        HACKATHON_DESC,
        true
      );
    });

    it("Admin can register a project", async function () {
      await hackathonJudging.registerProject(
        PROJECT_1.name,
        PROJECT_1.description,
        PROJECT_1.teamLead,
        PROJECT_1.category
      );
      expect(await hackathonJudging.projectCount()).to.equal(1);

      const project = await hackathonJudging.projects(1);
      expect(project.name).to.equal(PROJECT_1.name);
      expect(project.teamLead).to.equal(PROJECT_1.teamLead);
      expect(project.category).to.equal(PROJECT_1.category);
      expect(project.isRegistered).to.equal(true);
    });

    it("Should emit ProjectRegistered event with correct ID", async function () {
      await expect(
        hackathonJudging.registerProject(
          PROJECT_1.name,
          PROJECT_1.description,
          PROJECT_1.teamLead,
          PROJECT_1.category
        )
      )
        .to.emit(hackathonJudging, "ProjectRegistered")
        .withArgs(
          1,
          PROJECT_1.name,
          PROJECT_1.teamLead,
          PROJECT_1.category,
          admin.address,
          (ts) => ts > 0
        );
    });

    it("Multiple projects receive sequential IDs", async function () {
      await hackathonJudging.registerProject(
        PROJECT_1.name,
        PROJECT_1.description,
        PROJECT_1.teamLead,
        PROJECT_1.category
      );
      await hackathonJudging.registerProject(
        PROJECT_2.name,
        PROJECT_2.description,
        PROJECT_2.teamLead,
        PROJECT_2.category
      );
      expect(await hackathonJudging.projectCount()).to.equal(2);
      const p1 = await hackathonJudging.projects(1);
      const p2 = await hackathonJudging.projects(2);
      expect(p1.id).to.equal(1);
      expect(p2.id).to.equal(2);
    });

    it("Non-admin CANNOT register a project", async function () {
      await expect(
        hackathonJudging
          .connect(unauthorized)
          .registerProject(
            PROJECT_1.name,
            PROJECT_1.description,
            PROJECT_1.teamLead,
            PROJECT_1.category
          )
      ).to.be.revertedWith("HackathonJudging: caller is not the admin");
    });

    it("Should reject empty project name", async function () {
      await expect(
        hackathonJudging.registerProject(
          "",
          PROJECT_1.description,
          PROJECT_1.teamLead,
          PROJECT_1.category
        )
      ).to.be.revertedWith("HackathonJudging: project name cannot be empty");
    });
  });

  // ===========================================================
  //  4. JUDGE REGISTRATION & AUTHORIZATION
  // ===========================================================
  describe("Judge Registration", function () {
    it("Admin can register a judge", async function () {
      await hackathonJudging.registerJudge(judge1.address, "Dr. Emily Chen");
      expect(await hackathonJudging.judgeCount()).to.equal(1);

      const judge = await hackathonJudging.judges(judge1.address);
      expect(judge.name).to.equal("Dr. Emily Chen");
      expect(judge.isAuthorized).to.equal(true);
      expect(judge.isRegistered).to.equal(true);
    });

    it("Should emit JudgeStatusChanged event on registration", async function () {
      await expect(
        hackathonJudging.registerJudge(judge1.address, "Dr. Emily Chen")
      )
        .to.emit(hackathonJudging, "JudgeStatusChanged")
        .withArgs(
          judge1.address,
          "Dr. Emily Chen",
          true,
          admin.address,
          (ts) => ts > 0
        );
    });

    it("Should report address as authorized judge after registration", async function () {
      await hackathonJudging.registerJudge(judge1.address, "Dr. Emily Chen");
      expect(await hackathonJudging.isAuthorizedJudge(judge1.address)).to.equal(
        true
      );
    });

    it("Unauthorized address is NOT an authorized judge", async function () {
      expect(
        await hackathonJudging.isAuthorizedJudge(unauthorized.address)
      ).to.equal(false);
    });

    it("Admin CANNOT register themselves as judge", async function () {
      await expect(
        hackathonJudging.registerJudge(admin.address, "Admin Judge")
      ).to.be.revertedWith(
        "HackathonJudging: admin cannot be registered as a judge"
      );
    });

    it("Cannot register the same judge address twice", async function () {
      await hackathonJudging.registerJudge(judge1.address, "Dr. Emily Chen");
      await expect(
        hackathonJudging.registerJudge(judge1.address, "Duplicate Judge")
      ).to.be.revertedWith("HackathonJudging: judge already registered");
    });

    it("Admin can revoke a judge", async function () {
      await hackathonJudging.registerJudge(judge1.address, "Dr. Emily Chen");
      await hackathonJudging.revokeJudge(judge1.address);

      const judge = await hackathonJudging.judges(judge1.address);
      expect(judge.isAuthorized).to.equal(false);
      expect(
        await hackathonJudging.isAuthorizedJudge(judge1.address)
      ).to.equal(false);
    });

    it("Admin can re-authorize a revoked judge", async function () {
      await hackathonJudging.registerJudge(judge1.address, "Dr. Emily Chen");
      await hackathonJudging.revokeJudge(judge1.address);
      await hackathonJudging.reauthorizeJudge(judge1.address);

      expect(
        await hackathonJudging.isAuthorizedJudge(judge1.address)
      ).to.equal(true);
    });

    it("Non-admin CANNOT register a judge", async function () {
      await expect(
        hackathonJudging
          .connect(unauthorized)
          .registerJudge(judge2.address, "Rogue Judge")
      ).to.be.revertedWith("HackathonJudging: caller is not the admin");
    });
  });

  // ===========================================================
  //  5. VALID SCORE SUBMISSION
  // ===========================================================
  describe("Score Submission — Valid", function () {
    beforeEach(async function () {
      // Setup: configure hackathon, register a project, register a judge
      await hackathonJudging.configureHackathon(
        HACKATHON_NAME,
        HACKATHON_DESC,
        true
      );
      await hackathonJudging.registerProject(
        PROJECT_1.name,
        PROJECT_1.description,
        PROJECT_1.teamLead,
        PROJECT_1.category
      );
      await hackathonJudging.registerJudge(judge1.address, "Dr. Emily Chen");
    });

    it("Authorized judge can submit a score", async function () {
      await hackathonJudging
        .connect(judge1)
        .submitScore(1, 8, 9, 7, 8);

      const submission = await hackathonJudging.getScore(judge1.address, 1);
      expect(submission.exists).to.equal(true);
      expect(submission.technicalQuality).to.equal(8);
      expect(submission.innovation).to.equal(9);
      expect(submission.userExperience).to.equal(7);
      expect(submission.impact).to.equal(8);
      expect(submission.totalScore).to.equal(32); // 8+9+7+8
    });

    it("Should mark judgeHasScored as true after submission", async function () {
      await hackathonJudging.connect(judge1).submitScore(1, 8, 9, 7, 8);
      expect(await hackathonJudging.judgeHasScored(judge1.address, 1)).to.equal(
        true
      );
    });

    it("Should emit ScoreSubmitted event with correct data", async function () {
      await expect(
        hackathonJudging.connect(judge1).submitScore(1, 8, 9, 7, 8)
      )
        .to.emit(hackathonJudging, "ScoreSubmitted")
        .withArgs(
          1,           // projectId
          judge1.address,
          8,           // technicalQuality
          9,           // innovation
          7,           // userExperience
          8,           // impact
          32,          // totalScore
          (ts) => ts > 0
        );
    });

    it("Should allow a judge to score multiple different projects", async function () {
      await hackathonJudging.registerProject(
        PROJECT_2.name,
        PROJECT_2.description,
        PROJECT_2.teamLead,
        PROJECT_2.category
      );

      await hackathonJudging.connect(judge1).submitScore(1, 8, 9, 7, 8);
      await hackathonJudging.connect(judge1).submitScore(2, 6, 7, 8, 9);

      const score1 = await hackathonJudging.getScore(judge1.address, 1);
      const score2 = await hackathonJudging.getScore(judge1.address, 2);
      expect(score1.totalScore).to.equal(32);
      expect(score2.totalScore).to.equal(30);
    });

    it("Should allow scores of 0 (valid minimum)", async function () {
      await hackathonJudging.connect(judge1).submitScore(1, 0, 0, 0, 0);
      const submission = await hackathonJudging.getScore(judge1.address, 1);
      expect(submission.totalScore).to.equal(0);
    });

    it("Should allow scores of 10 (valid maximum)", async function () {
      await hackathonJudging.connect(judge1).submitScore(1, 10, 10, 10, 10);
      const submission = await hackathonJudging.getScore(judge1.address, 1);
      expect(submission.totalScore).to.equal(40);
    });
  });

  // ===========================================================
  //  6. UNAUTHORIZED SCORE REJECTION
  // ===========================================================
  describe("Score Submission — Unauthorized Rejection", function () {
    beforeEach(async function () {
      await hackathonJudging.configureHackathon(
        HACKATHON_NAME,
        HACKATHON_DESC,
        true
      );
      await hackathonJudging.registerProject(
        PROJECT_1.name,
        PROJECT_1.description,
        PROJECT_1.teamLead,
        PROJECT_1.category
      );
    });

    it("Unregistered account CANNOT submit a score", async function () {
      await expect(
        hackathonJudging.connect(unauthorized).submitScore(1, 8, 9, 7, 8)
      ).to.be.revertedWith(
        "HackathonJudging: caller is not a registered judge"
      );
    });

    it("Revoked judge CANNOT submit a score", async function () {
      await hackathonJudging.registerJudge(judge1.address, "Dr. Emily Chen");
      await hackathonJudging.revokeJudge(judge1.address);

      await expect(
        hackathonJudging.connect(judge1).submitScore(1, 8, 9, 7, 8)
      ).to.be.revertedWith(
        "HackathonJudging: caller's judge authorization has been revoked"
      );
    });

    it("Score cannot be submitted when hackathon is inactive", async function () {
      await hackathonJudging.registerJudge(judge1.address, "Dr. Emily Chen");
      // Set hackathon to inactive
      await hackathonJudging.configureHackathon(
        HACKATHON_NAME,
        HACKATHON_DESC,
        false
      );

      await expect(
        hackathonJudging.connect(judge1).submitScore(1, 8, 9, 7, 8)
      ).to.be.revertedWith("HackathonJudging: hackathon is not active");
    });

    it("Admin themselves CANNOT submit a score (not a judge)", async function () {
      // Admin tries to submit directly (they are not registered as a judge)
      await expect(
        hackathonJudging.connect(admin).submitScore(1, 8, 9, 7, 8)
      ).to.be.revertedWith(
        "HackathonJudging: caller is not a registered judge"
      );
    });
  });

  // ===========================================================
  //  7. DUPLICATE SCORE REJECTION
  // ===========================================================
  describe("Score Submission — Duplicate Rejection", function () {
    beforeEach(async function () {
      await hackathonJudging.configureHackathon(
        HACKATHON_NAME,
        HACKATHON_DESC,
        true
      );
      await hackathonJudging.registerProject(
        PROJECT_1.name,
        PROJECT_1.description,
        PROJECT_1.teamLead,
        PROJECT_1.category
      );
      await hackathonJudging.registerJudge(judge1.address, "Dr. Emily Chen");
    });

    it("Judge CANNOT submit a second score for the same project", async function () {
      // First submission — should succeed
      await hackathonJudging.connect(judge1).submitScore(1, 8, 9, 7, 8);

      // Second submission for same project — should fail
      await expect(
        hackathonJudging.connect(judge1).submitScore(1, 5, 5, 5, 5)
      ).to.be.revertedWith(
        "HackathonJudging: judge has already scored this project"
      );
    });

    it("Original score should remain unchanged after duplicate attempt", async function () {
      await hackathonJudging.connect(judge1).submitScore(1, 8, 9, 7, 8);

      // Try (and fail) to overwrite
      await hackathonJudging
        .connect(judge1)
        .submitScore(1, 5, 5, 5, 5)
        .catch(() => {}); // Expected to fail

      // Verify original score is unchanged
      const score = await hackathonJudging.getScore(judge1.address, 1);
      expect(score.totalScore).to.equal(32);
    });
  });

  // ===========================================================
  //  8. OUT-OF-RANGE SCORE REJECTION
  // ===========================================================
  describe("Score Submission — Range Validation", function () {
    beforeEach(async function () {
      await hackathonJudging.configureHackathon(
        HACKATHON_NAME,
        HACKATHON_DESC,
        true
      );
      await hackathonJudging.registerProject(
        PROJECT_1.name,
        PROJECT_1.description,
        PROJECT_1.teamLead,
        PROJECT_1.category
      );
      await hackathonJudging.registerJudge(judge1.address, "Dr. Emily Chen");
    });

    it("Should reject technicalQuality > 10", async function () {
      await expect(
        hackathonJudging.connect(judge1).submitScore(1, 11, 5, 5, 5)
      ).to.be.revertedWith("HackathonJudging: technicalQuality out of range");
    });

    it("Should reject innovation > 10", async function () {
      await expect(
        hackathonJudging.connect(judge1).submitScore(1, 5, 11, 5, 5)
      ).to.be.revertedWith("HackathonJudging: innovation out of range");
    });

    it("Should reject userExperience > 10", async function () {
      await expect(
        hackathonJudging.connect(judge1).submitScore(1, 5, 5, 11, 5)
      ).to.be.revertedWith("HackathonJudging: userExperience out of range");
    });

    it("Should reject impact > 10", async function () {
      await expect(
        hackathonJudging.connect(judge1).submitScore(1, 5, 5, 5, 11)
      ).to.be.revertedWith("HackathonJudging: impact out of range");
    });

    it("Should reject score for non-existent project", async function () {
      await expect(
        hackathonJudging.connect(judge1).submitScore(999, 8, 9, 7, 8)
      ).to.be.revertedWith("HackathonJudging: project does not exist");
    });
  });

  // ===========================================================
  //  9. SCORE AGGREGATION & LEADERBOARD
  // ===========================================================
  describe("Score Aggregation & Leaderboard", function () {
    beforeEach(async function () {
      await hackathonJudging.configureHackathon(
        HACKATHON_NAME,
        HACKATHON_DESC,
        true
      );

      // Register 2 projects
      await hackathonJudging.registerProject(
        PROJECT_1.name,
        PROJECT_1.description,
        PROJECT_1.teamLead,
        PROJECT_1.category
      );
      await hackathonJudging.registerProject(
        PROJECT_2.name,
        PROJECT_2.description,
        PROJECT_2.teamLead,
        PROJECT_2.category
      );

      // Register 2 judges
      await hackathonJudging.registerJudge(judge1.address, "Dr. Emily Chen");
      await hackathonJudging.registerJudge(judge2.address, "Prof. Mark Lee");
    });

    it("Should correctly aggregate scores from multiple judges", async function () {
      // Project 1: judge1 scores 8+8+8+8=32, judge2 scores 6+6+6+6=24
      // Expected average = (32+24)/2 = 28 → averageScore = 2800 (*100)
      await hackathonJudging.connect(judge1).submitScore(1, 8, 8, 8, 8);
      await hackathonJudging.connect(judge2).submitScore(1, 6, 6, 6, 6);

      const [judgesWhoScored, totalRawScore, averageScore] =
        await hackathonJudging.getProjectAggregateScore(1);

      expect(judgesWhoScored).to.equal(2);
      expect(totalRawScore).to.equal(56); // 32 + 24
      expect(averageScore).to.equal(2800); // 28.00 * 100
    });

    it("Project with no scores should have averageScore of 0", async function () {
      const [judgesWhoScored, totalRawScore, averageScore] =
        await hackathonJudging.getProjectAggregateScore(1);

      expect(judgesWhoScored).to.equal(0);
      expect(totalRawScore).to.equal(0);
      expect(averageScore).to.equal(0);
    });

    it("Leaderboard should rank projects by average score (highest first)", async function () {
      // Project 1 gets lower scores
      await hackathonJudging.connect(judge1).submitScore(1, 5, 5, 5, 5); // total=20
      // Project 2 gets higher scores
      await hackathonJudging.connect(judge1).submitScore(2, 9, 9, 9, 9); // total=36

      const leaderboard = await hackathonJudging.getLeaderboard();

      // Project 2 should be ranked #1 (higher score)
      expect(leaderboard[0].projectId).to.equal(2);
      expect(leaderboard[0].projectName).to.equal(PROJECT_2.name);
      expect(leaderboard[1].projectId).to.equal(1);
    });

    it("Leaderboard should contain all registered projects", async function () {
      const leaderboard = await hackathonJudging.getLeaderboard();
      expect(leaderboard.length).to.equal(2);
    });

    it("getAllProjects should return all registered project IDs and names", async function () {
      const [ids, names] = await hackathonJudging.getAllProjects();
      expect(ids.length).to.equal(2);
      expect(names[0]).to.equal(PROJECT_1.name);
      expect(names[1]).to.equal(PROJECT_2.name);
    });

    it("getAllJudgeAddresses should return all registered judge addresses", async function () {
      const addresses = await hackathonJudging.getAllJudgeAddresses();
      expect(addresses.length).to.equal(2);
      expect(addresses).to.include(judge1.address);
      expect(addresses).to.include(judge2.address);
    });
  });

  // ===========================================================
  //  10. EDGE CASES
  // ===========================================================
  describe("Edge Cases", function () {
    it("getHackathonInfo returns correct admin address", async function () {
      await hackathonJudging.configureHackathon(
        HACKATHON_NAME,
        HACKATHON_DESC,
        true
      );
      const info = await hackathonJudging.getHackathonInfo();
      expect(info.adminAddress).to.equal(admin.address);
    });

    it("Should handle a single project with a single judge on the leaderboard", async function () {
      await hackathonJudging.configureHackathon(
        HACKATHON_NAME,
        HACKATHON_DESC,
        true
      );
      await hackathonJudging.registerProject(
        PROJECT_1.name,
        PROJECT_1.description,
        PROJECT_1.teamLead,
        PROJECT_1.category
      );
      await hackathonJudging.registerJudge(judge1.address, "Dr. Emily Chen");
      await hackathonJudging.connect(judge1).submitScore(1, 7, 8, 6, 9);

      const leaderboard = await hackathonJudging.getLeaderboard();
      expect(leaderboard.length).to.equal(1);
      expect(leaderboard[0].projectId).to.equal(1);
      expect(leaderboard[0].judgeCount).to.equal(1);
      expect(leaderboard[0].totalScore).to.equal(30);
    });

    it("Cannot revoke a judge that has not been registered", async function () {
      await expect(
        hackathonJudging.revokeJudge(unauthorized.address)
      ).to.be.revertedWith("HackathonJudging: judge not registered");
    });
  });
});
