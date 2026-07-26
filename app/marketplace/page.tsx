"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CaretRightIcon, PlusIcon } from "@phosphor-icons/react";
import { CreateAgentModal } from "@/components/create-agent-modal";
import { KernelJobDialog } from "@/components/kernel-job-dialog";
import { EvidenceStatus } from "@/components/ui/evidence";
import { useUser } from "@/contexts/user-context";
import {
  ApiError,
  getAgentLifecycle,
  getOwnerEarnings,
  type AgentLifecycleVersion,
  type OwnerEarningsResponse,
  type ProtectedPublishedAgentRead,
} from "@/lib/api";
import { formatUsdc, formatUsdcAtomic } from "@/lib/format-usdc";

type AgentTab = "available" | "mine" | "drafts";
const AGENT_VIEWS = [
  { value: "available", label: "Available" },
  { value: "mine", label: "Mine" },
  { value: "drafts", label: "Drafts" },
] as const;

export default function MarketplacePage() {
  return <Suspense fallback={<MarketplaceLoading />}><MarketplaceContent /></Suspense>;
}

function MarketplaceContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { authState, isOnboarded } = useUser();
  const requestedView = searchParams.get("view");
  const tab: AgentTab = requestedView === "mine" || requestedView === "drafts" ? requestedView : "available";
  const createOpen = searchParams.get("create") === "1";
  const selectedAgentId = searchParams.get("agentId");
  const ready = authState === "ready" && isOnboarded;
  const lifecycle = useQuery({
    queryKey: ["protected-agent-lifecycle"],
    queryFn: ({ signal }) => getAgentLifecycle(signal),
    enabled: ready,
    retry: false,
  });
  const earnings = useQuery({
    queryKey: ["protected-owner-earnings"],
    queryFn: ({ signal }) => getOwnerEarnings(signal),
    enabled: ready && tab === "mine",
    retry: false,
  });

  const agents = useMemo(() => lifecycle.data?.agents ?? [], [lifecycle.data?.agents]);
  const drafts = lifecycle.data?.drafts ?? [];
  const available = useMemo(() => agents.filter((agent) => !agent.ownedByViewer), [agents]);
  const mine = useMemo(() => agents.filter((agent) => agent.ownedByViewer), [agents]);
  const selected = agents.find((agent) => agent.versionId === selectedAgentId) ?? null;
  const earningsByAgent = useMemo(
    () => new Map((earnings.data?.agents ?? []).map((item) => [item.agentVersionId, item])),
    [earnings.data?.agents],
  );
  const lifecycleHealthy = Boolean(lifecycle.data && !lifecycle.error);

  function replaceQuery(changes: Record<string, string | null>): void {
    router.replace(queryHref(changes), { scroll: false });
  }

  function queryHref(changes: Record<string, string | null>): string {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    return next.size ? `${pathname}?${next.toString()}` : pathname;
  }

  function closeCreate(): void {
    replaceQuery({ create: null });
  }

  function agentHref(agent: ProtectedPublishedAgentRead): string {
    const next = new URLSearchParams(searchParams.toString());
    next.set("agentId", agent.versionId);
    return `${pathname}?${next.toString()}`;
  }

  if (!ready) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
        <p className="instrument-label text-dawg-400">Agents</p>
        <h1 className="mt-3 text-3xl font-semibold text-void-100">Connect and complete SIWE</h1>
        <p className="mt-3 text-sm text-void-400">The protected catalog is not requested before onboarding is ready.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-col gap-4 border-b border-void-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="instrument-label text-dawg-400">Agents</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-void-100">Immutable agent versions</h1>
          <p className="mt-2 text-sm text-void-400">Wallet-authorized publication proves registry eligibility. Runtime proof remains per job.</p>
        </div>
        {lifecycleHealthy ? <Link href={queryHref({ create: "1" })} scroll={false} className="instrument-button instrument-button-primary"><PlusIcon size={17} aria-hidden />Create agent</Link> : <button type="button" disabled className="instrument-button instrument-button-primary"><PlusIcon size={17} aria-hidden />Create unavailable</button>}
      </header>

      <nav aria-label="Agent views" className="mt-5 inline-flex gap-1 rounded-[12px] border border-void-800/70 bg-void-900/50 p-1">
        {AGENT_VIEWS.map(({ value, label }) => (
          <Link key={value} href={queryHref({ view: value, agentId: null })} scroll={false} aria-current={tab === value ? "page" : undefined} className={`inline-flex min-h-9 items-center rounded-[9px] px-4 text-sm font-semibold transition-colors ${tab === value ? "bg-gradient-to-b from-dawg-300 to-dawg-500 text-void-950" : "text-void-400 hover:text-void-100"}`}>
            {label}
          </Link>
        ))}
      </nav>

      {lifecycle.isLoading && <MarketplaceLoading />}
      {lifecycle.error && <div role="alert" className="mt-6 flex items-start justify-between gap-4 border-l-2 border-blood-500 pl-3"><div>{lifecycle.error instanceof ApiError && lifecycle.error.code === "KERNEL_SCHEMA_NOT_READY" ? <><p className="text-sm font-semibold text-blood-300">Database update required</p><p className="mt-1 text-xs leading-relaxed text-void-500">The required wallet-authority migration must be applied by an operator before the protected catalog can load.</p></> : <p className="break-words text-sm text-blood-300">{lifecycle.error.message}</p>}</div><button type="button" onClick={() => void lifecycle.refetch()} className="shrink-0 text-sm font-semibold text-void-200">Retry</button></div>}
      {tab === "mine" && <OwnerEarningsSummary query={earnings} />}
      {!lifecycle.error && lifecycle.data && (
        <section className="mt-5" aria-live="polite">
          <p className="mb-3 text-xs text-void-500">Authenticated protected catalog</p>
          {tab === "available" && <AgentList agents={available} empty="No external canonical versions are available." agentHref={agentHref} />}
          {tab === "mine" && <AgentList agents={mine} empty="You have not published a canonical version." agentHref={agentHref} earningsByAgent={earningsByAgent} earningsReady={Boolean(earnings.data)} earningsPending={earnings.isLoading} />}
          {tab === "drafts" && <DraftList drafts={drafts} />}
        </section>
      )}

      {createOpen && lifecycleHealthy && <CreateAgentModal onClose={closeCreate} onCreated={() => { replaceQuery({ create: null, view: "mine" }); void lifecycle.refetch(); }} />}
      {selected && <KernelJobDialog agent={selected} onClose={() => replaceQuery({ agentId: null })} />}
    </main>
  );
}

