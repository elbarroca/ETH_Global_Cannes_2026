import type { CanonicalValue } from "./canonical";

export const JOB_STATES = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
  "A3_NOT_CONFIGURED",
] as const;

export type JobState = (typeof JOB_STATES)[number];
export type TerminalJobState = Exclude<JobState, "QUEUED" | "RUNNING">;

export interface KernelJobInput {
  prompt: string;
}

export interface AgentManifest extends Record<string, CanonicalValue> {
  schemaVersion: 1;
  name: string;
  description: string;
  instructions: string;
  capabilities: readonly string[];
  adapterKey: "protected-a3";
  endpoint: null;
  connectorKey: null;
  ownerWallet: string;
  payoutAddress: null;
  priceAtomic: string;
  asset: "USDC_ATOMIC";
  proofPolicy: "verified-receipt-required";
}

export interface PublishedAgent {
  agentId: string;
  versionId: string;
  version: number;
  name: string;
  capabilities: readonly string[];
  manifestHash: string;
  promptHash: string;
  configHash: string;
  adapterKey: "protected-a3";
  priceAtomic: string;
  asset: "USDC_ATOMIC";
  publishedAt: string;
}

export interface SubmittedJob {
  quoteId: string;
  intentId: string;
  orderId: string;
  jobId: string;
  effectId: string;
  state: JobState;
  version: number;
  amountAtomic: string;
  asset: string;
  replayed: boolean;
}

export interface JobSnapshot {
  jobId: string;
  effectId: string;
  buyerUserId: string;
  agentVersionId: string;
  state: JobState;
  version: number;
  attempts: number;
  maxAttempts: number;
  cancelRequestedAt: string | null;
  lastErrorCode: string | null;
  financialOutcome: "SETTLED" | "REFUNDED" | null;
  createdAt: string;
  updatedAt: string;
}
