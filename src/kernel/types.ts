import type { CanonicalValue } from "./canonical";

export const JOB_STATES = [
  "QUEUED",
  "RUNNING",
  "DELIVERY_READY",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
  "A3_NOT_CONFIGURED",
] as const;

export type JobState = (typeof JOB_STATES)[number];
export type TerminalJobState = Exclude<JobState, "QUEUED" | "RUNNING" | "DELIVERY_READY">;

export interface KernelJobInput {
  prompt: string;
}

interface AgentManifestBase extends Record<string, CanonicalValue> {
  name: string;
  description: string;
  instructions: string;
  capabilities: readonly string[];
  adapterKey: "protected-a3";
  endpoint: null;
  connectorKey: null;
  ownerWallet: string;
  priceAtomic: string;
  asset: "USDC_ATOMIC";
  proofPolicy: "verified-receipt-required";
  ensBinding: AgentEnsBinding | null;
}

export interface AgentManifestV1 extends AgentManifestBase {
  schemaVersion: 1;
  payoutAddress: null;
}

export interface PinnedAgentSkill extends Record<string, CanonicalValue> {
  id: "research" | "market-analysis" | "risk-analysis" | "uniswap-swap";
  source: string;
  reviewedHash: string;
  policy: "metadata-only-never-execute";
}

export interface AgentNativeConnection extends Record<string, CanonicalValue> {
  id: "zero-g-compute" | "zero-g-storage" | "uniswap-api";
  required: true;
}

export interface AgentManifestV2 extends AgentManifestBase {
  schemaVersion: 2;
  reviewedPromptHash: string;
  reviewedConfigHash: string;
  skills: readonly PinnedAgentSkill[];
  nativeConnections: readonly AgentNativeConnection[];
  mcp: readonly [];
  payoutAddress: string;
  ensBindingHash: string | null;
}

export type AgentManifest = AgentManifestV1 | AgentManifestV2;

export const AGENT_LIFECYCLE_STATES = [
  "DRAFT",
  "NAME_BOUND",
  "WRITE_PREPARED",
  "PUBLISHED",
] as const;

export type AgentLifecycleState = (typeof AGENT_LIFECYCLE_STATES)[number];

export interface AgentEnsBinding extends Record<string, CanonicalValue> {
  creatorParent: string;
  agentLabel: string;
  fullSubname: string;
  creatorDnsName: string;
  agentDnsName: string;
}

export interface AgentEnsWritePlan extends Record<string, CanonicalValue> {
  schemaVersion: 1;
  kind: "LOCAL_ONLY_UNAUTHORIZED";
  agentVersionId: string;
  manifestHash: string;
  creatorParent: string;
  agentLabel: string;
  fullSubname: string;
  creatorDnsName: string;
  agentDnsName: string;
  operations: readonly ["CREATE_OR_UPDATE_SUBNAME", "SET_IMMUTABLE_MANIFEST_BINDING"];
  requiresAuthorization: true;
  requiresWalletSignature: true;
}

export interface AgentLifecycleVersion {
  agentId: string;
  versionId: string;
  version: number;
  name: string;
  description: string;
  capabilities: readonly string[];
  manifestHash: string;
  promptHash: string;
  configHash: string;
  adapterKey: "protected-a3";
  ownerWallet: string;
  priceAtomic: string;
  asset: "USDC_ATOMIC";
  proofPolicy: "verified-receipt-required";
  lifecycleState: AgentLifecycleState;
  hireable: boolean;
  ownedByViewer: boolean;
  creatorParent: string | null;
  agentLabel: string | null;
  fullSubname: string | null;
  writePlanHash: string | null;
  canonicalState: "UNVERIFIED" | "CANONICAL" | "REFUSED";
  authorityOwner: string | null;
  authorityDelegate: string | null;
  authorityPolicyVersion: string | null;
  refusalReason: string | null;
  authorityReleaseSha: string | null;
  publicationDecisionId: string | null;
  publishedAt: string | null;
}

