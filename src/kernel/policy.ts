import { KernelError } from "./errors";
import { normalize, packetToBytes } from "viem/ens";
import type {
  AgentEnsBinding,
  AgentManifest,
  KernelJobInput,
} from "./types";
import {
  buildManifestV5,
  buildManifestV2,
  isSupportedAgentSkill,
  isFoundingSkillId,
  parseRiskTiers,
  type SupportedAgentSkill,
} from "./agent-catalog";
import type { McpProviderId, RiskLane } from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isKernelUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "A JSON object is required", 400);
  }
  return value as Record<string, unknown>;
}

function rejectUnexpectedKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  if (Object.keys(value).some((key) => !allowedSet.has(key))) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "Unexpected or server-owned field", 400);
  }
}

function boundedString(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): string {
  if (typeof value !== "string") {
    throw new KernelError("KERNEL_INVALID_REQUEST", `${field} must be a string`, 400);
  }
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new KernelError(
      "KERNEL_INVALID_REQUEST",
      `${field} must be ${minimum}-${maximum} characters`,
      400,
    );
  }
  return normalized;
}

function boundedMarkdown(value: unknown): string {
  const markdown = boundedString(value, "instructions", 20, 4_000);
  if (
    markdown.includes("\0") ||
    /<\/?[a-z][^>]*>/i.test(markdown) ||
    /!\[[^\]]*\]\(/.test(markdown) ||
    /(?:javascript|data):/i.test(markdown) ||
    /https?:\/\//i.test(markdown)
  ) {
    throw new KernelError(
      "KERNEL_INVALID_REQUEST",
      "instructions must be inert Markdown without HTML, images, URLs, or active schemes",
      400,
    );
  }
  return markdown;
}

export function parseAgentInput(
  value: unknown,
  ownerWallet: string,
): { name: string; manifest: AgentManifest } {
  const input = objectRecord(value);
  rejectUnexpectedKeys(input, ["name", "description", "instructions", "capabilities"]);
  const name = boundedString(input.name, "name", 2, 80);
  const description = boundedString(input.description, "description", 10, 800);
  const instructions = boundedMarkdown(input.instructions);
  if (!Array.isArray(input.capabilities) || input.capabilities.length < 1 || input.capabilities.length > 3) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "capabilities must contain 1-3 entries", 400);
  }
  const capabilities = [...new Set(input.capabilities.map((entry): SupportedAgentSkill => {
    if (typeof entry !== "string" || !isSupportedAgentSkill(entry)) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "Unsupported capability", 400);
    }
    return entry;
  }))].sort();
  return {
    name,
    manifest: buildManifestV2({
      name,
      description,
      instructions,
      skills: capabilities,
      ownerWallet,
    }),
  };
}

export function parseCatalogAgentInput(
  value: unknown,
  ownerWallet: string,
): { name: string; manifest: AgentManifest } {
  const input = objectRecord(value);
  rejectUnexpectedKeys(input, ["templateId", "name", "description", "riskTiers"]);
  const templateId = boundedString(input.templateId, "templateId", 2, 80);
  const name = boundedString(input.name, "name", 2, 80);
  const description = boundedString(input.description, "description", 10, 800);
  return {
    name,
    manifest: buildManifestV5({
      templateId,
      name,
      description,
      ownerWallet,
      riskTiers: input.riskTiers === undefined ? undefined : parseRiskTiers(input.riskTiers),
    }),
  };
}

function dnsName(value: string): string {
  return `0x${Buffer.from(packetToBytes(value)).toString("hex")}`;
}

export function parseEnsBinding(value: unknown): AgentEnsBinding {
  const input = objectRecord(value);
  rejectUnexpectedKeys(input, ["creatorParent", "agentLabel"]);
  try {
    const creatorParent = normalize(boundedString(input.creatorParent, "creatorParent", 5, 255));
    const agentLabel = normalize(boundedString(input.agentLabel, "agentLabel", 1, 63));
    if (agentLabel.includes(".")) throw new Error("agent label must be one label");
    const fullSubname = normalize(`${agentLabel}.${creatorParent}`);
    return {
      creatorParent,
      agentLabel,
      fullSubname,
      creatorDnsName: dnsName(creatorParent),
      agentDnsName: dnsName(fullSubname),
    };
  } catch {
    throw new KernelError("KERNEL_INVALID_REQUEST", "Invalid ENS creator parent or agent label", 400);
  }
}

export type ParsedAgentAction =
  | { action: "CREATE_DRAFT"; agentId: string | null; manifest: AgentManifest }
  | { action: "BIND_NAME"; versionId: string; binding: AgentEnsBinding }
  | { action: "PREPARE_ENS_WRITE"; versionId: string }
  | { action: "PUBLISH_VERSION"; versionId: string };

