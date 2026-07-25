import { randomBytes } from "node:crypto";
import {
  CIRCLE_BATCHING_NAME,
  CIRCLE_BATCHING_VERSION,
} from "@circle-fin/x402-batching";
import type {
  BatchEvmScheme,
  GatewayClient,
} from "@circle-fin/x402-batching/client";
import type { BatchFacilitatorClient } from "@circle-fin/x402-batching/server";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import type postgres from "postgres";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import {
  domainHash,
  type CanonicalValue,
} from "../kernel/canonical";

type DatabaseClient = ReturnType<typeof postgres>;
type PaymentScheme = Pick<BatchEvmScheme, "createPaymentPayload">;
type GatewayBalanceReader = Pick<GatewayClient, "getBalance">;
type Facilitator = Pick<BatchFacilitatorClient, "settle">;
type SettleResult = Awaited<ReturnType<BatchFacilitatorClient["settle"]>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RELEASE_SHA = /^[0-9a-f]{40}$/;
const HEX_32 = /^0x[0-9a-f]{64}$/;
const SIGNATURE = /^0x[0-9a-f]{130}$/;
const NETWORK = /^eip155:([1-9][0-9]{0,9})$/;
const MAX_AUTHORIZATION_TTL_SECONDS = 3_600;

export type LanePaymentState =
  | "PREPARED"
  | "SIGNED"
  | "SUBMITTED"
  | "GATEWAY_SETTLED"
  | "FAILED"
  | "AMBIGUOUS"
  | "FINALIZED";

export type LanePaymentErrorCode =
  | "X402_INVALID_INPUT"
  | "X402_LANE_NOT_READY"
  | "X402_ATTEMPT_CONFLICT"
  | "X402_ATTEMPT_NOT_FOUND"
  | "X402_ATTEMPT_EXPIRED"
  | "X402_ATTEMPT_STATE"
  | "X402_INSUFFICIENT_BALANCE"
  | "X402_SIGNED_PAYLOAD_INVALID"
  | "X402_SETTLEMENT_AMBIGUOUS"
  | "X402_FACILITATOR_REFUSED";

export class LanePaymentError extends Error {
  constructor(
    readonly code: LanePaymentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "LanePaymentError";
  }
}

