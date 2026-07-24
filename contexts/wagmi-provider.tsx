"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import type { EIP1193Provider } from "viem";
import {
  createConfig,
  http,
  WagmiProvider,
  useConnection,
  useSwitchChain,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { AuthGuard } from "@/components/auth-guard";
import { RouteTransitionLoader } from "@/components/route-transition-loader";
import { arcTestnet, ARC_TESTNET_RPC } from "@/lib/arc-chain";
import { UserProvider } from "./user-context";

export { arcTestnet };

const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected({ shimDisconnect: true })],
  multiInjectedProviderDiscovery: false,
  transports: { [arcTestnet.id]: http(ARC_TESTNET_RPC) },
});

const queryClient = new QueryClient();

function ChainGuard({ children }: { children: ReactNode }) {
  const { chainId, isConnected } = useConnection();
  const { mutateAsync: switchChain } = useSwitchChain();

  useEffect(() => {
    if (!isConnected || !chainId || chainId === arcTestnet.id) return;
    let active = true;

    void (async () => {
      try {
        const provider = (window as typeof window & { ethereum?: EIP1193Provider }).ethereum;
        await provider?.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${arcTestnet.id.toString(16)}`,
              chainName: "Arc Testnet",
              rpcUrls: [ARC_TESTNET_RPC],
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
        if (active) console.warn("[wallet] Arc Testnet was not added automatically");
      }

      if (!active) return;
      try {
        await switchChain({ chainId: arcTestnet.id });
      } catch {
        if (active) console.warn("[wallet] Arc Testnet switch was not completed");
      }
    })();

    return () => {
      active = false;
    };
  }, [chainId, isConnected, switchChain]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ChainGuard>
          <UserProvider>
            <AuthGuard>{children}</AuthGuard>
            <RouteTransitionLoader />
          </UserProvider>
        </ChainGuard>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
