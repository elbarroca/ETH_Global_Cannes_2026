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
import { getUser, onboard, type UserRecord } from "@/lib/api";
import { useAccount } from "wagmi";

interface UserContextValue {
  userId: string | null;
  walletAddress: string | null;
  user: UserRecord | null;
  isConnected: boolean;
  isOnboarded: boolean;
  linkCode: string | null;
  setUser: (user: UserRecord | null) => void;
  refetch: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const [user, setUser] = useState<UserRecord | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);

  const onboardingRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!address) { setUser(null); return; }
    const fetched = await getUser(address);
    if (fetched) {
      setUser(fetched);
      if (fetched.linkCode) setLinkCode(fetched.linkCode);
      return;
    }
    // Auto-onboard on first connect (testnet — "mock" signature skips verification)
    if (!onboardingRef.current) {
      onboardingRef.current = true;
      try {
        const result = await onboard(address, "mock", "AlphaDawg sign-in");
        if (result.telegramLinkCode) setLinkCode(result.telegramLinkCode);
        // Fetch full user record after onboard
        const fullUser = await getUser(address);
        if (fullUser) setUser(fullUser);
      } catch (err) {
        console.warn("[user-context] Auto-onboard failed:", err);
      } finally {
        onboardingRef.current = false;
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
        linkCode,
        setUser,
        refetch,
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
