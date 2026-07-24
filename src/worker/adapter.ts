import type { CanonicalValue } from "../kernel/canonical";

export interface AdapterExecutionRequest {
  effectId: string;
  jobId: string;
  intentId: string;
  buyerUserId: string;
  agentVersionId: string;
  ownerUserId: string;
  leaseOwner: string;
  workerEpoch: string;
  claimVersion: number;
  leaseExpiresAt: Date;
  attempt: number;
  maxAttempts: number;
  input: { prompt: string };
  signal: AbortSignal;
}

export type AdapterExecutionResult =
  | {
      ok: true;
      result: CanonicalValue;
      proofHash: string;
      verified: true;
    }
  | {
      ok: false;
      errorCode: string;
      retryable: boolean;
    };

export interface KernelAdapter {
  readonly key: "protected-a3";
  readonly requiresVerifiedJournal?: boolean;
  execute(request: AdapterExecutionRequest): Promise<AdapterExecutionResult>;
}

export class ProtectedA3Adapter implements KernelAdapter {
  readonly key = "protected-a3" as const;

  async execute(): Promise<AdapterExecutionResult> {
    return {
      ok: false,
      errorCode: "A3_NOT_CONFIGURED",
      retryable: false,
    };
  }
}
