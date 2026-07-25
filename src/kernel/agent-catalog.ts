import { FOUNDING_PACK } from "../agents/founding-pack";
import { canonicalJson, domainHash, type CanonicalValue } from "./canonical";
import { KernelError } from "./errors";
import type {
  AgentEnsBinding,
  AgentManifest,
  AgentManifestV2,
  AgentManifestV3,
  AgentManifestV4,
  AgentNativeConnection,
  AgentSkillSnapshotV1,
  McpBindingV1,
  McpCapability,
  McpProviderId,
  PinnedAgentSkill,
  ReviewedSourceV1,
  RiskLane,
} from "./types";
import { RISK_LANES } from "./types";

export const SUPPORTED_AGENT_SKILLS = [
  "research",
  "market-analysis",
  "risk-analysis",
  "uniswap-swap",
] as const;

export type SupportedAgentSkill = (typeof SUPPORTED_AGENT_SKILLS)[number];

const SKILL_CATALOG: Readonly<Record<SupportedAgentSkill, PinnedAgentSkill>> = {
  research: {
    id: "research",
    source: "kernel://skills/research@1",
    reviewedHash: "3a352e1c42081e155b178c9b8af7d82ed633ef9e531cdb2f73dff43eddf91b8f",
    policy: "metadata-only-never-execute",
  },
  "market-analysis": {
    id: "market-analysis",
    source: "kernel://skills/market-analysis@1",
    reviewedHash: "2dea672a577b11b36813102056073761dc6f5e83e0c6b1a36d532a288bf120c4",
    policy: "metadata-only-never-execute",
  },
  "risk-analysis": {
    id: "risk-analysis",
    source: "kernel://skills/risk-analysis@1",
    reviewedHash: "de868a76ab8204afee2dd486c3463d3263c5a26f10276d0b4fa3ba3fe36c705b",
    policy: "metadata-only-never-execute",
  },
  "uniswap-swap": {
    id: "uniswap-swap",
    source: "https://github.com/Uniswap/uniswap-ai/tree/main/skills/swap-integration",
    reviewedHash: "62d97be9abe4d753ad28044a3ed4c1a4c3b07afaa798c6a283934f707d6de57f",
    policy: "metadata-only-never-execute",
  },
};

const MCP_REGISTRY = {
  coingecko: [
    "search",
    "spot-price",
    "market-snapshot",
    "trending",
    "token-by-address",
    "pool-snapshot",
    "ohlcv",
  ],
  "the-graph": [
    "pinned-deployment-lookup",
    "schema-read",
    "bounded-query",
    "liquidity-volume-snapshot",
  ],
} as const satisfies Readonly<Record<McpProviderId, readonly McpCapability[]>>;

const SELECTED_MCP_BINDINGS: Readonly<Record<string, readonly McpBindingV1[]>> = {
  "data.coingecko.market": [
    binding("coingecko", "spot-price"),
    binding("coingecko", "market-snapshot"),
  ],
  "data.the-graph.read": [
    binding("the-graph", "pinned-deployment-lookup"),
    binding("the-graph", "liquidity-volume-snapshot"),
  ],
};

function binding(provider: McpProviderId, capability: McpCapability): McpBindingV1 {
  if (!(MCP_REGISTRY[provider] as readonly string[]).includes(capability)) {
    throw new Error("KERNEL_MCP_REGISTRY_INVALID");
  }
  return {
    schemaVersion: 1,
    id: `mcp.${provider}.${capability}`,
    provider,
    capability,
    access: "read-only",
    timeoutMs: 8000,
    maxResponseBytes: 32768,
  };
}

function manifestConfigV2(manifest: Omit<AgentManifestV2, "reviewedConfigHash">): CanonicalValue {
  return {
    adapterKey: manifest.adapterKey,
    capabilities: manifest.capabilities,
    connectorKey: manifest.connectorKey,
    endpoint: manifest.endpoint,
    ensBinding: manifest.ensBinding,
    ensBindingHash: manifest.ensBindingHash,
    mcp: manifest.mcp,
    nativeConnections: manifest.nativeConnections,
    payoutAddress: manifest.payoutAddress,
    priceAtomic: manifest.priceAtomic,
    proofPolicy: manifest.proofPolicy,
    skills: manifest.skills,
  };
}

