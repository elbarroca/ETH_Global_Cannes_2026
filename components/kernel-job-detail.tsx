"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DawgSpinner } from "@/components/dawg-spinner";
import { ProofRail } from "@/components/proof-rail";
import { EvidenceIndexItem } from "@/components/evidence-index-item";
import { Card, CardBody, CodeBlock } from "@/components/ui/card";
import { CopyableIdentifier, EvidenceStatus } from "@/components/ui/evidence";
import {
  ApiError,
  cancelKernelJob,
  getKernelJobDetail,
} from "@/lib/api";
import type {
  EvidenceState,
  KernelJobDetail as KernelJobDetailRecord,
} from "@/src/kernel/types";

const POLL_MS = 2_000;

export type KernelUiErrorKind =
  | "auth"
  | "authorization"
  | "not-found"
  | "conflict"
  | "not-configured"
  | "error";

export function classifyKernelError(error: unknown): {
  kind: KernelUiErrorKind;
  message: string;
} {
  if (!(error instanceof ApiError)) {
    return {
      kind: "error",
      message: error instanceof Error ? error.message : "The protected kernel request failed.",
    };
  }
  if (error.status === 401) {
    return { kind: "auth", message: "Reconnect your wallet to read protected jobs." };
  }
  if (error.status === 403) {
    return {
      kind: "authorization",
      message: "Refresh wallet authorization or complete onboarding before reading protected jobs.",
    };
  }
  if (error.status === 404) {
    return { kind: "not-found", message: "This job was not found for the authenticated buyer." };
  }
  if (error.status === 409) {
    return {
      kind: "conflict",
      message: "The kernel reported a conflict or replay mismatch. Refresh before taking another action.",
    };
  }
  if (error.status === 503 || error.code === "A3_NOT_CONFIGURED") {
    return {
      kind: "not-configured",
      message: "Protected A3 execution is not configured. No runtime evidence is available.",
    };
  }
  return { kind: "error", message: error.message };
}

export function isTerminalKernelJob(job: Pick<KernelJobDetailRecord, "state">): boolean {
  return job.state === "SUCCEEDED" || job.state === "FAILED" || job.state === "CANCELED" || job.state === "A3_NOT_CONFIGURED";
}

function stateEvidence(
  job: Pick<KernelJobDetailRecord, "state" | "evidence">,
): EvidenceState {
  if (job.state === "QUEUED" || job.state === "RUNNING" || job.state === "DELIVERY_READY") return "pending";
  if (job.state === "SUCCEEDED") {
    return job.evidence.receipt === "verified" ? "verified" : "failed";
  }
  if (job.state === "FAILED") return "failed";
  return "unavailable";
}

