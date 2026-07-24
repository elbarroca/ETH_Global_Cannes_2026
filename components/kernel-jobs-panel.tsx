"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KernelErrorNotice,
  KernelJobDetail,
  classifyKernelError,
} from "@/components/kernel-job-detail";
import { Card, CardBody } from "@/components/ui/card";
import { EvidenceStatus } from "@/components/ui/evidence";
import { cancelKernelJob, getKernelJobs } from "@/lib/api";
import {
  JOB_STATES,
  type EvidenceState,
  type JobState,
  type KernelJobListItem,
} from "@/src/kernel/types";

const POLL_MS = 2_000;

const STATE_LABEL: Record<JobState, string> = {
  QUEUED: "Queued",
  RUNNING: "Running",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
  CANCELED: "Canceled",
  A3_NOT_CONFIGURED: "A3 unavailable",
};

function jobStateEvidence(job: Pick<KernelJobListItem, "state" | "evidence">): EvidenceState {
  if (job.state === "QUEUED" || job.state === "RUNNING") return "pending";
  if (job.state === "SUCCEEDED") {
    return job.evidence.receipt === "verified" ? "verified" : "failed";
  }
  if (job.state === "FAILED") return "failed";
  return "unavailable";
}

export function KernelJobsPanel() {
  const [jobs, setJobs] = useState<KernelJobListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReturnType<typeof classifyKernelError> | null>(null);
  const [actionError, setActionError] = useState<ReturnType<typeof classifyKernelError> | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [cancelingJobId, setCancelingJobId] = useState<string | null>(null);

  const load = useCallback(async (silent = false): Promise<void> => {
    if (!silent) setLoading(true);
    try {
      setJobs(await getKernelJobs());
      setError(null);
    } catch (loadError) {
      setError(classifyKernelError(loadError));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasActiveJob = jobs?.some((job) => job.state === "QUEUED" || job.state === "RUNNING") ?? false;
  useEffect(() => {
    if (!hasActiveJob) return;
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
  }, [hasActiveJob, load]);

  const totals = useMemo<Record<JobState, number> | null>(() => {
    if (!jobs) return null;
    const next: Record<JobState, number> = {
      QUEUED: 0,
      RUNNING: 0,
      SUCCEEDED: 0,
      FAILED: 0,
      CANCELED: 0,
      A3_NOT_CONFIGURED: 0,
    };
    for (const job of jobs) next[job.state] += 1;
    return next;
  }, [jobs]);

  const latestJobs = useMemo(
    () => [...(jobs ?? [])]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 5),
    [jobs],
  );

  async function cancel(job: KernelJobListItem): Promise<void> {
    if (job.state !== "QUEUED" && job.state !== "RUNNING") return;
    if (job.cancelRequestedAt) return;
    setCancelingJobId(job.jobId);
    setActionError(null);
    try {
      await cancelKernelJob(job.jobId);
      await load(true);
    } catch (cancelError) {
      setActionError(classifyKernelError(cancelError));
    } finally {
      setCancelingJobId(null);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="protected-jobs-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="protected-jobs-title" className="text-lg font-bold text-void-100">
            Protected jobs
          </h2>
          <p className="mt-1 text-sm text-void-500">
            Authenticated jobs and per-job proof state. Active jobs refresh every two seconds only while this page is visible.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="min-h-11 shrink-0 rounded-xl border border-void-700 px-4 text-sm font-semibold text-void-200 hover:bg-void-800 disabled:opacity-45"
        >
          {loading ? "Refreshing…" : "Refresh jobs"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Exact protected job totals">
        {JOB_STATES.map((state) => (
          <div key={state} className="rounded-xl border border-void-800 bg-void-950/55 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-void-600">{STATE_LABEL[state]}</p>
            <p className="mt-2 font-pixel text-3xl leading-none text-void-100">
              {totals ? totals[state] : "—"}
            </p>
          </div>
        ))}
      </div>

      {error && !jobs && <KernelErrorNotice error={error} onRetry={() => void load()} />}
      {loading && !jobs && !error && (
        <div role="status" className="rounded-xl border border-void-800 bg-void-950/45 px-4 py-8 text-center text-sm text-void-500">
          Loading protected jobs…
        </div>
      )}
      {error && jobs && <KernelErrorNotice error={error} onRetry={() => void load()} />}
      {actionError && (
        <KernelErrorNotice
          error={actionError}
          onRetry={() => {
            setActionError(null);
            void load();
          }}
        />
      )}

      {jobs && (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-void-100">Recent jobs</h3>
              <span className="font-mono text-[10px] uppercase tracking-wider text-void-600">Latest 5</span>
            </div>

            {latestJobs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-void-800 px-4 py-10 text-center text-sm text-void-500">
                No protected jobs have been submitted by this buyer.
              </div>
            ) : (
              <div className="space-y-3">
                {latestJobs.map((job) => {
                  const expanded = expandedJobId === job.jobId;
                  const cancelable = (job.state === "QUEUED" || job.state === "RUNNING") && !job.cancelRequestedAt;
                  return (
                    <article key={job.jobId} className="min-w-0 rounded-xl border border-void-800 bg-void-950/45">
                      <div className="space-y-3 p-3 sm:p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-semibold text-void-100">{job.agent.name}</h4>
                              <span className="font-mono text-xs text-void-500">v{job.agent.version}</span>
                              <EvidenceStatus state={jobStateEvidence(job)} label={job.state} />
                            </div>
                            <p className="mt-1 text-xs text-void-500">
                              Created {job.createdAt} · {job.agent.priceAtomic} {job.agent.asset}
                            </p>
                            {job.cancelRequestedAt && !cancelable && (job.state === "QUEUED" || job.state === "RUNNING") && (
                              <p className="mt-1 text-xs text-dawg-300">Cancellation requested {job.cancelRequestedAt}</p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setExpandedJobId(expanded ? null : job.jobId)}
                              aria-expanded={expanded}
                              className="min-h-11 rounded-xl border border-void-700 px-3 text-xs font-semibold text-void-200 hover:bg-void-800"
                            >
                              {expanded ? "Collapse evidence" : "Expand evidence"}
                            </button>
                            {(job.state === "QUEUED" || job.state === "RUNNING") && (
                              <button
                                type="button"
                                onClick={() => void cancel(job)}
                                disabled={!cancelable || cancelingJobId === job.jobId}
                                className="min-h-11 rounded-xl border border-blood-500/35 px-3 text-xs font-semibold text-blood-300 hover:bg-blood-900/20 disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                {job.cancelRequestedAt
                                  ? "Cancellation requested"
                                  : cancelingJobId === job.jobId
                                    ? "Canceling…"
                                    : "Cancel job"}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          <Link href={`/dashboard/compute/${job.jobId}`} className="inline-flex min-h-11 items-center rounded-lg px-2 text-dawg-300 hover:bg-dawg-500/10">
                            Compute view
                          </Link>
                          <Link href={`/verify?jobId=${encodeURIComponent(job.jobId)}`} className="inline-flex min-h-11 items-center rounded-lg px-2 text-dawg-300 hover:bg-dawg-500/10">
                            Verify view
                          </Link>
                        </div>
                      </div>

                      {expanded && (
                        <div className="border-t border-void-800 p-3 sm:p-4">
                          <KernelJobDetail jobId={job.jobId} mode="embedded" />
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </section>
  );
}
