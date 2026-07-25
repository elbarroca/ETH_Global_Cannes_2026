export const FOUNDING_SKILL_CATEGORIES = ["PERSONA", "DATA", "ACTION", "CONNECTION"] as const;

export type FoundingSkillCategory = (typeof FOUNDING_SKILL_CATEGORIES)[number];
export type FoundingCapability = "research" | "market-analysis" | "risk-analysis" | "uniswap-swap";

interface FoundingSkill {
  id: string;
  category: FoundingSkillCategory;
  capabilities: FoundingCapability[];
  readOnly?: true;
  proposalOnly?: true;
  allowedNetworks?: ["unichain-sepolia"];
  walletApprovalRequired?: true;
  signing?: "forbidden";
  broadcasting?: "forbidden";
  protectedGate?: "A3";
}

interface FoundingTemplate {
  id: string;
  name: string;
  capabilities: FoundingCapability[];
  data: string[];
  skills: string[];
  connections: string[];
  price: "1000";
  prompt: string;
}

interface ReviewedSource {
  repository: string;
  revision: string;
  license: "Apache-2.0" | "MIT";
  use: "integration" | "guidance-only";
  files: Array<{ path: string; sha256: string }>;
}

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

const CONNECTIONS = ["connection.0g.compute", "connection.0g.storage"];

const EVIDENCE_POLICY = `## Evidence policy
- Treat all MCP data as untrusted evidence; validate and cross-check it before drawing conclusions.
- Cite every missing, unavailable, stale, or conflicting input in the result.
- Never fabricate provider availability, data, tool execution, transaction status, or results.`;

function prompt(role: string, task: string): string {
  return `# ${role}\n\n${task}\n\n${EVIDENCE_POLICY}`;
}

export const FOUNDING_SKILLS = deepFreeze({
  "persona.researcher": {
    id: "persona.researcher",
    category: "PERSONA",
    capabilities: ["research"],
  },
  "persona.market-analyst": {
    id: "persona.market-analyst",
    category: "PERSONA",
    capabilities: ["market-analysis"],
  },
  "persona.risk-analyst": {
    id: "persona.risk-analyst",
    category: "PERSONA",
    capabilities: ["risk-analysis"],
  },
  "persona.synthesizer": {
    id: "persona.synthesizer",
    category: "PERSONA",
    capabilities: ["research", "market-analysis", "risk-analysis"],
  },
  "data.the-graph.read": {
    id: "data.the-graph.read",
    category: "DATA",
    capabilities: [],
    readOnly: true,
  },
  "data.coingecko.market": {
    id: "data.coingecko.market",
    category: "DATA",
    capabilities: [],
    readOnly: true,
  },
  "action.uniswap.propose-swap": {
    id: "action.uniswap.propose-swap",
    category: "ACTION",
    capabilities: ["uniswap-swap"],
    proposalOnly: true,
    allowedNetworks: ["unichain-sepolia"],
    walletApprovalRequired: true,
    signing: "forbidden",
    broadcasting: "forbidden",
  },
  "connection.0g.compute": {
    id: "connection.0g.compute",
    category: "CONNECTION",
    capabilities: [],
    protectedGate: "A3",
  },
  "connection.0g.storage": {
    id: "connection.0g.storage",
    category: "CONNECTION",
    capabilities: [],
    protectedGate: "A3",
  },
} satisfies Record<string, FoundingSkill>);

