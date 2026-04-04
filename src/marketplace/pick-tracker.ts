// Per-pick performance tracking for specialists.
//
// When a specialist picks a token, we snapshot the entry price and timestamp.
// A later evaluator job scores the pick by comparing entry → exit price, then
// updates the specialist's marketplace reputation. Over time, consistently
// wrong specialists get fired and replaced (see hire-fire.ts — planned).
//
// See docs/SYSTEM_STATE_AND_FIXES.md Problem 5 + Problem 6 for the full
// design. This file implements the RECORD + EVALUATE halves; the FIRE step
// lives in src/marketplace/hire-fire.ts (stub, pending).

import { getPrisma } from "../config/prisma";
import { getTokenPrice } from "../payments/circle-wallet";
import { logAction } from "../store/action-logger";
import { updateSpecialistReputation } from "./reputation";
import type { SpecialistResult, TokenPick } from "../types/index";

/** How much the price must move to count as a decisive signal (not noise).
 *  Below this threshold, a BUY or SELL pick is considered "neutral" — we
 *  neither reward nor penalize, since the market itself didn't commit to
 *  a direction. HOLD picks are counted as correct in the neutral band. */
const SIGNAL_NOISE_THRESHOLD_PCT = 2.0;

/**
 * Record every pick from every specialist with the current USD price.
 * Non-fatal — if CoinGecko fails, we skip the pick rather than block the
 * cycle. Evaluation happens in a separate later call.
 */
export async function recordPickEntries(params: {
  cycleId: string;
  cycleNumber: number;
  userId: string;
  specialists: SpecialistResult[];
}): Promise<number> {
  const { cycleId, cycleNumber, userId, specialists } = params;
  const prisma = getPrisma();
  let recorded = 0;

  for (const spec of specialists) {
    const picks: TokenPick[] = spec.picks ?? [];
    if (picks.length === 0) continue;

    for (const pick of picks) {
      try {
        const priceUsd = await getTokenPrice(pick.asset).catch(() => null);
        if (priceUsd == null || priceUsd <= 0) {
          // Skip picks we can't price — we can't evaluate them later anyway.
          continue;
        }

        await prisma.specialistPickEntry.create({
          data: {
            cycleId,
            cycleNumber,
            userId,
            specialistName: spec.name,
            asset: pick.asset.toUpperCase(),
            signal: pick.signal,
            confidence: Math.max(0, Math.min(100, pick.confidence)),
            reason: pick.reason.slice(0, 500),
            entryPriceUsd: priceUsd,
            scored: false,
          },
        });
        recorded++;
      } catch (err) {
        console.warn(
          `[pick-tracker] failed to record ${spec.name}:${pick.asset}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }

  if (recorded > 0) {
    console.log(`[pick-tracker] recorded ${recorded} pick entries for cycle ${cycleNumber}`);
    await logAction({
      userId,
      actionType: "CYCLE_COMPLETED",
      agentName: "pick-tracker",
      payload: { stage: "pick_entries_recorded", count: recorded, cycleNumber },
    }).catch(() => {});
  }

  return recorded;
}

/**
 * Evaluate all pick entries whose evaluation window has elapsed. Fetches
 * current prices, computes P&L per pick, marks correct/incorrect, updates
 * specialist reputation, and writes audit rows.
 *
 * Designed to be called on a cadence (e.g. every heartbeat tick, or a
 * standalone cron). Each call processes up to `batchSize` stale picks.
 *
 * @param windowHours How long to wait after entry before evaluating.
 * @param batchSize Max picks to score per invocation.
 */
export async function evaluatePickPerformance(params: {
  windowHours?: number;
  batchSize?: number;
} = {}): Promise<{ scored: number; correct: number; wrong: number; neutral: number }> {
  const windowHours = params.windowHours ?? 24;
  const batchSize = params.batchSize ?? 50;
  const prisma = getPrisma();

  const cutoff = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const stalePicks = await prisma.specialistPickEntry.findMany({
    where: { scored: false, enteredAt: { lt: cutoff } },
    orderBy: { enteredAt: "asc" },
    take: batchSize,
  });

  if (stalePicks.length === 0) {
    return { scored: 0, correct: 0, wrong: 0, neutral: 0 };
  }

  console.log(
    `[pick-evaluator] scoring ${stalePicks.length} picks entered before ${cutoff.toISOString()}`,
  );

  // Group by asset so we only hit CoinGecko once per ticker
  const assetsToPrice = new Set(stalePicks.map((p) => p.asset));
  const priceMap = new Map<string, number>();
  for (const asset of assetsToPrice) {
    const price = await getTokenPrice(asset).catch(() => null);
    if (price != null && price > 0) priceMap.set(asset, price);
  }

  let correct = 0;
  let wrong = 0;
  let neutral = 0;

  for (const pick of stalePicks) {
    const exitPrice = priceMap.get(pick.asset);
    if (exitPrice == null) {
      // Price unavailable — skip and leave unscored; try again next run.
      continue;
    }
    const pnlPct = ((exitPrice - pick.entryPriceUsd) / pick.entryPriceUsd) * 100;

    // Decide correctness based on signal direction vs actual price movement.
    let isCorrect: boolean | null = null;
    if (Math.abs(pnlPct) < SIGNAL_NOISE_THRESHOLD_PCT) {
      // Price didn't move enough — HOLD is right, BUY/SELL is neutral.
      isCorrect = pick.signal === "HOLD";
      if (isCorrect === false) {
        // Partial — don't penalize, don't reward.
        neutral++;
      } else {
        correct++;
      }
    } else if (pnlPct > 0) {
      // Price rose — BUY is right, SELL is wrong, HOLD is partially right.
      isCorrect = pick.signal === "BUY";
      if (isCorrect) correct++;
      else if (pick.signal === "SELL") wrong++;
      else neutral++;
    } else {
      // Price fell — SELL is right, BUY is wrong, HOLD is partially right.
      isCorrect = pick.signal === "SELL";
      if (isCorrect) correct++;
      else if (pick.signal === "BUY") wrong++;
      else neutral++;
    }

    await prisma.specialistPickEntry.update({
      where: { id: pick.id },
      data: {
        exitPriceUsd: exitPrice,
        pnlPct: Math.round(pnlPct * 100) / 100,
        correct: isCorrect,
        scored: true,
        evaluatedAt: new Date(),
      },
    });

    // Update the specialist's marketplace reputation — the core loop that
    // eventually drives hire/fire decisions. updateSpecialistReputation takes
    // a boolean (correct/incorrect); the ELO K-factor is baked into reputation.ts.
    // We only update reputation when the signal was decisive (not neutral).
    if (isCorrect === true) {
      await updateSpecialistReputation(pick.specialistName, true).catch(() => {});
    } else if (isCorrect === false && Math.abs(pnlPct) >= SIGNAL_NOISE_THRESHOLD_PCT) {
      await updateSpecialistReputation(pick.specialistName, false).catch(() => {});
    }
  }

  console.log(
    `[pick-evaluator] scored ${stalePicks.length}: correct=${correct} wrong=${wrong} neutral=${neutral}`,
  );

  // Emit an audit row so the dashboard can render "recent scoring activity"
  await logAction({
    userId: stalePicks[0].userId,
    actionType: "CYCLE_COMPLETED",
    agentName: "pick-evaluator",
    payload: {
      stage: "pick_performance_evaluated",
      scored: stalePicks.length,
      correct,
      wrong,
      neutral,
      windowHours,
    },
  }).catch(() => {});

  return { scored: stalePicks.length, correct, wrong, neutral };
}