function manifestConfigV3(manifest: Omit<AgentManifestV3, "reviewedConfigHash">): CanonicalValue {
  return {
    adapterKey: manifest.adapterKey,
    capabilities: manifest.capabilities,
    catalogSelectionHash: manifest.catalogSelectionHash,
    catalogTemplateId: manifest.catalogTemplateId,
    connectorKey: manifest.connectorKey,
    endpoint: manifest.endpoint,
    ensBinding: manifest.ensBinding,
    ensBindingHash: manifest.ensBindingHash,
    mcp: manifest.mcp,
    nativeConnections: manifest.nativeConnections,
    payoutAddress: manifest.payoutAddress,
    priceAtomic: manifest.priceAtomic,
    proofPolicy: manifest.proofPolicy,
    reviewedSources: manifest.reviewedSources,
    skills: manifest.skills,
  };
}

function manifestConfigV4(manifest: Omit<AgentManifestV4, "reviewedConfigHash">): CanonicalValue {
  return {
    ...(manifestConfigV3(manifest) as Record<string, CanonicalValue>),
    riskTiers: manifest.riskTiers,
  };
}

function foundingTemplate(templateId: string) {
  const template = FOUNDING_PACK.templates.find((entry) => entry.id === templateId);
  if (!template) throw new KernelError("KERNEL_INVALID_REQUEST", "Unknown founding template", 400);
  return template;
}

function skillConstraints(skill: (typeof FOUNDING_PACK.skills)[keyof typeof FOUNDING_PACK.skills]): string[] {
  const constraints: string[] = [];
  if ("readOnly" in skill && skill.readOnly === true) constraints.push("read-only");
  if ("proposalOnly" in skill && skill.proposalOnly === true) constraints.push("proposal-only");
  if ("walletApprovalRequired" in skill && skill.walletApprovalRequired === true) {
    constraints.push("wallet-approval-required");
  }
  if ("signing" in skill && skill.signing === "forbidden") constraints.push("signing-forbidden");
  if ("broadcasting" in skill && skill.broadcasting === "forbidden") {
    constraints.push("broadcasting-forbidden");
  }
  if ("protectedGate" in skill && skill.protectedGate === "A3") {
    constraints.push("protected-a3-required");
  }
  if ("allowedNetworks" in skill) {
    for (const network of skill.allowedNetworks) constraints.push(`network:${network}`);
  }
  return constraints.sort();
}

function snapshotSkill(skillId: string): AgentSkillSnapshotV1 {
  const skill = FOUNDING_PACK.skills[skillId as keyof typeof FOUNDING_PACK.skills];
  if (!skill || skill.id !== skillId) throw new Error("KERNEL_FOUNDING_SKILL_INVALID");
  const snapshot = {
    schemaVersion: 1,
    id: skill.id,
    category: skill.category,
    capabilities: [...skill.capabilities],
    constraints: skillConstraints(skill),
  } as const;
  return {
    ...snapshot,
    snapshotHash: domainHash("agent-skill-snapshot", snapshot),
  };
}

function reviewedSourcesFor(skillIds: readonly string[]): readonly ReviewedSourceV1[] {
  const repositories = new Set<string>();
  if (skillIds.includes("data.the-graph.read")) repositories.add("graphops/subgraph-mcp");
  if (skillIds.includes("data.coingecko.market")) repositories.add("coingecko/skills");
  if (skillIds.includes("action.uniswap.propose-swap")) {
    repositories.add("circlefin/skills");
    repositories.add("Uniswap/uniswap-ai");
  }
  return FOUNDING_PACK.reviewedSources
    .filter((source) => repositories.has(source.repository))
    .map((source) => ({
      schemaVersion: 1,
      repository: source.repository,
      revision: source.revision,
      license: source.license,
      use: source.use,
      files: source.files.map((file) => ({ path: file.path, sha256: file.sha256 })),
    }));
}

function mcpBindingsFor(dataIds: readonly string[]): readonly McpBindingV1[] {
  return dataIds.flatMap((id) => SELECTED_MCP_BINDINGS[id] ?? []).slice(0, 4);
}

