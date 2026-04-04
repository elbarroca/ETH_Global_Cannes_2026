// Enriches a Prisma Cycle row into the shape the dashboard UI consumes.
//
// Hierarchical hiring produces four sources of cycle data:
//   1. Prisma `cycles` table  — fast path: goal, payments (JSON), specialists
//      (JSON with picks inside), cached narrative, debate fields
//   2. Prisma `agent_actions` — source of truth for specialist hiredBy + tx
//   3. Prisma `users.fund` JSONB — current holdings at read time (ticker → amount)
//   4. 0G Storage (via `storageHash`) — canonical RichCycleRecord, on-demand only
//
// We read from (1) + (2) + (3) here for speed. 0G is reserved for the optional
// "verify on 0G" flow behind a `?full=true` query param (not used here yet).

import type { Cycle } from "@prisma/client";
import { getPrisma } from "../config/prisma";
import type { PaymentRecord, SpecialistResult, TokenPick } from "../types/index";
import type { CycleNarrative } from "../agents/narrative";

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
  swap?: {
    success: boolean;
    txHash?: string;
    explorerUrl?: string;
    method?: string;
  };
  seqNum: number;
  hashscanUrl: string | null;
  storageHash: string | null;
  inftTokenId: number | null;
  navAfter: number;
  totalCostUsd: number;
  /** User's current on-chain holdings (ticker → amount). Empty object if never traded. */
  holdings: Record<string, number>;
  /** Cached CycleNarrative written at commit time — null for legacy rows. */
  narrative: CycleNarrative | null;
}

interface StoredSpecialist {
  name?: string;
  signal?: string;
  confidence?: number;
  reasoning?: string;
  attestation?: string;
  attestationHash?: string;
  hiredBy?: string;
  paymentTxHash?: string;
  teeVerified?: boolean;
  picks?: TokenPick[] | null;
}

