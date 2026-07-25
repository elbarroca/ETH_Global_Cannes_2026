"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ShieldCheckIcon,
  SpinnerGapIcon,
} from "@phosphor-icons/react";
import { Dialog } from "@/components/ui/dialog";
import { CopyableIdentifier, EvidenceStatus } from "@/components/ui/evidence";
import {
  bindAgentName,
  createAgentDraft,
  getAgentCatalog,
  prepareAgentEnsWrite,
  publishAgentVersion,
  type AgentCatalogProjection,
  type AgentCatalogTemplate,
  type AgentLifecycleVersion,
} from "@/lib/api";
import { agentVersionToYaml } from "@/lib/manifest-yaml";

const STAGES = ["Identity", "Capability bundle", "ENS authority", "Publish and receipt"] as const;
type Stage = 0 | 1 | 2 | 3;

interface CreateAgentModalProps {
  onClose: () => void;
  onCreated?: (agent: AgentLifecycleVersion) => void;
}

function slugifyLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "agent";
}

function StageRail({ active }: { active: Stage }) {
  return (
    <ol className="sticky top-0 z-10 -mx-4 grid grid-cols-2 gap-x-3 gap-y-2 bg-void-900 px-4 pb-4 sm:-mx-5 sm:grid-cols-4 sm:px-5" aria-label="Publication progress">
      {STAGES.map((label, index) => (
        <li key={label} aria-current={index === active ? "step" : undefined} className={`border-t-2 pt-2 text-xs font-semibold ${index <= active ? "border-dawg-500 text-void-100" : "border-void-700 text-void-500"}`}>
          {label}
        </li>
      ))}
    </ol>
  );
}

function FieldCount({ current, maximum }: { current: number; maximum: number }) {
  return <p className="text-right font-mono text-xs text-void-500">{current} / {maximum.toLocaleString()}</p>;
}

function CatalogLoading() {
  return <div role="status" aria-label="Loading protected catalog" className="space-y-3"><div className="h-12 animate-pulse rounded-[10px] bg-void-800" /><div className="h-24 animate-pulse rounded-[10px] bg-void-800" /><div className="h-24 animate-pulse rounded-[10px] bg-void-800" /></div>;
}

function TemplateSkills({ catalog, template }: { catalog: AgentCatalogProjection; template: AgentCatalogTemplate }) {
  const grouped = catalog.categories.map((category) => ({
    category,
    skills: template.skillIds.map((id) => catalog.skills.find((skill) => skill.id === id)).filter((skill) => skill?.category === category),
  }));
  return (
    <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">
      {grouped.map(({ category, skills }) => (
        <section key={category} aria-label={`${category.toLowerCase()} skills`} className="border-t border-void-800 pt-3">
          <h4 className="text-xs font-semibold text-void-300">{category[0]}{category.slice(1).toLowerCase()}</h4>
          {skills.length ? <ul className="mt-2 space-y-2">{skills.map((skill) => skill && <li key={skill.id} className="min-w-0"><p className="break-words font-mono text-xs text-dawg-300">{skill.id}</p><p className="mt-1 text-xs text-void-400">{skill.capabilities.join(", ") || "No direct capability claim"}</p>{skill.constraints.length > 0 && <p className="mt-1 break-words text-xs text-void-500">{skill.constraints.join(", ")}</p>}{skill.category === "DATA" && <EvidenceStatus className="mt-2" state={skill.providerAvailability === "AVAILABLE" ? "verified" : "unavailable"} label={`Provider ${skill.providerAvailability.toLowerCase()}`} />}</li>)}</ul> : <p className="mt-2 text-xs text-void-500">Not selected by this template.</p>}
        </section>
      ))}
    </div>
  );
}

function SelectionPreview({ catalog, template, name, description, fullSubname }: { catalog: AgentCatalogProjection | undefined; template: AgentCatalogTemplate | null; name: string; description: string; fullSubname: string }) {
  if (!catalog || !template) return <p className="mt-4 text-sm text-void-500">Select a server template to inspect its exact bundle.</p>;
  return (
    <dl className="mt-4 space-y-3 text-xs">
      <PreviewRow label="Template" value={template.label} />
      <PreviewRow label="Name" value={name.trim() || "Not set"} />
      <PreviewRow label="Description" value={description.trim() || "Not set"} />
      <PreviewRow label="ENS subname" value={fullSubname} mono />
      <PreviewRow label="Capabilities" value={template.capabilities.join(", ")} />
      <PreviewRow label="Atomic price" value={template.priceAtomic} mono />
      <PreviewRow label="Skill snapshots" value={template.skillIds.join(", ")} mono />
      <PreviewRow label="MCP providers" value={catalog.mcpProviders.map((provider) => `${provider.provider}: ${provider.availability}`).join(", ")} mono />
    </dl>
  );
}

function PreviewRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="border-t border-void-800 pt-3"><dt className="font-semibold text-void-500">{label}</dt><dd className={`mt-1 break-words text-void-200 ${mono ? "font-mono" : ""}`}>{value}</dd></div>;
}

export function CreateAgentModal({ onClose, onCreated }: CreateAgentModalProps) {
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [creatorParent, setCreatorParent] = useState("");
  const [preparedAgent, setPreparedAgent] = useState<AgentLifecycleVersion | null>(null);
  const [publishedAgent, setPublishedAgent] = useState<AgentLifecycleVersion | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publicationUncertain, setPublicationUncertain] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const stageFocusRef = useRef<HTMLDivElement>(null);
  const initialStageRef = useRef(true);
  const catalog = useQuery({ queryKey: ["protected-agent-catalog"], queryFn: ({ signal }) => getAgentCatalog(signal), retry: false });

  const template = useMemo(() => catalog.data?.templates.find((item) => item.id === templateId) ?? null, [catalog.data?.templates, templateId]);
  const agentLabel = slugifyLabel(name);
  const fullSubnamePreview = creatorParent.trim()
    ? `${agentLabel}.${creatorParent.trim().toLowerCase().replace(/\.eth$/, "")}.eth`
    : `${agentLabel}.creator.eth`;
  const identityValid = name.trim().length >= 2 && name.trim().length <= 80 && description.trim().length >= 10 && description.trim().length <= 800;
  const ensValid = /^(?:[a-z0-9-]+\.)*eth$/i.test(creatorParent.trim()) && creatorParent.trim().length <= 255;

  useEffect(() => {
    if (initialStageRef.current) {
      initialStageRef.current = false;
      return;
    }
    const frame = window.requestAnimationFrame(() => stageFocusRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [stage]);

  function moveToStage(next: Stage): void {
    setDirection(next > stage ? 1 : -1);
    setStage(next);
  }

  async function prepareDraft(): Promise<void> {
    if (!identityValid || !template || !ensValid) return;
    setBusy(true);
    setErrorMessage(null);
    const requestRoot = crypto.randomUUID();
    try {
      setStatus("Saving catalog draft");
      const draft = await createAgentDraft({ templateId: template.id, name: name.trim(), description: description.trim() }, `${requestRoot}-draft`);
      setStatus("Binding ENS authority");
      const bound = await bindAgentName(draft.versionId, creatorParent.trim(), agentLabel, `${requestRoot}-bind`);
      setStatus("Preparing ENS write plan");
      const prepared = await prepareAgentEnsWrite(bound.versionId, `${requestRoot}-prepare`);
      setPreparedAgent(prepared.version);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "The protected draft could not be prepared.");
    } finally {
      setStatus(null);
      setBusy(false);
    }
  }

  async function publish(): Promise<void> {
    if (!preparedAgent) return;
    setBusy(true);
    setErrorMessage(null);
    setPublicationUncertain(false);
    try {
      setPublishedAgent(await publishAgentVersion(preparedAgent.versionId, crypto.randomUUID()));
    } catch (error) {
      const responseWasLost = error instanceof TypeError;
      setPublicationUncertain(responseWasLost);
      setErrorMessage(responseWasLost ? "The publication response was lost. Registry state is unknown. Close and refresh before retrying." : error instanceof Error ? error.message : "Publication was refused.");
    } finally {
      setBusy(false);
    }
  }

  function finish(): void {
    if (publishedAgent) onCreated?.(publishedAgent);
    else onClose();
  }

  return (
    <Dialog open title="Create a protected agent" description="Choose one reviewed server template, bind ENS authority, then publish the exact immutable version." onClose={publishedAgent ? finish : onClose} dismissible={!busy} className="max-w-6xl">
      <StageRail active={stage} />
      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
        <AnimatePresence mode="wait" initial={false}>
        <motion.div key={stage} ref={stageFocusRef} tabIndex={-1} initial={reduceMotion ? false : { opacity: 0, x: direction * 18 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: direction * -12 }} transition={{ duration: reduceMotion ? 0 : 0.18 }} className="min-w-0 pb-20 focus:outline-none">
          {stage === 0 && <section aria-labelledby="agent-identity-title"><h3 id="agent-identity-title" className="text-2xl font-semibold text-void-100">Identity</h3><p className="mt-2 text-sm text-void-400">Name the bounded role. Instructions and capability policy remain server-owned.</p><div className="mt-6 space-y-5"><label className="block text-sm font-semibold text-void-200" htmlFor="agent-name">Agent name<input id="agent-name" value={name} onChange={(event) => { setName(event.target.value); setPreparedAgent(null); }} maxLength={80} className="goal-control" /><FieldCount current={name.length} maximum={80} /></label><label className="block text-sm font-semibold text-void-200" htmlFor="agent-description">Description<textarea id="agent-description" value={description} onChange={(event) => { setDescription(event.target.value); setPreparedAgent(null); }} maxLength={800} rows={5} className="goal-control min-h-32 resize-y py-3" /><FieldCount current={description.length} maximum={800} /></label></div></section>}

          {stage === 1 && <section aria-labelledby="capability-bundle-title"><h3 id="capability-bundle-title" className="text-2xl font-semibold text-void-100">Capability bundle</h3><p className="mt-2 text-sm text-void-400">Select one immutable template from the authenticated founding catalog.</p>{catalog.isLoading && <div className="mt-6"><CatalogLoading /></div>}{catalog.error && <div role="alert" className="mt-6 border-l-2 border-blood-500 pl-3"><p className="break-words text-sm text-blood-300">{catalog.error.message}</p><button type="button" onClick={() => void catalog.refetch()} className="instrument-button instrument-button-secondary mt-4">Retry catalog</button></div>}{catalog.data && <div className="mt-6 grid gap-2 sm:grid-cols-2">{catalog.data.templates.map((item) => { const selected = item.id === templateId; return <button key={item.id} type="button" aria-pressed={selected} onClick={() => { setTemplateId(item.id); setPreparedAgent(null); }} className={`min-h-24 rounded-[10px] border p-3 text-left ${selected ? "border-dawg-500 bg-dawg-500/8" : "border-void-700 bg-void-950"}`}><span className="flex items-start justify-between gap-3 text-sm font-semibold text-void-100">{item.label}<CheckIcon size={16} className={selected ? "text-dawg-400" : "text-void-500"} aria-hidden /></span><span className="mt-2 block text-xs text-void-400">{item.capabilities.join(", ")}</span><span className="mt-2 block font-mono text-xs text-void-500">{item.priceAtomic} USDC_ATOMIC</span></button>; })}</div>}{catalog.data && template && <TemplateSkills catalog={catalog.data} template={template} />}{catalog.data && <section className="mt-6 border-t border-void-800 pt-4" aria-labelledby="mcp-availability"><h4 id="mcp-availability" className="text-sm font-semibold text-void-200">MCP availability</h4><ul className="mt-3 space-y-3">{catalog.data.mcpProviders.map((provider) => <li key={provider.provider} className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-void-200">{provider.provider}</p><p className="mt-1 break-words text-xs text-void-500">{provider.capabilities.join(", ")}</p></div><EvidenceStatus state={provider.availability === "AVAILABLE" ? "verified" : "unavailable"} label={provider.availability} /></li>)}</ul></section>}</section>}

          {stage === 2 && <section aria-labelledby="ens-authority-title"><h3 id="ens-authority-title" className="text-2xl font-semibold text-void-100">ENS authority</h3><p className="mt-2 text-sm text-void-400">Bind the catalog draft to your canonical creator parent and deterministic agent subname.</p><label className="mt-6 block text-sm font-semibold text-void-200" htmlFor="creator-parent">Creator ENS parent<input id="creator-parent" value={creatorParent} onChange={(event) => { setCreatorParent(event.target.value); setPreparedAgent(null); }} placeholder="maker.eth" className="goal-control" /><span className="mt-2 block break-all font-mono text-xs text-dawg-300">{fullSubnamePreview}</span></label>{!preparedAgent ? <button type="button" onClick={() => void prepareDraft()} disabled={!ensValid || busy} className="instrument-button instrument-button-primary mt-6">{busy ? <SpinnerGapIcon className="animate-spin" size={16} aria-hidden /> : <ShieldCheckIcon size={16} aria-hidden />}{status ?? "Prepare immutable draft"}</button> : <div className="mt-6 grid min-w-0 gap-2 sm:grid-cols-2"><CopyableIdentifier label="Owner wallet" value={preparedAgent.ownerWallet} /><CopyableIdentifier label="Version ID" value={preparedAgent.versionId} /><CopyableIdentifier label="Manifest hash" value={preparedAgent.manifestHash} /><CopyableIdentifier label="Agent subname" value={preparedAgent.fullSubname ?? "Unavailable"} /></div>}</section>}

          {stage === 3 && <section aria-labelledby="publish-receipt-title"><h3 id="publish-receipt-title" className="text-2xl font-semibold text-void-100">{publishedAgent ? "Publication receipt" : "Publish immutable version"}</h3>{publishedAgent ? <><div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-y border-void-800 py-4"><div><p className="font-semibold text-void-100">{publishedAgent.name}</p><p className="mt-2 break-all font-mono text-sm text-dawg-300">{publishedAgent.fullSubname ?? "Canonical subname unavailable"}</p></div><EvidenceStatus state={publishedAgent.hireable && publishedAgent.canonicalState === "CANONICAL" ? "verified" : "unavailable"} label={publishedAgent.hireable ? "ELIGIBLE" : "REFUSED"} /></div><dl className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2"><CopyableIdentifier label="Agent ID" value={publishedAgent.agentId} /><CopyableIdentifier label="Version ID" value={publishedAgent.versionId} /><CopyableIdentifier label="Owner wallet" value={publishedAgent.ownerWallet} /><CopyableIdentifier label="Manifest hash" value={publishedAgent.manifestHash} /></dl><p className="mt-4 text-sm text-void-400">Registry eligibility only. Runtime, MCP, 0G, storage, receipt, delivery, and settlement remain per-job evidence.</p></> : <><p className="mt-2 text-sm text-void-400">Publish only the exact server-returned draft. Refusal and lost-response states remain visible.</p><button type="button" onClick={() => void publish()} disabled={!preparedAgent || busy || publicationUncertain} className="instrument-button instrument-button-primary mt-6"><ShieldCheckIcon size={16} aria-hidden />{publicationUncertain ? "Refresh registry before retry" : busy ? "Publishing version" : "Publish immutable version"}</button></>}</section>}

          {errorMessage && <div role="alert" className="mt-6 border-l-2 border-blood-500 pl-3 text-sm text-blood-300">{errorMessage}</div>}
        </motion.div>
        </AnimatePresence>

        <aside className="min-w-0 self-start border-y border-void-800 py-4 lg:sticky lg:top-4" aria-label={preparedAgent ? "Immutable server preview" : "Catalog selection preview"}><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-void-200">{preparedAgent ? `Manifest v${preparedAgent.manifestSchemaVersion}` : "Selection preview"}</h3><span className="font-mono text-xs text-void-500">{preparedAgent ? "Server returned" : "Catalog data"}</span></div>{preparedAgent ? <pre className="mt-4 max-h-[35rem] overflow-auto whitespace-pre-wrap break-words border-t border-void-800 pt-4 font-mono text-xs leading-relaxed text-void-400">{agentVersionToYaml(preparedAgent)}</pre> : <SelectionPreview catalog={catalog.data} template={template} name={name} description={description} fullSubname={fullSubnamePreview} />}</aside>
      </div>

      <footer className="sticky bottom-0 -mx-4 -mb-5 mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-void-700 bg-void-900 px-4 py-4 sm:-mx-5 sm:px-5"><button type="button" onClick={() => stage === 0 ? onClose() : moveToStage((stage - 1) as Stage)} disabled={busy || Boolean(publishedAgent)} className="instrument-button instrument-button-secondary"><ArrowLeftIcon size={16} aria-hidden />{stage === 0 ? "Cancel" : "Back"}</button>{stage < 3 && <button type="button" onClick={() => moveToStage((stage + 1) as Stage)} disabled={busy || (stage === 0 && !identityValid) || (stage === 1 && !template) || (stage === 2 && !preparedAgent)} className="instrument-button instrument-button-primary">Continue <ArrowRightIcon size={16} aria-hidden /></button>}{stage === 3 && publishedAgent && <button type="button" onClick={finish} className="instrument-button instrument-button-primary">View my agents <ArrowRightIcon size={16} aria-hidden /></button>}</footer>
    </Dialog>
  );
}
