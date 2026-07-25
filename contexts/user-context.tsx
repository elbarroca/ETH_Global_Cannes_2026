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
  ApiError,
  createSiweChallenge,
  getAuthSession,
  getUser,
  onboard,
  verifySiweChallenge,
  type SiweAction,
  type UserRecord,
} from "@/lib/api";

export type AuthState =
  | "disconnected"
  | "signing"
  | "onboarding"
  | "ready"
  | "stale"
  | "error";

type InternalAuthState = AuthState | "checking" | "authorization-required" | "signature-rejected";
export type AuthIssue = "CHECKING_SESSION" | "AUTH_ACTION_REQUIRED" | "AUTH_SESSION_EXPIRED" | "AUTH_USER_REQUIRED" | "WALLET_SIGNATURE_REJECTED" | null;

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
  authIssue: AuthIssue;
  authError: string | null;
  refreshAgentBalance: () => Promise<void>;
  setUser: (user: UserRecord | null) => void;
  refetch: () => Promise<void>;
  reauthenticate: () => Promise<void>;
  onboardWallet: () => Promise<void>;
  retryAuthentication: () => Promise<void>;
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Wallet authentication failed.";
}

function publicAuthState(state: InternalAuthState): AuthState {
  if (state === "checking") return "signing";
  if (state === "authorization-required") return "stale";
  if (state === "signature-rejected") return "error";
  return state;
}

