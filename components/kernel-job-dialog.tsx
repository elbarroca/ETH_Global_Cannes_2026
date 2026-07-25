"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SpinnerGapIcon } from "@phosphor-icons/react";
import { Dialog } from "@/components/ui/dialog";
import { CopyableIdentifier, EvidenceStatus } from "@/components/ui/evidence";
import {
  ApiError,
  createProtectedHireRequest,
  getProtectedHireRequest,
  type HireRequestSnapshot,
  type ProtectedPublishedAgent,
} from "@/lib/api";
import { formatUsdcAtomic } from "@/lib/format-usdc";
import type { EvidenceState } from "@/src/kernel/types";

const POLL_MS = 1_000;

interface KernelJobDialogProps {
  agent: ProtectedPublishedAgent;
  onClose: () => void;
}

function submissionError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "The protected hire could not be submitted.";
  }
  if (error.status === 401) return "Wallet authorization expired. Authorize the workspace before submitting this hire.";
  if (error.code === "AUTH_USER_REQUIRED") return "Complete onboarding before submitting a protected hire.";
  if (error.code === "AUTH_ACTION_REQUIRED") return "Fresh authenticate authorization is required before submitting this hire.";
  if (error.status === 403) return `Forbidden: ${error.message}`;
  if (error.code === "KERNEL_NOT_FOUND") return "This immutable agent version or hire request is no longer available.";
  if (error.code === "KERNEL_IDEMPOTENCY_MISMATCH") return "This request key was already used with different input. Close this dialog and start a new hire.";
  if (error.code === "KERNEL_CONFLICT") return "The kernel could not safely create this hire. Retry with the same request key.";
  return error.message;
}

function terminal(request: HireRequestSnapshot): boolean {
  return request.state === "JOB_QUEUED" || request.state === "BLOCKED" || request.state === "FAILED";
}

function requestEvidenceState(request: HireRequestSnapshot): EvidenceState {
  if (request.state === "FAILED") return "failed";
  if (request.state === "BLOCKED") return "unavailable";
  return "pending";
}

function requestLabel(request: HireRequestSnapshot): string {
  if (request.state === "PENDING_CONTEXT") return "Pending context";
  if (request.state === "CONTEXT_RUNNING") return "Context running";
  if (request.state === "JOB_QUEUED") return "Job queued";
  return request.state;
}