export interface ProtectedPublishedAgent extends AgentLifecycleVersion {
  lifecycleState: "PUBLISHED";
  hireable: true;
  canonicalState: "CANONICAL";
  creatorParent: string;
  agentLabel: string;
  fullSubname: string;
  writePlanHash: string;
  authorityOwner: string;
  authorityPolicyVersion: string;
  authorityReleaseSha: string;
  publicationDecisionId: string;
  publishedAt: string;
}

export interface AgentVersionProvenance {
  protocol: "INFT";
  chainId: number;
  contractAddress: string;
  tokenId: string;
  metadataUri: string | null;
  evidenceHash: string;
  observedAt: string;
}

export interface ProtectedPublishedAgentRead extends ProtectedPublishedAgent {
  verifiedExternalHires: number;
  provenance: AgentVersionProvenance | null;
}

export const GOAL_STATES = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"] as const;
export type GoalState = (typeof GOAL_STATES)[number];

export const GOAL_RUN_STATES = [
  "SCHEDULED",
  "SELECTING",
  "RUNNING",
  "SYNTHESIZING",
  "READY",
  "PARTIAL",
  "BLOCKED",
  "FAILED",
  "CANCELED",
] as const;
export type GoalRunState = (typeof GOAL_RUN_STATES)[number];

export interface GoalPolicy extends Record<string, CanonicalValue> {
  cadenceMinutes: 5 | 15 | 30 | 60;
  runMode: "BOUNDED" | "CONTINUOUS";
  executionMode: "RESEARCH_ONLY" | "PROPOSE_SWAP";
  runLimit: number | null;
  maxAgents: number;
  perRunCapAtomic: string;
  dailyCapAtomic: string | null;
}

export interface SwapProposalV1 extends Record<string, CanonicalValue> {
  schemaVersion: 1;
  chainId: 1301;
  tokenIn: string;
  tokenOut: string;
  amountInAtomic: string;
  slippageBps: number;
  rationale: string;
  requiresWalletApproval: true;
}

export interface GoalRunEvidenceV1 extends Record<string, CanonicalValue> {
  jobId: string;
  agentVersionId: string;
  resultHash: string;
  receiptId: string;
}

export interface GoalRunReportV1 extends Record<string, CanonicalValue> {
  schemaVersion: 1;
  goalId: string;
  runId: string;
  status: "READY" | "PARTIAL";
  objective: string;
  summary: string;
  conclusion: string;
  evidence: readonly GoalRunEvidenceV1[];
  swapProposal: SwapProposalV1 | null;
}