function v3NativeConnections(skillIds: readonly string[]): readonly AgentNativeConnection[] {
  const connections: AgentNativeConnection[] = [
    { id: "zero-g-compute", required: true },
    { id: "zero-g-storage", required: true },
  ];
  if (skillIds.includes("action.uniswap.propose-swap")) {
    connections.push({ id: "uniswap-api", required: true });
  }
  return connections;
}

function selectionFor(templateId: string): CanonicalValue {
  const template = foundingTemplate(templateId);
  return {
    capabilities: template.capabilities,
    connections: template.connections,
    data: template.data,
    priceAtomic: template.price,
    skills: template.skills,
    templateId: template.id,
  };
}

function withV3EnsBinding(manifest: AgentManifestV3, ensBinding: AgentEnsBinding): AgentManifestV3 {
  const updated = {
    ...manifest,
    ensBinding,
    ensBindingHash: domainHash("agent-ens-binding", ensBinding),
  };
  return {
    ...updated,
    reviewedConfigHash: domainHash("agent-config", manifestConfigV3(updated)),
  };
}

function withV4EnsBinding(manifest: AgentManifestV4, ensBinding: AgentEnsBinding): AgentManifestV4 {
  const updated = {
    ...manifest,
    ensBinding,
    ensBindingHash: domainHash("agent-ens-binding", ensBinding),
  };
  return {
    ...updated,
    reviewedConfigHash: domainHash("agent-config", manifestConfigV4(updated)),
  };
}

export function buildManifestV3(input: {
  templateId: string;
  name: string;
  description: string;
  ownerWallet: string;
}): AgentManifestV3 {
  const template = foundingTemplate(input.templateId);
  const manifest = {
    schemaVersion: 3,
    catalogTemplateId: template.id,
    catalogSelectionHash: domainHash("agent-catalog-selection", selectionFor(template.id)),
    name: input.name,
    description: input.description,
    instructions: template.prompt,
    capabilities: [...template.capabilities].sort(),
    adapterKey: "protected-a3",
    endpoint: null,
    connectorKey: null,
    ownerWallet: input.ownerWallet,
    payoutAddress: input.ownerWallet,
    priceAtomic: template.price,
    asset: "USDC_ATOMIC",
    proofPolicy: "verified-receipt-required",
    ensBinding: null,
    ensBindingHash: null,
    reviewedPromptHash: domainHash("agent-prompt", template.prompt),
    skills: template.skills.map(snapshotSkill),
    reviewedSources: reviewedSourcesFor(template.skills),
    nativeConnections: v3NativeConnections(template.skills),
    mcp: mcpBindingsFor(template.data),
  } as const;
  return {
    ...manifest,
    reviewedConfigHash: domainHash("agent-config", manifestConfigV3(manifest)),
  };
}

export function parseRiskTiers(value: unknown): readonly RiskLane[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > RISK_LANES.length) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "riskTiers must contain 1-3 entries", 400);
  }
  const tiers = value.map((entry): RiskLane => {
    if (typeof entry !== "string" || !(RISK_LANES as readonly string[]).includes(entry)) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "Unsupported risk tier", 400);
    }
    return entry as RiskLane;
  });
  const stable = RISK_LANES.filter((tier) => tiers.includes(tier));
  if (stable.length !== tiers.length || stable.some((tier, index) => tier !== tiers[index])) {
    throw new KernelError(
      "KERNEL_INVALID_REQUEST",
      "riskTiers must be unique and ordered LOW, MID, HIGH",
      400,
    );
  }
  return stable;
}

export function buildManifestV4(input: {
  templateId: string;
  name: string;
  description: string;
  ownerWallet: string;
  riskTiers: readonly RiskLane[];
}): AgentManifestV4 {
  const v3 = buildManifestV3(input);
  const manifest = {
    ...v3,
    schemaVersion: 4,
    riskTiers: parseRiskTiers(input.riskTiers),
  } as const;
  return {
    ...manifest,
    reviewedConfigHash: domainHash("agent-config", manifestConfigV4(manifest)),
  };
}

