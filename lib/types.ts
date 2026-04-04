import type { CycleNarrative } from "@/src/agents/narrative";
import type { TokenPick } from "@/src/types/index";

export interface Cycle {
  id: number;
  /** cycles.id (UUID) — used by DebateTheater to query debate_transcripts. */
  dbId?: string;
  timestamp: string;
  goal?: string;
  specialists: {
    name: string;
    emoji: string;
    analysis: string;
    reasoning?: string;
    signal?: string;
    confidence?: number;
    price: number;
    attestation: string;
    model: string;
    provider: string;
    inftId: string;
    // Hierarchical hiring attribution — which debate agent paid for this
    // specialist, and the Arc tx hash of that payment.
    hiredBy?: string;
    paymentTxHash?: string;
    /** Multi-token shortlist this specialist emitted — empty for single-signal specialists. */
    picks?: TokenPick[];
  }[];
  adversarial: {
    alpha: { argument: string; recommendation: string; attestation: string };
    risk: { argument: string; recommendation: string; attestation: string };
    executor: { argument: string; recommendation: string; attestation: string };
  };
  payments: {
    from: string;
    to: string;
    amount: number;
    txHash: string;
    hiredBy: string;
    chain: "arc" | "hedera";
  }[];
  hcs: { topicId: string; sequenceNumber: number; timestamp: string };
  trade: {
    action: "BUY" | "SELL" | "HOLD";
    asset: string;
    percentage: number;
    stopLoss: number | null;
    /** True when the executor's raw asset was rewritten by the EVM whitelist. */
    assetSubstituted?: boolean;
    /** Original ticker before validation, if substitution fired. */
    originalAsset?: string;
  };
  memory: { cycleRef: number; text: string }[];
  storageHash?: string;
  inftTokenId?: number;
  rebuttalTriggered?: boolean;
  swap?: {
    success: boolean;
    txHash?: string;
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
  };
  specialistPath?: "hierarchical_x402" | "direct_x402" | "openclaw_gateway";
  openclawGatewayStatus?: "active" | "offline";
  proofs?: {
    hcs: boolean;
    storage: boolean;
    inft: boolean;
    naryo: boolean;
  };
  degraded?: boolean;
  degradedReasons?: string[];
  debateTranscripts?: DebateTranscriptView[];
  /** User's on-chain holdings at cycle commit time (ticker → amount). */
  holdings?: Record<string, number>;
  /** Synthesized narrative — populated for enriched responses only. */
  narrative?: CycleNarrative | null;
}

export interface DebateTranscriptView {
  turnNumber: number;
  phase: string;
  fromAgent: string;
  toAgent: string | null;
  messageContent: string;
  responseContent: string | null;
  attestationHash: string | null;
  teeVerified: boolean;
  durationMs: number | null;
  createdAt: string;
}

export interface FundState {
  nav: number;
  navChange24h: number;
  totalCycles: number;
  totalPayments: number;
  totalSpend: number;
  winRate: number;
  totalInferences: number;
  positions: { asset: string; percentage: number }[];
  userShares: number;
  userDeposited: number;
  userValue: number;
}

