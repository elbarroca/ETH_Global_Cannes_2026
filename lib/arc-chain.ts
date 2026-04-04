import { defineChain } from "viem";

// Shared Arc Testnet chain definition. Both the wagmi provider and the
// user-context live-balance poller import from here so there is no circular
// dependency between them — previously user-context tried to pull `arcTestnet`
// out of contexts/wagmi-provider.tsx, which itself imports user-context, and
// the resulting TDZ wiped the dashboard with:
//   ReferenceError: Cannot access 'arcTestnet' before initialization
//
// Keep this file free of React imports so it stays a pure data module.

export const ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { decimals: 18, name: "USD Coin", symbol: "USDC" },
  rpcUrls: {
    default: { http: [ARC_TESTNET_RPC] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});
