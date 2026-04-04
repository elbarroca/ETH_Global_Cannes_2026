// ELO-style reputation scoring for specialist agents

import { getPrisma } from "../config/prisma";

const K_FACTOR = 32;
const DEFAULT_RATING = 500;

export type RatingKind = "like" | "dislike" | "verify";

// ── ELO calculation ──────────────────────────────────────────

function eloUpdate(currentRating: number, wasCorrect: boolean): number {
  // Expected score against a "market" opponent rated at DEFAULT_RATING
  const expected = 1 / (1 + Math.pow(10, (DEFAULT_RATING - currentRating) / 400));
  const actual = wasCorrect ? 1 : 0;
  const newRating = currentRating + K_FACTOR * (actual - expected);
  return Math.round(Math.max(0, Math.min(1000, newRating)));
}

// ── Update specialist reputation after cycle ─────────────────

export async function updateSpecialistReputation(
  name: string,
  wasCorrect: boolean,
): Promise<number> {
  const prisma = getPrisma();
  const agent = await prisma.marketplaceAgent.findUnique({ where: { name } });
  if (!agent) return DEFAULT_RATING;

  const newReputation = eloUpdate(agent.reputation, wasCorrect);

  await prisma.marketplaceAgent.update({
    where: { name },
    data: {
      reputation: newReputation,
      correctCalls: wasCorrect ? { increment: 1 } : undefined,
    },
  });

  return newReputation;
}

// ── Evaluate specialist signals against actual outcome ───────

export async function evaluateCycleSignals(
  specialists: Array<{ name: string; signal: string }>,
  priceChangePercent: number,
): Promise<void> {
  // Determine actual direction from price change
  const actualDirection =
    priceChangePercent > 0.5 ? "BUY" : priceChangePercent < -0.5 ? "SELL" : "HOLD";

  for (const sp of specialists) {
    const wasCorrect =
      sp.signal === actualDirection ||
      (sp.signal === "HOLD" && Math.abs(priceChangePercent) < 1);
    const newRep = await updateSpecialistReputation(sp.name, wasCorrect);
    console.log(
      `[reputation] ${sp.name}: ${sp.signal} vs ${actualDirection} → ${wasCorrect ? "correct" : "wrong"} (rep: ${newRep})`,
    );
  }
}

// ── Record user rating with full history ─────────────────────
//
// Canonical rating write path. Unlike `updateSpecialistReputation()` above
// (which mutates `marketplace_agents.reputation` without leaving a trail),
// this helper:
//
//   1. Loads the current reputation → `reputationBefore`.
//   2. Runs the ELO math against the vote polarity (like/verify positive,
//      dislike negative).
//   3. Inside a transaction, upserts the `AgentRating` row keyed on
//      (userId, agentName, cycleId) and updates `marketplace_agents.reputation`
//      in lockstep. Flipping a vote on the same (user × specialist × cycle)
//      rewrites the same row — the on-chain HCS log retains the full history
//      of flips because each API call emits a fresh `ev: "rating"` message.
//
// Does NOT log to HCS — the API route wraps this call, awaits the HCS write,
// and then stamps the returned seq number back onto the same `AgentRating` row.
// Separating concerns lets the HCS network outage path degrade gracefully
// (the Supabase rating still commits).

export interface RecordRatingArgs {
  userId: string;
  agentName: string;
  cycleId: number;
  kind: RatingKind;
}

export interface RecordRatingResult {
  ratingId: string;
  reputationBefore: number;
  reputationAfter: number;
}

export async function recordRating(
  args: RecordRatingArgs,
): Promise<RecordRatingResult> {
  const prisma = getPrisma();

  const agent = await prisma.marketplaceAgent.findUnique({
    where: { name: args.agentName },
    select: { reputation: true },
  });
  if (!agent) {
    throw new Error(`Marketplace agent not found: ${args.agentName}`);
  }

  const reputationBefore = agent.reputation;
  const positive = args.kind !== "dislike";
  const reputationAfter = eloUpdate(reputationBefore, positive);

  // Transactional update: the agent_ratings row and marketplace_agents row
  // must agree on the after-value, otherwise a crash between the two would
  // leave the audit trail inconsistent with the displayed ELO.
  const rating = await prisma.$transaction(async (tx) => {
    await tx.marketplaceAgent.update({
      where: { name: args.agentName },
      data: { reputation: reputationAfter },
    });

    return tx.agentRating.upsert({
      where: {
        userId_agentName_cycleId: {
          userId: args.userId,
          agentName: args.agentName,
          cycleId: args.cycleId,
        },
      },
      create: {
        userId: args.userId,
        agentName: args.agentName,
        cycleId: args.cycleId,
        kind: args.kind,
        reputationBefore,
        reputationAfter,
      },
      update: {
        kind: args.kind,
        reputationBefore,
        reputationAfter,
        hcsSeqNum: null, // invalidate prior HCS stamp — caller will re-log
        hcsTopicId: null,
      },
    });
  });

  return {
    ratingId: rating.id,
    reputationBefore,
    reputationAfter,
  };
}

// Attach the HCS sequence number emitted by `logSwarmEvent` back to a rating
// row. Fire-and-forget — a failed stamp must not invalidate the rating itself
// because the Supabase write already succeeded.
export async function attachHcsSeqToRating(
  ratingId: string,
  hcsSeqNum: number,
  hcsTopicId: string,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.agentRating.update({
    where: { id: ratingId },
    data: { hcsSeqNum, hcsTopicId },
  });
}

// Expose ELO math for callers that want the new value without writing to DB
// (e.g. the legacy /rate fast-path that doesn't carry userId/cycleId).
export { eloUpdate };

// ── Leaderboard ──────────────────────────────────────────────

export async function getLeaderboard(
  limit = 10,
): Promise<Array<{ name: string; reputation: number; accuracy: number; totalHires: number }>> {
  const prisma = getPrisma();
  const agents = await prisma.marketplaceAgent.findMany({
    where: { active: true },
    orderBy: { reputation: "desc" },
    take: limit,
  });
  return agents.map((a) => ({
    name: a.name,
    reputation: a.reputation,
    accuracy: a.totalHires > 0 ? Math.round((a.correctCalls / a.totalHires) * 100) : 0,
    totalHires: a.totalHires,
  }));
}