export interface AgentActionRecord {
  id: string;
  actionType: string;
  agentName: string | null;
  status: string;
  payload: unknown;
  attestationHash: string | null;
  teeVerified: boolean;
  paymentAmount: string | null;
  paymentNetwork: string | null;
  paymentTxHash: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface CycleDetail {
  id: string;
  userId: string;
  cycleNumber: number;
  specialists: unknown;
  alphaAction: string | null;
  alphaPct: number | null;
  alphaAttestation: string | null;
  riskChallenge: string | null;
  riskMaxPct: number | null;
  riskAttestation: string | null;
  execAction: string | null;
  execPct: number | null;
  execStopLoss: string | null;
  execAttestation: string | null;
  decision: string | null;
  asset: string | null;
  decisionPct: number | null;
  hcsSeqNum: number | null;
  hashscanUrl: string | null;
  storageHash: string | null;
  totalCostUsd: number | null;
  navAfter: number | null;
  createdAt: string;
}

export interface ComputeDetailResponse {
  cycle: CycleDetail;
  actions: AgentActionRecord[];
}

export interface Agent {
  name: string;
  /** Canonical short registry name (e.g. "whale") — used to key into swarm health + earnings maps. */
  registryName?: string;
  emoji: string;
  skill: string;
  accuracy: number;
  timesHired: number;
  /**
   * ELO-style reputation score (0-1000, initial 500). Updated by thumbs
   * up/down on hunt cards via POST /api/marketplace/rate → reputation.ts.
   * Headline number on the marketplace cards.
   */
  reputation: number;
  pricePerQuery: number;
  inftId: string;
  model: string;
  provider: string;
  creator: string;
  isActive: boolean;
  walletAddress?: string;
  /** Real ERC-7857 token ID on the VaultMindAgent contract. NULL if not minted. */
  inftTokenId?: number | null;
  /** 0G Storage root hash for this agent's memory blob. */
  storageRootHash?: string | null;
  /** Full 0g-storage:// URI — equal to what's bound on-chain in encryptedURIs. */
  storageUri?: string | null;
  /** ISO timestamp of the most recent SPECIALIST_HIRED row. */
  lastHireAt?: string | null;
}

// ── Swarm Observatory (Tier 1) ───────────────────────────────────────
// Types returned by /api/swarm/* and /api/marketplace/earnings. Each maps
// 1:1 to a response shape — do not mutate without updating the routes.

export type SwarmHealthState = "online" | "waking" | "offline" | "timeout";
export type SwarmRole = "specialist" | "adversarial";

export interface SwarmHealthAgent {
  name: string;
  role: SwarmRole;
  status: SwarmHealthState;
  latencyMs: number | null;
  error: string | null;
  lastChecked: string;
}

export interface SwarmHealthResponse {
  generatedAt: string;
  summary: {
    total: number;
    online: number;
    waking: number;
    offline: number;
  };
  agents: SwarmHealthAgent[];
}

export interface SwarmMetricsResponse {
  last24h: {
    cycles: number;
    hires: number;
    debateTurns: number;
    teeAttestations: number;
    paymentsUsd: number;
  };
  allTime: {
    cycles: number;
    specialistCalls: number;
    totalUsdSpent: number;
  };
  generatedAt: string;
}

export interface SwarmActivityRow {
  id: string;
  actionType: string;
  agentName: string | null;
  status: string;
  attestationHash: string | null;
  teeVerified: boolean | null;
  paymentAmount: string | null;
  paymentNetwork: string | null;
  paymentTxHash: string | null;
  durationMs: number | null;
  createdAt: string;
  /**
   * Arbitrary JSON blob from `agent_actions.payload`. Currently used by the
   * ticker for `AGENT_RATED` rows (carries kind + reputationBefore/After) but
   * other action types may populate it with per-event context (hire signal,
   * swap method, etc.). Shape is action-type-dependent — callers narrow.
   */
  payload: Record<string, unknown> | null;
}

export interface SwarmActivityResponse {
  rows: SwarmActivityRow[];
  generatedAt: string;
}

export interface AgentEarnings {
  agentName: string;
  totalUsd: number;
  hires: number;
  lastHireAt: string | null;
}

export interface MarketplaceEarningsResponse {
  agents: Record<string, AgentEarnings>;
  generatedAt: string;
}

/** One row from debate_transcripts — matches /api/cycle/debate/[cycleId] response. */
export interface DebateTurn {
  id: string;
  turnNumber: number;
  phase: "intelligence" | "opening" | "rebuttal" | "decision" | "execution" | string;
  fromAgent: string;
  toAgent: string | null;
  messageContent: string;
  responseContent: string | null;
  attestationHash: string | null;
  teeVerified: boolean;
  durationMs: number | null;
  createdAt: string;
}

export interface DebateTranscriptResponse {
  transcripts: DebateTurn[];
  count: number;
}
