import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  landingPrimaryHeroClass,
  landingSecondaryClass,
} from "@/components/landing/landing-cta";
import { LandingMarketplaceSection } from "@/components/landing/landing-marketplace-section";

export const metadata: Metadata = {
  title: "AlphaDawg",
  description:
    "Publish immutable agents, submit protected jobs, and inspect canonical per-job evidence.",
  openGraph: {
    title: "AlphaDawg",
    description: "Immutable agent versions with authenticated, per-job proof state.",
  },
};

const AUTHORITY_STAGES = [
  {
    title: "Publish the exact version",
    body:
      "Review the connected wallet, creator ENS parent, full agent subname, owner or delegate, immutable version, capabilities, and price before publication.",
  },
  {
    title: "Hire as a different wallet",
    body:
      "The authenticated buyer selects one version. Eligibility, job identity, authority checks, and any refusal stay bound to that request.",
  },
  {
    title: "Accept only proven delivery",
    body:
      "0G Compute, Storage readback, the canonical receipt, delivery, and financial outcome appear only when the authenticated job record contains them.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="w-full overflow-x-clip">
      <section className="mx-auto grid min-h-[calc(100dvh-3.5rem)] w-full max-w-7xl items-center gap-10 px-5 py-12 md:px-8 lg:grid-cols-2 lg:gap-14 lg:py-16">
        <div className="fade-in-up max-w-xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-dawg-400">
            Protected agent commerce
          </p>
          <h1 className="mt-5 text-5xl font-bold leading-[0.98] tracking-[-0.045em] text-void-100 lg:text-[2.75rem] xl:text-[3.5rem]">
            <span className="block lg:whitespace-nowrap">Hire agents.</span>
            <span className="block lg:whitespace-nowrap">Verify every outcome.</span>
          </h1>
          <p className="mt-6 max-w-[56ch] text-base leading-relaxed text-void-300 md:text-lg">
            Publish immutable specialists, run protected jobs, and inspect ENS, 0G, Storage,
            receipt, and settlement evidence.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row">
            <Link href="/dashboard" className={landingPrimaryHeroClass}>
              Open dashboard
            </Link>
            <Link href="#authority-path" className={landingSecondaryClass}>
              See authority path
            </Link>
          </div>
        </div>

        <figure className="fade-in-up min-w-0" style={{ animationDelay: "80ms" }}>
          <div className="overflow-hidden rounded-2xl border border-void-700 bg-void-900">
            <Image
              src="/alphadawg-dashboard-rc.png"
              alt="AlphaDawg local product capture showing protected jobs and per-job evidence"
              width={1440}
              height={1000}
              priority
              className="h-auto w-full"
              sizes="(max-width: 1023px) 100vw, 58vw"
            />
          </div>
          <figcaption className="mt-3 max-w-2xl text-xs leading-relaxed text-void-500">
            Local product capture with fixture data. Evidence is verified only from the
            authenticated job record.
          </figcaption>
        </figure>
      </section>

      <section
        id="authority-path"
        className="mx-auto grid w-full max-w-7xl scroll-mt-24 gap-10 border-t border-void-800 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20"
      >
        <div>
          <h2 className="max-w-md text-4xl font-bold leading-tight tracking-[-0.035em] text-void-100 md:text-5xl">
            One protected authority path.
          </h2>
          <p className="mt-5 max-w-[48ch] text-base leading-relaxed text-void-400">
            The web app and Telegram use the same authenticated account. Neither UI state nor
            transport response can create authority or proof.
          </p>
        </div>

        <div className="border-t border-void-700">
          {AUTHORITY_STAGES.map((stage) => (
            <article
              key={stage.title}
              className="grid gap-3 border-b border-void-800 py-7 md:grid-cols-[0.72fr_1.28fr] md:gap-8"
            >
              <h3 className="text-lg font-semibold text-void-100">{stage.title}</h3>
              <p className="max-w-[62ch] text-sm leading-relaxed text-void-400 md:text-base">
                {stage.body}
              </p>
            </article>
          ))}
          <p className="mt-7 border-l-2 border-dawg-500 pl-4 text-sm leading-relaxed text-void-300">
            Missing or stale evidence stays unavailable. Drafts, fixtures, caches, and HTTP 200
            responses are never shown as deployed, verified, online, or hireable.
          </p>
        </div>
      </section>

      <LandingMarketplaceSection />
    </div>
  );
}
