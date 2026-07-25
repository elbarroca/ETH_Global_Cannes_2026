"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CubeIcon,
  FileTextIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  SparkleIcon,
  SpinnerGapIcon,
} from "@phosphor-icons/react";
import { Dialog } from "@/components/ui/dialog";
import { CopyableIdentifier, EvidenceStatus } from "@/components/ui/evidence";
import {
  bindAgentName,
  createAgentDraft,
  generateAgentInstructions,
  prepareAgentEnsWrite,
  publishAgentVersion,
  type AgentLifecycleVersion,
  type GeneratedInstructions,
} from "@/lib/api";
import { agentVersionToYaml } from "@/lib/manifest-yaml";

const CAPABILITIES = [
  { id: "market-analysis", label: "Market analysis", detail: "Analyze supplied market evidence and structure." },
  { id: "risk-analysis", label: "Risk analysis", detail: "Identify constraints, downside, and decision risk." },
  { id: "research", label: "Research", detail: "Synthesize evidence into a concise research response." },
] as const;

const STEPS = ["Define", "Capabilities", "Instructions", "Review", "Publish"] as const;

type Capability = (typeof CAPABILITIES)[number]["id"];
type Step = "define" | "capabilities" | "instructions" | "review" | "publish";

interface SkillProposal {
  slug: string;
  label: string;
  description: string | null;
}

interface CreateAgentModalProps {
  onClose: () => void;
  onCreated?: (agent: AgentLifecycleVersion) => void;
}

function generationEvidence(
  generated: GeneratedInstructions,
  instructionsEdited: boolean,
): { state: "verified" | "unavailable"; label: string } {
  if (instructionsEdited) return { state: "unavailable", label: "Edited draft" };
  if (generated.fallback) return { state: "unavailable", label: "Fallback draft" };
  if (generated.teeVerified === true) return { state: "verified", label: "Verified generation" };
  return { state: "unavailable", label: "Unverified generation" };
}

function slugifyLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "agent";
}

function previewManifest({
  name,
  creatorParent,
  agentLabel,
  capabilities,
}: {
  name: string;
  creatorParent: string;
  agentLabel: string;
  capabilities: readonly string[];
}): string {
  const parent = creatorParent.trim().toLowerCase().replace(/\.eth$/, "");
  const fullSubname = parent ? `${agentLabel}.${parent}.eth` : `${agentLabel}.creator.eth`;
  return [
    "schema_version: 1",
    `name: ${name.trim() || "Untitled agent"}`,
    "adapter: protected-a3",
    "identity:",
    `  ens_subname: ${fullSubname}`,
    "capabilities:",
    ...capabilities.map((capability) => `  - ${capability}`),
    "commerce:",
    "  asset: USDC_ATOMIC",
    "  proof_policy: verified-receipt-required",
  ].join("\n");
}

function StepRail({ active }: { active: number }) {
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label="Publication progress">
      {STEPS.map((label, index) => (
        <li key={label} className="min-w-0">
          <div className={`h-1 rounded-full ${index <= active ? "bg-dawg-500" : "bg-void-800"}`} />
          <span className={`mt-2 hidden text-[9px] font-semibold uppercase tracking-[0.12em] sm:block ${index === active ? "text-dawg-300" : "text-void-600"}`}>
            {index + 1}. {label}
          </span>
          <span className="sr-only">{index === active ? "Current step: " : ""}{label}</span>
        </li>
      ))}
    </ol>
  );
}

function FieldCount({ current, maximum }: { current: number; maximum: number }) {
  return <p className="text-right font-mono text-[10px] text-void-600">{current} / {maximum.toLocaleString()}</p>;
}

