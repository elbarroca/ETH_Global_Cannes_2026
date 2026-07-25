import { KernelError } from "./errors";
import { normalize, packetToBytes } from "viem/ens";
import type {
  A4PublicationReadback,
  AgentEnsBinding,
  AgentManifest,
  KernelJobInput,
} from "./types";

const ALLOWED_CAPABILITIES = new Set(["market-analysis", "risk-analysis", "research"]);
const AGENT_PRICE_ATOMIC = 1_000n;
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
  const capabilities = [...new Set(input.capabilities.map((entry) => {
    if (typeof entry !== "string" || !ALLOWED_CAPABILITIES.has(entry)) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "Unsupported capability", 400);
    }
    return entry;
  }))].sort();
  return {
    name,
    manifest: {
      schemaVersion: 1,
      name,
      description,
      instructions,
      capabilities,
      adapterKey: "protected-a3",
      endpoint: null,
      connectorKey: null,
      ownerWallet,
      payoutAddress: null,
      priceAtomic: AGENT_PRICE_ATOMIC.toString(),
      asset: "USDC_ATOMIC",
      proofPolicy: "verified-receipt-required",
      ensBinding: null,
    },
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
    rejectUnexpectedKeys(body, [
      "action", "agentId", "name", "description", "instructions", "capabilities",
    ]);
    if (body.agentId !== undefined && !isKernelUuid(body.agentId)) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "agentId must be a UUID", 400);
    }
    const { manifest } = parseAgentInput({
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

export function validateA4PublicationReadback(
  value: unknown,
  expected: {
    agentVersionId: string;
    manifestHash: string;
    binding: AgentEnsBinding;
    ownerWallet: string;
  },
  now: Date,
): A4PublicationReadback {
  const readback = objectRecord(value);
  rejectUnexpectedKeys(readback, [
    "allowed", "errorCode", "agentVersionId", "manifestHash", "creatorParent",
    "agentLabel", "fullSubname", "canonical", "owner", "delegate", "policyVersion",
    "recordHash", "observedAt", "freshUntil", "releaseSha",
  ]);
  const errorCode = readback.errorCode;
  if (readback.allowed !== true) {
    if (typeof errorCode !== "string" || !/^[A-Z][A-Z0-9_]{2,64}$/.test(errorCode)) {
      throw new KernelError("KERNEL_ENS_AUTHORITY_DENIED", "A4 authority refused publication", 409);
    }
    throw new KernelError("KERNEL_ENS_AUTHORITY_DENIED", errorCode, 409);
  }
  const owner = typeof readback.owner === "string" ? readback.owner.toLowerCase() : "";
  const delegate = readback.delegate === null
    ? null
    : typeof readback.delegate === "string" ? readback.delegate.toLowerCase() : "";
  const observedAt = typeof readback.observedAt === "string" ? new Date(readback.observedAt) : new Date(NaN);
  const freshUntil = typeof readback.freshUntil === "string" ? new Date(readback.freshUntil) : new Date(NaN);
  if (
    readback.errorCode !== null ||
    readback.agentVersionId !== expected.agentVersionId ||
    readback.manifestHash !== expected.manifestHash ||
    readback.creatorParent !== expected.binding.creatorParent ||
    readback.agentLabel !== expected.binding.agentLabel ||
    readback.fullSubname !== expected.binding.fullSubname ||
    readback.canonical !== true ||
    !/^0x[0-9a-f]{40}$/.test(owner) ||
    delegate !== null && !/^0x[0-9a-f]{40}$/.test(delegate) ||
    owner !== expected.ownerWallet && delegate !== expected.ownerWallet ||
    typeof readback.policyVersion !== "string" || !/^[a-z][a-z0-9-]{2,63}$/.test(readback.policyVersion) ||
    typeof readback.recordHash !== "string" || !/^[0-9a-f]{64}$/.test(readback.recordHash) ||
    Number.isNaN(observedAt.getTime()) || observedAt.toISOString() !== readback.observedAt ||
    Number.isNaN(freshUntil.getTime()) || freshUntil.toISOString() !== readback.freshUntil ||
    observedAt > now || freshUntil <= now || freshUntil.getTime() - observedAt.getTime() > 3_600_000 ||
    typeof readback.releaseSha !== "string" || !/^[0-9a-f]{40}$/.test(readback.releaseSha)
  ) {
    throw new KernelError("KERNEL_ENS_AUTHORITY_DENIED", "A4 authority readback is stale or mismatched", 409);
  }
  return {
    allowed: true,
    errorCode: null,
    agentVersionId: expected.agentVersionId,
    manifestHash: expected.manifestHash,
    creatorParent: expected.binding.creatorParent,
    agentLabel: expected.binding.agentLabel,
    fullSubname: expected.binding.fullSubname,
    canonical: true,
    owner,
    delegate,
    policyVersion: readback.policyVersion,
    recordHash: readback.recordHash,
    observedAt: observedAt.toISOString(),
    freshUntil: freshUntil.toISOString(),
    releaseSha: readback.releaseSha,
  };
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
