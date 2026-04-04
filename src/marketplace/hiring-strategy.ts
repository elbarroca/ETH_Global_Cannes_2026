// Dynamic specialist selection based on market context + user profile
// Max 5 specialists per cycle = $0.005

export interface HiringContext {
  marketVolatility: "low" | "medium" | "high";
  recentNewsCount: number;
  portfolioExposure: number;
  userRiskProfile: "conservative" | "balanced" | "aggressive";
}

const BASE_SPECIALISTS = ["sentiment", "momentum"] as const;
const MAX_HIRES = 5;

export function selectSpecialists(ctx: HiringContext): string[] {
  const always: string[] = [...BASE_SPECIALISTS];
  const conditional: string[] = [];

  // Always track smart money
  conditional.push("onchain-forensics");

  // High volatility → add options + macro
  if (ctx.marketVolatility === "high") {
    conditional.push("options-flow", "macro-correlator");
  }

  // Medium volatility → add whale tracking
  if (ctx.marketVolatility !== "low") {
    conditional.push("whale");
  }

  // Breaking news → add news scanner
  if (ctx.recentNewsCount > 3) {
    conditional.push("news-scanner");
  }

  // Aggressive profile → degen plays
  if (ctx.userRiskProfile === "aggressive") {
    conditional.push("memecoin-hunter", "twitter-alpha");
  }

  // Balanced → yield opportunities
  if (ctx.userRiskProfile === "balanced" || ctx.userRiskProfile === "conservative") {
    conditional.push("defi-yield");
  }

  // Deduplicate and cap at MAX_HIRES
  const all = [...always, ...conditional];
  const unique = [...new Set(all)];
  return unique.slice(0, MAX_HIRES);
}
