"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useAccount } from "wagmi";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowSquareOutIcon,
  CheckIcon,
  DatabaseIcon,
  MagnifyingGlassIcon,
  PlugsConnectedIcon,
  ShieldCheckIcon,
  SpinnerGapIcon,
  WalletIcon,
} from "@phosphor-icons/react";
import { Dialog } from "@/components/ui/dialog";
import { CopyableIdentifier, EvidenceStatus } from "@/components/ui/evidence";
import {
  ApiError,
  attachAgentWallet,
  createAgentDraft,
  generateAgentInstructions,
  getAgentCatalog,
  publishWalletAgentVersion,
  type AgentCapability,
  type AgentCatalogAvailability,
  type AgentCatalogProjection,
  type AgentLifecycleVersion,
  type CreatorMcpBindingInput,
} from "@/lib/api";
import { formatUsdcAtomic } from "@/lib/format-usdc";

const STAGES = ["Identity + prompt", "Skills + MCP", "Agent wallet", "Publish + receipt"] as const;
type Stage = 0 | 1 | 2 | 3;
type LostOperation = "draft" | "wallet" | "publish" | null;

const CAPABILITIES: ReadonlyArray<{ id: AgentCapability; label: string; description: string }> = [
  { id: "research", label: "Research", description: "Collect and synthesize bounded source evidence." },
  { id: "market-analysis", label: "Market analysis", description: "Compare market conditions without claiming execution." },
  { id: "risk-analysis", label: "Risk analysis", description: "Test constraints, exposure, and refusal conditions." },
  { id: "uniswap-swap", label: "Swap proposal", description: "Prepare a proposal that still requires wallet approval." },
];

const MCP_BINDINGS: ReadonlyArray<CreatorMcpBindingInput & { label: string; description: string }> = [
  { provider: "coingecko", capability: "spot-price", label: "CoinGecko spot price", description: "Read a bounded current price snapshot." },
  { provider: "coingecko", capability: "market-snapshot", label: "CoinGecko market snapshot", description: "Read bounded market metrics for comparison." },
  { provider: "the-graph", capability: "pinned-deployment-lookup", label: "The Graph deployment lookup", description: "Resolve only the pinned deployment identity." },
  { provider: "the-graph", capability: "liquidity-volume-snapshot", label: "The Graph liquidity and volume", description: "Read the fixed liquidity-volume snapshot." },
];

interface CreateAgentModalProps {
  onClose: () => void;
  onCreated?: (agent: AgentLifecycleVersion) => void;
}

function FieldCount({ current, minimum, maximum }: { current: number; minimum: number; maximum: number }) {
  return <p className="mt-2 text-right font-mono text-xs text-void-500 tnums">{current} / {maximum.toLocaleString()} <span className="text-void-600">(min {minimum})</span></p>;
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

function CatalogLoading() {
  return <div role="status" aria-label="Loading approved agent stack" className="mt-6 space-y-3"><div className="h-12 animate-pulse rounded-[10px] bg-void-800" /><div className="h-24 animate-pulse rounded-[10px] bg-void-800" /><div className="h-24 animate-pulse rounded-[10px] bg-void-800" /></div>;
}

function PreviewRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="border-t border-void-800 pt-3"><dt className="font-semibold text-void-500">{label}</dt><dd className={`mt-1 break-words text-void-200 ${mono ? "font-mono" : ""}`}>{value}</dd></div>;
}

function bindingKey(binding: CreatorMcpBindingInput): string {
  return `${binding.provider}:${binding.capability}`;
}

function approvedCapabilities(catalog: AgentCatalogProjection | undefined): readonly AgentCapability[] {
  if (!catalog) return [];
  const enumerated = new Set(catalog.templates.flatMap((template) => template.capabilities));
  return CAPABILITIES.map((capability) => capability.id).filter((capability) => enumerated.has(capability));
}

