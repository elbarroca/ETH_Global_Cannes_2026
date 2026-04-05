"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardBody, CodeBlock } from "@/components/ui/card";
import { NasdaqHeader } from "@/components/nasdaq-header";
import { Badge, SealedBadge, LiveBadge, ZeroGBadge } from "@/components/ui/badge";
import { mapCycleResultToCycle, mapEnrichedResponseToCycle } from "@/lib/cycle-mapper";
import type { Cycle } from "@/lib/types";
import type { PendingCycleResponse } from "@/lib/api";
import { arcTxUrl } from "@/lib/links";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/user-context";
import {
  getCycleHistory,
  approveCycle,
  rejectCycle as rejectCycleApi,
  getPendingCycle,
  configure,
} from "@/lib/api";
import Link from "next/link";
import { ExpandableHuntCard } from "@/components/expandable-hunt-card";
import { CycleNarrativePanel } from "@/components/cycle-narrative-panel";
import { ChatPanel } from "@/components/chat-panel";
import { PreconditionModal } from "@/components/precondition-modal";
import { TelegramModal } from "@/components/telegram-modal";
import { FundingModal } from "@/components/funding-modal";
import { NaryoFeed } from "@/components/naryo-feed";
import { RagStatusLine } from "@/components/rag-status-line";
import { CreateAgentModal } from "@/components/create-agent-modal";
import { SwarmStatusBar } from "@/components/swarm-status-bar";
import { SwarmActivityTicker } from "@/components/swarm-activity-ticker";
// DebateTheater removed — debate data is shown inside ExpandableHuntCard

const ANALYZE_STAGES = [
  "Hiring specialists from marketplace...",
  "Running adversarial debate (Alpha \u2192 Risk \u2192 Executor)...",
];

const COMMIT_STAGES = [
  "Logging decision to Hedera HCS...",
  "Storing memory to 0G decentralized storage...",
];

