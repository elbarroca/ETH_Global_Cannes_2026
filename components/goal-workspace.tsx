"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import {
  CheckIcon,
  PauseIcon,
  PlayIcon,
  ShieldWarningIcon,
} from "@phosphor-icons/react";
import { EvidenceStatus } from "@/components/ui/evidence";
import { useUser } from "@/contexts/user-context";
import { useProtectedGoals } from "@/hooks/use-protected-goals";
import { formatUsdc } from "@/lib/format-usdc";
import type { EvidenceState, GoalPolicy, GoalRunSnapshot, GoalSnapshot, SwapProposalV1 } from "@/src/kernel/types";

const CAPABILITIES = [
  { id: "research", label: "Research" },
  { id: "market-analysis", label: "Market analysis" },
  { id: "risk-analysis", label: "Risk analysis" },
  { id: "uniswap-swap", label: "Uniswap proposal" },
] as const;
const CAPABILITY_LABELS = new Map<string, string>(CAPABILITIES.map((capability) => [capability.id, capability.label]));
const EXECUTION_LABELS: Record<GoalPolicy["executionMode"], string> = {
  RESEARCH_ONLY: "Research only",
  PROPOSE_SWAP: "Research, propose swap",
};
const ACTIVE_RUN_STATES = ["SCHEDULED", "SELECTING", "RUNNING", "SYNTHESIZING"] as const;
const TERMINAL_STATES = new Set(["READY", "PARTIAL", "BLOCKED", "FAILED", "CANCELED"]);

interface GoalDraft {
  objective: string;
  requiredCapabilities: string[];
  policy: GoalPolicy;
}

const EMPTY_DRAFT: GoalDraft = {
  objective: "",
  requiredCapabilities: ["research", "market-analysis", "uniswap-swap"],
  policy: {
    cadenceMinutes: 5,
    runMode: "CONTINUOUS",
    executionMode: "PROPOSE_SWAP",
    runLimit: null,
    maxAgents: 2,
    perRunCapAtomic: "3000",
    dailyCapAtomic: "10000",
  },
};

function draftFromGoal(goal: GoalSnapshot | null): GoalDraft {
  if (!goal) return EMPTY_DRAFT;
  return {
    objective: goal.objective,
    requiredCapabilities: [...goal.requiredCapabilities],
    policy: { ...goal.policy },
  };
}

function validAtomic(value: string | null): boolean {
  return typeof value === "string" && /^[1-9][0-9]{0,18}$/.test(value);
}

function validDraft(draft: GoalDraft): boolean {
  const bounded = draft.policy.runMode === "BOUNDED";
  return draft.objective.trim().length >= 10 && draft.objective.trim().length <= 2_000
    && draft.requiredCapabilities.length >= 1 && draft.requiredCapabilities.length <= 4
    && draft.policy.maxAgents >= 1 && draft.policy.maxAgents <= 4
    && validAtomic(draft.policy.perRunCapAtomic)
    && (bounded
      ? draft.policy.runLimit !== null && draft.policy.runLimit >= 1 && draft.policy.runLimit <= 100
      : validAtomic(draft.policy.dailyCapAtomic));
}

function runEvidenceState(run: GoalRunSnapshot): EvidenceState {
  if (ACTIVE_RUN_STATES.includes(run.state as (typeof ACTIVE_RUN_STATES)[number])) return "pending";
  if (run.state === "READY") return run.report?.evidence.length ? "verified" : "failed";
  if (run.state === "PARTIAL") return "pending";
  if (run.state === "FAILED" || run.state === "BLOCKED") return "failed";
  return "unavailable";
}

function isValidSwapProposal(value: SwapProposalV1 | null): value is SwapProposalV1 {
  return Boolean(value
    && value.schemaVersion === 1
    && value.chainId === 1301
    && value.tokenIn.length > 0
    && value.tokenOut.length > 0
    && /^[1-9][0-9]*$/.test(value.amountInAtomic)
    && Number.isInteger(value.slippageBps)
    && value.slippageBps >= 0
    && value.slippageBps <= 10_000
    && value.rationale.length > 0
    && value.requiresWalletApproval === true);
}

