"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, formatUnits } from "viem";
import { arcTestnet } from "@/contexts/wagmi-provider";

// Dedicated client — direct Arc RPC, bypasses Dynamic/DRPC rate limits.
const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http("https://rpc.testnet.arc.network"),
});

/**
 * Polls the native USDC balance of an address on Arc Testnet.
 * Arc uses USDC as its native gas token, so a simple `getBalance()` returns
 * the wallet's spendable USDC balance (18 decimals).
 */
export function useAgentBalance(address: string | undefined | null, pollMs = 15_000) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setBalance(null);
      return;
    }

    let cancelled = false;

    async function fetchBalance() {
      setLoading(true);
      try {
        const wei = await publicClient.getBalance({
          address: address as `0x${string}`,
        });
        if (!cancelled) {
          setBalance(parseFloat(formatUnits(wei, 18)));
        }
      } catch {
        // Silent fail — header shows "—" when balance unavailable
        if (!cancelled) setBalance(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBalance();
    const interval = setInterval(fetchBalance, pollMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [address, pollMs]);

  return { balance, loading };
}
