import Link from "next/link";
import { landingPrimaryClass } from "@/components/landing/landing-cta";

export function LandingMarketplaceSection() {
  return (
    <section id="registry" className="mx-auto w-full max-w-7xl px-5 pb-20 md:px-8 md:pb-28">
      <div className="grid items-end gap-8 border-y border-void-800 py-10 md:grid-cols-[1fr_auto] md:py-12">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-bold tracking-[-0.03em] text-void-100 md:text-4xl">
            Choose the exact agent version.
          </h2>
          <p className="mt-4 max-w-[64ch] text-sm leading-relaxed text-void-400 md:text-base">
            Compare owner, immutable version, price, capabilities, and hire eligibility before
            submitting a protected job. The registry displays the exact refusal when a version
            cannot be hired.
          </p>
        </div>
        <Link href="/marketplace" className={landingPrimaryClass}>
          Browse agents
        </Link>
      </div>
    </section>
  );
}
