"use client";

import {
  DynamicContextProvider,
  DynamicUserProfile,
} from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import {
  createConfig,
  http,
  WagmiProvider,
  useConnection,
  useSwitchChain,
} from "wagmi";
import { defineChain } from "viem";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { UserProvider } from "./user-context";
import { AuthGuard } from "@/components/auth-guard";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { decimals: 18, name: "USD Coin", symbol: "USDC" },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

const wagmiConfig = createConfig({
  chains: [arcTestnet],
  transports: { [arcTestnet.id]: http("https://rpc.testnet.arc.network") },
  multiInjectedProviderDiscovery: true,
});

const queryClient = new QueryClient();

const DYNAMIC_ENV_ID = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID ?? "";

const ARC_RPC = "https://rpc.testnet.arc.network";

// Intercept Dynamic SDK's DRPC calls and redirect to direct Arc RPC.
// Dynamic's embedded wallet SDK hardcodes arc-testnet.drpc.org which has a
// 3-request batch limit on the free tier, causing 500 errors.
if (typeof window !== "undefined") {
  const _fetch = window.fetch;
  window.fetch = (input, init) => {
    if (typeof input === "string" && input.includes("arc-testnet.drpc.org")) {
      input = ARC_RPC;
    } else if (
      input instanceof Request &&
      input.url.includes("arc-testnet.drpc.org")
    ) {
      input = new Request(ARC_RPC, input);
    }
    return _fetch(input, init);
  };
}

const ARC_TESTNET_NETWORK = {
  blockExplorerUrls: ["https://testnet.arcscan.app"],
  chainId: arcTestnet.id,
  chainName: "Arc Testnet",
  iconUrls: ["https://app.dynamic.xyz/assets/networks/base.svg"],
  name: "Arc Testnet",
  nativeCurrency: { decimals: 18, name: "USD Coin", symbol: "USDC" },
  networkId: arcTestnet.id,
  rpcUrls: [ARC_RPC],
  privateCustomerRpcUrls: [ARC_RPC],
  vanityName: "Arc Testnet",
};

/** Auto-switch wallet to Arc Testnet + suppress 4902 unhandled rejections */
function ChainGuard({ children }: { children: ReactNode }) {
  const { chainId, isConnected } = useConnection();
  const { mutate: switchChain } = useSwitchChain();

  // Suppress unhandled wallet rejections (4902=chain not configured, 4001=user denied)
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      if (event.reason?.code === 4902 || event.reason?.code === 4001) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  // Add Arc Testnet to MetaMask with correct RPC, then switch
  useEffect(() => {
    if (!isConnected || !chainId) return;

    (async () => {
      try {
        await window.ethereum?.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${arcTestnet.id.toString(16)}`,
              chainName: "Arc Testnet",
              rpcUrls: [ARC_RPC],
              nativeCurrency: {
                name: "USD Coin",
                symbol: "USDC",
                decimals: 18,
              },
              blockExplorerUrls: ["https://testnet.arcscan.app"],
            },
          ],
        });
      } catch {
        // User rejected or already added — ignore
      }

      if (chainId !== arcTestnet.id && switchChain) {
        switchChain({ chainId: arcTestnet.id });
      }
    })();
  }, [isConnected, chainId, switchChain]);

  return <>{children}</>;
}

// Non-EVM or Solana-first wallets that should NEVER appear in the picker.
//
// Dynamic's wallet-book registers Phantom as FOUR separate entries
// (`phantom`, `phantomevm`, `phantombtc`, `phantomledger`) — which is why
// a naive key filter lets duplicates through. All variants share
// `group: "phantom"` / `chainGroup: "phantom"`, so we match on those fields
// to catch every flavor in one rule. Same logic for other Solana-first
// wallets that ship EVM modes and confuse EVM-only users.
const BLOCKED_WALLET_GROUPS = new Set([
  "phantom",
  "solflare",
  "backpack",
  "glow",
  "coin98",
  "exodus",
]);

function isBlockedWallet(wallet: {
  key?: string;
  name?: string;
  group?: string;
  chainGroup?: string;
}): boolean {
  const fields = [
    wallet.group,
    wallet.chainGroup,
    wallet.key,
    wallet.name,
  ].map((f) => (f ?? "").toLowerCase());
  return fields.some((f) =>
    Array.from(BLOCKED_WALLET_GROUPS).some((blocked) => f.includes(blocked)),
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: DYNAMIC_ENV_ID,
        walletConnectors: [EthereumWalletConnectors],
        initialAuthenticationMode: "connect-only",
        overrides: { evmNetworks: [ARC_TESTNET_NETWORK] },
        walletsFilter: (wallets) =>
          wallets
            .filter((w) => !isBlockedWallet(w))
            .map((w) => ({
              ...w,
              // Also strip blocked wallets from any grouped-wallet containers
              // (some Dynamic views expand groups inline).
              groupedWallets: w.groupedWallets?.filter(
                (gw) => !isBlockedWallet(gw),
              ),
            })),
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <DynamicWagmiConnector>
            <ChainGuard>
              <UserProvider>
                <AuthGuard>{children}</AuthGuard>
                {/* Renders the settings modal opened by `setShowDynamicUserProfile`
                    from components/wallet-connect.tsx. Without this the custom
                    wallet-menu button in <Nav /> has nothing to open. */}
                <DynamicUserProfile />
              </UserProvider>
            </ChainGuard>
          </DynamicWagmiConnector>
        </QueryClientProvider>
      </WagmiProvider>
    </DynamicContextProvider>
  );
}
