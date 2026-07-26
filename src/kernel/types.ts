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

export interface ReviewedSourceFileV1 extends Record<string, CanonicalValue> {
  path: string;
  sha256: string;
}

export interface ReviewedSourceV1 extends Record<string, CanonicalValue> {
  schemaVersion: 1;
  repository: string;
  revision: string;
  license: "Apache-2.0" | "MIT";
  use: "integration" | "guidance-only";
  files: readonly ReviewedSourceFileV1[];
}

export type McpProviderId = "coingecko" | "the-graph";

export type McpCapability =
  | "search"
  | "spot-price"
  | "market-snapshot"
  | "trending"
  | "token-by-address"
  | "pool-snapshot"
  | "ohlcv"
  | "pinned-deployment-lookup"
  | "schema-read"
  | "bounded-query"
  | "liquidity-volume-snapshot";

export interface McpBindingV1 extends Record<string, CanonicalValue> {
  schemaVersion: 1;
  id: string;
  provider: McpProviderId;
  capability: McpCapability;
  access: "read-only";
  timeoutMs: 8000;
  maxResponseBytes: 32768;
}

export interface AgentSkillSnapshotV1 extends Record<string, CanonicalValue> {
  schemaVersion: 1;
  id: string;
  category: "PERSONA" | "DATA" | "ACTION" | "CONNECTION";
  capabilities: readonly string[];
  constraints: readonly string[];
  snapshotHash: string;
}

export interface AgentManifestV2 extends AgentManifestBase {
  schemaVersion: 2;
  reviewedPromptHash: string;
  reviewedConfigHash: string;
  skills: readonly PinnedAgentSkill[];
  nativeConnections: readonly AgentNativeConnection[];
  mcp: readonly McpBindingV1[];
  payoutAddress: string;
  ensBindingHash: string | null;
}

export interface AgentManifestV3 extends AgentManifestBase {
  schemaVersion: 3;
  catalogTemplateId: string;
  catalogSelectionHash: string;
  reviewedPromptHash: string;
  reviewedConfigHash: string;
  skills: readonly AgentSkillSnapshotV1[];
  reviewedSources: readonly ReviewedSourceV1[];
  nativeConnections: readonly AgentNativeConnection[];
  mcp: readonly McpBindingV1[];
  payoutAddress: string;
  ensBindingHash: string | null;
}

export const RISK_LANES = ["LOW", "MID", "HIGH"] as const;
export type RiskLane = (typeof RISK_LANES)[number];

export interface AgentManifestV4 extends AgentManifestBase {
  schemaVersion: 4;
  catalogTemplateId: string;
  catalogSelectionHash: string;
  reviewedPromptHash: string;
  reviewedConfigHash: string;
  skills: readonly AgentSkillSnapshotV1[];
  reviewedSources: readonly ReviewedSourceV1[];
  nativeConnections: readonly AgentNativeConnection[];
  mcp: readonly McpBindingV1[];
  payoutAddress: string;
  ensBindingHash: string | null;
  riskTiers: readonly RiskLane[];
}

export interface AgentRuntimePolicyV1 extends Record<string, CanonicalValue> {
  framework: "langchain-v1";
  modelCalls: 1;
  maxMcpCalls: 4;
  maxOutputTokens: 768;
  deadlineMs: 300000;
}

export interface AgentManifestV5 extends AgentManifestBase {
  schemaVersion: 5;
  catalogTemplateId: string;
  catalogSelectionHash: string;
  reviewedPromptHash: string;
  reviewedConfigHash: string;
  skills: readonly AgentSkillSnapshotV1[];
  reviewedSources: readonly ReviewedSourceV1[];
  nativeConnections: readonly AgentNativeConnection[];
  mcp: readonly McpBindingV1[];
  payoutAddress: string;
  ensBindingHash: string | null;
  riskTiers: readonly RiskLane[];
  runtimePolicy: AgentRuntimePolicyV1;
}

export type AgentManifest =
  | AgentManifestV1
  | AgentManifestV2
  | AgentManifestV3
  | AgentManifestV4
  | AgentManifestV5;

export interface AgentReviewedSourceSummary {
  repository: string;
  revision: string;
  use: "integration" | "guidance-only";
}

export interface AgentSkillSummary {
  id: string;
  category: "PERSONA" | "DATA" | "ACTION" | "CONNECTION";
}

