import { getPrisma } from "../config/prisma";
import type { Prisma } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- bridge Record<string, unknown> to Prisma JSON
type JsonPayload = Record<string, any> | Prisma.InputJsonValue;

type ActionType =
  | "CYCLE_STARTED"
  | "SPECIALIST_HIRED"
  | "INFERENCE_CALLED"
  | "PAYMENT_SENT"
  | "DEBATE_ALPHA"
  | "DEBATE_RISK"
  | "DEBATE_EXECUTOR"
  | "HCS_LOGGED"
  | "STORAGE_UPLOADED"
  | "INFT_UPDATED"
  | "TELEGRAM_NOTIFIED"
  | "CYCLE_COMPLETED"
  | "PENDING_APPROVAL"
  | "CYCLE_APPROVED"
  | "CYCLE_REJECTED"
  | "CYCLE_TIMED_OUT"
  | "AGENT_HIRED"
  | "AGENT_FIRED"
  | "TRADE_EXECUTED";

interface LogActionInput {
  userId: string;
  cycleId?: string;
  actionType: ActionType;
  agentName?: string;
  status?: "success" | "failed" | "skipped";
  payload?: JsonPayload;
  attestationHash?: string;
  teeVerified?: boolean;
  paymentAmount?: string;
  paymentNetwork?: string;
  paymentTxHash?: string;
  durationMs?: number;
}

export async function logAction(input: LogActionInput): Promise<string> {
  const db = getPrisma();
  const action = await db.agentAction.create({
    data: {
      userId: input.userId,
      cycleId: input.cycleId,
      actionType: input.actionType,
      agentName: input.agentName,
      status: input.status ?? "success",
      payload: (input.payload as Prisma.InputJsonValue) ?? undefined,
      attestationHash: input.attestationHash,
      teeVerified: input.teeVerified,
      paymentAmount: input.paymentAmount,
      paymentNetwork: input.paymentNetwork,
      paymentTxHash: input.paymentTxHash,
      durationMs: input.durationMs,
    },
  });
  return action.id;
}

export async function logCycleRecord(
  userId: string,
  cycleNumber: number,
  data: {
    specialists: Prisma.InputJsonValue;
    alpha?: { action: string; pct: number; attestation: string; reasoning?: string };
    risk?: { challenge: string; maxPct: number; attestation: string; reasoning?: string };
    executor?: { action: string; pct: number; stopLoss: string; attestation: string; reasoning?: string };
    decision?: string;
    asset?: string;
    decisionPct?: number;
    hcsSeqNum?: number;
    hashscanUrl?: string;
    storageHash?: string;
    totalCostUsd?: number;
    navAfter?: number;
  },
): Promise<string> {
  const db = getPrisma();
  const cycle = await db.cycle.create({
    data: {
      userId,
      cycleNumber,
      specialists: data.specialists,
      alphaAction: data.alpha?.action,
      alphaPct: data.alpha?.pct,
      alphaAttestation: data.alpha?.attestation,
      riskChallenge: data.risk?.challenge,
      riskMaxPct: data.risk?.maxPct,
      riskAttestation: data.risk?.attestation,
      execAction: data.executor?.action,
      execPct: data.executor?.pct,
      execStopLoss: data.executor?.stopLoss,
      execAttestation: data.executor?.attestation,
      alphaReasoning: data.alpha?.reasoning,
      riskReasoning: data.risk?.reasoning,
      execReasoning: data.executor?.reasoning,
      decision: data.decision,
      asset: data.asset,
      decisionPct: data.decisionPct,
      hcsSeqNum: data.hcsSeqNum,
      hashscanUrl: data.hashscanUrl,
      storageHash: data.storageHash,
      totalCostUsd: data.totalCostUsd,
      navAfter: data.navAfter,
    },
  });
  return cycle.id;
}

export async function getUserActions(
  userId: string,
  limit = 50,
): Promise<Prisma.AgentActionGetPayload<object>[]> {
  return getPrisma().agentAction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getCycleActions(
  cycleId: string,
): Promise<Prisma.AgentActionGetPayload<object>[]> {
  return getPrisma().agentAction.findMany({
    where: { cycleId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getUserCycles(
  userId: string,
  limit = 25,
): Promise<Prisma.CycleGetPayload<object>[]> {
  return getPrisma().cycle.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
