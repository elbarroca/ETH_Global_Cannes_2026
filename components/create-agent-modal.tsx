"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { CopyableIdentifier, EvidenceStatus } from "@/components/ui/evidence";
import {
  generateAgentInstructions,
  publishKernelAgent,
  type GeneratedInstructions,
  type PublishedAgent,
} from "@/lib/api";

const CAPABILITIES = [
  {
    id: "market-analysis",
    label: "Market analysis",
    detail: "Analyze market structure and supplied market evidence.",
  },
  {
    id: "risk-analysis",
    label: "Risk analysis",
    detail: "Identify constraints, downside, and decision risk.",
  },
  {
    id: "research",
    label: "Research",
    detail: "Synthesize evidence into a concise research response.",
  },
] as const;

type Capability = (typeof CAPABILITIES)[number]["id"];
type Step = "define" | "generating" | "review" | "publishing" | "published";

interface CreateAgentModalProps {
  onClose: () => void;
  onCreated?: (agent: PublishedAgent) => void;
}

function generationEvidence(
  generated: GeneratedInstructions,
  instructionsEdited: boolean,
): { state: "verified" | "unavailable"; label: string } {
  if (instructionsEdited) {
    return { state: "unavailable", label: "Edited draft · provenance cleared" };
  }
  if (generated.fallback) {
    return { state: "unavailable", label: "Fallback draft" };
  }
  if (generated.teeVerified === true) {
    return { state: "verified", label: "Verified generation" };
  }
  return { state: "unavailable", label: "Unverified generation" };
}

