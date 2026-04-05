import { Fragment } from "react";

/**
 * Hunt pipeline aligned with src/agents/main-agent.ts — user surfaces, proxy spend,
 * marketplace hire, x402, 0G specialists, adversarial debate, audit + memory, output + swap.
 */
const NODES: { key: string; title: string; sub: string; accent: string }[] = [
  {
    key: "user",
    title: "You",
    sub: "Dashboard · Telegram",
    accent: "border-sky-500/40 bg-sky-500/5 text-sky-200",
  },
  {
    key: "proxy",
    title: "Proxy wallet",
    sub: "Circle MPC · spends USDC",
    accent: "border-blood-500/35 bg-blood-950/20 text-blood-200",
  },
  {
    key: "market",
    title: "Marketplace",
    sub: "Hire · query specialists",
    accent: "border-teal-500/40 bg-teal-500/5 text-teal-200",
  },
  {
    key: "x402",
    title: "x402",
    sub: "Nanopay Arc",
    accent: "border-sky-500/40 bg-sky-500/5 text-sky-300",
  },
  {
    key: "spec",
    title: "Specialists",
    sub: "0G sealed TEE",
    accent: "border-violet-500/40 bg-violet-500/5 text-violet-200",
  },
  {
    key: "debate",
    title: "Debate",
    sub: "Alpha · Risk · Executor",
    accent: "border-dawg-500/40 bg-dawg-500/5 text-dawg-200",
  },
  {
    key: "hcs",
    title: "HCS",
    sub: "Hedera audit log",
    accent: "border-emerald-500/40 bg-emerald-500/5 text-emerald-200",
  },
  {
    key: "mem",
    title: "0G memory",
    sub: "Storage · RAG",
    accent: "border-amber-500/40 bg-amber-500/5 text-amber-100",
  },
  {
    key: "out",
    title: "Decision",
    sub: "Trade line · HOLD/BUY/SELL",
    accent: "border-void-600 bg-void-850/40 text-void-200",
  },
  {
    key: "swap",
    title: "Swap",
    sub: "Arc · optional",
    accent: "border-cyan-500/35 bg-cyan-950/20 text-cyan-200",
  },
];

export function LandingArchitectureFlow() {
  return (
    <section id="hunt-flow" className="w-full max-w-6xl mx-auto px-6 mt-12 md:mt-14 scroll-mt-24">
      <div className="text-center mb-8">
        <p className="text-xs font-mono uppercase tracking-widest text-dawg-400 mb-2">Runtime path</p>
        <h2 className="font-pixel text-lg sm:text-xl md:text-2xl text-void-100 uppercase tracking-wide">
          How a hunt flows
        </h2>
        <p className="mt-2 text-sm text-void-500 max-w-2xl mx-auto leading-relaxed">
          Mirrors <span className="font-mono text-void-400">runCycle()</span> in{" "}
          <span className="font-mono text-void-400">src/agents/main-agent.ts</span> — from user intent to
          optional on-chain swap.
        </p>
      </div>

      <div className="rounded-2xl border border-void-800 bg-void-950/60 p-4 md:p-6 shadow-[inset_0_1px_0_rgba(255,199,0,0.05)]">
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-center md:justify-center gap-y-2 md:gap-x-0 md:gap-y-3">
          {NODES.map((n, i) => (
            <Fragment key={n.key}>
              <div
                className={`rounded-xl border px-3 py-3 md:py-3.5 text-center min-w-0 md:max-w-[120px] lg:max-w-[130px] flex-1 md:flex-initial ${n.accent}`}
              >
                <p className="font-pixel text-sm sm:text-base leading-none tracking-wide">{n.title}</p>
                <p className="mt-1.5 text-[9px] sm:text-[10px] font-mono text-void-400 uppercase tracking-wide leading-snug">
                  {n.sub}
                </p>
              </div>
              {i < NODES.length - 1 && (
                <div className="flex items-center justify-center py-0.5 md:py-0 md:px-1 shrink-0 text-void-600 font-mono text-sm md:text-xs lg:text-sm">
                  <span className="md:hidden" aria-hidden>
                    ↓
                  </span>
                  <span className="hidden md:inline" aria-hidden>
                    →
                  </span>
                </div>
              )}
            </Fragment>
          ))}
        </div>
        <p className="mt-4 text-center text-[11px] text-void-600 leading-relaxed">
          Contract IDs and topics are on the Stack page (`/infrastructure`).
        </p>
      </div>
    </section>
  );
}
