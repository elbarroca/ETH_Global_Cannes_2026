"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import { AuthGuard } from "@/components/auth-guard";
import { RouteTransitionLoader } from "@/components/route-transition-loader";
import { arcTestnet, ARC_TESTNET_RPC } from "@/lib/arc-chain";
import { UserProvider } from "./user-context";

export { arcTestnet };

const wagmiConfig = createConfig({
  ssr: true,
  chains: [arcTestnet],
  connectors: [injected({ shimDisconnect: true })],
  multiInjectedProviderDiscovery: false,
  transports: { [arcTestnet.id]: http(ARC_TESTNET_RPC) },
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000 } },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <UserProvider>
          <AuthGuard>{children}</AuthGuard>
          <RouteTransitionLoader />
        </UserProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
