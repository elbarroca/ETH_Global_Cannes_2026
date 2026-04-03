"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { getUser, type UserRecord } from "@/lib/api";
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

  const refetch = useCallback(async () => {
    if (!address) { setUser(null); return; }
    const fetched = await getUser(address);
    setUser(fetched);
    if (fetched?.linkCode) setLinkCode(fetched.linkCode);
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