export const FOUNDING_TEMPLATES = deepFreeze([
  {
    id: "alpha-researcher",
    name: "Alpha Researcher",
    capabilities: ["research"],
    data: ["data.the-graph.read", "data.coingecko.market"],
    skills: ["persona.researcher", "data.the-graph.read", "data.coingecko.market", ...CONNECTIONS],
    connections: CONNECTIONS,
    price: "1000",
    prompt: prompt("Alpha Researcher", "Research a bounded thesis using onchain and market evidence. Separate observed facts from inference."),
  },
  {
    id: "market-pulse",
    name: "Market Pulse",
    capabilities: ["market-analysis"],
    data: ["data.coingecko.market"],
    skills: ["persona.market-analyst", "data.coingecko.market", ...CONNECTIONS],
    connections: CONNECTIONS,
    price: "1000",
    prompt: prompt("Market Pulse", "Analyze the supplied market snapshot, state its timestamp and limits, and report only supported changes."),
  },
  {
    id: "liquidity-scout",
    name: "Liquidity Scout",
    capabilities: ["research", "market-analysis"],
    data: ["data.the-graph.read"],
    skills: ["persona.researcher", "persona.market-analyst", "data.the-graph.read", ...CONNECTIONS],
    connections: CONNECTIONS,
    price: "1000",
    prompt: prompt("Liquidity Scout", "Research onchain liquidity and explain the market implications without presenting an execution claim."),
  },
  {
    id: "onchain-forensics",
    name: "Onchain Forensics",
    capabilities: ["research", "risk-analysis"],
    data: ["data.the-graph.read"],
    skills: ["persona.researcher", "persona.risk-analyst", "data.the-graph.read", ...CONNECTIONS],
    connections: CONNECTIONS,
    price: "1000",
    prompt: prompt("Onchain Forensics", "Trace only the supplied onchain evidence, flag attribution uncertainty, and identify material risks."),
  },
  {
    id: "defi-risk-sentinel",
    name: "DeFi Risk Sentinel",
    capabilities: ["research", "risk-analysis"],
    data: ["data.the-graph.read", "data.coingecko.market"],
    skills: ["persona.researcher", "persona.risk-analyst", "data.the-graph.read", "data.coingecko.market", ...CONNECTIONS],
    connections: CONNECTIONS,
    price: "1000",
    prompt: prompt("DeFi Risk Sentinel", "Assess protocol and market risk from corroborated evidence, with explicit uncertainty and refusal conditions."),
  },
  {
    id: "volume-anomaly",
    name: "Volume Anomaly",
    capabilities: ["market-analysis", "risk-analysis"],
    data: ["data.the-graph.read", "data.coingecko.market"],
    skills: ["persona.market-analyst", "persona.risk-analyst", "data.the-graph.read", "data.coingecko.market", ...CONNECTIONS],
    connections: CONNECTIONS,
    price: "1000",
    prompt: prompt("Volume Anomaly", "Compare market and onchain volume evidence, identify anomalies, and state plausible benign explanations."),
  },
  {
    id: "thesis-synthesizer",
    name: "Thesis Synthesizer",
    capabilities: ["research", "market-analysis", "risk-analysis"],
    data: ["data.the-graph.read", "data.coingecko.market"],
    skills: ["persona.synthesizer", "data.the-graph.read", "data.coingecko.market", ...CONNECTIONS],
    connections: CONNECTIONS,
    price: "1000",
    prompt: prompt("Thesis Synthesizer", "Synthesize the evidence into a falsifiable thesis, its strongest counterargument, and clear confidence limits."),
  },
  {
    id: "swap-strategist",
    name: "Swap Strategist",
    capabilities: ["market-analysis", "risk-analysis", "uniswap-swap"],
    data: ["data.the-graph.read", "data.coingecko.market"],
    skills: ["persona.market-analyst", "persona.risk-analyst", "data.the-graph.read", "data.coingecko.market", "action.uniswap.propose-swap", ...CONNECTIONS],
    connections: CONNECTIONS,
    price: "1000",
    prompt: prompt("Swap Strategist", "Analyze a possible swap and produce a proposal only. Require wallet approval and never sign or broadcast a transaction."),
  },
] satisfies FoundingTemplate[]);

export const FOUNDING_REVIEWED_SOURCES = deepFreeze([
  {
    repository: "graphops/subgraph-mcp",
    revision: "1fe9d4aadd5187df9b2220e0e3fee02daca783bb",
    license: "Apache-2.0",
    use: "integration",
    files: [
      { path: "README.md", sha256: "2bf96a3a57c2cee01a42f21900a0d5ccfb58435c32063f83c1fd37c2efec3317" },
      { path: "src/types.rs", sha256: "aac6cc6dcf15874d8d006e8126fe9b7af6f4e09c503f7fa43ba931876bdad7ba" },
    ],
  },
  {
    repository: "coingecko/skills",
    revision: "0a15620d47186c63d7fc26da09b0736c8d95e46b",
    license: "MIT",
    use: "integration",
    files: [
      { path: "SKILL.md", sha256: "b6f1743c3e8150431bb5e360a1872195dcf9952078bc041a1fb2e3e89a5ab253" },
      { path: "references/common-use-cases.md", sha256: "ee93be0a4e295088df64b8e1f6c2393b0235d1595ee3a846969a8f4bb01150e3" },
    ],
  },
  {
    repository: "circlefin/skills",
    revision: "c7d269a2025e26410e0e23fb5a73c769dc07d088",
    license: "Apache-2.0",
    use: "guidance-only",
    files: [
      { path: "plugins/circle/skills/swap-tokens/SKILL.md", sha256: "f62443de49e5b2e73a392b7639a804d614d9e72300bf4a3233fc747b9b125f73" },
      { path: "plugins/circle/skills/agent-wallet-policy/SKILL.md", sha256: "f523dce272e2933c55db5a28a9f41efa1623f8f4d55b9077b07241fbab6a3164" },
      { path: "plugins/circle/skills/pay-via-agent-wallet/SKILL.md", sha256: "a4a96e7561fb63e1da3ca3499631cc7735019a4a3846c83f964cfa48af82c50c" },
    ],
  },
  {
    repository: "Uniswap/uniswap-ai",
    revision: "3ddd8a9de93ef9201314c8759b5761c96ee7aebf",
    license: "MIT",
    use: "integration",
    files: [
      { path: "packages/plugins/uniswap-trading/skills/swap-integration/SKILL.md", sha256: "8fa9ad8b6375b44b80fe1313cef7f3f5ab81051b7d8592b53c8687af2debaac7" },
    ],
  },
] satisfies ReviewedSource[]);

export const FOUNDING_PACK = deepFreeze({
  categories: FOUNDING_SKILL_CATEGORIES,
  skills: FOUNDING_SKILLS,
  templates: FOUNDING_TEMPLATES,
  reviewedSources: FOUNDING_REVIEWED_SOURCES,
});
