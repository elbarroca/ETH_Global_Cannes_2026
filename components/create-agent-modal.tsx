"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  FileTextIcon,
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
  getAgentRecommendations,
  prepareAgentEnsWrite,
  publishAgentVersion,
  type AgentLifecycleVersion,
  type AgentRecommendation,
  type GeneratedInstructions,
} from "@/lib/api";
import { agentVersionToYaml } from "@/lib/manifest-yaml";

const CAPABILITIES = [
  { id: "market-analysis", label: "Market analysis", detail: "Analyze supplied market evidence and structure." },
  { id: "risk-analysis", label: "Risk analysis", detail: "Identify constraints, downside, and decision risk." },
  { id: "research", label: "Research", detail: "Synthesize evidence into a concise research response." },
] as const;

const STEPS = ["Define", "Review", "Publish"] as const;
type Capability = (typeof CAPABILITIES)[number]["id"];
type Step = "define" | "review" | "publish" | "receipt";

interface CreateAgentModalProps {
  onClose: () => void;
  onCreated?: (agent: AgentLifecycleVersion) => void;
}

function slugifyLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "agent";
}

function StepRail({ active }: { active: number }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Publication progress">
      {STEPS.map((label, index) => (
        <li key={label} className="min-w-0">
          <div className={`h-1 rounded-full ${index <= active ? "bg-dawg-500" : "bg-void-800"}`} />
          <span className={`mt-2 block text-[10px] font-semibold uppercase tracking-[0.12em] ${index === active ? "text-dawg-300" : "text-void-600"}`}>{index + 1}. {label}</span>
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
  const [selectedCapabilities, setSelectedCapabilities] = useState<Set<Capability>>(() => new Set(["research"]));
  const [recommendation, setRecommendation] = useState<AgentRecommendation | null>(null);
  const [preparedAgent, setPreparedAgent] = useState<AgentLifecycleVersion | null>(null);
  const [publishedAgent, setPublishedAgent] = useState<AgentLifecycleVersion | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publicationUncertain, setPublicationUncertain] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const agentLabel = slugifyLabel(name);
  const capabilities = useMemo(() => Array.from(selectedCapabilities).sort(), [selectedCapabilities]);
  const fullSubnamePreview = creatorParent.trim()
    ? `${agentLabel}.${creatorParent.trim().toLowerCase().replace(/\.eth$/, "")}.eth`
    : `${agentLabel}.creator.eth`;
  const canDefine = name.trim().length >= 2 && name.trim().length <= 80
    && description.trim().length >= 10 && description.trim().length <= 800
    && instructions.trim().length >= 20 && instructions.trim().length <= 4_000
    && capabilities.length >= 1 && capabilities.length <= 3
    && recommendation?.readiness === "READY";
  const canPrepare = canDefine && creatorParent.trim().length >= 3;
  const activeStep = step === "define" ? 0 : step === "review" ? 1 : 2;

  const preview = preparedAgent ? agentVersionToYaml(preparedAgent) : [
    "# proposed draft · server fields unavailable",
    "schema_version: 2",
    `name: ${name.trim() || "Untitled agent"}`,
    `ens_subname: ${fullSubnamePreview}`,
    `capabilities: [${capabilities.join(", ")}]`,
    "adapter: protected-a3",
    "price_atomic: server-owned",
    "owner_wallet: server-owned",
    "proof_policy: verified-receipt-required",
    "native_connections: [zero-g-compute, zero-g-storage]",
    "mcp: []",
  ].join("\n");

  function toggleCapability(capability: Capability): void {
    setRecommendation(null);
    setSelectedCapabilities((current) => {
      const next = new Set(current);
      if (next.has(capability)) next.delete(capability);
      else if (next.size < 3) next.add(capability);
      return next;
    });
  }

  async function reviewCapabilities(): Promise<void> {
    setBusy(true);
    setErrorMessage(null);
    try {
      const result = await getAgentRecommendations(capabilities);
      setRecommendation(result);
      if (result.readiness === "REFUSED") {
        setErrorMessage(`Recommendation refused: ${result.reasons.join(", ") || "No reason returned"}.`);
        return;
      }
      setInstructions(result.reviewedPromptDraft);
      setGenerated(null);
      setInstructionsEdited(false);
    } catch (error) {
      setRecommendation(null);
      setErrorMessage(error instanceof Error ? error.message : "Protected recommendations are unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function generateDraft(): Promise<void> {
    if (name.trim().length < 2 || description.trim().length < 10) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      const result = await generateAgentInstructions(name.trim(), description.trim());
      setGenerated(result);
      setInstructions(result.markdown);
      setInstructionsEdited(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Instructions could not be generated.");
    } finally {
      setBusy(false);
    }
  }

  async function prepareDraft(): Promise<void> {
    if (!canPrepare) return;
    setBusy(true);
    setErrorMessage(null);
    const requestRoot = crypto.randomUUID();
    try {
      setStatus("Saving protected draft");
      const draft = await createAgentDraft({ name: name.trim(), description: description.trim(), instructions: instructions.trim(), capabilities }, `${requestRoot}-draft`);
      setStatus("Binding canonical ENS name");
      const bound = await bindAgentName(draft.versionId, creatorParent.trim(), agentLabel, `${requestRoot}-bind`);
      setStatus("Preparing local-only ENS write plan");
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
      const published = await publishAgentVersion(preparedAgent.versionId, crypto.randomUUID());
      setPublishedAgent(published);
      setStep("receipt");
      onCreated?.(published);
    } catch (error) {
      const responseWasLost = error instanceof TypeError;
      setPublicationUncertain(responseWasLost);
      setErrorMessage(responseWasLost
        ? "The publication response was lost. Registry state is unknown; close and refresh before retrying."
        : error instanceof Error ? error.message : "Publication was refused.");
    } finally {
      setBusy(false);
    }
  }

  const generationEvidence = generated && !instructionsEdited && generated.teeVerified && !generated.fallback
    ? { state: "verified" as const, label: "Verified generation" }
    : { state: "unavailable" as const, label: instructionsEdited ? "Edited draft" : generated?.fallback ? "Fallback draft" : "Reviewed draft" };

  return (
    <Dialog open title="Publish a protected agent" description="Draft first. Review exact server-owned fields. Publish only after explicit confirmation." onClose={onClose} dismissible={!busy} className="max-w-5xl">
      <StepRail active={activeStep} />
      <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(17rem,0.8fr)]">
        <div className="min-w-0">
          {step === "define" && (
            <section className="space-y-5" aria-labelledby="define-agent-title">
              <div><p className="instrument-label">Step 01</p><h3 id="define-agent-title" className="mt-2 text-2xl font-semibold text-void-100">Define</h3><p className="mt-2 text-sm text-void-500">Bound the role, reviewed capabilities, and Markdown instructions.</p></div>
              <div className="space-y-1.5"><label htmlFor="agent-name" className="text-xs font-semibold text-void-300">Agent name</label><input id="agent-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className="min-h-12 w-full rounded-[10px] border border-void-800 bg-black px-3 text-sm text-void-100" /><FieldCount current={name.length} maximum={80} /></div>
              <div className="space-y-1.5"><label htmlFor="agent-description" className="text-xs font-semibold text-void-300">What should this agent do?</label><textarea id="agent-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={800} rows={4} className="w-full resize-y rounded-[10px] border border-void-800 bg-black px-3 py-3 text-sm text-void-100" /><FieldCount current={description.length} maximum={800} /></div>
              <fieldset className="grid gap-2 sm:grid-cols-3"><legend className="mb-2 text-xs font-semibold text-void-300">Capabilities</legend>{CAPABILITIES.map((capability) => { const selected = selectedCapabilities.has(capability.id); return <button key={capability.id} type="button" role="checkbox" aria-checked={selected} onClick={() => toggleCapability(capability.id)} className={`min-h-28 rounded-[10px] border p-3 text-left ${selected ? "border-dawg-500 bg-dawg-500/8" : "border-void-800 bg-black"}`}><span className="flex justify-between gap-2 text-sm font-semibold text-void-100">{capability.label}<CheckIcon size={15} className={selected ? "text-dawg-400" : "text-void-700"} aria-hidden /></span><span className="mt-2 block text-xs leading-relaxed text-void-500">{capability.detail}</span></button>; })}</fieldset>
              <button type="button" onClick={() => void reviewCapabilities()} disabled={busy || capabilities.length === 0} className="instrument-button instrument-button-secondary">{busy ? <SpinnerGapIcon className="animate-spin" size={16} aria-hidden /> : <ShieldCheckIcon size={16} aria-hidden />} Review selected capabilities</button>
              {recommendation && <div className="rounded-xl border border-void-800 bg-void-950 p-3 text-xs text-void-400"><p><span className="font-semibold text-void-200">Deterministic server review:</span> {recommendation.readiness}</p><p className="mt-1">Pinned skills: {recommendation.pinnedSkills.map((skill) => skill.id).join(", ") || "None"}</p><p className="mt-1">Native connections: {recommendation.nativeConnections.map((connection) => connection.id).join(", ") || "None"}</p><p className="mt-1">MCP: none</p></div>}
              <div className="flex flex-wrap items-center justify-between gap-2"><EvidenceStatus state={generationEvidence.state} label={generationEvidence.label} /><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void generateDraft()} disabled={busy} className="instrument-button instrument-button-secondary"><SparkleIcon size={16} aria-hidden /> Generate draft</button><button type="button" onClick={() => { setGenerated(null); setInstructions(""); setInstructionsEdited(false); }} className="instrument-button instrument-button-secondary"><FileTextIcon size={16} aria-hidden /> Write manually</button></div></div>
              <div className="space-y-1.5"><label htmlFor="agent-instructions" className="text-xs font-semibold text-void-300">Markdown instructions</label><textarea id="agent-instructions" value={instructions} onChange={(event) => { setInstructions(event.target.value); setInstructionsEdited(true); }} maxLength={4_000} rows={12} className="w-full resize-y rounded-[10px] border border-void-800 bg-black px-3 py-3 font-mono text-xs text-void-200" /><FieldCount current={instructions.length} maximum={4_000} /></div>
              <div className="flex justify-end"><button type="button" onClick={() => setStep("review")} disabled={!canDefine} className="instrument-button instrument-button-primary">Review identity <ArrowRightIcon size={16} aria-hidden /></button></div>
            </section>
          )}

          {step === "review" && (
            <section className="space-y-5" aria-labelledby="review-agent-title">
              <div><p className="instrument-label">Step 02</p><h3 id="review-agent-title" className="mt-2 text-2xl font-semibold text-void-100">Review</h3><p className="mt-2 text-sm text-void-500">Save the durable draft and bind its deterministic subname before publication.</p></div>
              <div className="space-y-1.5"><label htmlFor="creator-parent" className="text-xs font-semibold text-void-300">Your ENS name (creator parent)</label><input id="creator-parent" value={creatorParent} onChange={(event) => { setCreatorParent(event.target.value); setPreparedAgent(null); }} placeholder="maker.eth" className="min-h-12 w-full rounded-[10px] border border-void-800 bg-black px-3 text-sm text-void-100" /><p className="break-all font-mono text-[11px] text-dawg-400">Agent subname: {fullSubnamePreview}</p></div>
              {!preparedAgent ? <button type="button" onClick={() => void prepareDraft()} disabled={!canPrepare || busy} className="instrument-button instrument-button-primary">{busy ? <SpinnerGapIcon className="animate-spin" size={16} aria-hidden /> : <ShieldCheckIcon size={16} aria-hidden />}{status ?? "Prepare immutable draft"}</button> : <><div className="grid min-w-0 gap-2 sm:grid-cols-2"><CopyableIdentifier label="Owner wallet" value={preparedAgent.ownerWallet} /><CopyableIdentifier label="Version ID" value={preparedAgent.versionId} /><CopyableIdentifier label="Manifest hash" value={preparedAgent.manifestHash} /><CopyableIdentifier label="Prompt hash" value={preparedAgent.promptHash} /><CopyableIdentifier label="Config hash" value={preparedAgent.configHash} /><CopyableIdentifier label="Agent subname" value={preparedAgent.fullSubname ?? "Unavailable"} /></div><dl className="grid gap-2 text-xs sm:grid-cols-2"><div className="rounded-xl border border-void-800 p-3"><dt className="text-void-600">Price</dt><dd className="mt-1 font-mono text-void-200">{preparedAgent.priceAtomic} {preparedAgent.asset}</dd></div><div className="rounded-xl border border-void-800 p-3"><dt className="text-void-600">Proof policy</dt><dd className="mt-1 font-mono text-void-200">{preparedAgent.proofPolicy}</dd></div></dl></>}
              <div className="flex justify-between gap-3"><button type="button" onClick={() => setStep("define")} className="instrument-button instrument-button-secondary"><ArrowLeftIcon size={16} aria-hidden /> Back</button><button type="button" onClick={() => setStep("publish")} disabled={!preparedAgent} className="instrument-button instrument-button-primary">Continue to publish <ArrowRightIcon size={16} aria-hidden /></button></div>
            </section>
          )}

          {step === "publish" && preparedAgent && (
            <section className="space-y-5" aria-labelledby="publish-agent-title"><div><p className="instrument-label">Step 03</p><h3 id="publish-agent-title" className="mt-2 text-2xl font-semibold text-void-100">Publish immutable version</h3><p className="mt-2 text-sm text-void-500">This activates the exact reviewed application version. It does not prove runtime, storage, settlement, or delivery.</p></div><div className="rounded-xl border border-dawg-500/25 bg-dawg-500/5 p-4 text-sm text-void-300">Final publication requires protected server authority. A refusal remains visible; a lost response remains unknown.</div><div className="flex justify-between gap-3"><button type="button" onClick={() => setStep("review")} disabled={busy} className="instrument-button instrument-button-secondary"><ArrowLeftIcon size={16} aria-hidden /> Back</button><button type="button" onClick={() => void publish()} disabled={busy || publicationUncertain} className="instrument-button instrument-button-primary"><ShieldCheckIcon size={16} aria-hidden /> {publicationUncertain ? "Refresh registry before retry" : busy ? "Publishing version" : "Publish immutable version"}</button></div></section>
          )}

          {step === "receipt" && publishedAgent && (
            <section className="space-y-5" aria-labelledby="publication-receipt-title"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="instrument-label">Publication receipt</p><h3 id="publication-receipt-title" className="mt-2 text-2xl font-semibold text-void-100">{publishedAgent.name}</h3><p className="mt-2 break-all font-mono text-sm text-dawg-300">{publishedAgent.fullSubname ?? "Canonical subname unavailable"}</p></div><EvidenceStatus state={publishedAgent.hireable && publishedAgent.canonicalState === "CANONICAL" ? "verified" : "unavailable"} label={publishedAgent.lifecycleState} /></div><div className="grid min-w-0 gap-2 sm:grid-cols-2"><CopyableIdentifier label="Agent ID" value={publishedAgent.agentId} /><CopyableIdentifier label="Version ID" value={publishedAgent.versionId} /><CopyableIdentifier label="Owner wallet" value={publishedAgent.ownerWallet} /><CopyableIdentifier label="Manifest hash" value={publishedAgent.manifestHash} /></div><p className="text-xs leading-relaxed text-void-500">Registry receipt only. Job execution and proof remain unavailable until separately evidenced.</p></section>
          )}

          {errorMessage && <div role="alert" className="mt-5 rounded-xl border border-blood-500/30 bg-blood-900/20 p-3 text-sm text-blood-300">{errorMessage}</div>}
        </div>
        <aside className="min-w-0 rounded-xl border border-void-800 bg-black p-4 lg:sticky lg:top-4 lg:self-start" aria-label="Manifest v2 preview"><div className="flex items-center justify-between gap-2"><p className="instrument-label">Manifest v2</p><span className="font-mono text-[10px] text-void-600">{preparedAgent ? "Server returned" : "Proposed"}</span></div><pre className="mt-4 max-h-[34rem] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-void-800 bg-void-950 p-3 font-mono text-[10px] leading-relaxed text-void-400">{preview}</pre></aside>
      </div>
    </Dialog>
  );
}