function MarketplaceLoading() {
  return <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6"><p role="status" className="border-y border-void-800 py-10 text-center text-sm text-void-400">Loading protected agents…</p></main>;
}

type AgentEarnings = OwnerEarningsResponse["agents"][number];

function OwnerEarningsSummary({ query }: { query: ReturnType<typeof useQuery<OwnerEarningsResponse, Error>> }) {
  if (query.isLoading) return <section aria-label="Owner settled earnings" className="mt-5 rounded-[14px] border border-void-800 bg-void-900/40 p-5"><p role="status" className="text-sm text-void-400">Loading owner-only settled earnings…</p></section>;
  if (query.error) {
    const denied = query.error instanceof ApiError && (query.error.status === 401 || query.error.status === 403);
    return <section aria-label="Owner settled earnings" className="mt-5 rounded-[14px] border border-void-800 bg-void-900/40 p-5"><div role="alert" className="border-l-2 border-blood-500 pl-3"><p className="text-sm text-blood-300">{denied ? "Owner earnings denied. Reauthorize the authenticated creator wallet." : query.error.message}</p><button type="button" onClick={() => void query.refetch()} className="mt-3 text-sm font-semibold text-void-200">Retry earnings</button></div></section>;
  }
  if (!query.data) return null;
  return <section aria-label="Owner settled earnings" className="mt-5 rounded-[14px] border border-void-800 bg-void-900/40 p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="instrument-label text-dawg-400">Owner-only settled earnings</p><p className="mt-2 break-all font-mono text-2xl text-void-100 tnums">{formatUsdcAtomic(query.data.ownerEarningsAtomic)}</p><p className="mt-2 text-xs text-void-500">Finalized receipt-backed external hires only. Creator payout is 100%; platform fee is {formatUsdcAtomic(query.data.platformFeeAtomic)}.</p></div><EvidenceStatus state={query.data.settledHireCount > 0 ? "verified" : "unavailable"} label={query.data.settledHireCount > 0 ? "Settled" : "No settlements"} /></div><dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm"><div><dt className="text-xs text-void-500">Settled hires</dt><dd className="mt-1 font-mono text-void-100">{query.data.settledHireCount}</dd></div><div><dt className="text-xs text-void-500">Last settled</dt><dd className="mt-1 break-all font-mono text-void-300">{query.data.lastSettledAt ?? "None"}</dd></div></dl></section>;
}