export function KernelErrorNotice({
  error,
  onRetry,
}: {
  error: { kind: KernelUiErrorKind; message: string };
  onRetry?: () => void;
}) {
  const title: Record<KernelUiErrorKind, string> = {
    auth: "Wallet connection required",
    authorization: "Fresh authorization required",
    "not-found": "Job not found",
    conflict: "Kernel conflict",
    "not-configured": "Protected runtime unavailable",
    error: "Job request failed",
  };
  return (
    <div role="alert" className="rounded-xl border border-blood-500/30 bg-blood-900/20 p-4">
      <p className="text-sm font-semibold text-blood-200">{title[error.kind]}</p>
      <p className="mt-1 text-sm leading-relaxed text-void-400">{error.message}</p>
      {onRetry && error.kind !== "not-found" && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 min-h-11 rounded-xl border border-void-700 px-4 text-sm font-semibold text-void-200 hover:bg-void-800"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function KernelJobDetailView({
  job,
  mode = "detail",
  canceling = false,
  onCancel,
}: {
  job: KernelJobDetailRecord;
  mode?: "detail" | "verify" | "embedded";
  canceling?: boolean;
  onCancel?: () => void;
}) {
  const receipt = job.evidenceDetail.receipt;
  const delivery = job.evidenceDetail.delivery;
  const { settlement, refund } = job.evidenceDetail.financial;
  const cancelable = (job.state === "QUEUED" || job.state === "RUNNING") && !job.cancelRequestedAt;

  return (
    <div className="min-w-0 space-y-4" data-proof-workbench={mode === "verify" ? "true" : undefined}>
      <Card className="min-w-0 overflow-hidden border-dawg-500/25">
        <CardBody className="space-y-5">
        <div className="flex flex-col gap-4 border-b border-void-800 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="instrument-label">
              {mode === "verify" ? "Proof workbench" : mode === "embedded" ? "Expanded job" : "Protected job"}
            </p>
            {mode === "embedded" ? (
              <h4 className="mt-1 text-lg font-bold text-void-100">
                {job.agent.name} <span className="text-void-500">v{job.agent.version}</span>
              </h4>
            ) : (
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-void-100">
                {job.agent.name} <span className="text-void-500">v{job.agent.version}</span>
              </h1>
            )}
            <p className="mt-1 text-xs text-void-500">
              Updated {job.updatedAt} | attempt {job.attempts}/{job.maxAttempts}
            </p>
          </div>
          <EvidenceStatus state={stateEvidence(job)} label={job.state} />
        </div>

        {job.state === "A3_NOT_CONFIGURED" && (
          <div className="rounded-xl border border-void-700 bg-void-950 p-3 text-sm text-void-400">
            Protected A3 execution was not configured for this job. Later runtime evidence remains unavailable.
          </div>
        )}
        {job.state === "DELIVERY_READY" && (
          <div className="rounded-xl border border-dawg-500/25 bg-dawg-500/5 p-3 text-sm text-dawg-200">
            Verified delivery evidence is ready. Settlement and terminal success remain pending until payment finalization succeeds.
          </div>
        )}
        {job.evidenceDetail.errorCode && (
          <div className="rounded-xl border border-blood-500/25 bg-blood-900/15 p-3 text-sm text-blood-300">
            Error code: <span className="font-mono">{job.evidenceDetail.errorCode}</span>
          </div>
        )}
        {job.cancelRequestedAt && !isTerminalKernelJob(job) && (
          <div className="rounded-xl border border-dawg-500/25 bg-dawg-500/5 p-3 text-sm text-dawg-200">
            Cancellation requested at {job.cancelRequestedAt}; the worker has not reached a terminal state yet.
          </div>
        )}

        <div className="grid min-w-0 gap-2 sm:grid-cols-3">
          <CopyableIdentifier label="Job ID" value={job.jobId} />
          <CopyableIdentifier label="Effect ID" value={job.effectId} />
          <CopyableIdentifier label="Version ID" value={job.agentVersionId} />
        </div>

        <ProofRail job={job} />

        </CardBody>
      </Card>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <Card className="min-w-0 overflow-hidden">
          <CardBody className="space-y-5">
        <section className="space-y-3" aria-labelledby={`receipt-${job.jobId}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={`receipt-${job.jobId}`} className="text-sm font-semibold text-void-100">
              Canonical receipt and delivery
            </h2>
            <EvidenceStatus state={job.evidence.receipt} />
          </div>
          {receipt ? (
            <div className="grid min-w-0 gap-2 sm:grid-cols-3">
              <CopyableIdentifier label="Receipt ID" value={receipt.receiptId} />
              <CopyableIdentifier label="Proof hash" value={receipt.proofHash} />
              <CopyableIdentifier label="Result hash" value={receipt.resultHash} />
            </div>
          ) : (
            <p className="rounded-xl border border-void-800 bg-void-950/45 p-3 text-sm text-void-500">
              No canonical verified receipt is available.
            </p>
          )}

          {delivery && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-void-500">
                <span>Canonical delivery output</span>
                <span>{delivery.terminalAt}</span>
              </div>
              <CodeBlock className="max-h-72 overflow-auto whitespace-pre-wrap break-words">
                {JSON.stringify(delivery.result, null, 2)}
              </CodeBlock>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-void-800 bg-void-950/45 p-4" aria-label="Financial evidence">
          <p className="text-xs font-semibold uppercase tracking-wider text-void-500">Financial evidence</p>
          <p className="mt-2 text-sm text-void-200">
            {settlement
              ? `Settled ${settlement.amountAtomic} ${settlement.asset} at ${settlement.createdAt}.`
              : refund
                ? `Refunded ${refund.amountAtomic} ${refund.asset} at ${refund.createdAt}; reason ${refund.reasonCode}.`
                : "No settlement or refund record is available yet."}
          </p>
        </section>

        <div className="flex flex-col gap-2 border-t border-void-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href={`/dashboard/compute/${job.jobId}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-void-700 px-4 text-sm font-semibold text-void-200 hover:bg-void-800">
              Compute view
            </Link>
            <Link href={`/verify?jobId=${encodeURIComponent(job.jobId)}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-void-700 px-4 text-sm font-semibold text-void-200 hover:bg-void-800">
              Verify view
            </Link>
          </div>
          {onCancel && (job.state === "QUEUED" || job.state === "RUNNING") && (
            <button
              type="button"
              onClick={onCancel}
              disabled={canceling || !cancelable}
              className="min-h-11 rounded-xl border border-blood-500/35 px-4 text-sm font-semibold text-blood-300 hover:bg-blood-900/20 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {job.cancelRequestedAt ? "Cancellation requested" : canceling ? "Requesting cancellation…" : "Cancel job"}
            </button>
          )}
        </div>
          </CardBody>
        </Card>

        <aside className="space-y-3 xl:sticky xl:top-20 xl:self-start" aria-label="Job contract">
          <div className="instrument-panel p-4">
            <p className="instrument-label">Job contract</p>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex items-start justify-between gap-3"><dt className="text-void-600">Creator parent</dt><dd className="min-w-0 break-all text-right font-mono text-void-300">{job.agent.creatorParent ?? "Unavailable"}</dd></div>
              <div className="flex items-start justify-between gap-3"><dt className="text-void-600">Agent subname</dt><dd className="min-w-0 break-all text-right font-mono text-dawg-300">{job.agent.fullSubname ?? "Unavailable"}</dd></div>
              <div className="flex items-start justify-between gap-3"><dt className="text-void-600">Authority</dt><dd className="min-w-0 break-all text-right font-mono text-void-300">{job.agent.authorityOwner ?? "Unavailable"}</dd></div>
              <div className="flex items-start justify-between gap-3"><dt className="text-void-600">Delegate</dt><dd className="min-w-0 break-all text-right font-mono text-void-300">{job.agent.authorityDelegate ?? "Unavailable"}</dd></div>
              <div className="flex items-start justify-between gap-3"><dt className="text-void-600">Price</dt><dd className="text-right font-mono text-void-300">{job.agent.priceAtomic} {job.agent.asset}</dd></div>
              <div className="flex items-start justify-between gap-3"><dt className="text-void-600">Eligibility</dt><dd className="text-right font-mono text-void-300">{job.agent.canonicalState === "CANONICAL" ? "Canonical version" : "Not canonical"}</dd></div>
              <div className="flex items-start justify-between gap-3"><dt className="text-void-600">Release SHA</dt><dd className="min-w-0 break-all text-right font-mono text-void-300">{job.agent.authorityReleaseSha ?? "Unavailable"}</dd></div>
            </dl>
          </div>
          <div className="rounded-xl border border-void-800 bg-black p-4">
            <p className="instrument-label">Exact refusal</p>
            <p className={`mt-3 break-words font-mono text-xs leading-relaxed ${job.agent.refusalReason ? "text-blood-300" : "text-void-500"}`}>
              {job.agent.refusalReason ?? "No refusal was recorded for this published version."}
            </p>
          </div>
        </aside>
      </div>
      <section className="space-y-3" aria-labelledby={`evidence-index-${job.jobId}`}>
        <div><p className="instrument-label">Authenticated job detail</p><h2 id={`evidence-index-${job.jobId}`} className="mt-2 text-lg font-semibold text-void-100">Evidence index</h2></div>
        <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(["ens", "compute", "storage", "receipt", "uniswap"] as const).map((kind) => <EvidenceIndexItem key={kind} job={job} kind={kind} />)}
        </div>
      </section>
    </div>
  );
}

export function KernelJobDetail({
  jobId,
  mode = "detail",
}: {
  jobId: string;
  mode?: "detail" | "verify" | "embedded";
}) {
  const [job, setJob] = useState<KernelJobDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<ReturnType<typeof classifyKernelError> | null>(null);

  const load = useCallback(async (silent = false): Promise<void> => {
    if (!silent) setLoading(true);
    try {
      const next = await getKernelJobDetail(jobId);
      setJob(next);
      setError(null);
    } catch (loadError) {
      setError(classifyKernelError(loadError));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const shouldPoll = job !== null && !isTerminalKernelJob(job);
  useEffect(() => {
    if (!shouldPoll) return;
    let canceled = false;
    let timer: number | null = null;

    const schedule = (): void => {
      if (canceled || document.visibilityState !== "visible") return;
      timer = window.setTimeout(() => {
        void load(true).finally(schedule);
      }, POLL_MS);
    };
    const handleVisibility = (): void => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      if (document.visibilityState === "visible") {
        void load(true).finally(schedule);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    schedule();
    return () => {
      canceled = true;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [load, shouldPoll]);

  async function cancel(): Promise<void> {
    if (!job || (job.state !== "QUEUED" && job.state !== "RUNNING") || job.cancelRequestedAt) return;
    setCanceling(true);
    try {
      await cancelKernelJob(job.jobId);
      await load(true);
    } catch (cancelError) {
      setError(classifyKernelError(cancelError));
    } finally {
      setCanceling(false);
    }
  }

  if (loading && !job) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <DawgSpinner size={48} label="Loading protected job…" />
      </div>
    );
  }
  if (error && !job) return <KernelErrorNotice error={error} onRetry={() => void load()} />;
  if (!job) {
    return <KernelErrorNotice error={{ kind: "not-found", message: "This job is unavailable." }} />;
  }

  return (
    <div className="space-y-3">
      {error && <KernelErrorNotice error={error} onRetry={() => void load()} />}
      <KernelJobDetailView job={job} mode={mode} canceling={canceling} onCancel={() => void cancel()} />
    </div>
  );
}
