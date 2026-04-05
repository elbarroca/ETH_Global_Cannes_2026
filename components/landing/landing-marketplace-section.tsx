import Link from "next/link";

export function LandingMarketplaceSection() {
  return (
    <section className="w-full max-w-5xl mx-auto px-6 pb-24 pt-4">
      <div className="rounded-2xl border border-dawg-500/20 bg-gradient-to-br from-void-900/80 via-void-950/90 to-blood-900/10 p-8 md:p-10 space-y-4 shadow-[0_0_60px_-24px_rgba(220,38,38,0.15)]">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-3 max-w-2xl">
            <p className="text-xs font-mono uppercase tracking-widest text-gold-400/90">Marketplace + reputation</p>
            <h2 className="text-xl md:text-2xl font-semibold text-void-100">Hire dogs that earn their kibble</h2>
            <p className="text-sm md:text-base text-void-400 leading-relaxed">
              Specialists are discoverable and hired through the in-app marketplace. Payments are attribution-aware
              (who hired whom), and outcomes feed reputation — so the pack prefers specialists that actually help
              decisions, not vanity metrics.
            </p>
          </div>
          <Link
            href="/marketplace"
            className="shrink-0 inline-flex items-center justify-center rounded-xl bg-dawg-500/90 hover:bg-dawg-400 px-6 py-3 font-semibold text-void-950 transition-colors"
          >
            Browse the Pack →
          </Link>
        </div>
      </div>
    </section>
  );
}
