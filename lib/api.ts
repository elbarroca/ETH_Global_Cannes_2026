import type { CycleNarrative } from "@/src/agents/narrative";
import type { TokenPick } from "@/src/types/index";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

const FETCH_RETRIES = 3;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...init?.headers },
        ...init,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error?: string }).error ?? res.statusText);
      }
      return res.json() as Promise<T>;
    } catch (e) {
      lastErr = e;
      const aborted = init?.signal?.aborted === true;
      const transient =
        e instanceof TypeError &&
        (e.message === "Failed to fetch" || e.message === "Load failed");
      if (aborted || !transient || attempt === FETCH_RETRIES) {
        throw e;
      }
      await new Promise((r) => setTimeout(r, 120 * attempt));
    }
  }
  throw lastErr;
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
    /** Persistent per-user hunt goal (max 280 chars). Empty string = unset —
     *  the cycle-analyze fallback will use the risk-profile template. */
    goal?: string;
  };
  fund: {
    depositedUsdc: number;
    htsShareBalance: number;
    currentNav: number;
    /** Ticker → token amount acquired through swaps (ETH, WETH, UNI, …). */
    holdings?: Record<string, number>;
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
  // Hierarchical hiring fields — tell the UI which debate agent paid for this
  // specialist and what the Arc payment tx hash was.
  hiredBy?: string;
  paymentTxHash?: string;
  priceUsd?: number;
  rawDataSnapshot?: unknown;
  /** Multi-token shortlist the specialist emitted (sentiment, momentum, …). */
  picks?: TokenPick[];
}

// Agent-to-agent payment attribution — who paid whom for which signal
export interface PaymentRecord {
  from: string; // human-readable hirer (alpha/risk/executor/main-agent)
  to: string; // specialist name
  amount: string; // "$0.001"
  txHash: string; // x402 / Arc payment tx hash
  hiredBy: string; // canonical role key — same as `from` when debate-hired
  chain: "arc" | "hedera";
}

export interface DebateStage {
  content: string;
  parsed: Record<string, unknown>;
  reasoning?: string;
  attestationHash: string;
  teeVerified: boolean;
}

export interface ArcSwapResultDto {
  success: boolean;
  txHash?: string;
  chain: "arc-testnet";
  explorerUrl?: string;
  method:
    | "uniswap_v3"
    | "direct_transfer"
    | "mock_swap"
    | "native_transfer"
    | "skipped";
  reason?: string;
  amountIn?: string;
  tokenIn?: string;
  tokenOut?: string;
}

export type SpecialistPath = "hierarchical_x402" | "direct_x402" | "openclaw_gateway";
export type OpenClawGatewayStatus = "active" | "offline";

export interface CycleProofs {
  hcs: boolean;
  storage: boolean;
  inft: boolean;
  naryo: boolean;
}

export interface CycleResult {
  cycleId: number;
  goal?: string;
  specialists: SpecialistResult[];
  debate: {
    alpha: DebateStage;
    risk: DebateStage;
    executor: DebateStage;
  };
  decision: Record<string, unknown>;
  payments?: PaymentRecord[];
  seqNum: number;
  hashscanUrl?: string;
  storageHash?: string;
  inftTokenId?: number;
  swapResult?: ArcSwapResultDto;
  specialistPath?: SpecialistPath;
  openclawGatewayStatus?: OpenClawGatewayStatus;
  proofs?: CycleProofs;
  degraded?: boolean;
  degradedReasons?: string[];
  timestamp: string;
  /** Synthesized cycle narrative — returned by commitCycle. */
  narrative?: CycleNarrative | null;
}

// The tiny HCS audit record. Still returned inside the pending-cycle response
// for approval-flow debugging; the dashboard itself reads EnrichedCycleResponse.
export interface CompactCycleRecord {
  c: number;
  u: string;
  t: string;
  rp: string;
  g?: string; // user goal (truncated)
  sh?: string; // 0G storage rootHash / CID
  s: Array<{ n: string; sig: string; conf: number; att: string }>;
  adv: {
    a: { act: string; pct: number; att: string; r?: string };
    r: { obj: string; max: number; att: string; r?: string };
    e: { act: string; pct: number; sl: number; att: string; r?: string };
  };
  d: { act: string; asset: string; pct: number };
  nav: number;
}

