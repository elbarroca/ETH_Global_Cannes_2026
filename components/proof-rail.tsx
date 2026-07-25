import type { ReactNode } from "react";
import {
  CpuIcon,
  CubeIcon,
  DatabaseIcon,
  IdentificationCardIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  type Icon,
} from "@phosphor-icons/react";
import { CopyableIdentifier, EvidenceStatus } from "@/components/ui/evidence";
import type { EvidenceState, KernelJobDetail } from "@/src/kernel/types";

function financialState(job: KernelJobDetail): EvidenceState {
  const { settlement, refund } = job.evidenceDetail.financial;
  if (settlement || refund) return "verified";
  if (job.state === "QUEUED" || job.state === "RUNNING" || job.state === "DELIVERY_READY") return "pending";
  return job.state === "SUCCEEDED" || job.state === "FAILED" ? "failed" : "unavailable";
}

function RailStage({
  index,
  title,
  state,
  detail,
  children,
  icon: StageIcon,
}: {
  index: number;
  title: string;
  state: EvidenceState;
  detail: string;
  children?: ReactNode;
  icon: Icon;
}) {
  return (
    <li className="relative grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-3 pb-4 last:pb-0 xl:block xl:pb-0">
      <div className="relative flex justify-center">
        <span className={`relative z-10 grid h-10 w-10 place-items-center rounded-lg border bg-black ${state === "verified" ? "border-dawg-500 text-dawg-400" : state === "failed" ? "border-blood-500/50 text-blood-300" : "border-void-700 text-void-500"}`}>
          <StageIcon size={18} aria-hidden />
          <span className="sr-only">Stage {index}</span>
        </span>
        {index < 6 && (
          <span
            className="absolute bottom-[-1rem] left-1/2 top-10 w-px bg-void-800 xl:bottom-auto xl:left-[calc(50%+1.25rem)] xl:right-[-0.75rem] xl:top-5 xl:h-px xl:w-auto"
            aria-hidden="true"
          />
        )}
      </div>
      <div className="min-w-0 rounded-lg border border-void-800 bg-black p-3 xl:mt-3">
        <div className="flex flex-wrap items-start justify-between gap-2 xl:block">
          <h3 className="text-sm font-semibold text-void-100">{title}</h3>
          <EvidenceStatus state={state} className="xl:mt-2" />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-void-500">{detail}</p>
        {children && <div className="mt-3 min-w-0 space-y-2">{children}</div>}
      </div>
    </li>
  );
}

export function ProofRail({ job }: { job: KernelJobDetail }) {
  const ens = job.evidenceDetail.latestEnsDecision;
  const execution = job.evidenceDetail.execution;
  const storage = job.evidenceDetail.storage;
  const receipt = job.evidenceDetail.receipt;
  const { settlement, refund } = job.evidenceDetail.financial;

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="instrument-label">Proof sequence</p>
          <h2 className="mt-2 text-lg font-semibold text-void-100">Six gates. One canonical receipt.</h2>
        </div>
        <span className="hidden font-mono text-[10px] uppercase tracking-wider text-void-600 sm:block">Fail closed</span>
      </div>
      <ol aria-label="Protected job evidence" className="grid min-w-0 gap-3 xl:grid-cols-6">
        <RailStage
          index={1}
          icon={IdentificationCardIcon}
          title="Owner"
          state={job.evidence.owner}
          detail="Authenticated owner recorded on the published agent."
        >
          <CopyableIdentifier label="Owner wallet" value={job.agent.ownerWallet} />
        </RailStage>

        <RailStage
          index={2}
          icon={CubeIcon}
          title="Version"
          state={job.evidence.version}
          detail={`Immutable published version ${job.agent.version}.`}
        >
          <CopyableIdentifier label="Version ID" value={job.agent.versionId} />
        </RailStage>

        <RailStage
          index={3}
          icon={ShieldCheckIcon}
          title="ENS authority"
          state={job.evidence.ens}
          detail={ens
            ? `${ens.phase} / ${ens.operation}: ${ens.decision}${ens.errorCode ? ` (${ens.errorCode})` : ""}`
            : "No ENS authority observation is available yet."}
        >
          {ens?.recordHash && <CopyableIdentifier label="Record hash" value={ens.recordHash} />}
        </RailStage>

        <RailStage
          index={4}
          icon={CpuIcon}
          title="0G Compute"
          state={job.evidence.compute}
          detail={execution
            ? `Journal stage ${execution.stage}; raw prompts and responses are not exposed.`
            : "No verified compute journal is available yet."}
        >
          {execution?.computeReceiptDigest && (
            <CopyableIdentifier label="Receipt digest" value={execution.computeReceiptDigest} />
          )}
        </RailStage>

        <RailStage
          index={5}
          icon={DatabaseIcon}
          title="Storage"
          state={job.evidence.storage}
          detail={storage
            ? storage.verified
              ? "Readback root, digest, and size match the expected commitment."
              : "A commitment exists without a matching verified readback."
            : "No storage readback evidence is available yet."}
        >
          {storage?.expectedRoot && (
            <CopyableIdentifier label="Expected root" value={storage.expectedRoot} />
          )}
        </RailStage>

        <RailStage
          index={6}
          icon={ReceiptIcon}
          title="Receipt"
          state={job.evidence.receipt}
          detail={receipt
            ? `${receipt.adapterKey} receipt recorded at ${receipt.createdAt}.`
            : "No canonical verified receipt is available."}
        >
          {receipt?.proofHash && <CopyableIdentifier label="Proof hash" value={receipt.proofHash} />}
        </RailStage>
      </ol>

      <div className="flex flex-col gap-3 rounded-xl border border-void-800 bg-void-950/45 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-void-100">Financial outcome</h3>
          <p className="mt-1 text-xs text-void-500">
            {settlement
              ? `Settled ${settlement.amountAtomic} ${settlement.asset} atomically.`
              : refund
                ? `Refunded ${refund.amountAtomic} ${refund.asset}; reason ${refund.reasonCode}.`
                : "No settlement or refund evidence is available yet."}
          </p>
        </div>
        <EvidenceStatus state={financialState(job)} />
      </div>
    </div>
  );
}
