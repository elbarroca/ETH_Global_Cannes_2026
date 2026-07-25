"use client";

import { useCallback, useEffect, useState } from "react";
import { ProofRail } from "@/components/proof-rail";
import { EvidenceStatus } from "@/components/ui/evidence";
import { ApiError, cancelKernelJob, getKernelJobDetail } from "@/lib/api";
import type { EvidenceState, KernelJobDetail as KernelJobDetailRecord } from "@/src/kernel/types";

const POLL_MS = 2_000;

export type KernelUiErrorKind = "auth" | "authorization" | "not-found" | "conflict" | "not-configured" | "error";

export function classifyKernelError(error: unknown): { kind: KernelUiErrorKind; message: string } {
  if (!(error instanceof ApiError)) return { kind: "error", message: error instanceof Error ? error.message : "The protected kernel request failed." };
  if (error.status === 401) return { kind: "auth", message: "Reconnect your wallet to read protected jobs." };
  if (error.status === 403) return { kind: "authorization", message: error.code === "AUTH_USER_REQUIRED" ? "Complete onboarding before reading protected jobs." : "Fresh wallet authorization is required." };
  if (error.status === 404) return { kind: "not-found", message: "This job was not found for the authenticated buyer." };
  if (error.status === 409) return { kind: "conflict", message: "The kernel reported a conflict. Refresh before another action." };
  if (error.status === 503 || error.code === "A3_NOT_CONFIGURED") return { kind: "not-configured", message: "Protected execution is not configured. Runtime evidence is unavailable." };
  return { kind: "error", message: error.message };
}

export function isTerminalKernelJob(job: Pick<KernelJobDetailRecord, "state">): boolean {
  return job.state === "SUCCEEDED" || job.state === "FAILED" || job.state === "CANCELED" || job.state === "A3_NOT_CONFIGURED";
}

function stateEvidence(job: Pick<KernelJobDetailRecord, "state" | "evidence">): EvidenceState {
  if (job.state === "QUEUED" || job.state === "RUNNING" || job.state === "DELIVERY_READY") return "pending";
  if (job.state === "SUCCEEDED") return job.evidence.receipt === "verified" ? "verified" : "failed";
  if (job.state === "FAILED") return "failed";
  return "unavailable";
}

export function KernelErrorNotice({ error, onRetry }: { error: { kind: KernelUiErrorKind; message: string }; onRetry?: () => void }) {
  const title: Record<KernelUiErrorKind, string> = { auth: "Wallet required", authorization: "Authorization required", "not-found": "Job not found", conflict: "Kernel conflict", "not-configured": "Runtime unavailable", error: "Job request failed" };
  return <div role="alert" className="border-l-2 border-blood-500 py-1 pl-3"><p className="font-semibold text-blood-200">{title[error.kind]}</p><p className="mt-1 break-words text-sm text-void-400">{error.message}</p>{onRetry && error.kind !== "not-found" && <button type="button" onClick={onRetry} className="instrument-button instrument-button-secondary mt-4">Retry</button>}</div>;
}

