"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardBody, MetricCard, CodeBlock } from "@/components/ui/card";
import { Badge, SealedBadge, LiveBadge, ZeroGBadge } from "@/components/ui/badge";
import { mapCycleResultToCycle, mapCompactRecordToCycle } from "@/lib/cycle-mapper";
import type { Cycle } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/user-context";
import { triggerCycle, getLatestCycle } from "@/lib/api";

const STAGES = [
  "Hiring specialists from marketplace...",
  "Running adversarial debate (Alpha \u2192 Risk \u2192 Executor)...",
  "Logging decision to Hedera HCS...",
  "Storing memory to 0G decentralized storage...",
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, userId, linkCode } = useUser();
  const [running, setRunning] = useState(false);
  const [liveCycle, setLiveCycle] = useState<Cycle | null>(null);
  const [stageIdx, setStageIdx] = useState(0);

  // Compute fund stats from user state only — no mock data
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

  // Fetch latest cycle on mount
  useEffect(() => {
    if (userId) {
      getLatestCycle(userId).then((record) => {
        if (record) setLiveCycle(mapCompactRecordToCycle(record));
      }).catch(() => {});
    }
  }, [userId]);

  // Cycle through stage messages while running
  useEffect(() => {
    if (!running) { setStageIdx(0); return; }
    const timer = setInterval(() => {
      setStageIdx((s) => (s + 1) % STAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [running]);

  async function handleHunt() {
    if (!userId) return;
    setRunning(true);
    setStageIdx(0);
    try {
      const result = await triggerCycle(userId);
      setLiveCycle(mapCycleResultToCycle(result));
    } catch (err) {
      console.warn("[dashboard] Hunt failed:", err);
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="max-w-7xl mx-auto px-5 py-5 space-y-3">
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

      {/* Hunt button */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-void-600 uppercase tracking-wider">
          {cycle
            ? `Hunt #${cycle.id} \u00b7 ${new Date(cycle.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
            : "Ready to hunt"}
        </h2>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleHunt}
            disabled={running}
            className={`flex items-center gap-2 px-6 py-3 bg-blood-600 hover:bg-blood-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors ${running ? "hunting" : ""}`}
          >
            {running ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Hunting\u2026
              </>
            ) : (
              "\uD83D\uDC3A Hunt"
            )}
          </button>
          {running && (
            <p className="text-xs text-void-500 animate-pulse">{STAGES[stageIdx]}</p>
          )}
        </div>
      </div>

      {/* Row 2: Three columns */}
      {cycle ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PackColumn cycle={cycle} onVerify={() => router.push("/verify")} />
          <ChallengeColumn cycle={cycle} onVerify={() => router.push("/verify")} />
          <RightColumn cycle={cycle} />
        </div>
      ) : (
        <Card>
          <CardBody className="text-center py-12 space-y-3">
            <p className="text-void-400 text-sm">No hunts yet. Click Hunt to trigger your first cycle.</p>
            <p className="text-void-600 text-xs">
              Your agent will hire 3 specialists, run adversarial debate, and log everything on-chain.
            </p>
          </CardBody>
        </Card>
      )}

      {/* Row 3: Status bar */}
      <Card>
        <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm text-void-400">
            <span>📱</span>
            {user?.telegram?.verified ? (
              <>
                <span>Telegram: Connected</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </>
            ) : linkCode ? (
              <>
                <span>Link Telegram:</span>
                <a
                  href={`https://t.me/AlphaDawgBot?start=${linkCode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline font-mono text-xs"
                >
                  t.me/AlphaDawgBot?start={linkCode}
                </a>
              </>
            ) : (
              <>
                <span>Telegram: Not linked</span>
                <span className="w-1.5 h-1.5 rounded-full bg-void-600" />
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="gray">0G Sealed</Badge>
            <Badge variant="gray">Hedera HCS</Badge>
            <Badge variant="gray">Arc Nano</Badge>
          </div>
        </div>
      </Card>
    </main>
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

function RightColumn({ cycle }: { cycle: Cycle }) {
  const totalCost = cycle.payments.reduce((s, p) => s + p.amount, 0);

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

      {/* Pack Memory */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
            <span className="w-2 h-2 rounded-full bg-gold-400" />
            Pack memory
          </div>
          <ZeroGBadge label="0G Storage" />
        </CardHeader>
        <CardBody className="space-y-2.5">
          {cycle.memory.length > 0 ? cycle.memory.map((m) => (
            <div key={m.cycleRef} className="flex gap-2">
              <span className="font-mono text-xs text-gold-400 shrink-0 pt-0.5">
                #{m.cycleRef}
              </span>
              <p className="text-xs text-void-500 leading-relaxed">
                {m.text}
              </p>
            </div>
          )) : (
            <p className="text-xs text-void-600">Memory builds over cycles.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
