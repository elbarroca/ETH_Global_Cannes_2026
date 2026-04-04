export type PendingCycleStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "TIMED_OUT";
export type CycleOrigin = "ui" | "telegram" | "heartbeat";

export interface AnalysisResult {
  userId: string;
  cycleId: number;
  specialists: SpecialistResult[];
  debate: DebateResult;
  compactRecord: CompactCycleRecord;
}

export interface PendingCycleRecord {
  id: string;
  userId: string;
  cycleNumber: number;
  status: PendingCycleStatus;
  origin: CycleOrigin;
  specialists: SpecialistResult[];
  debate: DebateResult;
  compactRecord: CompactCycleRecord;
  expiresAt: string;
  telegramMsgId: number | null;
}

export interface UserRecord {
  id: string;
  walletAddress: string;
  proxyWallet: { walletId: string; address: string };
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
  createdAt: string;
  updatedAt: string;
}

export interface InferenceResult {
  content: string;
  attestationHash: string;
  teeVerified: boolean;
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
  [key: string]: unknown;
}

export interface DebateStageResult {
  content: string;
  parsed: Record<string, unknown>;
  reasoning?: string;
  attestationHash: string;
  teeVerified: boolean;
}

export type DebatePhase = "intelligence" | "opening" | "rebuttal" | "decision" | "execution";

export interface DebateTranscriptEntry {
  turnNumber: number;
  phase: DebatePhase;
  fromAgent: string;
  toAgent?: string;
  messageContent: string;
  responseContent?: string;
  attestationHash?: string;
  teeVerified?: boolean;
  durationMs: number;
}

export interface DebateResult {
  alpha: DebateStageResult;
  risk: DebateStageResult;
  executor: DebateStageResult;
  rebuttalTriggered?: boolean;
  transcripts?: DebateTranscriptEntry[];
  totalDurationMs?: number;
  totalTurns?: number;
}

export interface ArcSwapResult {
  success: boolean;
  txHash?: string;
  chain: "arc-testnet";
  explorerUrl?: string;
  method: "uniswap_v3" | "direct_transfer" | "mock_swap" | "native_transfer" | "skipped";
  reason?: string;
  amountIn?: string;
  tokenIn?: string;
  tokenOut?: string;
}

export interface CycleResult {
  userId: string;
  cycleId: number;
  specialists: SpecialistResult[];
  debate: DebateResult;
  decision: Record<string, unknown>;
  seqNum: number;
  hashscanUrl: string;
  storageHash?: string;
  inftTokenId?: number;
  swapResult?: ArcSwapResult;
  timestamp: Date;
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
