export interface UserRecord {
  id: string;
  walletAddress: string;
  proxyWallet: { address: string; encryptedKey: string };
  telegram: {
    chatId: string | null;
    username: string | null;
    verified: boolean;
    notifyPreference: "every_cycle" | "trades_only" | "daily";
  };
  agent: {
    active: boolean;
    riskProfile: "conservative" | "balanced" | "aggressive";
    maxTradePercent: number;
    lastCycleId: number;
    lastCycleAt: string | null;
  };
  fund: {
    depositedUsdc: number;
    htsShareBalance: number;
    currentNav: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface InferenceResult {
  content: string;
  attestationHash: string;
  teeVerified: boolean;
}

export interface SpecialistResult {
  name: string;
  signal: string;
  confidence: number;
  attestationHash: string;
  teeVerified: boolean;
  [key: string]: unknown;
}

export interface DebateResult {
  alpha: {
    content: string;
    parsed: Record<string, unknown>;
    attestationHash: string;
    teeVerified: boolean;
  };
  risk: {
    content: string;
    parsed: Record<string, unknown>;
    attestationHash: string;
    teeVerified: boolean;
  };
  executor: {
    content: string;
    parsed: Record<string, unknown>;
    attestationHash: string;
    teeVerified: boolean;
  };
}

export interface CycleResult {
  userId: string;
  cycleId: number;
  specialists: SpecialistResult[];
  debate: DebateResult;
  decision: Record<string, unknown>;
  seqNum: number;
  hashscanUrl: string;
  timestamp: Date;
}

export interface CompactCycleRecord {
  c: number;
  u: string;
  t: string;
  rp: string;
  s: Array<{ n: string; sig: string; conf: number; att: string }>;
  adv: {
    a: { act: string; pct: number; att: string };
    r: { obj: string; max: number; att: string };
    e: { act: string; pct: number; sl: number; att: string };
  };
  d: { act: string; asset: string; pct: number };
  nav: number;
}
