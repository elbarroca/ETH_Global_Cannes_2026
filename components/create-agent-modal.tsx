"use client";

import { useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, SealedBadge } from "@/components/ui/badge";
import {
  generateAgentInstructions,
  createMarketplaceAgent,
  type GeneratedInstructions,
  type CreatedAgent,
} from "@/lib/api";

interface CreateAgentModalProps {
  createdBy?: string | null;
  onClose: () => void;
  onCreated?: (agent: CreatedAgent) => void;
}

interface ToolDef {
  id: string;
  label: string;
  detail: string;
}

// Mock pre-tools — these are the default capabilities every AlphaDawg agent
// inherits. For now the checklist is purely UI (we persist the selections
// into `marketplace_agents.tools` so they can drive real capability gating
// later without a second migration).
const DEFAULT_TOOLS: ToolDef[] = [
  { id: "og-sealed-inference", label: "0G Sealed Inference", detail: "TEE-verified LLM calls" },
  { id: "tee-attestation", label: "TEE Attestation", detail: "On-chain attestation hash per call" },
  { id: "hedera-hcs-audit", label: "Hedera HCS Audit", detail: "Immutable audit log" },
  { id: "x402-paywall", label: "x402 Paywall", detail: "Arc USDC nanopayments ($0.001/query)" },
  { id: "0g-storage-memory", label: "0G Storage Memory", detail: "RAG memory across cycles" },
  { id: "on-chain-elo", label: "On-chain ELO", detail: "Reputation tracked on Hedera" },
  { id: "real-time-market-data", label: "Market Data Feed", detail: "CoinGecko + Etherscan live feed" },
];

const EMOJI_CHOICES = ["🤖", "🧠", "🐋", "📈", "🔍", "⚡", "🎯", "🛰️", "🔥", "💎"];

type Step = "form" | "generating" | "preview" | "deploying" | "done" | "error";

