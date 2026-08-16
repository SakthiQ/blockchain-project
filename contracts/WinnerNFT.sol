// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title WinnerNFT
 * @notice Soulbound (non-transferable) ERC-721 Certificate NFT for top hackathon winners.
 * @dev Dynamic SVG metadata is generated directly on-chain using Base64 encoding.
 */
contract WinnerNFT is ERC721, Ownable {
    using Strings for uint256;

    struct Certificate {
        uint256 tokenId;
        uint256 rank; // 1 = 1st Place, 2 = 2nd Place, 3 = 3rd Place
        string projectName;
        string hackathonName;
        uint256 issueTimestamp;
    }

    uint256 private _nextTokenId;
    mapping(uint256 => Certificate) public certificates;

    event CertificateMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 rank,
        string projectName
    );

    constructor(address initialOwner) ERC721("HackathonWinnerCertificate", "HWCRT") Ownable(initialOwner) {}

    function mintCertificate(
        address recipient,
        uint256 rank,
        string calldata projectName,
        string calldata hackathonName
    ) external onlyOwner returns (uint256) {
        require(recipient != address(0), "WinnerNFT: invalid recipient");
        require(rank >= 1 && rank <= 3, "WinnerNFT: rank must be 1, 2, or 3");

        _nextTokenId++;
        uint256 tokenId = _nextTokenId;

        _safeMint(recipient, tokenId);

        certificates[tokenId] = Certificate({
            tokenId: tokenId,
            rank: rank,
            projectName: projectName,
            hackathonName: hackathonName,
            issueTimestamp: block.timestamp
        });

        emit CertificateMinted(tokenId, recipient, rank, projectName);

        return tokenId;
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert("WinnerNFT: Soulbound token - certificates cannot be transferred");
        }
        return super._update(to, tokenId, auth);
    }

    function _getRankDetails(uint256 rank) internal pure returns (string memory rankText, string memory badgeColor) {
        if (rank == 1) {
            return ("1st Place - Winner", "#FFD700");
        } else if (rank == 2) {
            return ("2nd Place - Runner Up", "#C0C0C0");
        } else {
            return ("3rd Place - Finalist", "#CD7F32");
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        Certificate memory cert = certificates[tokenId];
        (string memory rankText, string memory badgeColor) = _getRankDetails(cert.rank);

        bytes memory headerSvg = abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">',
            '<rect width="600" height="400" rx="16" fill="#0f172a"/>',
            '<rect x="20" y="20" width="560" height="360" rx="12" fill="none" stroke="', badgeColor, '" stroke-width="3"/>',
            '<text x="300" y="70" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="', badgeColor, '" text-anchor="middle">OFFICIAL WINNER CERTIFICATE</text>',
            '<text x="300" y="110" font-family="Arial, sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">', cert.hackathonName, '</text>'
        );

        bytes memory bodySvg = abi.encodePacked(
            '<circle cx="300" cy="180" r="45" fill="', badgeColor, '" opacity="0.2"/>',
            '<circle cx="300" cy="180" r="35" fill="none" stroke="', badgeColor, '" stroke-width="2"/>',
            '<text x="300" y="188" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="', badgeColor, '" text-anchor="middle">#', cert.rank.toString(), '</text>',
            '<text x="300" y="260" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#f8fafc" text-anchor="middle">', cert.projectName, '</text>',
            '<text x="300" y="295" font-family="Arial, sans-serif" font-size="16" fill="', badgeColor, '" text-anchor="middle">', rankText, '</text>',
            '</svg>'
        );

        string memory fullSvg = string(abi.encodePacked(headerSvg, bodySvg));

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "', cert.projectName, ' - ', rankText, '", ',
                        '"description": "Soulbound certificate awarded for performance in ', cert.hackathonName, '", ',
                        '"attributes": [{"trait_type": "Rank", "value": ', cert.rank.toString(), '}], ',
                        '"image": "data:image/svg+xml;base64,', Base64.encode(bytes(fullSvg)), '"}'
                    )
                )
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", json));
    }
}