export function KernelJobDialog({ agent, onClose }: KernelJobDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hireRequest, setHireRequest] = useState<HireRequestSnapshot | null>(null);
  const [replayed, setReplayed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    setPrompt("");
    setIdempotencyKey(crypto.randomUUID());
    setHireRequest(null);
    setReplayed(false);
    setErrorMessage(null);
    setStatusError(null);
  }, [agent.versionId]);

  const activeHireRequestId = hireRequest && !terminal(hireRequest) ? hireRequest.hireRequestId : null;

  useEffect(() => {
    const hireRequestId = activeHireRequestId;
    if (!hireRequestId) return;
    let canceled = false;
    let timer: number | null = null;
    let controller: AbortController | null = null;

    const poll = async (): Promise<void> => {
      controller = new AbortController();
      try {
        const next = await getProtectedHireRequest(hireRequestId, controller.signal);
        if (canceled) return;
        setHireRequest(next);
        setStatusError(null);
        if (!terminal(next)) timer = window.setTimeout(() => void poll(), POLL_MS);
      } catch (error) {
        if (canceled || controller.signal.aborted) return;
        setStatusError(`Latest hire state is ambiguous: ${submissionError(error)} Do not submit a new request.`);
        timer = window.setTimeout(() => void poll(), POLL_MS * 2);
      }
    };

    timer = window.setTimeout(() => void poll(), POLL_MS);
    return () => {
      canceled = true;
      controller?.abort();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [activeHireRequestId]);

  async function submit(): Promise<void> {
    if (agent.ownedByViewer || !agent.hireable || agent.canonicalState !== "CANONICAL") {
      setErrorMessage(agent.ownedByViewer
        ? "Self-hire refused: buyer wallet must differ from the publishing owner."
        : agent.refusalReason ?? "This version is not eligible for protected hire.");
      return;
    }
    const normalizedPrompt = prompt.trim();
    if (!idempotencyKey || normalizedPrompt.length < 1 || normalizedPrompt.length > 2_000) return;

    setSubmitting(true);
    setErrorMessage(null);
    setStatusError(null);
    try {
      const next = await createProtectedHireRequest(
        { agentVersionId: agent.versionId, prompt: normalizedPrompt },
        idempotencyKey,
      );
      setHireRequest(next);
      setReplayed(next.replayed);
    } catch (error) {
      setErrorMessage(submissionError(error));
    } finally {
      setSubmitting(false);
    }
  }

  const queuedWithoutJob = hireRequest?.state === "JOB_QUEUED" && !hireRequest.jobId;

  return (
    <Dialog
      open
      title={hireRequest ? "Protected hire status" : `Run ${agent.name}`}
      description="One idempotent hire request resolves context before the exact immutable job is queued."
      onClose={onClose}
      dismissible={!submitting}
      className="max-w-xl"
    >
      {!hireRequest ? (
        <div className="space-y-5">
          <div className="border-y border-void-800 py-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="text-sm font-semibold text-void-100">{agent.name}</p><p className="mt-1 text-xs text-void-500">Immutable version {agent.version}</p></div>
              <EvidenceStatus state="verified" label="Published" />
            </div>
            <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
              <div><dt className="font-semibold text-void-500">Price</dt><dd className="mt-1 font-mono text-void-200">{formatUsdcAtomic(agent.priceAtomic)}</dd></div>
              <div><dt className="font-semibold text-void-500">Proof policy</dt><dd className="mt-1 font-mono text-void-200">{agent.proofPolicy}</dd></div>
              <div><dt className="font-semibold text-void-500">Owner</dt><dd className="mt-1 break-all font-mono text-void-200">{agent.ownerWallet}</dd></div>
              <div><dt className="font-semibold text-void-500">Release SHA</dt><dd className="mt-1 break-all font-mono text-void-200">{agent.authorityReleaseSha}</dd></div>
            </dl>
            <p className="mt-3 break-words text-xs text-void-400">{agent.mcpSummary?.map((binding) => `${binding.provider}: ${binding.capability}`).join(", ") || "No MCP binding is required for this immutable version."}</p>
          </div>

          <p className="border-l-2 border-dawg-700 pl-3 text-xs leading-relaxed text-void-400">Published does not mean deployed or online. Context, 0G, Storage, receipt, delivery, and settlement remain per-job evidence.</p>

          <div className="space-y-1.5">
            <label htmlFor="kernel-job-prompt" className="text-xs font-semibold text-void-300">Task prompt</label>
            <textarea id="kernel-job-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={2_000} rows={7} disabled={submitting} placeholder="Describe the bounded analysis and evidence you need." className="w-full resize-y rounded-[10px] border border-void-700 bg-void-950 px-3 py-2.5 text-sm leading-relaxed text-void-100 placeholder:text-void-500 focus:border-dawg-500 focus:outline-none" />
            <p className="text-right font-mono text-xs text-void-500">{prompt.length} / 2,000</p>
          </div>

          {errorMessage && <div role="alert" className="border-l-2 border-blood-500 pl-3"><p className="text-sm text-blood-300">{errorMessage}</p><p className="mt-1 text-xs text-void-500">Retrying here reuses the same request key.</p></div>}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={submitting} className="min-h-11 rounded-[10px] border border-void-700 px-4 text-sm font-semibold text-void-300 hover:bg-void-800 disabled:opacity-50">Cancel</button>
            <button type="button" onClick={() => void submit()} disabled={submitting || !idempotencyKey || prompt.trim().length < 1 || agent.ownedByViewer || !agent.hireable || agent.canonicalState !== "CANONICAL"} className="cta-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-45">
              {submitting && <SpinnerGapIcon size={16} className="animate-spin" aria-hidden />}
              {agent.ownedByViewer ? "Self-hire refused" : submitting ? "Submitting safely…" : errorMessage ? "Retry same request" : "Submit protected hire"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="border-y border-void-800 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-semibold text-void-100">{replayed ? "Existing hire returned safely" : requestLabel(hireRequest)}</p><p className="mt-1 text-sm text-void-400">{replayed ? "The same request key returned the original hire; no duplicate effect was created." : hireRequest.state === "PENDING_CONTEXT" ? "Waiting for the protected worker to claim context collection." : hireRequest.state === "CONTEXT_RUNNING" ? "Bounded MCP context is being collected before job creation." : hireRequest.state === "JOB_QUEUED" ? "The exact-version job is queued. Proof updates remain per job." : "The request stopped before a job could be queued."}</p></div>
              <EvidenceStatus state={queuedWithoutJob ? "failed" : requestEvidenceState(hireRequest)} label={queuedWithoutJob ? "Invariant failed" : requestLabel(hireRequest)} />
            </div>
          </div>

          {statusError && <div role="alert" className="border-l-2 border-dawg-500 pl-3 text-sm text-dawg-200">{statusError}</div>}
          {queuedWithoutJob && <div role="alert" className="border-l-2 border-blood-500 pl-3 font-mono text-sm text-blood-300">KERNEL_HIRE_JOB_MISSING: JOB_QUEUED has no job ID.</div>}
          {(hireRequest.state === "BLOCKED" || hireRequest.state === "FAILED") && <div role="alert" className="border-l-2 border-blood-500 pl-3"><p className="font-mono text-sm text-blood-300">{hireRequest.errorCode ?? "KERNEL_HIRE_PROCESSING_FAILED"}</p><p className="mt-1 text-xs text-void-500">No job was queued. Replaying the same request remains duplicate-safe.</p></div>}

          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            <CopyableIdentifier label="Hire request ID" value={hireRequest.hireRequestId} />
            {hireRequest.jobId && <CopyableIdentifier label="Job ID" value={hireRequest.jobId} />}
            {idempotencyKey && <CopyableIdentifier label="Request key" value={idempotencyKey} />}
            {hireRequest.contextHash && <CopyableIdentifier label="Context hash" value={hireRequest.contextHash} />}
          </div>

          {hireRequest.jobId ? <div className="grid gap-2 sm:grid-cols-2"><Link href={`/dashboard/compute/${hireRequest.jobId}`} className="cta-primary inline-flex min-h-11 items-center justify-center rounded-[10px] px-4 text-sm font-bold">Open job evidence</Link><Link href={`/verify?jobId=${encodeURIComponent(hireRequest.jobId)}`} className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-void-700 px-4 text-sm font-semibold text-void-200 hover:bg-void-800">Open verifier</Link></div> : <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={submitting} className="min-h-11 rounded-[10px] border border-void-700 px-4 text-sm font-semibold text-void-300">Close</button>{terminal(hireRequest) && <button type="button" onClick={() => void submit()} disabled={submitting} className="cta-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-bold">{submitting && <SpinnerGapIcon size={16} className="animate-spin" aria-hidden />}Replay same request safely</button>}</div>}
        </div>
      )}
    </Dialog>
  );
}
