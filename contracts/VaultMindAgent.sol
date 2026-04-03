// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VaultMindAgent — ERC-7857 iNFT for AI Agent Identity
 *
 * Implements core ERC-7857 concepts:
 *   - Encrypted metadata hashes (metadataHashes mapping)
 *   - Encrypted storage URIs pointing to 0G Storage
 *   - IntelligentData struct per the EIP-7857 spec
 *   - Oracle address for transfer proof verification
 *   - Dynamic metadata updates (agent learns across cycles)
 *   - Agent wallet binding (proxy wallet → token)
 *
 * Simplified for hackathon:
 *   - Oracle verification is stubbed (MockOracle always returns true)
 *   - Transfer re-encryption not implemented (standard ERC-721 transfer)
 *   - clone() and authorizeUsage() deferred to stretch
 *
 * Full spec: docs.0g.ai/developer-hub/building-on-0g/inft/erc7857
 * EIP draft: eips.ethereum.org/EIPS/eip-7857
 */

interface IOracle {
    function verifyProof(bytes calldata proof) external view returns (bool);
}

contract VaultMindAgent is ERC721, Ownable {
    // ── ERC-7857 IntelligentData struct ───────────────────────────
    struct IntelligentData {
        string dataDescription;
        bytes32 dataHash;
    }

    // ── State ─────────────────────────────────────────────────────

    uint256 private _nextTokenId = 1;

    // Oracle for transfer verification (ERC-7857 requirement)
    address public oracle;

    // tokenId → keccak256 of current 0G Storage root hash
    mapping(uint256 => bytes32) public metadataHashes;

    // tokenId → "0g-storage://{rootHash}" pointer to encrypted agent data
    mapping(uint256 => string) public encryptedURIs;

    // tokenId → proxy wallet address (agent's signing key)
    mapping(uint256 => address) public agentWallets;

    // tokenId → keccak256 of SOUL.md content (personality fingerprint)
    mapping(uint256 => bytes32) public soulHashes;

    // tokenId → risk profile ("conservative" / "balanced" / "aggressive")
    mapping(uint256 => string) public riskProfiles;

    // tokenId → total cycles completed (on-chain counter)
    mapping(uint256 => uint256) public cycleCount;

    // ── Reverse lookups ───────────────────────────────────────────

    // proxy wallet → tokenId
    mapping(address => uint256) public walletToToken;

    // ── Events ────────────────────────────────────────────────────

    event AgentMinted(
        uint256 indexed tokenId,
        address indexed owner,
        address agentWallet,
        bytes32 soulHash
    );

    event MetadataUpdated(
        uint256 indexed tokenId,
        bytes32 newMetadataHash,
        string newURI,
        uint256 newCycleCount
    );

    event RiskProfileChanged(uint256 indexed tokenId, string newProfile);

    // ── Constructor ───────────────────────────────────────────────

    constructor(
        address _oracle
    ) ERC721("VaultMind Agent", "VMAGENT") Ownable(msg.sender) {
        require(_oracle != address(0), "Oracle cannot be zero address");
        oracle = _oracle;
    }

    // ── ERC-7857: intelligentDataOf ───────────────────────────────

    function intelligentDataOf(
        uint256 tokenId
    ) external view returns (IntelligentData[] memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        IntelligentData[] memory data = new IntelligentData[](2);
        data[0] = IntelligentData("agent_memory", metadataHashes[tokenId]);
        data[1] = IntelligentData("agent_soul", soulHashes[tokenId]);
        return data;
    }

    // ── Mint — called once per user at onboarding ─────────────────

    function mintAgent(
        address to,
        address agentWallet,
        string calldata encryptedURI,
        bytes32 metadataHash,
        bytes32 soulHash,
        string calldata riskProfile
    ) external onlyOwner returns (uint256) {
        require(walletToToken[agentWallet] == 0, "Wallet already has agent");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        encryptedURIs[tokenId] = encryptedURI;
        metadataHashes[tokenId] = metadataHash;
        agentWallets[tokenId] = agentWallet;
        soulHashes[tokenId] = soulHash;
        riskProfiles[tokenId] = riskProfile;
        cycleCount[tokenId] = 0;
        walletToToken[agentWallet] = tokenId;

        emit AgentMinted(tokenId, to, agentWallet, soulHash);
        return tokenId;
    }

    // ── Update metadata — called after each cycle ─────────────────

    function updateMetadata(
        uint256 tokenId,
        bytes32 newMetadataHash,
        string calldata newURI
    ) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        metadataHashes[tokenId] = newMetadataHash;
        encryptedURIs[tokenId] = newURI;
        cycleCount[tokenId] += 1;

        emit MetadataUpdated(
            tokenId,
            newMetadataHash,
            newURI,
            cycleCount[tokenId]
        );
    }

    // ── Update risk profile ───────────────────────────────────────

    function updateRiskProfile(
        uint256 tokenId,
        string calldata newProfile
    ) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        riskProfiles[tokenId] = newProfile;
        emit RiskProfileChanged(tokenId, newProfile);
    }

    // ── Read: full agent info in one call ─────────────────────────

    function getAgent(
        uint256 tokenId
    )
        external
        view
        returns (
            address owner,
            address wallet,
            bytes32 metaHash,
            string memory uri,
            bytes32 soul,
            string memory risk,
            uint256 cycles
        )
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return (
            ownerOf(tokenId),
            agentWallets[tokenId],
            metadataHashes[tokenId],
            encryptedURIs[tokenId],
            soulHashes[tokenId],
            riskProfiles[tokenId],
            cycleCount[tokenId]
        );
    }

    // ── Lookup by proxy wallet ────────────────────────────────────

    function getAgentByWallet(address wallet) external view returns (uint256) {
        return walletToToken[wallet];
    }

    // ── Oracle getter ─────────────────────────────────────────────

    function getOracle() external view returns (address) {
        return oracle;
    }
}
