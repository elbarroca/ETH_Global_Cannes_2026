export interface Cycle {
  id: number;
  timestamp: string;
  specialists: {
    name: string;
    emoji: string;
    analysis: string;
    price: number;
    attestation: string;
    model: string;
    provider: string;
    inftId: string;
  }[];
  adversarial: {
    alpha: { argument: string; recommendation: string; attestation: string };
    risk: { argument: string; recommendation: string; attestation: string };
    executor: { argument: string; recommendation: string; attestation: string };
  };
  payments: {
    from: string;
    to: string;
    amount: number;
    txHash: string;
    chain: "arc" | "hedera";
  }[];
  hcs: { topicId: string; sequenceNumber: number; timestamp: string };
  trade: {
    action: "BUY" | "SELL" | "HOLD";
    asset: string;
    percentage: number;
    stopLoss: number | null;
  };
  memory: { cycleRef: number; text: string }[];
  storageHash?: string;
  inftTokenId?: number;
  rebuttalTriggered?: boolean;
  swap?: {
    txHash: string;
    explorerUrl: string;
    method: "uniswap_v3" | "direct_transfer" | "skipped";
    amountIn?: string;
    tokenIn?: string;
    tokenOut?: string;
  };
  debateTranscripts?: DebateTranscriptView[];
}

export interface DebateTranscriptView {
  turnNumber: number;
  phase: string;
  fromAgent: string;
  toAgent: string | null;
  messageContent: string;
  responseContent: string | null;
  attestationHash: string | null;
  teeVerified: boolean;
  durationMs: number | null;
  createdAt: string;
}

export interface FundState {
  nav: number;
  navChange24h: number;
  totalCycles: number;
  totalPayments: number;
  totalSpend: number;
  winRate: number;
  totalInferences: number;
  positions: { asset: string; percentage: number }[];
  userShares: number;
  userDeposited: number;
  userValue: number;
}

export interface AgentActionRecord {
  id: string;
  actionType: string;
  agentName: string | null;
  status: string;
  payload: unknown;
  attestationHash: string | null;
  teeVerified: boolean;
  paymentAmount: string | null;
  paymentNetwork: string | null;
  paymentTxHash: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface CycleDetail {
  id: string;
  userId: string;
  cycleNumber: number;
  specialists: unknown;
  alphaAction: string | null;
  alphaPct: number | null;
  alphaAttestation: string | null;
  riskChallenge: string | null;
  riskMaxPct: number | null;
  riskAttestation: string | null;
  execAction: string | null;
  execPct: number | null;
  execStopLoss: string | null;
  execAttestation: string | null;
  decision: string | null;
  asset: string | null;
  decisionPct: number | null;
  hcsSeqNum: number | null;
  hashscanUrl: string | null;
  storageHash: string | null;
  totalCostUsd: number | null;
  navAfter: number | null;
  createdAt: string;
}

export interface ComputeDetailResponse {
  cycle: CycleDetail;
  actions: AgentActionRecord[];
}

export interface Agent {
  name: string;
  emoji: string;
  skill: string;
  accuracy: number;
  timesHired: number;
  pricePerQuery: number;
  inftId: string;
  model: string;
  provider: string;
  creator: string;
  isActive: boolean;
}
