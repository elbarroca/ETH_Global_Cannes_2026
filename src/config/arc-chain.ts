import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

// Token addresses on Arc testnet
export const ARC_TOKENS = {
  USDC: (process.env.ARC_USDC_ADDRESS ?? "0x3600000000000000000000000000000000000000") as `0x${string}`,
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as `0x${string}`,
  WETH: (process.env.ARC_WETH_ADDRESS ?? "0x0000000000000000000000000000000000000001") as `0x${string}`,
} as const;

// Uniswap V3 SwapRouter on Arc testnet (set via env when deployed)
export const ARC_SWAP_ROUTER = process.env.ARC_UNISWAP_ROUTER as `0x${string}` | undefined;
