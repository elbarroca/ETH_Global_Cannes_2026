// Unichain Sepolia — chain 1301 (testnet). The ONLY authorized chain for A6
// Uniswap swap tooling. Mainnet and any other chain ID are rejected at the
// route handler boundary.
//
// Official Uniswap V3 deployment on Unichain Sepolia:
// https://docs.uniswap.org/contracts/v3/reference/deployments/unichain-deployments

export const UNICHAIN_SEPOLIA = {
  chainId: 1301 as const,
  name: "Unichain Sepolia",
  rpcUrl: process.env.UNICHAIN_SEPOLIA_RPC_URL ?? "https://sepolia.unichain.org",

  // Uniswap V3 SwapRouter02 on Unichain Sepolia (set UNICHAIN_SWAP_ROUTER to override)
  swapRouter: (process.env.UNICHAIN_SWAP_ROUTER ?? "0x0284aC5aF363BEc6a1E7b67E87F1cd1ACD3DF24B") as `0x${string}`,

  // Allowlisted token pair: USDC → WETH on Unichain Sepolia
  // Values from Unichain Sepolia official token list
  tokens: {
    USDC: (process.env.UNICHAIN_USDC_ADDRESS ?? "0x31d0220469e10c4E71834a79b1f276d740d3768F") as `0x${string}`,
    WETH: (process.env.UNICHAIN_WETH_ADDRESS ?? "0x4200000000000000000000000000000000000006") as `0x${string}`,
  },

  // Uniswap V3 pool fee tier — 0.3% for USDC/WETH
  defaultFeeTier: 3000 as const,

  // Quote validity window
  quoteDeadlineSeconds: 120,

  // Default max slippage: 0.5%
  defaultSlippageBps: 50,
} as const;

export type AllowlistedToken = keyof typeof UNICHAIN_SEPOLIA.tokens;

export function isAllowlistedToken(address: string): address is `0x${string}` {
  const lower = address.toLowerCase();
  return Object.values(UNICHAIN_SEPOLIA.tokens).some(
    (addr) => addr.toLowerCase() === lower,
  );
}

export function isUnichainSepolia(chainId: number): boolean {
  return chainId === UNICHAIN_SEPOLIA.chainId;
}
