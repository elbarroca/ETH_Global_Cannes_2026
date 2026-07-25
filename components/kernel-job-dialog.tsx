"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { CopyableIdentifier, EvidenceStatus } from "@/components/ui/evidence";
import {
  ApiError,
  submitKernelJob,
  type ProtectedPublishedAgent,
  type SubmittedJob,
} from "@/lib/api";
import type { EvidenceState } from "@/src/kernel/types";

interface KernelJobDialogProps {
  agent: ProtectedPublishedAgent;
  onClose: () => void;
  onSubmitted?: (job: SubmittedJob) => void;
}

function submissionError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "The protected job could not be submitted.";
  }
  if (error.status === 401) return "Wallet authorization expired. Authorize the workspace before submitting this job.";
  if (error.code === "AUTH_USER_REQUIRED") return "Complete onboarding before submitting a protected job.";
  if (error.code === "AUTH_ACTION_REQUIRED") return "Fresh authenticate authorization is required before submitting this job.";
  if (error.status === 403) return `Forbidden: ${error.message}`;
  if (error.code === "KERNEL_NOT_FOUND") {
    return "This immutable agent version is no longer available to the protected kernel.";
  }
  if (error.code === "KERNEL_IDEMPOTENCY_MISMATCH") {
    return "This request key was already used with different input. Close this dialog and start a new job.";
  }
  if (error.code === "KERNEL_CONFLICT") {
    return "The kernel could not safely create this job. Retry with the same request key.";
  }
  return error.message;
}

function jobEvidenceState(job: SubmittedJob): EvidenceState {
  if (job.state === "QUEUED" || job.state === "RUNNING" || job.state === "DELIVERY_READY") return "pending";
  if (job.state === "SUCCEEDED") return "unavailable";
  if (job.state === "FAILED") return "failed";
  return "unavailable";
}