function approvedBindings(catalog: AgentCatalogProjection | undefined): typeof MCP_BINDINGS {
  if (!catalog) return [];
  return MCP_BINDINGS.filter((binding) => catalog.mcpProviders.some((provider) =>
    provider.provider === binding.provider && provider.capabilities.includes(binding.capability),
  ));
}

function providerAvailability(catalog: AgentCatalogProjection, providerId: string): AgentCatalogAvailability {
  return catalog.mcpProviders.find((provider) => provider.provider === providerId)?.availability ?? "UNAVAILABLE";
}

function instructionsRefusal(instructions: string): string | null {
  const value = instructions.trim();
  if (value.length < 20 || value.length > 4_000) return "INSTRUCTIONS_LENGTH_REFUSED: Instructions must be 20-4,000 characters.";
  if (value.includes("\0") || /<\/?[a-z][^>]*>/i.test(value) || /!\[[^\]]*\]\(/.test(value) || /(?:javascript|data):/i.test(value) || /https?:\/\//i.test(value) || /```|~~~|^\s*#!/m.test(value)) {
    return "INSTRUCTIONS_ACTIVE_CONTENT_REFUSED: Use inert Markdown without HTML, images, URLs, active schemes, code fences, or shebangs.";
  }
  return null;
}

function hasWalletEvidence(version: AgentLifecycleVersion | null): version is AgentLifecycleVersion & { agentWallet: NonNullable<AgentLifecycleVersion["agentWallet"]> } {
  const wallet = version?.agentWallet;
  return Boolean(wallet && wallet.provider === "circle" && wallet.network === "UNI-SEPOLIA" && wallet.accountType === "SCA" && wallet.state === "LIVE" && wallet.address && wallet.evidenceHash && wallet.identityHash);
}

function isEligibleWalletPublication(version: AgentLifecycleVersion | null): boolean {
  return Boolean(
    hasWalletEvidence(version) &&
    version.lifecycleState === "PUBLISHED" &&
    version.publicationMode === "WALLET" &&
    version.hireable === true &&
    version.authorityState === "WALLET_AUTHORIZED" &&
    version.canonicalState === "WALLET_AUTHORIZED" &&
    version.walletPublicationDecisionId &&
    version.walletReceiptHash,
  );
}

function operationError(error: unknown): string {
  if (error instanceof ApiError && error.code === "KERNEL_SCHEMA_NOT_READY") {
    return "KERNEL_SCHEMA_NOT_READY: Database update required. The wallet-authority migration must be applied by an operator before retrying.";
  }
  if (error instanceof ApiError) return `${error.code ?? "REQUEST_REFUSED"}: ${error.message}`;
  return error instanceof Error ? error.message : "REQUEST_REFUSED: The protected action was refused.";
}

function StackPreview({
  name,
  description,
  instructions,
  capabilities,
  mcp,
  version,
}: {
  name: string;
  description: string;
  instructions: string;
  capabilities: readonly AgentCapability[];
  mcp: readonly CreatorMcpBindingInput[];
  version: AgentLifecycleVersion | null;
}) {
  return (
    <dl className="mt-4 space-y-3 text-xs">
      <PreviewRow label="Name" value={name.trim() || "Not set"} />
      <PreviewRow label="Description" value={description.trim() || "Not set"} />
      <PreviewRow label="Prompt" value={instructions.trim() ? `${instructions.trim().length} inert Markdown characters` : "Not set"} />
      <PreviewRow label="Agent skills" value={capabilities.length ? capabilities.join(", ") : "Select 1-3"} />
      <PreviewRow label="MCP servers" value={mcp.length ? mcp.map(bindingKey).join(", ") : "No server binding selected"} mono />
      <PreviewRow label="Price" value={version ? formatUsdcAtomic(version.priceAtomic) : "Server-set on the immutable version"} mono={Boolean(version)} />
      {version && <><PreviewRow label="Version ID" value={version.versionId} mono /><PreviewRow label="Manifest" value={`v${version.manifestSchemaVersion} ${version.manifestHash}`} mono /></>}
    </dl>
  );
}

