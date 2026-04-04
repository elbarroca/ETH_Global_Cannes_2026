"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardBody, MetricCard, CodeBlock } from "@/components/ui/card";
import { Badge, SealedBadge, LiveBadge, ZeroGBadge } from "@/components/ui/badge";
import { mapCycleResultToCycle, mapCompactRecordToCycle } from "@/lib/cycle-mapper";
import type { Cycle } from "@/lib/types";
import type { PendingCycleResponse } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/user-context";
import {
  getLatestCycle,
  getCycleHistory,
  analyzeCycle,
  approveCycle,
  rejectCycle as rejectCycleApi,
  getPendingCycle,
  configure,
} from "@/lib/api";
import { HuntCard } from "@/components/hunt-card";
import { ChatPanel } from "@/components/chat-panel";
import { PreconditionModal } from "@/components/precondition-modal";
import { TelegramModal } from "@/components/telegram-modal";
import { FundingModal } from "@/components/funding-modal";
import { NaryoFeed } from "@/components/naryo-feed";

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
  const { user, userId, linkCode, telegramVerified, refreshLinkCode } = useUser();
  const [running, setRunning] = useState(false);
  const [approving, setApproving] = useState(false);
  const [liveCycle, setLiveCycle] = useState<Cycle | null>(null);
  const [pendingCycle, setPendingCycle] = useState<PendingCycleResponse | null>(null);
  const [stageIdx, setStageIdx] = useState(0);
  const [stages, setStages] = useState<string[]>(ANALYZE_STAGES);
  const [pastCycles, setPastCycles] = useState<Cycle[]>([]);
  const [autoCycles, setAutoCycles] = useState(0);
  const [autoPeriod, setAutoPeriod] = useState(300000); // 5m default
  const [savingConfig, setSavingConfig] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [precondition, setPrecondition] = useState<{ title: string; body: string; ctaLabel: string; ctaHref: string } | null>(null);

  // Compute fund stats from user state only
  const fund = user ? {
    nav: user.fund.currentNav,
    navChange24h: 0,
    totalCycles: user.agent.lastCycleId,
    totalPayments: user.agent.lastCycleId * 3,
    totalSpend: user.agent.lastCycleId * 0.003,
    winRate: 0,
    totalInferences: user.agent.lastCycleId * 6,
  } : null;

  const cycle = liveCycle;

  // Fetch latest cycle + check for pending on mount
  useEffect(() => {
    if (!userId) return;
    getLatestCycle(userId).then((record) => {
      if (record) setLiveCycle(mapCompactRecordToCycle(record));
    }).catch(() => {});
    getPendingCycle(userId).then((pending) => {
      if (pending) setPendingCycle(pending);
    }).catch(() => {});
    getCycleHistory(userId, 20).then((records) => {
      setPastCycles(records.map(mapCompactRecordToCycle));
    }).catch(() => {});
  }, [userId]);

  // Cycle through stage messages while running/approving
  useEffect(() => {
    if (!running && !approving) { setStageIdx(0); return; }
    const timer = setInterval(() => {
      setStageIdx((s) => (s + 1) % stages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [running, approving, stages]);

  async function handleHunt() {
    if (!userId || !user) return;

    // Precondition: check USDC balance
    if (user.fund.depositedUsdc < 0.003) {
      setPrecondition({
        title: "Insufficient USDC",
        body: `You need at least $0.003 to pay 3 specialists. Current balance: $${user.fund.depositedUsdc.toFixed(2)}`,
        ctaLabel: "Deposit USDC",
        ctaHref: "/deposit",
      });
      return;
    }

    setRunning(true);
    setStageIdx(0);
    setStages(ANALYZE_STAGES);
    try {
      const result = await analyzeCycle(userId);
      setPendingCycle(result);
    } catch (err) {
      console.warn("[dashboard] Analysis failed:", err);
    } finally {
      setRunning(false);
    }
  }

  const handleApprove = useCallback(async () => {
    if (!pendingCycle || !userId) return;
    setApproving(true);
    setStageIdx(0);
    setStages(COMMIT_STAGES);
    try {
      const result = await approveCycle(pendingCycle.pendingId, userId);
      setLiveCycle(mapCycleResultToCycle(result));
      setPendingCycle(null);
      // Refresh hunt history
      getCycleHistory(userId, 20).then((records) => {
        setPastCycles(records.map(mapCompactRecordToCycle));
      }).catch(() => {});
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
      from: "you",
      to: s.name,
      amount: 0.001,
      txHash: "",
      chain: "arc",
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

  const displayCycle = pendingAsCycle ?? cycle;

  return (
    <main className="max-w-7xl mx-auto px-5 py-5 space-y-3">
      {/* Unskippable Telegram verification modal */}
      {user && !telegramVerified && (
        <TelegramModal linkCode={linkCode} onRefresh={refreshLinkCode} />
      )}

      {/* Unskippable funding modal — shown after Telegram is verified but no USDC deposited */}
      {user && telegramVerified && user.fund.depositedUsdc === 0 && user.proxyWallet?.address && (
        <FundingModal
          proxyAddress={user.proxyWallet.address}
          onNavigate={(href) => router.push(href)}
        />
      )}

      {/* Row 1: Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard
          emoji="💰"
          label="Fund NAV"
          value={fund ? `$${fund.nav.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
          sub={fund ? `+${fund.navChange24h}% (24h)` : "Connect wallet"}
          subColor={fund ? "text-green-400" : undefined}
        />
        <MetricCard
          emoji="🔄"
          label="Hunts"
          value={fund ? fund.totalCycles.toString() : "0"}
          sub="All sealed"
        />
        <MetricCard
          emoji="💸"
          label="Pack spend"
          value={fund ? `$${fund.totalSpend.toFixed(2)}` : "$0.00"}
          sub={fund ? `${fund.totalPayments} payments` : "0 payments"}
        />
        <MetricCard
          emoji="🎯"
          label="Win rate"
          value={fund ? `${fund.winRate}%` : "—"}
          sub="Verified"
        />
        <MetricCard
          emoji="🧠"
          label="0G sealed"
          value={fund ? fund.totalInferences.toString() : "0"}
          sub="6 per hunt"
          subColor="text-void-500"
        />
      </div>

      {/* Naryo Multichain Event Stream */}
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

      {/* Hunt button */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-void-600 uppercase tracking-wider">
          {pendingCycle
            ? `Hunt #${pendingCycle.cycleNumber} \u00b7 Awaiting approval`
            : cycle
              ? `Hunt #${cycle.id} \u00b7 ${new Date(cycle.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
              : "Ready to hunt"}
        </h2>
        <div className="flex flex-col items-end gap-1">
          {!pendingCycle && (
            <button
              onClick={handleHunt}
              disabled={running || approving}
              className={`flex items-center gap-2 px-6 py-3 bg-blood-600 hover:bg-blood-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors ${running ? "hunting" : ""}`}
            >
              {running ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing\u2026
                </>
              ) : (
                "\uD83D\uDC3A Hunt"
              )}
            </button>
          )}
          {(running || approving) && (
            <p className="text-xs text-void-500 animate-pulse">{stages[stageIdx]}</p>
          )}
        </div>
      </div>

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

      {/* Row 2: Three columns */}
      {displayCycle ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PackColumn cycle={displayCycle} onVerify={() => router.push("/verify")} />
          <ChallengeColumn cycle={displayCycle} onVerify={() => router.push("/verify")} />
          {pendingCycle ? (
            <ApprovalPanel
              pendingCycle={pendingCycle}
              approving={approving}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ) : cycle ? (
            <RightColumn cycle={cycle} userInftTokenId={user?.inftTokenId ?? null} />
          ) : null}
        </div>
      ) : (
        <Card>
          <CardBody className="text-center py-12 space-y-3">
            <p className="text-void-400 text-sm">No hunts yet. Click Hunt to trigger your first cycle.</p>
            <p className="text-void-600 text-xs">
              Your agent will hire 3 specialists, run adversarial debate, and present its recommendation for your approval.
            </p>
          </CardBody>
        </Card>
      )}

      {/* Row 3: Past hunt cards */}
      {pastCycles.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-void-600 uppercase tracking-wider">
            Hunt history
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pastCycles.map((c) => (
              <HuntCard key={c.id} cycle={c} />
            ))}
          </div>
        </div>
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
                  <p className={`text-lg font-bold font-mono ${user.fund.depositedUsdc > 0 ? "text-gold-400" : "text-void-600"}`}>
                    ${user.fund.depositedUsdc.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-void-600">USDC on Arc</p>
                </div>
                <button
                  onClick={() => router.push("/deposit")}
                  className="px-3 py-1.5 bg-blood-600 hover:bg-blood-700 text-white text-xs font-medium rounded-lg transition-colors"
                >
                  {user.fund.depositedUsdc > 0 ? "Manage" : "Deposit"}
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
              <div className="flex items-center gap-2">
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

      {/* Chat FAB */}
      <button
        onClick={() => setChatOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-blood-600 hover:bg-blood-700 text-white text-2xl rounded-full shadow-lg transition-all flex items-center justify-center"
      >
        {chatOpen ? "✕" : "🐺"}
      </button>

      {/* Chat Slide-over */}
      {chatOpen && userId && (
        <ChatPanel userId={userId} onClose={() => setChatOpen(false)} />
      )}
    </main>
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

function PackColumn({ cycle, onVerify }: { cycle: Cycle; onVerify: () => void }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          ETH pack
        </div>
        <Badge variant="amber">3 hired</Badge>
      </CardHeader>
      <CardBody className="space-y-4">
        {cycle.specialists.map((s) => (
          <div key={s.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span>{s.emoji}</span>
                <span className="text-xs font-semibold text-void-200">
                  {s.name}
                </span>
                <ZeroGBadge />
              </div>
              <span className="text-xs font-mono text-void-500">${s.price.toFixed(3)}</span>
            </div>
            <CodeBlock>{s.analysis}</CodeBlock>
            <div className="flex items-center gap-2">
              <SealedBadge onClick={onVerify} />
              <span className="text-xs font-mono text-void-600">{s.attestation}</span>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function ChallengeColumn({ cycle, onVerify }: { cycle: Cycle; onVerify: () => void }) {
  const agents = [
    {
      emoji: "🟢",
      name: "Alpha",
      data: cycle.adversarial.alpha,
      recColor: "text-green-400",
    },
    {
      emoji: "🔴",
      name: "Risk",
      data: cycle.adversarial.risk,
      recColor: "text-blood-300",
    },
    {
      emoji: "🟡",
      name: "Executor",
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
        {agents.map(({ emoji, name, data, recColor }) => (
          <div key={name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span>{emoji}</span>
                <span className="text-sm font-semibold text-void-200">
                  {name}
                </span>
              </div>
              <SealedBadge onClick={onVerify} />
            </div>
            <CodeBlock>
              {data.argument}
              <br />
              <span className={`font-semibold ${recColor}`}>{data.recommendation}</span>
            </CodeBlock>
            <div className="flex items-center gap-2">
              <span className="text-xs text-void-500">0G: glm-5-chat</span>
              <span className="text-xs font-mono text-void-600">{data.attestation}</span>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

const INFT_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_INFT_CONTRACT ?? "0x73e3016D0D3Bf2985c55860cd2A51FF017c2c874";
const OG_EXPLORER_BASE = "https://chainscan-galileo.0g.ai";

function RightColumn({
  cycle,
  userInftTokenId,
}: {
  cycle: Cycle;
  userInftTokenId: number | null;
}) {
  const totalCost = cycle.payments.reduce((s, p) => s + p.amount, 0);
  const effectiveInftTokenId = cycle.inftTokenId ?? userInftTokenId ?? null;
  const swap = cycle.swap;

  return (
    <div className="space-y-3">
      {/* Arc Payments */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Arc payments
          </div>
          <Badge variant="blue">USDC</Badge>
        </CardHeader>
        <CardBody className="space-y-2">
          {cycle.payments.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-void-500">
                {p.from} → {p.to}
              </span>
              <span className="font-mono text-void-200">
                ${p.amount.toFixed(3)}
              </span>
            </div>
          ))}
          <hr className="border-void-800 my-1" />
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-void-200">
              Hunt cost:
            </span>
            <span className="font-mono font-bold text-void-100">
              ${totalCost.toFixed(3)}
            </span>
          </div>
          <p className="text-xs text-blue-400">Circle Nanopayments · Gas-free</p>
        </CardBody>
      </Card>

      {/* Arc Execution */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            Arc execution
          </div>
          <Badge variant="indigo">Testnet</Badge>
        </CardHeader>
        <CardBody className="space-y-2">
          {swap ? (
            swap.success && swap.txHash ? (
              <>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-void-600 mb-1">
                    Method
                  </div>
                  <span className="font-mono text-xs text-void-300">
                    {swap.method}
                  </span>
                </div>
                {swap.amountIn && (
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-void-600 mb-1">
                      Amount
                    </div>
                    <span className="font-mono text-xs text-void-200">
                      ${swap.amountIn} USDC
                    </span>
                  </div>
                )}
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-void-600 mb-1">
                    Tx hash
                  </div>
                  <span className="font-mono text-xs text-gold-400 break-all">
                    {swap.txHash.slice(0, 18)}…{swap.txHash.slice(-6)}
                  </span>
                </div>
                {swap.explorerUrl && (
                  <a
                    href={swap.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-indigo-300 hover:underline"
                  >
                    View on ArcScan →
                  </a>
                )}
              </>
            ) : (
              <div className="text-xs text-void-500">
                {swap.method === "skipped"
                  ? `Skipped: ${swap.reason ?? "no allocation required"}`
                  : `Failed: ${swap.reason ?? "unknown error"}`}
              </div>
            )
          ) : (
            <p className="text-xs text-void-600">
              No on-chain execution for this cycle (HOLD or zero allocation).
            </p>
          )}
        </CardBody>
      </Card>

      {/* Hedera Audit */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            Hedera audit
          </div>
        </CardHeader>
        <CardBody>
          <CodeBlock>
            <div className="space-y-1 text-void-500">
              <div>
                Topic:{" "}
                <span className="text-void-200">
                  {cycle.hcs.topicId}
                </span>
              </div>
              <div>
                Seq:{" "}
                <span className="text-void-200">
                  #{cycle.hcs.sequenceNumber}
                </span>{" "}
                · Time: {cycle.hcs.timestamp}
              </div>
              <div className="text-void-600">
                6 attestations · 3 payments · 1 decision
              </div>
            </div>
          </CodeBlock>
          <a
            href={`https://hashscan.io/testnet/topic/${cycle.hcs.topicId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-xs text-teal-400 hover:underline transition-colors"
          >
            Verify on Hashscan →
          </a>
        </CardBody>
      </Card>

      {/* 0G Proof */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
            <span className="w-2 h-2 rounded-full bg-gold-400" />
            0G proof
          </div>
          <ZeroGBadge label="0G Storage + Chain" />
        </CardHeader>
        <CardBody className="space-y-3">
          {/* Storage Hash */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-void-600 mb-1">
              0G Storage root
            </div>
            {cycle.storageHash ? (
              <span className="font-mono text-sm text-gold-400 break-all">
                {cycle.storageHash}
              </span>
            ) : (
              <span className="text-xs text-void-600">Pending commit</span>
            )}
          </div>

          {/* iNFT */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-void-600 mb-1">
              iNFT (ERC-7857)
            </div>
            {effectiveInftTokenId != null ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-gold-400">
                    Token #{effectiveInftTokenId}
                  </span>
                  <Badge variant="green">0G Chain</Badge>
                </div>
                <a
                  href={`${OG_EXPLORER_BASE}/address/${INFT_CONTRACT_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-gold-400 hover:underline"
                >
                  View on 0G Explorer →
                </a>
              </div>
            ) : (
              <span className="text-xs text-void-600">No iNFT minted</span>
            )}
          </div>

          {/* Memory */}
          {cycle.memory.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-void-600 mb-1">
                Pack memory
              </div>
              {cycle.memory.map((m) => (
                <div key={m.cycleRef} className="flex gap-2">
                  <span className="font-mono text-xs text-gold-400 shrink-0 pt-0.5">
                    #{m.cycleRef}
                  </span>
                  <p className="text-xs text-void-500 leading-relaxed">
                    {m.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
