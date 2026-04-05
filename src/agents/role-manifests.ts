// Per-role specialist hiring manifests with dynamic rotation.
//
// Each debate agent (alpha, risk, executor) has a pool of credible candidates
// and picks the top `pickCount` per cycle based on:
//   1. Reputation (ELO from marketplace registry, default 500)
//   2. Context boosts (e.g. Twitter alpha gets +120 in aggressive profiles)
//   3. Deterministic jitter seeded on (userId, cycleId) for visible rotation
//
// Why not free-form tool calling? 0G testnet's qwen-2.5-7b-instruct does NOT
// support OpenAI-compatible `tools` parameter. Main-agent pre-selects the
// top-N specialists and the debate agent reasons over whatever was hired.
// Rotation gives the "agent hiring economy" narrative teeth — Alpha doesn't
// always hire the same sidekicks; credibility varies cycle-to-cycle.

import { fnv1a } from "./fnv";

export type DebateRole = "alpha" | "risk" | "executor";
export type RiskProfile = "conservative" | "balanced" | "aggressive";
export type MarketVolatility = "low" | "medium" | "high";

export interface HireContext {
  riskProfile: RiskProfile;
  userGoal?: string;
  marketVolatility?: MarketVolatility;
}

export interface RoleManifest {
  role: DebateRole;
  /** Up to 4 candidates eligible for this role. Rotation picks `pickCount` from here each cycle. */
  pool: string[];
  /** How many specialists to hire per cycle. */
  pickCount: number;
  /** Context-driven score boosts applied before ranking. */
  contextBoosts: Array<{
    when: (ctx: HireContext) => boolean;
    boost: Record<string, number>;
  }>;
}

export interface RoleSelection {
  /** The specialists chosen for this cycle (length === pickCount when pool allows). */
  picked: string[];
  /** The full candidate pool the selection was drawn from. */
  pool: string[];
  /** Final score per pool member: reputation + contextBoost + jitter. */
  scores: Record<string, number>;
}

export const ROLE_MANIFESTS: Record<DebateRole, RoleManifest> = {
  // Alpha builds the bull case → pool of bullish-bias evidence gatherers
  alpha: {
    role: "alpha",
    pool: ["sentiment", "momentum", "twitter-alpha", "defi-yield"],
    pickCount: 2,
    contextBoosts: [
      {
        when: (c) => c.riskProfile === "aggressive",
        boost: { "twitter-alpha": 120 },
      },
      {
        when: (c) => /defi|yield|stake|apy/i.test(c.userGoal ?? ""),
        boost: { "defi-yield": 150 },
      },
    ],
  },

  // Risk attacks the bull thesis → pool of defensive data providers
  risk: {
    role: "risk",
    pool: ["onchain-forensics", "whale", "options-flow", "news-scanner"],
    pickCount: 2,
    contextBoosts: [
      {
        when: (c) => c.marketVolatility === "high",
        boost: { "options-flow": 120 },
      },
      {
        when: (c) => c.riskProfile === "conservative",
        boost: { "news-scanner": 80 },
      },
    ],
  },

  // Executor rules on Alpha + Risk. Single-element pool — only hires a macro
  // tiebreaker in high-volatility environments. Matches prior behavior.
  executor: {
    role: "executor",
    pool: ["macro-correlator"],
    pickCount: 1,
    contextBoosts: [
      {
        when: (c) => c.marketVolatility === "high",
        boost: { "macro-correlator": 200 },
      },
    ],
  },
};

const DEFAULT_REPUTATION = 500;
const JITTER_WINDOW = 81; // [-40, +40]
const JITTER_OFFSET = 40;

function jitterFor(cycleSeed: number, name: string): number {
  const h = fnv1a(`${cycleSeed}:${name}`);
  return (h % JITTER_WINDOW) - JITTER_OFFSET;
}

// Select specialists for a role. Pure function — all context (reputation,
// cycle seed) is passed in; callers (fly-agent-server.ts) fetch that data
// and forward it. Returns both the picked list and the full scoring table
// so downstream UIs / Telegram / HCS audits can show the rotation rationale.
export function selectForRole(
  role: string,
  ctx: HireContext,
  reputationScores: Record<string, number> = {},
  cycleSeed = 0,
): RoleSelection {
  const manifest = ROLE_MANIFESTS[role as DebateRole];
  if (!manifest) {
    return { picked: [], pool: [], scores: {} };
  }

  // Aggregate context boosts once (skip rules whose `when` is false).
  const boosts: Record<string, number> = {};
  for (const rule of manifest.contextBoosts) {
    if (!rule.when(ctx)) continue;
    for (const [name, value] of Object.entries(rule.boost)) {
      boosts[name] = (boosts[name] ?? 0) + value;
    }
  }

  // Score every pool member. Executor's single-element pool still runs through
  // this so the score table is consistent across roles; if no boost applied
  // and reputation is default, the executor falls back to its empty-pick baseline.
  const scores: Record<string, number> = {};
  for (const name of manifest.pool) {
    const base = reputationScores[name] ?? DEFAULT_REPUTATION;
    const boost = boosts[name] ?? 0;
    const jitter = jitterFor(cycleSeed, name);
    scores[name] = base + boost + jitter;
  }

  // Executor quirk: skip hiring when no context boost fired. This preserves
  // the previous "executor usually hires nothing" behavior — a bare
  // macro-correlator with zero boost would otherwise always be picked.
  const anyBoostFired = manifest.contextBoosts.some((r) => r.when(ctx));
  if (role === "executor" && !anyBoostFired) {
    return { picked: [], pool: manifest.pool, scores };
  }

  // Rank by score desc, take top pickCount.
  const ranked = [...manifest.pool].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
  const picked = ranked.slice(0, manifest.pickCount);

  return { picked, pool: manifest.pool, scores };
}
