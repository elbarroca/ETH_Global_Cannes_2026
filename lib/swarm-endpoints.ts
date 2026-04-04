// Frontend-safe mapping of the 13 live AlphaDawg swarm agents.
//
// This mirrors the shape of `src/config/agent-registry.ts` but inlines the
// Fly.io URLs as literal strings so client components can import it without
// pulling in server-only code (process.env reads, etc.).
//
// The /api/swarm/health route reads this list server-side and pings each
// /healthz endpoint. Never call these URLs directly from the browser — go
// through /api/swarm/* to avoid CORS + to benefit from the 5s timeout guard.
//
// Source of truth for URLs: progress/SWARM-STATUS.md §2.1 (all 13 agents
// deployed on Fly.io in cdg region, auto-suspend enabled).

export type SwarmAgentRole = "specialist" | "adversarial";

export interface SwarmAgent {
  /** Canonical short name used everywhere (DB, logs, URLs). */
  name: string;
  /** Nice human label for UI badges. */
  label: string;
  /** Emoji used in the dashboard swim-lane headers + tickers. */
  emoji: string;
  role: SwarmAgentRole;
  /** Full Fly.io URL including scheme. */
  flyUrl: string;
  /** Tags for filtering + tooltips. */
  tags: readonly string[];
  /** Fixed price per call — matches x402 paywall. */
  pricePerCall: string;
}

export const SWARM_AGENTS: readonly SwarmAgent[] = [
  // ── Specialists (x402 paywalled, each runs 0G sealed inference) ─────
  {
    name: "sentiment",
    label: "SentimentBot",
    emoji: "🧠",
    role: "specialist",
    flyUrl: "https://vm-sentiment.fly.dev",
    tags: ["sentiment", "fear-greed"],
    pricePerCall: "$0.001",
  },
  {
    name: "whale",
    label: "WhaleEye",
    emoji: "🐋",
    role: "specialist",
    flyUrl: "https://vm-whale.fly.dev",
    tags: ["whale", "flows"],
    pricePerCall: "$0.001",
  },
  {
    name: "momentum",
    label: "MomentumX",
    emoji: "📈",
    role: "specialist",
    flyUrl: "https://vm-momentum.fly.dev",
    tags: ["momentum", "rsi", "macd"],
    pricePerCall: "$0.001",
  },
  {
    name: "memecoin-hunter",
    label: "Memecoin Hunter",
    emoji: "🎰",
    role: "specialist",
    flyUrl: "https://vm-memecoin-hunter.fly.dev",
    tags: ["memecoin", "degen", "new-pairs"],
    pricePerCall: "$0.001",
  },
  {
    name: "twitter-alpha",
    label: "Twitter Alpha",
    emoji: "🐦",
    role: "specialist",
    flyUrl: "https://vm-twitter-alpha.fly.dev",
    tags: ["social", "twitter", "narrative"],
    pricePerCall: "$0.001",
  },
  {
    name: "defi-yield",
    label: "DeFi Yield",
    emoji: "🌾",
    role: "specialist",
    flyUrl: "https://vm-defi-yield.fly.dev",
    tags: ["defi", "yield", "tvl"],
    pricePerCall: "$0.001",
  },
  {
    name: "news-scanner",
    label: "News Scanner",
    emoji: "📰",
    role: "specialist",
    flyUrl: "https://vm-news-scanner.fly.dev",
    tags: ["news", "regulatory", "listings"],
    pricePerCall: "$0.001",
  },
  {
    name: "onchain-forensics",
    label: "On-Chain Forensics",
    emoji: "🔍",
    role: "specialist",
    flyUrl: "https://vm-onchain-forensics.fly.dev",
    tags: ["onchain", "forensics", "wallets"],
    pricePerCall: "$0.001",
  },
  {
    name: "options-flow",
    label: "Options Flow",
    emoji: "📊",
    role: "specialist",
    flyUrl: "https://vm-options-flow.fly.dev",
    tags: ["options", "derivatives", "volatility"],
    pricePerCall: "$0.001",
  },
  {
    name: "macro-correlator",
    label: "Macro Correlator",
    emoji: "🌍",
    role: "specialist",
    flyUrl: "https://vm-macro-correlator.fly.dev",
    tags: ["macro", "correlation", "tradfi"],
    pricePerCall: "$0.001",
  },

  // ── Adversarial (debate agents — also run 0G sealed inference) ──────
  {
    name: "alpha",
    label: "Alpha",
    emoji: "🐺",
    role: "adversarial",
    flyUrl: "https://vm-alpha.fly.dev",
    tags: ["debate", "bull"],
    pricePerCall: "$0.001",
  },
  {
    name: "risk",
    label: "Risk",
    emoji: "🛡️",
    role: "adversarial",
    flyUrl: "https://vm-risk.fly.dev",
    tags: ["debate", "bear"],
    pricePerCall: "$0.001",
  },
  {
    name: "executor",
    label: "Executor",
    emoji: "⚖️",
    role: "adversarial",
    flyUrl: "https://vm-executor.fly.dev",
    tags: ["debate", "judge"],
    pricePerCall: "$0.001",
  },
] as const;

export function specialists(): SwarmAgent[] {
  return SWARM_AGENTS.filter((a) => a.role === "specialist");
}

export function adversarial(): SwarmAgent[] {
  return SWARM_AGENTS.filter((a) => a.role === "adversarial");
}

export function getSwarmAgent(name: string): SwarmAgent | undefined {
  return SWARM_AGENTS.find((a) => a.name === name);
}

/** Short display name, falls back to raw name if agent is unknown. */
export function agentLabel(name: string): string {
  return getSwarmAgent(name)?.label ?? name;
}

/** Emoji for an agent, falls back to generic robot. */
export function agentEmoji(name: string): string {
  return getSwarmAgent(name)?.emoji ?? "🤖";
}
