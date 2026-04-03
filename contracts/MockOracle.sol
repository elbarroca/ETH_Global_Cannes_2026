// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockOracle — Stub verifier for ERC-7857 iNFT transfers
 * @notice Always returns true. Replace with TEE/ZKP oracle in production.
 * @dev In production: oracle decrypts metadata in TEE, re-encrypts for new
 *      owner, and generates cryptographic proof of correct re-encryption.
 *      See: docs.0g.ai/developer-hub/building-on-0g/inft/erc7857
 */
contract MockOracle {
    function verifyProof(bytes calldata) external pure returns (bool) {
        return true;
    }

    function verifyOwnership(bytes calldata) external pure returns (bool) {
        return true;
    }
}