export function CreateAgentModal({ onClose, onCreated }: CreateAgentModalProps) {
  const { address } = useAccount();
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [capabilities, setCapabilities] = useState<AgentCapability[]>([]);
  const [mcp, setMcp] = useState<CreatorMcpBindingInput[]>([]);
  const [stackSearch, setStackSearch] = useState("");
  const [draftAgent, setDraftAgent] = useState<AgentLifecycleVersion | null>(null);
  const [walletAgent, setWalletAgent] = useState<AgentLifecycleVersion | null>(null);
  const [publishedAgent, setPublishedAgent] = useState<AgentLifecycleVersion | null>(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lostOperation, setLostOperation] = useState<LostOperation>(null);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [generationEvidence, setGenerationEvidence] = useState<{ teeVerified: boolean; attestationHash: string | null } | null>(null);
  const stageFocusRef = useRef<HTMLDivElement>(null);
  const initialStageRef = useRef(true);
  const requestKeysRef = useRef<{ draft: string; wallet: string; publish: string } | null>(null);
  const catalog = useQuery({ queryKey: ["protected-agent-catalog"], queryFn: ({ signal }) => getAgentCatalog(signal), retry: false });

  const availableCapabilities = useMemo(() => approvedCapabilities(catalog.data), [catalog.data]);
  const availableBindings = useMemo(() => approvedBindings(catalog.data), [catalog.data]);
  const query = stackSearch.trim().toLowerCase();
  const filteredCapabilities = CAPABILITIES.filter((capability) => availableCapabilities.includes(capability.id) && `${capability.label} ${capability.description}`.toLowerCase().includes(query));
  const filteredBindings = availableBindings.filter((binding) => `${binding.label} ${binding.provider} ${binding.capability} ${binding.description}`.toLowerCase().includes(query));
  const promptRefusal = instructionsRefusal(instructions);
  const identityValid = name.trim().length >= 2 && name.trim().length <= 80 && description.trim().length >= 10 && description.trim().length <= 800 && promptRefusal === null;
  const stackValid = capabilities.length >= 1 && capabilities.length <= 3 && mcp.length <= 4;
  const currentVersion = publishedAgent ?? walletAgent ?? draftAgent;
  const walletReady = hasWalletEvidence(walletAgent);
  const publicationEligible = isEligibleWalletPublication(publishedAgent);

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

  function resetServerState(): void {
    setDraftAgent(null);
    setWalletAgent(null);
    setPublishedAgent(null);
    setLostOperation(null);
    setErrorMessage(null);
    requestKeysRef.current = null;
  }

  function requestKeys(): { draft: string; wallet: string; publish: string } {
    if (!requestKeysRef.current) {
      const root = crypto.randomUUID();
      requestKeysRef.current = { draft: `${root}-draft`, wallet: `${root}-wallet`, publish: `${root}-publish` };
    }
    return requestKeysRef.current;
  }

  function toggleCapability(capability: AgentCapability): void {
    resetServerState();
    setCapabilities((selected) => selected.includes(capability)
      ? selected.filter((item) => item !== capability)
      : selected.length < 3 ? [...selected, capability] : selected);
  }

  function toggleBinding(binding: CreatorMcpBindingInput): void {
    resetServerState();
    const key = bindingKey(binding);
    const exactBinding = { provider: binding.provider, capability: binding.capability } as CreatorMcpBindingInput;
    setMcp((selected) => selected.some((item) => bindingKey(item) === key)
      ? selected.filter((item) => bindingKey(item) !== key)
      : selected.length < 4 ? [...selected, exactBinding] : selected);
  }

  async function generateInstructions(): Promise<void> {
    if (name.trim().length < 2 || description.trim().length < 10) return;
    setGenerating(true);
    setGenerationMessage(null);
    setGenerationEvidence(null);
    try {
      const generated = await generateAgentInstructions(name.trim(), description.trim());
      if (generated.fallback) {
        setGenerationMessage("0G unavailable; no generated prompt was applied");
        return;
      }
      const refusal = instructionsRefusal(generated.markdown);
      if (refusal) {
        setGenerationMessage(`0G_RESPONSE_REFUSED: ${refusal}`);
        return;
      }
      const attestationHash = generated.attestationHash && /^[0-9a-f]{64}$/i.test(generated.attestationHash)
        ? generated.attestationHash
        : null;
      setInstructions(generated.markdown.trim());
      setGenerationEvidence({ teeVerified: generated.teeVerified, attestationHash });
      setGenerationMessage(generated.teeVerified ? "TEE verified" : "TEE unverified");
      resetServerState();
    } catch {
      setGenerationMessage("0G unavailable; no generated prompt was applied");
    } finally {
      setGenerating(false);
    }
  }

  async function provisionWallet(): Promise<void> {
    if (!identityValid || !stackValid || !address) return;
    setBusy(true);
    setErrorMessage(null);
    setLostOperation(null);
    const keys = requestKeys();
    let draft = draftAgent;
    try {
      if (!draft) {
        setStatus("Saving immutable draft");
        try {
          draft = await createAgentDraft({ name: name.trim(), description: description.trim(), instructions: instructions.trim(), capabilities, mcp }, keys.draft);
          setDraftAgent(draft);
        } catch (error) {
          if (error instanceof TypeError) setLostOperation("draft");
          throw error;
        }
      }
      setStatus("Provisioning Circle agent wallet");
      try {
        const attached = await attachAgentWallet(draft.versionId, keys.wallet);
        if (!hasWalletEvidence(attached)) throw new Error("WALLET_EVIDENCE_INCOMPLETE: Server response omitted required Circle wallet evidence.");
        setWalletAgent(attached);
      } catch (error) {
        if (error instanceof TypeError) setLostOperation("wallet");
        throw error;
      }
    } catch (error) {
      setErrorMessage(error instanceof TypeError
        ? "RESPONSE_LOST: The result is unknown. No new request will be created; recover with the same idempotency key."
        : operationError(error));
    } finally {
      setStatus(null);
      setBusy(false);
    }
  }

  async function publish(): Promise<void> {
    if (!walletReady) return;
    setBusy(true);
    setErrorMessage(null);
    setLostOperation(null);
    try {
      const published = await publishWalletAgentVersion(walletAgent.versionId, requestKeys().publish);
      setPublishedAgent(published);
      if (!isEligibleWalletPublication(published)) {
        setErrorMessage(published.refusalReason ?? "WALLET_PUBLICATION_EVIDENCE_INCOMPLETE: Missing server WALLET_AUTHORIZED decision or receipt evidence.");
      }
    } catch (error) {
      if (error instanceof TypeError) {
        setLostOperation("publish");
        setErrorMessage("RESPONSE_LOST: Publication state is unknown. Recover the receipt with the same idempotency key before any new attempt.");
      } else {
        setErrorMessage(operationError(error));
      }
    } finally {
      setBusy(false);
    }
  }

  function finish(): void {
    if (publicationEligible && publishedAgent) onCreated?.(publishedAgent);
    else onClose();
  }

  return (
    <Dialog open title="Create a protected agent" description="Define inert instructions, attach approved skills and MCP bindings, provision an agent wallet, then publish the exact immutable version." onClose={publicationEligible ? finish : onClose} dismissible={!busy} className="max-w-5xl">
      <StageRail active={stage} />
      <div className="mt-4 grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(17rem,0.65fr)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div data-testid="agent-stage" key={stage} ref={stageFocusRef} tabIndex={-1} initial={reduceMotion ? false : { opacity: 0, x: direction * 18 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: direction * -12 }} transition={{ duration: reduceMotion ? 0 : 0.18 }} className="min-w-0 pb-4 focus:outline-none">
            {stage === 0 && (
              <section aria-labelledby="agent-identity-title">
                <h3 id="agent-identity-title" className="text-2xl font-semibold tracking-tight text-void-100">Identity + prompt</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-void-400">Write inert Markdown instructions for one bounded role. The protected runtime never executes uploaded or embedded code.</p>
                <div className="mt-6 space-y-5">
                  <label className="block text-sm font-semibold text-void-200" htmlFor="agent-name">Agent name<input id="agent-name" value={name} onChange={(event) => { setName(event.target.value); setGenerationEvidence(null); setGenerationMessage(null); resetServerState(); }} maxLength={80} placeholder="Research analyst" className="goal-control" /><FieldCount current={name.length} minimum={2} maximum={80} /></label>
                  <label className="block text-sm font-semibold text-void-200" htmlFor="agent-description">Description<textarea id="agent-description" value={description} onChange={(event) => { setDescription(event.target.value); setGenerationEvidence(null); setGenerationMessage(null); resetServerState(); }} maxLength={800} rows={3} placeholder="Describe the bounded role this agent performs." className="goal-control resize-y leading-relaxed" /><FieldCount current={description.length} minimum={10} maximum={800} /></label>
                  <div><button type="button" onClick={() => void generateInstructions()} disabled={generating || name.trim().length < 2 || description.trim().length < 10} className="instrument-button instrument-button-secondary">{generating ? <SpinnerGapIcon className="animate-spin" size={16} aria-hidden /> : <ShieldCheckIcon size={16} aria-hidden />}{generating ? "Generating with 0G" : "Generate with 0G"}</button><p className="mt-2 text-xs leading-relaxed text-void-500">Explicit request only. Fallback or invalid output is not applied, and this pre-hardening route is not publication proof.</p>{generationMessage && <div role={generationMessage.startsWith("TEE ") ? "status" : "alert"} className={`mt-3 border-l-2 pl-3 text-xs ${generationMessage === "TEE verified" ? "border-mint-500 text-mint-300" : generationMessage === "TEE unverified" ? "border-dawg-500 text-dawg-300" : "border-blood-500 text-blood-300"}`}><p>{generationMessage}</p>{generationEvidence?.attestationHash && <p className="mt-1 break-all font-mono text-void-400">Attestation {generationEvidence.attestationHash}</p>}</div>}</div>
                  <label className="block text-sm font-semibold text-void-200" htmlFor="agent-instructions">Markdown instructions<textarea id="agent-instructions" value={instructions} onChange={(event) => { setInstructions(event.target.value); setGenerationEvidence(null); setGenerationMessage(null); resetServerState(); }} maxLength={4_000} rows={6} placeholder={"## Task\n\nReturn concise, evidence-backed research with explicit uncertainty."} className="goal-control resize-y font-mono text-sm leading-relaxed" /><FieldCount current={instructions.length} minimum={20} maximum={4_000} /></label>
                  <p className="text-xs leading-relaxed text-void-500">Allowed: headings, lists, emphasis, and plain text. Forbidden: HTML, images, URLs, javascript: or data: schemes, code fences, and shebangs.</p>
                  {instructions.length > 0 && promptRefusal && <p role="alert" className="break-words font-mono text-xs text-blood-300">{promptRefusal}</p>}
                </div>
              </section>
            )}

            {stage === 1 && (
              <section aria-labelledby="agent-stack-title">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><h3 id="agent-stack-title" className="text-2xl font-semibold text-void-100">Managed agent stack</h3><p className="mt-2 text-sm text-void-400">Select approved skills and connect fixed read-only MCP server bindings.</p></div>
                  <a href="https://mcpmarket.com/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-dawg-300 hover:text-dawg-200">Browse MCP Market <ArrowSquareOutIcon size={15} aria-hidden /></a>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-void-500">Discovery only. External discoveries require review and server allowlisting before attachment. This screen does not install or connect arbitrary servers.</p>
                <label className="relative mt-5 block" htmlFor="agent-stack-search"><span className="sr-only">Search approved agent stack</span><MagnifyingGlassIcon size={17} className="pointer-events-none absolute left-3 top-3.5 text-void-500" aria-hidden /><input id="agent-stack-search" type="search" value={stackSearch} onChange={(event) => setStackSearch(event.target.value)} placeholder="Search approved skills and MCP servers" className="goal-control mt-0 pl-10" /></label>
                {catalog.isLoading && <CatalogLoading />}
                {catalog.error && <div role="alert" className="mt-6 border-l-2 border-blood-500 pl-3"><p className="break-words text-sm text-blood-300">{operationError(catalog.error)}</p><button type="button" onClick={() => void catalog.refetch()} className="instrument-button instrument-button-secondary mt-4">Retry approved stack</button></div>}
                {catalog.data && <div className="mt-6 space-y-7">
                  <section aria-labelledby="agent-skills-title"><div className="flex items-center justify-between gap-3"><h4 id="agent-skills-title" className="flex items-center gap-2 text-sm font-semibold text-void-100"><DatabaseIcon size={18} className="text-dawg-400" aria-hidden />Agent skills</h4><span className="font-mono text-xs text-void-500">{capabilities.length} / 3 selected</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{filteredCapabilities.map((capability) => { const selected = capabilities.includes(capability.id); return <button key={capability.id} type="button" aria-pressed={selected} aria-label={`${selected ? "Remove" : "Select"} ${capability.label}`} disabled={!selected && capabilities.length >= 3} onClick={() => toggleCapability(capability.id)} className={`min-h-24 rounded-[12px] border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "border-dawg-500 bg-dawg-500/[0.07]" : "border-void-800 bg-void-950 hover:border-void-600"}`}><span className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-void-100">{capability.label}</span><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? "border-dawg-500 bg-dawg-500 text-void-950" : "border-void-600 text-transparent"}`}><CheckIcon size={12} weight="bold" aria-hidden /></span></span><span className="mt-2 block text-xs leading-relaxed text-void-500">{capability.description}</span><span className="mt-2 block font-mono text-[0.6875rem] text-dawg-300">{selected ? "Selected" : "Approved"}</span></button>; })}</div>{filteredCapabilities.length === 0 && <p className="mt-3 text-sm text-void-500">No approved skills match this search.</p>}</section>
                  <section aria-labelledby="mcp-servers-title"><div className="flex items-center justify-between gap-3"><h4 id="mcp-servers-title" className="flex items-center gap-2 text-sm font-semibold text-void-100"><PlugsConnectedIcon size={18} className="text-dawg-400" aria-hidden />MCP servers</h4><span className="font-mono text-xs text-void-500">{mcp.length} / 4 connected</span></div><p className="mt-2 text-xs leading-relaxed text-void-500">CONFIGURED means credentials are present or pending. It never means a provider is live.</p><div className="mt-3 grid gap-2">{filteredBindings.map((binding) => { const key = bindingKey(binding); const selected = mcp.some((item) => bindingKey(item) === key); const availability = providerAvailability(catalog.data, binding.provider); return <button key={key} type="button" aria-pressed={selected} aria-label={`${selected ? "Disconnect" : "Connect"} ${binding.label}`} onClick={() => toggleBinding(binding)} className={`grid min-h-20 gap-3 rounded-[12px] border p-3 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${selected ? "border-dawg-500 bg-dawg-500/[0.07]" : "border-void-800 bg-void-950 hover:border-void-600"}`}><span><span className="block text-sm font-semibold text-void-100">{binding.label}</span><span className="mt-1 block text-xs leading-relaxed text-void-500">{binding.description}</span><span className="mt-1 block font-mono text-[0.6875rem] text-void-500">{key}</span></span><span className="flex items-center gap-2"><EvidenceStatus state={availability === "AVAILABLE" ? "verified" : availability === "CONFIGURED" ? "pending" : "unavailable"} label={availability} /><span className={`font-mono text-[0.6875rem] ${selected ? "text-dawg-300" : "text-void-500"}`}>{selected ? "CONNECTED" : "SELECT"}</span></span></button>; })}</div>{filteredBindings.length === 0 && <p className="mt-3 text-sm text-void-500">No approved MCP servers match this search.</p>}</section>
                </div>}
              </section>
            )}

            {stage === 2 && (
              <section aria-labelledby="agent-wallet-title">
                <h3 id="agent-wallet-title" className="text-2xl font-semibold text-void-100">Agent wallet</h3>
                <p className="mt-2 text-sm leading-relaxed text-void-400">Create the immutable draft, then explicitly ask the server to provision and attach its Circle wallet.</p>
                <div className="mt-5 grid min-w-0 gap-2 sm:grid-cols-2"><CopyableIdentifier label="Connected SIWE creator wallet" value={address ?? "Unavailable"} />{draftAgent && <><CopyableIdentifier label="Agent ID" value={draftAgent.agentId} /><CopyableIdentifier label="Version ID" value={draftAgent.versionId} /></>}</div>
                {!walletReady ? <button type="button" onClick={() => void provisionWallet()} disabled={!address || busy} className="instrument-button instrument-button-primary mt-6">{busy ? <SpinnerGapIcon className="animate-spin" size={16} aria-hidden /> : <WalletIcon size={16} aria-hidden />}{status ?? (lostOperation ? "Recover wallet receipt" : draftAgent ? "Retry wallet provisioning" : "Provision agent wallet")}</button> : <div className="mt-6"><div className="flex flex-wrap items-center justify-between gap-3 border-y border-void-800 py-3"><p className="text-sm font-semibold text-void-100">Server-returned Circle wallet</p><EvidenceStatus state="pending" label="Evidence attached" /></div><dl className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2"><CopyableIdentifier label="Agent wallet" value={walletAgent.agentWallet.address} /><CopyableIdentifier label="Provider" value={walletAgent.agentWallet.provider} /><CopyableIdentifier label="Network" value={walletAgent.agentWallet.network} /><CopyableIdentifier label="Account type" value={walletAgent.agentWallet.accountType} /><CopyableIdentifier label="Provider state (server returned)" value={walletAgent.agentWallet.state} /><CopyableIdentifier label="Wallet evidence hash" value={walletAgent.agentWallet.evidenceHash} /><CopyableIdentifier label="Wallet identity hash" value={walletAgent.agentWallet.identityHash} /><CopyableIdentifier label="Observed at" value={walletAgent.agentWallet.observedAt} /></dl></div>}
                <p className="mt-5 text-xs leading-relaxed text-void-500">Provisioning does not fund, sign, submit a transaction, or prove the wallet is online. Publication remains a separate protected action.</p>
              </section>
            )}

            {stage === 3 && (
              <section aria-labelledby="publish-receipt-title">
                <h3 id="publish-receipt-title" className="text-2xl font-semibold text-void-100">{publishedAgent ? "Publication receipt" : "Publish + receipt"}</h3>
                {!publishedAgent ? <><p className="mt-2 text-sm leading-relaxed text-void-400">Publish only the attached immutable wallet version. Eligibility requires the complete server WALLET_AUTHORIZED decision and receipt.</p><button type="button" onClick={() => void publish()} disabled={!walletReady || busy} className="instrument-button instrument-button-primary mt-6"><ShieldCheckIcon size={16} aria-hidden />{busy ? "Publishing wallet version" : lostOperation === "publish" ? "Recover publication receipt" : "Publish wallet version"}</button></> : <><div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-y border-void-800 py-4"><div><p className="font-semibold text-void-100">{publishedAgent.name}</p><p className="mt-2 break-all font-mono text-sm text-dawg-300">{publishedAgent.agentWallet?.address ?? "Agent wallet evidence unavailable"}</p></div><EvidenceStatus state={publicationEligible ? "verified" : "unavailable"} label={publicationEligible ? "ELIGIBLE" : "REFUSED"} /></div><dl className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2"><CopyableIdentifier label="Agent ID" value={publishedAgent.agentId} /><CopyableIdentifier label="Version ID" value={publishedAgent.versionId} /><CopyableIdentifier label="Creator wallet (owner)" value={publishedAgent.ownerWallet} /><CopyableIdentifier label="Agent wallet" value={publishedAgent.agentWallet?.address ?? "Unavailable"} /><CopyableIdentifier label="Authority" value={publishedAgent.authorityState} /><CopyableIdentifier label="Delegate" value={publishedAgent.authorityDelegate ?? "No delegate returned"} /><CopyableIdentifier label="Manifest and schema" value={`v${publishedAgent.manifestSchemaVersion} ${publishedAgent.manifestHash}`} /><CopyableIdentifier label="Selected skills" value={publishedAgent.capabilities.join(", ")} /><CopyableIdentifier label="Selected MCP" value={publishedAgent.mcpSummary?.map((binding) => `${binding.provider}:${binding.capability}`).join(", ") || "No MCP bindings"} /><CopyableIdentifier label="Price per protected hire" value={formatUsdcAtomic(publishedAgent.priceAtomic)} /><CopyableIdentifier label="Wallet publication decision" value={publishedAgent.walletPublicationDecisionId ?? "Unavailable"} /><CopyableIdentifier label="Wallet receipt hash" value={publishedAgent.walletReceiptHash ?? "Unavailable"} /></dl><p className="mt-4 text-sm text-void-400">Publication confirms server registry eligibility only. Runtime, 0G, Storage, job, delivery, and settlement remain per-job evidence.</p></>}
              </section>
            )}

            {errorMessage && <div role="alert" className="mt-6 border-l-2 border-blood-500 pl-3"><p className="break-words font-mono text-sm text-blood-300">{errorMessage}</p>{lostOperation && <p className="mt-2 text-xs leading-relaxed text-void-500">Retry uses the same protected request identity. A missing response is never treated as success.</p>}</div>}
          </motion.div>
        </AnimatePresence>

        <aside className="min-w-0 self-start rounded-[14px] border border-void-800 bg-void-950/60 p-5 lg:sticky lg:top-4" aria-label="Selected agent stack preview"><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-void-200">Selected stack</h3><span className="font-mono text-[0.6875rem] uppercase tracking-wider text-void-500">{currentVersion ? "Server returned" : "Draft input"}</span></div><StackPreview name={name} description={description} instructions={instructions} capabilities={capabilities} mcp={mcp} version={currentVersion} /></aside>
      </div>

      <footer className="sticky bottom-0 -mx-4 -mb-5 mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-void-700 bg-void-900 px-4 py-4 sm:-mx-5 sm:px-5"><button type="button" onClick={() => stage === 0 ? onClose() : moveToStage((stage - 1) as Stage)} disabled={busy || publicationEligible} className="instrument-button instrument-button-secondary"><ArrowLeftIcon size={16} aria-hidden />{stage === 0 ? "Cancel" : "Back"}</button>{stage < 3 && <button type="button" onClick={() => moveToStage((stage + 1) as Stage)} disabled={busy || (stage === 0 && !identityValid) || (stage === 1 && !stackValid) || (stage === 2 && !walletReady)} className="instrument-button instrument-button-primary">Continue <ArrowRightIcon size={16} aria-hidden /></button>}{stage === 3 && publicationEligible && <button type="button" onClick={finish} className="instrument-button instrument-button-primary">View my agents <ArrowRightIcon size={16} aria-hidden /></button>}</footer>
    </Dialog>
  );
}
