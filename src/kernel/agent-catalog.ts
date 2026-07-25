import { domainHash, type CanonicalValue } from "./canonical";
import { KernelError } from "./errors";
import type {
  AgentEnsBinding,
  AgentManifest,
  AgentManifestV2,
  AgentNativeConnection,
  PinnedAgentSkill,
} from "./types";

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

function manifestConfig(manifest: Omit<AgentManifestV2, "reviewedConfigHash">): CanonicalValue {
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
    reviewedConfigHash: domainHash("agent-config", manifestConfig(manifest)),
  };
}

export function bindManifestEns(manifest: AgentManifest, binding: AgentEnsBinding): AgentManifest {
  if (manifest.schemaVersion === 1) return { ...manifest, ensBinding: binding };
  const updated = {
    ...manifest,
    ensBinding: binding,
    ensBindingHash: domainHash("agent-ens-binding", binding),
  };
  return {
    ...updated,
    reviewedConfigHash: domainHash("agent-config", manifestConfig(updated)),
  };
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
    : domainHash("agent-config", manifestConfig(manifest));
  if (
    manifest.schemaVersion === 2 &&
    (manifest.reviewedPromptHash !== promptHash || manifest.reviewedConfigHash !== configHash)
  ) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "Manifest review hashes do not match", 400);
  }
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
