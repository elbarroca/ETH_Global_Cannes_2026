import { getDb } from "../config/database";
import type { DatabaseClient } from "./service";

export interface OwnerEarningsResponse {
  asset: "USDC_ATOMIC";
  decimals: 6;
  grossSettledAtomic: string;
  ownerEarningsAtomic: string;
  platformFeeAtomic: "0";
  settledHireCount: number;
  lastSettledAt: string | null;
  agents: Array<{
    agentVersionId: string;
    name: string;
    fullSubname: string;
    ownerEarningsAtomic: string;
    settledHireCount: number;
    lastSettledAt: string | null;
  }>;
}

interface EarningsRow {
  agent_version_id: string;
  name: string;
  full_subname: string;
  owner_earnings_atomic: string;
  settled_hire_count: string;
  last_settled_at: Date;
}

function atomic(value: string): bigint {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error("KERNEL_EARNINGS_ROW_INVALID");
  return BigInt(value);
}

function count(value: string): number {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error("KERNEL_EARNINGS_ROW_INVALID");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error("KERNEL_EARNINGS_ROW_INVALID");
  return parsed;
}

export async function getOwnerEarnings(
  ownerUserId: string,
  options: { sql?: DatabaseClient } = {},
): Promise<OwnerEarningsResponse> {
  const sql = options.sql ?? getDb();
  const rows = await sql<EarningsRow[]>`
    SELECT version.id::text AS agent_version_id, agent.name, version.full_subname,
      sum(commission.amount_atomic)::text AS owner_earnings_atomic,
      count(*)::text AS settled_hire_count,
      max(settlement.created_at) AS last_settled_at
    FROM commissions commission
    JOIN settlements settlement
      ON settlement.id = commission.settlement_id
      AND settlement.job_id = commission.job_id
      AND settlement.asset = commission.asset
      AND settlement.amount_atomic = commission.amount_atomic
    JOIN jobs job
      ON job.id = commission.job_id
      AND job.state = 'SUCCEEDED'
      AND job.financial_outcome = 'SETTLED'
    JOIN agent_versions version ON version.id = job.agent_version_id
    JOIN kernel_agents agent
      ON agent.id = version.agent_id
      AND agent.owner_user_id = commission.recipient_user_id
    JOIN receipts receipt
      ON receipt.id = settlement.receipt_id
      AND receipt.job_id = job.id
      AND receipt.verified = true
    JOIN x402_payment_receipts payment
      ON payment.job_id = job.id
      AND payment.delivery_receipt_id = receipt.id
      AND payment.agent_version_id = version.id
      AND payment.amount_atomic = settlement.amount_atomic
      AND payment.settlement_kind = 'GATEWAY_NANOPAYMENT'
    JOIN x402_payment_attempts attempt
      ON attempt.id = payment.payment_attempt_id
      AND attempt.job_id = job.id
      AND attempt.state = 'FINALIZED'
      AND attempt.finalized_at IS NOT NULL
      AND attempt.asset = 'USDC_ATOMIC'
      AND attempt.amount_atomic = settlement.amount_atomic
    LEFT JOIN refunds refund ON refund.job_id = job.id
    WHERE commission.recipient_user_id = ${ownerUserId}
      AND commission.asset = 'USDC_ATOMIC'
      AND job.buyer_user_id <> agent.owner_user_id
      AND version.full_subname IS NOT NULL
      AND refund.id IS NULL
    GROUP BY version.id, agent.name, version.full_subname
    ORDER BY sum(commission.amount_atomic) DESC, version.id
  `;
  const grossSettledAtomic = rows.reduce(
    (total, row) => total + atomic(row.owner_earnings_atomic),
    0n,
  );
  const lastSettledAt = rows.reduce<Date | null>(
    (latest, row) => !latest || row.last_settled_at > latest ? row.last_settled_at : latest,
    null,
  );
  return {
    asset: "USDC_ATOMIC",
    decimals: 6,
    grossSettledAtomic: grossSettledAtomic.toString(),
    ownerEarningsAtomic: grossSettledAtomic.toString(),
    platformFeeAtomic: "0",
    settledHireCount: rows.reduce((total, row) => total + count(row.settled_hire_count), 0),
    lastSettledAt: lastSettledAt?.toISOString() ?? null,
    agents: rows.map((row) => ({
      agentVersionId: row.agent_version_id,
      name: row.name,
      fullSubname: row.full_subname,
      ownerEarningsAtomic: row.owner_earnings_atomic,
      settledHireCount: count(row.settled_hire_count),
      lastSettledAt: row.last_settled_at.toISOString(),
    })),
  };
}