function formatTime(value: string | null): string {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function GoalWorkspace() {
  const { authState, isOnboarded } = useUser();
  const data = useProtectedGoals(authState === "ready" && isOnboarded);

  return <GoalWorkspaceContent key={data.goal?.goalId ?? "new-goal"} authState={authState} data={data} />;
}

function GoalWorkspaceContent({
  authState,
  data,
}: {
  authState: ReturnType<typeof useUser>["authState"];
  data: ReturnType<typeof useProtectedGoals>;
}) {
  const [draft, setDraft] = useState<GoalDraft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState(data.goal?.state === "DRAFT");
  const intentKeys = useRef(new Map<string, string>());

  const currentDraft = editing && draft === EMPTY_DRAFT ? draftFromGoal(data.goal) : draft;

  const sortedRuns = useMemo(
    () => [...data.runs].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
    [data.runs],
  );
  const activeRun = sortedRuns.find((run) => ACTIVE_RUN_STATES.includes(run.state as (typeof ACTIVE_RUN_STATES)[number])) ?? null;
  const latestTerminal = sortedRuns.find((run) => TERMINAL_STATES.has(run.state)) ?? null;
  const latestReportRun = sortedRuns.find((run) => run.report !== null) ?? null;
  const selectedRun = activeRun ?? latestReportRun ?? latestTerminal;
  const busy = data.createGoal.isPending || data.updateGoal.isPending || data.runGoal.isPending;
  const actionError = data.createGoal.error ?? data.updateGoal.error ?? data.runGoal.error ?? data.error;
  const isValid = validDraft(currentDraft);

  function keyFor(intent: string): string {
    const current = intentKeys.current.get(intent);
    if (current) return current;
    const next = crypto.randomUUID();
    intentKeys.current.set(intent, next);
    return next;
  }

  function clearIntent(intent: string): void {
    intentKeys.current.delete(intent);
  }

  function changeDraft(next: GoalDraft): void {
    setDraft(next);
    clearIntent("create");
    clearIntent("update");
  }

  async function create(state: "DRAFT" | "ACTIVE"): Promise<void> {
    if (!isValid) return;
    try {
      await data.createGoal.mutateAsync({
        goal: { ...currentDraft, state, objective: currentDraft.objective.trim() },
        idempotencyKey: keyFor("create"),
      });
      clearIntent("create");
    } catch {
      clearIntent("create");
    }
  }

  async function update(): Promise<void> {
    if (!data.goal || !isValid) return;
    try {
      await data.updateGoal.mutateAsync({
        goalId: data.goal.goalId,
        mutation: { action: "UPDATE", ...currentDraft, objective: currentDraft.objective.trim() },
        idempotencyKey: keyFor("update"),
      });
      clearIntent("update");
      setEditing(false);
    } catch {
      clearIntent("update");
    }
  }

  async function transition(action: "ACTIVATE" | "PAUSE" | "RESUME"): Promise<void> {
    if (!data.goal) return;
    const intent = action.toLowerCase();
    try {
      await data.updateGoal.mutateAsync({ goalId: data.goal.goalId, mutation: { action }, idempotencyKey: keyFor(intent) });
      clearIntent(intent);
    } catch {
      clearIntent(intent);
    }
  }

  async function runNow(): Promise<void> {
    if (!data.goal) return;
    try {
      await data.runGoal.mutateAsync({ goalId: data.goal.goalId, idempotencyKey: keyFor("run") });
      clearIntent("run");
    } catch {
      clearIntent("run");
    }
  }

  if (authState !== "ready") return <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6"><p className="instrument-panel p-6 text-center text-sm text-void-400">Connect and authorize the workspace to load protected goals.</p></main>;
  if (data.isLoading) {
    return <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-busy="true"><div role="status" aria-label="Loading protected workspace" className="space-y-4 border-y border-void-800 py-8"><div className="h-3 w-32 animate-pulse rounded-[10px] bg-void-800" /><div className="h-9 w-3/4 animate-pulse rounded-[10px] bg-void-800" /><div className="h-24 animate-pulse rounded-[10px] bg-void-800" /></div></main>;
  }

  if (data.error && !data.goal) return <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6"><section role="alert" className="instrument-panel p-6"><h1 className="text-xl font-semibold text-void-100">Workspace unavailable</h1><p className="mt-2 break-words text-sm text-blood-300">{data.error.message}</p><button type="button" onClick={() => void data.refresh()} className="instrument-button instrument-button-secondary mt-5">Retry protected workspace</button></section></main>;

  if (!data.goal || editing) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="border-b border-void-800 pb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-void-100">{data.goal ? "Edit goal" : "Define your first goal"}</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-void-400">Set explicit limits before the runtime can select agents or reserve cost.</p>
        </header>
        <GoalForm draft={currentDraft} onChange={changeDraft} />
        {actionError && <p role="alert" className="mt-4 break-words border-l-2 border-blood-500 pl-3 text-sm text-blood-300">{actionError.message}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-void-800 pt-5">
          <p className="max-w-sm text-xs leading-relaxed text-void-500">A goal may propose a transaction. It never signs or broadcasts one.</p>
          <div className="flex flex-wrap gap-3">
            {data.goal && <button type="button" onClick={() => { setDraft(draftFromGoal(data.goal)); setEditing(false); }} className="instrument-button instrument-button-secondary">Cancel</button>}
            <button type="button" disabled={!isValid || busy} onClick={() => void (data.goal ? update() : create("DRAFT"))} className="instrument-button instrument-button-secondary">{data.goal ? "Save changes" : "Save draft"}</button>
            {!data.goal && <button type="button" disabled={!isValid || busy} onClick={() => void create("ACTIVE")} className="instrument-button instrument-button-primary">Activate goal</button>}
          </div>
        </div>
      </main>
    );
  }

  const goal = data.goal;
  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:py-8">
      <section className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b border-void-800 pb-5">
        <div className="min-w-0">
          <EvidenceStatus state={goal.state === "ACTIVE" ? "verified" : goal.state === "PAUSED" ? "pending" : "unavailable"} label={goal.state} />
          <h1 className="mt-2.5 break-words text-2xl font-semibold tracking-tight text-void-100 sm:text-3xl">{goal.objective}</h1>
          <p className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-void-500">
            <span>{goal.nextRunAt ? `Next run ${formatTime(goal.nextRunAt)}` : "Not scheduled"}</span>
            <span aria-hidden className="text-void-700">/</span>
            <span className="font-mono">{formatUsdc(goal.policy.perRunCapAtomic)} per run</span>
            <span aria-hidden className="text-void-700">/</span>
            <span className="font-mono">{goal.policy.dailyCapAtomic ? `${formatUsdc(goal.policy.dailyCapAtomic)} per day` : "No daily cap"}</span>
            <span aria-hidden className="text-void-700">/</span>
            <span>Every {goal.policy.cadenceMinutes} min</span>
          </p>
        </div>
        <GoalActions goal={goal} busy={busy} onEdit={() => setEditing(true)} onRun={runNow} onTransition={transition} />
      </section>

      <RunTimeline run={activeRun ?? latestTerminal} reportRun={latestReportRun ?? latestTerminal} goalObjective={goal.objective} />

      {latestTerminal?.errorCode && (
        <p className="flex flex-wrap items-baseline gap-x-2 border-l-2 border-blood-600 py-1 pl-3 text-sm">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-blood-400">Refusal</span>
          <span className="break-all font-mono text-blood-300">{latestTerminal.errorCode}</span>
        </p>
      )}

      <SwapProposal run={latestReportRun} />

      <div className="grid gap-6 border-t border-void-800 pt-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.6fr)]">
        <SelectedAgents run={selectedRun} />
        <GoalRail goal={goal} run={selectedRun} />
      </div>

      <details className="border-t border-void-800">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between py-3 text-sm font-semibold text-void-200">
          Recent loops <span className="font-mono text-xs text-void-500">{Math.min(sortedRuns.length, 5)}</span>
        </summary>
        <RecentRuns runs={sortedRuns.slice(0, 5)} />
      </details>

      {actionError && <div role="alert" className="flex items-start justify-between gap-3 border-l-2 border-blood-500 py-1 pl-3"><p className="break-words text-sm text-blood-300">{actionError.message}</p><button type="button" onClick={() => void data.refresh()} className="text-sm font-semibold text-void-200">Retry</button></div>}
    </main>
  );
}

