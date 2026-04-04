"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardBody, MetricCard, CodeBlock } from "@/components/ui/card";
import { Badge, SealedBadge, LiveBadge, ZeroGBadge } from "@/components/ui/badge";
import { MOCK_FUND, MOCK_CYCLE } from "@/lib/mock-data";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/user-context";
import { triggerCycle, getLatestCycle, type CycleResult } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const { user, userId } = useUser();
  const [running, setRunning] = useState(false);
  const [latestCycle, setLatestCycle] = useState<CycleResult | null>(null);

  // Use real data when available, fallback to mock
  const fund = user ? {
    ...MOCK_FUND,
    nav: user.fund.currentNav,
    totalCycles: user.agent.lastCycleId,
  } : MOCK_FUND;
  const cycle = MOCK_CYCLE;

  useEffect(() => {
    if (userId) {
      getLatestCycle(userId).then(setLatestCycle).catch(() => {});
    }
  }, [userId]);

  async function handleHunt() {
    if (!userId) return;
    setRunning(true);
    try {
      const result = await triggerCycle(userId);
      setLatestCycle(result);
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
          value={`$${fund.nav.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          sub={`+${fund.navChange24h}% (24h)`}
          subColor="text-green-400"
        />
        <MetricCard
          emoji="🔄"
          label="Hunts"
          value={fund.totalCycles.toString()}
          sub="All sealed"
        />
        <MetricCard
          emoji="💸"
          label="Pack spend"
          value={`$${fund.totalSpend.toFixed(2)}`}
          sub={`${fund.totalPayments} payments`}
        />
        <MetricCard
          emoji="🎯"
          label="Win rate"
          value={`${fund.winRate}%`}
          sub="Verified"
        />
        <MetricCard
          emoji="🧠"
          label="0G sealed"
          value={fund.totalInferences.toString()}
          sub="6 per hunt"
          subColor="text-void-500"
        />
      </div>

      {/* Hunt button */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-void-600 uppercase tracking-wider">
          Hunt #{cycle.id} · {new Date(cycle.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </h2>
        <button
          onClick={handleHunt}
          disabled={running}
          className={`flex items-center gap-2 px-6 py-3 bg-blood-600 hover:bg-blood-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors ${running ? "hunting" : ""}`}
        >
          {running ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Hunting…
            </>
          ) : (
            "🐺 Hunt"
          )}
        </button>
      </div>

      {/* Row 2: Three columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Column 1: ETH Pack */}
        <PackColumn cycle={cycle} onVerify={() => router.push("/verify")} />

        {/* Column 2: The Challenge */}
        <ChallengeColumn cycle={cycle} onVerify={() => router.push("/verify")} />

        {/* Column 3: Payments + Audit + Memory */}
        <RightColumn cycle={cycle} />
      </div>

      {/* Row 3: Status bar */}
      <Card>
        <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm text-void-400">
            <span>📱</span>
            <span>Telegram: Connected</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
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

function PackColumn({ cycle, onVerify }: { cycle: typeof MOCK_CYCLE; onVerify: () => void }) {
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

function ChallengeColumn({ cycle, onVerify }: { cycle: typeof MOCK_CYCLE; onVerify: () => void }) {
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

function RightColumn({ cycle }: { cycle: typeof MOCK_CYCLE }) {
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
        </CardBody>
      </Card>
    </div>
  );
}
