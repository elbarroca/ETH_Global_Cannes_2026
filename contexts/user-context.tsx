"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { createPublicClient, http, formatUnits } from "viem";
import { getUser, onboard, type UserRecord } from "@/lib/api";
import { useAccount } from "wagmi";
// Pull the chain definition from the neutral lib/ module instead of
// @/contexts/wagmi-provider. wagmi-provider imports UserProvider from THIS
// file, so going the other direction creates a TDZ cycle — the module runs
// line 26 (`chain: arcTestnet`) before wagmi-provider finishes evaluating
// its export. Next 16 surfaces that as:
//   ReferenceError: Cannot access 'arcTestnet' before initialization
// which wipes the dashboard on first render.
import { arcTestnet } from "@/lib/arc-chain";

// ── Shared Arc RPC client for live balance polling ──────────────────────
//
// Every UI surface (nav chip, Nasdaq hero, dashboard wallet card, deposit
// page, marketplace) reads the agent's USDC balance from this single client
// via the context's `agentBalance` field. Direct viem against Arc testnet
// bypasses Dynamic/DRPC rate limits and avoids the DB accounting drift that
// was making the nav ($9.50) and hero ($9.80) disagree on the same wallet.

const arcPublicClient = createPublicClient({
  chain: arcTestnet,
  transport: http("https://rpc.testnet.arc.network"),
});

// Arc USDC is the chain's native currency (18 decimals, not ERC-20).
const ARC_USDC_DECIMALS = 18;

interface UserContextValue {
  userId: string | null;
  walletAddress: string | null;
  user: UserRecord | null;
  isConnected: boolean;
  isOnboarded: boolean;
  telegramVerified: boolean;
  linkCode: string | null;
  /**
   * Live on-chain USDC balance of the Circle MPC proxy wallet (the "dog
   * wallet"). Polled every 5s from Arc RPC directly. This is the canonical
   * number the UI should display everywhere. null while the first read is
   * in flight or when no proxy wallet is attached.
   */
  agentBalance: number | null;
  /** Timestamp (ms) of the most recent successful balance read. */
  agentBalanceFetchedAt: number | null;
  /** Force-refresh the balance (e.g., after a deposit completes). */
  refreshAgentBalance: () => Promise<void>;
  setUser: (user: UserRecord | null) => void;
  refetch: () => Promise<void>;
  refreshLinkCode: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [agentBalance, setAgentBalance] = useState<number | null>(null);
  const [agentBalanceFetchedAt, setAgentBalanceFetchedAt] = useState<number | null>(null);

  const onboardingRef = useRef(false);
  const linkCodeFetchedRef = useRef(false);

  const telegramVerified = user?.telegram?.verified ?? false;
  const proxyAddress = user?.proxyWallet?.address ?? null;

  const refreshAgentBalance = useCallback(async () => {
    if (!proxyAddress) {
      setAgentBalance(null);
      return;
    }
    try {
      const wei = await arcPublicClient.getBalance({
        address: proxyAddress as `0x${string}`,
      });
      const usd = Number.parseFloat(formatUnits(wei, ARC_USDC_DECIMALS));
      setAgentBalance(Number.isFinite(usd) ? usd : null);
      setAgentBalanceFetchedAt(Date.now());
    } catch {
      // Silent fail — surfaces as "—" in the UI. The next poll will retry.
    }
  }, [proxyAddress]);

  // Poll the agent wallet balance every 3s. One timer in context means nav,
  // hero, dashboard wallet card and deposit page all show the exact same
  // number with no risk of drift between components. 3s matches the swarm
  // activity ticker poll cadence — when that ticker detects a balance-moving
  // action (SPECIALIST_HIRED, TRADE_EXECUTED) it also calls
  // refreshAgentBalance() for an immediate update, making the perceived lag
  // sub-second during a live hunt. All setState calls are deferred via
  // setTimeout(0) so React doesn't complain about
  // react-hooks/set-state-in-effect.
  useEffect(() => {
    let cancelled = false;
    if (!proxyAddress) {
      const clear = setTimeout(() => {
        if (cancelled) return;
        setAgentBalance(null);
        setAgentBalanceFetchedAt(null);
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(clear);
      };
    }
    const tick = async () => {
      if (cancelled) return;
      await refreshAgentBalance();
    };
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, 3_000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [proxyAddress, refreshAgentBalance]);

  const refreshLinkCode = useCallback(async () => {
    if (!address) return;
    try {
      const result = await onboard(address, "mock", "AlphaDawg sign-in");
      if (result.telegramLinkCode) {
        setLinkCode(result.telegramLinkCode);
        linkCodeFetchedRef.current = true;
      }
    } catch (err) {
      console.warn("[user-context] Failed to refresh link code:", err);
      throw err; // Re-throw so modal can show error state
    }
  }, [address]);

  const refetch = useCallback(async () => {
    if (!address) { setUser(null); return; }
    const fetched = await getUser(address);
    if (fetched) {
      setUser(fetched);
      // Clear linkCode once telegram is verified
      if (fetched.telegram?.verified) {
        setLinkCode(null);
        linkCodeFetchedRef.current = false;
      } else if (!linkCodeFetchedRef.current && !onboardingRef.current) {
        // Returning user without Telegram — generate a link code ONCE
        linkCodeFetchedRef.current = true;
        try {
          const result = await onboard(address, "mock", "AlphaDawg sign-in");
          if (result.telegramLinkCode) setLinkCode(result.telegramLinkCode);
        } catch {
          linkCodeFetchedRef.current = false; // Reset on failure so retry is possible
        }
      }
      return;
    }
    // Auto-onboard on first connect (testnet — "mock" signature skips verification)
    if (!onboardingRef.current) {
      onboardingRef.current = true;
      linkCodeFetchedRef.current = true;
      try {
        const result = await onboard(address, "mock", "AlphaDawg sign-in");
        if (result.telegramLinkCode) setLinkCode(result.telegramLinkCode);
        // Fetch full user record after onboard
        const fullUser = await getUser(address);
        if (fullUser) setUser(fullUser);
      } catch (err) {
        console.warn("[user-context] Auto-onboard failed:", err);
        onboardingRef.current = false;
        linkCodeFetchedRef.current = false;
      }
    }
  }, [address]);

  useEffect(() => {
    refetch();
    const interval = setInterval(refetch, 10_000);
    return () => clearInterval(interval);
  }, [refetch]);

  return (
    <UserContext.Provider
      value={{
        userId: user?.id ?? null,
        walletAddress: address ?? null,
        user,
        isConnected,
        isOnboarded: !!user?.id,
        telegramVerified,
        linkCode,
        agentBalance,
        agentBalanceFetchedAt,
        refreshAgentBalance,
        setUser,
        refetch,
        refreshLinkCode,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
