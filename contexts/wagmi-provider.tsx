"use client";

import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { createConfig, http, WagmiProvider, useConnection, useSwitchChain } from "wagmi";
import { defineChain } from "viem";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { UserProvider } from "./user-context";
import { AuthGuard } from "@/components/auth-guard";

export const arcTestnet = defineChain({
  id: 2655,
  name: "Arc Testnet",
  nativeCurrency: { decimals: 18, name: "USD Coin", symbol: "USDC" },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.testnet.arc.network" },
  },
  testnet: true,
});

const wagmiConfig = createConfig({
  chains: [arcTestnet],
  transports: { [arcTestnet.id]: http() },
  multiInjectedProviderDiscovery: false,
});

const queryClient = new QueryClient();

const DYNAMIC_ENV_ID = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID ?? "";

const ARC_TESTNET_NETWORK = {
  blockExplorerUrls: ["https://explorer.testnet.arc.network"],
  chainId: arcTestnet.id,
  chainName: "Arc Testnet",
  iconUrls: ["https://app.dynamic.xyz/assets/networks/base.svg"],
  name: "Arc Testnet",
  nativeCurrency: { decimals: 18, name: "USD Coin", symbol: "USDC" },
  networkId: arcTestnet.id,
  rpcUrls: ["https://rpc.testnet.arc.network"],
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

  // Auto-switch to Arc Testnet when wallet connects on wrong chain
  useEffect(() => {
    if (isConnected && chainId && chainId !== arcTestnet.id && switchChain) {
      switchChain({ chainId: arcTestnet.id });
    }
  }, [isConnected, chainId, switchChain]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: DYNAMIC_ENV_ID,
        walletConnectors: [EthereumWalletConnectors],
        initialAuthenticationMode: "connect-only",
        overrides: { evmNetworks: [ARC_TESTNET_NETWORK] },
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <DynamicWagmiConnector>
            <ChainGuard>
              <UserProvider>
                <AuthGuard>{children}</AuthGuard>
              </UserProvider>
            </ChainGuard>
          </DynamicWagmiConnector>
        </QueryClientProvider>
      </WagmiProvider>
    </DynamicContextProvider>
  );
}