export function CreateAgentModal({ createdBy, onClose, onCreated }: CreateAgentModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState<string>("🤖");
  const [instructions, setInstructions] = useState("");
  const [generated, setGenerated] = useState<GeneratedInstructions | null>(null);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(
    () => new Set(DEFAULT_TOOLS.map((t) => t.id)),
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdAgent, setCreatedAgent] = useState<CreatedAgent | null>(null);

  const canGenerate =
    name.trim().length >= 2 &&
    name.trim().length <= 40 &&
    description.trim().length >= 10 &&
    description.trim().length <= 800 &&
    step === "form";

  async function handleGenerate() {
    setErrorMsg(null);
    setStep("generating");
    try {
      const result = await generateAgentInstructions(name.trim(), description.trim());
      setGenerated(result);
      setInstructions(result.markdown);
      setStep("preview");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStep("form");
    }
  }

  async function handleDeploy() {
    setErrorMsg(null);
    setStep("deploying");
    try {
      const agent = await createMarketplaceAgent({
        name: name.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        tools: Array.from(selectedTools),
        emoji,
        createdBy: createdBy ?? undefined,
        attestationHash: generated?.attestationHash ?? null,
      });
      setCreatedAgent(agent);
      setStep("done");
      onCreated?.(agent);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStep("preview");
    }
  }

  function toggleTool(id: string) {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-void-950/80 backdrop-blur-sm py-10 px-4">
      <Card className="w-full max-w-2xl">
        <CardBody className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-void-500 uppercase tracking-wider">Build Your Specialist</p>
              <p className="text-xl font-bold text-gold-400">Create Your Own Agent</p>
              <p className="text-xs text-void-500 mt-1">
                Describe what your agent should do. 0G Compute will craft the instructions
                inside a TEE enclave and mint it into the marketplace.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-void-500 hover:text-void-300 text-lg leading-none px-2"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* ── Step: Form ───────────────────────────────── */}
          {(step === "form" || step === "generating") && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-void-500">
                  Agent Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. GasWatcher"
                  maxLength={40}
                  disabled={step === "generating"}
                  className="w-full px-3 py-2.5 bg-void-950 border border-void-800 focus:border-dawg-500 focus:outline-none rounded-xl text-sm text-void-200 placeholder:text-void-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-void-500">
                  Emoji
                </label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_CHOICES.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      disabled={step === "generating"}
                      className={`w-9 h-9 rounded-lg border text-lg transition-colors ${
                        emoji === e
                          ? "border-dawg-500 bg-dawg-500/10"
                          : "border-void-800 bg-void-950 hover:border-void-700"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-void-500">
                  What should your agent do?
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Monitor gas prices and flag when network congestion creates arbitrage opportunities on DEXes."
                  rows={4}
                  maxLength={800}
                  disabled={step === "generating"}
                  className="w-full px-3 py-2.5 bg-void-950 border border-void-800 focus:border-dawg-500 focus:outline-none rounded-xl text-sm text-void-200 placeholder:text-void-600 resize-none"
                />
                <p className="text-[10px] text-void-600 text-right">
                  {description.length} / 800
                </p>
              </div>

              {errorMsg && (
                <p className="text-xs text-blood-400 bg-blood-950/30 border border-blood-900/40 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-dawg-500 hover:bg-dawg-400 disabled:opacity-50 disabled:cursor-not-allowed text-void-950 text-sm font-bold rounded-xl transition-colors"
                >
                  {step === "generating" ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-void-950 border-t-transparent rounded-full animate-spin" />
                      Generating via 0G…
                    </>
                  ) : (
                    "Generate Instructions"
                  )}
                </button>
                <button
                  onClick={onClose}
                  disabled={step === "generating"}
                  className="px-4 py-3 bg-void-800 hover:bg-void-700 disabled:opacity-60 text-void-300 text-sm font-bold rounded-xl border border-void-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Preview generated markdown + tools ─── */}
          {(step === "preview" || step === "deploying") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{emoji}</span>
                  <span className="text-sm font-semibold text-void-100">{name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {generated?.fallback ? (
                    <Badge variant="amber">Fallback template</Badge>
                  ) : (
                    <SealedBadge />
                  )}
                  {generated?.attestationHash && !generated.fallback && (
                    <span className="text-[10px] font-mono text-void-500">
                      att: {generated.attestationHash.slice(0, 8)}…
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-void-500">
                  Generated Instructions (editable)
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={12}
                  disabled={step === "deploying"}
                  className="w-full px-3 py-2.5 bg-void-950 border border-void-800 focus:border-dawg-500 focus:outline-none rounded-xl text-xs font-mono text-void-300 resize-y"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-wider text-void-500">
                  Default Tools (attached at deploy)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DEFAULT_TOOLS.map((tool) => {
                    const checked = selectedTools.has(tool.id);
                    return (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => toggleTool(tool.id)}
                        disabled={step === "deploying"}
                        className={`flex items-start gap-2 text-left px-3 py-2 rounded-lg border transition-colors ${
                          checked
                            ? "border-dawg-500/50 bg-dawg-500/5"
                            : "border-void-800 bg-void-950 hover:border-void-700"
                        }`}
                      >
                        <span
                          className={`mt-0.5 w-3.5 h-3.5 flex items-center justify-center rounded border text-[10px] ${
                            checked
                              ? "bg-dawg-500 border-dawg-500 text-void-950"
                              : "border-void-700"
                          }`}
                        >
                          {checked ? "✓" : ""}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-semibold text-void-200">
                            {tool.label}
                          </span>
                          <span className="block text-[10px] text-void-500 truncate">
                            {tool.detail}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs text-blood-400 bg-blood-950/30 border border-blood-900/40 rounded-lg px-3 py-2">
                  {errorMsg}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleDeploy}
                  disabled={step === "deploying" || instructions.trim().length < 20}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-dawg-500 hover:bg-dawg-400 disabled:opacity-50 text-void-950 text-sm font-bold rounded-xl transition-colors"
                >
                  {step === "deploying" ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-void-950 border-t-transparent rounded-full animate-spin" />
                      Deploying to Marketplace…
                    </>
                  ) : (
                    "+ Deploy Agent"
                  )}
                </button>
                <button
                  onClick={() => {
                    setStep("form");
                    setGenerated(null);
                    setInstructions("");
                  }}
                  disabled={step === "deploying"}
                  className="px-4 py-3 bg-void-800 hover:bg-void-700 disabled:opacity-60 text-void-300 text-sm font-bold rounded-xl border border-void-700 transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Done ─────────────────────────────── */}
          {step === "done" && createdAgent && (
            <div className="text-center space-y-3 py-4">
              <p className="text-4xl">{createdAgent.emoji}</p>
              <p className="text-lg font-bold text-green-400">Agent Deployed</p>
              <p className="text-sm text-void-300">
                <span className="font-semibold">{createdAgent.name}</span> is live in the
                marketplace at ELO {createdAgent.reputation}.
              </p>
              <p className="text-[10px] font-mono text-void-600">id: {createdAgent.id}</p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-void-800 hover:bg-void-700 text-void-300 text-sm rounded-xl border border-void-700 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