export function parseAgentAction(value: unknown, ownerWallet: string): ParsedAgentAction {
  const body = objectRecord(value);
  if (typeof body.action !== "string") {
    throw new KernelError("KERNEL_INVALID_REQUEST", "action is required", 400);
  }
  if (body.action === "CREATE_DRAFT") {
    if (body.agentId !== undefined && !isKernelUuid(body.agentId)) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "agentId must be a UUID", 400);
    }
    const catalogDraft = body.templateId !== undefined;
    rejectUnexpectedKeys(body, catalogDraft
      ? ["action", "agentId", "templateId", "name", "description", "riskTiers"]
      : ["action", "agentId", "name", "description", "instructions", "capabilities"]);
    const { manifest } = catalogDraft
      ? parseCatalogAgentInput({
          templateId: body.templateId,
          name: body.name,
          description: body.description,
          riskTiers: body.riskTiers,
        }, ownerWallet)
      : parseAgentInput({
          name: body.name,
          description: body.description,
          instructions: body.instructions,
          capabilities: body.capabilities,
        }, ownerWallet);
    return { action: "CREATE_DRAFT", agentId: body.agentId ?? null, manifest };
  }
  if (body.action === "BIND_NAME") {
    rejectUnexpectedKeys(body, ["action", "versionId", "creatorParent", "agentLabel"]);
    if (!isKernelUuid(body.versionId)) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "versionId must be a UUID", 400);
    }
    return {
      action: "BIND_NAME",
      versionId: body.versionId,
      binding: parseEnsBinding({
        creatorParent: body.creatorParent,
        agentLabel: body.agentLabel,
      }),
    };
  }
  if (body.action === "PREPARE_ENS_WRITE" || body.action === "PUBLISH_VERSION") {
    rejectUnexpectedKeys(body, ["action", "versionId"]);
    if (!isKernelUuid(body.versionId)) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "versionId must be a UUID", 400);
    }
    return { action: body.action, versionId: body.versionId };
  }
  throw new KernelError("KERNEL_INVALID_REQUEST", "Unsupported agent lifecycle action", 400);
}

export function parseJobSubmission(value: unknown): {
  agentVersionId: string;
  input: KernelJobInput;
} {
  const body = objectRecord(value);
  rejectUnexpectedKeys(body, ["agentVersionId", "input"]);
  if (!isKernelUuid(body.agentVersionId)) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "agentVersionId must be a UUID", 400);
  }
  const rawInput = objectRecord(body.input);
  rejectUnexpectedKeys(rawInput, ["prompt"]);
  return {
    agentVersionId: body.agentVersionId,
    input: { prompt: boundedString(rawInput.prompt, "input.prompt", 1, 2_000) },
  };
}

export function parseHireRequestInput(value: unknown): {
  agentVersionId: string;
  prompt: string;
} {
  const body = objectRecord(value);
  rejectUnexpectedKeys(body, ["agentVersionId", "prompt"]);
  if (!isKernelUuid(body.agentVersionId)) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "agentVersionId must be a UUID", 400);
  }
  return {
    agentVersionId: body.agentVersionId,
    prompt: boundedString(body.prompt, "prompt", 1, 2_000),
  };
}

export interface AgentListFilters {
  capability: SupportedAgentSkill | null;
  skill: string | null;
  mcpProvider: McpProviderId | null;
  riskTier: RiskLane | null;
  cursor: { publishedAt: Date; versionId: string } | null;
  limit: number;
  active: boolean;
}

export function parseAgentListFilters(url: URL): AgentListFilters {
  const allowed = new Set(["capability", "skill", "mcpProvider", "riskTier", "cursor", "limit"]);
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "Invalid agent listing filter", 400);
    }
  }
  const capability = url.searchParams.get("capability");
  if (capability !== null && !isSupportedAgentSkill(capability)) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "Unsupported capability filter", 400);
  }
  const skill = url.searchParams.get("skill");
  if (skill !== null && !isFoundingSkillId(skill)) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "Unsupported skill filter", 400);
  }
  const mcpProvider = url.searchParams.get("mcpProvider");
  if (mcpProvider !== null && mcpProvider !== "coingecko" && mcpProvider !== "the-graph") {
    throw new KernelError("KERNEL_INVALID_REQUEST", "Unsupported MCP provider filter", 400);
  }
  const riskTier = url.searchParams.get("riskTier");
  if (riskTier !== null && !["LOW", "MID", "HIGH"].includes(riskTier)) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "Unsupported risk tier filter", 400);
  }
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit === null ? 50 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "limit must be an integer from 1 to 100", 400);
  }
  const rawCursor = url.searchParams.get("cursor");
  let cursor: AgentListFilters["cursor"] = null;
  if (rawCursor !== null) {
    try {
      const decoded = Buffer.from(rawCursor, "base64url").toString("utf8");
      const separator = decoded.lastIndexOf("|");
      const publishedAt = new Date(decoded.slice(0, separator));
      const versionId = decoded.slice(separator + 1);
      if (
        Buffer.from(decoded, "utf8").toString("base64url") !== rawCursor ||
        separator < 1 || Number.isNaN(publishedAt.getTime()) || !isKernelUuid(versionId)
      ) throw new Error();
      cursor = { publishedAt, versionId };
    } catch {
      throw new KernelError("KERNEL_INVALID_REQUEST", "Invalid agent listing cursor", 400);
    }
  }
  return {
    capability: capability as SupportedAgentSkill | null,
    skill,
    mcpProvider: mcpProvider as McpProviderId | null,
    riskTier: riskTier as RiskLane | null,
    cursor,
    limit,
    active: url.search.length > 0,
  };
}

export function parseIdempotencyKey(value: string | null): string {
  if (!value || !/^[A-Za-z0-9._:-]{8,128}$/.test(value)) {
    throw new KernelError(
      "KERNEL_INVALID_REQUEST",
      "Idempotency-Key must be 8-128 URL-safe characters",
      400,
    );
  }
  return value;
}

export const KERNEL_COMMISSION_BPS = 500n;
export const KERNEL_BPS_DENOMINATOR = 10_000n;
export const KERNEL_QUOTE_TTL_MS = 5 * 60 * 1_000;