export function KernelJobDetailView({ job, mode = "detail", canceling = false, onCancel }: { job: KernelJobDetailRecord; mode?: "detail" | "verify" | "embedded"; canceling?: boolean; onCancel?: () => void }) {
  const delivery = job.evidenceDetail.delivery;
  const refusal = job.agent.refusalReason ?? job.evidenceDetail.errorCode ?? job.lastErrorCode;
  const cancelable = (job.state === "QUEUED" || job.state === "RUNNING") && !job.cancelRequestedAt;
  return (
    <article className="min-w-0 space-y-5" data-proof-workbench={mode === "verify" ? "true" : undefined}>
      <header className="flex flex-col gap-4 border-b border-void-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0"><p className="instrument-label">{mode === "verify" ? "Proof workbench" : "Protected job"}</p><h1 className="mt-2 break-words text-2xl font-semibold text-void-100">{job.agent.name} <span className="font-mono text-sm text-void-500">v{job.agent.version}</span></h1><p className="mt-2 break-all font-mono text-xs text-dawg-300">{job.agent.fullSubname ?? "Agent subname unavailable"}</p></div>
        <EvidenceStatus state={stateEvidence(job)} label={job.state} />
      </header>

      {job.state === "DELIVERY_READY" && <p className="border-l-2 border-dawg-500 pl-3 text-sm text-dawg-200">Delivery evidence is ready. Settlement and terminal success remain pending.</p>}
      {job.cancelRequestedAt && !isTerminalKernelJob(job) && <p className="border-l-2 border-dawg-500 pl-3 text-sm text-dawg-200">Cancellation requested at {job.cancelRequestedAt}.</p>}

      <section className="border-y border-void-800 py-4"><p className="instrument-label">Exact refusal</p><p className={`mt-3 break-words font-mono text-sm ${refusal ? "text-blood-300" : "text-void-400"}`}>{refusal ?? "No refusal recorded for this job."}</p></section>

      <ProofRail job={job} />

      <section aria-label="Canonical delivery" className="border-y border-void-800 py-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-void-100">Canonical delivery</h2><EvidenceStatus state={job.evidence.receipt} /></div><p className="mt-3 text-sm text-void-400">{delivery ? `Delivery recorded at ${delivery.terminalAt}.` : "No canonical delivery output is available."}</p>{delivery && <details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm text-void-300">Inspect delivery result</summary><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words border-t border-void-800 py-4 font-mono text-xs text-void-400">{JSON.stringify(delivery.result, null, 2)}</pre></details>}</section>

      <details className="border-y border-void-800 py-1"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-void-300">Job identity and timeline</summary><div className="grid gap-5 border-t border-void-800 py-4 lg:grid-cols-2"><dl className="space-y-3 text-xs"><Meta label="Job ID" value={job.jobId} /><Meta label="Effect ID" value={job.effectId} /><Meta label="Version ID" value={job.agentVersionId} /><Meta label="Creator parent" value={job.agent.creatorParent ?? "Unavailable"} /><Meta label="Owner" value={job.agent.ownerWallet} /><Meta label="Delegate" value={job.agent.authorityDelegate ?? "Unavailable"} /><Meta label="Release SHA" value={job.agent.authorityReleaseSha ?? "Unavailable"} /></dl><ol className="divide-y divide-void-800">{job.evidenceDetail.timeline.map((item) => <li key={item.version} className="py-2 text-xs text-void-400"><span className="font-mono text-void-500">{item.createdAt}</span><span className="ml-3">{item.eventType}: {item.fromState ?? "START"} to {item.toState}</span></li>)}</ol></div></details>

      {onCancel && (job.state === "QUEUED" || job.state === "RUNNING") && <button type="button" onClick={onCancel} disabled={canceling || !cancelable} className="instrument-button instrument-button-secondary">{job.cancelRequestedAt ? "Cancellation requested" : canceling ? "Requesting cancellation" : "Cancel job"}</button>}
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) { return <div><dt className="font-semibold uppercase tracking-wide text-void-500">{label}</dt><dd className="mt-1 break-all font-mono text-void-300">{value}</dd></div>; }

export function KernelJobDetail({ jobId, mode = "detail" }: { jobId: string; mode?: "detail" | "verify" | "embedded" }) {
  const [job, setJob] = useState<KernelJobDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<ReturnType<typeof classifyKernelError> | null>(null);
  const load = useCallback(async (silent = false): Promise<void> => { if (!silent) setLoading(true); try { setJob(await getKernelJobDetail(jobId)); setError(null); } catch (loadError) { setError(classifyKernelError(loadError)); } finally { if (!silent) setLoading(false); } }, [jobId]);
  useEffect(() => { void load(); }, [load]);
  const shouldPoll = job !== null && !isTerminalKernelJob(job);
  useEffect(() => { if (!shouldPoll) return; let canceled = false; let timer: number | null = null; const schedule = (): void => { if (canceled || document.visibilityState !== "visible") return; timer = window.setTimeout(() => { void load(true).finally(schedule); }, POLL_MS); }; const visibility = (): void => { if (timer !== null) window.clearTimeout(timer); timer = null; if (document.visibilityState === "visible") void load(true).finally(schedule); }; document.addEventListener("visibilitychange", visibility); schedule(); return () => { canceled = true; if (timer !== null) window.clearTimeout(timer); document.removeEventListener("visibilitychange", visibility); }; }, [load, shouldPoll]);
  async function cancel(): Promise<void> { if (!job || !cancelableJob(job)) return; setCanceling(true); try { await cancelKernelJob(job.jobId); await load(true); } catch (cancelError) { setError(classifyKernelError(cancelError)); } finally { setCanceling(false); } }
  if (loading && !job) return <p role="status" className="border-y border-void-800 py-10 text-center text-sm text-void-400">Loading protected job…</p>;
  if (error && !job) return <KernelErrorNotice error={error} onRetry={() => void load()} />;
  if (!job) return <KernelErrorNotice error={{ kind: "not-found", message: "This job is unavailable." }} />;
  return <div className="space-y-4">{error && <KernelErrorNotice error={error} onRetry={() => void load()} />}<KernelJobDetailView job={job} mode={mode} canceling={canceling} onCancel={() => void cancel()} /></div>;
}

function cancelableJob(job: KernelJobDetailRecord): boolean { return (job.state === "QUEUED" || job.state === "RUNNING") && !job.cancelRequestedAt; }
