import { CopyableIdentifier, EvidenceStatus } from "@/components/ui/evidence";
import type { EvidenceState, KernelJobDetail } from "@/src/kernel/types";

type EvidenceKind = "ens" | "compute" | "storage" | "receipt" | "uniswap";

export function EvidenceIndexItem({ job, kind }: { job: KernelJobDetail; kind: EvidenceKind }) {
  const ens = job.evidenceDetail.latestEnsDecision;
  const execution = job.evidenceDetail.execution;
  const storage = job.evidenceDetail.storage;
  const receipt = job.evidenceDetail.receipt;
  const title = {
    ens: "ENS authority",
    compute: "0G Compute",
    storage: "0G Storage",
    receipt: "Canonical receipt",
    uniswap: "Uniswap tool receipt",
  }[kind];
  const state: EvidenceState = kind === "ens" ? job.evidence.ens
    : kind === "compute" ? job.evidence.compute
      : kind === "storage" ? job.evidence.storage
        : kind === "receipt" ? job.evidence.receipt
          : "unavailable";
  const detail = kind === "ens" ? (ens ? `${ens.decision} observed ${ens.observedAt}; fresh until ${ens.freshUntil ?? "Unavailable"}.` : "Unavailable")
    : kind === "compute" ? (execution ? `Journal ${execution.stage}; source is authenticated job detail.` : "Unavailable")
      : kind === "storage" ? (storage ? `${storage.verified ? "Verified" : "Unverified"} readback; roots are copy-only.` : "Unavailable")
        : kind === "receipt" ? (receipt ? `Receipt recorded ${receipt.createdAt}.` : "Unavailable")
          : "Unavailable; no separate Uniswap tool receipt or refusal exists in this authenticated job detail.";

  return (
    <article className="min-w-0 rounded-xl border border-void-800 bg-black p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-void-100">{title}</h3><EvidenceStatus state={state} /></div>
      <p className="mt-3 break-words text-xs leading-relaxed text-void-500">{detail}</p>
      <div className="mt-3 space-y-2">
        {kind === "ens" && ens?.recordHash && <CopyableIdentifier label="ENS record hash" value={ens.recordHash} />}
        {kind === "compute" && execution?.computeReceiptDigest && <CopyableIdentifier label="Compute receipt digest" value={execution.computeReceiptDigest} />}
        {kind === "storage" && storage?.expectedRoot && <CopyableIdentifier label="0G root · copy only" value={storage.expectedRoot} />}
        {kind === "receipt" && receipt?.receiptId && <CopyableIdentifier label="Receipt ID" value={receipt.receiptId} />}
      </div>
    </article>
  );
}
