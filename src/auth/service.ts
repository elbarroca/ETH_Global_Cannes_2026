import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { getAddress, isAddress, verifyMessage, type Hex } from "viem";
import { createSiweMessage, parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { getDb } from "../config/database";
import { AuthError } from "./errors";
import { authResources, authStatement } from "./policy";
import type { AuthAction, AuthChallengeRecord, AuthPolicy, SessionPrincipal } from "./types";

type DatabaseClient = ReturnType<typeof getDb>;

interface ChallengeRow {
  id: string;
  message: string;
  message_hash: string;
  wallet_address: `0x${string}`;
  domain: string;
  chain_id: number;
  action: AuthAction;
  nonce: string;
  audience: string;
  uri: string;
  issued_at: Date;
  expires_at: Date;
  consumed_at: Date | null;
}

interface SessionRow {
  id: string;
  wallet_address: `0x${string}`;
  user_id: string | null;
  action: AuthAction;
  expires_at: Date;
}

interface UserIdentityRow {
  id: string;
  wallet_address: string;
}

export interface CreatedChallenge {
  id: string;
  message: string;
  expiresAt: Date;
}

export interface VerifiedSession {
  token: string;
  principal: SessionPrincipal;
}

export interface OnboardedIdentity {
  userId: string;
  walletAddress: `0x${string}`;
  existing: boolean;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function constantTimeHexEqual(left: string, right: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(left) || !/^[0-9a-f]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function normalizeWallet(value: unknown): `0x${string}` {
  if (typeof value !== "string" || !isAddress(value, { strict: false })) {
    throw new AuthError("AUTH_INVALID_WALLET", "A valid Ethereum wallet address is required", 400);
  }
  try {
    return getAddress(value).toLowerCase() as `0x${string}`;
  } catch {
    throw new AuthError("AUTH_INVALID_WALLET", "A valid Ethereum wallet address is required", 400);
  }
}

function mapChallenge(row: ChallengeRow): AuthChallengeRecord {
  return {
    id: row.id,
    message: row.message,
    messageHash: row.message_hash,
    walletAddress: row.wallet_address,
    domain: row.domain,
    chainId: row.chain_id,
    action: row.action,
    nonce: row.nonce,
    audience: row.audience,
    uri: row.uri,
    issuedAt: new Date(row.issued_at),
    expiresAt: new Date(row.expires_at),
    consumedAt: row.consumed_at ? new Date(row.consumed_at) : null,
  };
}

export async function createAuthChallenge(
  input: { walletAddress: unknown; action: AuthAction },
  policy: AuthPolicy,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<CreatedChallenge> {
  const sql = options.sql ?? getDb();
  const walletAddress = normalizeWallet(input.walletAddress);
  const nonce = randomBytes(32).toString("hex");
  const issuedAt = options.now ?? new Date();
  const expiresAt = new Date(issuedAt.getTime() + policy.challengeTtlSeconds * 1_000);
  const requestId = `action=${input.action};audience=${policy.audience}`;
  const message = createSiweMessage({
    address: getAddress(walletAddress),
    chainId: policy.chainId,
    domain: policy.domain,
    expirationTime: expiresAt,
    issuedAt,
    nonce,
    requestId,
    resources: [...authResources(policy, input.action)],
    statement: authStatement(input.action, policy.audience),
    uri: policy.uri,
    version: "1",
  });
  const messageHash = sha256(message);
  const rows = await sql<ChallengeRow[]>`
    INSERT INTO auth_challenges (
      message, message_hash, wallet_address, domain, chain_id, action,
      nonce, audience, uri, issued_at, expires_at
    ) VALUES (
      ${message}, ${messageHash}, ${walletAddress}, ${policy.domain},
      ${policy.chainId}, ${input.action}, ${nonce}, ${policy.audience},
      ${policy.uri}, ${issuedAt}, ${expiresAt}
    )
    RETURNING *
  `;
  const row = rows[0];
  if (!row) throw new Error("AUTH_CHALLENGE_CREATE_FAILED");
  return { id: row.id, message: row.message, expiresAt: new Date(row.expires_at) };
}

function validateStoredMessage(
  challenge: AuthChallengeRecord,
  suppliedMessage: string,
  policy: AuthPolicy,
  now: Date,
): void {
  const suppliedHash = sha256(suppliedMessage);
  if (
    suppliedMessage !== challenge.message ||
    !constantTimeHexEqual(suppliedHash, challenge.messageHash)
  ) {
    throw new AuthError("AUTH_INVALID_CHALLENGE", "Challenge message does not match", 401);
  }
  const parsed = parseSiweMessage(suppliedMessage);
  const expectedResources = authResources(policy, challenge.action);
  const resourcesMatch =
    Array.isArray(parsed.resources) &&
    parsed.resources.length === expectedResources.length &&
    parsed.resources.every((resource, index) => resource === expectedResources[index]);
  const issuedAt = parsed.issuedAt instanceof Date ? parsed.issuedAt.getTime() : Number.NaN;
  const expirationTime =
    parsed.expirationTime instanceof Date ? parsed.expirationTime.getTime() : Number.NaN;
  const validCore = validateSiweMessage({
    address: challenge.walletAddress,
    domain: challenge.domain,
    message: parsed,
    nonce: challenge.nonce,
    time: now,
  });
  if (
    !validCore ||
    parsed.chainId !== challenge.chainId ||
    parsed.domain !== policy.domain ||
    parsed.uri !== challenge.uri ||
    parsed.uri !== policy.uri ||
    parsed.version !== "1" ||
    parsed.statement !== authStatement(challenge.action, challenge.audience) ||
    parsed.requestId !== `action=${challenge.action};audience=${challenge.audience}` ||
    challenge.audience !== policy.audience ||
    challenge.chainId !== policy.chainId ||
    issuedAt !== challenge.issuedAt.getTime() ||
    expirationTime !== challenge.expiresAt.getTime() ||
    !resourcesMatch
  ) {
    throw new AuthError("AUTH_INVALID_CHALLENGE", "Challenge fields do not match policy", 401);
  }
}

export async function verifyAuthChallenge(
  input: { challengeId: unknown; message: unknown; signature: unknown },
  policy: AuthPolicy,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<VerifiedSession> {
  if (
    typeof input.challengeId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(input.challengeId) ||
    typeof input.message !== "string" ||
    input.message.length > 4_096 ||
    typeof input.signature !== "string"
  ) {
    throw new AuthError("AUTH_INVALID_REQUEST", "Malformed verification request", 400);
  }
  if (input.signature === "mock") {
    throw new AuthError("AUTH_MOCK_SIGNATURE_REJECTED", "Mock signatures are not accepted", 401);
  }
  if (!/^0x[0-9a-fA-F]{130}$/.test(input.signature)) {
    throw new AuthError("AUTH_INVALID_SIGNATURE", "Invalid wallet signature", 401);
  }

  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const rows = await sql<ChallengeRow[]>`
    SELECT * FROM auth_challenges WHERE id = ${input.challengeId}::uuid
  `;
  const row = rows[0];
  if (!row) throw new AuthError("AUTH_INVALID_CHALLENGE", "Challenge not found", 401);
  const challenge = mapChallenge(row);
  if (challenge.consumedAt) {
    throw new AuthError("AUTH_CHALLENGE_REPLAYED", "Challenge was already consumed", 409);
  }
  if (now >= challenge.expiresAt) {
    throw new AuthError("AUTH_CHALLENGE_EXPIRED", "Challenge has expired", 401);
  }
  validateStoredMessage(challenge, input.message, policy, now);

  let signatureValid = false;
  try {
    signatureValid = await verifyMessage({
      address: challenge.walletAddress,
      message: input.message,
      signature: input.signature as Hex,
    });
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) {
    throw new AuthError("AUTH_INVALID_SIGNATURE", "Invalid wallet signature", 401);
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const sessionExpiresAt = new Date(now.getTime() + policy.sessionTtlSeconds * 1_000);
  const sessionId = randomUUID();

  const principal = await sql.begin(async (transaction) => {
    const tx = transaction as unknown as DatabaseClient;
    const consumed = await tx<{ id: string }[]>`
      UPDATE auth_challenges
      SET consumed_at = ${now}
      WHERE id = ${challenge.id}::uuid
        AND consumed_at IS NULL
        AND expires_at > ${now}
      RETURNING id
    `;
    if (consumed.length !== 1) {
      throw new AuthError("AUTH_CHALLENGE_REPLAYED", "Challenge is no longer usable", 409);
    }
    const sessions = await tx<SessionRow[]>`
      INSERT INTO auth_sessions (
        id, challenge_id, token_hash, wallet_address, user_id, action, expires_at, created_at
      ) VALUES (
        ${sessionId}::uuid, ${challenge.id}::uuid, ${tokenHash},
        ${challenge.walletAddress},
        (SELECT id FROM users WHERE wallet_address = ${challenge.walletAddress}),
        ${challenge.action}, ${sessionExpiresAt}, ${now}
      )
      RETURNING id, wallet_address, user_id, action, expires_at
    `;
    const session = sessions[0];
    if (!session) throw new Error("AUTH_SESSION_CREATE_FAILED");
    return {
      sessionId: session.id,
      walletAddress: session.wallet_address,
      userId: session.user_id,
      action: session.action,
      expiresAt: new Date(session.expires_at),
    } satisfies SessionPrincipal;
  });

  return { token, principal };
}

export async function getSessionPrincipal(
  token: string,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<SessionPrincipal | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const rows = await sql<SessionRow[]>`
    SELECT id, wallet_address, user_id, action, expires_at
    FROM auth_sessions
    WHERE token_hash = ${sha256(token)}
      AND revoked_at IS NULL
      AND expires_at > ${now}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    sessionId: row.id,
    walletAddress: row.wallet_address,
    userId: row.user_id,
    action: row.action,
    expiresAt: new Date(row.expires_at),
  };
}

export async function revokeSession(
  token: string,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<void> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  await sql`
    UPDATE auth_sessions
    SET revoked_at = COALESCE(revoked_at, ${now})
    WHERE token_hash = ${sha256(token)}
  `;
}

export async function onboardVerifiedSession(
  principal: SessionPrincipal,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<OnboardedIdentity> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as DatabaseClient;
    const sessions = await tx<SessionRow[]>`
      SELECT id, wallet_address, user_id, action, expires_at
      FROM auth_sessions
      WHERE id = ${principal.sessionId}::uuid
        AND wallet_address = ${principal.walletAddress}
        AND revoked_at IS NULL
        AND expires_at > ${now}
      FOR UPDATE
    `;
    const session = sessions[0];
    if (!session) throw new AuthError("AUTH_SESSION_EXPIRED", "Session is no longer valid", 401);

    if (session.user_id) {
      const existingRows = await tx<UserIdentityRow[]>`
        SELECT id, wallet_address FROM users WHERE id = ${session.user_id}
      `;
      const existing = existingRows[0];
      if (!existing || existing.wallet_address !== principal.walletAddress) {
        throw new AuthError("AUTH_FORBIDDEN", "Session identity is inconsistent", 403);
      }
      return {
        userId: existing.id,
        walletAddress: principal.walletAddress,
        existing: true,
      };
    }

    const userId = randomUUID();
    const inserted = await tx<UserIdentityRow[]>`
      INSERT INTO users (id, wallet_address, created_at, updated_at)
      VALUES (${userId}, ${principal.walletAddress}, ${now}, ${now})
      ON CONFLICT (wallet_address) DO NOTHING
      RETURNING id, wallet_address
    `;
    const existingRows = inserted.length > 0
      ? inserted
      : await tx<UserIdentityRow[]>`
          SELECT id, wallet_address FROM users WHERE wallet_address = ${principal.walletAddress}
        `;
    const user = existingRows[0];
    if (!user) throw new Error("AUTH_ONBOARD_CREATE_FAILED");
    await tx`
      UPDATE auth_sessions
      SET user_id = ${user.id}
      WHERE id = ${principal.sessionId}::uuid AND user_id IS NULL
    `;
    return {
      userId: user.id,
      walletAddress: principal.walletAddress,
      existing: inserted.length === 0,
    };
  });
}
