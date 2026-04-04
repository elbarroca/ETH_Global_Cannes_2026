// ELO-style reputation scoring for specialist agents

import { getPrisma } from "../config/prisma.js";

const K_FACTOR = 32;
const DEFAULT_RATING = 500;

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
