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
  proxyWallet?: { address: string };
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
    approvalMode: "always" | "trades_only" | "auto";
    approvalTimeoutMin: number;
    cycleCount?: number;
    cyclePeriodMs?: number;
    cyclesRemaining?: number;
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
  reasoning?: string;
  attestationHash: string;
  teeVerified: boolean;
  reputation?: number;
  rawDataSnapshot?: unknown;
}

export interface DebateStage {
  content: string;
  parsed: Record<string, unknown>;
  reasoning?: string;
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
  storageHash?: string;
  inftTokenId?: number;
  timestamp: string;
}

export interface CompactCycleRecord {
  c: number;
  u: string;
  t: string;
  rp: string;
  s: Array<{ n: string; sig: string; conf: number; att: string }>;
  adv: {
    a: { act: string; pct: number; att: string; r?: string };
    r: { obj: string; max: number; att: string; r?: string };
    e: { act: string; pct: number; sl: number; att: string; r?: string };
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
  opts: {
    riskProfile?: string;
    notifyPreference?: string;
    approvalMode?: string;
    cycleCount?: number;
    cyclePeriodMs?: number;
  }
): Promise<UserRecord> {
  return apiFetch("/api/configure", {
    method: "POST",
    body: JSON.stringify({ userId, ...opts }),
  });
}

export async function deposit(userId: string, amount: number, txHash?: string): Promise<UserRecord> {
  return apiFetch("/api/deposit", {
    method: "POST",
    body: JSON.stringify({ userId, amount, txHash }),
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

// ── Pending cycle (two-phase approval flow) ──────────────────

export interface PendingCycleResponse {
  pendingId: string;
  cycleNumber: number;
  status: string;
  specialists: SpecialistResult[];
  debate: {
    alpha: DebateStage;
    risk: DebateStage;
    executor: DebateStage;
    rebuttalTriggered?: boolean;
  };
  compactRecord: CompactCycleRecord;
  expiresAt: string;
}

export async function analyzeCycle(userId: string): Promise<PendingCycleResponse> {
  return apiFetch(`/api/cycle/analyze/${userId}`, { method: "POST" });
}

export async function approveCycle(pendingId: string, userId: string, modifiedPct?: number): Promise<CycleResult> {
  return apiFetch(`/api/cycle/approve/${pendingId}`, {
    method: "POST",
    body: JSON.stringify({ userId, modifiedPct }),
  });
}

export async function rejectCycle(pendingId: string, userId: string, reason?: string): Promise<{ status: string; pendingId: string }> {
  return apiFetch(`/api/cycle/reject/${pendingId}`, {
    method: "POST",
    body: JSON.stringify({ userId, reason }),
  });
}

export async function getPendingCycle(userId: string): Promise<PendingCycleResponse | null> {
  return apiFetch<PendingCycleResponse | null>(`/api/cycle/pending/${userId}`).catch(() => null);
}

// ── Compute detail (full cycle + action log) ───────────────

export async function getCycleDetail(
  userId: string,
  cycleNumber: number
): Promise<import("@/lib/types").ComputeDetailResponse | null> {
  return apiFetch<import("@/lib/types").ComputeDetailResponse>(
    `/api/cycle/detail/${userId}/${cycleNumber}`
  ).catch(() => null);
}

// ── Trade execution ─────────────────────────────────────────

export interface TradeResult {
  success: boolean;
  txId?: string;
  error?: string;
  usdcAmount?: string;
}

export async function executeTrade(
  userId: string,
  action: string,
  asset: string,
  percentage: number,
): Promise<TradeResult> {
  return apiFetch<TradeResult>("/api/trade/execute", {
    method: "POST",
    body: JSON.stringify({ userId, action, asset, percentage }),
  });
}

export async function getStats(): Promise<PlatformStats> {
  return apiFetch<PlatformStats>("/api/stats").catch(() => ({
    totalUsers: 0,
    activeAgents: 0,
    totalCyclesRun: 0,
    totalValueLocked: 0,
  }));
}

export interface LeaderboardAgent {
  name: string;
  reputation: number;
  accuracy: number;
  totalHires: number;
  tags: string[];
  price: string;
  active: boolean;
}

export async function getLeaderboard(): Promise<LeaderboardAgent[]> {
  const data = await apiFetch<{ agents: LeaderboardAgent[] }>("/api/marketplace/leaderboard");
  return data.agents;
}

// ── Per-user hired agents ───────────────────────────────────

export interface HiredAgent {
  name: string;
  agentId: string;
  endpoint: string;
  tags: string[];
  price: string;
  reputation: number;
  totalHires: number;
  correctCalls: number;
  hiredAt: string;
}

export async function getMyAgents(userId: string): Promise<HiredAgent[]> {
  const data = await apiFetch<{ agents: HiredAgent[] }>(`/api/marketplace/my-agents?userId=${userId}`);
  return data.agents;
}

export async function hireAgent(userId: string, agentName: string): Promise<{ agentName: string }> {
  return apiFetch("/api/marketplace/hire", {
    method: "POST",
    body: JSON.stringify({ userId, agentName }),
  });
}

export async function fireAgent(userId: string, agentName: string): Promise<{ success: boolean }> {
  return apiFetch("/api/marketplace/fire", {
    method: "POST",
    body: JSON.stringify({ userId, agentName }),
  });
}