function authIssueFor(state: InternalAuthState, error: string | null): AuthIssue {
  if (state === "checking") return "CHECKING_SESSION";
  if (state === "authorization-required") return "AUTH_ACTION_REQUIRED";
  if (state === "stale") return "AUTH_SESSION_EXPIRED";
  if (state === "signature-rejected") return "WALLET_SIGNATURE_REJECTED";
  if (state === "onboarding" && error) return "AUTH_USER_REQUIRED";
  return null;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [user, setUserState] = useState<UserRecord | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [internalAuthState, setAuthState] = useState<InternalAuthState>("disconnected");
  const [authError, setAuthError] = useState<string | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const authStateRef = useRef<InternalAuthState>("disconnected");
  const lastActionRef = useRef<SiweAction>("onboard");

  useEffect(() => {
    authStateRef.current = internalAuthState;
  }, [internalAuthState]);

  const authState = publicAuthState(internalAuthState);
  const authIssue = authIssueFor(internalAuthState, authError);

  const resetDisconnected = useCallback((): void => {
    setUserState(null);
    setLinkCode(null);
    setAuthError(null);
    setAuthState("disconnected");
  }, []);

  const loadUser = useCallback(async (walletAddress: string): Promise<UserRecord> => {
    const next = await getUser(walletAddress);
    if (!next) throw new Error("Authenticated user record is unavailable.");
    setUserState(next);
    return next;
  }, []);

  const signForAction = useCallback(async (action: SiweAction): Promise<void> => {
    if (!address) {
      resetDisconnected();
      return;
    }
    lastActionRef.current = action;
    setAuthError(null);
    setAuthState("signing");
    try {
      const challenge = await createSiweChallenge(address, action);
      const signature = await signMessageAsync({ message: challenge.message });
      const session = await verifySiweChallenge({
        challengeId: challenge.challengeId,
        message: challenge.message,
        signature,
      });

      if (action === "onboard") {
        setAuthState("onboarding");
        const result = await onboard();
        const next = await loadUser(address);
        setLinkCode(next.telegram?.verified ? null : result.telegramLinkCode);
        setAuthError("Onboarding is complete. Authorize this protected workspace to continue.");
        setAuthState("authorization-required");
        return;
      }

      if (!session.userId) {
        setUserState(null);
        setAuthError("This wallet must complete onboarding before workspace authorization.");
        setAuthState("onboarding");
        return;
      }
      const next = await loadUser(address);
      setLinkCode((current) => next.telegram?.verified ? null : current);
      setAuthState("ready");
    } catch (error) {
      if (walletErrorCode(error) === 4001) {
        setAuthError("WALLET_SIGNATURE_REJECTED: Signature canceled. No authorization was granted.");
        setAuthState("signature-rejected");
        return;
      }
      if (error instanceof ApiError && error.code === "AUTH_USER_REQUIRED") {
        setUserState(null);
        setAuthError("Verified onboarding is required for this wallet.");
        setAuthState("onboarding");
        return;
      }
      if (error instanceof ApiError && error.code === "AUTH_ACTION_REQUIRED") {
        setAuthError("Fresh authenticate authorization is required for this workspace.");
        setAuthState("authorization-required");
        return;
      }
      setAuthError(errorMessage(error));
      setAuthState("error");
    }
  }, [address, loadUser, resetDisconnected, signMessageAsync]);

  const resumeSession = useCallback(async (): Promise<void> => {
    if (!address) {
      resetDisconnected();
      return;
    }
    setAuthError(null);
    setAuthState("checking");
    try {
      const session = await getAuthSession();
      if (session.walletAddress.toLowerCase() !== address.toLowerCase()) {
        await signForAction("onboard");
        return;
      }
      if (!session.userId) {
        setAuthState("onboarding");
        const result = await onboard();
        const next = await loadUser(address);
        setLinkCode(next.telegram?.verified ? null : result.telegramLinkCode);
        setAuthError("Onboarding is complete. Authorize this protected workspace to continue.");
        setAuthState("authorization-required");
        return;
      }
      const next = await loadUser(address);
      setLinkCode((current) => next.telegram?.verified ? null : current);
      setAuthState("ready");
    } catch (error) {
      if (error instanceof ApiError && error.code === "AUTH_REQUIRED") {
        await signForAction("onboard");
        return;
      }
      if (error instanceof ApiError && (error.status === 401 || error.code === "AUTH_SESSION_EXPIRED")) {
        setAuthError("Your wallet authorization expired.");
        setAuthState("stale");
        return;
      }
      if (error instanceof ApiError && error.code === "AUTH_ACTION_REQUIRED") {
        setAuthError("Fresh authenticate authorization is required for this workspace.");
        setAuthState("authorization-required");
        return;
      }
      setAuthError(errorMessage(error));
      setAuthState("error");
    }
  }, [address, loadUser, resetDisconnected, signForAction]);

  const run = useCallback((operation: () => Promise<void>): Promise<void> => {
    if (inFlightRef.current) return inFlightRef.current;
    const request = operation().finally(() => {
      inFlightRef.current = null;
    });
    inFlightRef.current = request;
    return request;
  }, []);

  const refetch = useCallback(() => run(resumeSession), [resumeSession, run]);
  const reauthenticate = useCallback(() => run(() => signForAction("authenticate")), [run, signForAction]);
  const onboardWallet = useCallback(() => run(() => signForAction("onboard")), [run, signForAction]);
  const retryAuthentication = useCallback(
    () => run(() => signForAction(lastActionRef.current)),
    [run, signForAction],
  );

  useEffect(() => {
    if (!isConnected || !address) {
      const frame = window.requestAnimationFrame(resetDisconnected);
      return () => window.cancelAnimationFrame(frame);
    }
    void run(resumeSession);
  }, [address, isConnected, resetDisconnected, resumeSession, run]);

  useEffect(() => {
    const handleStale = (event: Event): void => {
      if (authStateRef.current !== "ready") return;
      const detail = (event as CustomEvent<{ status?: number; code?: string | null }>).detail;
      if (detail?.code === "AUTH_ACTION_REQUIRED") {
        setAuthError("Fresh authenticate authorization is required for this workspace.");
        setAuthState("authorization-required");
        return;
      }
      if (detail?.code === "AUTH_USER_REQUIRED") {
        setUserState(null);
        setAuthError("Verified onboarding is required for this wallet.");
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
    await run(resumeSession);
  }, [resumeSession, run]);

  const setUser = useCallback((next: UserRecord | null): void => {
    setUserState(next);
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
        authIssue,
        authError,
        refreshAgentBalance,
        setUser,
        refetch,
        reauthenticate,
        onboardWallet,
        retryAuthentication,
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
