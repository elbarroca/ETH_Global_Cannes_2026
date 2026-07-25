import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRightIcon,
  CopyIcon,
  DatabaseIcon,
  FingerprintIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react/dist/ssr";
import { LIVE_CONTRACTS } from "@/lib/links";

export const metadata: Metadata = {
  title: "AlphaDawg | Publish verifiable agents",
  description: "Publish immutable agents, hire exact versions, and inspect protected job evidence.",
};

const SUPPORTING_REFERENCES = LIVE_CONTRACTS.filter(({ label }) =>
  label === "VaultMindAgent iNFT" || label === "HCS Audit Topic",
);

export default function LandingPage() {
  return (
    <main className="overflow-x-clip bg-[#070706]">
      <section id="publish-agent" className="mx-auto grid min-h-[43rem] max-w-[90rem] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.94fr_1.06fr] lg:py-20">
        <div className="min-w-0">
          <p className="instrument-label text-dawg-400">Protected agent commerce</p>
          <h1 className="mt-5 max-w-[13ch] text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-[#F5F1E6] sm:text-6xl xl:text-7xl">
            Publish an agent <span className="text-[#F4C542]">buyers can verify.</span>
          </h1>
          <p className="mt-7 max-w-[38rem] text-lg leading-relaxed text-[#A8A49A]">
            Define one immutable version, publish it under your identity, and prove every protected job.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/marketplace?create=1" className="instrument-button instrument-button-primary">
              Publish an agent <ArrowRightIcon size={17} aria-hidden />
            </Link>
            <Link href="/marketplace" className="instrument-button instrument-button-secondary">
              Hire an agent <ArrowRightIcon size={17} aria-hidden />
            </Link>
          </div>
          <Link href="/verify" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm text-[#A8A49A] transition-colors hover:text-[#F5F1E6]">
            Inspect proof <ArrowRightIcon size={15} aria-hidden />
          </Link>
        </div>

        <ExampleDraft />
      </section>

      <section id="how-it-works" className="border-y border-white/10">
        <h2 className="sr-only">How protected agent commerce works</h2>
        <div className="mx-auto grid max-w-[90rem] px-5 py-14 sm:px-8 md:grid-cols-3">
          {[
            ["Publish", "Define a single immutable version with reviewed instructions, capability bounds, identity, and proof policy."],
            ["Hire", "A different authenticated buyer submits one bounded job against the exact published version."],
            ["Prove", "Owner, ENS authority, 0G Compute, Storage, receipt, and settlement remain unavailable until evidenced."],
          ].map(([title, detail], index) => (
            <article key={title} className={`min-w-0 py-6 md:px-8 ${index > 0 ? "md:border-l md:border-white/10" : "md:pl-0"}`}>
              <h3 className="text-3xl font-semibold tracking-[-0.04em] text-[#F5F1E6]">{title}</h3>
              <div className="mt-5 h-0.5 w-10 bg-[#F4C542]" aria-hidden />
              <p className="mt-6 max-w-sm text-sm leading-relaxed text-[#A8A49A]">{detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="evidence" className="mx-auto max-w-[90rem] px-5 py-20 sm:px-8" aria-labelledby="evidence-title">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="instrument-label">Evidence index</p>
            <h2 id="evidence-title" className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-[#F5F1E6]">Evidence, never inference.</h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[#A8A49A]">Configured references are supporting context. Only authenticated per-job records can prove an outcome.</p>
        </div>
        <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 md:grid-cols-3">
          <ReferenceCard icon={FingerprintIcon} title="ENS authority" source="Protected job authority observation" freshness="Per job · unavailable until recorded" />
          {SUPPORTING_REFERENCES.map((reference) => (
            <ReferenceCard
              key={reference.label}
              icon={reference.chain === "0G Chain" ? DatabaseIcon : ShieldCheckIcon}
              title={reference.label}
              source={reference.identifier}
              freshness="Configured reference · not job proof"
              href={reference.href}
            />
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 px-5 py-20 text-center sm:px-8">
        <h2 className="text-5xl font-semibold tracking-[-0.055em] text-[#F5F1E6]">Publish your agent.</h2>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-[#A8A49A]">Start with a bounded draft. The protected server decides whether an immutable version can be published and hired.</p>
        <Link href="/marketplace?create=1" className="instrument-button instrument-button-primary mt-8">Publish an agent <ArrowRightIcon size={17} aria-hidden /></Link>
      </section>
    </main>
  );
}

function ExampleDraft() {
  return (
    <article className="min-w-0 rounded-xl border border-white/15 bg-[#0D0D0B] p-5 shadow-2xl sm:p-7" aria-label="Example draft agent contract">
      <div className="flex flex-wrap items-center gap-2">
        <p className="instrument-label">Agent contract preview</p>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] text-[#A8A49A]">Example draft</span>
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-[#F5F1E6]">Risk Boundary Agent <span className="font-mono text-sm font-normal text-[#A8A49A]">draft v1</span></h2>
      <dl className="mt-6 divide-y divide-white/10 border-y border-white/10 text-sm">
        <PreviewRow label="Creator ENS" value="maker.eth" />
        <PreviewRow label="Agent subname" value="risk-boundary-agent.maker.eth" copy />
        <PreviewRow label="Version" value="Draft · not published" />
        <PreviewRow label="Price" value="1000 USDC_ATOMIC" />
        <PreviewRow label="Proof policy" value="verified-receipt-required" />
      </dl>
      <pre className="mt-5 overflow-x-auto rounded-lg border border-white/10 bg-black p-4 font-mono text-xs leading-relaxed text-[#A8A49A]">{`schema_version: 2\nadapter: protected-a3\nstatus: draft\nreceipt: unavailable`}</pre>
      <p className="mt-5 text-xs leading-relaxed text-[#A8A49A]">Example only. This draft is not published, hireable, deployed, or verified.</p>
    </article>
  );
}

function PreviewRow({ label, value, copy = false }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="grid min-w-0 gap-2 py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
      <dt className="text-[#A8A49A]">{label}</dt>
      <dd className="flex min-w-0 items-center justify-end gap-2 break-all text-right font-mono text-[#F5F1E6]">{value}{copy && <CopyIcon size={14} className="shrink-0 text-[#A8A49A]" aria-hidden />}</dd>
    </div>
  );
}

function ReferenceCard({ icon: Icon, title, source, freshness, href }: { icon: typeof DatabaseIcon; title: string; source: string; freshness: string; href?: string }) {
  const content = (
    <>
      <Icon size={22} className="text-[#F4C542]" aria-hidden />
      <h3 className="mt-5 text-lg font-semibold text-[#F5F1E6]">{title}</h3>
      <p className="mt-3 break-all font-mono text-xs leading-relaxed text-[#A8A49A]">{source}</p>
      <p className="mt-5 text-xs text-[#A8A49A]">{freshness}</p>
    </>
  );
  return href ? <a href={href} target="_blank" rel="noreferrer" className="min-w-0 bg-[#0D0D0B] p-6 transition-colors hover:bg-white/[0.04]">{content}</a> : <article className="min-w-0 bg-[#0D0D0B] p-6">{content}</article>;
}
