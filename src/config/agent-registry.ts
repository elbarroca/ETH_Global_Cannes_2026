// Agent registry — maps agent names to their live URLs
// Defaults to localhost (dev), overridden by AGENT_URL_* env vars (Fly.io production)

export interface AgentEndpoint {
  name: string;
  role: "orchestrator" | "specialist" | "adversarial";
  url: string;
  tags: string[];
  pricePerCall: string;
}

function agentUrl(name: string, defaultPort: number): string {
  // Check for per-agent env override: AGENT_URL_SENTIMENT=https://vm-sentiment.fly.dev
  const envKey = `AGENT_URL_${name.toUpperCase().replace(/-/g, "_")}`;
  return process.env[envKey] ?? `http://localhost:${defaultPort}`;
}

export const AGENT_REGISTRY: AgentEndpoint[] = [
  // Specialists (x402 paywalled, each runs 0G sealed inference)
  { name: "sentiment", role: "specialist", url: agentUrl("sentiment", 4001), tags: ["sentiment"], pricePerCall: "$0.001" },
  { name: "whale", role: "specialist", url: agentUrl("whale", 4002), tags: ["whale"], pricePerCall: "$0.001" },
  { name: "momentum", role: "specialist", url: agentUrl("momentum", 4003), tags: ["momentum"], pricePerCall: "$0.001" },
  { name: "memecoin-hunter", role: "specialist", url: agentUrl("memecoin-hunter", 4004), tags: ["memecoin", "degen", "new-pairs"], pricePerCall: "$0.001" },
  { name: "twitter-alpha", role: "specialist", url: agentUrl("twitter-alpha", 4005), tags: ["social", "twitter", "narrative"], pricePerCall: "$0.001" },
  { name: "defi-yield", role: "specialist", url: agentUrl("defi-yield", 4006), tags: ["defi", "yield", "tvl"], pricePerCall: "$0.001" },
  { name: "news-scanner", role: "specialist", url: agentUrl("news-scanner", 4007), tags: ["news", "regulatory", "listings"], pricePerCall: "$0.001" },
  { name: "onchain-forensics", role: "specialist", url: agentUrl("onchain-forensics", 4008), tags: ["onchain", "forensics", "wallets"], pricePerCall: "$0.001" },
  { name: "options-flow", role: "specialist", url: agentUrl("options-flow", 4009), tags: ["options", "derivatives", "volatility"], pricePerCall: "$0.001" },
  { name: "macro-correlator", role: "specialist", url: agentUrl("macro-correlator", 4010), tags: ["macro", "correlation", "tradfi"], pricePerCall: "$0.001" },

  // Adversarial (debate agents, also run 0G sealed inference)
  { name: "alpha", role: "adversarial", url: agentUrl("alpha", 5001), tags: ["debate", "bull"], pricePerCall: "$0.001" },
  { name: "risk", role: "adversarial", url: agentUrl("risk", 5002), tags: ["debate", "bear"], pricePerCall: "$0.001" },
  { name: "executor", role: "adversarial", url: agentUrl("executor", 5003), tags: ["debate", "judge"], pricePerCall: "$0.001" },
];

// Helpers
export function getSpecialists(): AgentEndpoint[] {
  return AGENT_REGISTRY.filter((a) => a.role === "specialist");
}

export function getAdversarial(): AgentEndpoint[] {
  return AGENT_REGISTRY.filter((a) => a.role === "adversarial");
}

export function getAgent(name: string): AgentEndpoint | undefined {
  return AGENT_REGISTRY.find((a) => a.name === name);
}

export function getAgentUrl(name: string): string {
  const agent = getAgent(name);
  if (!agent) throw new Error(`Agent ${name} not found in registry`);
  return agent.url;
}
