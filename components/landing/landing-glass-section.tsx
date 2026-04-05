import Link from "next/link";
import { landingPrimaryClass } from "@/components/landing/landing-cta";

const TRACK_BADGES = ["0G Compute & Storage", "Hedera HCS / HTS", "Arc x402", "OpenClaw agents", "Naryo feed"] as const;

export function LandingGlassSection() {
  return (
    <section
      id="glass-box"
      className="w-full max-w-4xl mx-auto px-6 pt-8 pb-4 scroll-mt-24"
    >
      <div className="rounded-2xl border border-void-800 bg-gradient-to-b from-void-900/90 to-void-950/95 px-6 py-10 md:px-10 md:py-12 text-center shadow-[0_0_80px_-20px_rgba(255,199,0,0.12)]">
        <p className="text-xs font-mono uppercase tracking-widest text-dawg-400 mb-4">The thesis</p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-void-100 tracking-tight leading-tight">
          Glass box,{" "}
          <span className="text-void-500 font-normal">not black box</span>
        </h2>
        <p className="mt-6 text-base md:text-lg text-void-400 max-w-2xl mx-auto leading-relaxed">
          AlphaDawg is an <span className="text-void-300">agent hiring economy</span>: autonomous specialists,
          nanopayment settlement on Arc, and audit trails on Hedera and 0G you can verify in one click — built for
          hackathon tracks that reward <span className="text-void-300">real integrations</span>, not slideware.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {TRACK_BADGES.map((b) => (
            <span
              key={b}
              className="inline-flex items-center rounded-lg border border-void-700/80 bg-void-950/60 px-3 py-1.5 text-[11px] font-mono text-void-400 uppercase tracking-wide"
            >
              {b}
            </span>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className={landingPrimaryClass}>
            Open dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