function GoalForm({ draft, onChange }: { draft: GoalDraft; onChange: (draft: GoalDraft) => void }) {
  const policy = draft.policy;
  function setPolicy(next: GoalPolicy): void {
    onChange({ ...draft, policy: next });
  }
  return (
    <div className="grid gap-8 pt-6 lg:grid-cols-[minmax(0,7fr)_minmax(16rem,4fr)]">
      <div className="space-y-6">
        <section className="space-y-5">
          <Field label="Goal statement"><textarea value={draft.objective} onChange={(event) => onChange({ ...draft, objective: event.target.value })} maxLength={2_000} rows={3} placeholder="Monitor liquidity evidence and report bounded risks" className="goal-control min-h-24 resize-y leading-relaxed" /><span className="mt-1.5 block text-right font-mono text-[11px] text-void-600 tnums">{draft.objective.length} / 2,000</span></Field>
          <fieldset><legend className="text-sm text-void-300">Capabilities, 1 to 4</legend><div className="mt-2.5 grid gap-2 sm:grid-cols-2">{CAPABILITIES.map((capability) => { const checked = draft.requiredCapabilities.includes(capability.id); return <label key={capability.id} className={`group flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px] border px-3 text-sm transition-colors duration-150 focus-within:border-dawg-500 focus-within:ring-2 focus-within:ring-dawg-500/30 ${checked ? "border-dawg-600/70 bg-dawg-500/[0.06] text-void-100" : "border-void-800 text-void-400 hover:border-void-700"}`}><input type="checkbox" className="sr-only" checked={checked} onChange={() => { const next = checked ? draft.requiredCapabilities.filter((item) => item !== capability.id) : [...draft.requiredCapabilities, capability.id]; if (next.length >= 1 && next.length <= 4) onChange({ ...draft, requiredCapabilities: next }); }} /><span className={`grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border transition-colors ${checked ? "border-dawg-500 bg-dawg-500 text-void-950" : "border-void-700 text-transparent group-hover:border-void-600"}`}><CheckIcon size={11} weight="bold" aria-hidden /></span>{capability.label}</label>; })}</div></fieldset>
          <Field label="Execution mode"><select value={policy.executionMode} onChange={(event) => setPolicy({ ...policy, executionMode: event.target.value as GoalPolicy["executionMode"] })} className="goal-control"><option value="RESEARCH_ONLY">Autonomous research only</option><option value="PROPOSE_SWAP">Research and propose swap</option></select></Field>
        </section>

        <section className="border-t border-void-800 pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cadence"><select value={policy.cadenceMinutes} onChange={(event) => setPolicy({ ...policy, cadenceMinutes: Number(event.target.value) as GoalPolicy["cadenceMinutes"] })} className="goal-control"><option value={5}>Every 5 minutes</option><option value={15}>Every 15 minutes</option><option value={30}>Every 30 minutes</option><option value={60}>Every 60 minutes</option></select></Field>
            <Field label="Run mode"><select value={policy.runMode} onChange={(event) => setPolicy({ ...policy, runMode: event.target.value as GoalPolicy["runMode"], runLimit: event.target.value === "BOUNDED" ? 3 : null, dailyCapAtomic: event.target.value === "CONTINUOUS" ? "10000" : null })} className="goal-control"><option value="BOUNDED">Bounded run count</option><option value="CONTINUOUS">Continuous schedule</option></select></Field>
            <Field label="Maximum agents"><input type="number" min={1} max={4} value={policy.maxAgents} onChange={(event) => setPolicy({ ...policy, maxAgents: Number(event.target.value) })} className="goal-control" /></Field>
            <Field label="Per-run cap" hint="atomic units"><input inputMode="numeric" value={policy.perRunCapAtomic} onChange={(event) => setPolicy({ ...policy, perRunCapAtomic: event.target.value })} className="goal-control font-mono" /></Field>
            {policy.runMode === "BOUNDED" ? <Field label="Run limit"><input type="number" min={1} max={100} value={policy.runLimit ?? 1} onChange={(event) => setPolicy({ ...policy, runLimit: Number(event.target.value) })} className="goal-control" /></Field> : <Field label="Daily cap" hint="atomic units"><input inputMode="numeric" value={policy.dailyCapAtomic ?? ""} onChange={(event) => setPolicy({ ...policy, dailyCapAtomic: event.target.value })} className="goal-control font-mono" /></Field>}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-void-500">Caps are enforced by goal policy before any agent is selected.</p>
        </section>
      </div>

      <aside className="self-start lg:sticky lg:top-24" aria-label="Live goal summary">
        <div className="rounded-xl border border-void-800 p-4">
          <p className="instrument-label">Summary</p>
          <p className="mt-2.5 break-words text-sm font-semibold leading-snug text-void-100">{draft.objective.trim() || "Add a goal statement"}</p>
          <dl className="mt-3 divide-y divide-void-800/80 border-t border-void-800 text-sm">
            <SummaryRow label="Schedule" value={`Every ${policy.cadenceMinutes} min`} sub={policy.runMode === "BOUNDED" ? `${policy.runLimit ?? 1} runs` : "Continuous"} />
            <SummaryRow label="Agents" value={`${policy.maxAgents} max`} />
            <SummaryRow label="Per run" value={policy.perRunCapAtomic ? formatUsdc(policy.perRunCapAtomic) : "Unset"} sub={policy.perRunCapAtomic ? `${policy.perRunCapAtomic} atomic` : undefined} />
            <SummaryRow label="Daily" value={policy.dailyCapAtomic ? formatUsdc(policy.dailyCapAtomic) : "Not applicable"} sub={policy.dailyCapAtomic ? `${policy.dailyCapAtomic} atomic` : undefined} />
            <SummaryRow label="Execution" value={EXECUTION_LABELS[policy.executionMode]} />
            <SummaryRow label="Capabilities" value={draft.requiredCapabilities.map((item) => CAPABILITY_LABELS.get(item) ?? item).join(", ")} />
          </dl>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="block text-sm text-void-300">{label}{hint && <span className="ml-1.5 text-xs text-void-600">{hint}</span>}{children}</label>; }

function SummaryRow({ label, value, sub }: { label: string; value: string; sub?: string }) { return <div className="flex items-start justify-between gap-4 py-2.5"><dt className="text-void-500">{label}</dt><dd className="max-w-[62%] break-words text-right text-void-200">{value}{sub && <span className="mt-0.5 block font-mono text-[11px] text-void-600">{sub}</span>}</dd></div>; }

function GoalActions({ goal, busy, onEdit, onRun, onTransition }: { goal: GoalSnapshot; busy: boolean; onEdit: () => void; onRun: () => Promise<void>; onTransition: (action: "ACTIVATE" | "PAUSE" | "RESUME") => Promise<void> }) {
  if (goal.state === "COMPLETED") return <span className="text-sm text-void-500">Read only</span>;
  if (goal.state === "DRAFT") return <div className="flex flex-wrap gap-2"><button type="button" onClick={onEdit} className="instrument-button instrument-button-secondary">Edit</button><button type="button" disabled={busy} onClick={() => void onTransition("ACTIVATE")} className="instrument-button instrument-button-primary">Activate</button></div>;
  if (goal.state === "PAUSED") return <div className="flex flex-wrap gap-2"><button type="button" onClick={onEdit} className="instrument-button instrument-button-secondary">Edit</button><button type="button" disabled={busy} onClick={() => void onTransition("RESUME")} className="instrument-button instrument-button-primary"><PlayIcon size={17} aria-hidden />Resume</button></div>;
  return <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void onRun()} className="instrument-button instrument-button-primary"><PlayIcon size={17} aria-hidden />Run now</button><button type="button" disabled={busy} onClick={() => void onTransition("PAUSE")} className="instrument-button instrument-button-secondary"><PauseIcon size={17} aria-hidden />Pause</button></div>;
}