function AgentList({ agents, empty, agentHref, earningsByAgent = new Map(), earningsReady = false, earningsPending = false }: { agents: ProtectedPublishedAgentRead[]; empty: string; agentHref: (agent: ProtectedPublishedAgentRead) => string; earningsByAgent?: ReadonlyMap<string, AgentEarnings>; earningsReady?: boolean; earningsPending?: boolean }) {
  if (!agents.length) return <p className="rounded-[14px] border border-dashed border-void-800 py-12 text-center text-sm text-void-500">{empty}</p>;
  return <ul className="grid gap-3">{agents.map((agent) => <AgentRow key={agent.versionId} agent={agent} href={agentHref(agent)} earnings={earningsByAgent.get(agent.versionId) ?? null} earningsReady={earningsReady} earningsPending={earningsPending} />)}</ul>;
}

function AgentRow({ agent, href, earnings, earningsReady, earningsPending }: { agent: ProtectedPublishedAgentRead; href: string; earnings?: AgentEarnings | null; earningsReady?: boolean; earningsPending?: boolean }) {
  const walletPublication = agent.publicationMode === "WALLET";
  const eligible = walletPublication
    ? agent.hireable && agent.authorityState === "WALLET_AUTHORIZED" && agent.canonicalState === "WALLET_AUTHORIZED" && Boolean(agent.agentWallet?.address && agent.agentWallet.evidenceHash && agent.agentWallet.identityHash && agent.walletPublicationDecisionId && agent.walletReceiptHash)
    : agent.hireable && agent.authorityState === "CANONICAL_ENS" && agent.canonicalState === "CANONICAL" && Boolean(agent.fullSubname);
  const identity = walletPublication ? agent.agentWallet?.address : agent.fullSubname;
  const refusal = agent.refusalReason ?? (eligible ? null : walletPublication ? "WALLET_PUBLICATION_EVIDENCE_INCOMPLETE" : "ENS_AUTHORITY_EVIDENCE_INCOMPLETE");
  return (
    <li className="rounded-[16px] border border-void-800 bg-void-900/40 p-5 transition-colors hover:border-void-700">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5"><h2 className="text-lg font-semibold tracking-tight text-void-100">{agent.name}</h2><EvidenceStatus state={eligible ? "verified" : "unavailable"} label={eligible ? "ELIGIBLE" : "REFUSED"} /></div>
          {identity && <p className="mt-1.5 break-all font-mono text-sm text-dawg-300">{walletPublication ? `Agent wallet ${identity}` : identity}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">{agent.capabilities.map((cap) => <span key={cap} className="rounded-full border border-void-800 bg-void-950 px-2.5 py-0.5 text-xs text-void-300">{cap}</span>)}</div>
          <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div><dt className="text-xs font-medium text-void-500">Price / hire</dt><dd className="mt-0.5 font-mono text-void-100 tnums">{formatUsdc(agent.priceAtomic)}</dd></div>
            <div><dt className="text-xs font-medium text-void-500">Verified external hires</dt><dd className="mt-0.5 font-mono text-void-100 tnums">{agent.verifiedExternalHires}</dd></div>
            <div><dt className="text-xs font-medium text-void-500">Version</dt><dd className="mt-0.5 font-mono text-void-300">{agent.version}</dd></div>
            {agent.ownedByViewer && <div className="min-w-0"><dt className="text-xs font-medium text-void-500">Settled earnings</dt><dd className="mt-0.5 break-all font-mono text-void-100 tnums">{earnings ? formatUsdcAtomic(earnings.ownerEarningsAtomic) : earningsReady ? formatUsdcAtomic("0") : earningsPending ? "Loading…" : "Unavailable"}</dd></div>}
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-void-500">Runtime proof and financial outcome remain attached to each job.</p>
          <div className="mt-4 flex flex-wrap gap-2"><EvidenceStatus state={agent.mcpAvailability === "AVAILABLE" ? "verified" : "unavailable"} label={`MCP ${agent.mcpAvailability.toLowerCase()}`} />{agent.provenance && <EvidenceStatus state="verified" label="Provenance recorded" />}</div>
          {refusal && <p className="mt-3 break-words font-mono text-sm text-blood-300">{refusal}</p>}
        </div>
        {agent.ownedByViewer || !eligible ? <button type="button" disabled className="instrument-button instrument-button-primary lg:min-w-36">{agent.ownedByViewer ? "Published by you" : "Hire refused"}</button> : <Link href={href} scroll={false} className="instrument-button instrument-button-primary lg:min-w-36">Hire agent</Link>}
      </div>
      <details className="mt-4 border-t border-void-800/70 pt-1">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 py-2 text-sm text-void-400">{walletPublication ? "Wallet authority and provenance" : "Identity, authority, and provenance"} <CaretRightIcon size={15} aria-hidden /></summary>
        <dl className="grid gap-x-6 gap-y-3 border-t border-void-800 py-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
          {walletPublication ? <><Meta label="Creator wallet" value={agent.ownerWallet} /><Meta label="Agent wallet" value={agent.agentWallet?.address ?? "Unavailable"} /><Meta label="Wallet provider" value={agent.agentWallet?.provider ?? "Unavailable"} /><Meta label="Wallet network" value={agent.agentWallet?.network ?? "Unavailable"} /><Meta label="Account type" value={agent.agentWallet?.accountType ?? "Unavailable"} /><Meta label="Provider state" value={agent.agentWallet?.state ?? "Unavailable"} /><Meta label="Wallet evidence hash" value={agent.agentWallet?.evidenceHash ?? "Unavailable"} /><Meta label="Wallet identity hash" value={agent.agentWallet?.identityHash ?? "Unavailable"} /><Meta label="Wallet publication decision" value={agent.walletPublicationDecisionId ?? "Unavailable"} /><Meta label="Wallet receipt hash" value={agent.walletReceiptHash ?? "Unavailable"} /></> : <><Meta label="Creator ENS" value={agent.creatorParent} /><Meta label="Subname" value={agent.fullSubname} /><Meta label="Authority owner" value={agent.authorityOwner} /></>}
          <Meta label="Owner" value={agent.ownerWallet} />
          <Meta label="Authority" value={agent.authorityState} />
          <Meta label="Delegate" value={agent.authorityDelegate ?? "Unavailable"} />
          <Meta label="Version ID" value={agent.versionId} />
          <Meta label="Price" value={formatUsdcAtomic(agent.priceAtomic)} />
          <Meta label="Manifest hash" value={agent.manifestHash} />
          <Meta label="Release SHA" value={agent.authorityReleaseSha} />
          <Meta label="Published at" value={agent.publishedAt} />
          <Meta label="Capabilities" value={agent.capabilities.join(", ")} />
          <Meta label="Manifest schema" value={String(agent.manifestSchemaVersion)} />
          <Meta label="Skill categories" value={agent.skillSummary?.map((skill) => `${skill.category}: ${skill.id}`).join(", ") || "Unavailable"} />
          <Meta label="Reviewed sources" value={agent.reviewedSources?.map((source) => `${source.repository} ${source.revision} (${source.use})`).join(", ") || "Unavailable"} />
          <Meta label="MCP availability" value={agent.mcpAvailability} />
          <Meta label="MCP bindings" value={agent.mcpSummary?.map((binding) => `${binding.provider}: ${binding.capability}`).join(", ") || "Unavailable"} />
          {agent.provenance ? <><Meta label="Provenance" value={`${agent.provenance.protocol} token ${agent.provenance.tokenId}`} /><Meta label="Provenance evidence" value={agent.provenance.evidenceHash} /><Meta label="Observed" value={agent.provenance.observedAt} /></> : <Meta label="Provenance" value="Unavailable" />}
        </dl>
      </details>
    </li>
  );
}

function DraftList({ drafts }: { drafts: AgentLifecycleVersion[] }) {
  if (!drafts.length) return <p className="rounded-[14px] border border-dashed border-void-800 py-12 text-center text-sm text-void-500">No persisted drafts.</p>;
  return <ul className="grid gap-3">{drafts.map((draft) => <li key={draft.versionId} className="rounded-[16px] border border-void-800 bg-void-900/40 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-void-100">{draft.name}</h2><p className="mt-1 text-sm text-void-400">Draft version {draft.version}. Not published or hireable.</p>{draft.refusalReason && <p className="mt-2 break-words font-mono text-sm text-blood-300">{draft.refusalReason}</p>}</div><EvidenceStatus state="unavailable" label={draft.lifecycleState} /></div><details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm text-void-400">Draft identifiers and approved stack</summary><dl className="grid gap-3 border-t border-void-800 py-4 text-xs sm:grid-cols-2"><Meta label="Creator wallet" value={draft.ownerWallet} />{draft.agentWallet && <><Meta label="Agent wallet" value={draft.agentWallet.address} /><Meta label="Wallet evidence hash" value={draft.agentWallet.evidenceHash} /><Meta label="Wallet identity hash" value={draft.agentWallet.identityHash} /></>}<Meta label="Version ID" value={draft.versionId} /><Meta label="Manifest hash" value={draft.manifestHash} /><Meta label="Manifest schema" value={String(draft.manifestSchemaVersion)} /><Meta label="MCP availability" value={draft.mcpAvailability} /><Meta label="Skills" value={draft.capabilities.join(", ") || "Unavailable"} /><Meta label="MCP bindings" value={draft.mcpSummary?.map((binding) => `${binding.provider}: ${binding.capability}`).join(", ") || "None"} /></dl></details></li>)}</ul>;
}

function Meta({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="font-semibold uppercase tracking-wide text-void-500">{label}</dt><dd className="mt-1 break-all font-mono text-void-300">{value}</dd></div>; }