export interface AgentMcpSummary {
  bindingId: string;
  provider: McpProviderId;
  capability: McpCapability;
}

export const AGENT_LIFECYCLE_STATES = [
  "DRAFT",
  "WALLET_ATTACHED",
  "NAME_BOUND",
  "WRITE_PREPARED",
  "PUBLISHED",
] as const;

export type AgentLifecycleState = (typeof AGENT_LIFECYCLE_STATES)[number];
export type AgentPublicationMode = "ENS" | "WALLET";

export interface AgentWalletIdentity extends Record<string, CanonicalValue> {
  provider: "circle";
  walletId: string;
  address: string;
  network: "UNI-SEPOLIA";
  accountType: "SCA";
  state: "LIVE";
  evidenceHash: string;
  observedAt: string;
}

export interface AttachedAgentWallet extends AgentWalletIdentity {
  walletIdentityId: string;
  identityHash: string;
  attachedAt: string;
}

export interface AgentWalletProvider {
  provisionAgentWallet(
    input: { agentId: string; idempotencyKey: string },
    signal: AbortSignal,
  ): Promise<AgentWalletIdentity>;
}

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
  publicationMode: AgentPublicationMode | null;
  hireable: boolean;
  ownedByViewer: boolean;
  creatorParent: string | null;
  agentLabel: string | null;
  fullSubname: string | null;
  writePlanHash: string | null;
  canonicalState: "UNVERIFIED" | "CANONICAL" | "WALLET_AUTHORIZED" | "REFUSED";
  authorityState: "UNVERIFIED" | "CANONICAL_ENS" | "WALLET_AUTHORIZED" | "REFUSED";
  authorityOwner: string | null;
  authorityDelegate: string | null;
  authorityPolicyVersion: string | null;
  refusalReason: string | null;
  authorityReleaseSha: string | null;
  publicationDecisionId: string | null;
  walletPublicationDecisionId: string | null;
  walletReceiptHash: string | null;
  agentWallet: AttachedAgentWallet | null;
  publishedAt: string | null;
  manifestSchemaVersion: 1 | 2 | 3 | 4 | 5;
  riskTiers: readonly RiskLane[] | null;
  reviewedSources: readonly AgentReviewedSourceSummary[] | null;
  skillSummary: readonly AgentSkillSummary[] | null;
  mcpSummary: readonly AgentMcpSummary[] | null;
  mcpAvailability: "AVAILABLE" | "UNAVAILABLE" | "NOT_REQUIRED";
}

export interface EnsProtectedPublishedAgent extends AgentLifecycleVersion {
  lifecycleState: "PUBLISHED";
  publicationMode: "ENS";
  hireable: true;
  canonicalState: "CANONICAL";
  authorityState: "CANONICAL_ENS";
  creatorParent: string;
  agentLabel: string;
  fullSubname: string;
  writePlanHash: string;
  authorityOwner: string;
  authorityPolicyVersion: string;
  authorityReleaseSha: string;
  publicationDecisionId: string;
  walletPublicationDecisionId: null;
  walletReceiptHash: null;
  agentWallet: null;
  publishedAt: string;
}

export interface WalletProtectedPublishedAgent extends AgentLifecycleVersion {
  lifecycleState: "PUBLISHED";
  publicationMode: "WALLET";
  hireable: true;
  canonicalState: "WALLET_AUTHORIZED";
  authorityState: "WALLET_AUTHORIZED";
  creatorParent: "";
  agentLabel: "";
  fullSubname: "";
  writePlanHash: null;
  authorityOwner: "";
  authorityDelegate: null;
  authorityPolicyVersion: "";
  authorityReleaseSha: "";
  publicationDecisionId: null;
  walletPublicationDecisionId: string;
  walletReceiptHash: string;
  agentWallet: AttachedAgentWallet;
  publishedAt: string;
}

export type ProtectedPublishedAgent = EnsProtectedPublishedAgent | WalletProtectedPublishedAgent;

export interface AgentVersionProvenance {
  protocol: "INFT";
  chainId: number;
  contractAddress: string;
  tokenId: string;
  metadataUri: string | null;
  evidenceHash: string;
  observedAt: string;
}

export type ProtectedPublishedAgentRead = ProtectedPublishedAgent & {
  verifiedExternalHires: number;
  provenance: AgentVersionProvenance | null;
};