function RunTimeline({ run, reportRun, goalObjective }: { run: GoalRunSnapshot | null; reportRun: GoalRunSnapshot | null; goalObjective: string }) {
  const reduceMotion = useReducedMotion();
  const failed = run?.state === "FAILED" || run?.state === "BLOCKED";
  const live = Boolean(run && ACTIVE_RUN_STATES.includes(run.state as (typeof ACTIVE_RUN_STATES)[number]));
  const report = reportRun?.report ?? null;
  function laneState(jobId: string | null): EvidenceState {
    if (failed) return "failed";
    if (live) return "pending";
    if (run?.state === "READY" && jobId && run.report?.evidence.some((item) => item.jobId === jobId)) return "verified";
    if (run?.state === "PARTIAL") return "pending";
    return "unavailable";
  }
  return (
    <section aria-labelledby="protected-run-heading" className="border-y border-void-800 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="protected-run-heading" className="text-sm font-semibold text-void-100">Latest run</h2>
          <p className="mt-1 font-mono text-xs text-void-500">{run ? `Scheduled ${formatTime(run.scheduledFor)}` : "Waiting for activation"}</p>
        </div>
        <EvidenceStatus state={run ? runEvidenceState(run) : "unavailable"} label={run?.state ?? "IDLE"} />
      </div>
      {run && run.objective !== goalObjective && <p className="mt-3 break-words border-l-2 border-void-700 pl-3 text-xs leading-relaxed text-void-500">Triggered by {run.objective}</p>}
      <div className="mt-5 grid min-w-0 gap-6 lg:grid-cols-[minmax(16rem,0.85fr)_minmax(0,1.25fr)] lg:items-stretch">
        <section aria-labelledby="parallel-lanes-heading" className="min-w-0">
          <h3 id="parallel-lanes-heading" className="instrument-label">Selected agent lanes</h3>
          {run?.jobs.length ? <ol className="mt-2 divide-y divide-void-800">{run.jobs.map((job) => {
            const state = laneState(job.jobId);
            return <motion.li key={`${job.role}-${job.selectionRank}`} initial={live && !reduceMotion ? { opacity: 0.55, x: -10 } : false} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2 }} className="min-w-0 py-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-all font-mono text-sm text-dawg-300">{job.fullSubname}</p><p className="mt-1 text-xs text-void-400">{job.role}, {job.coveredCapabilities.join(", ")}</p></div><EvidenceStatus state={state} label={live ? run.state : state === "verified" ? "EVIDENCED" : run.state} /></div><p className="mt-1.5 font-mono text-xs text-void-600">{formatUsdc(job.priceAtomic)}, job {job.jobId?.slice(0, 8) ?? "pending"}</p></motion.li>;
          })}</ol> : <p className="mt-2.5 text-sm text-void-500">No agent lane selected.</p>}
        </section>

        <motion.section key={reportRun?.runId ?? "no-report"} initial={live && report && !reduceMotion ? { opacity: 0.65, x: 14 } : false} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduceMotion ? 0 : 0.24 }} className="min-w-0 border-l border-void-800 pl-5 lg:pl-7" aria-labelledby="converged-report-heading">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="converged-report-heading" className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-dawg-400">Converged report</h3><EvidenceStatus state={reportRun ? runEvidenceState(reportRun) : "unavailable"} label={reportRun?.state ?? "UNAVAILABLE"} /></div>
          <p className="mt-3 break-words text-xl font-semibold leading-snug text-void-100 xl:text-2xl">{report?.conclusion ?? "No completed report yet."}</p>
          <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-void-400">{report?.summary ?? "Run the active goal to produce one evidence-linked conclusion."}</p>
          {report && <div className="mt-4 border-t border-void-800 pt-3"><p className="break-all font-mono text-xs text-void-500">{report.evidence.length} evidence item{report.evidence.length === 1 ? "" : "s"}, report {reportRun?.reportHash ?? "Unavailable"}</p><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">{report.evidence.map((item) => <Link key={item.jobId} href={`/verify?jobId=${encodeURIComponent(item.jobId)}`} className="inline-flex min-h-11 items-center break-all text-sm font-semibold text-dawg-300">Inspect job {item.jobId.slice(0, 8)}</Link>)}</div></div>}
        </motion.section>
      </div>
    </section>
  );
}