export function CreateAgentModal({ onClose, onCreated }: CreateAgentModalProps) {
  const [step, setStep] = useState<Step>("define");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [generated, setGenerated] = useState<GeneratedInstructions | null>(null);
  const [instructionsEdited, setInstructionsEdited] = useState(false);
  const [selectedCapabilities, setSelectedCapabilities] = useState<Set<Capability>>(
    () => new Set<Capability>(["research"]),
  );
  const [publishedAgent, setPublishedAgent] = useState<PublishedAgent | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publicationUncertain, setPublicationUncertain] = useState(false);

  const isBusy = step === "generating" || step === "publishing";
  const canGenerate =
    name.trim().length >= 2 &&
    name.trim().length <= 80 &&
    description.trim().length >= 10 &&
    description.trim().length <= 800 &&
    selectedCapabilities.size >= 1 &&
    selectedCapabilities.size <= 3;
  const canPublish =
    instructions.trim().length >= 20 &&
    instructions.trim().length <= 4_000 &&
    selectedCapabilities.size >= 1 &&
    selectedCapabilities.size <= 3;

  function toggleCapability(capability: Capability): void {
    setSelectedCapabilities((current) => {
      const next = new Set(current);
      if (next.has(capability)) next.delete(capability);
      else next.add(capability);
      return next;
    });
  }

  async function handleGenerate(): Promise<void> {
    if (!canGenerate) return;
    setErrorMessage(null);
    setStep("generating");
    try {
      const result = await generateAgentInstructions(name.trim(), description.trim());
      setGenerated(result);
      setInstructions(result.markdown);
      setInstructionsEdited(false);
      setStep("review");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Instructions could not be generated.");
      setStep("define");
    }
  }

  function handleManualDraft(): void {
    if (!canGenerate) return;
    setErrorMessage(null);
    setGenerated(null);
    setInstructions("");
    setInstructionsEdited(false);
    setStep("review");
  }

  async function handlePublish(): Promise<void> {
    if (!canPublish) return;
    setErrorMessage(null);
    setPublicationUncertain(false);
    setStep("publishing");
    try {
      const agent = await publishKernelAgent({
        name: name.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        capabilities: Array.from(selectedCapabilities).sort(),
      });
      setPublishedAgent(agent);
      setStep("published");
      onCreated?.(agent);
    } catch (error) {
      const responseWasLost = error instanceof TypeError;
      setPublicationUncertain(responseWasLost);
      setErrorMessage(responseWasLost
        ? "The publication response was unavailable, so registry state is unknown. Close and refresh the registry before trying this draft again."
        : error instanceof Error
          ? error.message
          : "The agent could not be published.");
      setStep("review");
    }
  }

  const evidence = generated
    ? generationEvidence(generated, instructionsEdited)
    : { state: "unavailable" as const, label: "Manual draft" };

  return (
    <Dialog
      open
      title="Publish a protected agent"
      description="Define the role, review its instructions, then publish an immutable version. Ownership and commercial policy are assigned by the authenticated server."
      onClose={onClose}
      dismissible={!isBusy}
      className="max-w-2xl"
    >
      <div className="mb-5 grid grid-cols-3 gap-2" aria-label="Publication progress">
        {(["Define", "Review", "Publish"] as const).map((label, index) => {
          const activeIndex = step === "define" || step === "generating"
            ? 0
            : step === "review"
              ? 1
              : 2;
          return (
            <div key={label} className="min-w-0">
              <div className={`h-1 rounded-full ${index <= activeIndex ? "bg-dawg-500" : "bg-void-800"}`} />
              <span className={`mt-1.5 block text-[10px] font-semibold uppercase tracking-wider ${index === activeIndex ? "text-dawg-300" : "text-void-600"}`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {(step === "define" || step === "generating") && (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="agent-name" className="text-xs font-semibold text-void-300">
              Agent name
            </label>
            <input
              id="agent-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              disabled={isBusy}
              placeholder="Evidence Researcher"
              className="min-h-11 w-full rounded-xl border border-void-800 bg-void-950 px-3 text-sm text-void-100 placeholder:text-void-600 focus:border-dawg-500 focus:outline-none"
            />
            <p className="text-right font-mono text-[10px] text-void-600">{name.length} / 80</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="agent-description" className="text-xs font-semibold text-void-300">
              What should this agent do?
            </label>
            <textarea
              id="agent-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={800}
              rows={4}
              disabled={isBusy}
              placeholder="Describe the evidence it should analyze and the decisions it should support."
              className="w-full resize-y rounded-xl border border-void-800 bg-void-950 px-3 py-2.5 text-sm leading-relaxed text-void-100 placeholder:text-void-600 focus:border-dawg-500 focus:outline-none"
            />
            <p className="text-right font-mono text-[10px] text-void-600">{description.length} / 800</p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-void-300">Capabilities</legend>
            <p className="text-xs text-void-600">Choose one to three protected capabilities.</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {CAPABILITIES.map((capability) => {
                const selected = selectedCapabilities.has(capability.id);
                return (
                  <button
                    key={capability.id}
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    disabled={isBusy}
                    onClick={() => toggleCapability(capability.id)}
                    className={`min-h-24 rounded-xl border p-3 text-left transition-colors ${selected ? "border-dawg-500/60 bg-dawg-500/10" : "border-void-800 bg-void-950 hover:border-void-700"}`}
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold text-void-100">
                      <span className={`grid h-4 w-4 place-items-center rounded border text-[10px] ${selected ? "border-dawg-500 bg-dawg-500 text-black" : "border-void-700"}`} aria-hidden="true">
                        {selected ? "✓" : ""}
                      </span>
                      {capability.label}
                    </span>
                    <span className="mt-2 block text-[11px] leading-relaxed text-void-500">
                      {capability.detail}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {errorMessage && (
            <p role="alert" className="rounded-xl border border-blood-500/30 bg-blood-900/25 px-3 py-2 text-sm text-blood-300">
              {errorMessage}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={isBusy} className="min-h-11 rounded-xl border border-void-700 px-4 text-sm font-semibold text-void-300 hover:bg-void-800 disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={handleManualDraft} disabled={!canGenerate || isBusy} className="min-h-11 rounded-xl border border-dawg-500/40 px-4 text-sm font-semibold text-dawg-300 hover:bg-dawg-500/10 disabled:cursor-not-allowed disabled:opacity-45">
              Write instructions manually
            </button>
            <button type="button" onClick={handleGenerate} disabled={!canGenerate || isBusy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-dawg-500 px-5 text-sm font-bold text-black hover:bg-dawg-400 disabled:cursor-not-allowed disabled:opacity-45">
              {step === "generating" && <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" aria-hidden="true" />}
              {step === "generating" ? "Generating draft…" : "Generate draft"}
            </button>
          </div>
        </div>
      )}

      {(step === "review" || step === "publishing") && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-void-800 bg-void-950/55 p-3">
            <div>
              <p className="text-sm font-semibold text-void-100">{name}</p>
              <p className="mt-0.5 text-xs text-void-500">Review every instruction before publishing.</p>
            </div>
            <EvidenceStatus state={evidence.state} label={evidence.label} />
          </div>

          {generated && !instructionsEdited && generated.teeVerified === true && !generated.fallback && generated.attestationHash && (
            <CopyableIdentifier label="Generation attestation" value={generated.attestationHash} />
          )}

          <div className="space-y-1.5">
            <label htmlFor="agent-instructions" className="text-xs font-semibold text-void-300">
              Instructions
            </label>
            <textarea
              id="agent-instructions"
              value={instructions}
              onChange={(event) => {
                setInstructions(event.target.value);
                setInstructionsEdited(true);
              }}
              maxLength={4_000}
              rows={14}
              disabled={isBusy}
              className="w-full resize-y rounded-xl border border-void-800 bg-void-950 px-3 py-2.5 font-mono text-xs leading-relaxed text-void-200 focus:border-dawg-500 focus:outline-none"
            />
            <p className="text-right font-mono text-[10px] text-void-600">{instructions.length} / 4,000</p>
          </div>

          <div className="rounded-xl border border-dawg-500/20 bg-dawg-500/5 p-3 text-xs leading-relaxed text-void-400">
            Publishing creates an immutable version. It does not claim that a runtime is available; compute, storage, ENS, receipt, and financial evidence are evaluated per submitted job.
          </div>

          {errorMessage && (
            <p role="alert" className="rounded-xl border border-blood-500/30 bg-blood-900/25 px-3 py-2 text-sm text-blood-300">
              {errorMessage}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setStep("define")} disabled={isBusy} className="min-h-11 rounded-xl border border-void-700 px-4 text-sm font-semibold text-void-300 hover:bg-void-800 disabled:opacity-50">
              Back
            </button>
            <button type="button" onClick={handlePublish} disabled={!canPublish || isBusy || publicationUncertain} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-dawg-500 px-5 text-sm font-bold text-black hover:bg-dawg-400 disabled:cursor-not-allowed disabled:opacity-45">
              {step === "publishing" && <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" aria-hidden="true" />}
              {step === "publishing"
                ? "Publishing version…"
                : publicationUncertain
                  ? "Refresh registry before retry"
                  : "Publish immutable version"}
            </button>
          </div>
        </div>
      )}

      {step === "published" && publishedAgent && (
        <div className="space-y-5">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-lg font-bold text-void-100">{publishedAgent.name}</p>
                <p className="mt-1 text-sm text-void-400">Immutable version {publishedAgent.version} is published.</p>
              </div>
              <EvidenceStatus state="verified" label="Published" />
            </div>
          </div>

          <dl className="grid gap-2 rounded-xl border border-void-800 bg-void-950/45 p-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="uppercase tracking-wider text-void-600">Price</dt>
              <dd className="mt-1 font-mono text-void-200">{publishedAgent.priceAtomic} {publishedAgent.asset}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wider text-void-600">Published at</dt>
              <dd className="mt-1 text-void-200">{new Date(publishedAgent.publishedAt).toLocaleString()}</dd>
            </div>
          </dl>

          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            <CopyableIdentifier label="Agent ID" value={publishedAgent.agentId} />
            <CopyableIdentifier label="Version ID" value={publishedAgent.versionId} />
            <CopyableIdentifier label="Owner wallet" value={publishedAgent.ownerWallet} />
            <CopyableIdentifier label="Manifest hash" value={publishedAgent.manifestHash} />
            <CopyableIdentifier label="Prompt hash" value={publishedAgent.promptHash} />
            <CopyableIdentifier label="Config hash" value={publishedAgent.configHash} />
          </div>

          <p className="text-xs leading-relaxed text-void-500">
            Published status confirms the immutable registry record only. Runtime and proof status will be reported on each job.
          </p>

          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-dawg-500 px-5 text-sm font-bold text-black hover:bg-dawg-400">
              Close receipt
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
