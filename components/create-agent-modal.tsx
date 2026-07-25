"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BrainIcon,
  CheckIcon,
  DatabaseIcon,
  LightningIcon,
  PlugsConnectedIcon,
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
  type AgentCatalogCategory,
  type AgentCatalogTemplate,
  type AgentLifecycleVersion,
} from "@/lib/api";
import { agentVersionToYaml } from "@/lib/manifest-yaml";
import { formatUsdc, formatUsdcAtomic } from "@/lib/format-usdc";

const STAGES = ["Identity", "Capability bundle", "ENS authority", "Publish and receipt"] as const;
type Stage = 0 | 1 | 2 | 3;

interface CreateAgentModalProps {
  onClose: () => void;
  onCreated?: (agent: AgentLifecycleVersion) => void;
  defaultCreatorParent?: string | null;
  creatorParentOptions?: readonly string[];
}

const CATEGORY_META = {
  PERSONA: { label: "Persona", description: "The role and reasoning stance the agent follows.", icon: BrainIcon },
  DATA: { label: "Data", description: "Read-only sources the protected runtime may query.", icon: DatabaseIcon },
  ACTION: { label: "Action", description: "Bounded proposals the agent may prepare without signing.", icon: LightningIcon },
  CONNECTION: { label: "Connection", description: "Required protected compute and storage rails.", icon: PlugsConnectedIcon },
} satisfies Record<AgentCatalogCategory, { label: string; description: string; icon: typeof BrainIcon }>;

const CAPABILITY_COPY: Record<string, string> = {
  research: "Collect and synthesize bounded source evidence.",
  "market-analysis": "Compare market conditions without claiming execution.",
  "risk-analysis": "Test constraints, exposure, and refusal conditions.",
  "uniswap-swap": "Prepare a swap proposal that still requires wallet approval.",
};

function slugifyLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "agent";
}