export const HIRE_REQUEST_STATES = [
  "PENDING_CONTEXT",
  "CONTEXT_RUNNING",
  "JOB_QUEUED",
  "BLOCKED",
  "FAILED",
] as const;

export type HireRequestState = (typeof HIRE_REQUEST_STATES)[number];

export interface HireRequestSnapshot extends Record<string, CanonicalValue> {
  hireRequestId: string;
  agentVersionId: string;
  promptHash: string;
  state: HireRequestState;
  version: number;
  jobId: string | null;
  contextHash: string | null;
  errorCode: string | null;
  claimEpoch: string | null;
  claimVersion: number;
  claimExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  replayed: boolean;
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

export interface GoalPolicyV1 extends Record<string, CanonicalValue> {
  cadenceMinutes: 5 | 15 | 30 | 60;
  runMode: "BOUNDED" | "CONTINUOUS";
  executionMode: "RESEARCH_ONLY" | "PROPOSE_SWAP";
  runLimit: number | null;
  maxAgents: number;
  perRunCapAtomic: string;
  dailyCapAtomic: string | null;
}

export interface GoalPolicyV2 extends GoalPolicyV1 {
  schemaVersion: 2;
  orchestrationMode: "TRI_RISK_V1";
  maxAgents: 3;
}

export type GoalPolicy = GoalPolicyV1 | GoalPolicyV2;

export interface AugmentedLayerPolicySnapshot extends Record<string, CanonicalValue> {
  policy: GoalPolicyV2;
  policyHash: string;
  updatedAt: string;
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

export type RiskStance = "BUY" | "SELL" | "HOLD";

export interface RiskLaneResultV1 extends Record<string, CanonicalValue> {
  schemaVersion: 1;
  riskLane: RiskLane;
  stance: RiskStance;
  summary: string;
  conclusion: string;
  swapProposal: SwapProposalV1 | null;
}

export interface TriRiskLaneReportV1 extends Record<string, CanonicalValue> {
  riskLane: RiskLane;
  stance: RiskStance;
  summary: string;
  conclusion: string;
  jobId: string;
  agentVersionId: string;
  resultHash: string;
  receiptId: string;
}

export interface TriRiskGoalRunReportV1 extends Record<string, CanonicalValue> {
  schemaVersion: 1;
  orchestrationMode: "TRI_RISK_V1";
  goalId: string;
  runId: string;
  status: "READY" | "PARTIAL";
  objective: string;
  summary: string;
  conclusion: string;
  agreement: "AGREEMENT" | "DISAGREEMENT";
  consensusStance: RiskStance | null;
  lanes: readonly TriRiskLaneReportV1[];
  evidence: readonly GoalRunEvidenceV1[];
  swapProposal: SwapProposalV1 | null;
}

export type GoalRunReport = GoalRunReportV1 | TriRiskGoalRunReportV1;

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
  goalRunJobId: string;
  agentVersionId: string;
  jobId: string | null;
  role: "ANALYSIS" | "SYNTHESIS";
  riskLane: RiskLane | null;
  selectionRank: number;
  coveredCapabilities: readonly string[];
  priceAtomic: string;
  manifestHash: string;
  fullSubname: string | null;
}

export interface McpSourceMetadataV1 {
  subgraphId: string;
  deploymentId: string;
  network: "mainnet";
  blockNumber: string;
  blockHash: string;
  completedAt: string;
}

export interface McpEvidenceV1 {
  schemaVersion: 1;
  invocationId: string;
  bindingId: string;
  provider: McpProviderId;
  capability: McpCapability;
  state: "SUCCEEDED" | "FAILED";
  requestHash: string;
  responseHash: string | null;
  contextHash: string | null;
  responseBytes: number;
  errorCode: string | null;
  releaseSha: string;
  completedAt: string;
  sourceMetadata?: McpSourceMetadataV1;
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
  report: GoalRunReport | null;
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
  canonicalState: "UNVERIFIED" | "CANONICAL" | "WALLET_AUTHORIZED" | "REFUSED";
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
  canonicalState: "UNVERIFIED" | "CANONICAL" | "WALLET_AUTHORIZED" | "REFUSED" | null;
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
  mcpInvocations: readonly McpEvidenceV1[];
  errorCode: string | null;
}

export interface KernelJobDetail extends KernelJobListItem {
  evidenceDetail: KernelJobEvidence;
}
