import { getPrisma } from "../config/prisma";
import type { Prisma } from "@prisma/client";
import type {
  AnalysisResult,
  PendingCycleRecord,
  PendingCycleStatus,
  CycleOrigin,
} from "../types/index";

function toPendingCycleRecord(row: Record<string, unknown>): PendingCycleRecord {
  return {
    id: row.id as string,
    userId: row.userId as string,
    cycleNumber: row.cycleNumber as number,
    goal: (row.goal as string | null) ?? "",
    status: row.status as PendingCycleStatus,
    origin: row.origin as CycleOrigin,
    specialists: row.specialists as PendingCycleRecord["specialists"],
    debate: row.debate as PendingCycleRecord["debate"],
    compactRecord: row.compactRecord as PendingCycleRecord["compactRecord"],
    richRecord: row.richRecord as PendingCycleRecord["richRecord"],
    expiresAt: (row.expiresAt as Date).toISOString(),
    telegramMsgId: (row.telegramMsgId as number | null) ?? null,
  };
}

export async function createPendingCycle(
  analysis: AnalysisResult,
  origin: CycleOrigin,
  timeoutMin: number,
  telegramMsgId?: number,
): Promise<PendingCycleRecord> {
  const prisma = getPrisma();
  const expiresAt = new Date(Date.now() + timeoutMin * 60_000);

  const row = await prisma.pendingCycle.create({
    data: {
      userId: analysis.userId,
      cycleNumber: analysis.cycleId,
      goal: analysis.goal,
      origin,
      specialists: analysis.specialists as unknown as Prisma.InputJsonValue,
      debate: analysis.debate as unknown as Prisma.InputJsonValue,
      compactRecord: analysis.compactRecord as unknown as Prisma.InputJsonValue,
      richRecord: analysis.richRecord as unknown as Prisma.InputJsonValue,
      expiresAt,
      telegramMsgId: telegramMsgId ?? null,
    },
  });

  return toPendingCycleRecord(row as unknown as Record<string, unknown>);
}

export async function getPendingCycle(id: string): Promise<PendingCycleRecord | null> {
  const prisma = getPrisma();
  const row = await prisma.pendingCycle.findUnique({ where: { id } });
  if (!row) return null;
  return toPendingCycleRecord(row as unknown as Record<string, unknown>);
}

export async function getPendingForUser(userId: string): Promise<PendingCycleRecord | null> {
  const prisma = getPrisma();
  const row = await prisma.pendingCycle.findFirst({
    where: { userId, status: "PENDING_APPROVAL" },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  return toPendingCycleRecord(row as unknown as Record<string, unknown>);
}

export async function resolvePendingCycle(
  id: string,
  resolution: {
    status: "APPROVED" | "REJECTED" | "TIMED_OUT";
    resolvedBy: "user" | "timeout" | "auto";
    rejectReason?: string;
    modifiedPct?: number;
  },
): Promise<PendingCycleRecord | null> {
  const prisma = getPrisma();

  // Atomic update — only resolves if still PENDING_APPROVAL (prevents race conditions)
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `UPDATE pending_cycles
     SET status = $1,
         resolved_by = $2,
         resolved_at = NOW(),
         modified_pct = $3
     WHERE id = $4::uuid AND status = 'PENDING_APPROVAL'
     RETURNING *`,
    resolution.status,
    resolution.resolvedBy,
    resolution.modifiedPct ?? null,
    id,
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id as string,
    userId: row.user_id as string,
    cycleNumber: row.cycle_number as number,
    goal: (row.goal as string | null) ?? "",
    status: row.status as PendingCycleStatus,
    origin: row.origin as CycleOrigin,
    specialists: row.specialists as PendingCycleRecord["specialists"],
    debate: row.debate as PendingCycleRecord["debate"],
    compactRecord: row.compact_record as PendingCycleRecord["compactRecord"],
    richRecord: row.rich_record as PendingCycleRecord["richRecord"],
    expiresAt: (row.expires_at as Date).toISOString(),
    telegramMsgId: (row.telegram_msg_id as number | null) ?? null,
  };
}

export async function getExpiredPending(): Promise<PendingCycleRecord[]> {
  const prisma = getPrisma();
  const rows = await prisma.pendingCycle.findMany({
    where: {
      status: "PENDING_APPROVAL",
      expiresAt: { lt: new Date() },
    },
  });
  return rows.map((row) => toPendingCycleRecord(row as unknown as Record<string, unknown>));
}
