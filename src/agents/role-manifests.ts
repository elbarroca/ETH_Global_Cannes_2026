// Per-role specialist hiring manifests.
//
// Each debate agent (alpha, risk, executor) has a hardcoded specialist picklist
// plus conditional rules based on user goal and market volatility.
//
// Why not free-form tool calling? 0G testnet's chatbot model (qwen-2.5-7b-instruct)
// does NOT support OpenAI-compatible `tools` parameter. The inference API is plain
// /chat/completions with no function-calling hook. Manifests are the workaround:
// each role's picklist is domain-appropriate (Alpha hires bullish-bias specialists,
// Risk hires defensive ones, Executor hires tiebreakers).

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
  always: string[]; // always hire these
  conditional: Array<{
    when: (ctx: HireContext) => boolean;
    add: string[];
  }>;
  maxHires: number;
}

export const ROLE_MANIFESTS: Record<DebateRole, RoleManifest> = {
  // Alpha builds the bull case → hires bullish-bias evidence gatherers
  alpha: {
    role: "alpha",
    always: ["sentiment", "momentum"],
    conditional: [
      {
        when: (c) => c.riskProfile === "aggressive",
        add: ["twitter-alpha", "memecoin-hunter"],
      },
      {
        when: (c) => /defi|yield|stake|apy/i.test(c.userGoal ?? ""),
        add: ["defi-yield"],
      },
    ],
    maxHires: 3,
  },

  // Risk attacks the bull thesis → hires defensive data providers
  risk: {
    role: "risk",
    always: ["onchain-forensics", "whale"],
    conditional: [
      {
        when: (c) => c.marketVolatility === "high",
        add: ["options-flow", "macro-correlator"],
      },
      {
        when: (c) => c.riskProfile === "conservative",
        add: ["news-scanner"],
      },
    ],
    maxHires: 3,
  },

  // Executor rules on Alpha + Risk arguments. Usually hires nothing.
  // Can hire one macro tiebreaker in high volatility environments.
  executor: {
    role: "executor",
    always: [],
    conditional: [
      {
        when: (c) => c.marketVolatility === "high",
        add: ["macro-correlator"],
      },
    ],
    maxHires: 1,
  },
};

// Select specialist IDs for a given role and context.
// Returns up to manifest.maxHires unique specialist names.
export function selectForRole(role: string, ctx: HireContext): string[] {
  const manifest = ROLE_MANIFESTS[role as DebateRole];
  if (!manifest) return [];

  const picks = new Set<string>(manifest.always);
  for (const rule of manifest.conditional) {
    if (rule.when(ctx)) {
      rule.add.forEach((s) => picks.add(s));
    }
  }

  return [...picks].slice(0, manifest.maxHires);
}
