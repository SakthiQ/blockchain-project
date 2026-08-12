// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title HackathonJudging
 * @author Undergraduate Blockchain Project — Two-Student Team
 * @notice This smart contract manages a hackathon judging system where
 *         judges can submit immutable, transparent scores for registered
 *         projects. The blockchain ensures that:
 *         1. Judging records cannot be altered after submission
 *         2. Only authorized judges can submit scores
 *         3. A transparent leaderboard can be derived from on-chain data
 *         4. No central authority can manipulate results after submission
 *
 * @dev Architecture:
 *   - Admin Role: The contract deployer becomes the admin. Only admin
 *     can register judges, projects, and configure the hackathon.
 *   - Judge Role: Authorized judges can submit scores once per project.
 *   - Public: Anyone can read the leaderboard and judging records.
 *
 * Scoring Rubric (0–10 per criterion):
 *   1. Technical Quality  — How well-built is the technical solution?
 *   2. Innovation         — How original and creative is the project?
 *   3. User Experience    — How usable and polished is the interface?
 *   4. Impact             — What is the potential real-world impact?
 *
 * Aggregate Score = sum of all criteria averaged across all judges
 */
contract HackathonJudging {

    // =========================================================
    //  CONSTANTS
    // =========================================================

    /// @dev Maximum score for any single rubric criterion
    uint8 public constant MAX_SCORE = 10;

    /// @dev Number of rubric criteria (fixed for simplicity)
    uint8 public constant CRITERIA_COUNT = 4;

    // =========================================================
    //  STATE VARIABLES
    // =========================================================

    /// @notice The administrator of this hackathon contract
    address public admin;

    /// @notice Basic information about the hackathon
    string public hackathonName;
    string public hackathonDescription;
    bool public hackathonActive;

    /// @notice Total number of registered projects
    uint256 public projectCount;

    /// @notice Total number of registered judges
    uint256 public judgeCount;

    // =========================================================
    //  DATA STRUCTURES
    // =========================================================

    /**
     * @notice Represents a team/project participating in the hackathon
     * @dev projectId is a 1-based index (0 means "not found")
     */
    struct Project {
        uint256 id;           // Unique project ID (1-based)
        string name;          // Project name
        string description;   // Short description
        string teamLead;      // Team lead name
        string category;      // Project category (e.g., "DeFi", "AI", "Healthcare")
        bool isRegistered;    // Registration status guard
    }

    /**
     * @notice Represents a judge authorized to evaluate projects
     */
    struct Judge {
        address wallet;       // Judge's wallet address (used for authentication)
        string name;          // Judge's display name
        bool isAuthorized;    // Whether the judge can currently submit scores
        bool isRegistered;    // Whether the judge has been registered (cannot re-register)
    }

    /**
     * @notice Represents a single rubric-based score submission by a judge for a project
     * @dev All scoring data is stored immutably; scores cannot be updated after submission
     */
    struct ScoreSubmission {
        uint256 projectId;             // Which project is being scored
        address judgeAddress;          // Which judge submitted this score
        uint8 technicalQuality;        // Criterion 1: 0–10
        uint8 innovation;              // Criterion 2: 0–10
        uint8 userExperience;          // Criterion 3: 0–10
        uint8 impact;                  // Criterion 4: 0–10
        uint256 totalScore;            // Sum of all four criteria (0–40)
        uint256 timestamp;             // Block timestamp at submission
        bool exists;                   // Guard flag (false = no submission)
    }

    /**
     * @notice Leaderboard entry returned from getLeaderboard()
     */
    struct LeaderboardEntry {
        uint256 projectId;
        string projectName;
        string teamLead;
        string category;
        uint256 averageScore;   // Average total score * 100 to preserve 2 decimal places
        uint256 judgeCount;     // Number of judges who scored this project
        uint256 totalScore;     // Raw sum of all judge totalScores
    }

    // =========================================================
    //  MAPPINGS
    // =========================================================

    /// @notice Mapping from project ID to Project struct
    mapping(uint256 => Project) public projects;

    /// @notice Mapping from judge wallet address to Judge struct
    mapping(address => Judge) public judges;

    /// @notice judgeHasScored[judgeAddress][projectId] = true if submitted
    /// @dev Prevents duplicate score submissions — stored immutably on-chain
    mapping(address => mapping(uint256 => bool)) public judgeHasScored;

    /// @notice scoreSubmissions[judgeAddress][projectId] = ScoreSubmission
    mapping(address => mapping(uint256 => ScoreSubmission)) public scoreSubmissions;

    /// @notice All judge wallet addresses (for enumeration)
    address[] public judgeAddresses;

    // =========================================================
    //  EVENTS
    // =========================================================

    /**
     * @notice Emitted when the hackathon is created or updated
     */
    event HackathonConfigured(
        string name,
        string description,
        address indexed configuredBy,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a new project/team is registered
     */
    event ProjectRegistered(
        uint256 indexed projectId,
        string name,
        string teamLead,
        string category,
        address indexed registeredBy,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a judge's authorization status changes
     */
    event JudgeStatusChanged(
        address indexed judgeAddress,
        string judgeName,
        bool isAuthorized,
        address indexed changedBy,
        uint256 timestamp
    );

    /**
     * @notice Emitted when a judge successfully submits scores for a project
     * @dev This event provides a transparent, immutable record of every judging action.
     *      Anyone can verify the authenticity of results by querying past events.
     */
    event ScoreSubmitted(
        uint256 indexed projectId,
        address indexed judgeAddress,
        uint8 technicalQuality,
        uint8 innovation,
        uint8 userExperience,
        uint8 impact,
        uint256 totalScore,
        uint256 timestamp
    );

    // =========================================================
    //  MODIFIERS
    // =========================================================

    /**
     * @dev Restricts function access to the contract admin only.
     *      This implements basic Role-Based Access Control (RBAC).
     */
    modifier onlyAdmin() {
        require(msg.sender == admin, "HackathonJudging: caller is not the admin");
        _;
    }

    /**
     * @dev Restricts function access to currently authorized judges only.
     *      This ensures only verified judges can submit scores.
     */
    modifier onlyAuthorizedJudge() {
        require(
            judges[msg.sender].isRegistered,
            "HackathonJudging: caller is not a registered judge"
        );
        require(
            judges[msg.sender].isAuthorized,
            "HackathonJudging: caller's judge authorization has been revoked"
        );
        _;
    }

    /**
     * @dev Ensures the hackathon is in active state before certain operations
     */
    modifier hackathonIsActive() {
        require(hackathonActive, "HackathonJudging: hackathon is not active");
        _;
    }

    // =========================================================
    //  CONSTRUCTOR
    // =========================================================

    /**
     * @notice Deploys the contract and sets the deployer as admin
     * @dev The admin is the only account that can configure the hackathon,
     *      register judges, and register projects. This role cannot be transferred
     *      in this implementation for simplicity.
     */
    constructor() {
        admin = msg.sender;
    }

    // =========================================================
    //  ADMIN FUNCTIONS
    // =========================================================

    /**
     * @notice Configures or updates the hackathon details
     * @param _name        Display name of the hackathon
     * @param _description Short description of the hackathon
     * @param _active      Whether judging is currently open
     * @dev Only the admin can call this function.
     *      Emits a HackathonConfigured event for transparency.
     */
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
     * @notice Registers a new project/team in the hackathon
     * @param _name        Project name
     * @param _description Short project description
     * @param _teamLead    Name of the team lead
     * @param _category    Project category (e.g., "DeFi", "HealthTech")
     * @dev Only admin can register projects.
     *      Project IDs are auto-assigned starting from 1.
     */
    function registerProject(
        string calldata _name,
        string calldata _description,
        string calldata _teamLead,
        string calldata _category
    ) external onlyAdmin {
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
            isRegistered: true
        });

        emit ProjectRegistered(
            newProjectId,
            _name,
            _teamLead,
            _category,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Registers a judge and authorizes them to submit scores
     * @param _judgeAddress  Wallet address of the judge
     * @param _name          Display name of the judge
     * @dev A judge can only be registered once per address.
     *      After registration, they are immediately authorized.
     */
    function registerJudge(
        address _judgeAddress,
        string calldata _name
    ) external onlyAdmin {
        require(_judgeAddress != address(0), "HackathonJudging: invalid judge address");
        require(bytes(_name).length > 0, "HackathonJudging: judge name cannot be empty");
        require(
            !judges[_judgeAddress].isRegistered,
            "HackathonJudging: judge already registered"
        );
        require(
            _judgeAddress != admin,
            "HackathonJudging: admin cannot be registered as a judge"
        );

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

    /**
     * @notice Revokes a judge's authorization (they can no longer submit new scores)
     * @param _judgeAddress  Wallet address of the judge to revoke
     * @dev Previously submitted scores are NOT affected — immutability preserved.
     *      This only prevents future submissions.
     */
    function revokeJudge(address _judgeAddress) external onlyAdmin {
        require(
            judges[_judgeAddress].isRegistered,
            "HackathonJudging: judge not registered"
        );
        require(
            judges[_judgeAddress].isAuthorized,
            "HackathonJudging: judge already revoked"
        );

        judges[_judgeAddress].isAuthorized = false;

        emit JudgeStatusChanged(
            _judgeAddress,
            judges[_judgeAddress].name,
            false,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Re-authorizes a previously revoked judge
     * @param _judgeAddress  Wallet address of the judge to re-authorize
     */
    function reauthorizeJudge(address _judgeAddress) external onlyAdmin {
        require(
            judges[_judgeAddress].isRegistered,
            "HackathonJudging: judge not registered"
        );
        require(
            !judges[_judgeAddress].isAuthorized,
            "HackathonJudging: judge already authorized"
        );

        judges[_judgeAddress].isAuthorized = true;

        emit JudgeStatusChanged(
            _judgeAddress,
            judges[_judgeAddress].name,
            true,
            msg.sender,
            block.timestamp
        );
    }

    // =========================================================
    //  JUDGE FUNCTIONS
    // =========================================================

    /**
     * @notice Submits a rubric score for a project
     * @param _projectId          ID of the project being scored (1-based)
     * @param _technicalQuality   Score 0–10 for Technical Quality
     * @param _innovation         Score 0–10 for Innovation
     * @param _userExperience     Score 0–10 for User Experience
     * @param _impact             Score 0–10 for Impact
     *
     * @dev SECURITY: All validation is enforced ON-CHAIN.
     *      The frontend cannot bypass these checks because:
     *      1. Only the Ethereum transaction signer can call this
     *      2. Smart contract validation runs deterministically on all full nodes
     *      3. Invalid transactions are rejected and no state is written
     *
     *      IMMUTABILITY: Once a score is submitted, it is permanently recorded.
     *      There is no update or delete function — by design.
     *
     *      DUPLICATE PREVENTION: judgeHasScored mapping prevents a judge
     *      from scoring the same project twice, even if they try from a
     *      different frontend or directly via the blockchain.
     */
    function submitScore(
        uint256 _projectId,
        uint8 _technicalQuality,
        uint8 _innovation,
        uint8 _userExperience,
        uint8 _impact
    ) external onlyAuthorizedJudge hackathonIsActive {
        // --- VALIDATION ---
        // 1. Check project exists
        require(
            projects[_projectId].isRegistered,
            "HackathonJudging: project does not exist"
        );

        // 2. Check judge has not already scored this project
        require(
            !judgeHasScored[msg.sender][_projectId],
            "HackathonJudging: judge has already scored this project"
        );

        // 3. Validate each score is within the allowed range (0–10)
        require(_technicalQuality <= MAX_SCORE, "HackathonJudging: technicalQuality out of range");
        require(_innovation <= MAX_SCORE, "HackathonJudging: innovation out of range");
        require(_userExperience <= MAX_SCORE, "HackathonJudging: userExperience out of range");
        require(_impact <= MAX_SCORE, "HackathonJudging: impact out of range");

        // --- RECORD ---
        // Calculate total score (sum of all four criteria, max 40)
        uint256 totalScore = uint256(_technicalQuality) +
                             uint256(_innovation) +
                             uint256(_userExperience) +
                             uint256(_impact);

        // Mark this judge as having scored this project (prevents duplicates)
        judgeHasScored[msg.sender][_projectId] = true;

        // Store the immutable score submission on-chain
        scoreSubmissions[msg.sender][_projectId] = ScoreSubmission({
            projectId: _projectId,
            judgeAddress: msg.sender,
            technicalQuality: _technicalQuality,
            innovation: _innovation,
            userExperience: _userExperience,
            impact: _impact,
            totalScore: totalScore,
            timestamp: block.timestamp,
            exists: true
        });

        // Emit event — this creates a permanent, searchable log on the blockchain
        // that anyone can query to independently verify the judging records
        emit ScoreSubmitted(
            _projectId,
            msg.sender,
            _technicalQuality,
            _innovation,
            _userExperience,
            _impact,
            totalScore,
            block.timestamp
        );
    }

    // =========================================================
    //  VIEW FUNCTIONS — READ ON-CHAIN DATA
    // =========================================================

    /**
     * @notice Returns a project's detailed score breakdown from a specific judge
     * @param _judgeAddress  Address of the judge
     * @param _projectId     Project ID to query
     * @return The ScoreSubmission struct, or an empty struct if not found
     */
    function getScore(
        address _judgeAddress,
        uint256 _projectId
    ) external view returns (ScoreSubmission memory) {
        return scoreSubmissions[_judgeAddress][_projectId];
    }

    /**
     * @notice Returns aggregate score data for a single project
     * @param _projectId  Project to query
     * @return judgesWhoScored  Number of judges who scored this project
     * @return totalRawScore    Sum of all totalScores from all judges
     * @return averageScore     Average total score * 100 (2 decimal precision without floats)
     * @dev Solidity does not support floating point. We multiply by 100 to get 2 decimal places.
     *      e.g., averageScore = 3250 means an average of 32.50 out of 40
     */
    function getProjectAggregateScore(uint256 _projectId)
        public
        view
        returns (
            uint256 judgesWhoScored,
            uint256 totalRawScore,
            uint256 averageScore
        )
    {
        require(
            projects[_projectId].isRegistered,
            "HackathonJudging: project does not exist"
        );

        totalRawScore = 0;
        judgesWhoScored = 0;

        // Iterate over all registered judges and collect their scores for this project
        for (uint256 i = 0; i < judgeAddresses.length; i++) {
            address judgeAddr = judgeAddresses[i];
            if (judgeHasScored[judgeAddr][_projectId]) {
                totalRawScore += scoreSubmissions[judgeAddr][_projectId].totalScore;
                judgesWhoScored++;
            }
        }

        // Calculate average * 100 to preserve 2 decimal places
        // (avoid floating point — not supported in Solidity)
        if (judgesWhoScored > 0) {
            averageScore = (totalRawScore * 100) / judgesWhoScored;
        } else {
            averageScore = 0;
        }
    }

    /**
     * @notice Returns the full leaderboard sorted by average score (descending)
     * @return entries  Array of LeaderboardEntry structs, sorted highest score first
     * @dev Sorting is done in memory here since this is a view function (no gas for storage).
     *      For very large hackathons, consider off-chain sorting. This is appropriate
     *      for an undergraduate project with a small number of teams.
     */
    function getLeaderboard() external view returns (LeaderboardEntry[] memory entries) {
        entries = new LeaderboardEntry[](projectCount);

        // Populate leaderboard entries for all projects
        for (uint256 i = 1; i <= projectCount; i++) {
            Project storage proj = projects[i];
            (
                uint256 judgesWhoScored,
                uint256 totalRawScore,
                uint256 averageScore
            ) = getProjectAggregateScore(i);

            entries[i - 1] = LeaderboardEntry({
                projectId: i,
                projectName: proj.name,
                teamLead: proj.teamLead,
                category: proj.category,
                averageScore: averageScore,
                judgeCount: judgesWhoScored,
                totalScore: totalRawScore
            });
        }

        // Bubble sort by averageScore descending
        // Bubble sort is used here for simplicity and readability (appropriate for
        // small N typical in undergraduate hackathons, e.g., 10–30 projects).
        for (uint256 i = 0; i < entries.length; i++) {
            for (uint256 j = 0; j < entries.length - 1 - i; j++) {
                if (entries[j].averageScore < entries[j + 1].averageScore) {
                    LeaderboardEntry memory temp = entries[j];
                    entries[j] = entries[j + 1];
                    entries[j + 1] = temp;
                }
            }
        }
    }

    /**
     * @notice Returns all registered project IDs and names (for frontend enumeration)
     * @return ids    Array of project IDs
     * @return names  Array of corresponding project names
     */
    function getAllProjects()
        external
        view
        returns (uint256[] memory ids, string[] memory names)
    {
        ids = new uint256[](projectCount);
        names = new string[](projectCount);
        for (uint256 i = 0; i < projectCount; i++) {
            ids[i] = projects[i + 1].id;
            names[i] = projects[i + 1].name;
        }
    }

    /**
     * @notice Returns all registered judge addresses
     */
    function getAllJudgeAddresses() external view returns (address[] memory) {
        return judgeAddresses;
    }

    /**
     * @notice Checks whether a given address is an authorized judge
     * @param _address  The wallet address to check
     * @return True if the address belongs to an active authorized judge
     */
    function isAuthorizedJudge(address _address) external view returns (bool) {
        return judges[_address].isRegistered && judges[_address].isAuthorized;
    }

    /**
     * @notice Returns detailed information about the hackathon configuration
     */
    function getHackathonInfo()
        external
        view
        returns (
            string memory name,
            string memory description,
            bool active,
            uint256 numProjects,
            uint256 numJudges,
            address adminAddress
        )
    {
        return (
            hackathonName,
            hackathonDescription,
            hackathonActive,
            projectCount,
            judgeCount,
            admin
        );
    }
}
