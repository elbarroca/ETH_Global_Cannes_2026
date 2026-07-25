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
  getAgentLifecycle,
  type AgentLifecycleVersion,
  type ProtectedPublishedAgentRead,
} from "@/lib/api";
import { formatUsdcAtomic } from "@/lib/format-usdc";

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

  const agents = useMemo(() => lifecycle.data?.agents ?? [], [lifecycle.data?.agents]);
  const drafts = lifecycle.data?.drafts ?? [];
  const available = useMemo(() => agents.filter((agent) => !agent.ownedByViewer), [agents]);
  const mine = useMemo(() => agents.filter((agent) => agent.ownedByViewer), [agents]);
  const ownedCreatorParents = useMemo(
    () => [...new Set(mine.filter((agent) => agent.canonicalState === "CANONICAL").map((agent) => agent.creatorParent.trim()).filter(Boolean))],
    [mine],
  );
  const defaultCreatorParent = ownedCreatorParents[0] ?? null;
  const selected = agents.find((agent) => agent.versionId === selectedAgentId) ?? null;

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
          <p className="mt-2 text-sm text-void-400">Publication proves registry eligibility. Runtime proof remains per job.</p>
        </div>
        <Link href={queryHref({ create: "1" })} scroll={false} className="instrument-button instrument-button-primary"><PlusIcon size={17} aria-hidden />Create agent</Link>
      </header>

      <nav aria-label="Agent views" className="mt-5 flex gap-1 border-b border-void-800">
        {AGENT_VIEWS.map(({ value, label }) => (
          <Link key={value} href={queryHref({ view: value, agentId: null })} scroll={false} aria-current={tab === value ? "page" : undefined} className={`inline-flex min-h-11 items-center px-4 text-sm font-semibold ${tab === value ? "border-b-2 border-dawg-500 text-dawg-300" : "text-void-400 hover:text-void-100"}`}>
            {label}
          </Link>
        ))}
      </nav>

      {lifecycle.isLoading && <MarketplaceLoading />}
      {lifecycle.error && <div role="alert" className="mt-6 flex items-start justify-between gap-4 border-l-2 border-blood-500 pl-3"><p className="break-words text-sm text-blood-300">{lifecycle.error.message}</p><button type="button" onClick={() => void lifecycle.refetch()} className="text-sm font-semibold text-void-200">Retry</button></div>}
      {lifecycle.data && (
        <section className="mt-5" aria-live="polite">
          <p className="mb-3 text-xs text-void-500">Authenticated protected catalog</p>
          {tab === "available" && <AgentList agents={available} empty="No external canonical versions are available." agentHref={agentHref} />}
          {tab === "mine" && <AgentList agents={mine} empty="You have not published a canonical version." agentHref={agentHref} />}
          {tab === "drafts" && <DraftList drafts={drafts} />}
        </section>
      )}

      {createOpen && <CreateAgentModal defaultCreatorParent={defaultCreatorParent} creatorParentOptions={ownedCreatorParents} onClose={closeCreate} onCreated={() => { replaceQuery({ create: null, view: "mine" }); void lifecycle.refetch(); }} />}
      {selected && <KernelJobDialog agent={selected} onClose={() => replaceQuery({ agentId: null })} />}
    </main>
  );
}

function MarketplaceLoading() {
  return <main className="mx-auto max-w-[90rem] px-4 py-10 sm:px-6"><p role="status" className="border-y border-void-800 py-10 text-center text-sm text-void-400">Loading protected agents…</p></main>;
}

function AgentList({ agents, empty, agentHref }: { agents: ProtectedPublishedAgentRead[]; empty: string; agentHref: (agent: ProtectedPublishedAgentRead) => string }) {
  if (!agents.length) return <p className="border-y border-void-800 py-10 text-center text-sm text-void-500">{empty}</p>;
  return <ul className="divide-y divide-void-800 border-y border-void-800">{agents.map((agent) => <AgentRow key={agent.versionId} agent={agent} href={agentHref(agent)} />)}</ul>;
}

