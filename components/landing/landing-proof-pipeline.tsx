/**
 * Visual “what we built” strip — chain + integration story without extra deps.
 */

const STEPS: {
  key: string;
  title: string;
  sub: string;
  accent: string;
}[] = [
  {
    key: "pack",
    title: "Pack",
    sub: "Marketplace + hire graph",
    accent: "border-teal-500/40 bg-teal-500/5 text-teal-300",
  },
  {
    key: "x402",
    title: "x402",
    sub: "Arc nanopayments",
    accent: "border-sky-500/40 bg-sky-500/5 text-sky-300",
  },
  {
    key: "og",
    title: "0G",
    sub: "Sealed inference + storage",
    accent: "border-violet-500/40 bg-violet-500/5 text-violet-300",
  },
  {
    key: "debate",
    title: "TEE",
    sub: "Alpha · Risk · Exec",
    accent: "border-dawg-500/40 bg-dawg-500/5 text-dawg-300",
  },
  {
    key: "hcs",
    title: "HCS",
    sub: "Hedera audit log",
    accent: "border-emerald-500/40 bg-emerald-500/5 text-emerald-300",
  },
  {
    key: "mem",
    title: "RAG",
    sub: "Prior hunts → context",
    accent: "border-amber-500/40 bg-amber-500/5 text-amber-200",
  },
];

export function LandingProofPipeline() {
  return (
    <section className="w-full max-w-5xl mx-auto px-6 mt-16 md:mt-20">
      <div className="text-center mb-8 md:mb-10">
        <p className="text-xs font-mono uppercase tracking-widest text-dawg-400 mb-2">What we wired</p>
        <h2 className="font-pixel text-xl sm:text-2xl md:text-3xl text-void-100 uppercase tracking-wide">
          End-to-end proof, not slides
        </h2>
        <p className="mt-3 text-sm text-void-500 max-w-xl mx-auto leading-relaxed">
          Integration map — same stack as the{" "}
          <a href="#hunt-flow" className="text-dawg-400 hover:underline">
            hunt flow
          </a>{" "}
          above, as wired in code.
        </p>
      </div>

      <div className="relative rounded-2xl border border-void-800 bg-void-950/80 overflow-hidden p-4 md:p-6 shadow-[inset_0_1px_0_rgba(255,199,0,0.06)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `linear-gradient(90deg, transparent 0%, transparent 49%, rgba(255,199,0,0.4) 50%, transparent 51%, transparent 100%)`,
            backgroundSize: "14px 100%",
          }}
        />
        <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {STEPS.map((s) => (
            <div
              key={s.key}
              className={`rounded-xl border px-2 py-3 sm:px-3 sm:py-4 text-center min-w-0 ${s.accent}`}
            >
              <p className="font-pixel text-base sm:text-lg md:text-xl leading-none tracking-wider truncate">
                {s.title}
              </p>
              <p className="mt-1.5 text-[9px] sm:text-[10px] font-mono text-void-400 leading-snug uppercase tracking-wide">
                {s.sub}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
