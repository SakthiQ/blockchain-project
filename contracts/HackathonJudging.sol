// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IWinnerNFT {
    function mintCertificate(
        address recipient,
        uint256 rank,
        string calldata projectName,
        string calldata hackathonName
    ) external returns (uint256);
}

/**
 * @title HackathonJudging
 * @author Undergraduate Blockchain Project — Advanced Multi-Tier Judging System
 * @notice Smart contract for hackathon judging supporting Commit-Reveal blind scoring,
 *         Phase state-machine deadlines, Conflict-of-Interest recusal, Weighted rubrics,
 *         Trimmed-mean outlier detection, Append-only score versioning, 2-step admin transfer,
 *         gas-optimized storage caching, Soulbound winner NFT certificates,
 *         Minimum-Quorum Ranking (#14), Deterministic Tie-Breaking (#15),
 *         Appeal/Dispute Window (#18), and Team Self-Registration with Admin Approval (#23).
 */
contract HackathonJudging {

    // =========================================================
    //  ENUMS & CONSTANTS
    // =========================================================

    /// @notice Phase lifecycle state machine
    enum Phase { Setup, Judging, Revealing, Finalized }

    /// @notice Dispute lifecycle
    enum DisputeStatus { Pending, Resolved, Rejected }

    /// @notice Project application lifecycle
    enum ApplicationStatus { Pending, Approved, Rejected }

    uint8 public constant MAX_SCORE = 10;
    uint8 public constant CRITERIA_COUNT = 4;

    // =========================================================
    //  STATE VARIABLES
    // =========================================================

    address public admin;
    address public pendingAdmin;

    string public hackathonName;
    string public hackathonDescription;
    bool public hackathonActive; // Legacy compatibility

    Phase public currentPhase;
    uint256 public judgingDeadline;
    uint256 public revealDeadline;

    uint8[4] public criteriaWeights; // Default: [25, 25, 25, 25] (sums to 100)

    uint256 public projectCount;
    uint256 public judgeCount;

    address public winnerNFTContract;

    /// @notice #14 — Minimum judges required for a project to enter the ranked (non-provisional) bracket
    uint256 public minJudgesForRanking;

    /// @notice #18 — Dispute counters
    uint256 public disputeCount;
    uint256 public pendingDisputeCount;

    /// @notice #23 — Application counter
    uint256 public applicationCount;

    // =========================================================
    //  DATA STRUCTURES
    // =========================================================

    struct Project {
        uint256 id;
        string name;
        string description;
        string teamLead;
        string category;
        string ipfsCID;
        address teamWallet;
        bool isRegistered;
        uint256 totalRawScore;
        uint256 judgeCount;
        uint256 minScore;
        uint256 maxScore;
        /// @notice #15 — earliest timestamp any judge first submitted a score for this project
        uint256 firstScoreTimestamp;
    }

    struct Judge {
        address wallet;
        string name;
        bool isAuthorized;
        bool isRegistered;
    }

    struct ScoreSubmission {
        uint256 projectId;
        address judgeAddress;
        uint8 technicalQuality;
        uint8 innovation;
        uint8 userExperience;
        uint8 impact;
        uint256 totalScore; // Weighted score (0–1000)
        uint256 timestamp;
        bool exists;
        uint256 version;
    }

    struct LeaderboardEntry {
        uint256 projectId;
        string projectName;
        string teamLead;
        string category;
        string ipfsCID;
        uint256 averageScore;   // Average * 100
        uint256 trimmedScore;   // Trimmed Mean * 100 (drops highest & lowest if >=3 judges)
        uint256 judgeCount;
        uint256 totalScore;
        bool quorumMet;         // #14 — true when judgeCount >= minJudgesForRanking
    }

    /// @notice #18 — On-chain appeal/dispute raised by any project team or participant
    struct Dispute {
        uint256 disputeId;
        uint256 projectId;
        address raisedBy;
        string reason;
        DisputeStatus status;
        uint256 timestamp;
    }

    /// @notice #23 — Team self-registration application awaiting admin approval
    struct ProjectApplication {
        uint256 applicationId;
        string name;
        string description;
        string teamLead;
        string category;
        string ipfsCID;
        address applicantWallet;
        ApplicationStatus status;
        uint256 timestamp;
    }

    // =========================================================
    //  MAPPINGS & ARRAYS
    // =========================================================

    mapping(uint256 => Project) public projects;
    mapping(address => Judge) public judges;
    address[] public judgeAddresses;

    /// @notice judgeHasScored[judgeAddress][projectId] = true if revealed/submitted
    mapping(address => mapping(uint256 => bool)) public judgeHasScored;

    /// @notice Commit-reveal hashes: scoreCommits[judge][projectId] = keccak256(...)
    mapping(address => mapping(uint256 => bytes32)) public scoreCommits;
    mapping(address => mapping(uint256 => bool)) public judgeHasCommitted;

    /// @notice Conflict of interest mapping: judgeConflicts[judge][projectId] = true
    mapping(address => mapping(uint256 => bool)) public judgeConflicts;

    /// @notice Active score submission
    mapping(address => mapping(uint256 => ScoreSubmission)) public scoreSubmissions;

    /// @notice Append-only score versioning history
    mapping(address => mapping(uint256 => ScoreSubmission[])) public scoreHistory;

    /// @notice Cached array of scores per project for fast trimmed mean calculation
    mapping(uint256 => uint256[]) private projectScores;

    /// @notice #18 — All disputes indexed by disputeId
    mapping(uint256 => Dispute) public disputes;

    /// @notice #18 — All dispute IDs raised against a project
    mapping(uint256 => uint256[]) public projectDisputeIds;

    /// @notice #23 — All project applications indexed by applicationId
    mapping(uint256 => ProjectApplication) public projectApplications;

    // =========================================================
    //  EVENTS
    // =========================================================

    event HackathonConfigured(string name, string description, address indexed configuredBy, uint256 timestamp);
    event PhaseAdvanced(Phase newPhase, uint256 timestamp);
    event DeadlinesUpdated(uint256 judgingDeadline, uint256 revealDeadline);
    event CriteriaWeightsUpdated(uint8[4] weights);
    event MinJudgesForRankingUpdated(uint256 minJudges);
    event JudgeConflictSet(address indexed judge, uint256 indexed projectId, bool hasConflict);
    event ProjectRegistered(uint256 indexed projectId, string name, string teamLead, string category, string ipfsCID, address indexed registeredBy, uint256 timestamp);
    event JudgeStatusChanged(address indexed judgeAddress, string judgeName, bool isAuthorized, address indexed changedBy, uint256 timestamp);
    event ScoreCommitted(uint256 indexed projectId, address indexed judgeAddress, bytes32 scoreHash, uint256 timestamp);
    event ScoreSubmitted(uint256 indexed projectId, address indexed judgeAddress, uint8 technicalQuality, uint8 innovation, uint8 userExperience, uint8 impact, uint256 totalScore, uint256 version, uint256 timestamp);
    event AdminTransferProposed(address indexed currentAdmin, address indexed proposedAdmin);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event WinnerNFTContractSet(address indexed nftContract);
    event WinnerNFTMinted(uint256 indexed projectId, uint256 indexed tokenId, uint256 rank, address recipient);

    // #18 — Dispute events
    event DisputeRaised(uint256 indexed disputeId, uint256 indexed projectId, address indexed raisedBy, string reason, uint256 timestamp);
    event DisputeResolved(uint256 indexed disputeId, uint256 indexed projectId, DisputeStatus status, address indexed resolvedBy);

    // #23 — Application events
    event ProjectApplicationSubmitted(uint256 indexed applicationId, string name, string teamLead, address indexed applicantWallet, uint256 timestamp);
    event ProjectApplicationDecided(uint256 indexed applicationId, ApplicationStatus status, address indexed decidedBy, uint256 registeredProjectId);

    // =========================================================
    //  MODIFIERS
    // =========================================================

    modifier onlyAdmin() {
        require(msg.sender == admin, "HackathonJudging: caller is not the admin");
        _;
    }

    modifier onlyAuthorizedJudge() {
        require(judges[msg.sender].isRegistered, "HackathonJudging: caller is not a registered judge");
        require(judges[msg.sender].isAuthorized, "HackathonJudging: caller authorization revoked");
        _;
    }

    modifier inPhase(Phase _expected) {
        require(currentPhase == _expected, "HackathonJudging: invalid phase for action");
        _;
    }

    modifier noConflict(uint256 _projectId) {
        require(!judgeConflicts[msg.sender][_projectId], "HackathonJudging: judge recused due to conflict of interest");
        _;
    }

    // =========================================================
    //  CONSTRUCTOR
    // =========================================================

    constructor() {
        admin = msg.sender;
        hackathonActive = true;
        currentPhase = Phase.Setup;
        criteriaWeights = [25, 25, 25, 25]; // Default equal weighting (100% total)
        minJudgesForRanking = 2;             // #14 — default quorum: at least 2 judges
    }

    // =========================================================
    //  ADMIN & GOVERNANCE FUNCTIONS
    // =========================================================

    function configureHackathon(
        string calldata _name,
        string calldata _description,
        bool _active
    ) external onlyAdmin {
        require(bytes(_name).length > 0, "HackathonJudging: name cannot be empty");
        require(bytes(_description).length > 0, "HackathonJudging: description cannot be empty");

        hackathonName = _name;
        hackathonDescription = _description;
        hackathonActive = _active;

        emit HackathonConfigured(_name, _description, msg.sender, block.timestamp);
    }

    /**
     * @notice Advance the hackathon lifecycle phase.
     * @dev    #18 — Transition to Finalized is blocked if any disputes remain Pending.
     */
    function setPhase(Phase _newPhase) external onlyAdmin {
        if (_newPhase == Phase.Finalized) {
            require(
                pendingDisputeCount == 0,
                "HackathonJudging: cannot finalize while disputes are pending"
            );
        }
        currentPhase = _newPhase;
        emit PhaseAdvanced(_newPhase, block.timestamp);
    }

    function setDeadlines(uint256 _judgingDeadline, uint256 _revealDeadline) external onlyAdmin {
        require(_revealDeadline >= _judgingDeadline, "HackathonJudging: reveal deadline must be after judging deadline");
        judgingDeadline = _judgingDeadline;
        revealDeadline = _revealDeadline;
        emit DeadlinesUpdated(_judgingDeadline, _revealDeadline);
    }

    function setCriteriaWeights(uint8[4] calldata _weights) external onlyAdmin {
        require(
            uint256(_weights[0]) + uint256(_weights[1]) + uint256(_weights[2]) + uint256(_weights[3]) == 100,
            "HackathonJudging: criteria weights must sum to 100"
        );
        criteriaWeights = _weights;
        emit CriteriaWeightsUpdated(_weights);
    }

    /// @notice #14 — Admin sets the minimum judge count required for a project to be ranked (not provisional)
    function setMinJudgesForRanking(uint256 _minJudges) external onlyAdmin {
        require(_minJudges >= 1, "HackathonJudging: minJudgesForRanking must be at least 1");
        minJudgesForRanking = _minJudges;
        emit MinJudgesForRankingUpdated(_minJudges);
    }

    function setJudgeConflict(address _judge, uint256 _projectId, bool _hasConflict) external onlyAdmin {
        require(projects[_projectId].isRegistered, "HackathonJudging: project does not exist");
        require(judges[_judge].isRegistered, "HackathonJudging: judge not registered");
        judgeConflicts[_judge][_projectId] = _hasConflict;
        emit JudgeConflictSet(_judge, _projectId, _hasConflict);
    }

    function setWinnerNFTContract(address _nftContract) external onlyAdmin {
        require(_nftContract != address(0), "HackathonJudging: invalid NFT address");
        winnerNFTContract = _nftContract;
        emit WinnerNFTContractSet(_nftContract);
    }

    // 2-Step Admin Transfer
    function proposeNewAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "HackathonJudging: invalid admin address");
        require(_newAdmin != admin, "HackathonJudging: already admin");
        pendingAdmin = _newAdmin;
        emit AdminTransferProposed(admin, _newAdmin);
    }

    function acceptAdmin() external {
        require(msg.sender == pendingAdmin, "HackathonJudging: caller is not pending admin");
        emit AdminTransferred(admin, pendingAdmin);
        admin = pendingAdmin;
        pendingAdmin = address(0);
    }

    // =========================================================
    //  PROJECT & JUDGE REGISTRATION
    // =========================================================

    function registerProject(
        string calldata _name,
        string calldata _description,
        string calldata _teamLead,
        string calldata _category
    ) external onlyAdmin {
        _registerProjectInternal(_name, _description, _teamLead, _category, "", msg.sender);
    }

    function registerProjectWithDetails(
        string calldata _name,
        string calldata _description,
        string calldata _teamLead,
        string calldata _category,
        string calldata _ipfsCID,
        address _teamWallet
    ) external onlyAdmin {
        _registerProjectInternal(_name, _description, _teamLead, _category, _ipfsCID, _teamWallet);
    }

    function _registerProjectInternal(
        string memory _name,
        string memory _description,
        string memory _teamLead,
        string memory _category,
        string memory _ipfsCID,
        address _teamWallet
    ) internal {
        require(bytes(_name).length > 0, "HackathonJudging: project name cannot be empty");
        require(bytes(_teamLead).length > 0, "HackathonJudging: team lead cannot be empty");

        projectCount++;
        uint256 newProjectId = projectCount;

        projects[newProjectId] = Project({
            id: newProjectId,
            name: _name,
            description: _description,
            teamLead: _teamLead,
            category: _category,
            ipfsCID: _ipfsCID,
            teamWallet: _teamWallet,
            isRegistered: true,
            totalRawScore: 0,
            judgeCount: 0,
            minScore: type(uint256).max,
            maxScore: 0,
            firstScoreTimestamp: 0 // #15 — filled on first score submission
        });

        emit ProjectRegistered(newProjectId, _name, _teamLead, _category, _ipfsCID, msg.sender, block.timestamp);
    }

    function registerJudge(address _judgeAddress, string calldata _name) external onlyAdmin {
        require(_judgeAddress != address(0), "HackathonJudging: invalid judge address");
        require(bytes(_name).length > 0, "HackathonJudging: judge name cannot be empty");
        require(!judges[_judgeAddress].isRegistered, "HackathonJudging: judge already registered");
        require(_judgeAddress != admin, "HackathonJudging: admin cannot be registered as a judge");

        judges[_judgeAddress] = Judge({
            wallet: _judgeAddress,
            name: _name,
            isAuthorized: true,
            isRegistered: true
        });

        judgeAddresses.push(_judgeAddress);
        judgeCount++;

        emit JudgeStatusChanged(_judgeAddress, _name, true, msg.sender, block.timestamp);
    }

    function revokeJudge(address _judgeAddress) external onlyAdmin {
        require(judges[_judgeAddress].isRegistered, "HackathonJudging: judge not registered");
        require(judges[_judgeAddress].isAuthorized, "HackathonJudging: judge already revoked");

        judges[_judgeAddress].isAuthorized = false;
        emit JudgeStatusChanged(_judgeAddress, judges[_judgeAddress].name, false, msg.sender, block.timestamp);
    }

    function reauthorizeJudge(address _judgeAddress) external onlyAdmin {
        require(judges[_judgeAddress].isRegistered, "HackathonJudging: judge not registered");
        require(!judges[_judgeAddress].isAuthorized, "HackathonJudging: judge already authorized");

        judges[_judgeAddress].isAuthorized = true;
        emit JudgeStatusChanged(_judgeAddress, judges[_judgeAddress].name, true, msg.sender, block.timestamp);
    }

    // =========================================================
    //  JUDGING: COMMIT & REVEAL
    // =========================================================

    /**
     * @notice Phase 1 of Blind Scoring: Judge submits keccak256(projectId, scores..., salt)
     */
    function commitScore(uint256 _projectId, bytes32 _scoreHash) external onlyAuthorizedJudge noConflict(_projectId) {
        require(
            currentPhase == Phase.Judging || (judgingDeadline > 0 && block.timestamp < judgingDeadline),
            "HackathonJudging: commit score is only allowed during Judging phase"
        );
        require(projects[_projectId].isRegistered, "HackathonJudging: project does not exist");
        require(_scoreHash != bytes32(0), "HackathonJudging: empty score hash");

        scoreCommits[msg.sender][_projectId] = _scoreHash;
        judgeHasCommitted[msg.sender][_projectId] = true;

        emit ScoreCommitted(_projectId, msg.sender, _scoreHash, block.timestamp);
    }

    /**
     * @notice Phase 2 of Blind Scoring: Judge reveals scores with salt
     */
    function revealScore(
        uint256 _projectId,
        uint8 _technicalQuality,
        uint8 _innovation,
        uint8 _userExperience,
        uint8 _impact,
        bytes32 _salt
    ) external onlyAuthorizedJudge noConflict(_projectId) {
        require(
            currentPhase == Phase.Revealing || (revealDeadline > 0 && block.timestamp >= judgingDeadline && block.timestamp < revealDeadline),
            "HackathonJudging: reveal score is only allowed during Revealing phase"
        );
        require(projects[_projectId].isRegistered, "HackathonJudging: project does not exist");
        require(judgeHasCommitted[msg.sender][_projectId], "HackathonJudging: no commit hash found for judge");

        bytes32 expectedHash = keccak256(
            abi.encodePacked(_projectId, _technicalQuality, _innovation, _userExperience, _impact, _salt)
        );
        require(scoreCommits[msg.sender][_projectId] == expectedHash, "HackathonJudging: commit hash mismatch or invalid salt");

        _recordScoreSubmission(_projectId, _technicalQuality, _innovation, _userExperience, _impact);
    }

    /**
     * @notice Legacy / Direct score submission (allowed in Judging phase if commit-reveal skipped or in Setup/Judging fallback)
     */
    function submitScore(
        uint256 _projectId,
        uint8 _technicalQuality,
        uint8 _innovation,
        uint8 _userExperience,
        uint8 _impact
    ) external onlyAuthorizedJudge noConflict(_projectId) {
        require(
            currentPhase == Phase.Judging || currentPhase == Phase.Setup,
            "HackathonJudging: direct submission only allowed in Setup/Judging phase"
        );
        require(projects[_projectId].isRegistered, "HackathonJudging: project does not exist");
        require(!judgeHasScored[msg.sender][_projectId], "HackathonJudging: judge has already scored this project");

        _recordScoreSubmission(_projectId, _technicalQuality, _innovation, _userExperience, _impact);
    }

    function _recordScoreSubmission(
        uint256 _projectId,
        uint8 _technicalQuality,
        uint8 _innovation,
        uint8 _userExperience,
        uint8 _impact
    ) internal {
        require(_technicalQuality <= MAX_SCORE, "HackathonJudging: technicalQuality out of range");
        require(_innovation <= MAX_SCORE, "HackathonJudging: innovation out of range");
        require(_userExperience <= MAX_SCORE, "HackathonJudging: userExperience out of range");
        require(_impact <= MAX_SCORE, "HackathonJudging: impact out of range");

        // Calculate weighted score (0–1000)
        uint256 totalScore = (
            uint256(_technicalQuality) * uint256(criteriaWeights[0]) +
            uint256(_innovation) * uint256(criteriaWeights[1]) +
            uint256(_userExperience) * uint256(criteriaWeights[2]) +
            uint256(_impact) * uint256(criteriaWeights[3])
        );

        bool isRevision = judgeHasScored[msg.sender][_projectId];
        judgeHasScored[msg.sender][_projectId] = true;

        ScoreSubmission[] storage history = scoreHistory[msg.sender][_projectId];
        uint256 newVersion = history.length + 1;

        ScoreSubmission memory sub = ScoreSubmission({
            projectId: _projectId,
            judgeAddress: msg.sender,
            technicalQuality: _technicalQuality,
            innovation: _innovation,
            userExperience: _userExperience,
            impact: _impact,
            totalScore: totalScore,
            timestamp: block.timestamp,
            exists: true,
            version: newVersion
        });

        scoreSubmissions[msg.sender][_projectId] = sub;
        history.push(sub);

        // Update cached statistics
        Project storage proj = projects[_projectId];
        if (!isRevision) {
            proj.judgeCount++;
            proj.totalRawScore += totalScore;
            projectScores[_projectId].push(totalScore);
            // #15 — record earliest first-score timestamp for tie-breaking
            if (proj.firstScoreTimestamp == 0) {
                proj.firstScoreTimestamp = block.timestamp;
            }
        } else {
            // Overwrite in projectScores for revision
            proj.totalRawScore = 0;
            delete projectScores[_projectId];
            for (uint256 i = 0; i < judgeAddresses.length; i++) {
                address jAddr = judgeAddresses[i];
                if (judgeHasScored[jAddr][_projectId]) {
                    uint256 s = scoreSubmissions[jAddr][_projectId].totalScore;
                    proj.totalRawScore += s;
                    projectScores[_projectId].push(s);
                }
            }
        }

        if (totalScore < proj.minScore) proj.minScore = totalScore;
        if (totalScore > proj.maxScore) proj.maxScore = totalScore;

        emit ScoreSubmitted(
            _projectId,
            msg.sender,
            _technicalQuality,
            _innovation,
            _userExperience,
            _impact,
            totalScore,
            newVersion,
            block.timestamp
        );
    }

    // =========================================================
    //  #18 — DISPUTE / APPEAL WINDOW
    // =========================================================

    /**
     * @notice Any address may raise a dispute against a project's score during Judging or Revealing.
     * @dev    Pending disputes block `setPhase(Finalized)` until resolved or rejected by admin.
     */
    function raiseDispute(uint256 _projectId, string calldata _reason) external {
        require(projects[_projectId].isRegistered, "HackathonJudging: project does not exist");
        require(
            currentPhase == Phase.Judging || currentPhase == Phase.Revealing,
            "HackathonJudging: disputes can only be raised during Judging or Revealing phase"
        );
        require(bytes(_reason).length > 0, "HackathonJudging: dispute reason cannot be empty");

        disputeCount++;
        uint256 newDisputeId = disputeCount;
        pendingDisputeCount++;

        disputes[newDisputeId] = Dispute({
            disputeId: newDisputeId,
            projectId: _projectId,
            raisedBy: msg.sender,
            reason: _reason,
            status: DisputeStatus.Pending,
            timestamp: block.timestamp
        });

        projectDisputeIds[_projectId].push(newDisputeId);

        emit DisputeRaised(newDisputeId, _projectId, msg.sender, _reason, block.timestamp);
    }

    /**
     * @notice Admin resolves a pending dispute. approve=true marks it Resolved; false marks it Rejected.
     */
    function resolveDispute(uint256 _disputeId, bool _approve) external onlyAdmin {
        Dispute storage d = disputes[_disputeId];
        require(d.disputeId != 0, "HackathonJudging: dispute does not exist");
        require(d.status == DisputeStatus.Pending, "HackathonJudging: dispute already resolved");

        d.status = _approve ? DisputeStatus.Resolved : DisputeStatus.Rejected;
        pendingDisputeCount--;

        emit DisputeResolved(_disputeId, d.projectId, d.status, msg.sender);
    }

    /**
     * @notice Returns all dispute IDs for a given project.
     */
    function getProjectDisputes(uint256 _projectId) external view returns (uint256[] memory) {
        return projectDisputeIds[_projectId];
    }

    // =========================================================
    //  #23 — TEAM SELF-REGISTRATION WITH ADMIN APPROVAL
    // =========================================================

    /**
     * @notice Any team can submit a project application for admin review.
     *         The project is NOT registered until admin calls approveProjectApplication().
     */
    function submitProjectApplication(
        string calldata _name,
        string calldata _description,
        string calldata _teamLead,
        string calldata _category,
        string calldata _ipfsCID
    ) external {
        require(
            currentPhase == Phase.Setup,
            "HackathonJudging: applications only accepted during Setup phase"
        );
        require(bytes(_name).length > 0, "HackathonJudging: project name cannot be empty");
        require(bytes(_teamLead).length > 0, "HackathonJudging: team lead cannot be empty");

        applicationCount++;
        uint256 newAppId = applicationCount;

        projectApplications[newAppId] = ProjectApplication({
            applicationId: newAppId,
            name: _name,
            description: _description,
            teamLead: _teamLead,
            category: _category,
            ipfsCID: _ipfsCID,
            applicantWallet: msg.sender,
            status: ApplicationStatus.Pending,
            timestamp: block.timestamp
        });

        emit ProjectApplicationSubmitted(newAppId, _name, _teamLead, msg.sender, block.timestamp);
    }

    /**
     * @notice Admin approves a pending application, automatically registering the project on-chain.
     */
    function approveProjectApplication(uint256 _applicationId) external onlyAdmin {
        ProjectApplication storage app = projectApplications[_applicationId];
        require(app.applicationId != 0, "HackathonJudging: application does not exist");
        require(app.status == ApplicationStatus.Pending, "HackathonJudging: application already decided");

        app.status = ApplicationStatus.Approved;

        // Auto-register the project
        _registerProjectInternal(
            app.name,
            app.description,
            app.teamLead,
            app.category,
            app.ipfsCID,
            app.applicantWallet
        );

        emit ProjectApplicationDecided(_applicationId, ApplicationStatus.Approved, msg.sender, projectCount);
    }

    /**
     * @notice Admin rejects a pending application.
     */
    function rejectProjectApplication(uint256 _applicationId) external onlyAdmin {
        ProjectApplication storage app = projectApplications[_applicationId];
        require(app.applicationId != 0, "HackathonJudging: application does not exist");
        require(app.status == ApplicationStatus.Pending, "HackathonJudging: application already decided");

        app.status = ApplicationStatus.Rejected;

        emit ProjectApplicationDecided(_applicationId, ApplicationStatus.Rejected, msg.sender, 0);
    }

    // =========================================================
    //  SOULBOUND NFT WINNER ISSUANCE
    // =========================================================

    /**
     * @notice Mints a Soulbound Certificate NFT for a top-3 winning project once hackathon is Finalized
     */
    function mintWinnerNFT(uint256 _projectId, uint256 _rank) external inPhase(Phase.Finalized) {
        require(winnerNFTContract != address(0), "HackathonJudging: Winner NFT contract not set");
        require(projects[_projectId].isRegistered, "HackathonJudging: project does not exist");
        require(_rank >= 1 && _rank <= 3, "HackathonJudging: rank must be 1, 2, or 3");

        address recipient = projects[_projectId].teamWallet;
        if (recipient == address(0)) {
            recipient = admin;
        }

        uint256 tokenId = IWinnerNFT(winnerNFTContract).mintCertificate(
            recipient,
            _rank,
            projects[_projectId].name,
            hackathonName
        );

        emit WinnerNFTMinted(_projectId, tokenId, _rank, recipient);
    }

    // =========================================================
    //  VIEW FUNCTIONS — READ ON-CHAIN DATA
    // =========================================================

    function getScore(address _judgeAddress, uint256 _projectId) external view returns (ScoreSubmission memory) {
        return scoreSubmissions[_judgeAddress][_projectId];
    }

    function getScoreHistory(address _judgeAddress, uint256 _projectId) external view returns (ScoreSubmission[] memory) {
        return scoreHistory[_judgeAddress][_projectId];
    }

    /**
     * @notice Returns aggregate score data for a project including Trimmed Mean
     */
    function getProjectAggregateScore(uint256 _projectId)
        public
        view
        returns (
            uint256 judgesWhoScored,
            uint256 totalRawScore,
            uint256 averageScore,
            uint256 trimmedScore
        )
    {
        require(projects[_projectId].isRegistered, "HackathonJudging: project does not exist");

        uint256[] memory scores = projectScores[_projectId];
        judgesWhoScored = scores.length;
        totalRawScore = 0;

        if (judgesWhoScored == 0) {
            return (0, 0, 0, 0);
        }

        uint256 minVal = type(uint256).max;
        uint256 maxVal = 0;

        for (uint256 i = 0; i < judgesWhoScored; i++) {
            uint256 s = scores[i];
            totalRawScore += s;
            if (s < minVal) minVal = s;
            if (s > maxVal) maxVal = s;
        }

        averageScore = (totalRawScore * 100) / judgesWhoScored;

        // Trimmed mean: if >= 3 judges, drop highest & lowest scores
        if (judgesWhoScored >= 3) {
            uint256 trimmedTotal = totalRawScore - minVal - maxVal;
            trimmedScore = (trimmedTotal * 100) / (judgesWhoScored - 2);
        } else {
            trimmedScore = averageScore;
        }
    }

    /**
     * @notice #14 #15 — Returns the full leaderboard with quorum-aware, deterministically tie-broken sort.
     *
     * Sort cascade (descending priority):
     *   1. quorumMet (true first — quorum-met projects ranked above provisional)
     *   2. trimmedScore (higher score first)
     *   3. averageScore (higher average first)
     *   4. judgeCount (more evaluations first — shows confidence)
     *   5. projectId (lower id first — deterministic, insertion-order stable)
     */
    function getLeaderboard() external view returns (LeaderboardEntry[] memory entries) {
        entries = new LeaderboardEntry[](projectCount);

        for (uint256 i = 1; i <= projectCount; i++) {
            Project storage proj = projects[i];
            (
                uint256 judgesWhoScored,
                uint256 totalRawScore,
                uint256 averageScore,
                uint256 trimmedScore
            ) = getProjectAggregateScore(i);

            entries[i - 1] = LeaderboardEntry({
                projectId: i,
                projectName: proj.name,
                teamLead: proj.teamLead,
                category: proj.category,
                ipfsCID: proj.ipfsCID,
                averageScore: averageScore,
                trimmedScore: trimmedScore,
                judgeCount: judgesWhoScored,
                totalScore: totalRawScore,
                quorumMet: judgesWhoScored >= minJudgesForRanking  // #14
            });
        }

        // #15 — Deterministic 5-tier tie-breaking bubble sort
        uint256 n = entries.length;
        for (uint256 i = 0; i < n; i++) {
            for (uint256 j = 0; j < n - 1 - i; j++) {
                if (_shouldSwap(entries[j], entries[j + 1])) {
                    LeaderboardEntry memory temp = entries[j];
                    entries[j] = entries[j + 1];
                    entries[j + 1] = temp;
                }
            }
        }
    }

    /**
     * @notice #15 — Returns true if entry `b` should rank above entry `a`.
     *
     * Cascade:
     *   Tier 1: quorumMet (b has quorum, a does not)
     *   Tier 2: trimmedScore (b > a)
     *   Tier 3: averageScore (b > a, on trimmed tie)
     *   Tier 4: judgeCount (b > a, on average tie)
     *   Tier 5: projectId (b < a, lower id wins — deterministic)
     */
    function _shouldSwap(LeaderboardEntry memory a, LeaderboardEntry memory b)
        internal
        pure
        returns (bool)
    {
        // Tier 1: quorum status — quorum-met always ranks above provisional
        if (a.quorumMet != b.quorumMet) {
            return b.quorumMet; // swap if b has quorum and a doesn't
        }
        // Tier 2: trimmed score (higher wins)
        if (a.trimmedScore != b.trimmedScore) {
            return b.trimmedScore > a.trimmedScore;
        }
        // Tier 3: average score (higher wins)
        if (a.averageScore != b.averageScore) {
            return b.averageScore > a.averageScore;
        }
        // Tier 4: judge count (more evaluations = more confidence)
        if (a.judgeCount != b.judgeCount) {
            return b.judgeCount > a.judgeCount;
        }
        // Tier 5: projectId (lower id first — deterministic)
        return b.projectId < a.projectId;
    }

    function getAllProjects() external view returns (uint256[] memory ids, string[] memory names) {
        ids = new uint256[](projectCount);
        names = new string[](projectCount);
        for (uint256 i = 0; i < projectCount; i++) {
            ids[i] = projects[i + 1].id;
            names[i] = projects[i + 1].name;
        }
    }

    function getAllJudgeAddresses() external view returns (address[] memory) {
        return judgeAddresses;
    }

    function isAuthorizedJudge(address _address) external view returns (bool) {
        return judges[_address].isRegistered && judges[_address].isAuthorized;
    }

    function getHackathonInfo()
        external
        view
        returns (
            string memory name,
            string memory description,
            bool active,
            Phase phase,
            uint256 numProjects,
            uint256 numJudges,
            address adminAddress
        )
    {
        return (
            hackathonName,
            hackathonDescription,
            hackathonActive,
            currentPhase,
            projectCount,
            judgeCount,
            admin
        );
    }

    /// @notice Returns all pending project applications (for admin review dashboard)
    function getPendingApplicationsCount() external view returns (uint256 count) {
        for (uint256 i = 1; i <= applicationCount; i++) {
            if (projectApplications[i].status == ApplicationStatus.Pending) {
                count++;
            }
        }
    }
}