// Returned by /api/cycle/latest + /api/cycle/history. Enriched from Prisma
// `cycles` rows + `agent_actions` hiredBy attribution. This is the shape the
// dashboard renders directly — no more compact records from HCS mirror node.
export interface EnrichedCycleResponse {
  /** Integer cycle number scoped per user (display-friendly, 1-indexed). */
  cycleId: number;
  /** Database UUID for the cycles row — use this to query debate_transcripts. */
  cycleUuid: string;
  userId: string;
  timestamp: string;
  goal: string;
  riskProfile: string;
  specialists: Array<{
    name: string;
    signal: string;
    confidence: number;
    reasoning: string;
    attestationHash: string;
    teeVerified: boolean;
    hiredBy: string;
    paymentTxHash: string;
    reputation?: number;
    /** Multi-token shortlist (sentiment, momentum — empty for single-signal specialists). */
    picks?: TokenPick[];
  }>;
  debate: {
    alpha: { action: string; pct: number; reasoning: string; attestationHash: string };
    risk: { maxPct: number; objection: string; reasoning: string; attestationHash: string };
    executor: { action: string; pct: number; stopLoss: string; reasoning: string; attestationHash: string };
  };
  payments: PaymentRecord[];
  decision: {
    action: string;
    asset: string;
    pct: number;
    assetSubstituted?: boolean;
    originalAsset?: string;
  };
  swap?: { success: boolean; txHash?: string; explorerUrl?: string; method?: string };
  seqNum: number;
  hashscanUrl: string | null;
  storageHash: string | null;
  inftTokenId: number | null;
  navAfter: number;
  totalCostUsd: number;
  /** User's on-chain holdings at the time of this cycle (USDC + tokens). */
  holdings: Record<string, number>;
  /** Cached CycleNarrative — written at commitCycle time, read directly here. */
  narrative: CycleNarrative | null;
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
    /** Persistent hunt goal. Max 280 chars. Empty string clears it. */
    goal?: string;
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

// Live wallet balance is now polled directly via Arc RPC from UserContext.
// Every UI surface reads that single value — see contexts/user-context.tsx.

export async function getLatestCycle(userId: string): Promise<EnrichedCycleResponse | null> {
  return apiFetch<EnrichedCycleResponse | null>(`/api/cycle/latest/${userId}`).catch(() => null);
}

export async function getCycleHistory(
  userId: string,
  limit = 10,
  offset = 0
): Promise<EnrichedCycleResponse[]> {
  return apiFetch<EnrichedCycleResponse[]>(
    `/api/cycle/history/${userId}?limit=${limit}&offset=${offset}`
  ).catch(() => []);
}

export async function triggerCycle(userId: string, goal?: string): Promise<CycleResult> {
  return apiFetch(`/api/cycle/run/${userId}`, {
    method: "POST",
    body: JSON.stringify(goal ? { goal } : {}),
  });
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

export async function analyzeCycle(userId: string, goal?: string): Promise<PendingCycleResponse> {
  return apiFetch(`/api/cycle/analyze/${userId}`, {
    method: "POST",
    body: JSON.stringify(goal ? { goal } : {}),
  });
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
  walletAddress?: string | null;
  /** ISO timestamp of most recent SPECIALIST_HIRED row for this agent. */
  lastHireAt?: string | null;
  /** Count of SPECIALIST_HIRED rows for this agent (across all users). */
  recentHires?: number;
  /** Real ERC-7857 token ID on the VaultMindAgent contract. NULL if not minted. */
  inftTokenId?: number | null;
  /** 0G Storage Merkle root for this specialist's memory blob (soul + metadata). */
  storageRootHash?: string | null;
  /** Full `0g-storage://{rootHash}` URI — mirrors what's stored on-chain in encryptedURIs[tokenId]. */
  storageUri?: string | null;
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
  walletAddress?: string;
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

// ── Create Your Own Agent (dashboard + marketplace flow) ────────

export interface GeneratedInstructions {
  markdown: string;
  reasoning: string;
  attestationHash: string | null;
  teeVerified: boolean;
  fallback: boolean;
}

export async function generateAgentInstructions(
  name: string,
  description: string,
): Promise<GeneratedInstructions> {
  return apiFetch<GeneratedInstructions>("/api/marketplace/generate-instructions", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export interface CreatedAgent {
  id: string;
  name: string;
  emoji: string;
  price: string;
  reputation: number;
  tools: string[];
  description: string | null;
  instructions: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CreateAgentPayload {
  name: string;
  description: string;
  instructions: string;
  tools: string[];
  emoji?: string;
  createdBy?: string;
  attestationHash?: string | null;
}

export async function createMarketplaceAgent(
  payload: CreateAgentPayload,
): Promise<CreatedAgent> {
  return apiFetch<CreatedAgent>("/api/marketplace/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