interface AttemptRow {
  id: string;
  job_id: string;
  quote_id: string;
  delivery_receipt_id: string;
  agent_version_id: string;
  job_version: number;
  payer_address: string;
  creator_recipient: string;
  network: string;
  chain_id: number;
  asset_address: string;
  asset: string;
  amount_atomic: string;
  effect_request_hash: string;
  release_sha: string;
  gateway_verifying_contract: string;
  expires_at: Date;
  server_nonce: string;
  server_nonce_hash: string;
  challenge: unknown;
  challenge_hash: string;
  payment_requirements: unknown | null;
  signed_payload: unknown | null;
  signed_payload_hash: string | null;
  authorization_nonce: string | null;
  state: LanePaymentState;
  error_code: string | null;
  gateway_transaction_id: string | null;
  gateway_settled_at: Date | null;
  finalized_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface LaneRow {
  job_id: string;
  job_version: number;
  job_state: string;
  financial_outcome: string | null;
  quote_id: string;
  quote_amount: string;
  quote_asset: string;
  order_amount: string;
  order_asset: string;
  delivery_receipt_id: string;
  receipt_verified: boolean;
  receipt_result_hash: string;
  effect_state: string;
  effect_result_hash: string | null;
  effect_request_hash: string;
  agent_version_id: string;
  version_price: string;
  version_asset: string;
  payer_address: string;
  creator_recipient: string;
  creator_user_id: string;
}

interface FinalizeRow extends LaneRow, AttemptRow {
  current_job_id: string;
  current_quote_id: string;
  current_delivery_receipt_id: string;
  current_agent_version_id: string;
  current_job_version: number;
  current_payer_address: string;
  current_creator_recipient: string;
  current_effect_request_hash: string;
  payment_count: number;
  settlement_count: number;
  commission_count: number;
  refund_count: number;
}

export interface LanePaymentAttempt {
  id: string;
  jobId: string;
  quoteId: string;
  deliveryReceiptId: string;
  agentVersionId: string;
  jobVersion: number;
  payerAddress: Address;
  creatorRecipient: Address;
  network: `eip155:${string}`;
  chainId: number;
  assetAddress: Address;
  asset: string;
  amountAtomic: bigint;
  effectRequestHash: string;
  releaseSha: string;
  gatewayVerifyingContract: Address;
  expiresAt: Date;
  serverNonce: Hex;
  serverNonceHash: string;
  challenge: CanonicalValue;
  challengeHash: string;
  paymentRequirements: PaymentRequirements | null;
  signedPayload: PaymentPayload | null;
  signedPayloadHash: string | null;
  authorizationNonce: Hex | null;
  state: LanePaymentState;
  errorCode: string | null;
  gatewayTransactionId: string | null;
  gatewaySettledAt: Date | null;
  finalizedAt: Date | null;
}

export interface PrepareLanePaymentInput {
  jobId: string;
  network: `eip155:${string}`;
  assetAddress: Address;
  gatewayVerifyingContract: Address;
  releaseSha: string;
  authorizationTtlSeconds: number;
}

export interface PrepareLanePaymentDependencies {
  sql: DatabaseClient;
  now: () => Date;
  createServerNonce?: () => Hex;
}

export interface SignPreparedLanePaymentDependencies {
  sql: DatabaseClient;
  now: () => Date;
  gateway: GatewayBalanceReader;
  scheme: PaymentScheme;
}

export interface ReconcileLanePaymentDependencies {
  sql: DatabaseClient;
  now: () => Date;
  facilitator: Facilitator;
}

export interface FinalizeLanePaymentDependencies {
  sql: DatabaseClient;
  now: () => Date;
}

export interface FinalizedLanePayment {
  attemptId: string;
  paymentReceiptId: string;
  settlementId: string;
  commissionId: string;
  jobId: string;
  jobVersion: number;
  amountAtomic: bigint;
  asset: string;
  creatorUserId: string;
}

function invalid(message: string): never {
  throw new LanePaymentError("X402_INVALID_INPUT", message);
}

function normalizeUuid(value: string, label: string): string {
  const normalized = value.toLowerCase();
  if (!UUID.test(normalized)) invalid(`${label} must be a UUID`);
  return normalized;
}

function normalizeAddress(value: string, label: string): Address {
  if (!isAddress(value, { strict: true })) invalid(`${label} must be an EVM address`);
  return getAddress(value).toLowerCase() as Address;
}

function parseNetwork(value: string): { network: `eip155:${string}`; chainId: number } {
  const match = NETWORK.exec(value);
  if (!match) invalid("network must be a CAIP-2 EVM identifier");
  const chainId = Number(match[1]);
  if (!Number.isSafeInteger(chainId)) invalid("network chain ID is out of range");
  return { network: value as `eip155:${string}`, chainId };
}

function canonicalValue(value: unknown, label: string): CanonicalValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) invalid(`${label} contains a non-finite number`);
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry, label));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        canonicalValue(entry, label),
      ]),
    );
  }
  invalid(`${label} is not JSON-compatible`);
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function snapshot(row: AttemptRow): LanePaymentAttempt {
  return {
    id: row.id,
    jobId: row.job_id,
    quoteId: row.quote_id,
    deliveryReceiptId: row.delivery_receipt_id,
    agentVersionId: row.agent_version_id,
    jobVersion: row.job_version,
    payerAddress: row.payer_address as Address,
    creatorRecipient: row.creator_recipient as Address,
    network: row.network as `eip155:${string}`,
    chainId: row.chain_id,
    assetAddress: row.asset_address as Address,
    asset: row.asset,
    amountAtomic: BigInt(row.amount_atomic),
    effectRequestHash: row.effect_request_hash,
    releaseSha: row.release_sha,
    gatewayVerifyingContract: row.gateway_verifying_contract as Address,
    expiresAt: row.expires_at,
    serverNonce: row.server_nonce as Hex,
    serverNonceHash: row.server_nonce_hash,
    challenge: canonicalValue(row.challenge, "stored challenge"),
    challengeHash: row.challenge_hash,
    paymentRequirements: row.payment_requirements as PaymentRequirements | null,
    signedPayload: row.signed_payload as PaymentPayload | null,
    signedPayloadHash: row.signed_payload_hash,
    authorizationNonce: row.authorization_nonce as Hex | null,
    state: row.state,
    errorCode: row.error_code,
    gatewayTransactionId: row.gateway_transaction_id,
    gatewaySettledAt: row.gateway_settled_at,
    finalizedAt: row.finalized_at,
  };
}

async function findAttempt(sql: DatabaseClient, attemptId: string): Promise<AttemptRow> {
  const rows = await sql<AttemptRow[]>`
    SELECT *, amount_atomic::TEXT
    FROM x402_payment_attempts
    WHERE id = ${normalizeUuid(attemptId, "attemptId")}::uuid
  `;
  const row = rows[0];
  if (!row) throw new LanePaymentError("X402_ATTEMPT_NOT_FOUND", "Payment attempt not found");
  return row;
}

function assertLaneReady(row: LaneRow): void {
  if (
    row.job_state !== "DELIVERY_READY" ||
    row.financial_outcome !== null ||
    !row.receipt_verified ||
    row.effect_state !== "SUCCEEDED" ||
    row.effect_result_hash !== row.receipt_result_hash ||
    row.quote_amount !== row.order_amount ||
    row.version_price !== row.order_amount ||
    row.quote_asset !== row.order_asset ||
    row.version_asset !== row.order_asset
  ) {
    throw new LanePaymentError(
      "X402_LANE_NOT_READY",
      "Payment requires one verified DELIVERY_READY lane with an exact frozen quote and order",
    );
  }
}