function AgentRow({ agent, href }: { agent: ProtectedPublishedAgentRead; href: string }) {
  return (
    <li className="py-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-void-100">{agent.name}</h2><EvidenceStatus state={agent.hireable ? "verified" : "unavailable"} label={agent.hireable ? "ELIGIBLE" : "REFUSED"} /></div>
          <p className="mt-1 break-all font-mono text-sm text-dawg-300">{agent.fullSubname}</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-void-400"><span>{agent.capabilities.join(", ")}</span><span className="font-mono">Version {agent.version}</span><span className="font-mono">ID {agent.versionId.slice(0, 8)}</span></div>
          <dl className="mt-4 grid gap-3 rounded-[12px] border border-void-800 bg-void-950 p-4 text-xs sm:grid-cols-3">
            <div><dt className="font-semibold text-void-500">Price per protected hire</dt><dd className="mt-1 font-mono text-void-200">{formatUsdcAtomic(agent.priceAtomic)}</dd></div>
            <div><dt className="font-semibold text-void-500">Verified external hires</dt><dd className="mt-1 text-void-200">{agent.verifiedExternalHires} receipt-backed job{agent.verifiedExternalHires === 1 ? "" : "s"}</dd></div>
            <div><dt className="font-semibold text-void-500">Settled earnings</dt><dd className="mt-1 text-void-400">Unavailable until the protected owner projection lands</dd></div>
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-void-500">Published eligibility is registry state. Runtime proof and financial outcome remain attached to each job.</p>
          <div className="mt-3 flex flex-wrap gap-2"><EvidenceStatus state={agent.mcpAvailability === "AVAILABLE" ? "verified" : "unavailable"} label={`MCP ${agent.mcpAvailability.toLowerCase()}`} />{agent.provenance && <EvidenceStatus state="verified" label="Provenance recorded" />}</div>
          {agent.refusalReason && <p className="mt-3 break-words font-mono text-sm text-blood-300">{agent.refusalReason}</p>}
        </div>
        {agent.ownedByViewer || !agent.hireable ? <button type="button" disabled className="instrument-button instrument-button-primary lg:min-w-36">{agent.ownedByViewer ? "Published by you" : "Hire refused"}</button> : <Link href={href} scroll={false} className="instrument-button instrument-button-primary lg:min-w-36">Hire agent</Link>}
      </div>
      <details className="mt-3">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 py-2 text-sm text-void-400">Identity, authority, and provenance <CaretRightIcon size={15} aria-hidden /></summary>
        <dl className="grid gap-x-6 gap-y-3 border-t border-void-800 py-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <Meta label="Creator ENS" value={agent.creatorParent} />
          <Meta label="Subname" value={agent.fullSubname} />
          <Meta label="Owner" value={agent.ownerWallet} />
          <Meta label="Authority owner" value={agent.authorityOwner} />
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
  if (!drafts.length) return <p className="border-y border-void-800 py-10 text-center text-sm text-void-500">No persisted drafts.</p>;
  return <ul className="divide-y divide-void-800 border-y border-void-800">{drafts.map((draft) => <li key={draft.versionId} className="py-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-void-100">{draft.name}</h2><p className="mt-1 text-sm text-void-400">Draft version {draft.version}. Not published or hireable.</p>{draft.refusalReason && <p className="mt-2 break-words font-mono text-sm text-blood-300">{draft.refusalReason}</p>}</div><EvidenceStatus state="unavailable" label={draft.lifecycleState} /></div><details className="mt-3"><summary className="min-h-11 cursor-pointer py-3 text-sm text-void-400">Draft identifiers and catalog snapshot</summary><dl className="grid gap-3 border-t border-void-800 py-4 text-xs sm:grid-cols-2"><Meta label="Version ID" value={draft.versionId} /><Meta label="Manifest hash" value={draft.manifestHash} /><Meta label="Manifest schema" value={String(draft.manifestSchemaVersion)} /><Meta label="MCP availability" value={draft.mcpAvailability} /><Meta label="Skills" value={draft.skillSummary?.map((skill) => `${skill.category}: ${skill.id}`).join(", ") || "Unavailable"} /><Meta label="Reviewed sources" value={draft.reviewedSources?.map((source) => `${source.repository} ${source.revision} (${source.use})`).join(", ") || "Unavailable"} /></dl></details></li>)}</ul>;
}

function Meta({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="font-semibold uppercase tracking-wide text-void-500">{label}</dt><dd className="mt-1 break-all font-mono text-void-300">{value}</dd></div>; }