export function CreateAgentModal({ onClose, onCreated }: CreateAgentModalProps) {
  const [step, setStep] = useState<Step>("define");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [creatorParent, setCreatorParent] = useState("");
  const [generated, setGenerated] = useState<GeneratedInstructions | null>(null);
  const [instructionsEdited, setInstructionsEdited] = useState(false);
  const [selectedCapabilities, setSelectedCapabilities] = useState<Set<Capability>>(
    () => new Set<Capability>(["research"]),
  );
  const [skillProposals, setSkillProposals] = useState<SkillProposal[]>([]);
  const [skillsBusy, setSkillsBusy] = useState(false);
  const [generationBusy, setGenerationBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishedAgent, setPublishedAgent] = useState<AgentLifecycleVersion | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publicationUncertain, setPublicationUncertain] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);

  const agentLabel = slugifyLabel(name);
  const capabilities = useMemo(() => Array.from(selectedCapabilities).sort(), [selectedCapabilities]);
  const manifest = useMemo(
    () => previewManifest({ name, creatorParent, agentLabel, capabilities }),
    [agentLabel, capabilities, creatorParent, name],
  );
  const fullSubnamePreview = creatorParent.trim()
    ? `${agentLabel}.${creatorParent.trim().toLowerCase().replace(/\.eth$/, "")}.eth`
    : null;
  const canDefine = name.trim().length >= 2 && name.trim().length <= 80 && description.trim().length >= 10 && description.trim().length <= 800;
  const canContinueCapabilities = selectedCapabilities.size >= 1 && selectedCapabilities.size <= 3;
  const canContinueInstructions = instructions.trim().length >= 20 && instructions.trim().length <= 4_000;
  const canPublish = canContinueInstructions && creatorParent.trim().length >= 3 && canContinueCapabilities;
  const isBusy = generationBusy || publishBusy || skillsBusy;
  const activeStep = STEPS.findIndex((label) => label.toLowerCase() === step);

  function toggleCapability(capability: Capability): void {
    setSelectedCapabilities((current) => {
      const next = new Set(current);
      if (next.has(capability)) next.delete(capability);
      else if (next.size < 3) next.add(capability);
      return next;
    });
  }

  async function findSkillProposals(): Promise<void> {
    setSkillsBusy(true);
    setErrorMessage(null);
    try {
      const query = `${name} ${description}`.trim().slice(0, 120);
      const response = await fetch(`/api/marketplace/skills?q=${encodeURIComponent(query)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Skill proposals are unavailable.");
      const payload = await response.json() as { skills?: SkillProposal[] };
      setSkillProposals(Array.isArray(payload.skills) ? payload.skills : []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Skill proposals are unavailable.");
      setSkillProposals([]);
    } finally {
      setSkillsBusy(false);
    }
  }

  async function handleGenerate(): Promise<void> {
    if (!canDefine) return;
    setGenerationBusy(true);
    setErrorMessage(null);
    try {
      const result = await generateAgentInstructions(name.trim(), description.trim());
      setGenerated(result);
      setInstructions(result.markdown);
      setInstructionsEdited(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Instructions could not be generated.");
    } finally {
      setGenerationBusy(false);
    }
  }

  async function handlePublish(): Promise<void> {
    if (!canPublish) return;
    setErrorMessage(null);
    setPublicationUncertain(false);
    setPublishBusy(true);
    const idempotencyRoot = Date.now().toString(36);
    try {
      setPublishStatus("Creating protected draft");
      const draft = await createAgentDraft({
        name: name.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        capabilities,
      }, `${idempotencyRoot}-draft`);
      setPublishStatus("Binding canonical ENS name");
      const bound = await bindAgentName(draft.versionId, creatorParent.trim(), agentLabel, `${idempotencyRoot}-bind`);
      setPublishStatus("Preparing ENS write plan");
      await prepareAgentEnsWrite(bound.versionId, `${idempotencyRoot}-prepare`);
      setPublishStatus("Publishing immutable version");
      const published = await publishAgentVersion(bound.versionId, `${idempotencyRoot}-publish`);
      setPublishedAgent(published);
      setPublishStatus(null);
      onCreated?.(published);
    } catch (error) {
      const responseWasLost = error instanceof TypeError;
      setPublicationUncertain(responseWasLost);
      setErrorMessage(responseWasLost
        ? "The publication response was unavailable, so registry state is unknown. Close and refresh the registry before trying this draft again."
        : error instanceof Error ? error.message : "The agent could not be published.");
    } finally {
      setPublishBusy(false);
      setPublishStatus(null);
    }
  }

  const evidence = generated
    ? generationEvidence(generated, instructionsEdited)
    : { state: "unavailable" as const, label: "Manual draft" };

  return (
    <Dialog
      open
      title="Publish a protected agent"
      description="Define one immutable product, inspect its manifest, then ask the authenticated kernel to publish it."
      onClose={onClose}
      dismissible={!isBusy}
      className="max-w-5xl"
    >
      <StepRail active={activeStep} />

      <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.8fr)]">
        <div className="min-w-0">
          {step === "define" && (
            <section className="space-y-5" aria-labelledby="define-title">
              <div>
                <p className="instrument-label">Step 01</p>
                <h3 id="define-title" className="mt-2 text-2xl font-semibold tracking-tight text-void-100">Define the role</h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-void-500">Give buyers a precise name and explain the evidence this agent should handle.</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="agent-name" className="text-xs font-semibold text-void-300">Agent name</label>
                <input id="agent-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Evidence Researcher" className="min-h-12 w-full rounded-lg border border-void-800 bg-black px-3 text-sm text-void-100 placeholder:text-void-600 focus:border-dawg-500 focus:outline-none" />
                <FieldCount current={name.length} maximum={80} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="agent-description" className="text-xs font-semibold text-void-300">What should this agent do?</label>
                <textarea id="agent-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={800} rows={7} placeholder="Describe the evidence it should analyze and the decisions it should support." className="w-full resize-y rounded-lg border border-void-800 bg-black px-3 py-3 text-sm leading-relaxed text-void-100 placeholder:text-void-600 focus:border-dawg-500 focus:outline-none" />
                <FieldCount current={description.length} maximum={800} />
              </div>
              <div className="flex justify-end"><button type="button" onClick={() => setStep("capabilities")} disabled={!canDefine} className="instrument-button instrument-button-primary">Choose capabilities <ArrowRightIcon size={16} aria-hidden /></button></div>
            </section>
          )}

          {step === "capabilities" && (
            <section className="space-y-5" aria-labelledby="capabilities-title">
              <div>
                <p className="instrument-label">Step 02</p>
                <h3 id="capabilities-title" className="mt-2 text-2xl font-semibold tracking-tight text-void-100">Bound the capability surface</h3>
                <p className="mt-2 text-sm text-void-500">Select one to three protected capabilities. External topic matches remain proposals only.</p>
              </div>
              <fieldset className="grid gap-2 sm:grid-cols-3">
                <legend className="sr-only">Capabilities</legend>
                {CAPABILITIES.map((capability) => {
                  const selected = selectedCapabilities.has(capability.id);
                  return (
                    <button key={capability.id} type="button" role="checkbox" aria-checked={selected} onClick={() => toggleCapability(capability.id)} className={`min-h-32 rounded-xl border p-4 text-left transition-colors ${selected ? "border-dawg-500 bg-dawg-500/8" : "border-void-800 bg-black hover:border-void-700"}`}>
                      <span className="flex items-center justify-between gap-3 text-sm font-semibold text-void-100">
                        {capability.label}
                        <span className={`grid h-6 w-6 place-items-center rounded-md border ${selected ? "border-dawg-500 bg-dawg-500 text-black" : "border-void-700 text-transparent"}`}><CheckIcon size={14} weight="bold" aria-hidden /></span>
                      </span>
                      <span className="mt-3 block text-xs leading-relaxed text-void-500">{capability.detail}</span>
                    </button>
                  );
                })}
              </fieldset>
              <div className="rounded-xl border border-void-800 bg-void-950/50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-sm font-semibold text-void-200">Skill discovery</p><p className="mt-1 text-xs text-void-500">Queries public topic metadata only after you request it.</p></div>
                  <button type="button" onClick={() => void findSkillProposals()} disabled={skillsBusy} className="instrument-button instrument-button-secondary">
                    {skillsBusy ? <SpinnerGapIcon className="animate-spin" size={16} aria-hidden /> : <MagnifyingGlassIcon size={16} aria-hidden />}
                    {skillsBusy ? "Searching" : "Find proposal tags"}
                  </button>
                </div>
                {skillProposals.length > 0 && <ul className="mt-4 grid gap-2 sm:grid-cols-2">{skillProposals.map((proposal) => <li key={proposal.slug} className="rounded-lg border border-void-800 bg-black p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-void-200">{proposal.label}</span><span className="font-mono text-[9px] uppercase tracking-wider text-dawg-400">Proposal only</span></div>{proposal.description && <p className="mt-1 text-[11px] leading-relaxed text-void-500">{proposal.description}</p>}</li>)}</ul>}
              </div>
              <div className="flex justify-between gap-3"><button type="button" onClick={() => setStep("define")} className="instrument-button instrument-button-secondary"><ArrowLeftIcon size={16} aria-hidden /> Back</button><button type="button" onClick={() => setStep("instructions")} disabled={!canContinueCapabilities} className="instrument-button instrument-button-primary">Write instructions <ArrowRightIcon size={16} aria-hidden /></button></div>
            </section>
          )}

          {step === "instructions" && (
            <section className="space-y-5" aria-labelledby="instructions-title">
              <div>
                <p className="instrument-label">Step 03</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><h3 id="instructions-title" className="text-2xl font-semibold tracking-tight text-void-100">Instructions</h3><EvidenceStatus state={evidence.state} label={evidence.label} /></div>
                <p className="mt-2 text-sm text-void-500">Generate a draft, or write the full execution contract yourself.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleGenerate()} disabled={generationBusy} className="instrument-button instrument-button-primary">
                  {generationBusy ? <SpinnerGapIcon className="animate-spin" size={16} aria-hidden /> : <SparkleIcon size={16} aria-hidden />}
                  {generationBusy ? "Generating draft" : "Generate draft"}
                </button>
                <button type="button" onClick={() => { setGenerated(null); setInstructions(""); setInstructionsEdited(false); }} disabled={generationBusy} className="instrument-button instrument-button-secondary"><FileTextIcon size={16} aria-hidden /> Write instructions manually</button>
              </div>
              {generated && !instructionsEdited && generated.teeVerified === true && !generated.fallback && generated.attestationHash && <CopyableIdentifier label="Generation attestation" value={generated.attestationHash} />}
              <div className="space-y-1.5">
                <label htmlFor="agent-instructions" className="text-xs font-semibold text-void-300">Instructions</label>
                <textarea id="agent-instructions" value={instructions} onChange={(event) => { setInstructions(event.target.value); setInstructionsEdited(true); }} maxLength={4_000} rows={17} placeholder="State the evidence inputs, boundaries, refusal conditions, and expected result." className="w-full resize-y rounded-lg border border-void-800 bg-black px-3 py-3 font-mono text-xs leading-relaxed text-void-200 placeholder:text-void-600 focus:border-dawg-500 focus:outline-none" />
                <FieldCount current={instructions.length} maximum={4_000} />
              </div>
              <div className="flex justify-between gap-3"><button type="button" onClick={() => setStep("capabilities")} className="instrument-button instrument-button-secondary"><ArrowLeftIcon size={16} aria-hidden /> Back</button><button type="button" onClick={() => setStep("review")} disabled={!canContinueInstructions} className="instrument-button instrument-button-primary">Review manifest <ArrowRightIcon size={16} aria-hidden /></button></div>
            </section>
          )}

          {step === "review" && (
            <section className="space-y-5" aria-labelledby="review-title">
              <div><p className="instrument-label">Step 04</p><h3 id="review-title" className="mt-2 text-2xl font-semibold tracking-tight text-void-100">Review canonical identity</h3><p className="mt-2 text-sm text-void-500">Confirm the creator parent that will derive the agent subname. The server remains the publication authority.</p></div>
              <div className="space-y-1.5">
                <label htmlFor="creator-parent" className="text-xs font-semibold text-void-300">Your ENS name (creator parent)</label>
                <input id="creator-parent" value={creatorParent} onChange={(event) => setCreatorParent(event.target.value)} placeholder="creator.eth" className="min-h-12 w-full rounded-lg border border-void-800 bg-black px-3 text-sm text-void-100 placeholder:text-void-600 focus:border-dawg-500 focus:outline-none" />
                <p className="font-mono text-[11px] text-dawg-400">Agent subname: {fullSubnamePreview ?? `${agentLabel}.creator.eth`}</p>
              </div>
              <dl className="grid gap-px overflow-hidden rounded-xl border border-void-800 bg-void-800 sm:grid-cols-2">
                <div className="bg-black p-4"><dt className="instrument-label">Role</dt><dd className="mt-2 text-sm font-semibold text-void-100">{name}</dd></div>
                <div className="bg-black p-4"><dt className="instrument-label">Capability count</dt><dd className="mt-2 font-mono text-sm text-void-100">{capabilities.length}</dd></div>
                <div className="bg-black p-4"><dt className="instrument-label">Adapter</dt><dd className="mt-2 font-mono text-sm text-void-100">protected-a3</dd></div>
                <div className="bg-black p-4"><dt className="instrument-label">Proof policy</dt><dd className="mt-2 font-mono text-sm text-void-100">verified-receipt-required</dd></div>
              </dl>
              <div className="rounded-xl border border-dawg-500/25 bg-dawg-500/5 p-4 text-xs leading-relaxed text-void-400">Publishing creates an immutable registry version. It does not claim that runtime, storage, settlement, or receipt evidence exists for a future job.</div>
              <div className="flex justify-between gap-3"><button type="button" onClick={() => setStep("instructions")} className="instrument-button instrument-button-secondary"><ArrowLeftIcon size={16} aria-hidden /> Back</button><button type="button" onClick={() => setStep("publish")} disabled={!canPublish} className="instrument-button instrument-button-primary">Continue to publish <ArrowRightIcon size={16} aria-hidden /></button></div>
            </section>
          )}

          {step === "publish" && !publishedAgent && (
            <section className="space-y-5" aria-labelledby="publish-title">
              <div><p className="instrument-label">Step 05</p><h3 id="publish-title" className="mt-2 text-2xl font-semibold tracking-tight text-void-100">Publish immutable version</h3><p className="mt-2 text-sm leading-relaxed text-void-500">This calls the protected lifecycle in order: draft, name binding, ENS write plan, then publication.</p></div>
              <div className="rounded-xl border border-void-800 bg-black p-5">
                <div className="flex items-start gap-4"><ShieldCheckIcon size={28} className="shrink-0 text-dawg-400" aria-hidden /><div><p className="text-sm font-semibold text-void-100">Kernel authority required</p><p className="mt-1 text-xs leading-relaxed text-void-500">The response determines whether the version is canonical and hireable. A lost response is shown as unknown, never as published.</p></div></div>
              </div>
              {publishBusy && <div role="status" className="flex items-center gap-3 rounded-xl border border-dawg-500/30 bg-dawg-500/5 p-4 text-sm text-dawg-200"><SpinnerGapIcon className="animate-spin" size={20} aria-hidden /> {publishStatus ?? "Publishing"}</div>}
              <div className="flex justify-between gap-3"><button type="button" onClick={() => setStep("review")} disabled={publishBusy} className="instrument-button instrument-button-secondary"><ArrowLeftIcon size={16} aria-hidden /> Back</button><button type="button" onClick={() => void handlePublish()} disabled={!canPublish || publishBusy || publicationUncertain} className="instrument-button instrument-button-primary"><ShieldCheckIcon size={16} aria-hidden /> {publicationUncertain ? "Refresh registry before retry" : publishBusy ? "Publishing version" : "Publish immutable version"}</button></div>
            </section>
          )}

          {step === "publish" && publishedAgent && (
            <section className="space-y-5" aria-labelledby="receipt-title">
              <div className="flex items-start justify-between gap-3"><div><p className="instrument-label">Publication receipt</p><h3 id="receipt-title" className="mt-2 text-2xl font-semibold tracking-tight text-void-100">{publishedAgent.name}</h3><p className="mt-2 font-mono text-sm text-dawg-300">{publishedAgent.fullSubname ?? "Canonical subname unavailable"}</p></div><EvidenceStatus state={publishedAgent.hireable && publishedAgent.canonicalState === "CANONICAL" ? "verified" : "unavailable"} label={publishedAgent.lifecycleState} /></div>
              <dl className="grid gap-px overflow-hidden rounded-xl border border-void-800 bg-void-800 sm:grid-cols-2"><div className="min-w-0 bg-black p-4"><dt className="instrument-label">Version</dt><dd className="mt-2 font-mono text-sm text-void-100">{publishedAgent.version}</dd></div><div className="min-w-0 bg-black p-4"><dt className="instrument-label">Price</dt><dd className="mt-2 break-words font-mono text-sm text-void-100">{publishedAgent.priceAtomic} {publishedAgent.asset}</dd></div><div className="min-w-0 bg-black p-4"><dt className="instrument-label">Authority</dt><dd className="mt-2 break-all font-mono text-xs leading-relaxed text-void-100">{publishedAgent.authorityOwner ?? "Unavailable"}</dd></div><div className="min-w-0 bg-black p-4"><dt className="instrument-label">Published at</dt><dd className="mt-2 text-sm text-void-100">{publishedAgent.publishedAt ? new Date(publishedAgent.publishedAt).toLocaleString() : "Unavailable"}</dd></div></dl>
              <div className="grid min-w-0 gap-2 sm:grid-cols-2"><CopyableIdentifier label="Agent ID" value={publishedAgent.agentId} /><CopyableIdentifier label="Version ID" value={publishedAgent.versionId} /><CopyableIdentifier label="Owner wallet" value={publishedAgent.ownerWallet} /><CopyableIdentifier label="Manifest hash" value={publishedAgent.manifestHash} /></div>
              {publishedAgent.refusalReason && <p role="alert" className="rounded-xl border border-blood-500/30 bg-blood-900/20 p-4 font-mono text-xs text-blood-300">Exact refusal: {publishedAgent.refusalReason}</p>}
              <p className="text-xs leading-relaxed text-void-500">This receipt confirms the registry record only. Job execution and proof remain unavailable until separately evidenced.</p>
              <div className="flex justify-end"><button type="button" onClick={onClose} className="instrument-button instrument-button-primary">Close receipt</button></div>
            </section>
          )}

          {errorMessage && <p role="alert" className="mt-5 rounded-xl border border-blood-500/30 bg-blood-900/20 px-4 py-3 text-sm text-blood-300">{errorMessage}</p>}
        </div>

        <aside className="min-w-0 rounded-xl border border-void-800 bg-black p-4 lg:sticky lg:top-4 lg:self-start" aria-label="Manifest preview">
          <div className="relative mb-4 aspect-[16/9] overflow-hidden rounded-lg border border-void-800 bg-void-950"><Image src="/alphadawg-manifest-dog.png" alt="Gold dot matrix agent identity" fill sizes="(max-width: 1024px) 100vw, 320px" className="object-cover object-[center_40%] opacity-80" /></div>
          <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><CubeIcon size={17} className="text-dawg-400" aria-hidden /><h3 className="text-sm font-semibold text-void-100">Manifest preview</h3></div><span className="font-mono text-[9px] uppercase tracking-wider text-void-600">Deterministic</span></div>
          <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-void-800 bg-void-950 p-3 font-mono text-[10px] leading-relaxed text-void-400">{publishedAgent ? agentVersionToYaml(publishedAgent) : manifest}</pre>
          <p className="mt-3 text-[11px] leading-relaxed text-void-600">Preview values are not deployed proof. Only the protected API response can establish canonical publication.</p>
        </aside>
      </div>
    </Dialog>
  );
}