export default function DashboardPage() {
  const router = useRouter();
  const {
    user,
    userId,
    linkCode,
    telegramVerified,
    refreshLinkCode,
    agentBalance,
    agentBalanceFetchedAt,
    refetch: refetchUser,
  } = useUser();
  // `running` is kept as a boolean flag so the stage indicator reflects an
  // in-flight analyze/approve cycle. It is flipped by the SSE streaming path
  // (not plumbed here yet) — for catch-up from non-dashboard surfaces we rely
  // on the 6s polling loop below.
  const [running] = useState(false);
  const [approving, setApproving] = useState(false);
  // Hunt feed — holds up to 15 most-recent cycles for this user, newest first.
  // Populated by /api/cycle/history so hunts from ANY trigger source (dashboard,
  // Telegram /run, auto-heartbeat) appear here within 6 seconds without a
  // manual refresh.
  const [hunts, setHunts] = useState<Cycle[]>([]);
  const [pendingCycle, setPendingCycle] = useState<PendingCycleResponse | null>(null);
  const [stageIdx, setStageIdx] = useState(0);
  const [stages, setStages] = useState<string[]>(ANALYZE_STAGES);
  const [autoCycles, setAutoCycles] = useState(0);
  const [autoPeriod, setAutoPeriod] = useState(300000); // 5m default
  const [savingConfig, setSavingConfig] = useState(false);
  // Persistent hunt goal — edited inline on the dashboard and saved to
  // user.agent.goal via /api/configure. Used as the default goal on every
  // cycle (manual Hunt, auto-heartbeat, Telegram /run).
  const [huntGoal, setHuntGoal] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalSavedAt, setGoalSavedAt] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [precondition, setPrecondition] = useState<{ title: string; body: string; ctaLabel: string; ctaHref: string } | null>(null);
  // "Create Your Own Agent" modal — opens from the Build Your Specialist card.
  const [showCreateAgent, setShowCreateAgent] = useState(false);

  // Compute fund stats from user state only.
  // navChange24h and winRate are NOT shown as "0" — we render "—" in the UI
  // until we have a real historical NAV series and per-cycle P&L attribution.
  // totalSpend is an estimate: 3 specialist hires × $0.001 per cycle.
  // `deposited` is NOT passed here anymore — the hero reads the live on-chain
  // balance from UserContext via the agentBalance prop so every surface shows
  // the same number.
  const fund = user ? {
    nav: user.fund.currentNav,
    navChange24h: null,
    totalCycles: user.agent.lastCycleId,
    totalPayments: user.agent.lastCycleId * 3,
    totalSpend: user.agent.lastCycleId * 0.003,
    totalInferences: user.agent.lastCycleId * 6,
  } : null;

  // Most-recent hunt drives the header, degraded banner, holdings KPI, and
  // proof-status chips below the list. When the list is empty this is null
  // and those surfaces gracefully render their empty/placeholder variants.
  const cycle = hunts[0] ?? null;

  // Unified live hunt feed — polls /api/cycle/history every 6 seconds so hunts
  // triggered from non-dashboard surfaces (Telegram /run, auto-heartbeat) show
  // up without requiring a page refresh. Pauses while the tab is hidden to
  // reduce DB load; catches up immediately on visibilitychange → visible.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const [history, pending] = await Promise.all([
          getCycleHistory(userId, 15, 0),
          getPendingCycle(userId),
        ]);
        if (cancelled) return;
        setHunts(history.map(mapEnrichedResponseToCycle));
        setPendingCycle(pending);
      } catch {
        // non-fatal — keep the last known list, try again on next tick
      }
    };

    // Initial fetch
    void poll();

    const id = setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, 6_000);

    const onVis = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [userId]);

  // Sync local form state from the user record so the Goal textarea and
  // AUTO-HUNT dropdown reflect saved values after a page load or refresh.
  // We key off the user id only — we intentionally do NOT reset on every
  // `user` object change because refetchUser() after a save would clobber
  // the user's in-progress edit in the textarea. Reading user.agent inside
  // the effect is safe because it's read once per user.id change.
  const userAgent = user?.agent;
  useEffect(() => {
    if (!userAgent) return;
    setHuntGoal(userAgent.goal ?? "");
    setAutoCycles(userAgent.cycleCount ?? 0);
    // Only re-run when the user identity changes, not on every agent patch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Fade the "Saved ✓" confirmation on the Goal card after 2 seconds.
  useEffect(() => {
    if (goalSavedAt == null) return;
    const t = setTimeout(() => setGoalSavedAt(null), 2_000);
    return () => clearTimeout(t);
  }, [goalSavedAt]);

  // Cycle through stage messages while running/approving
  useEffect(() => {
    if (!running && !approving) { setStageIdx(0); return; }
    const timer = setInterval(() => {
      setStageIdx((s) => (s + 1) % stages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [running, approving, stages]);

  const handleApprove = useCallback(async () => {
    if (!pendingCycle || !userId) return;
    setApproving(true);
    setStageIdx(0);
    setStages(COMMIT_STAGES);
    try {
      const result = await approveCycle(pendingCycle.pendingId, userId);
      // Optimistically prepend the committed cycle so the user sees it at the
      // top of the feed immediately. The 6s poller will confirm/reconcile on
      // its next tick (it replaces this list with the authoritative history).
      const committed = mapCycleResultToCycle(result);
      setHunts((prev) => {
        const deduped = prev.filter((h) => h.id !== committed.id);
        return [committed, ...deduped].slice(0, 15);
      });
      setPendingCycle(null);
    } catch (err) {
      console.warn("[dashboard] Approval failed:", err);
    } finally {
      setApproving(false);
    }
  }, [pendingCycle, userId]);

  const handleReject = useCallback(async () => {
    if (!pendingCycle || !userId) return;
    try {
      await rejectCycleApi(pendingCycle.pendingId, userId);
      setPendingCycle(null);
    } catch (err) {
      console.warn("[dashboard] Rejection failed:", err);
    }
  }, [pendingCycle, userId]);

  // Derive a partial Cycle from pending data for display in Pack + Challenge columns
  const pendingAsCycle: Cycle | null = pendingCycle ? {
    id: pendingCycle.cycleNumber,
    timestamp: new Date().toISOString(),
    specialists: pendingCycle.specialists.map((s) => ({
      name: s.name,
      emoji: s.name === "sentiment" ? "🧠" : s.name === "whale" ? "🐋" : "📈",
      analysis: s.reasoning
        ? `${s.reasoning}\n${s.signal} (${s.confidence}% confidence)`
        : `${s.signal} (${s.confidence}% confidence)`,
      price: 0.001,
      attestation: s.attestationHash.slice(0, 10) + "..." + s.attestationHash.slice(-4),
      model: "glm-5-chat",
      provider: "0G Compute",
      inftId: "",
    })),
    adversarial: {
      alpha: {
        argument: pendingCycle.debate.alpha.reasoning
          || (pendingCycle.debate.alpha.parsed as { argument?: string; thesis?: string }).argument
          || (pendingCycle.debate.alpha.parsed as { thesis?: string }).thesis
          || JSON.stringify(pendingCycle.debate.alpha.parsed),
        recommendation: `${(pendingCycle.debate.alpha.parsed as { action?: string }).action ?? "?"} ${(pendingCycle.debate.alpha.parsed as { pct?: number }).pct ?? 0}%`,
        attestation: pendingCycle.debate.alpha.attestationHash.slice(0, 10) + "..." + pendingCycle.debate.alpha.attestationHash.slice(-4),
      },
      risk: {
        argument: pendingCycle.debate.risk.reasoning
          || (pendingCycle.debate.risk.parsed as { challenge?: string; objection?: string }).objection
          || (pendingCycle.debate.risk.parsed as { challenge?: string }).challenge
          || JSON.stringify(pendingCycle.debate.risk.parsed),
        recommendation: `Max ${(pendingCycle.debate.risk.parsed as { max_pct?: number }).max_pct ?? 0}%`,
        attestation: pendingCycle.debate.risk.attestationHash.slice(0, 10) + "..." + pendingCycle.debate.risk.attestationHash.slice(-4),
      },
      executor: {
        argument: pendingCycle.debate.executor.reasoning
          || (pendingCycle.debate.executor.parsed as { reasoning?: string }).reasoning
          || JSON.stringify(pendingCycle.debate.executor.parsed),
        recommendation: `${(pendingCycle.debate.executor.parsed as { action?: string }).action ?? "?"} ${(pendingCycle.debate.executor.parsed as { pct?: number }).pct ?? 0}%`,
        attestation: pendingCycle.debate.executor.attestationHash.slice(0, 10) + "..." + pendingCycle.debate.executor.attestationHash.slice(-4),
      },
    },
    payments: pendingCycle.specialists.map((s) => ({
      from: s.hiredBy ?? "main-agent",
      to: s.name,
      amount: 0.001,
      txHash: s.paymentTxHash ?? "",
      hiredBy: s.hiredBy ?? "main-agent",
      chain: "arc" as const,
    })),
    hcs: { topicId: "", sequenceNumber: 0, timestamp: "" },
    trade: {
      action: pendingCycle.compactRecord.d.act as "BUY" | "SELL" | "HOLD",
      asset: pendingCycle.compactRecord.d.asset,
      percentage: pendingCycle.compactRecord.d.pct,
      stopLoss: pendingCycle.compactRecord.adv.e.sl ? -pendingCycle.compactRecord.adv.e.sl : null,
    },
    memory: [],
    rebuttalTriggered: pendingCycle?.debate?.rebuttalTriggered,
  } : null;

  return (
    <>
      {/* Swarm Observatory — full-width health strip at the top of every dashboard load. */}
      <SwarmStatusBar />
      <main className="max-w-screen-2xl mx-auto px-5 py-5">
      {/* Unskippable Telegram verification modal */}
      {user && !telegramVerified && (
        <TelegramModal linkCode={linkCode} onRefresh={refreshLinkCode} />
      )}

      {/* Unskippable funding modal — shown after Telegram is verified but the
          live proxy wallet is empty. Uses agentBalance (Arc RPC direct) so a
          fresh top-up auto-dismisses the modal on the next 5s poll. */}
      {user && telegramVerified && (agentBalance ?? user.fund.depositedUsdc) === 0 && user.proxyWallet?.address && (
        <FundingModal
          proxyAddress={user.proxyWallet.address}
          onNavigate={(href) => router.push(href)}
        />
      )}

      {/* 2-column layout: left = dashboard content, right = sticky live activity ticker */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="min-w-0 space-y-3">

      {/* Degraded-cycle banner: only rendered when the last committed cycle
          had a proof failure OR a specialist ran without TEE attestation.
          This replaces the previous silent-degradation behavior so users know
          when something on the glass-box proof chain didn't succeed. */}
      {cycle?.degraded && (
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/40 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Degraded cycle #{cycle.id}
            </div>
            <Badge variant="amber">Partial proofs</Badge>
          </div>
          {cycle.degradedReasons && cycle.degradedReasons.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-amber-200/80">
              {cycle.degradedReasons.map((reason, idx) => (
                <li key={idx}>• {reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Nasdaq-style terminal header — big NAV + ticker strip. */}
      <NasdaqHeader
        fund={fund}
        connected={!!user}
        agentBalance={agentBalance}
        agentBalanceFetchedAt={agentBalanceFetchedAt}
      />

      {/* Cycle header — shows the current/last hunt status. The user's saved
          goal (user.agent.goal) drives every cycle; they edit it inline in
          the "Hunt Goal" card below. The italic quote next to the header
          shows the goal the most recent cycle ran against. */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base sm:text-lg font-semibold text-void-300 uppercase tracking-wide">
            {pendingCycle
              ? `Hunt #${pendingCycle.cycleNumber} \u00b7 Awaiting approval`
              : cycle
                ? `Hunt #${cycle.id} \u00b7 ${new Date(cycle.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                : "Ready to hunt"}
          </h2>
          {cycle?.goal && (
            <span className="text-sm text-void-400 italic truncate max-w-md" title={cycle.goal}>
              &ldquo;{cycle.goal}&rdquo;
            </span>
          )}
        </div>
        {(running || approving) && (
          <p className="text-sm text-void-400 animate-pulse">{stages[stageIdx]}</p>
        )}
      </div>

      {/* Build Your Specialist — dashboard entry point for the "Create Your
          Own Agent" flow. Replaces the free-text Hunt input. The same modal
          is also launched from the Marketplace header's "Deploy your agent"
          button, so both surfaces share one component. */}
      <Card>
        <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs text-void-500 uppercase tracking-wider">
              Build Your Specialist
            </span>
            <span className="text-xs text-void-400 truncate">
              Describe the edge · 0G crafts the persona · deploy to the pack marketplace.
            </span>
          </div>
          <button
            onClick={() => setShowCreateAgent(true)}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-dawg-500 hover:bg-dawg-400 text-void-950 text-xs font-bold rounded-lg transition-colors shrink-0"
          >
            <span className="text-base leading-none">+</span>
            <span>Create Agent</span>
          </button>
        </div>
      </Card>

      {/* Hunt Goal — persistent per-user input. Saved to user.agent.goal via
          /api/configure, then read by every cycle (auto-heartbeat, manual
          dashboard Hunt, Telegram /run) as the default goal. Empty value
          falls back to the risk-profile template. */}
      <Card>
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-xs text-void-500 uppercase tracking-wider">
                Hunt Goal
              </span>
              <span className="text-[10px] text-void-600">
                Persists across cycles · {huntGoal.length}/280
              </span>
              {goalSavedAt != null && (
                <span className="text-[10px] text-emerald-400">Saved ✓</span>
              )}
            </div>
            <button
              onClick={async () => {
                if (!userId) return;
                setSavingGoal(true);
                try {
                  await configure(userId, { goal: huntGoal.trim() });
                  await refetchUser();
                  setGoalSavedAt(Date.now());
                } catch (err) {
                  console.warn("[dashboard] Goal save failed:", err);
                } finally {
                  setSavingGoal(false);
                }
              }}
              disabled={savingGoal || huntGoal.length > 280}
              className="px-4 py-1.5 bg-void-800 hover:bg-void-700 disabled:opacity-60 text-void-300 text-xs font-semibold rounded-lg border border-void-700 transition-colors"
            >
              {savingGoal ? "Saving..." : "Save Goal"}
            </button>
          </div>
          <textarea
            value={huntGoal}
            onChange={(e) => setHuntGoal(e.target.value.slice(0, 280))}
            maxLength={280}
            rows={2}
            placeholder="e.g. 'Accumulate ETH safely during dips, target 20% upside over 3 months'"
            className="w-full px-3 py-2 bg-void-950 border border-void-700 rounded-lg text-sm text-void-200 placeholder:text-void-600 resize-none focus:outline-none focus:border-dawg-500/60"
          />
        </div>
      </Card>

      {/* Auto-Hunt Config */}
      <Card>
        <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-void-500 uppercase tracking-wider">Auto-Hunt</span>
            <input
              type="number"
              min={0}
              max={100}
              value={autoCycles}
              onChange={(e) => setAutoCycles(Math.min(100, Math.max(0, Number(e.target.value))))}
              className="w-16 px-2 py-1.5 bg-void-950 border border-void-700 rounded-lg text-sm text-void-200 text-center"
              placeholder="0"
            />
            <span className="text-xs text-void-500">cycles every</span>
            <select
              value={autoPeriod}
              onChange={(e) => setAutoPeriod(Number(e.target.value))}
              className="px-2 py-1.5 bg-void-950 border border-void-700 rounded-lg text-sm text-void-200"
            >
              <option value={300000}>5 min</option>
              <option value={900000}>15 min</option>
              <option value={1800000}>30 min</option>
              <option value={3600000}>1 hour</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            {user?.agent?.cyclesRemaining != null && user.agent.cyclesRemaining > 0 && (
              <span className="text-xs text-gold-400">
                {user.agent.cyclesRemaining} of {user.agent.cycleCount ?? "?"} remaining
              </span>
            )}
            <button
              onClick={async () => {
                if (!userId) return;
                setSavingConfig(true);
                try {
                  await configure(userId, { cycleCount: autoCycles, cyclePeriodMs: autoPeriod });
                  // Refetch so the "X of N remaining" chip + Agent Active LED
                  // reflect the new state immediately without waiting for the
                  // next 5s UserContext poll.
                  await refetchUser();
                } catch (err) {
                  console.warn("[dashboard] Config save failed:", err);
                } finally {
                  setSavingConfig(false);
                }
              }}
              disabled={savingConfig}
              className="px-4 py-1.5 bg-void-800 hover:bg-void-700 disabled:opacity-60 text-void-300 text-xs font-semibold rounded-lg border border-void-700 transition-colors"
            >
              {savingConfig ? "Saving..." : autoCycles > 0 ? "Start" : "Save"}
            </button>
          </div>
        </div>
      </Card>

      {/* Row 2: Pending approval (3-column debate view) OR unified hunt feed.
          The feed is populated by the 6s polling loop above, so hunts from
          any source (dashboard, Telegram /run, auto-heartbeat) land here
          live without requiring a page refresh. Newest hunt is expanded by
          default; older hunts render collapsed and expand on click. */}
      {pendingCycle ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PackColumn
            cycle={pendingAsCycle!}
            onVerify={() => router.push(`/verify?cycle=${pendingCycle.cycleNumber}`)}
          />
          <ChallengeColumn
            cycle={pendingAsCycle!}
            onVerify={() => router.push(`/verify?cycle=${pendingCycle.cycleNumber}`)}
          />
          <ApprovalPanel
            pendingCycle={pendingCycle}
            approving={approving}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </div>
      ) : hunts.length > 0 && userId && cycle ? (
        <>
          <div className="space-y-4">
            {hunts.map((h, i) => (
              <ExpandableHuntCard
                key={h.id}
                cycle={h}
                userId={userId}
                defaultExpanded={i === 0}
                userInftTokenId={user?.inftTokenId ?? null}
                computing={i === 0 && (running || approving)}
                computingLabel={running ? "Analyzing" : "Committing"}
                computingStage={stages[stageIdx]}
              />
            ))}
          </div>

          {userId && <RagStatusLine userId={userId} />}

          {/* Narrative panel — explains what the augmented layer discussed
              for the MOST RECENT hunt. Populated from cycles.narrative JSON
              column via enrichCycleRow. */}
          {cycle.narrative && <CycleNarrativePanel narrative={cycle.narrative} />}

          {/* Holdings KPI — one-line summary that points at /portfolio. Shows
              holdings from the most recent hunt so the dashboard stays a
              glance-view; the detail tab has the full breakdown. */}
          {user && (
            <HoldingsSummaryKpi
              depositedUsdc={user.fund.depositedUsdc}
              holdings={cycle.holdings ?? user.fund.holdings ?? {}}
            />
          )}

          {/* Naryo Multichain Event Stream — secondary context, rendered
              below the hunt feed so the hunt list stays in the prime
              above-the-fold position. */}
          <Card>
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-void-400 uppercase tracking-wider">Multichain Events</h3>
                  <span className="text-[10px] px-1.5 py-0.5 bg-void-800 text-void-500 rounded">Naryo</span>
                </div>
                <LiveBadge />
              </div>
              <NaryoFeed />
            </div>
          </Card>
        </>
      ) : running || approving ? (
        // First-ever hunt in flight — no prior cycle to show, so render a
        // skeleton ExpandableHuntCard-shaped computing placeholder.
        <Card>
          <CardBody className="py-8 space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 border-2 border-dawg-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-semibold text-void-200">
                Computing Hunt #{(user?.agent?.lastCycleId ?? 0) + 1}…
              </span>
            </div>
            <p className="text-xs text-void-500 animate-pulse">{stages[stageIdx]}</p>
          </CardBody>
        </Card>
      ) : (
        <EmptyHuntsState />
      )}

      {/* Row 4: Agent Wallet + Status bar */}
      {user?.proxyWallet?.address && (
        <Card>
          <div className="px-4 py-3 space-y-3">
            {/* Agent wallet row */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blood-900/50 border border-blood-600/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blood-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-void-200">Agent Wallet</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-void-800 text-void-500 rounded">Circle MPC</span>
                  </div>
                  <span className="font-mono text-xs text-void-500">
                    {user.proxyWallet.address.slice(0, 6)}...{user.proxyWallet.address.slice(-4)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className={`text-lg font-bold font-mono ${(agentBalance ?? 0) > 0 ? "text-gold-400" : "text-void-600"}`}>
                    {agentBalance != null ? `$${agentBalance.toFixed(4)}` : "—"}
                  </p>
                  <p className="text-[10px] text-void-600">USDC on Arc · live</p>
                </div>
                <button
                  onClick={() => router.push("/deposit")}
                  className="px-3 py-1.5 bg-dawg-500 hover:bg-dawg-400 text-void-950 text-xs font-bold rounded-lg transition-colors"
                >
                  {(agentBalance ?? 0) > 0 ? "Manage" : "Deposit"}
                </button>
              </div>
            </div>

            {/* Status indicators */}
            <div className="flex items-center justify-between border-t border-void-800/50 pt-2 flex-wrap gap-2">
              <div className="flex items-center gap-3 text-xs text-void-500">
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${user.telegram?.verified ? "bg-emerald-500" : "bg-void-600"}`} />
                  <span>Telegram</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${user.agent.active ? "bg-emerald-500" : "bg-void-600"}`} />
                  <span>Agent {user.agent.active ? "Active" : "Paused"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-void-600">|</span>
                  <span>{user.agent.riskProfile} / max {user.agent.maxTradePercent}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {cycle?.openclawGatewayStatus && (
                  <Badge variant={cycle.openclawGatewayStatus === "active" ? "green" : "gray"}>
                    OpenClaw: {cycle.openclawGatewayStatus}
                  </Badge>
                )}
                {cycle?.specialistPath && (
                  <Badge variant="purple">
                    path: {cycle.specialistPath.replace(/_/g, " ")}
                  </Badge>
                )}
                <Badge variant="gray">0G Sealed</Badge>
                <Badge variant="gray">Hedera HCS</Badge>
                <Badge variant="gray">Arc Nano</Badge>
              </div>
            </div>
          </div>
        </Card>
      )}
      {/* Precondition Modal */}
      {precondition && (
        <PreconditionModal
          title={precondition.title}
          body={precondition.body}
          ctaLabel={precondition.ctaLabel}
          ctaHref={precondition.ctaHref}
          onClose={() => setPrecondition(null)}
          onNavigate={(href) => { setPrecondition(null); router.push(href); }}
        />
      )}

      {/* Chat FAB — bottom-left */}
      <button
        onClick={() => setChatOpen((prev) => !prev)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 bg-dawg-500 hover:bg-dawg-400 text-void-950 text-2xl rounded-full shadow-lg shadow-dawg-500/30 transition-all flex items-center justify-center"
      >
        {chatOpen ? "✕" : "🐺"}
      </button>

      {/* Chat panel — opens from bottom-left, adjacent to FAB */}
      {chatOpen && userId && (
        <ChatPanel userId={userId} onClose={() => setChatOpen(false)} />
      )}
        </div>
        {/* Right column: sticky live activity ticker (desktop only) */}
        <aside className="hidden xl:block">
          <div className="sticky top-4">
            <SwarmActivityTicker />
          </div>
        </aside>
      </div>
    </main>
    {showCreateAgent && (
      <CreateAgentModal
        createdBy={user?.proxyWallet?.address ?? userId ?? null}
        onClose={() => setShowCreateAgent(false)}
      />
    )}
    </>
  );
}

// ─── Approval Panel ──────────────────────────────────────────────────────────

function ApprovalPanel({
  pendingCycle,
  approving,
  onApprove,
  onReject,
}: {
  pendingCycle: PendingCycleResponse;
  approving: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const exec = pendingCycle.compactRecord.adv.e;
  const decision = pendingCycle.compactRecord.d;
  const expiresAt = new Date(pendingCycle.expiresAt);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const tick = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }
      const min = Math.floor(diff / 60000);
      const sec = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${min}:${sec.toString().padStart(2, "0")}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [pendingCycle.expiresAt]);

  const actionColor = decision.act === "BUY"
    ? "text-green-400"
    : decision.act === "SELL"
      ? "text-blood-400"
      : "text-gold-400";

  return (
    <div className="space-y-3">
      {/* Recommendation */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
            <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
            Your Decision
          </div>
          <Badge variant="amber">Pending</Badge>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="text-center py-4">
            <p className="text-xs text-void-500 uppercase tracking-wider mb-2">Recommendation</p>
            <p className={`text-3xl font-bold ${actionColor}`}>
              {decision.act} {decision.asset}
            </p>
            <p className="text-lg text-void-300 mt-1">
              {decision.pct}% of portfolio
            </p>
            <p className="text-sm text-void-500 mt-1">
              Stop loss: {exec.sl}%
            </p>
          </div>

          {/* Countdown */}
          <div className="flex items-center justify-center gap-2 text-sm text-void-400">
            <span>Auto-resolves in</span>
            <span className="font-mono text-gold-400">{timeLeft}</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onApprove}
              disabled={approving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
            >
              {approving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Logging...
                </>
              ) : (
                "Approve"
              )}
            </button>
            <button
              onClick={onReject}
              disabled={approving}
              className="flex-1 px-4 py-3 bg-void-800 hover:bg-void-700 disabled:opacity-60 text-void-300 text-sm font-bold rounded-xl transition-colors border border-void-700"
            >
              Reject
            </button>
          </div>

          <p className="text-xs text-void-600 text-center">
            Approved decisions are logged immutably to Hedera HCS + 0G Storage.
            Rejected decisions are discarded.
          </p>
        </CardBody>
      </Card>

      {/* Specialist costs preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Arc payments
          </div>
          <Badge variant="blue">USDC</Badge>
        </CardHeader>
        <CardBody className="space-y-2">
          {pendingCycle.specialists.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-void-500">you → {s.name}</span>
              <span className="font-mono text-void-200">$0.001</span>
            </div>
          ))}
          <hr className="border-void-800 my-1" />
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-void-200">Hunt cost:</span>
            <span className="font-mono font-bold text-void-100">$0.003</span>
          </div>
          <p className="text-xs text-blue-400">Circle Nanopayments · Gas-free</p>
        </CardBody>
      </Card>
    </div>
  );
}

// ─── Column components ────────────────────────────────────────────────────────

const HIRER_BADGE: Record<string, string> = {
  alpha: "bg-green-500/15 text-green-400 border-green-500/30",
  risk: "bg-blood-500/15 text-blood-300 border-blood-500/30",
  executor: "bg-gold-400/15 text-gold-400 border-gold-400/30",
  "main-agent": "bg-void-800 text-void-400 border-void-700",
};

function PackColumn({ cycle, onVerify }: { cycle: Cycle; onVerify: () => void }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          ETH pack
        </div>
        <Badge variant="amber">{cycle.specialists.length} hired</Badge>
      </CardHeader>
      <CardBody className="space-y-4">
        {cycle.specialists.map((s, i) => {
          const hiredBy = s.hiredBy ?? "main-agent";
          const paymentUrl = s.paymentTxHash && s.paymentTxHash.startsWith("0x")
            ? arcTxUrl(s.paymentTxHash)
            : null;
          return (
            <div key={`${s.name}-${i}`} className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span>{s.emoji}</span>
                  <span className="text-xs font-semibold text-void-200">{s.name}</span>
                  <ZeroGBadge />
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider ${HIRER_BADGE[hiredBy] ?? HIRER_BADGE["main-agent"]}`}
                  >
                    hired by {hiredBy}
                  </span>
                  {paymentUrl ? (
                    <a
                      href={paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-teal-300 hover:text-teal-200 underline decoration-dotted"
                      title={s.paymentTxHash}
                    >
                      ${s.price.toFixed(3)} ↗
                    </a>
                  ) : (
                    <span className="text-xs font-mono text-void-500">${s.price.toFixed(3)}</span>
                  )}
                </div>
              </div>
              <CodeBlock>{s.analysis}</CodeBlock>
              <div className="flex items-center gap-2">
                <SealedBadge onClick={onVerify} />
                <span className="text-xs font-mono text-void-600">{s.attestation}</span>
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

function ChallengeColumn({ cycle, onVerify }: { cycle: Cycle; onVerify: () => void }) {
  // Group specialists by the debate agent that hired them — this is the
  // visible "agent hiring economy" story per tier.
  const hiresFor = (role: "alpha" | "risk" | "executor"): string[] =>
    cycle.specialists.filter((s) => s.hiredBy === role).map((s) => s.name);

  const agents = [
    {
      emoji: "🟢",
      name: "Alpha",
      role: "alpha" as const,
      data: cycle.adversarial.alpha,
      recColor: "text-green-400",
    },
    {
      emoji: "🔴",
      name: "Risk",
      role: "risk" as const,
      data: cycle.adversarial.risk,
      recColor: "text-blood-300",
    },
    {
      emoji: "🟡",
      name: "Executor",
      role: "executor" as const,
      data: cycle.adversarial.executor,
      recColor: "text-gold-400",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
          <span className="w-2 h-2 rounded-full bg-blood-500 animate-pulse" />
          The challenge
          {cycle.rebuttalTriggered && (
            <Badge variant="amber">2 rounds</Badge>
          )}
        </div>
        <LiveBadge />
      </CardHeader>
      <CardBody className="space-y-4">
        {agents.map(({ emoji, name, role, data, recColor }) => {
          const hires = hiresFor(role);
          return (
            <div key={name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span>{emoji}</span>
                  <span className="text-sm font-semibold text-void-200">{name}</span>
                </div>
                <SealedBadge onClick={onVerify} />
              </div>
              <CodeBlock>
                {data.argument}
                <br />
                <span className={`font-semibold ${recColor}`}>{data.recommendation}</span>
              </CodeBlock>
              {/* Specialists this debate agent autonomously paid for */}
              <div className="text-[10px] text-void-600 font-mono">
                {hires.length > 0 ? (
                  <>
                    hires: <span className={recColor}>{hires.join(", ")}</span>
                  </>
                ) : (
                  <span className="italic">no specialists hired</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-void-500">0G: glm-5-chat</span>
                <span className="text-xs font-mono text-void-600">{data.attestation}</span>
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

// Compact holdings KPI strip — the full portfolio (pie chart + evolution +
// attribution) lives on /portfolio. This one-liner stays on the dashboard so
// users can tell at a glance whether their agent has open positions without
// the widget eating half the hunt column.
function HoldingsSummaryKpi({
  depositedUsdc,
  holdings,
}: {
  depositedUsdc: number;
  holdings: Record<string, number>;
}) {
  const tokenEntries = Object.entries(holdings ?? {}).filter(([, v]) => v > 0);
  const tokenCount = tokenEntries.length;
  const topToken = tokenEntries.sort((a, b) => b[1] - a[1])[0];

  return (
    <Link
      href="/portfolio"
      className="block group"
    >
      <Card>
        <div className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-void-600">Your holdings</div>
              <div className="text-xl font-bold font-mono tabular-nums text-void-100 leading-tight">
                ${depositedUsdc.toFixed(2)}{" "}
                <span className="text-xs font-normal text-void-500">USDC</span>
              </div>
            </div>
            {tokenCount > 0 && (
              <>
                <div className="h-8 w-px bg-void-800" />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-void-600">
                    Token positions
                  </div>
                  <div className="text-sm text-void-200 leading-tight font-mono">
                    {tokenCount} position{tokenCount === 1 ? "" : "s"}
                    {topToken && (
                      <span className="text-void-500 ml-1.5">
                        · top {topToken[0]} {topToken[1].toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <span className="text-[11px] font-mono text-teal-300 group-hover:text-teal-200 underline decoration-dotted">
            View portfolio ↗
          </span>
        </div>
      </Card>
    </Link>
  );
}

// Empty-state card shown when a fresh user has zero hunts in the feed.
// Intentionally blunt about WHY the pack is idle — the most common cause is
// "user hasn't opted into auto-hunt yet" — and points at the two actions that
// will start producing hunts (set AUTO-HUNT cycles on the dashboard, or
// trigger a one-shot via Telegram /run).
function EmptyHuntsState() {
  return (
    <Card>
      <CardBody className="text-center py-12 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-void-600" />
          <p className="text-void-300 text-sm font-semibold uppercase tracking-wider">
            No hunts yet
          </p>
        </div>
        <p className="text-void-500 text-xs max-w-md mx-auto leading-relaxed">
          Your pack is idle. Set an <span className="text-gold-400">AUTO-HUNT</span> cycle count
          above to schedule hunts, or send <code className="px-1 py-0.5 bg-void-800 text-void-300 rounded text-[10px]">/run</code>
          to your Telegram bot to trigger a one-shot hunt. Every hunt — regardless of source —
          will appear live in this feed.
        </p>
      </CardBody>
    </Card>
  );
}

