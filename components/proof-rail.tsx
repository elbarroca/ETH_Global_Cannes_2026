import { EvidenceStatus } from "@/components/ui/evidence";
import type { EvidenceState, KernelJobDetail } from "@/src/kernel/types";

function financialState(job: KernelJobDetail): EvidenceState {
  if (job.evidenceDetail.financial.settlement || job.evidenceDetail.financial.refund) return "verified";
  if (job.state === "QUEUED" || job.state === "RUNNING" || job.state === "DELIVERY_READY") return "pending";
  return "unavailable";
}

export function ProofRail({ job }: { job: KernelJobDetail }) {
  const ens = job.evidenceDetail.latestEnsDecision;
  const execution = job.evidenceDetail.execution;
  const storage = job.evidenceDetail.storage;
  const receipt = job.evidenceDetail.receipt;
  const financial = job.evidenceDetail.financial;
  const dimensions = [
    { title: "Agent identity", state: job.agent.canonicalState === "CANONICAL" ? "verified" as const : "unavailable" as const, summary: `${job.agent.fullSubname ?? "Subname unavailable"} · v${job.agent.version} · ${job.agent.priceAtomic} ${job.agent.asset}`, details: [`Creator parent: ${job.agent.creatorParent ?? "Unavailable"}`, `Version ID: ${job.agentVersionId}`, `Owner: ${job.agent.ownerWallet}`, `Authority owner: ${job.agent.authorityOwner ?? "Unavailable"}`, `Delegate: ${job.agent.authorityDelegate ?? "Unavailable"}`, `Release SHA: ${job.agent.authorityReleaseSha ?? "Unavailable"}`] },
    { title: "ENS authority", state: job.evidence.ens, summary: ens ? `${ens.decision} observed ${ens.observedAt}` : "Unavailable", details: ens ? [`Fresh until: ${ens.freshUntil ?? "Unavailable"}`, `Record hash: ${ens.recordHash ?? "Unavailable"}`, `Error: ${ens.errorCode ?? "None"}`] : [] },
    { title: "0G Compute", state: job.evidence.compute, summary: execution ? `Journal stage ${execution.stage}` : "Unavailable", details: execution ? [`Receipt digest: ${execution.computeReceiptDigest ?? "Unavailable"}`, `Proof hash: ${execution.proofHash ?? "Unavailable"}`] : [] },
    { title: "Storage readback", state: job.evidence.storage, summary: storage ? (storage.verified ? "Readback verified" : "Readback mismatch") : "Unavailable", details: storage ? [`Expected root: ${storage.expectedRoot}`, `Readback root: ${storage.readbackRoot ?? "Unavailable"}`, `Expected digest: ${storage.expectedDigest}`, `Readback digest: ${storage.readbackDigest ?? "Unavailable"}`] : [] },
    { title: "Canonical receipt", state: job.evidence.receipt, summary: receipt ? `Receipt recorded ${receipt.createdAt}` : "Unavailable", details: receipt ? [`Receipt ID: ${receipt.receiptId}`, `Proof hash: ${receipt.proofHash}`, `Result hash: ${receipt.resultHash}`] : [] },
    { title: "Settlement or refund", state: financialState(job), summary: financial.settlement ? `Settled ${financial.settlement.amountAtomic} ${financial.settlement.asset}` : financial.refund ? `Refunded ${financial.refund.amountAtomic} ${financial.refund.asset}` : "Unavailable", details: financial.refund ? [`Reason: ${financial.refund.reasonCode}`, `Recorded: ${financial.refund.createdAt}`] : financial.settlement ? [`Recorded: ${financial.settlement.createdAt}`] : [] },
  ];
  return <section aria-labelledby={`proof-${job.jobId}`} className="border-y border-void-800"><h2 id={`proof-${job.jobId}`} className="sr-only">Proof dimensions</h2><ul className="divide-y divide-void-800">{dimensions.map((dimension) => <li key={dimension.title} className="py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-void-100">{dimension.title}</h3><p className="mt-1 break-words text-sm text-void-400">{dimension.summary}</p></div><EvidenceStatus state={dimension.state} /></div>{dimension.details.length > 0 && <details><summary className="min-h-11 cursor-pointer py-3 text-xs text-void-400">Exact evidence tuple</summary><ul className="space-y-2 border-t border-void-800 py-3">{dimension.details.map((detail) => <li key={detail} className="break-all font-mono text-xs text-void-400">{detail}</li>)}</ul></details>}</li>)}</ul></section>;
}
