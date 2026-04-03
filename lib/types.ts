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
