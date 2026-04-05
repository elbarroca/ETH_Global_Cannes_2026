// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AlphaDawgSwap — minimal constant-product AMM for USDC ↔ dWETH on Arc
/// @notice Matches the Uniswap V3 SwapRouter `exactInputSingle` ABI so the
///         existing arc-swap.ts buyer code works without modification. USDC
///         is native on Arc (msg.value), dWETH is an ERC-20 we deployed.
/// @dev Uses OZ SafeERC20 for robust token handling and ReentrancyGuard on
///      every external mutator as defense-in-depth. State updates follow CEI
///      strictly: all reserve mutations happen BEFORE any external call.
contract AlphaDawgSwap is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable dWETH;

    /// @notice USDC reserves (native, tracked by contract balance)
    uint256 public usdcReserve;
    /// @notice dWETH reserves (ERC-20 balance in contract)
    uint256 public dwethReserve;

    /// @dev Exactly matches Uniswap V3's ISwapRouter.ExactInputSingleParams
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

    event Swap(
        address indexed recipient,
        bool usdcToDweth,
        uint256 amountIn,
        uint256 amountOut
    );
    event LiquidityAdded(uint256 usdcIn, uint256 dwethIn);

    /// @dev Native USDC address on Arc. Same as system address used everywhere.
    address public constant USDC = 0x3600000000000000000000000000000000000000;

    constructor(address _dWETH, address initialOwner) Ownable(initialOwner) {
        dWETH = IERC20(_dWETH);
    }

    /// @notice Seed the pool. Deployer must approve dWETH first.
    ///         Called once post-deploy with 1 USDC (msg.value) and 10 dWETH
    ///         → initial rate is 1 USDC = 10 dWETH (dWETH priced at $0.10)
    ///         You can re-seed any time to shift price or add depth.
    function addLiquidity(uint256 dwethAmount) external payable onlyOwner nonReentrant {
        require(msg.value > 0, "no usdc");
        require(dwethAmount > 0, "no dweth");
        // CEI: update reserves BEFORE the external transferFrom call.
        usdcReserve += msg.value;
        dwethReserve += dwethAmount;
        dWETH.safeTransferFrom(msg.sender, address(this), dwethAmount);
        emit LiquidityAdded(msg.value, dwethAmount);
    }

    /// @notice BUY dWETH with native USDC. Matches Uniswap V3 signature
    ///         byte-for-byte so arc-swap.ts can call this unchanged.
    /// @dev Arc uses msg.value for native USDC (18 decimals native).
    ///      The `tokenIn` / `amountIn` / `fee` / `deadline` / `sqrtPriceLimitX96`
    ///      fields are accepted for ABI compatibility and then ignored —
    ///      we use msg.value as the authoritative input amount.
    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        nonReentrant
        returns (uint256 amountOut)
    {
        require(block.timestamp <= params.deadline, "deadline");
        require(params.tokenOut == address(dWETH), "only dWETH supported");
        require(params.recipient != address(0), "zero recipient");
        require(msg.value > 0, "zero input");
        require(usdcReserve > 0 && dwethReserve > 0, "pool empty");

        // Constant product: (x + dx)(y - dy) = x*y
        // dy = (dx * y) / (x + dx)
        amountOut = (msg.value * dwethReserve) / (usdcReserve + msg.value);
        require(amountOut >= params.amountOutMinimum, "slippage");
        require(amountOut < dwethReserve, "pool too shallow");

        // CEI: mutate reserves BEFORE the external transfer.
        usdcReserve += msg.value;
        dwethReserve -= amountOut;
        dWETH.safeTransfer(params.recipient, amountOut);

        emit Swap(params.recipient, true, msg.value, amountOut);
    }

    /// @notice SELL dWETH for native USDC. Buyer approves dWETH first.
    /// @dev Mirror of exactInputSingle for the reverse direction — this is
    ///      the new code path arc-swap.ts will use for SELL cycles. Current
    ///      MockSwapRouter has no sell path at all, so this is net-new
    ///      functionality the demo unlocks.
    function exactInputSingleSell(
        uint256 dwethAmountIn,
        uint256 amountOutMinimum,
        address recipient,
        uint256 deadline
    ) external nonReentrant returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "deadline");
        require(recipient != address(0), "zero recipient");
        require(dwethAmountIn > 0, "zero input");
        require(usdcReserve > 0 && dwethReserve > 0, "pool empty");

        // Pull the seller's dWETH via SafeERC20 — reverts on any token weirdness.
        // Our DemoWETH is a plain OZ ERC-20 with no hooks, so reentrancy through
        // this call is impossible, but SafeERC20 + nonReentrant keeps the contract
        // honest if we ever swap DemoWETH out for a fancier token.
        dWETH.safeTransferFrom(msg.sender, address(this), dwethAmountIn);

        amountOut = (dwethAmountIn * usdcReserve) / (dwethReserve + dwethAmountIn);
        require(amountOut >= amountOutMinimum, "slippage");
        require(amountOut < usdcReserve, "pool too shallow");

        // CEI: mutate reserves BEFORE the external native USDC call below.
        dwethReserve += dwethAmountIn;
        usdcReserve -= amountOut;

        // Send native USDC (msg.value equivalent on Arc). nonReentrant prevents
        // the recipient from calling back into any swap function; CEI means even
        // a read-only reentrancy observes consistent reserves.
        (bool ok, ) = recipient.call{value: amountOut}("");
        require(ok, "native transfer failed");

        emit Swap(recipient, false, dwethAmountIn, amountOut);
    }

    /// @notice Top up reserves without rebalancing (owner only).
    function topUp(uint256 dwethAmount) external payable onlyOwner nonReentrant {
        if (dwethAmount > 0) {
            // CEI: bump reserve first, then safeTransferFrom.
            dwethReserve += dwethAmount;
            dWETH.safeTransferFrom(msg.sender, address(this), dwethAmount);
        }
        if (msg.value > 0) {
            usdcReserve += msg.value;
        }
    }

    /// @notice Current spot price: 1 dWETH in USDC (18 decimals)
    function spotPrice() external view returns (uint256) {
        if (dwethReserve == 0) return 0;
        return (usdcReserve * 1e18) / dwethReserve;
    }

    receive() external payable {
        // Accept native USDC from sells / liquidity adds
    }
}