function humanize(value: string): string {
  const label = value.split(/[.:]/).at(-1)?.replace(/-/g, " ") ?? value;
  return label.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeCreatorParent(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function StageRail({ active }: { active: Stage }) {
  return (
    <ol className="sticky top-0 z-10 -mx-4 grid grid-cols-2 gap-x-4 gap-y-3 bg-void-900 px-4 pb-5 sm:-mx-5 sm:grid-cols-4 sm:px-5" aria-label="Publication progress">
      {STAGES.map((label, index) => (
        <li key={label} aria-current={index === active ? "step" : undefined} className="grid gap-2">
          <span className={`h-0.5 rounded-full transition-colors duration-300 ${index < active ? "bg-dawg-500" : index === active ? "bg-dawg-400" : "bg-void-700"}`} />
          <span className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${index <= active ? "text-void-100" : "text-void-500"}`}>
            <span className={`font-mono text-[0.625rem] ${index < active ? "text-dawg-400" : index === active ? "text-dawg-300" : "text-void-600"}`}>{String(index + 1).padStart(2, "0")}</span>
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function FieldCount({ current, maximum }: { current: number; maximum: number }) {
  return <p className="mt-2 text-right font-mono text-xs text-void-500 tnums">{current} / {maximum.toLocaleString()}</p>;
}

function CatalogLoading() {
  return <div role="status" aria-label="Loading protected catalog" className="space-y-3"><div className="h-12 animate-pulse rounded-[10px] bg-void-800" /><div className="h-24 animate-pulse rounded-[10px] bg-void-800" /><div className="h-24 animate-pulse rounded-[10px] bg-void-800" /></div>;
}

function CapabilityList({ capabilities }: { capabilities: readonly string[] }) {
  if (!capabilities.length) return <p className="mt-2 text-xs text-void-500">No direct capability claim.</p>;
  return <ul className="mt-2 space-y-2">{capabilities.map((capability) => <li key={capability} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2 text-xs"><CheckIcon size={14} className="mt-0.5 text-dawg-400" aria-hidden /><span><strong className="font-semibold text-void-200">{humanize(capability)}</strong><span className="mt-0.5 block text-void-500">{CAPABILITY_COPY[capability] ?? "Included by the authenticated server template."}</span></span></li>)}</ul>;
}

function ConstraintList({ constraints }: { constraints: readonly string[] }) {
  if (!constraints.length) return null;
  return <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Skill constraints">{constraints.map((constraint) => <li key={constraint} className="rounded-[6px] bg-void-800 px-2 py-1 text-[0.6875rem] text-void-400">{humanize(constraint)}</li>)}</ul>;
}

function TemplateSkills({ catalog, template }: { catalog: AgentCatalogProjection; template: AgentCatalogTemplate }) {
  const grouped = catalog.categories.map((category) => ({
    category,
    skills: template.skillIds.map((id) => catalog.skills.find((skill) => skill.id === id)).filter((skill) => skill?.category === category),
  }));
  return (
    <div className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
      {grouped.map(({ category, skills }) => (
        <section key={category} aria-label={`${CATEGORY_META[category].label}: ${CATEGORY_META[category].description}`} data-category-icon={category} className="border-l border-void-700 pl-3">
          <div className="flex items-start gap-2">
            {(() => { const CategoryIcon = CATEGORY_META[category].icon; return <CategoryIcon data-category-heading-icon={category} size={18} className="mt-0.5 shrink-0 text-dawg-400" aria-hidden />; })()}
            <div><h4 className="text-sm font-semibold text-void-200">{CATEGORY_META[category].label}</h4><p className="mt-1 text-xs leading-relaxed text-void-500">{CATEGORY_META[category].description}</p></div>
          </div>
          {skills.length ? <ul className="mt-3 space-y-4">{skills.map((skill) => skill && <li key={skill.id} className="min-w-0"><p className="text-xs font-semibold text-void-200">{humanize(skill.id)}</p><p className="mt-1 font-mono text-[0.6875rem] text-dawg-300">Included by template</p><CapabilityList capabilities={skill.capabilities} /><ConstraintList constraints={skill.constraints} />{skill.category === "DATA" && <EvidenceStatus className="mt-2" state={skill.providerAvailability === "AVAILABLE" ? "verified" : "unavailable"} label={`Provider ${skill.providerAvailability.toLowerCase()}`} />}</li>)}</ul> : <p className="mt-3 text-xs text-void-500">No {CATEGORY_META[category].label.toLowerCase()} skill is included by this template.</p>}
        </section>
      ))}
    </div>
  );
}

function ProviderReadiness({ catalog }: { catalog: AgentCatalogProjection }) {
  return (
    <ul className="mt-4 space-y-4">
      {catalog.mcpProviders.map((provider) => (
        <li key={provider.provider} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="text-sm font-semibold text-void-200">{humanize(provider.provider)}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {provider.capabilities.map((capability) => (
                <li key={capability} className="rounded-[6px] bg-void-800 px-2 py-1 text-[0.6875rem] text-void-400">
                  {humanize(capability)}
                </li>
              ))}
            </ul>
          </div>
          <EvidenceStatus state={provider.availability === "AVAILABLE" ? "verified" : "unavailable"} label={provider.availability} />
        </li>
      ))}
    </ul>
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
      <PreviewRow label="Capabilities" value={`${template.capabilities.length} included by template`} />
      <PreviewRow label="Price per protected hire" value={formatUsdc(template.priceAtomic)} mono />
      <PreviewRow label="Settled earnings" value="Unavailable until the protected owner projection lands" />
      <PreviewRow label="Skill snapshots" value={`${template.skillIds.length} locked by template`} />
      <PreviewRow label="MCP providers" value={`${catalog.mcpProviders.filter((provider) => provider.availability === "AVAILABLE").length} of ${catalog.mcpProviders.length} available`} />
    </dl>
  );
}

function PreviewRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="border-t border-void-800 pt-3"><dt className="font-semibold text-void-500">{label}</dt><dd className={`mt-1 break-words text-void-200 ${mono ? "font-mono" : ""}`}>{value}</dd></div>;
}

export function CreateAgentModal({ onClose, onCreated, defaultCreatorParent, creatorParentOptions = [] }: CreateAgentModalProps) {
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [creatorParent, setCreatorParent] = useState(() => normalizeCreatorParent(defaultCreatorParent ?? ""));
  const [preparedAgent, setPreparedAgent] = useState<AgentLifecycleVersion | null>(null);
  const [publishedAgent, setPublishedAgent] = useState<AgentLifecycleVersion | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publicationUncertain, setPublicationUncertain] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const stageFocusRef = useRef<HTMLDivElement>(null);
  const initialStageRef = useRef(true);
  const creatorParentEditedRef = useRef(false);
  const defaultParentAppliedRef = useRef(Boolean(defaultCreatorParent));
  const catalog = useQuery({ queryKey: ["protected-agent-catalog"], queryFn: ({ signal }) => getAgentCatalog(signal), retry: false });

  const template = useMemo(() => catalog.data?.templates.find((item) => item.id === templateId) ?? null, [catalog.data?.templates, templateId]);
  const agentLabel = slugifyLabel(name);
  const normalizedCreatorParent = normalizeCreatorParent(creatorParent);
  const fullSubnamePreview = normalizedCreatorParent ? `${agentLabel}.${normalizedCreatorParent}` : "Unavailable until a canonical creator parent is entered.";
  const identityValid = name.trim().length >= 2 && name.trim().length <= 80 && description.trim().length >= 10 && description.trim().length <= 800;
  const ensValid = /^(?:[a-z0-9-]+\.)*eth$/i.test(normalizedCreatorParent) && normalizedCreatorParent.length <= 255;
  const ensRefusal = normalizedCreatorParent
    ? "CREATOR_PARENT_INVALID: Enter a canonical .eth parent."
    : "CREATOR_PARENT_REQUIRED: No wallet-derived ENS parent was substituted.";

  useEffect(() => {
    const ownedParent = normalizeCreatorParent(defaultCreatorParent ?? "");
    if (!ownedParent || defaultParentAppliedRef.current || creatorParentEditedRef.current) return;
    defaultParentAppliedRef.current = true;
    setCreatorParent(ownedParent);
  }, [defaultCreatorParent]);

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
      const bound = await bindAgentName(draft.versionId, normalizedCreatorParent, agentLabel, `${requestRoot}-bind`);
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
    <Dialog open title="Create a protected agent" description="Choose one reviewed server template, bind ENS authority, then publish the exact immutable application version." onClose={publishedAgent ? finish : onClose} dismissible={!busy} className="max-w-5xl">
      <StageRail active={stage} />
      <div className="mt-4 grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)]">
        <AnimatePresence mode="wait" initial={false}>
        <motion.div data-testid="agent-stage" key={stage} ref={stageFocusRef} tabIndex={-1} initial={reduceMotion ? false : { opacity: 0, x: direction * 18 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: direction * -12 }} transition={{ duration: reduceMotion ? 0 : 0.18 }} className="min-w-0 pb-4 focus:outline-none">
          {stage === 0 && <section aria-labelledby="agent-identity-title"><h3 id="agent-identity-title" className="text-2xl font-semibold tracking-tight text-void-100">Identity</h3><p className="mt-2.5 text-sm leading-relaxed text-void-400">Name the bounded role. Instructions and capability policy remain server-owned.</p><div className="mt-7 space-y-6"><label className="block text-sm font-semibold text-void-200" htmlFor="agent-name">Agent name<input id="agent-name" value={name} onChange={(event) => { setName(event.target.value); setPreparedAgent(null); }} maxLength={80} placeholder="Research analyst" className="goal-control" /><FieldCount current={name.length} maximum={80} /></label><label className="block text-sm font-semibold text-void-200" htmlFor="agent-description">Description<textarea id="agent-description" value={description} onChange={(event) => { setDescription(event.target.value); setPreparedAgent(null); }} maxLength={800} rows={4} placeholder="Describe the bounded role this agent performs." className="goal-control min-h-32 resize-y leading-relaxed" /><FieldCount current={description.length} maximum={800} /></label></div></section>}

          {stage === 1 && (
            <section aria-labelledby="capability-bundle-title">
              <h3 id="capability-bundle-title" className="text-2xl font-semibold text-void-100">Capability bundle</h3>
              <p className="mt-2 text-sm text-void-400">Choose one immutable template from the authenticated founding catalog. Price, skills, and provider requirements are server-owned.</p>
              {catalog.isLoading && <div className="mt-6"><CatalogLoading /></div>}
              {catalog.error && <div role="alert" className="mt-6 border-l-2 border-blood-500 pl-3"><p className="break-words text-sm text-blood-300">{catalog.error.message}</p><button type="button" onClick={() => void catalog.refetch()} className="instrument-button instrument-button-secondary mt-4">Retry catalog</button></div>}
              {catalog.data && <div className="mt-6 grid gap-2.5 sm:grid-cols-2">{catalog.data.templates.map((item) => {
                const selected = item.id === templateId;
                return <button key={item.id} type="button" aria-pressed={selected} onClick={() => { setTemplateId(item.id); setPreparedAgent(null); }} className={`group flex min-h-28 flex-col rounded-[12px] border p-4 text-left transition-all duration-200 ${selected ? "border-dawg-500 bg-dawg-500/[0.07] shadow-[0_0_0_1px_rgba(244,197,66,0.25),0_8px_24px_-16px_rgba(244,197,66,0.4)]" : "border-void-800 bg-void-950 hover:border-void-600 hover:bg-void-900/50"}`}>
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-void-100">{item.label}</span>
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors ${selected ? "border-dawg-500 bg-dawg-500 text-void-950" : "border-void-600 text-transparent group-hover:border-void-500"}`}><CheckIcon size={12} weight="bold" aria-hidden /></span>
                  </span>
                  <span className="mt-3 flex flex-wrap gap-1.5">{item.capabilities.length ? item.capabilities.map((cap) => <span key={cap} className="rounded-full border border-void-800 bg-void-900/60 px-2 py-0.5 text-[0.6875rem] text-void-400">{humanize(cap)}</span>) : <span className="text-xs text-void-500">No direct capability claim</span>}</span>
                  <span className="mt-auto pt-4 font-mono text-xs text-dawg-300 tnums">{formatUsdc(item.priceAtomic)}</span>
                </button>;
              })}</div>}
              {catalog.data && template && <details className="mt-6 border-y border-void-800"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-void-300">Inspect exact skills and constraints</summary><div className="border-t border-void-800 pb-5"><TemplateSkills catalog={catalog.data} template={template} /></div></details>}
              {catalog.data && <details className="mt-4 border-y border-void-800"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-void-300">Inspect catalog provider readiness</summary><div className="border-t border-void-800 py-4"><p className="text-xs leading-relaxed text-void-500">Provider readiness is separate from the selected skills. Unavailable providers supply no runtime evidence.</p><ProviderReadiness catalog={catalog.data} /></div></details>}
            </section>
          )}

          {stage === 2 && (
            <section aria-labelledby="ens-authority-title">
              <h3 id="ens-authority-title" className="text-2xl font-semibold text-void-100">ENS authority</h3>
              <p className="mt-2 text-sm text-void-400">Bind the catalog draft to your canonical creator parent and deterministic agent subname.</p>
              <label className="mt-6 block text-sm font-semibold text-void-200" htmlFor="creator-parent">Creator ENS parent
                <input id="creator-parent" list={creatorParentOptions.length ? "owned-creator-parents" : undefined} value={creatorParent} onChange={(event) => { creatorParentEditedRef.current = true; setCreatorParent(event.target.value); setPreparedAgent(null); }} autoComplete="off" spellCheck={false} className="goal-control" />
              </label>
              {creatorParentOptions.length > 0 && <datalist id="owned-creator-parents">{creatorParentOptions.map((parent) => <option key={parent} value={normalizeCreatorParent(parent)} />)}</datalist>}
              <p className="mt-2 text-xs leading-relaxed text-void-500">{defaultCreatorParent ? `Prefilled from your authenticated owned agents. ${creatorParentOptions.length > 1 ? `${creatorParentOptions.length} canonical parents are available.` : "You can edit it."}` : "No canonical owned creator parent is available. Enter the exact .eth parent you control."}</p>
              <div className="mt-5 rounded-[10px] bg-void-950 p-3" aria-label="Full agent subname preview">
                <p className="text-xs font-semibold text-void-500">Full subname preview</p>
                <p data-testid="agent-subname-preview" className={`mt-2 break-all font-mono text-sm ${ensValid ? "text-dawg-300" : "text-void-400"}`}>{fullSubnamePreview}</p>
                {!ensValid && <p className="mt-2 break-words font-mono text-xs text-blood-300">{ensRefusal}</p>}
              </div>
              {!preparedAgent ? <button type="button" onClick={() => void prepareDraft()} disabled={!ensValid || busy} className="instrument-button instrument-button-primary mt-6">{busy ? <SpinnerGapIcon className="animate-spin" size={16} aria-hidden /> : <ShieldCheckIcon size={16} aria-hidden />}{status ?? "Prepare immutable draft"}</button> : <div className="mt-6 grid min-w-0 gap-2 sm:grid-cols-2"><CopyableIdentifier label="Owner wallet" value={preparedAgent.ownerWallet} /><CopyableIdentifier label="Version ID" value={preparedAgent.versionId} /><CopyableIdentifier label="Manifest hash" value={preparedAgent.manifestHash} /><CopyableIdentifier label="Agent subname" value={preparedAgent.fullSubname ?? "Unavailable"} /></div>}
            </section>
          )}

          {stage === 3 && <section aria-labelledby="publish-receipt-title"><h3 id="publish-receipt-title" className="text-2xl font-semibold text-void-100">{publishedAgent ? "Publication receipt" : "Publish immutable version"}</h3>{publishedAgent ? <><div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-y border-void-800 py-4"><div><p className="font-semibold text-void-100">{publishedAgent.name}</p><p className="mt-2 break-all font-mono text-sm text-dawg-300">{publishedAgent.fullSubname ?? "Canonical subname unavailable"}</p></div><EvidenceStatus state={publishedAgent.hireable && publishedAgent.canonicalState === "CANONICAL" ? "verified" : "unavailable"} label={publishedAgent.hireable ? "ELIGIBLE" : "REFUSED"} /></div><dl className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2"><CopyableIdentifier label="Agent ID" value={publishedAgent.agentId} /><CopyableIdentifier label="Version ID" value={publishedAgent.versionId} /><CopyableIdentifier label="Owner wallet" value={publishedAgent.ownerWallet} /><CopyableIdentifier label="Creator parent" value={publishedAgent.creatorParent ?? "Unavailable"} /><CopyableIdentifier label="Agent subname" value={publishedAgent.fullSubname ?? "Unavailable"} /><CopyableIdentifier label="Authority owner" value={publishedAgent.authorityOwner ?? "Unavailable"} /><CopyableIdentifier label="Delegate" value={publishedAgent.authorityDelegate ?? "Unavailable"} /><CopyableIdentifier label="Release SHA" value={publishedAgent.authorityReleaseSha ?? "Unavailable"} /><CopyableIdentifier label="Manifest hash" value={publishedAgent.manifestHash} /></dl><div className="mt-4 rounded-[10px] border border-void-800 bg-void-950 p-4"><p className="text-xs font-semibold text-void-500">Price per protected hire</p><p className="mt-2 font-mono text-sm text-void-200">{formatUsdcAtomic(publishedAgent.priceAtomic)}</p><p className="mt-3 text-xs leading-relaxed text-void-500">Settled earnings unavailable until the protected owner projection lands.</p></div><p className="mt-4 text-sm text-void-400">Published confirms registry eligibility only. Runtime, MCP, 0G, Storage, receipt, delivery, and settlement remain per-job evidence.</p></> : <><p className="mt-2 text-sm leading-relaxed text-void-400">Publishing activates this immutable application version and its runtime configuration. It is not a contract deployment or proof that the runtime or providers are online.</p><p className="mt-3 text-xs leading-relaxed text-void-500">Only the exact server-returned draft is published. Refusal and lost-response states remain visible.</p><button type="button" onClick={() => void publish()} disabled={!preparedAgent || busy || publicationUncertain} className="instrument-button instrument-button-primary mt-6"><ShieldCheckIcon size={16} aria-hidden />{publicationUncertain ? "Refresh registry before retry" : busy ? "Publishing version" : "Publish immutable version"}</button></>}</section>}

          {errorMessage && <div role="alert" className="mt-6 border-l-2 border-blood-500 pl-3 text-sm text-blood-300">{errorMessage}</div>}
        </motion.div>
        </AnimatePresence>

        <aside className="min-w-0 self-start rounded-[14px] border border-void-800 bg-void-950/60 p-5 lg:sticky lg:top-4" aria-label={preparedAgent ? "Immutable server preview" : "Catalog selection preview"}><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-void-200">{preparedAgent ? `Manifest v${preparedAgent.manifestSchemaVersion}` : "Selection preview"}</h3><span className="font-mono text-[0.6875rem] uppercase tracking-wider text-void-500">{preparedAgent ? "Server returned" : "Catalog data"}</span></div>{preparedAgent ? <pre className="mt-4 max-h-[35rem] overflow-auto whitespace-pre-wrap break-words border-t border-void-800 pt-4 font-mono text-xs leading-relaxed text-void-400">{agentVersionToYaml(preparedAgent)}</pre> : <SelectionPreview catalog={catalog.data} template={template} name={name} description={description} fullSubname={fullSubnamePreview} />}</aside>
      </div>

      <footer className="sticky bottom-0 -mx-4 -mb-5 mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-void-700 bg-void-900 px-4 py-4 sm:-mx-5 sm:px-5"><button type="button" onClick={() => stage === 0 ? onClose() : moveToStage((stage - 1) as Stage)} disabled={busy || Boolean(publishedAgent)} className="instrument-button instrument-button-secondary"><ArrowLeftIcon size={16} aria-hidden />{stage === 0 ? "Cancel" : "Back"}</button>{stage < 3 && <button type="button" onClick={() => moveToStage((stage + 1) as Stage)} disabled={busy || (stage === 0 && !identityValid) || (stage === 1 && !template) || (stage === 2 && !preparedAgent)} className="instrument-button instrument-button-primary">Continue <ArrowRightIcon size={16} aria-hidden /></button>}{stage === 3 && publishedAgent && <button type="button" onClick={finish} className="instrument-button instrument-button-primary">View my agents <ArrowRightIcon size={16} aria-hidden /></button>}</footer>
    </Dialog>
  );
}