export async function enrichCycleRow(cycle: Cycle): Promise<EnrichedCycleResponse> {
  const prisma = getPrisma();

  // Fetch the SPECIALIST_HIRED audit actions for canonical hiredBy attribution.
  // These rows are written at the same moment hierarchical hiring completes,
  // so they always beat the Prisma cycle row. We key on cycleId (UUID).
  const actions = await prisma.agentAction.findMany({
    where: { cycleId: cycle.id, actionType: "SPECIALIST_HIRED" },
    orderBy: { createdAt: "asc" },
  });

  const hiredByIndex = new Map<string, { hiredBy: string; paymentTxHash: string; attestationHash: string }>();
  for (const a of actions) {
    if (!a.agentName) continue;
    const payload = (a.payload ?? {}) as { hiredBy?: string };
    hiredByIndex.set(a.agentName, {
      hiredBy: payload.hiredBy ?? "main-agent",
      paymentTxHash: a.paymentTxHash ?? "",
      attestationHash: a.attestationHash ?? "",
    });
  }

  // The `specialists` column is a JSON snapshot written by logCycleRecord.
  // In the hierarchical path we now write the full hiredBy + paymentTxHash
  // + picks inline (see main-agent.ts commitCycle step 5), so the JSON is
  // usually self-sufficient. We still merge AgentAction rows as a fallback
  // for rows written before this refactor.
  const rawSpecialists = Array.isArray(cycle.specialists) ? (cycle.specialists as unknown as StoredSpecialist[]) : [];
  const specialists = rawSpecialists.map((s) => {
    const name = s.name ?? "unknown";
    const fallback = hiredByIndex.get(name);
    return {
      name,
      signal: s.signal ?? "HOLD",
      confidence: Number(s.confidence ?? 0),
      reasoning: s.reasoning ?? "",
      attestationHash: s.attestationHash ?? s.attestation ?? fallback?.attestationHash ?? "",
      teeVerified: Boolean(s.teeVerified),
      hiredBy: s.hiredBy ?? fallback?.hiredBy ?? "main-agent",
      paymentTxHash: s.paymentTxHash ?? fallback?.paymentTxHash ?? "",
      picks: Array.isArray(s.picks) ? s.picks : undefined,
    };
  });

  // payments column: JSON array written by logCycleRecord. Fallback to the
  // agent-actions log when it's null (older cycles / flat path).
  const storedPayments = Array.isArray(cycle.payments) ? (cycle.payments as unknown as PaymentRecord[]) : [];
  const payments: PaymentRecord[] = storedPayments.length > 0
    ? storedPayments
    : actions
        .filter((a) => a.paymentTxHash && a.paymentTxHash !== "no-payment")
        .map<PaymentRecord>((a) => ({
          from: ((a.payload ?? {}) as { hiredBy?: string }).hiredBy ?? "main-agent",
          to: a.agentName ?? "unknown",
          amount: "$0.001",
          txHash: a.paymentTxHash ?? "",
          hiredBy: ((a.payload ?? {}) as { hiredBy?: string }).hiredBy ?? "main-agent",
          chain: "arc",
        }));

  // Holdings come from the user record's JSONB `fund.holdings` sub-field,
  // updated atomically after each successful swap (see main-agent.ts step 1c).
  // A user who never traded has no `holdings` key → empty object.
  const user = await prisma.user.findUnique({
    where: { id: cycle.userId },
    select: { fund: true },
  });
  const holdings =
    ((user?.fund ?? {}) as { holdings?: Record<string, number> }).holdings ?? {};

  // Narrative is cached as a JSON column — written by commitCycle's
  // logCycleRecord call. Legacy cycles (pre-narrative) will have null here.
  const narrative = (cycle.narrative as unknown as CycleNarrative | null) ?? null;

  return {
    cycleId: cycle.cycleNumber,
    cycleUuid: cycle.id,
    userId: cycle.userId,
    timestamp: cycle.createdAt.toISOString(),
    goal: cycle.goal ?? "",
    riskProfile: "balanced", // Not stored per-cycle; agent-level field lives on the user record
    specialists,
    debate: {
      alpha: {
        action: cycle.alphaAction ?? "HOLD",
        pct: cycle.alphaPct ?? 0,
        reasoning: cycle.alphaReasoning ?? "",
        attestationHash: cycle.alphaAttestation ?? "",
      },
      risk: {
        maxPct: cycle.riskMaxPct ?? 0,
        objection: cycle.riskChallenge ?? "",
        reasoning: cycle.riskReasoning ?? "",
        attestationHash: cycle.riskAttestation ?? "",
      },
      executor: {
        action: cycle.execAction ?? "HOLD",
        pct: cycle.execPct ?? 0,
        stopLoss: cycle.execStopLoss ?? "-5%",
        reasoning: cycle.execReasoning ?? "",
        attestationHash: cycle.execAttestation ?? "",
      },
    },
    payments,
    decision: {
      action: cycle.decision ?? "HOLD",
      asset: cycle.asset ?? "ETH",
      pct: cycle.decisionPct ?? 0,
      // The substitution flags live on the narrative (which is persisted as a
      // JSON blob on the cycles row) because we deliberately didn't add Prisma
      // columns for them — they're display metadata, not a schema concern.
      assetSubstituted: narrative?.assetSubstituted,
      originalAsset: narrative?.originalAsset,
    },
    swap: cycle.swapTxHash
      ? {
          success: true,
          txHash: cycle.swapTxHash,
          explorerUrl: cycle.swapExplorerUrl ?? undefined,
          method: "mock_swap",
        }
      : undefined,
    seqNum: cycle.hcsSeqNum ?? 0,
    hashscanUrl: cycle.hashscanUrl,
    storageHash: cycle.storageHash,
    inftTokenId: null, // Resolved from the user record on the client side if needed
    navAfter: cycle.navAfter ?? 0,
    totalCostUsd: cycle.totalCostUsd ?? 0,
    holdings,
    narrative,
  };
}

// The backend-side SpecialistResult has a broader surface — re-export the
// narrower UI-facing subset so route files import from one place.
export type EnrichedSpecialist = EnrichedCycleResponse["specialists"][number];
export type { SpecialistResult };
