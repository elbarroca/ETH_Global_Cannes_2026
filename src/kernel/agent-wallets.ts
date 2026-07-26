import { isAddress } from "viem";
import { domainHash } from "./canonical";
import type { AgentWalletIdentity } from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const MAX_OBSERVATION_AGE_MS = 5 * 60 * 1_000;

export function validateAgentWalletIdentity(value: unknown, now: Date): AgentWalletIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("KERNEL_AGENT_WALLET_IDENTITY_INVALID");
  }
  const identity = value as Record<string, unknown>;
  const keys = Object.keys(identity).sort();
  const expected = [
    "accountType", "address", "evidenceHash", "network", "observedAt",
    "provider", "state", "walletId",
  ].sort();
  const observedAt = typeof identity.observedAt === "string" ? new Date(identity.observedAt) : null;
  if (
    keys.length !== expected.length || keys.some((key, index) => key !== expected[index]) ||
    identity.provider !== "circle" || typeof identity.walletId !== "string" ||
    !UUID.test(identity.walletId) || typeof identity.address !== "string" ||
    !isAddress(identity.address, { strict: true }) || /^0x0{40}$/i.test(identity.address) ||
    identity.network !== "UNI-SEPOLIA" || identity.accountType !== "SCA" ||
    identity.state !== "LIVE" || typeof identity.evidenceHash !== "string" ||
    !HASH.test(identity.evidenceHash) || !observedAt || Number.isNaN(observedAt.getTime()) ||
    observedAt.getTime() > now.getTime() || now.getTime() - observedAt.getTime() > MAX_OBSERVATION_AGE_MS
  ) {
    throw new Error("KERNEL_AGENT_WALLET_IDENTITY_INVALID");
  }
  return {
    provider: "circle",
    walletId: identity.walletId.toLowerCase(),
    address: identity.address.toLowerCase(),
    network: "UNI-SEPOLIA",
    accountType: "SCA",
    state: "LIVE",
    evidenceHash: identity.evidenceHash,
    observedAt: observedAt.toISOString(),
  };
}

export function agentWalletIdentityHash(identity: AgentWalletIdentity): string {
  return domainHash("agent-wallet-identity", identity);
}