export function isSupportedAgentSkill(value: string): value is SupportedAgentSkill {
  return (SUPPORTED_AGENT_SKILLS as readonly string[]).includes(value);
}

export function parseRecommendationRequest(value: unknown): readonly SupportedAgentSkill[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "A JSON object is required", 400);
  }
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => key !== "requestedSkills")) {
    throw new KernelError(
      "KERNEL_INVALID_REQUEST",
      "Only server-reviewed skill identifiers are accepted",
      400,
    );
  }
  if (!Array.isArray(input.requestedSkills) || input.requestedSkills.length > 4) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "requestedSkills must be an array", 400);
  }
  return [...new Set(input.requestedSkills.map((skill): SupportedAgentSkill => {
    if (typeof skill !== "string" || !isSupportedAgentSkill(skill)) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "Unsupported skill", 400);
    }
    return skill;
  }))].sort();
}

export function pinnedSkillsFor(ids: readonly SupportedAgentSkill[]): readonly PinnedAgentSkill[] {
  return [...new Set(ids)].sort().map((id) => SKILL_CATALOG[id]);
}

export function nativeConnectionsFor(
  ids: readonly SupportedAgentSkill[],
): readonly AgentNativeConnection[] {
  const connections: AgentNativeConnection[] = [
    { id: "zero-g-compute", required: true },
    { id: "zero-g-storage", required: true },
  ];
  if (ids.includes("uniswap-swap")) connections.push({ id: "uniswap-api", required: true });
  return connections;
}

export function buildManifestV2(input: {
  name: string;
  description: string;
  instructions: string;
  skills: readonly SupportedAgentSkill[];
  ownerWallet: string;
}): AgentManifestV2 {
  const skills = pinnedSkillsFor(input.skills);
  const ensBinding = null;
  const manifest = {
    schemaVersion: 2,
    name: input.name,
    description: input.description,
    instructions: input.instructions,
    capabilities: skills.map((skill) => skill.id),
    adapterKey: "protected-a3",
    endpoint: null,
    connectorKey: null,
    ownerWallet: input.ownerWallet,
    payoutAddress: input.ownerWallet,
    priceAtomic: "1000",
    asset: "USDC_ATOMIC",
    proofPolicy: "verified-receipt-required",
    ensBinding,
    ensBindingHash: null,
    reviewedPromptHash: domainHash("agent-prompt", input.instructions),
    skills,
    nativeConnections: nativeConnectionsFor(input.skills),
    mcp: [],
  } as const;
  return {
    ...manifest,
    reviewedConfigHash: domainHash("agent-config", manifestConfigV2(manifest)),
  };
}

export function bindManifestEns(manifest: AgentManifest, bindingValue: AgentEnsBinding): AgentManifest {
  if (manifest.schemaVersion === 1) return { ...manifest, ensBinding: bindingValue };
  if (manifest.schemaVersion === 3) return withV3EnsBinding(manifest, bindingValue);
  if (manifest.schemaVersion === 4) return withV4EnsBinding(manifest, bindingValue);
  const updated = {
    ...manifest,
    ensBinding: bindingValue,
    ensBindingHash: domainHash("agent-ens-binding", bindingValue),
  };
  return {
    ...updated,
    reviewedConfigHash: domainHash("agent-config", manifestConfigV2(updated)),
  };
}

function assertCatalogManifestV3(manifest: AgentManifestV3): void {
  let expected = buildManifestV3({
    templateId: manifest.catalogTemplateId,
    name: manifest.name,
    description: manifest.description,
    ownerWallet: manifest.ownerWallet,
  });
  if (manifest.ensBinding) expected = withV3EnsBinding(expected, manifest.ensBinding);
  if (canonicalJson(manifest) !== canonicalJson(expected)) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "Catalog manifest does not match its reviewed template", 400);
  }
}

function assertCatalogManifestV4(manifest: AgentManifestV4): void {
  let expected = buildManifestV4({
    templateId: manifest.catalogTemplateId,
    name: manifest.name,
    description: manifest.description,
    ownerWallet: manifest.ownerWallet,
    riskTiers: manifest.riskTiers,
  });
  if (manifest.ensBinding) expected = withV4EnsBinding(expected, manifest.ensBinding);
  if (canonicalJson(manifest) !== canonicalJson(expected)) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "Catalog manifest does not match its reviewed template", 400);
  }
}