export async function prepareLanePayment(
  input: PrepareLanePaymentInput,
  dependencies: PrepareLanePaymentDependencies,
): Promise<LanePaymentAttempt> {
  const jobId = normalizeUuid(input.jobId, "jobId");
  const { network, chainId } = parseNetwork(input.network);
  const assetAddress = normalizeAddress(input.assetAddress, "assetAddress");
  const gatewayVerifyingContract = normalizeAddress(
    input.gatewayVerifyingContract,
    "gatewayVerifyingContract",
  );
  if (!RELEASE_SHA.test(input.releaseSha)) invalid("releaseSha must be a lowercase Git SHA");
  if (
    !Number.isInteger(input.authorizationTtlSeconds) ||
    input.authorizationTtlSeconds < 2 ||
    input.authorizationTtlSeconds > MAX_AUTHORIZATION_TTL_SECONDS
  ) {
    invalid("authorizationTtlSeconds must be between 2 and 3600");
  }

  return dependencies.sql.begin(async (transaction) => {
    const sql = transaction as unknown as DatabaseClient;
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${'x402-lane:' + jobId}, 0))`;
    const prior = await sql<AttemptRow[]>`
      SELECT *, amount_atomic::TEXT
      FROM x402_payment_attempts WHERE job_id = ${jobId}::uuid
      FOR UPDATE
    `;
    if (prior[0]) {
      if (
        prior[0].network !== network ||
        prior[0].asset_address !== assetAddress ||
        prior[0].gateway_verifying_contract !== gatewayVerifyingContract ||
        prior[0].release_sha !== input.releaseSha
      ) {
        throw new LanePaymentError(
          "X402_ATTEMPT_CONFLICT",
          "The job already has a differently bound payment attempt",
        );
      }
      return snapshot(prior[0]);
    }

    const lanes = await sql<LaneRow[]>`
      SELECT
        job.id AS job_id, job.version AS job_version, job.state AS job_state,
        job.financial_outcome, quote.id AS quote_id,
        quote.amount_atomic::TEXT AS quote_amount, quote.asset AS quote_asset,
        order_row.amount_atomic::TEXT AS order_amount, order_row.asset AS order_asset,
        receipt.id AS delivery_receipt_id, receipt.verified AS receipt_verified,
        receipt.result_hash AS receipt_result_hash, effect.state AS effect_state,
        effect.result_hash AS effect_result_hash, effect.request_hash AS effect_request_hash,
        version.id AS agent_version_id, version.price_atomic::TEXT AS version_price,
        version.asset AS version_asset, lower(payer.wallet_address) AS payer_address,
        lower(COALESCE(version.payout_address, version.owner_wallet)) AS creator_recipient,
        agent.owner_user_id AS creator_user_id
      FROM jobs job
      JOIN kernel_orders order_row ON order_row.id = job.order_id
      JOIN quotes quote ON quote.id = order_row.quote_id
      JOIN receipts receipt ON receipt.job_id = job.id
      JOIN effects effect ON effect.id = receipt.effect_id AND effect.job_id = job.id
      JOIN agent_versions version ON version.id = job.agent_version_id
      JOIN kernel_agents agent ON agent.id = version.agent_id
      JOIN users payer ON payer.id = job.buyer_user_id
      WHERE job.id = ${jobId}::uuid
        AND NOT EXISTS (SELECT 1 FROM x402_payment_receipts payment WHERE payment.job_id = job.id)
        AND NOT EXISTS (SELECT 1 FROM settlements settlement WHERE settlement.job_id = job.id)
        AND NOT EXISTS (SELECT 1 FROM commissions commission WHERE commission.job_id = job.id)
        AND NOT EXISTS (SELECT 1 FROM refunds refund WHERE refund.job_id = job.id)
      FOR UPDATE OF job, order_row, quote, receipt, effect, version, agent, payer
    `;
    const lane = lanes[0];
    if (!lane) {
      throw new LanePaymentError("X402_LANE_NOT_READY", "No unpaid delivery-ready lane exists");
    }
    assertLaneReady(lane);

    const now = dependencies.now();
    const expiresAt = new Date(now.getTime() + input.authorizationTtlSeconds * 1_000);
    const serverNonce = (dependencies.createServerNonce ?? (() => `0x${randomBytes(32).toString("hex")}` as Hex))();
    if (!HEX_32.test(serverNonce)) invalid("createServerNonce returned an invalid nonce");
    const serverNonceHash = domainHash("x402-server-nonce", serverNonce);
    const challenge = {
      schemaVersion: 1,
      quoteId: lane.quote_id,
      jobId: lane.job_id,
      deliveryReceiptId: lane.delivery_receipt_id,
      jobVersion: lane.job_version,
      payer: normalizeAddress(lane.payer_address, "payer wallet"),
      recipient: normalizeAddress(lane.creator_recipient, "creator payout"),
      amountAtomic: lane.order_amount,
      asset: lane.order_asset,
      assetAddress,
      network,
      gatewayVerifyingContract,
      effectRequestHash: lane.effect_request_hash,
      releaseSha: input.releaseSha,
      expiresAt: expiresAt.toISOString(),
      serverNonce,
      serverNonceHash,
    } as const satisfies CanonicalValue;
    const challengeHash = domainHash("x402-lane-challenge", challenge);
    const inserted = await sql<AttemptRow[]>`
      INSERT INTO x402_payment_attempts (
        job_id, quote_id, delivery_receipt_id, agent_version_id, job_version,
        payer_address, creator_recipient, network, chain_id, asset_address, asset,
        amount_atomic, effect_request_hash, release_sha, gateway_verifying_contract,
        expires_at, server_nonce, server_nonce_hash, challenge, challenge_hash,
        created_at, updated_at
      ) VALUES (
        ${lane.job_id}::uuid, ${lane.quote_id}::uuid, ${lane.delivery_receipt_id}::uuid,
        ${lane.agent_version_id}::uuid, ${lane.job_version}, ${lane.payer_address},
        ${lane.creator_recipient}, ${network}, ${chainId}, ${assetAddress}, ${lane.order_asset},
        ${lane.order_amount}::bigint, ${lane.effect_request_hash}, ${input.releaseSha},
        ${gatewayVerifyingContract}, ${expiresAt}, ${serverNonce}, ${serverNonceHash},
        ${sql.json(challenge)}, ${challengeHash}, ${now}, ${now}
      )
      RETURNING *, amount_atomic::TEXT
    `;
    if (!inserted[0]) throw new Error("X402_ATTEMPT_INSERT_INVARIANT");
    return snapshot(inserted[0]);
  });
}

function validateSignedPayload(
  value: unknown,
  attempt: AttemptRow,
  requirements: PaymentRequirements,
  now: Date,
): { payload: PaymentPayload; authorizationNonce: Hex; payloadHash: string } {
  const schemeResult = objectValue(value, "scheme result");
  if (!hasExactKeys(schemeResult, ["x402Version", "payload"]) || schemeResult.x402Version !== 2) {
    throw new LanePaymentError("X402_SIGNED_PAYLOAD_INVALID", "Scheme returned an unsupported x402 payload");
  }
  const batch = objectValue(schemeResult.payload, "batch payload");
  const authorization = objectValue(batch.authorization, "batch authorization");
  if (
    !hasExactKeys(batch, ["signature", "authorization"]) ||
    !hasExactKeys(authorization, ["from", "to", "value", "validAfter", "validBefore", "nonce"]) ||
    typeof batch.signature !== "string" || !SIGNATURE.test(batch.signature) ||
    typeof authorization.from !== "string" ||
    normalizeAddress(authorization.from, "authorization.from") !== attempt.payer_address ||
    typeof authorization.to !== "string" ||
    normalizeAddress(authorization.to, "authorization.to") !== attempt.creator_recipient ||
    authorization.value !== attempt.amount_atomic ||
    typeof authorization.nonce !== "string" || !HEX_32.test(authorization.nonce) ||
    typeof authorization.validAfter !== "string" || !/^[0-9]{1,12}$/.test(authorization.validAfter) ||
    typeof authorization.validBefore !== "string" || !/^[0-9]{1,12}$/.test(authorization.validBefore)
  ) {
    throw new LanePaymentError("X402_SIGNED_PAYLOAD_INVALID", "Signed payload does not match the prepared attempt");
  }
  const validAfter = BigInt(authorization.validAfter);
  const validBefore = BigInt(authorization.validBefore);
  const expiry = BigInt(Math.floor(attempt.expires_at.getTime() / 1_000));
  if (validBefore <= validAfter || validBefore > expiry || validBefore <= BigInt(Math.floor(now.getTime() / 1_000))) {
    throw new LanePaymentError("X402_SIGNED_PAYLOAD_INVALID", "Signed authorization has an invalid validity window");
  }
  const payload: PaymentPayload = {
    x402Version: 2,
    accepted: requirements,
    payload: batch as unknown as Record<string, unknown>,
  };
  const canonicalPayload = canonicalValue(payload, "signed payload");
  return {
    payload,
    authorizationNonce: authorization.nonce as Hex,
    payloadHash: domainHash("x402-signed-payload", canonicalPayload),
  };
}

export async function signPreparedLanePayment(
  attemptId: string,
  dependencies: SignPreparedLanePaymentDependencies,
): Promise<LanePaymentAttempt> {
  const normalizedAttemptId = normalizeUuid(attemptId, "attemptId");
  return dependencies.sql.begin(async (transaction) => {
    const sql = transaction as unknown as DatabaseClient;
    const rows = await sql<AttemptRow[]>`
      SELECT *, amount_atomic::TEXT FROM x402_payment_attempts
      WHERE id = ${normalizedAttemptId}::uuid FOR UPDATE
    `;
    const attempt = rows[0];
    if (!attempt) throw new LanePaymentError("X402_ATTEMPT_NOT_FOUND", "Payment attempt not found");
    if (attempt.state !== "PREPARED") {
      if (attempt.state === "SIGNED" || attempt.state === "SUBMITTED" || attempt.state === "GATEWAY_SETTLED" || attempt.state === "AMBIGUOUS" || attempt.state === "FINALIZED") {
        return snapshot(attempt);
      }
      throw new LanePaymentError("X402_ATTEMPT_STATE", `Cannot sign a ${attempt.state} payment attempt`);
    }
    const now = dependencies.now();
    const remainingSeconds = Math.floor((attempt.expires_at.getTime() - now.getTime()) / 1_000) - 1;
    if (remainingSeconds < 1) {
      throw new LanePaymentError("X402_ATTEMPT_EXPIRED", "Prepared payment attempt has expired");
    }
    const balance = await dependencies.gateway.getBalance(attempt.payer_address as Address);
    if (!balance || typeof balance.available !== "bigint") {
      throw new LanePaymentError("X402_INVALID_INPUT", "Gateway returned a malformed balance");
    }
    if (balance.available < BigInt(attempt.amount_atomic)) {
      throw new LanePaymentError("X402_INSUFFICIENT_BALANCE", "Gateway balance is below the frozen payment amount");
    }
    const requirements: PaymentRequirements = {
      scheme: "exact",
      network: attempt.network as `eip155:${string}`,
      asset: attempt.asset_address,
      amount: attempt.amount_atomic,
      payTo: attempt.creator_recipient,
      maxTimeoutSeconds: remainingSeconds,
      extra: {
        name: CIRCLE_BATCHING_NAME,
        version: CIRCLE_BATCHING_VERSION,
        verifyingContract: attempt.gateway_verifying_contract,
      },
    };
    const created = await dependencies.scheme.createPaymentPayload(2, requirements);
    const signed = validateSignedPayload(created, attempt, requirements, now);
    const updated = await sql<AttemptRow[]>`
      UPDATE x402_payment_attempts
      SET state = 'SIGNED', payment_requirements = ${sql.json(canonicalValue(requirements, "payment requirements"))},
          signed_payload = ${sql.json(canonicalValue(signed.payload, "signed payload"))},
          signed_payload_hash = ${signed.payloadHash},
          authorization_nonce = ${signed.authorizationNonce}, updated_at = ${now}
      WHERE id = ${normalizedAttemptId}::uuid AND state = 'PREPARED'
      RETURNING *, amount_atomic::TEXT
    `;
    if (!updated[0]) throw new Error("X402_SIGN_TRANSITION_INVARIANT");
    return snapshot(updated[0]);
  });
}

function failureMetadata(error: unknown): { statusCode: number | null; text: string } {
  if (!error || typeof error !== "object") return { statusCode: null, text: "unknown settlement error" };
  const record = error as Record<string, unknown>;
  const statusCode = typeof record.statusCode === "number"
    ? record.statusCode
    : typeof record.status === "number" ? record.status : null;
  const text = [record.name, record.message, record.errorReason, record.errorMessage, record.code]
    .filter((entry): entry is string => typeof entry === "string")
    .join(" ")
    .slice(0, 512);
  return { statusCode, text };
}

function isNonceAmbiguity(value: string): boolean {
  return /(?:nonce.*(?:already|used)|(?:already|used).*nonce)/i.test(value);
}

function isAmbiguousFailure(error: unknown): boolean {
  const { statusCode, text } = failureMetadata(error);
  return (
    statusCode === null || statusCode >= 500 || statusCode === 408 || statusCode === 429 ||
    /timeout|timed out|transport|network|fetch|socket|abort|malformed|econn|enotfound/i.test(text) ||
    isNonceAmbiguity(text)
  );
}

async function recordReconciliation(
  sql: DatabaseClient,
  attemptId: string,
  state: "GATEWAY_SETTLED" | "FAILED" | "AMBIGUOUS",
  now: Date,
  gatewayTransactionId: string | null = null,
): Promise<LanePaymentAttempt> {
  const errorCode = state === "AMBIGUOUS"
    ? "X402_SETTLEMENT_AMBIGUOUS"
    : state === "FAILED" ? "X402_FACILITATOR_REFUSED" : null;
  const rows = await sql<AttemptRow[]>`
    UPDATE x402_payment_attempts
    SET state = ${state}, error_code = ${errorCode},
        gateway_transaction_id = ${gatewayTransactionId}::uuid,
        gateway_settled_at = ${state === "GATEWAY_SETTLED" ? now : null}, updated_at = ${now}
    WHERE id = ${attemptId}::uuid AND state IN ('SUBMITTED', 'AMBIGUOUS')
      AND NOT (state = 'AMBIGUOUS' AND ${state} = 'AMBIGUOUS')
    RETURNING *, amount_atomic::TEXT
  `;
  return snapshot(rows[0] ?? await findAttempt(sql, attemptId));
}

function validateSettlementResult(result: SettleResult, attempt: LanePaymentAttempt): string | null {
  const value = objectValue(result, "facilitator result");
  if (value.success !== true) return null;
  if (
    typeof value.transaction !== "string" || !UUID.test(value.transaction.toLowerCase()) ||
    typeof value.payer !== "string" || normalizeAddress(value.payer, "facilitator payer") !== attempt.payerAddress ||
    value.network !== attempt.network ||
    (value.amount !== undefined && value.amount !== attempt.amountAtomic.toString())
  ) {
    throw new LanePaymentError(
      "X402_SETTLEMENT_AMBIGUOUS",
      "Facilitator success did not match the payer, network, amount, or Gateway UUID",
    );
  }
  return value.transaction.toLowerCase();
}

export async function reconcileLanePayment(
  attemptId: string,
  dependencies: ReconcileLanePaymentDependencies,
): Promise<LanePaymentAttempt> {
  const normalizedAttemptId = normalizeUuid(attemptId, "attemptId");
  const submitted = await dependencies.sql.begin(async (transaction) => {
    const sql = transaction as unknown as DatabaseClient;
    const rows = await sql<AttemptRow[]>`
      SELECT *, amount_atomic::TEXT FROM x402_payment_attempts
      WHERE id = ${normalizedAttemptId}::uuid FOR UPDATE
    `;
    const attempt = rows[0];
    if (!attempt) throw new LanePaymentError("X402_ATTEMPT_NOT_FOUND", "Payment attempt not found");
    if (attempt.state === "SIGNED") {
      const advanced = await sql<AttemptRow[]>`
        UPDATE x402_payment_attempts SET state = 'SUBMITTED', updated_at = ${dependencies.now()}
        WHERE id = ${normalizedAttemptId}::uuid AND state = 'SIGNED'
        RETURNING *, amount_atomic::TEXT
      `;
      if (!advanced[0]) throw new Error("X402_SUBMIT_TRANSITION_INVARIANT");
      return advanced[0];
    }
    if (attempt.state === "SUBMITTED" || attempt.state === "AMBIGUOUS") return attempt;
    if (attempt.state === "GATEWAY_SETTLED" || attempt.state === "FINALIZED") return attempt;
    throw new LanePaymentError("X402_ATTEMPT_STATE", `Cannot settle a ${attempt.state} payment attempt`);
  });
  if (submitted.state === "GATEWAY_SETTLED" || submitted.state === "FINALIZED") return snapshot(submitted);
  if (!submitted.signed_payload || !submitted.payment_requirements) {
    throw new Error("X402_SUBMITTED_PAYLOAD_INVARIANT");
  }

  try {
    const result = await dependencies.facilitator.settle(
      submitted.signed_payload as Parameters<Facilitator["settle"]>[0],
      submitted.payment_requirements as Parameters<Facilitator["settle"]>[1],
    );
    const raw = objectValue(result, "facilitator result");
    if (raw.success !== true) {
      const reason = [raw.errorReason, raw.errorMessage].filter((entry) => typeof entry === "string").join(" ");
      return recordReconciliation(
        dependencies.sql,
        normalizedAttemptId,
        isNonceAmbiguity(reason) ? "AMBIGUOUS" : "FAILED",
        dependencies.now(),
      );
    }
    let gatewayTransactionId: string | null;
    try {
      gatewayTransactionId = validateSettlementResult(result, snapshot(submitted));
    } catch (error) {
      if (error instanceof LanePaymentError && error.code === "X402_SETTLEMENT_AMBIGUOUS") {
        return recordReconciliation(
          dependencies.sql,
          normalizedAttemptId,
          "AMBIGUOUS",
          dependencies.now(),
        );
      }
      throw error;
    }
    if (!gatewayTransactionId) {
      return recordReconciliation(
        dependencies.sql,
        normalizedAttemptId,
        "AMBIGUOUS",
        dependencies.now(),
      );
    }
    return recordReconciliation(
      dependencies.sql,
      normalizedAttemptId,
      "GATEWAY_SETTLED",
      dependencies.now(),
      gatewayTransactionId,
    );
  } catch (error) {
    return recordReconciliation(
      dependencies.sql,
      normalizedAttemptId,
      isAmbiguousFailure(error) ? "AMBIGUOUS" : "FAILED",
      dependencies.now(),
    );
  }
}

async function finalizedSnapshot(
  sql: DatabaseClient,
  attempt: FinalizeRow,
): Promise<FinalizedLanePayment> {
  const rows = await sql<{
    payment_receipt_id: string;
    settlement_id: string;
    commission_id: string;
    job_version: number;
  }[]>`
    SELECT payment.id AS payment_receipt_id, settlement.id AS settlement_id,
      commission.id AS commission_id, job.version AS job_version
    FROM x402_payment_receipts payment
    JOIN settlements settlement ON settlement.job_id = payment.job_id
    JOIN commissions commission ON commission.job_id = payment.job_id
    JOIN jobs job ON job.id = payment.job_id
    WHERE payment.payment_attempt_id = ${attempt.id}::uuid
  `;
  const row = rows[0];
  if (!row) throw new Error("X402_FINALIZED_LEDGER_INVARIANT");
  return {
    attemptId: attempt.id,
    paymentReceiptId: row.payment_receipt_id,
    settlementId: row.settlement_id,
    commissionId: row.commission_id,
    jobId: attempt.job_id,
    jobVersion: row.job_version,
    amountAtomic: BigInt(attempt.amount_atomic),
    asset: attempt.asset,
    creatorUserId: attempt.creator_user_id,
  };
}

export async function finalizeLanePayment(
  attemptId: string,
  dependencies: FinalizeLanePaymentDependencies,
): Promise<FinalizedLanePayment> {
  const normalizedAttemptId = normalizeUuid(attemptId, "attemptId");
  return dependencies.sql.begin(async (transaction) => {
    const sql = transaction as unknown as DatabaseClient;
    const rows = await sql<FinalizeRow[]>`
      SELECT attempt.*, attempt.amount_atomic::TEXT,
        job.id AS current_job_id, quote.id AS current_quote_id,
        receipt.id AS current_delivery_receipt_id,
        version.id AS current_agent_version_id,
        job.state AS job_state, job.version AS current_job_version,
        job.financial_outcome, quote.amount_atomic::TEXT AS quote_amount,
        quote.asset AS quote_asset, order_row.amount_atomic::TEXT AS order_amount,
        order_row.asset AS order_asset, receipt.verified AS receipt_verified,
        receipt.result_hash AS receipt_result_hash, effect.state AS effect_state,
        effect.result_hash AS effect_result_hash,
        effect.request_hash AS current_effect_request_hash,
        effect.request_hash AS effect_request_hash,
        version.price_atomic::TEXT AS version_price, version.asset AS version_asset,
        lower(payer.wallet_address) AS current_payer_address,
        lower(COALESCE(version.payout_address, version.owner_wallet)) AS current_creator_recipient,
        agent.owner_user_id AS creator_user_id,
        (SELECT count(*)::INTEGER FROM x402_payment_receipts payment WHERE payment.job_id = job.id) AS payment_count,
        (SELECT count(*)::INTEGER FROM settlements settlement WHERE settlement.job_id = job.id) AS settlement_count,
        (SELECT count(*)::INTEGER FROM commissions commission WHERE commission.job_id = job.id) AS commission_count,
        (SELECT count(*)::INTEGER FROM refunds refund WHERE refund.job_id = job.id) AS refund_count
      FROM x402_payment_attempts attempt
      JOIN jobs job ON job.id = attempt.job_id
      JOIN kernel_orders order_row ON order_row.id = job.order_id
      JOIN quotes quote ON quote.id = order_row.quote_id
      JOIN receipts receipt ON receipt.id = attempt.delivery_receipt_id
      JOIN effects effect ON effect.id = receipt.effect_id AND effect.job_id = job.id
      JOIN agent_versions version ON version.id = job.agent_version_id
      JOIN kernel_agents agent ON agent.id = version.agent_id
      JOIN users payer ON payer.id = job.buyer_user_id
      WHERE attempt.id = ${normalizedAttemptId}::uuid
      FOR UPDATE OF attempt, job, order_row, quote, receipt, effect, version, agent, payer
    `;
    const attempt = rows[0];
    if (!attempt) throw new LanePaymentError("X402_ATTEMPT_NOT_FOUND", "Payment attempt not found");
    if (attempt.state === "FINALIZED") return finalizedSnapshot(sql, attempt);
    if (attempt.state !== "GATEWAY_SETTLED") {
      throw new LanePaymentError("X402_ATTEMPT_STATE", `Cannot finalize a ${attempt.state} payment attempt`);
    }
    assertLaneReady(attempt);
    if (
      attempt.job_id !== attempt.current_job_id ||
      attempt.quote_id !== attempt.current_quote_id ||
      attempt.delivery_receipt_id !== attempt.current_delivery_receipt_id ||
      attempt.job_version !== attempt.current_job_version ||
      attempt.agent_version_id !== attempt.current_agent_version_id ||
      attempt.payer_address !== normalizeAddress(attempt.current_payer_address, "payer wallet") ||
      attempt.creator_recipient !== normalizeAddress(attempt.current_creator_recipient, "creator payout") ||
      attempt.effect_request_hash !== attempt.current_effect_request_hash ||
      attempt.amount_atomic !== attempt.order_amount ||
      attempt.asset !== attempt.order_asset ||
      attempt.payment_count !== 0 || attempt.settlement_count !== 0 ||
      attempt.commission_count !== 0 || attempt.refund_count !== 0 ||
      !attempt.gateway_transaction_id || !attempt.gateway_settled_at ||
      !attempt.signed_payload || !attempt.signed_payload_hash
    ) {
      throw new LanePaymentError("X402_ATTEMPT_CONFLICT", "Payment attempt no longer matches its economic ancestors");
    }

    const now = dependencies.now();
    const releaseHash = domainHash("x402-release", attempt.release_sha);
    const paymentRows = await sql<{ id: string }[]>`
      INSERT INTO x402_payment_receipts (
        job_id, delivery_receipt_id, payment_attempt_id, quote_id, challenge_hash,
        agent_version_id, payer_address, creator_recipient, network, chain_id,
        asset_address, amount_atomic, facilitator_payload, facilitator_payload_hash,
        settlement_kind, gateway_transaction_id, gateway_settled_at,
        transaction_hash, finality_block, finality_block_hash, finalized_at,
        payer_balance_delta_atomic, creator_balance_delta_atomic,
        request_hash, release_hash, release_sha, created_at
      ) VALUES (
        ${attempt.job_id}::uuid, ${attempt.delivery_receipt_id}::uuid, ${attempt.id}::uuid,
        ${attempt.quote_id}::uuid, ${attempt.challenge_hash}, ${attempt.agent_version_id}::uuid,
        ${attempt.payer_address}, ${attempt.creator_recipient}, ${attempt.network}, ${attempt.chain_id},
        ${attempt.asset_address}, ${attempt.amount_atomic}::bigint,
        ${sql.json(canonicalValue(attempt.signed_payload, "signed payload"))}, ${attempt.signed_payload_hash},
        'GATEWAY_NANOPAYMENT', ${attempt.gateway_transaction_id}::uuid,
        ${attempt.gateway_settled_at}, NULL, NULL, NULL, NULL, NULL, NULL,
        ${attempt.effect_request_hash}, ${releaseHash}, ${attempt.release_sha}, ${now}
      ) RETURNING id
    `;
    const paymentReceiptId = paymentRows[0]?.id;
    if (!paymentReceiptId) throw new Error("X402_PAYMENT_RECEIPT_INSERT_INVARIANT");

    const nextVersion = attempt.current_job_version + 1;
    const advanced = await sql<{ id: string }[]>`
      UPDATE jobs SET state = 'SUCCEEDED', version = ${nextVersion}, updated_at = ${now}
      WHERE id = ${attempt.job_id}::uuid AND state = 'DELIVERY_READY'
        AND version = ${attempt.current_job_version} AND financial_outcome IS NULL
      RETURNING id
    `;
    if (advanced.length !== 1) throw new Error("X402_JOB_FINALIZE_INVARIANT");
    await sql`
      INSERT INTO job_events (job_id, version, event_type, from_state, to_state, payload, created_at)
      VALUES (
        ${attempt.job_id}::uuid, ${nextVersion}, 'JOB_SUCCEEDED', 'DELIVERY_READY', 'SUCCEEDED',
        ${sql.json({ paymentAttemptId: attempt.id, paymentReceiptId })}, ${now}
      )
    `;
    const settlementRows = await sql<{ id: string }[]>`
      INSERT INTO settlements (job_id, receipt_id, amount_atomic, asset, created_at)
      VALUES (
        ${attempt.job_id}::uuid, ${attempt.delivery_receipt_id}::uuid,
        ${attempt.amount_atomic}::bigint, ${attempt.asset}, ${now}
      ) RETURNING id
    `;
    const settlementId = settlementRows[0]?.id;
    if (!settlementId) throw new Error("X402_SETTLEMENT_INSERT_INVARIANT");
    const commissionRows = await sql<{ id: string }[]>`
      INSERT INTO commissions (
        job_id, settlement_id, recipient_user_id, amount_atomic, asset, created_at
      ) VALUES (
        ${attempt.job_id}::uuid, ${settlementId}::uuid, ${attempt.creator_user_id},
        ${attempt.amount_atomic}::bigint, ${attempt.asset}, ${now}
      ) RETURNING id
    `;
    const commissionId = commissionRows[0]?.id;
    if (!commissionId) throw new Error("X402_COMMISSION_INSERT_INVARIANT");
    const finalized = await sql<{ id: string }[]>`
      UPDATE x402_payment_attempts
      SET state = 'FINALIZED', finalized_at = ${now}, updated_at = ${now}
      WHERE id = ${attempt.id}::uuid AND state = 'GATEWAY_SETTLED'
      RETURNING id
    `;
    if (finalized.length !== 1) throw new Error("X402_ATTEMPT_FINALIZE_INVARIANT");
    return {
      attemptId: attempt.id,
      paymentReceiptId,
      settlementId,
      commissionId,
      jobId: attempt.job_id,
      jobVersion: nextVersion,
      amountAtomic: BigInt(attempt.amount_atomic),
      asset: attempt.asset,
      creatorUserId: attempt.creator_user_id,
    };
  });
}
