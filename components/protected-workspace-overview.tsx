"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { CopyableIdentifier, EvidenceStatus } from "@/components/ui/evidence";
import { DawgSpinner } from "@/components/dawg-spinner";
import { getAgentLifecycle, type AgentLifecycleVersion, type ProtectedPublishedAgent } from "@/lib/api";

export function ProtectedWorkspaceOverview({ onPublish }: { onPublish: () => void }) {
  const [lifecycle, setLifecycle] = useState<{ agents: ProtectedPublishedAgent[]; drafts: AgentLifecycleVersion[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let canceled = false;
    void getAgentLifecycle().then((next) => {
      if (!canceled) { setLifecycle(next); setError(null); }
    }).catch((loadError: unknown) => {
      if (!canceled) { setLifecycle({ agents: [], drafts: [] }); setError(loadError instanceof Error ? loadError.message : "Agent lifecycle is unavailable."); }
    });
    return () => { canceled = true; };
  }, []);

  if (!lifecycle) return <Card><CardBody className="flex min-h-32 items-center justify-center"><DawgSpinner size={44} label="Loading protected workspace…" /></CardBody></Card>;
  const next = lifecycle.agents.length > 0 ? "Hire an external version or inspect your latest protected job." : lifecycle.drafts.length > 0 ? "Review your persisted draft before publishing an immutable version." : "Publish your first bounded agent draft.";
  return (
    <section className="space-y-4" aria-labelledby="next-action-title">
      <Card className="border-dawg-500/25"><CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="instrument-label">Next action</p><h2 id="next-action-title" className="mt-2 text-xl font-semibold text-void-100">{next}</h2></div><div className="flex flex-wrap gap-2">{lifecycle.agents.length === 0 && <button type="button" onClick={onPublish} className="instrument-button instrument-button-primary">Publish an agent</button>}<Link href="/marketplace" className="instrument-button instrument-button-secondary">Open protected agents</Link><Link href="/verify" className="instrument-button instrument-button-secondary">Evidence index</Link></div></CardBody></Card>
      <ol className="grid gap-px overflow-hidden rounded-xl border border-void-800 bg-void-800 sm:grid-cols-3 xl:grid-cols-6" aria-label="Protected buyer journey">
        {[
          ["Onboard", "Authenticated wallet"],
          ["Goal", "Set in Agents"],
          ["Policy", "Protected tier unavailable"],
          ["Recommend", "Reviewed capabilities"],
          ["Hire", "External exact version"],
          ["Prove", "Report + canonical receipt"],
        ].map(([label, detail], index) => <li key={label} className="min-w-0 bg-black p-3"><span className="font-mono text-[10px] text-dawg-400">{String(index + 1).padStart(2, "0")}</span><p className="mt-2 text-sm font-semibold text-void-100">{label}</p><p className="mt-1 text-xs leading-relaxed text-void-500">{detail}</p></li>)}
      </ol>
      <p className="text-xs leading-relaxed text-void-600">Connection gap: no protected low / mid / high policy field exists in the current Kernel recommendation or job contract. The collapsed legacy hunt risk profile is not substituted.</p>
      {error && <p role="alert" className="rounded-xl border border-blood-500/30 bg-blood-900/20 p-3 text-sm text-blood-300">{error}</p>}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <LifecycleGroup title="Owned drafts" empty="No persisted drafts." agents={lifecycle.drafts} />
        <LifecycleGroup title="Owned published versions" empty="No protected version published by this wallet." agents={lifecycle.agents.filter((agent) => agent.ownedByViewer)} />
      </div>
    </section>
  );
}

function LifecycleGroup({ title, empty, agents }: { title: string; empty: string; agents: AgentLifecycleVersion[] }) {
  return <Card className="min-w-0 overflow-hidden"><CardBody className="space-y-3"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-void-100">{title}</h3><span className="font-mono text-xs text-void-500">{agents.length}</span></div>{agents.length === 0 ? <p className="rounded-xl border border-dashed border-void-800 p-5 text-sm text-void-500">{empty}</p> : agents.slice(0, 3).map((agent) => <article key={agent.versionId} className="min-w-0 rounded-xl border border-void-800 bg-black p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-void-100">{agent.name} <span className="font-mono text-xs text-void-500">v{agent.version}</span></p><EvidenceStatus state={agent.lifecycleState === "PUBLISHED" && agent.hireable ? "verified" : "unavailable"} label={agent.lifecycleState} /></div><div className="mt-3"><CopyableIdentifier label="Version ID" value={agent.versionId} /></div></article>)}</CardBody></Card>;
}
