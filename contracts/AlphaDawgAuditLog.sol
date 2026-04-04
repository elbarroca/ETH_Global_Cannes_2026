// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AlphaDawgAuditLog — Multichain Event Emitter for Naryo
 *
 * Deployed on Hedera Testnet EVM (Smart Contracts Service).
 * Emits Solidity events that Naryo captures and broadcasts to the
 * AlphaDawg backend, enabling multichain event correlation between
 * Hedera and 0G Chain.
 *
 * Events cover: hunt cycles, specialist hiring, deposits, heartbeats,
 * and cross-chain correlation proofs.
 *
 * Separate from VaultMindAgent.sol (0G Chain) to preserve the
 * "No Solidity on Hedera" bounty for the native SDK integration.
 */
contract AlphaDawgAuditLog is Ownable {

    // ── Events ───────────────────────────────────────────────────────

    /// @notice Emitted when an agent hunt cycle completes
    event CycleCompleted(
        address indexed user,
        uint256 cycleId,
        string action,
        string asset,
        uint256 pct
    );

    /// @notice Emitted when a specialist is hired for a cycle
    event SpecialistHired(
        address indexed user,
        string specialistName,
        uint256 costMicroUsd
    );

    /// @notice Emitted when a user deposits USDC into their agent wallet
    event DepositRecorded(
        address indexed user,
        uint256 amountUsd,
        uint256 newNavUsd
    );

    /// @notice Emitted on each heartbeat tick
    event HeartbeatEmitted(
        uint256 timestamp,
        uint256 activeUsers
    );

    /// @notice Emitted to prove correlation of events across chains
    event CrossChainCorrelation(
        string sourceChain,
        string eventType,
        bytes32 sourceTxHash
    );

    // ── Constructor ──────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ── Emit Functions (onlyOwner) ───────────────────────────────────

    function emitCycleCompleted(
        address user,
        uint256 cycleId,
        string calldata action,
        string calldata asset,
        uint256 pct
    ) external onlyOwner {
        emit CycleCompleted(user, cycleId, action, asset, pct);
    }

    function emitSpecialistHired(
        address user,
        string calldata specialistName,
        uint256 costMicroUsd
    ) external onlyOwner {
        emit SpecialistHired(user, specialistName, costMicroUsd);
    }

    function emitDepositRecorded(
        address user,
        uint256 amountUsd,
        uint256 newNavUsd
    ) external onlyOwner {
        emit DepositRecorded(user, amountUsd, newNavUsd);
    }

    function emitHeartbeat(uint256 activeUsers) external onlyOwner {
        emit HeartbeatEmitted(block.timestamp, activeUsers);
    }

    function emitCrossChainCorrelation(
        string calldata sourceChain,
        string calldata eventType,
        bytes32 sourceTxHash
    ) external onlyOwner {
        emit CrossChainCorrelation(sourceChain, eventType, sourceTxHash);
    }
}
