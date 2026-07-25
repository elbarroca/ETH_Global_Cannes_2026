import { EvidenceStatus } from "@/components/ui/evidence";
import type { EvidenceState, KernelJobDetail, McpEvidenceV1 } from "@/src/kernel/types";

interface ProofDimension {
  title: string;
  state: EvidenceState;
  statusLabel?: string;
  summary: string;
  details: readonly string[];
}

function financialState(job: KernelJobDetail): EvidenceState {
  if (job.evidenceDetail.financial.settlement || job.evidenceDetail.financial.refund) return "verified";
  if (job.state === "QUEUED" || job.state === "RUNNING" || job.state === "DELIVERY_READY") return "pending";
  return "unavailable";
}

function mcpState(invocations: readonly McpEvidenceV1[], active: boolean): EvidenceState {
  if (invocations.some((invocation) => invocation.state === "FAILED")) return "failed";
  if (invocations.length > 0 && invocations.every((invocation) => invocation.state === "SUCCEEDED")) return "verified";
  return active ? "pending" : "unavailable";
}

function failedJob(job: KernelJobDetail): boolean {
  return job.state === "FAILED" || job.state === "A3_NOT_CONFIGURED" || job.evidenceDetail.execution?.stage === "FAILED";
}

function authoritativeDimension(job: KernelJobDetail, dimension: ProofDimension): ProofDimension {
  if (!failedJob(job) || dimension.state !== "verified") return dimension;
  return { ...dimension, state: "unavailable", statusLabel: "Recorded before failure" };
}

export function ProofRail({ job }: { job: KernelJobDetail }) {
  const ens = job.evidenceDetail.latestEnsDecision;
  const execution = job.evidenceDetail.execution;
  const storage = job.evidenceDetail.storage;
  const receipt = job.evidenceDetail.receipt;
  const delivery = job.evidenceDetail.delivery;
  const financial = job.evidenceDetail.financial;
  const invocations = job.evidenceDetail.mcpInvocations ?? [];
  const active = job.state === "QUEUED" || job.state === "RUNNING" || job.state === "DELIVERY_READY";
  const rawDimensions: ProofDimension[] = [
    {
      title: "Matched agent",
      state: job.agent.canonicalState === "CANONICAL" ? "verified" : "unavailable",
      summary: `${job.agent.fullSubname ?? "Subname unavailable"}, version ${job.agent.version}, ${job.agent.priceAtomic} ${job.agent.asset}`,
      details: [`Creator parent: ${job.agent.creatorParent ?? "Unavailable"}`, `Version ID: ${job.agentVersionId}`, `Owner: ${job.agent.ownerWallet}`, `Authority owner: ${job.agent.authorityOwner ?? "Unavailable"}`, `Delegate: ${job.agent.authorityDelegate ?? "Unavailable"}`, `Release SHA: ${job.agent.authorityReleaseSha ?? "Unavailable"}`],
    },
    {
      title: "Hire and ENS authority",
      state: job.evidence.ens,
      summary: ens ? `${ens.decision} observed ${ens.observedAt}` : "Unavailable",
      details: ens ? [`Fresh until: ${ens.freshUntil ?? "Unavailable"}`, `Record hash: ${ens.recordHash ?? "Unavailable"}`, `Error: ${ens.errorCode ?? "None"}`] : [],
    },
    {
      title: "MCP query context",
      state: mcpState(invocations, active),
      summary: invocations.length ? `${invocations.length} bounded invocation${invocations.length === 1 ? "" : "s"}` : "No MCP invocation evidence is available.",
      details: invocations.flatMap((invocation) => [
        `${invocation.provider}: ${invocation.capability}`,
        `Terminal state: ${invocation.state}`,
        `Request hash: ${invocation.requestHash}`,
        `Response hash: ${invocation.responseHash ?? "Unavailable"}`,
        `Context hash: ${invocation.contextHash ?? "Unavailable"}`,
        `Error: ${invocation.errorCode ?? "None"}`,
        `Release SHA: ${invocation.releaseSha}`,
      ]),
    },
    {
      title: "0G reasoning",
      state: job.evidence.compute,
      summary: execution ? `Journal stage ${execution.stage}` : "Unavailable",
      details: execution ? [`Request hash: ${execution.requestHash}`, `Response hash: ${execution.responseHash ?? "Unavailable"}`, `Receipt digest: ${execution.computeReceiptDigest ?? "Unavailable"}`, `Proof hash: ${execution.proofHash ?? "Unavailable"}`] : [],
    },
    {
      title: "Storage readback",
      state: job.evidence.storage,
      summary: storage ? (storage.verified ? "Readback verified" : "Readback mismatch") : "Unavailable",
      details: storage ? [`Expected root: ${storage.expectedRoot}`, `Readback root: ${storage.readbackRoot ?? "Unavailable"}`, `Expected digest: ${storage.expectedDigest}`, `Readback digest: ${storage.readbackDigest ?? "Unavailable"}`] : [],
    },
    {
      title: "Canonical receipt",
      state: job.evidence.receipt,
      summary: receipt ? `Receipt recorded ${receipt.createdAt}` : "Unavailable",
      details: receipt ? [`Receipt ID: ${receipt.receiptId}`, `Proof hash: ${receipt.proofHash}`, `Result hash: ${receipt.resultHash}`] : [],
    },
    {
      title: "Delivered result",
      state: delivery && job.state === "SUCCEEDED" ? "verified" : active ? "pending" : "unavailable",
      summary: delivery ? `Delivery recorded ${delivery.terminalAt}` : "No canonical delivery output is available.",
      details: delivery ? [`Result hash: ${delivery.resultHash}`, `Terminal state: ${job.state}`] : [],
    },
    {
      title: "Settlement or refund",
      state: financialState(job),
      summary: financial.settlement ? `Settled ${financial.settlement.amountAtomic} ${financial.settlement.asset}` : financial.refund ? `Refunded ${financial.refund.amountAtomic} ${financial.refund.asset}` : "Unavailable",
      details: financial.refund ? [`Reason: ${financial.refund.reasonCode}`, `Recorded: ${financial.refund.createdAt}`] : financial.settlement ? [`Recorded: ${financial.settlement.createdAt}`] : [],
    },
  ];
  const dimensions = rawDimensions.map((dimension) => authoritativeDimension(job, dimension));

  return <section aria-labelledby={`proof-${job.jobId}`} className="border-y border-void-800"><h2 id={`proof-${job.jobId}`} className="sr-only">Connected proof spine</h2><ol className="divide-y divide-void-800">{dimensions.map((dimension) => <li key={dimension.title} className="grid gap-3 py-4 md:grid-cols-[10rem_minmax(0,1fr)_auto] md:items-start"><h3 className="text-sm font-semibold text-void-100">{dimension.title}</h3><div className="min-w-0"><p className="break-words text-sm text-void-400">{dimension.summary}</p>{dimension.details.length > 0 && <details><summary className="min-h-11 cursor-pointer py-3 text-xs text-void-400">Exact evidence tuple</summary><ul className="space-y-2 border-t border-void-800 py-3">{dimension.details.map((detail, index) => <li key={`${dimension.title}-${index}`} className="break-all font-mono text-xs text-void-400">{detail}</li>)}</ul></details>}</div><EvidenceStatus state={dimension.state} label={dimension.statusLabel} /></li>)}</ol></section>;
}
