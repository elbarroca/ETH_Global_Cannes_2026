"use client";

import type { Cycle } from "@/lib/types";

// Renders the three debate tiers (alpha / risk / executor) with a tiny
// "hires: X, Y" subtitle per tier showing which specialists that agent paid
// for. The hired-by attribution comes from `cycle.specialists[].hiredBy`,
// populated by the hierarchical hiring path in main-agent.ts.
export function DebateColumn({ cycle }: { cycle: Cycle }) {
  const { alpha, risk, executor } = cycle.adversarial;

  const hiresOf = (role: "alpha" | "risk" | "executor"): string[] =>
    cycle.specialists
      .filter((s) => s.hiredBy === role)
      .map((s) => s.name);

  return (
    <div className="space-y-4">
      {/* Alpha */}
      <DebateBox
        role="alpha"
        accent="green"
        label="Alpha Agent"
        primary={alpha.recommendation}
        quote={alpha.argument}
        hires={hiresOf("alpha")}
      />
      <Connector />

      {/* Risk */}
      <DebateBox
        role="risk"
        accent="blood"
        label="Risk Agent"
        primary={risk.recommendation}
        quote={risk.argument}
        hires={hiresOf("risk")}
      />
      <Connector />

      {/* Executor */}
      <DebateBox
        role="executor"
        accent="gold"
        label="Executor"
        primary={executor.recommendation}
        quote={executor.argument}
        hires={hiresOf("executor")}
      />
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center">
      <div className="w-0.5 h-4 bg-void-800" />
    </div>
  );
}

const ACCENT_MAP: Record<string, { border: string; dot: string; label: string }> = {
  green: { border: "border-green-500/30", dot: "bg-green-500", label: "text-green-400" },
  blood: { border: "border-blood-500/30", dot: "bg-blood-500", label: "text-blood-300" },
  gold: { border: "border-gold-400/30", dot: "bg-gold-400", label: "text-gold-400" },
};

function DebateBox({
  role,
  accent,
  label,
  primary,
  quote,
  hires,
}: {
  role: string;
  accent: "green" | "blood" | "gold";
  label: string;
  primary: string;
  quote: string;
  hires: string[];
}) {
  const style = ACCENT_MAP[accent];
  return (
    <div className={`bg-void-900 rounded-xl p-4 border ${style.border}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 ${style.dot} rounded-full`} />
        <span className={`text-xs font-medium ${style.label} uppercase tracking-wider`}>
          {label}
        </span>
      </div>
      <div className="text-lg font-bold text-void-100">{primary}</div>
      {quote && (
        <p className="text-sm text-void-400 mt-2 italic line-clamp-3">&ldquo;{quote}&rdquo;</p>
      )}
      {/* Hired specialists — the visible agent-hiring-economy signal */}
      <div className="mt-2 text-[10px] text-void-600 font-mono">
        {hires.length > 0 ? (
          <>
            hires: <span className={style.label}>{hires.join(", ")}</span>
          </>
        ) : (
          <span className="italic">no specialists hired by {role}</span>
        )}
      </div>
    </div>
  );
}
