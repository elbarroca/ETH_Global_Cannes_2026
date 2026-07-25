"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAccount, useSignMessage } from "wagmi";
import {
  createSiweChallenge,
  getAuthSession,
  getUser,
  onboard,
  verifySiweChallenge,
  type UserRecord,
} from "@/lib/api";

export type AuthState =
  | "disconnected"
  | "signing"
  | "onboarding"
  | "ready"
  | "stale"
  | "error";

interface UserContextValue {
  userId: string | null;
  walletAddress: string | null;
  user: UserRecord | null;
  isConnected: boolean;
  isOnboarded: boolean;
  telegramVerified: boolean;
  linkCode: string | null;
  agentBalance: number | null;
  agentBalanceFetchedAt: number | null;
  authState: AuthState;
  authError: string | null;
  refreshAgentBalance: () => Promise<void>;
  setUser: (user: UserRecord | null) => void;
  refetch: () => Promise<void>;
  reauthenticate: () => Promise<void>;
  refreshLinkCode: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

function walletErrorCode(error: unknown): number | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    const record = current as { code?: unknown; cause?: unknown };
    if (record.code === 4001 || record.code === "4001") return 4001;
    current = record.cause;
  }
  return null;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [user, setUserState] = useState<UserRecord | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [authState, setAuthState] = useState<AuthState>("disconnected");
  const [authError, setAuthError] = useState<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const authenticatedWalletRef = useRef<string | null>(null);
  const authStateRef = useRef<AuthState>("disconnected");

  useEffect(() => {
    authStateRef.current = authState;
  }, [authState]);

  const authenticate = useCallback(async (forceSignature: boolean): Promise<void> => {
    if (!address) {
      setUserState(null);
      setLinkCode(null);
      setAuthError(null);
      setAuthState("disconnected");
      authenticatedWalletRef.current = null;
      return;
    }
    const normalizedAddress = address.toLowerCase();
    try {
      setAuthError(null);
      const session = forceSignature ? null : await getAuthSession();
      const sessionMatchesWallet = session?.walletAddress.toLowerCase() === normalizedAddress;
      if (forceSignature || !sessionMatchesWallet) {
        setAuthState("signing");
        const challenge = await createSiweChallenge(address);
        const signature = await signMessageAsync({ message: challenge.message });
        await verifySiweChallenge({
          challengeId: challenge.challengeId,
          message: challenge.message,
          signature,
        });
      }
      authenticatedWalletRef.current = normalizedAddress;
      setAuthState("onboarding");
      const result = await onboard();
      const fetched = await getUser(address);
      if (!fetched) throw new Error("Authenticated user record is unavailable.");
      setUserState(fetched);
      setLinkCode(fetched.telegram?.verified ? null : result.telegramLinkCode);
      setAuthState("ready");
    } catch (error) {
      authenticatedWalletRef.current = null;
      setUserState(null);
      setAuthError(walletErrorCode(error) === 4001
        ? "WALLET_SIGNATURE_REJECTED: Signature canceled. Retry when ready."
        : error instanceof Error ? error.message : "Wallet authentication failed.");
      setAuthState("error");
    }
  }, [address, signMessageAsync]);

  const runAuthentication = useCallback((forceSignature: boolean): Promise<void> => {
    if (inFlightRef.current) return inFlightRef.current;
    const request = authenticate(forceSignature).finally(() => {
      inFlightRef.current = null;
    });
    inFlightRef.current = request;
    return request;
  }, [authenticate]);

  const refetch = useCallback(() => runAuthentication(false), [runAuthentication]);
  const reauthenticate = useCallback(() => runAuthentication(true), [runAuthentication]);

  useEffect(() => {
    if (!isConnected || !address) {
      void authenticate(false);
      return;
    }
    void runAuthentication(false);
  }, [address, authenticate, isConnected, runAuthentication]);

  useEffect(() => {
    const handleStale = (event: Event): void => {
      if (authStateRef.current !== "ready") return;
      const detail = (event as CustomEvent<{ status?: number; code?: string | null }>).detail;
      if (detail?.code === "AUTH_USER_REQUIRED") {
        setAuthError("Onboarding is required for this wallet.");
        setAuthState("onboarding");
        return;
      }
      if (detail?.status === 401 || detail?.code === "AUTH_SESSION_EXPIRED") {
        setAuthError("Your wallet authorization expired.");
        setAuthState("stale");
      }
    };
    window.addEventListener("alphadawg:auth-stale", handleStale);
    return () => window.removeEventListener("alphadawg:auth-stale", handleStale);
  }, []);

  const refreshLinkCode = useCallback(async (): Promise<void> => {
    await runAuthentication(false);
  }, [runAuthentication]);

  const setUser = useCallback((next: UserRecord | null): void => {
    setUserState(next);
    if (next) setAuthState("ready");
  }, []);

  const refreshAgentBalance = useCallback(async (): Promise<void> => undefined, []);

  return (
    <UserContext.Provider
      value={{
        userId: user?.id ?? null,
        walletAddress: address ?? null,
        user,
        isConnected,
        isOnboarded: Boolean(user?.id),
        telegramVerified: user?.telegram?.verified ?? false,
        linkCode,
        agentBalance: null,
        agentBalanceFetchedAt: null,
        authState,
        authError,
        refreshAgentBalance,
        setUser,
        refetch,
        reauthenticate,
        refreshLinkCode,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within UserProvider");
  return context;
}