export function KernelJobDialog({ agent, onClose, onSubmitted }: KernelJobDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedJob, setSubmittedJob] = useState<SubmittedJob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, []);

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
    try {
      const job = await submitKernelJob(
        { agentVersionId: agent.versionId, prompt: normalizedPrompt },
        idempotencyKey,
      );
      setSubmittedJob(job);
      onSubmitted?.(job);
    } catch (error) {
      setErrorMessage(submissionError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open
      title={submittedJob ? "Protected job submitted" : `Run ${agent.name}`}
      description="Submission creates one idempotent protected-kernel job against this exact immutable agent version."
      onClose={onClose}
      dismissible={!submitting}
      className="max-w-xl"
    >
      {!submittedJob ? (
        <div className="space-y-5">
          <div className="border-y border-void-800 py-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-void-100">{agent.name}</p>
                <p className="mt-1 text-xs text-void-500">Immutable version {agent.version}</p>
              </div>
              <EvidenceStatus state="verified" label="Published" />
            </div>
            <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-void-500">Price</dt>
                <dd className="mt-1 font-mono text-void-200">{agent.priceAtomic} {agent.asset}</dd>
              </div>
              <div>
                <dt className="font-semibold text-void-500">Proof policy</dt>
                <dd className="mt-1 font-mono text-void-200">{agent.proofPolicy}</dd>
              </div>
              <div><dt className="font-semibold text-void-500">Owner</dt><dd className="mt-1 break-all font-mono text-void-200">{agent.ownerWallet}</dd></div>
              <div><dt className="font-semibold text-void-500">Delegate</dt><dd className="mt-1 break-all font-mono text-void-200">{agent.authorityDelegate ?? "Unavailable"}</dd></div>
              <div><dt className="font-semibold text-void-500">Release SHA</dt><dd className="mt-1 break-all font-mono text-void-200">{agent.authorityReleaseSha}</dd></div>
              <div><dt className="font-semibold text-void-500">MCP availability</dt><dd className="mt-1 font-mono text-void-200">{agent.mcpAvailability}</dd></div>
            </dl>
            <p className="mt-3 break-words text-xs text-void-400">{agent.mcpSummary?.map((binding) => `${binding.provider}: ${binding.capability}`).join(", ") || "No MCP binding is available for this immutable version."}</p>
          </div>

          <div className="border-l-2 border-dawg-700 pl-3 text-xs leading-relaxed text-void-400">
            Published does not mean the execution runtime is available. The job can report unavailable or failed, and compute, storage, ENS, receipt, and financial evidence will be evaluated per job.
          </div>

          <div className="space-y-1.5">
            <label htmlFor="kernel-job-prompt" className="text-xs font-semibold text-void-300">
              Task prompt
            </label>
            <textarea
              id="kernel-job-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={2_000}
              rows={7}
              disabled={submitting}
              placeholder="Describe the analysis you need and the evidence the agent should consider."
              className="w-full resize-y rounded-[10px] border border-void-700 bg-void-950 px-3 py-2.5 text-sm leading-relaxed text-void-100 placeholder:text-void-500 focus:border-dawg-500 focus:outline-none"
            />
            <p className="text-right font-mono text-xs text-void-500">{prompt.length} / 2,000</p>
          </div>

          {errorMessage && (
            <div role="alert" className="border-l-2 border-blood-500 pl-3">
              <p className="text-sm text-blood-300">{errorMessage}</p>
              <p className="mt-1 text-xs text-void-500">A retry from this dialog reuses the same request key.</p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={submitting} className="min-h-11 rounded-[10px] border border-void-700 px-4 text-sm font-semibold text-void-300 hover:bg-void-800 disabled:opacity-50">
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !idempotencyKey || prompt.trim().length < 1 || agent.ownedByViewer || !agent.hireable || agent.canonicalState !== "CANONICAL"}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-dawg-500 px-5 text-sm font-bold text-black hover:bg-dawg-400 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {submitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" aria-hidden="true" />}
              {agent.ownedByViewer ? "Self-hire refused" : submitting ? "Submitting safely…" : errorMessage ? "Retry same request" : "Submit protected job"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="border-y border-emerald-500/30 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-base font-bold text-void-100">
                  {submittedJob.replayed ? "Existing job returned safely" : "Job accepted"}
                </p>
                <p className="mt-1 text-sm text-void-400">
                  {submittedJob.replayed
                    ? "The kernel matched this request key to the original job; no duplicate effect was created."
                    : "Evidence will update as the protected worker processes this job."}
                </p>
              </div>
              <EvidenceStatus
                state={jobEvidenceState(submittedJob)}
                label={submittedJob.replayed ? "Replayed safely" : submittedJob.state}
              />
            </div>
          </div>

          <dl className="grid gap-3 border-y border-void-800 py-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-void-500">Quoted amount</dt>
              <dd className="mt-1 font-mono text-void-200">{submittedJob.amountAtomic} {submittedJob.asset}</dd>
            </div>
            <div>
              <dt className="font-semibold text-void-500">State</dt>
              <dd className="mt-1 font-mono text-void-200">{submittedJob.state}</dd>
            </div>
          </dl>

          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            <CopyableIdentifier label="Job ID" value={submittedJob.jobId} />
            <CopyableIdentifier label="Effect ID" value={submittedJob.effectId} />
            <CopyableIdentifier label="Order ID" value={submittedJob.orderId} />
            {idempotencyKey && <CopyableIdentifier label="Request key" value={idempotencyKey} />}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Link href={`/dashboard/compute/${submittedJob.jobId}`} className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-dawg-500 px-4 text-sm font-bold text-black hover:bg-dawg-400">
              Open job evidence
            </Link>
            <Link href={`/verify?jobId=${encodeURIComponent(submittedJob.jobId)}`} className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-void-700 px-4 text-sm font-semibold text-void-200 hover:bg-void-800">
              Open verifier
            </Link>
          </div>
        </div>
      )}
    </Dialog>
  );
}
