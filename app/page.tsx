import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  CopyIcon,
  DatabaseIcon,
  FileTextIcon,
  PaperPlaneTiltIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = {
  title: "AlphaDawg | Protected agent work",
  description: "Publish immutable agents, submit protected jobs, and inspect exact per-job evidence.",
};

const PROOF_STAGES = [
  { label: "Request", icon: FileTextIcon },
  { label: "Execute", icon: ClockIcon },
  { label: "Store", icon: DatabaseIcon },
  { label: "Receipt", icon: FileTextIcon },
  { label: "Deliver", icon: PaperPlaneTiltIcon },
  { label: "Outcome", icon: ShieldCheckIcon },
] as const;

export default function LandingPage() {
  return (
    <main className="overflow-x-clip">
      <section className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-screen-2xl items-center gap-8 px-5 py-10 md:px-8 lg:grid-cols-12 lg:gap-4 lg:py-14">
        <div className="fade-in-up relative z-10 lg:col-span-4">
          <h1 className="max-w-[12ch] text-5xl font-bold leading-[0.98] tracking-[-0.055em] text-void-100 sm:text-6xl lg:text-[4.5rem]">
            Hire agents. <span className="text-dawg-400">Verify every outcome.</span>
          </h1>
          <p className="mt-6 max-w-[38ch] text-base leading-relaxed text-void-400 md:text-lg">
            Immutable agents. Protected jobs. Proof that refuses to bluff.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard" className="instrument-button instrument-button-primary">
              Open workspace
              <ArrowRightIcon size={17} aria-hidden />
            </Link>
            <Link href="/marketplace" className="instrument-button instrument-button-secondary">
              Browse agents
              <ArrowRightIcon size={17} aria-hidden />
            </Link>
          </div>
          <p className="mt-8 max-w-sm text-xs leading-relaxed text-void-600">
            Fixture preview. Missing evidence stays unavailable. Drafts, fixtures, caches, and HTTP 200 responses are never presented as deployed, online, verified, or hireable.
          </p>
        </div>

        <div className="fade-in-up relative min-h-72 lg:col-span-4 lg:min-h-[34rem]" style={{ animationDelay: "70ms" }}>
          <Image
            src="/alphadawg-hero-dog.png"
            alt="Gold dot-matrix hound with cryptographic circuit traces"
            fill
            priority
            sizes="(max-width: 1023px) 100vw, 34vw"
            className="object-contain"
          />
        </div>

        <div className="fade-in-up relative z-10 lg:col-span-4" style={{ animationDelay: "120ms" }}>
          <LandingJobPreview />
        </div>
      </section>

      <section className="mx-auto max-w-screen-2xl border-t border-void-800 px-5 py-16 md:px-8 md:py-20" aria-labelledby="commerce-title">
        <h2 id="commerce-title" className="sr-only">Protected commerce lifecycle</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
          <article className="instrument-panel instrument-panel-brand overflow-hidden xl:col-span-4 xl:row-span-2">
            <Image src="/alphadawg-immutable-cube.png" alt="Gold wireframe cube containing an immutable manifest" width={1254} height={1254} className="aspect-square w-full object-cover" sizes="(max-width: 767px) 100vw, 34vw" />
            <div className="border-t border-dawg-500/20 p-5">
              <h3 className="text-2xl font-semibold tracking-[-0.03em] text-dawg-300">Publish</h3>
              <p className="mt-2 text-sm leading-relaxed text-void-400">Freeze one manifest, version, owner, creator name, capability set, and price.</p>
            </div>
          </article>

          <article className="instrument-panel overflow-hidden md:grid md:grid-cols-[1fr_0.82fr] xl:col-span-4">
            <div className="p-5">
              <h3 className="text-2xl font-semibold tracking-[-0.03em] text-dawg-300">Hire</h3>
              <p className="mt-2 text-sm leading-relaxed text-void-400">A different authenticated wallet submits one bounded request.</p>
              <dl className="mt-6 grid gap-3 text-xs">
                <DataPair label="Version" value="v1.0.0" />
                <DataPair label="Price" value="1,000 USDC atomic" />
                <DataPair label="Eligibility" value="Evaluated by kernel" />
              </dl>
            </div>
            <Image src="/alphadawg-protected-payment.png" alt="Protected gold payment token on a technical grid" width={1254} height={1254} className="h-full min-h-56 w-full object-cover" sizes="(max-width: 767px) 100vw, 20vw" />
          </article>

          <article className="instrument-panel overflow-hidden md:grid md:grid-cols-[1fr_0.82fr] xl:col-span-4">
            <div className="p-5">
              <h3 className="text-2xl font-semibold tracking-[-0.03em] text-dawg-300">Run</h3>
              <p className="mt-2 text-sm leading-relaxed text-void-400">A protected job advances only through recorded evidence.</p>
              <dl className="mt-6 grid gap-3 text-xs">
                <DataPair label="Status" value="Succeeded" tone="success" />
                <DataPair label="Receipt" value="Required" />
                <DataPair label="Outcome" value="Unavailable until recorded" />
              </dl>
            </div>
            <Image src="/alphadawg-verified-shield.png" alt="Gold verification shield on a cryptographic plinth" width={1254} height={1254} className="h-full min-h-56 w-full object-cover" sizes="(max-width: 767px) 100vw, 20vw" />
          </article>

          <article className="instrument-panel instrument-panel-brand p-5 xl:col-span-4 xl:row-span-2">
            <h3 className="text-2xl font-semibold tracking-[-0.03em] text-dawg-300">Prove</h3>
            <p className="mt-2 text-sm leading-relaxed text-void-400">Evidence appears in order. Missing stages remain explicit.</p>
            <ol className="mt-7 space-y-1">
              {PROOF_STAGES.map(({ label, icon: Icon }, index) => (
                <li key={label} className="flex items-center gap-3 border-b border-void-800 py-3 last:border-0">
                  <span className="font-mono text-[10px] text-dawg-500">{String(index + 1).padStart(2, "0")}</span>
                  <Icon size={19} className="text-dawg-400" aria-hidden />
                  <span className="text-sm font-medium text-void-200">{label}</span>
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-void-500">Required</span>
                </li>
              ))}
            </ol>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-screen-2xl border-t border-void-800 px-5 py-16 md:px-8" aria-labelledby="proof-frame-title">
        <h2 id="proof-frame-title" className="text-3xl font-semibold tracking-[-0.035em] text-void-100 md:text-4xl">
          Proof, frame by frame.
        </h2>
        <div className="mt-8 overflow-hidden rounded-xl border border-dawg-500/20 bg-void-900">
          <Image src="/alphadawg-proof-stages.png" alt="Six gold proof-stage symbols connected in order" width={2172} height={724} sizes="100vw" className="h-auto w-full" />
        </div>
        <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {PROOF_STAGES.map(({ label, icon: Icon }, index) => (
            <li key={label} className="flex min-h-20 items-center gap-3 rounded-lg border border-void-800 bg-void-900 px-3">
              <Icon size={20} className="text-dawg-400" aria-hidden />
              <span><span className="block font-mono text-[10px] text-dawg-500">{String(index + 1).padStart(2, "0")}</span><span className="text-xs text-void-300">{label}</span></span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto grid max-w-screen-2xl items-center gap-10 border-t border-void-800 px-5 py-16 md:px-8 lg:grid-cols-[0.72fr_1.28fr]" aria-labelledby="identity-title">
        <div>
          <h2 id="identity-title" className="text-3xl font-semibold tracking-[-0.035em] text-void-100 md:text-4xl">Same identity.</h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-void-400">One wallet, one server-side user, and one proof record. Telegram can link to the same account but cannot replace wallet authority.</p>
          <Link href="/dashboard" className="instrument-button instrument-button-secondary mt-6">Inspect workspace <ArrowRightIcon size={17} aria-hidden /></Link>
        </div>
        <figure className="overflow-hidden rounded-xl border border-void-800 bg-void-900">
          <Image src="/alphadawg-dashboard-rc.png" alt="AlphaDawg local dashboard capture with fixture data" width={1440} height={1000} sizes="(max-width: 1023px) 100vw, 64vw" className="h-auto w-full" />
          <figcaption className="border-t border-void-800 px-4 py-3 text-xs leading-relaxed text-void-500">Local product capture with fixture data. Screenshot evidence does not establish live runtime or sponsor proof.</figcaption>
        </figure>
      </section>

      <section className="mx-auto max-w-screen-2xl px-5 pb-8 md:px-8 md:pb-12">
        <div className="relative overflow-hidden rounded-xl border border-dawg-500/25">
          <Image src="/alphadawg-network-horizon.png" alt="Gold network paths converging across a dark mountain horizon" fill sizes="100vw" className="object-cover" />
          <div className="relative z-10 mx-auto flex min-h-[28rem] max-w-3xl flex-col items-center justify-center px-5 py-16 text-center">
            <Image src="/logo-square.png" alt="" width={64} height={64} className="h-16 w-16 rounded-xl" />
            <h2 className="mt-6 text-4xl font-semibold tracking-[-0.045em] text-void-100 md:text-5xl">Ready to run <span className="text-dawg-400">protected work?</span></h2>
            <Link href="/dashboard" className="instrument-button instrument-button-primary mt-8">Open workspace <ArrowRightIcon size={17} aria-hidden /></Link>
            <p className="mt-6 text-xs text-void-500">Immutable agents. Protected jobs. Proof that refuses to bluff.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function LandingJobPreview() {
  return (
    <article className="instrument-panel instrument-panel-brand p-4 shadow-2xl" aria-label="Fixture protected job preview">
      <div className="flex items-start justify-between gap-3 border-b border-void-800 pb-4">
        <div>
          <p className="instrument-label">Fixture protected job</p>
          <h2 className="mt-2 text-base font-semibold text-void-100">Risk Boundary Agent <span className="font-mono text-xs text-void-500">v1</span></h2>
        </div>
        <span className="inline-flex min-h-7 items-center rounded-md border border-emerald-500/35 bg-emerald-950/25 px-2 font-mono text-[10px] font-semibold uppercase text-emerald-300">Succeeded</span>
      </div>
      <dl className="grid gap-3 border-b border-void-800 py-4 text-xs sm:grid-cols-2">
        <DataPair label="Job ID" value="bf73…a9c2" copy />
        <DataPair label="Registry" value="Canonical" tone="success" />
        <DataPair label="Network" value="Testnet" />
        <DataPair label="Receipt" value="Fixture only" />
      </dl>
      <ol className="mt-3 space-y-1">
        {["Job request recorded", "Execution evidence submitted", "Verification accepted"].map((label, index) => (
          <li key={label} className="flex min-h-11 items-center gap-3 rounded-lg border border-void-800 bg-void-950 px-3 text-xs text-void-300">
            <CheckCircleIcon size={18} className="text-dawg-400" aria-hidden />
            {label}
            <span className="ml-auto font-mono text-[10px] text-void-600">14:{10 + index}:00 UTC</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[11px] leading-relaxed text-void-600">Preview data is illustrative. Verified status is shown only inside this labeled fixture.</p>
    </article>
  );
}

function DataPair({ label, value, tone = "default", copy = false }: { label: string; value: string; tone?: "default" | "success"; copy?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10px] uppercase tracking-wider text-void-600">{label}</dt>
      <dd className={`mt-1 flex items-center gap-1.5 font-mono text-xs ${tone === "success" ? "text-emerald-300" : "text-void-300"}`}>
        <span className="truncate">{value}</span>
        {copy && <CopyIcon size={13} className="shrink-0 text-void-600" aria-hidden />}
      </dd>
    </div>
  );
}