function SwapProposal({ run }: { run: GoalRunSnapshot | null }) {
  if (!run || run.state !== "READY" || !isValidSwapProposal(run.report?.swapProposal ?? null)) return null;
  const proposal = run.report!.swapProposal!;
  return <section className="border border-dawg-700 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><ShieldWarningIcon size={22} className="text-dawg-400" aria-hidden /><div><h2 className="font-semibold text-dawg-300">Approval required</h2><p className="text-sm text-void-400">A6_BLOCKED_LIVE</p></div></div><span className="font-mono text-sm text-void-200">Chain 1301</span></div><dl className="mt-4 grid gap-3 border-y border-void-800 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-void-500">Token path</dt><dd className="mt-1 break-all text-void-200">{proposal.tokenIn} to {proposal.tokenOut}</dd></div><div><dt className="text-void-500">Input, atomic</dt><dd className="mt-1 font-mono text-void-200">{proposal.amountInAtomic}</dd></div><div><dt className="text-void-500">Slippage</dt><dd className="mt-1 font-mono text-void-200">{proposal.slippageBps} bps</dd></div><div><dt className="text-void-500">Rationale</dt><dd className="mt-1 text-void-200">{proposal.rationale}</dd></div></dl><button type="button" disabled className="instrument-button instrument-button-secondary mt-4">Wallet execution unavailable</button><details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm text-void-300">Supporting job evidence</summary><ul className="space-y-2 pb-2">{run.report!.evidence.map((item) => <li key={item.jobId}><Link href={`/verify?jobId=${encodeURIComponent(item.jobId)}`} className="break-all text-sm text-dawg-300">{item.jobId}</Link></li>)}</ul></details></section>;
}

