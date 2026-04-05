// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title AlphaDawg Demo WETH
/// @notice Arc-native synthetic token the agent swarm buys/sells to simulate
///         ETH exposure. Not canonical wrapped ETH (Arc has no ETH at all);
///         behaves as a real ERC-20 with transfer/balance semantics and a
///         constant-product AMM pool (AlphaDawgSwap) on the other side.
contract DemoWETH is ERC20, Ownable {
    constructor(address initialOwner)
        ERC20("AlphaDawg Demo WETH", "dWETH")
        Ownable(initialOwner)
    {}

    /// @notice Owner-mint for seeding the pool or topping up reserves.
    ///         Users never call this directly — they get dWETH by swapping
    ///         USDC into the AlphaDawgSwap pool.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
