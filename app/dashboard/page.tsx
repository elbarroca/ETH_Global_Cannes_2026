"use client";

import { useState } from "react";
import { Card, CardHeader, CardBody, MetricCard, CodeBlock } from "@/components/ui/card";
import { Badge, SealedBadge, LiveBadge, ZeroGBadge } from "@/components/ui/badge";
import { MOCK_FUND, MOCK_CYCLE } from "@/lib/mock-data";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const fund = MOCK_FUND;
  const cycle = MOCK_CYCLE;

  async function handleRunCycle() {
    setRunning(true);
    await new Promise((r) => setTimeout(r, 2000));
    setRunning(false);
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-5 space-y-3">
      {/* Row 1: Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard
          emoji="💰"
          label="Fund NAV"
          value={`$${fund.nav.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
          sub={`+${fund.navChange24h}% (24h)`}
          subColor="text-emerald-500"
        />
        <MetricCard
          emoji="🔄"
          label="Cycles"
          value={fund.totalCycles.toString()}
          sub="All verified"
        />
        <MetricCard
          emoji="💸"
          label="Agent spend"
          value={`$${fund.totalSpend.toFixed(2)}`}
          sub={`${fund.totalPayments} payments`}
        />
        <MetricCard
          emoji="🎯"
          label="Win rate"
          value={`${fund.winRate}%`}
          sub="Sealed proofs"
        />
        <MetricCard
          emoji="🧠"
          label="0G inferences"
          value={fund.totalInferences.toString()}
          sub="6 per cycle"
        />
      </div>

      {/* Run cycle button */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Cycle #{cycle.id} · {new Date(cycle.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </h2>
        <button
          onClick={handleRunCycle}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {running ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Running…
            </>
          ) : (
            "▶ Run Cycle"
          )}
        </button>
      </div>

      {/* Row 2: Three columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Column 1: ETH Swarm */}
        <SwarmColumn cycle={cycle} onVerify={() => router.push("/verify")} />

        {/* Column 2: Adversarial Debate */}
        <DebateColumn cycle={cycle} onVerify={() => router.push("/verify")} />

        {/* Column 3: Payments + Audit + Memory */}
        <RightColumn cycle={cycle} />
      </div>

      {/* Row 3: Status bar */}
      <Card>
        <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>📱</span>
            <span>Telegram: Connected</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="purple">0G Sealed Inference</Badge>
            <Badge variant="blue">Hedera HCS</Badge>
            <Badge variant="blue">Arc Nanopayments</Badge>
          </div>
        </div>
      </Card>
    </main>
  );
}

// ─── Column components ────────────────────────────────────────────────────────

function SwarmColumn({ cycle, onVerify }: { cycle: typeof MOCK_CYCLE; onVerify: () => void }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          ETH swarm
        </div>
        <Badge variant="amber">3 hired</Badge>
      </CardHeader>
      <CardBody className="space-y-4">
        {cycle.specialists.map((s) => (
          <div key={s.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span>{s.emoji}</span>
                <span className="text-sm font-medium text-gray-800">
                  {s.name}
                </span>
                <ZeroGBadge />
              </div>
              <span className="text-xs font-mono text-gray-400">${s.price.toFixed(3)}</span>
            </div>
            <CodeBlock>{s.analysis}</CodeBlock>
            <div className="flex items-center gap-2">
              <SealedBadge onClick={onVerify} />
              <span className="text-xs font-mono text-gray-400">{s.attestation}</span>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function DebateColumn({ cycle, onVerify }: { cycle: typeof MOCK_CYCLE; onVerify: () => void }) {
  const agents = [
    {
      emoji: "🟢",
      name: "Alpha",
      data: cycle.adversarial.alpha,
      recColor: "text-emerald-600",
    },
    {
      emoji: "🔴",
      name: "Risk",
      data: cycle.adversarial.risk,
      recColor: "text-red-500",
    },
    {
      emoji: "🟡",
      name: "Executor",
      data: cycle.adversarial.executor,
      recColor: "text-amber-600",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          Adversarial debate
        </div>
        <LiveBadge />
      </CardHeader>
      <CardBody className="space-y-4">
        {agents.map(({ emoji, name, data, recColor }) => (
          <div key={name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span>{emoji}</span>
                <span className="text-sm font-medium text-gray-800">
                  {name}
                </span>
              </div>
              <SealedBadge onClick={onVerify} />
            </div>
            <CodeBlock>
              {data.argument}
              <br />
              <span className={`font-bold ${recColor}`}>{data.recommendation}</span>
            </CodeBlock>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">0G: glm-5-chat</span>
              <span className="text-xs font-mono text-gray-400">{data.attestation}</span>
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
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Arc payments
          </div>
        </CardHeader>
        <CardBody className="space-y-2">
          {cycle.payments.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {p.from} → {p.to}
              </span>
              <span className="font-mono text-gray-700">
                ${p.amount.toFixed(3)}
              </span>
            </div>
          ))}
          <hr className="border-gray-100 my-1" />
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">
              Cycle cost:
            </span>
            <span className="font-mono font-bold text-gray-900">
              ${totalCost.toFixed(3)}
            </span>
          </div>
          <p className="text-xs text-blue-500">Circle Nanopayments · Gas-free</p>
        </CardBody>
      </Card>

      {/* Hedera Audit */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            Hedera audit
          </div>
        </CardHeader>
        <CardBody>
          <CodeBlock>
            <div className="space-y-1 text-gray-500">
              <div>
                Topic:{" "}
                <span className="text-gray-800">
                  {cycle.hcs.topicId}
                </span>
              </div>
              <div>
                Seq:{" "}
                <span className="text-gray-800">
                  #{cycle.hcs.sequenceNumber}
                </span>{" "}
                · Time: {cycle.hcs.timestamp}
              </div>
              <div className="text-gray-400">
                6 attestations · 3 payments · 1 decision
              </div>
            </div>
          </CodeBlock>
          <a
            href={`https://hashscan.io/testnet/topic/${cycle.hcs.topicId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-xs text-blue-500 hover:text-blue-600 transition-colors"
          >
            Verify on Hashscan →
          </a>
        </CardBody>
      </Card>

      {/* Agent Memory */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Agent memory
          </div>
          <ZeroGBadge label="0G Storage" />
        </CardHeader>
        <CardBody className="space-y-2.5">
          {cycle.memory.map((m) => (
            <div key={m.cycleRef} className="flex gap-2">
              <span className="font-mono text-xs text-purple-600 shrink-0 pt-0.5">
                #{m.cycleRef}
              </span>
              <p className="text-xs text-gray-500 leading-relaxed">
                {m.text}
              </p>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
