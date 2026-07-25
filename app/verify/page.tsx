"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { KernelJobDetail } from "@/components/kernel-job-detail";
import { EvidenceStatus } from "@/components/ui/evidence";
import { useUser } from "@/contexts/user-context";
import { getKernelJobs } from "@/lib/api";
import type { EvidenceState, KernelJobListItem } from "@/src/kernel/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function VerifyPage() {
  return <Suspense fallback={<VerifyLoading />}><VerifyContent /></Suspense>;
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const { authState, isOnboarded } = useUser();
  const ready = authState === "ready" && isOnboarded;
  const jobs = useQuery({
    queryKey: ["protected-jobs"],
    queryFn: ({ signal }) => getKernelJobs(signal),
    enabled: ready,
    retry: false,
  });

  if (!ready) {
    return <main className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6"><p className="instrument-label text-dawg-400">Proof</p><h1 className="mt-3 text-3xl font-semibold text-void-100">Connect and complete SIWE</h1><p className="mt-3 text-sm text-void-400">Protected jobs are not requested before onboarding is ready.</p></main>;
  }
  if (jobId && !UUID_PATTERN.test(jobId)) {
    return <main className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6"><p className="instrument-label text-blood-300">Proof refusal</p><h1 className="mt-3 text-3xl font-semibold text-void-100">Invalid protected job ID</h1><p className="mt-3 text-sm text-void-400">The job ID must be a canonical UUID. No alternate evidence was substituted.</p><Link href="/verify" className="instrument-button instrument-button-primary mt-6">Browse protected jobs</Link></main>;
  }
  if (jobId) {
    return <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 lg:py-8"><Link href="/verify" className="inline-flex min-h-11 items-center gap-2 text-sm text-void-300 hover:text-void-100"><ArrowLeftIcon size={17} aria-hidden />Back to protected jobs</Link><div className="mt-3 grid gap-7 lg:grid-cols-[19rem_minmax(0,1fr)]"><aside className="order-2 border-y border-void-800 py-4 lg:order-1 lg:self-start" aria-label="Recent proof index"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-void-100">Recent proof</h2><span className="font-mono text-xs text-void-500">{jobs.data?.length ?? 0}</span></div>{jobs.isLoading && <p role="status" className="py-6 text-sm text-void-500">Loading proof index…</p>}{jobs.error && <p role="alert" className="py-4 text-sm text-blood-300">{jobs.error.message}</p>}{jobs.data && <ul className="mt-3 divide-y divide-void-800">{jobs.data.map((job) => <CompactJobRow key={job.jobId} job={job} selected={job.jobId === jobId} />)}</ul>}</aside><div className="order-1 min-w-0 lg:order-2"><KernelJobDetail jobId={jobId} mode="verify" /></div></div></main>;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <header className="border-b border-void-800 pb-5"><p className="instrument-label text-dawg-400">Proof</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-void-100">Protected job evidence</h1><p className="mt-2 text-sm text-void-400">Choose an authenticated buyer-owned job. Missing evidence remains unavailable.</p></header>
      {jobs.isLoading && <VerifyLoading />}
      {jobs.error && <div role="alert" className="mt-6 flex justify-between gap-3 border-l-2 border-blood-500 pl-3"><p className="text-sm text-blood-300">{jobs.error.message}</p><button type="button" onClick={() => void jobs.refetch()} className="text-sm font-semibold text-void-200">Retry</button></div>}
      {jobs.data && !jobs.data.length && <div className="border-b border-void-800 py-12 text-center"><ShieldCheckIcon size={28} className="mx-auto text-dawg-400" aria-hidden /><h2 className="mt-3 text-xl font-semibold text-void-100">No protected jobs yet</h2><p className="mt-2 text-sm text-void-400">Run an external immutable version from Agents first.</p><Link href="/marketplace" className="instrument-button instrument-button-primary mt-5">Open agents</Link></div>}
      {jobs.data && <ul className="divide-y divide-void-800 border-b border-void-800">{jobs.data.map((job) => <JobRow key={job.jobId} job={job} />)}</ul>}
    </main>
  );
}

function VerifyLoading() { return <div role="status" className="border-b border-void-800 py-12 text-center text-sm text-void-400">Loading protected jobs…</div>; }

function jobState(job: KernelJobListItem): EvidenceState {
  if (job.state === "QUEUED" || job.state === "RUNNING" || job.state === "DELIVERY_READY") return "pending";
  if (job.state === "SUCCEEDED") return job.evidence.receipt === "verified" ? "verified" : "failed";
  if (job.state === "FAILED") return "failed";
  return "unavailable";
}

function JobRow({ job }: { job: KernelJobListItem }) {
  return <li className="grid gap-3 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-void-100">{job.agent.name} <span className="font-mono text-xs text-void-500">v{job.agent.version}</span></h2><EvidenceStatus state={jobState(job)} label={job.state} /></div><p className="mt-2 break-all font-mono text-xs text-void-400">{job.agent.fullSubname ?? "Agent subname unavailable"}</p>{job.lastErrorCode && <p className="mt-2 break-all font-mono text-xs text-blood-300">{job.lastErrorCode}</p>}</div><Link href={`/verify?jobId=${encodeURIComponent(job.jobId)}`} className="instrument-button instrument-button-secondary">Inspect proof</Link></li>;
}

function CompactJobRow({ job, selected }: { job: KernelJobListItem; selected: boolean }) {
  return <li><Link href={`/verify?jobId=${encodeURIComponent(job.jobId)}`} aria-current={selected ? "page" : undefined} className={`block min-h-11 border-l py-3 pl-3 ${selected ? "border-dawg-500" : "border-transparent"}`}><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-void-200">{job.agent.name}</span><EvidenceStatus state={jobState(job)} label={job.state} /></span><span className="mt-2 block truncate font-mono text-xs text-void-500">{job.agent.fullSubname ?? job.jobId}</span>{job.lastErrorCode && <span className="mt-1 block break-all font-mono text-xs text-blood-300">{job.lastErrorCode}</span>}</Link></li>;
}