export interface GoalSnapshot extends Record<string, CanonicalValue> {
  goalId: string;
  objective: string;
  requiredCapabilities: readonly string[];
  policy: GoalPolicy;
  state: GoalState;
  nextRunAt: string | null;
  completedRuns: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoalRunJobSnapshot {
  agentVersionId: string;
  jobId: string | null;
  role: "ANALYSIS" | "SYNTHESIS";
  selectionRank: number;
  coveredCapabilities: readonly string[];
  priceAtomic: string;
  manifestHash: string;
  fullSubname: string;
}

export interface GoalRunSnapshot {
  runId: string;
  goalId: string;
  scheduledFor: string;
  state: GoalRunState;
  objective: string;
  requiredCapabilities: readonly string[];
  policy: GoalPolicy;
  policyHash: string;
  effectIdentity: string;
  totalPriceAtomic: string;
  costReservedAt: string | null;
  report: GoalRunReportV1 | null;
  reportHash: string | null;
  errorCode: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  jobs: readonly GoalRunJobSnapshot[];
}

export interface PublishedAgent {
  agentId: string;
  versionId: string;
  version: number;
  name: string;
  description: string;
  capabilities: readonly string[];
  manifestHash: string;
  promptHash: string;
  configHash: string;
  adapterKey: "protected-a3";
  ownerWallet: string;
  priceAtomic: string;
  asset: "USDC_ATOMIC";
  proofPolicy: "verified-receipt-required";
  lifecycleState: AgentLifecycleState;
  hireable: boolean;
  ownedByViewer: boolean;
  creatorParent: string | null;
  agentLabel: string | null;
  fullSubname: string | null;
  canonicalState: "UNVERIFIED" | "CANONICAL" | "REFUSED";
  authorityOwner: string | null;
  publishedAt: string;
}

export interface SubmittedJob {
  quoteId: string;
  intentId: string;
  orderId: string;
  jobId: string;
  effectId: string;
  state: JobState;
  version: number;
  amountAtomic: string;
  asset: string;
  replayed: boolean;
}

export interface JobSnapshot {
  jobId: string;
  effectId: string;
  buyerUserId: string;
  agentVersionId: string;
  state: JobState;
  version: number;
  attempts: number;
  maxAttempts: number;
  cancelRequestedAt: string | null;
  lastErrorCode: string | null;
  financialOutcome: "SETTLED" | "REFUNDED" | null;
  createdAt: string;
  updatedAt: string;
}

export const EVIDENCE_STATES = [
  "verified",
  "pending",
  "unavailable",
  "failed",
] as const;

export type EvidenceState = (typeof EVIDENCE_STATES)[number];

export interface KernelJobEvidenceSummary {
  owner: EvidenceState;
  version: EvidenceState;
  ens: EvidenceState;
  compute: EvidenceState;
  storage: EvidenceState;
  receipt: EvidenceState;
}

export interface KernelJobAgentIdentity {
  agentId: string;
  versionId: string;
  version: number;
  name: string;
  description: string;
  ownerWallet: string;
  capabilities: readonly string[];
  priceAtomic: string;
  asset: "USDC_ATOMIC";
  proofPolicy: "verified-receipt-required";
  creatorParent: string | null;
  fullSubname: string | null;
  canonicalState: "UNVERIFIED" | "CANONICAL" | "REFUSED" | null;
  authorityOwner: string | null;
  authorityDelegate: string | null;
  authorityPolicyVersion: string | null;
  refusalReason: string | null;
  authorityReleaseSha: string | null;
}

export interface KernelJobListItem extends JobSnapshot {
  agent: KernelJobAgentIdentity;
  evidence: KernelJobEvidenceSummary;
}

export interface KernelJobTimelineItem {
  version: number;
  eventType: string;
  fromState: JobState | null;
  toState: JobState;
  createdAt: string;
}

export interface KernelEnsDecision {
  checkId: string;
  phase: string;
  operation: string;
  decision: "ALLOW" | "DENY";
  errorCode: string | null;
  recordHash: string | null;
  chainId: number | null;
  blockNumber: string | null;
  blockTimestamp: string | null;
  observedAt: string;
  freshUntil: string | null;
  transactionHash: string | null;
}

export interface KernelExecutionDigests {
  stage: string;
  requestHash: string;
  requestId: string | null;
  responseHash: string | null;
  computeReceiptDigest: string | null;
  proofHash: string | null;
  updatedAt: string;
}

export interface KernelStorageReadback {
  expectedRoot: string;
  expectedDigest: string;
  expectedSize: number;
  storageReceiptDigest: string | null;
  readbackRoot: string | null;
  readbackDigest: string | null;
  readbackSize: number | null;
  verified: boolean;
}

export interface KernelVerifiedReceipt {
  receiptId: string;
  verified: boolean;
  adapterKey: string;
  proofHash: string;
  resultHash: string;
  createdAt: string;
}

export interface KernelDeliveryResult {
  resultHash: string;
  result: CanonicalValue | null;
  terminalAt: string;
}

export interface KernelFinancialEvidence {
  settlement: {
    amountAtomic: string;
    asset: string;
    createdAt: string;
  } | null;
  refund: {
    amountAtomic: string;
    asset: string;
    reasonCode: string;
    createdAt: string;
  } | null;
}

export interface KernelJobEvidence {
  timeline: readonly KernelJobTimelineItem[];
  latestEnsDecision: KernelEnsDecision | null;
  execution: KernelExecutionDigests | null;
  storage: KernelStorageReadback | null;
  receipt: KernelVerifiedReceipt | null;
  delivery: KernelDeliveryResult | null;
  financial: KernelFinancialEvidence;
  errorCode: string | null;
}

export interface KernelJobDetail extends KernelJobListItem {
  evidenceDetail: KernelJobEvidence;
}
