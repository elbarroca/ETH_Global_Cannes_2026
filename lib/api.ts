const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

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
  reputation?: number;
  rawDataSnapshot?: unknown;
}

export interface DebateStage {
  content: string;
  parsed: Record<string, unknown>;
  attestationHash: string;
  teeVerified: boolean;
}

export interface CycleResult {
  cycleId: number;
  specialists: SpecialistResult[];
  debate: {
    alpha: DebateStage;
    risk: DebateStage;
    executor: DebateStage;
  };
  decision: Record<string, unknown>;
  seqNum: number;
  hashscanUrl: string;
  timestamp: string;
}

export interface CompactCycleRecord {
  c: number;
  u: string;
  t: string;
  rp: string;
  s: Array<{ n: string; sig: string; conf: number; att: string }>;
  adv: {
    a: { act: string; pct: number; att: string };
    r: { obj: string; max: number; att: string };
    e: { act: string; pct: number; sl: number; att: string };
  };
  d: { act: string; asset: string; pct: number };
  nav: number;
}

export interface OnboardResponse {
  userId: string;
  proxyWalletAddress: string;
  telegramLinkCode: string;
  inftTokenId?: number | null;
  existing: boolean;
}

export interface PlatformStats {
  totalUsers: number;
  activeAgents: number;
  totalCyclesRun: number;
  totalValueLocked: number;
}

export async function onboard(
  walletAddress: string,
  signature: string,
  message: string
): Promise<OnboardResponse> {
  return apiFetch<OnboardResponse>("/api/onboard", {
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

export async function getLatestCycle(userId: string): Promise<CompactCycleRecord | null> {
  return apiFetch<CompactCycleRecord | null>(`/api/cycle/latest/${userId}`).catch(() => null);
}

export async function getCycleHistory(
  userId: string,
  limit = 10,
  offset = 0
): Promise<CompactCycleRecord[]> {
  return apiFetch<CompactCycleRecord[]>(
    `/api/cycle/history/${userId}?limit=${limit}&offset=${offset}`
  ).catch(() => []);
}

export async function triggerCycle(userId: string): Promise<CycleResult> {
  return apiFetch(`/api/cycle/run/${userId}`, { method: "POST" });
}

export async function getStats(): Promise<PlatformStats> {
  return apiFetch<PlatformStats>("/api/stats").catch(() => ({
    totalUsers: 0,
    activeAgents: 0,
    totalCyclesRun: 0,
    totalValueLocked: 0,
  }));
}