function SelectedAgents({ run }: { run: GoalRunSnapshot | null | undefined }) { return <section><h2 className="instrument-label">Matched agents</h2>{!run?.jobs.length ? <p className="mt-2.5 text-sm text-void-500">No canonical agent version matched this run.</p> : <ul className="mt-2.5 divide-y divide-void-800">{run.jobs.map((job) => <li key={`${job.role}-${job.selectionRank}`} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="break-all font-mono text-sm text-dawg-300">{job.fullSubname}</span><span className="text-xs text-void-500">{job.role}</span></div><p className="mt-1.5 font-mono text-xs text-void-500">Version {job.agentVersionId.slice(0, 8)}, {formatUsdc(job.priceAtomic)}</p><details><summary className="min-h-11 cursor-pointer py-3 text-xs text-void-500">Version, capabilities, and proof identifiers</summary><dl className="space-y-2 break-all font-mono text-xs text-void-400"><div><dt className="text-void-600">Version ID</dt><dd>{job.agentVersionId}</dd></div><div><dt className="text-void-600">Manifest hash</dt><dd>{job.manifestHash}</dd></div><div><dt className="text-void-600">Capabilities</dt><dd>{job.coveredCapabilities.join(", ")}</dd></div><div><dt className="text-void-600">Job</dt><dd>{job.jobId ?? "Pending assignment"}</dd></div></dl></details></li>)}</ul>}</section>; }