export function deriveManifestHashes(manifest: AgentManifest): {
  manifestHash: string;
  promptHash: string;
  configHash: string;
} {
  const promptHash = domainHash("agent-prompt", manifest.instructions);
  const configHash = manifest.schemaVersion === 1
    ? domainHash("agent-config", {
        adapterKey: manifest.adapterKey,
        capabilities: manifest.capabilities,
        connectorKey: manifest.connectorKey,
        endpoint: manifest.endpoint,
        ensBinding: manifest.ensBinding,
        priceAtomic: manifest.priceAtomic,
        proofPolicy: manifest.proofPolicy,
      })
    : manifest.schemaVersion === 2
      ? domainHash("agent-config", manifestConfigV2(manifest))
      : manifest.schemaVersion === 3
        ? domainHash("agent-config", manifestConfigV3(manifest))
        : domainHash("agent-config", manifestConfigV4(manifest));
  if (
    manifest.schemaVersion !== 1 &&
    (manifest.reviewedPromptHash !== promptHash || manifest.reviewedConfigHash !== configHash)
  ) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "Manifest review hashes do not match", 400);
  }
  if (manifest.schemaVersion === 3) assertCatalogManifestV3(manifest);
  if (manifest.schemaVersion === 4) assertCatalogManifestV4(manifest);
  return {
    manifestHash: domainHash("agent-manifest", manifest),
    promptHash,
    configHash,
  };
}

export function recommendationFor(ids: readonly SupportedAgentSkill[]): {
  reviewedPromptDraft: string;
  pinnedSkills: readonly PinnedAgentSkill[];
  nativeConnections: readonly AgentNativeConnection[];
  mcp: readonly [];
  readiness: "READY" | "REFUSED";
  reasons: readonly string[];
} {
  const skills = pinnedSkillsFor(ids);
  if (skills.length === 0) {
    return {
      reviewedPromptDraft: "",
      pinnedSkills: [],
      nativeConnections: [],
      mcp: [],
      readiness: "REFUSED",
      reasons: ["AT_LEAST_ONE_SUPPORTED_SKILL_REQUIRED"],
    };
  }
  return {
    reviewedPromptDraft: [
      "## Role",
      "You are a protected AlphaDawg agent.",
      "",
      "## Reviewed skills",
      ...skills.map((skill) => `- ${skill.id}`),
      "",
      "## Policy",
      "Use only server-provided native connections and return evidence-backed output.",
    ].join("\n"),
    pinnedSkills: skills,
    nativeConnections: nativeConnectionsFor(ids),
    mcp: [],
    readiness: "READY",
    reasons: [],
  };
}

export function foundingCatalogProjection(): CanonicalValue {
  return {
    categories: FOUNDING_PACK.categories,
    skills: Object.values(FOUNDING_PACK.skills).map((skill) => ({
      id: skill.id,
      category: skill.category,
      capabilities: skill.capabilities,
      constraints: skillConstraints(skill),
      providerAvailability: skill.id.startsWith("data.") ? "UNAVAILABLE" : "NOT_REQUIRED",
    })),
    templates: FOUNDING_PACK.templates.map((template) => ({
      id: template.id,
      label: template.name,
      capabilities: template.capabilities,
      skillIds: template.skills,
      priceAtomic: template.price,
    })),
    mcpProviders: Object.entries(MCP_REGISTRY).map(([provider, capabilities]) => ({
      provider,
      availability: "UNAVAILABLE",
      capabilities,
    })),
  };
}

export function isMcpBindingAllowlisted(bindingValue: McpBindingV1): boolean {
  return bindingValue.schemaVersion === 1 && bindingValue.access === "read-only" &&
    bindingValue.timeoutMs === 8000 && bindingValue.maxResponseBytes === 32768 &&
    bindingValue.id === `mcp.${bindingValue.provider}.${bindingValue.capability}` &&
    (MCP_REGISTRY[bindingValue.provider] as readonly string[] | undefined)?.includes(bindingValue.capability) === true;
}
