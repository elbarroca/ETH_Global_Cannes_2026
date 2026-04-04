// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockSwapRouter
 * @notice Demo swap router for Arc testnet. Implements Uniswap V3 exactInputSingle interface.
 *         Accepts native USDC as msg.value, emits SwapExecuted event, forwards funds to recipient.
 *         Produces real tx hashes on ArcScan for hackathon demo.
 */
contract MockSwapRouter {
    address public owner;

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    event SwapExecuted(
        address indexed sender,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint24 fee,
        address recipient
    );

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Execute a swap — accepts native USDC as msg.value, forwards to recipient.
     * @dev Matches Uniswap V3 ISwapRouter.exactInputSingle interface (payable).
     */
    function exactInputSingle(
        ExactInputSingleParams calldata params
    ) external payable returns (uint256 amountOut) {
        require(block.timestamp <= params.deadline, "Transaction too old");
        require(msg.value > 0, "No value sent");
        require(msg.value == params.amountIn, "Value mismatch");

        amountOut = msg.value;

        // Forward native USDC to recipient
        (bool sent, ) = payable(params.recipient).call{value: amountOut}("");
        require(sent, "Transfer failed");

        emit SwapExecuted(
            msg.sender,
            params.tokenIn,
            params.tokenOut,
            msg.value,
            amountOut,
            params.fee,
            params.recipient
        );
    }

    /// @notice Withdraw stuck funds (owner only)
    function withdraw() external {
        require(msg.sender == owner, "Not owner");
        (bool sent, ) = payable(owner).call{value: address(this).balance}("");
        require(sent, "Withdraw failed");
    }

    receive() external payable {}
}