function GoalRail({ goal, run }: { goal: GoalSnapshot; run: GoalRunSnapshot | null | undefined }) { const proofJobs = run?.jobs.filter((job) => job.jobId !== null) ?? []; return <aside className="space-y-4"><details className="border-b border-void-800"><summary className="instrument-label flex min-h-11 cursor-pointer items-center py-3">Spend and boundaries</summary><dl className="divide-y divide-void-800 pb-3 text-sm"><div className="flex justify-between gap-3 py-2"><dt className="text-void-500">Reserved this run</dt><dd className="text-right font-mono text-void-200">{formatUsdc(run?.totalPriceAtomic ?? "0")}</dd></div><div className="flex justify-between gap-3 py-2"><dt className="text-void-500">Per-run cap</dt><dd className="text-right font-mono text-void-200">{formatUsdc(goal.policy.perRunCapAtomic)}</dd></div><div className="flex justify-between gap-3 py-2"><dt className="text-void-500">Daily cap</dt><dd className="text-right font-mono text-void-200">{goal.policy.dailyCapAtomic ? formatUsdc(goal.policy.dailyCapAtomic) : "Not applicable"}</dd></div><div className="flex justify-between gap-3 py-2"><dt className="text-void-500">Policy hash</dt><dd className="max-w-[65%] break-all text-right font-mono text-xs text-void-400">{run?.policyHash ?? "Unavailable"}</dd></div></dl></details><section><div className="flex items-center justify-between gap-3"><h2 className="instrument-label">Proof</h2><span className="font-mono text-xs text-void-600">{proofJobs.length} job{proofJobs.length === 1 ? "" : "s"}</span></div>{proofJobs.length ? <ul className="mt-1">{proofJobs.map((job) => <li key={job.jobId}><Link href={`/verify?jobId=${encodeURIComponent(job.jobId!)}`} className="flex min-h-11 items-center break-all font-mono text-xs text-dawg-300">{job.jobId}</Link></li>)}</ul> : <p className="mt-2.5 text-sm text-void-500">No job proof identifiers yet.</p>}<Link href="/verify" className="inline-flex min-h-11 items-center text-sm font-semibold text-void-300">Open proof index</Link></section></aside>; }

function RecentRuns({ runs }: { runs: GoalRunSnapshot[] }) { if (!runs.length) return <p className="border-t border-void-800 py-5 text-sm text-void-500">No loops yet.</p>; return <ol className="border-t border-void-800">{runs.map((run) => <li key={run.runId} className="grid gap-2 border-b border-void-800 py-3 sm:grid-cols-[9rem_8rem_minmax(0,1fr)] sm:items-baseline"><span className="font-mono text-xs text-void-500">{formatTime(run.startedAt ?? run.createdAt)}</span><EvidenceStatus state={runEvidenceState(run)} label={run.state} /><p className={`min-w-0 break-words text-sm ${run.report?.conclusion ? "text-void-300" : run.errorCode ? "break-all font-mono text-xs text-blood-300" : "text-void-500"}`}>{run.report?.conclusion ?? run.errorCode ?? "No terminal report."}</p></li>)}</ol>; }
