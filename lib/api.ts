const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export interface UserRecord {
  id: string;
  walletAddress: string;
  linkCode?: string;
  telegram: {
    chatId: string | null;
    username: string | null;
    verified: boolean;
    notifyPreference: "every_cycle" | "trades_only" | "daily";
  };
  agent: {
    active: boolean;
    riskProfile: "conservative" | "balanced" | "aggressive";
    maxTradePercent: number;
    lastCycleId: number;
    lastCycleAt: string | null;
  };
  fund: {
    depositedUsdc: number;
    htsShareBalance: number;
    currentNav: number;
  };
  hotWalletIndex: number | null;
  hotWalletAddress: string | null;
  inftTokenId: number | null;
}

export interface SpecialistResult {
  name: string;
  signal: string;
  confidence: number;
  attestationHash: string;
  teeVerified: boolean;
}

export interface CycleResult {
  cycleId: number;
  hashscanUrl: string;
  specialists?: SpecialistResult[];
  debate?: {
    alpha?: { parsed?: { action: string; asset: string; pct: number; thesis?: string } };
    risk?: { parsed?: { maxSafePct: number; objection?: string } };
    executor?: {
      parsed?: { action: string; asset: string; pct: number; sl?: number; reasoning?: string };
    };
  };
  timestamp?: string;
}

export interface PlatformStats {
  tvl: number;
  cyclesRun: number;
  activeAgents: number;
}

export async function onboard(
  walletAddress: string,
  signature: string,
  message: string
): Promise<UserRecord> {
  return apiFetch("/api/onboard", {
    method: "POST",
    body: JSON.stringify({ walletAddress, signature, message }),
  });
}

export async function configure(
  userId: string,
  riskProfile: string,
  notifyPreference: string
): Promise<UserRecord> {
  return apiFetch("/api/configure", {
    method: "POST",
    body: JSON.stringify({ userId, riskProfile, notifyPreference }),
  });
}

export async function deposit(userId: string, amount: number): Promise<UserRecord> {
  return apiFetch("/api/deposit", {
    method: "POST",
    body: JSON.stringify({ userId, amount }),
  });
}

export async function withdraw(userId: string, amount: number): Promise<UserRecord> {
  return apiFetch("/api/withdraw", {
    method: "POST",
    body: JSON.stringify({ userId, amount }),
  });
}

export async function getUser(walletAddress: string): Promise<UserRecord | null> {
  return apiFetch<UserRecord | null>(`/api/user/${walletAddress}`).catch(() => null);
}

export async function getLatestCycle(userId: string): Promise<CycleResult | null> {
  return apiFetch<CycleResult | null>(`/api/cycle/latest/${userId}`).catch(() => null);
}

export async function getCycleHistory(
  userId: string,
  limit = 10,
  offset = 0
): Promise<CycleResult[]> {
  return apiFetch<CycleResult[]>(
    `/api/cycle/history/${userId}?limit=${limit}&offset=${offset}`
  ).catch(() => []);
}

export async function triggerCycle(userId: string): Promise<CycleResult> {
  return apiFetch(`/api/cycle/run/${userId}`, { method: "POST" });
}

export async function getStats(): Promise<PlatformStats> {
  return apiFetch<PlatformStats>("/api/stats").catch(() => ({
    tvl: 0,
    cyclesRun: 0,
    activeAgents: 0,
  }));
}
