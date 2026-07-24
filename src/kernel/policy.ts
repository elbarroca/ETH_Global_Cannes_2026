import { KernelError } from "./errors";
import type { AgentManifest, KernelJobInput } from "./types";

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

export function parseAgentInput(
  value: unknown,
  ownerWallet: string,
): { name: string; manifest: AgentManifest } {
  const input = objectRecord(value);
  rejectUnexpectedKeys(input, ["name", "description", "instructions", "capabilities"]);
  const name = boundedString(input.name, "name", 2, 80);
  const description = boundedString(input.description, "description", 10, 800);
  const instructions = boundedString(input.instructions, "instructions", 20, 4_000);
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
    },
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
