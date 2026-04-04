export type PendingCycleStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "TIMED_OUT";
export type CycleOrigin = "ui" | "telegram" | "heartbeat";

export type SpecialistPath = "hierarchical_x402" | "direct_x402" | "openclaw_gateway";
export type OpenClawGatewayStatus = "active" | "offline";

export interface CycleProofs {
  hcs: boolean;
  storage: boolean;
  inft: boolean;
  naryo: boolean;
}

export interface AnalysisResult {
  userId: string;
  cycleId: number;
  goal: string;
  specialists: SpecialistResult[];
  debate: DebateResult;
  compactRecord: CompactCycleRecord;
  richRecord: RichCycleRecord;
  // Runtime-only metadata — captured during analyzeCycle, re-derived on approve path
  specialistPath?: SpecialistPath;
  openclawGatewayStatus?: OpenClawGatewayStatus;
}

export interface PendingCycleRecord {
  id: string;
  userId: string;
  cycleNumber: number;
  goal: string;
  status: PendingCycleStatus;
  origin: CycleOrigin;
  specialists: SpecialistResult[];
  debate: DebateResult;
  compactRecord: CompactCycleRecord;
  richRecord: RichCycleRecord;
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
    /** Ticker → on-chain token amount bought via swaps. Populated by
     * computeHoldingsUpdate() after each successful swap via atomic JSONB
     * merge in updateUser(). Optional because users who never traded won't
     * have the sub-field set. */
    holdings?: Record<string, number>;
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

/**
 * Real-time liquidity snapshot fetched at cycle start and propagated into every
 * specialist data payload + debate context. Ensures all percentage decisions
 * are grounded in the user's actual on-chain buying power, not a stale DB
 * value. See src/agents/data/liquidity-injector.ts.
 */
export interface CycleLiquidity {
  /** Real-time Circle MPC proxy wallet USDC balance (source of truth). */
  proxyUsd: number;
  /** Real-time Arc hot-wallet USDC balance. */
  hotUsd: number;
  /** Honest budget available for this cycle: min(proxyUsd, depositedUsd). */
  availableUsd: number;
  /** Stale Prisma-cached deposit value — kept for drift comparison. */
  depositedUsd: number;
  /** ISO timestamp of the snapshot — stale snapshots should be re-fetched. */
  timestamp: string;
}

/**
 * A multi-token pick emitted by a specialist. When specialists extend beyond
 * ETH-only analysis (sentiment, momentum, news-scanner etc.), they output
 * 1-3 picks here so the augmented layer can see the full shortlist and the
 * executor can choose which asset to actually trade.
 */
export interface TokenPick {
  asset: string; // ticker — "BTC", "ETH", "SOL", "UNI", etc.
  signal: "BUY" | "SELL" | "HOLD";
  confidence: number; // 0-100
  reason: string; // one-clause justification
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
  hiredBy?: string;
  paymentTxHash?: string;
  priceUsd?: number;
  /** Multi-token shortlist — present when the specialist's prompt emits picks[]. */
  picks?: TokenPick[];
  [key: string]: unknown;
}

// Pure network result from callSpecialist() — no DB side effects
export interface CallSpecialistResult {
  name: string;
  signal: string;
  confidence: number;
  reasoning: string;
  attestationHash: string;
  teeVerified: boolean;
  rawDataSnapshot: unknown;
  paymentTxHash: string;
  priceUsd: number;
  durationMs: number;
  /** Multi-token shortlist — parsed from the specialist's JSON response. */
  picks?: TokenPick[];
  /** Full parsed JSON output from the LLM — used by the swarm audit trail
   *  to persist byte-for-byte reproducible specialist output to 0G Storage. */
  parsed?: Record<string, unknown>;
}

// Response from a debate agent's /hire-and-analyze endpoint
export interface DebateAgentResponse {
  name: "alpha" | "risk" | "executor";
  content: string;
  reasoning: string;
  parsed: Record<string, unknown>;
  attestationHash: string;
  teeVerified: boolean;
  specialists_hired: Array<{
    name: string;
    signal: string;
    confidence: number;
    reasoning?: string;
    attestation: string;
    teeVerified?: boolean;
    paymentTxHash: string;
    priceUsd: number;
    rawDataSnapshot?: unknown;
    /** Multi-token shortlist — forwarded from the specialist's response. */
    picks?: TokenPick[];
  }>;
  total_cost_usd: number;
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
  goal: string;
  specialists: SpecialistResult[];
  debate: DebateResult;
  decision: Record<string, unknown>;
  payments: PaymentRecord[];
  seqNum: number;
  hashscanUrl?: string;
  storageHash?: string;
  inftTokenId?: number;
  swapResult?: ArcSwapResult;
  timestamp: Date;
  specialistPath: SpecialistPath;
  openclawGatewayStatus: OpenClawGatewayStatus;
  proofs: CycleProofs;
  degraded: boolean;
  degradedReasons: string[];
  /** Full augmented-layer narrative — what each agent said + why. */
  narrative?: import("../agents/narrative").CycleNarrative;
}

// Swarm audit events — one HCS message per swarm interaction within a cycle.
// Each cycle emits a cluster: start → N×hire → M×turn → done. All events carry
// the cycle number `c` so independent verifiers can group them off the topic.
//
// HCS events are the **compact ordered audit pointers**. The full input/output
// data (market data the specialist saw, complete parsed JSON, full userMessage,
// full LLM content, payment proof, TEE attestation, duration) lives on 0G
// Storage — each hire and turn event carries an `sh` field with the 0G rootHash
// so readers can hop from the ordered HCS audit log to the content-addressable
// full-fidelity record (see RichHireData / RichTurnData below).
//
// HCS events must fit inside the 1024-byte message limit; `cot[]` entries are
// the elastic field and get truncated first if an event overflows. The `sh`
// pointer compensates — truncated cot preview on HCS, full cot on 0G.
export type SwarmEventRecord =
  | {
      ev: "start";
      c: number;
      u: string; // full user id on the start event (shortened on later events)
      t: string; // ISO timestamp
      rp: string; // risk profile
      g?: string; // user goal (truncated to 120 chars)
    }
  | {
      ev: "hire";
      c: number;
      by: string; // hiring agent ("main" | "alpha" | "risk" | "executor")
      to: string; // specialist name
      sig: string; // signal verdict ("BUY" | "SELL" | "HOLD")
      conf: number; // confidence 0-100
      cot: string[]; // chain-of-thought preview (≤5 × ≤100 chars)
      att: string; // attestation hash (truncated to 16 chars)
      sh?: string; // 0G Storage rootHash → full RichHireData
    }
  | {
      ev: "turn";
      c: number;
      t: number; // turnNumber within the debate
      ph: "opening" | "rebuttal" | "decision"; // phase
      from: string; // speaking agent ("alpha" | "risk" | "executor")
      to?: string; // addressed agent (for rebuttals)
      cot: string[]; // chain-of-thought preview
      verdict: Record<string, unknown>; // compacted structured decision
      att: string; // attestation hash (truncated)
      sh?: string; // 0G Storage rootHash → full RichTurnData
    }
  | {
      ev: "done";
      c: number;
      d: { act: string; asset: string; pct: number };
      sh?: string; // 0G Storage CID of the aggregate RichCycleRecord
      nav: number;
    }
  | {
      // User feedback on a specialist — the on-chain point-in-time proof of
      // an ELO mutation. Produced by POST /api/marketplace/rate after the
      // corresponding `agent_ratings` row lands in Supabase. Small enough
      // (~130 bytes) to never need the cot[] truncation path in logSwarmEvent.
      ev: "rating";
      c: number; // cycle number the rating is scoped to
      sn: string; // specialist name (marketplace_agents.name)
      uid: string; // user id (first 8 chars, consistent with other events)
      k: "like" | "dislike" | "verify";
      rb: number; // reputation before
      ra: number; // reputation after
      t: string; // ISO timestamp
    };

// Full-fidelity hire payload persisted to 0G Storage alongside the compact HCS
// `hire` event. HCS readers fetch this via `loadMemory(event.sh)` to get the
// complete input + output of a single specialist-hiring interaction.
//
// This is the provenance layer that makes the audit trail VERIFIABLE — HCS
// gives ordering + cot preview, 0G gives the exact market data the LLM saw and
// the exact JSON it produced, both content-addressed. Maps directly to the
// Hedera "Verifiable payment audit trails using HCS" bounty criterion and the
// 0G "share memory on Storage" DeFi swarm narrative.
export interface RichHireData {
  schemaVersion: 1;
  eventKind: "hire";
  cycleId: number;
  userId: string;
  timestamp: string;
  specialist: string; // e.g., "sentiment", "momentum", "onchain-forensics"
  hiredBy: string; // "main" | "alpha" | "risk" | "executor"
  input: {
    task: string; // task description passed to callSpecialist
    marketData: unknown; // rawDataSnapshot — exact data the LLM saw
  };
  output: {
    signal: string;
    confidence: number;
    parsed: Record<string, unknown>; // complete parsed JSON from the LLM
    reasoning: string; // full pre-JSON narrative reasoning
    cot: string[]; // untruncated chain-of-thought steps
    picks: TokenPick[] | null; // multi-token shortlist, untruncated
  };
  attestation: {
    hash: string; // full chatcmpl-* or 0G attestation (not truncated)
    teeVerified: boolean;
  };
  payment: {
    txHash: string;
    priceUsd: number;
    network: "arc" | "hedera" | "none";
  };
  durationMs: number;
}

// Full-fidelity debate turn payload persisted to 0G Storage alongside the
// compact HCS `turn` event. Captures the exact conversational context each
// debate agent saw (userMessage) and the exact LLM output it produced
// (content + parsed + reasoning) so independent verifiers can reconstruct the
// multi-agent dialogue byte-for-byte from HCS seq numbers + 0G rootHashes.
export interface RichTurnData {
  schemaVersion: 1;
  eventKind: "turn";
  cycleId: number;
  userId: string;
  timestamp: string;
  turnNumber: number;
  phase: DebatePhase;
  from: string; // "alpha" | "risk" | "executor"
  to?: string;
  input: {
    systemPromptName: string; // "alpha" | "risk" | "executor" (ref to PROMPTS[key])
    userMessage: string; // exact prompt built in adversarial.ts including specContext
    debateCtx?: Record<string, unknown>; // hierarchical path: ctx sent to Fly.io
  };
  output: {
    content: string; // complete raw LLM response (pre-JSON narrative + JSON)
    parsed: Record<string, unknown>; // full parsed JSON (not compacted)
    reasoning: string; // narrative captured by parseDualOutput
    cot: string[]; // untruncated chain-of-thought
  };
  attestation: {
    hash: string;
    teeVerified: boolean;
  };
  durationMs: number;
}

// The lean record that gets serialised to HCS (must fit under 1024 bytes).
// Payment graph + goal text + full reasoning live in 0G Storage instead — this
// record is the audit pointer: who/when/what decision + storageHash (`sh`) so
// independent verifiers can fetch the rich record from 0G.
export interface CompactCycleRecord {
  c: number;
  u: string;
  t: string;
  rp: string;
  g?: string; // user goal (truncated)
  sh?: string; // 0G storage rootHash / CID — points at the RichCycleRecord
  s: Array<{ n: string; sig: string; conf: number; att: string }>;
  adv: {
    a: { act: string; pct: number; att: string; r?: string };
    r: { obj: string; max: number; att: string; r?: string };
    e: { act: string; pct: number; sl: number; att: string; r?: string };
  };
  d: { act: string; asset: string; pct: number };
  nav: number;
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

// The full cycle record persisted to 0G Storage. This is the source of truth
// for the UI payment-graph view and the "verify on 0G" independent check.
// HCS keeps a tiny pointer (`CompactCycleRecord.sh`), Prisma keeps a fast-path
// cached copy of `payments[]` + `goal` for list queries.
export interface RichCycleRecord {
  version: 1;
  cycleId: number;
  userId: string;
  timestamp: string;
  goal: string;
  riskProfile: string;
  specialists: Array<{
    name: string;
    signal: string;
    confidence: number;
    reasoning: string;
    attestationHash: string; // full, not truncated
    teeVerified: boolean;
    hiredBy: string;
    paymentTxHash: string;
    priceUsd: number;
    reputation: number;
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
    /** True when the executor 7B emitted a non-EVM ticker that was substituted. */
    assetSubstituted?: boolean;
    /** Original ticker the executor tried to use before validation. */
    originalAsset?: string;
  };
  swap?: { success: boolean; txHash?: string; explorerUrl?: string; method: string };
  /** Real-time liquidity snapshot taken at cycle start — the budget alpha/risk/executor reasoned against. */
  cycleLiquidity?: CycleLiquidity;
  /** Full augmented-layer narrative persisted with the record for permanent audit. */
  narrative?: import("../agents/narrative").CycleNarrative;
  nav: number;
}
