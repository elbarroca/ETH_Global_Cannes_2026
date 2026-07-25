import { createHash } from "node:crypto";
import { canonicalJson, domainHash, type CanonicalValue } from "../kernel/canonical";
import { getDb } from "../config/database";
import type { DatabaseClient } from "../kernel/service";
import type {
  AdapterExecutionRequest,
  AdapterExecutionResult,
  KernelAdapter,
} from "../worker/adapter";
import {
  currentClaimHeld,
  deriveA3VerifiedJournalPayload,
  type ClaimedJob,
} from "../worker/store";
import {
  StorageVerifierError,
  type StorageVerificationRequest,
  type StorageVerificationResult,
} from "./storage-verifier";
import {
  checkFreshEnsAuthority,
  type EnsAuthorityOperation,
  type EnsAuthorityRuntime,
} from "../ens/authority";

const POLICY_VERSION = "strict-0g-v1";
const REQUEST_DEADLINE_MS = 5 * 60 * 1_000;
const MAX_OUTPUT_TOKENS = 768;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const ROOT_PATTERN = /^0x[0-9a-f]{64}$/;
const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/;

export type A3JournalStage =
  | "PREPARED"
  | "REQUEST_SENT"
  | "RESPONSE_VERIFIED"
  | "STORAGE_REQUESTED"
  | "STORAGE_COMMITTED"
  | "READBACK_VERIFIED"
  | "FAILED";

export interface StrictComputeService {
  provider: string;
  model: string;
  baseUrl: string;
  endpoint: string;
  verifiability: string;
  teeSignerAddress: string;
  teeSignerAcknowledged: boolean;
  additionalInfo: unknown;
  inputPriceAtomic?: string;
  outputPriceAtomic?: string;
}

export interface StrictComputeResponse {
  status: number;
  provider: string;
  model: string;
  requestId: string | null;
  body: unknown;
}

export interface StrictComputeUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  actualCostAtomic: string;
}

export interface StrictComputeSignature {
  text: string;
  signature: string;
}

export interface StrictComputeTransport {
  resolveService(
    provider: string,
    model: string,
    signal: AbortSignal,
  ): Promise<StrictComputeService>;
  getRequestHeaders(
    service: StrictComputeService,
    requestBytes: string,
    signal: AbortSignal,
  ): Promise<Record<string, string>>;
  sendRequest(
    service: StrictComputeService,
    requestBytes: string,
    headers: Readonly<Record<string, string>>,
    signal: AbortSignal,
  ): Promise<StrictComputeResponse>;
  fetchSignature(
    service: StrictComputeService,
    requestId: string,
    signal: AbortSignal,
  ): Promise<unknown>;
  verifySignature(
    signedText: string,
    signature: string,
    expectedSigner: string,
  ): Promise<boolean>;
}

export interface StrictStorageTransport {
  store(
    request: { effectId: string; bytes: Uint8Array; digest: string },
    signal: AbortSignal,
  ): Promise<unknown>;
}

export interface StrictA3Hooks {
  afterPrepared?: () => Promise<void>;
  afterResponseVerified?: () => Promise<void>;
  afterStorageCommitted?: () => Promise<void>;
  afterReadbackVerified?: () => Promise<void>;
}

export interface StrictA3AdapterOptions {
  sql?: DatabaseClient;
  now?: Date | (() => Date);
  deadlineMs?: number;
  fixture?: {
    provider: string;
    model: string;
    storageIndexerUrl: string;
    compute: StrictComputeTransport;
    storage: StrictStorageTransport;
    verifier: (
      request: StorageVerificationRequest,
      signal: AbortSignal,
    ) => Promise<StorageVerificationResult>;
    chatModel?: StrictA3ChatModel;
  };
  productionRuntime?: NonNullable<StrictA3AdapterOptions["fixture"]> & {
    effectId: string;
    budgetExpiresAt: Date;
    maxCostAtomic: string;
    releaseSha: string;
    reservationAmountAtomic: string;
    reservationEffectIdentity: string;
  };
  hooks?: StrictA3Hooks;
  environment?: Record<string, string | undefined>;
  authority?: EnsAuthorityRuntime;
}

export interface StrictA3ChatModelResult {
  service: StrictComputeService & { expectedSigner: string };
  response: { content: string; requestId: string; usage: StrictComputeUsage };
  signature: StrictComputeSignature;
}

export interface StrictA3ChatModel {
  invokeStrict(
    requestBytes: string,
    signal: AbortSignal,
    beforeEffect: (operation: EnsAuthorityOperation) => Promise<void>,
  ): Promise<StrictA3ChatModelResult>;
}

interface A3JournalRow {
  effect_id: string;
  job_id: string;
  intent_id: string;
  agent_version_id: string;
  schema_version: number;
  version: number;
  stage: A3JournalStage;
  creator_user_id: string;
  creator_wallet: string;
  buyer_user_id: string;
  buyer_wallet: string;
  agent_version_number: number;
  manifest: unknown;
  manifest_hash: string;
  input: unknown;
  input_hash: string;
  provider: string;
  model: string;
  nonce: string;
  deadline_at: Date;
  policy_version: string;
  request_bytes: string;
  request_hash: string;
  request_id: string | null;
  request_signature: string | null;
  signer_address: string | null;
  response_content: string | null;
  response_hash: string | null;
  compute_receipt_bytes: string | null;
  compute_receipt_digest: string | null;
  storage_receipt_bytes: string | null;
  storage_receipt_digest: string | null;
  expected_root: string | null;
  expected_digest: string | null;
  expected_size: number | null;
  readback_root: string | null;
  readback_digest: string | null;
  readback_size: number | null;
  result: unknown;
  proof_hash: string | null;
  error_code: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  actual_cost_atomic: string | null;
}

interface LineageRow {
  agent_version_number: number;
  manifest: unknown;
  manifest_hash: string;
  proof_policy: string;
  owner_wallet: string;
  owner_user_id: string;
  input: unknown;
  input_hash: string;
  request_hash: string;
  buyer_wallet: string;
}

interface ValidatedService extends StrictComputeService {
  expectedSigner: string;
}

export class A3TerminalError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "A3TerminalError";
    this.code = code;
  }
}

class A3ClaimLostError extends Error {
  constructor() {
    super("A3_CLAIM_LOST");
    this.name = "A3ClaimLostError";
  }
}

export class A3SimulatedCrashError extends Error {
  constructor() {
    super("A3_SIMULATED_CRASH");
    this.name = "A3SimulatedCrashError";
  }
}

function transactionClient(transaction: unknown): DatabaseClient {
  return transaction as DatabaseClient;
}

function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function plainRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function asCanonicalValue(value: unknown): CanonicalValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new A3TerminalError("A3_NON_CANONICAL_DATA");
    return value;
  }
  if (Array.isArray(value)) return value.map(asCanonicalValue);
  const object = plainRecord(value);
  if (!object) throw new A3TerminalError("A3_NON_CANONICAL_DATA");
  return Object.fromEntries(
    Object.entries(object).map(([key, entry]) => [key, asCanonicalValue(entry)]),
  );
}

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) throw new A3ClaimLostError();
}

interface ExecutionDeadline {
  signal: AbortSignal;
  expired: () => boolean;
  cleanup: () => void;
}

function executionDeadline(parent: AbortSignal, remainingMs: number): ExecutionDeadline {
  const controller = new AbortController();
  let deadlineExpired = false;
  let cleaned = false;
  const onParentAbort = (): void => controller.abort(parent.reason);
  const onDeadline = (): void => {
    deadlineExpired = true;
    controller.abort(new Error("A3_REQUEST_DEADLINE_EXPIRED"));
  };
  parent.addEventListener("abort", onParentAbort, { once: true });
  if (parent.aborted) onParentAbort();
  const timer = setTimeout(onDeadline, Math.max(0, remainingMs));
  if (remainingMs <= 0) onDeadline();
  return {
    signal: controller.signal,
    expired: () => deadlineExpired,
    cleanup: () => {
      if (cleaned) return;
      cleaned = true;
      clearTimeout(timer);
      parent.removeEventListener("abort", onParentAbort);
    },
  };
}

async function awaitWithSignal<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw signal.reason instanceof Error
    ? signal.reason
    : new Error("A3_OPERATION_ABORTED");
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => signal.removeEventListener("abort", onAbort);
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(signal.reason instanceof Error ? signal.reason : new Error("A3_OPERATION_ABORTED"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    let pending: Promise<T>;
    try {
      pending = operation();
    } catch (error) {
      settled = true;
      cleanup();
      reject(error);
      return;
    }
    pending.then((value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    }, (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    });
  });
}

function checkExecutionAbort(parent: AbortSignal, deadline: ExecutionDeadline): void {
  if (parent.aborted) throw new A3ClaimLostError();
  if (deadline.expired()) throw new A3TerminalError("A3_REQUEST_DEADLINE_EXPIRED");
}

function claimFromRequest(request: AdapterExecutionRequest): ClaimedJob {
  return {
    jobId: request.jobId,
    effectId: request.effectId,
    intentId: request.intentId,
    buyerUserId: request.buyerUserId,
    agentVersionId: request.agentVersionId,
    ownerUserId: request.ownerUserId,
    adapterKey: "protected-a3",
    input: request.input,
    attempt: request.attempt,
    maxAttempts: request.maxAttempts,
    leaseOwner: request.leaseOwner,
    workerEpoch: request.workerEpoch,
    claimVersion: request.claimVersion,
    leaseExpiresAt: request.leaseExpiresAt,
  };
}

export function validateStrictComputeService(
  service: StrictComputeService,
  provider: string,
  model: string,
): ValidatedService {
  if (service.provider !== provider || service.model !== model) {
    throw new A3TerminalError("A3_PROVIDER_MODEL_MISMATCH");
  }
  if (service.verifiability !== "TeeML") {
    throw new A3TerminalError("A3_COMPUTE_NOT_TEEML");
  }
  if (
    !service.teeSignerAcknowledged ||
    !ADDRESS_PATTERN.test(service.teeSignerAddress)
  ) {
    throw new A3TerminalError("A3_SIGNER_NOT_ACKNOWLEDGED");
  }
  for (const [name, value] of [["base", service.baseUrl], ["endpoint", service.endpoint]] as const) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) {
        throw new Error("invalid");
      }
    } catch {
      throw new A3TerminalError(name === "base" ? "A3_PROVIDER_URL_INVALID" : "A3_ENDPOINT_INVALID");
    }
  }
  const expectedEndpoint = `${service.baseUrl.replace(/\/$/, "")}/v1/proxy`;
  if (service.endpoint.replace(/\/$/, "") !== expectedEndpoint) {
    throw new A3TerminalError("A3_ENDPOINT_MISMATCH");
  }
  let rawAdditionalInfo = service.additionalInfo;
  if (typeof rawAdditionalInfo === "string") {
    try {
      rawAdditionalInfo = JSON.parse(rawAdditionalInfo);
    } catch {
      throw new A3TerminalError("A3_ADDITIONAL_INFO_MALFORMED");
    }
  }
  const additionalInfo = plainRecord(rawAdditionalInfo);
  const allowedKeys = [
    "ImageDigest",
    "ImageName",
    "TEEVerifier",
    "TargetSeparated",
    "TargetTeeAddress",
    "VerifierURL",
  ];
  if (!additionalInfo || Object.keys(additionalInfo).some((key) => !allowedKeys.includes(key))) {
    throw new A3TerminalError("A3_ADDITIONAL_INFO_MALFORMED");
  }
  const targetAddress = typeof additionalInfo.TargetTeeAddress === "string"
    ? additionalInfo.TargetTeeAddress
    : "";
  if (additionalInfo.TargetSeparated !== true || !ADDRESS_PATTERN.test(targetAddress)) {
    throw new A3TerminalError("A3_TARGET_TEE_INVALID");
  }
  if (service.teeSignerAddress !== targetAddress) {
    throw new A3TerminalError("A3_PROVIDER_SIGNER_MISMATCH");
  }
  return { ...service, expectedSigner: targetAddress };
}

export function validateStrictComputeResponse(
  response: StrictComputeResponse,
  provider: string,
  model: string,
): { content: string; requestId: string; usage: StrictComputeUsage | null } {
  if (response.status !== 200) throw new A3TerminalError("A3_COMPUTE_HTTP_STATUS");
  if (response.provider !== provider || response.model !== model) {
    throw new A3TerminalError("A3_COMPUTE_RESPONSE_IDENTITY_MISMATCH");
  }
  if (
    typeof response.requestId !== "string" ||
    response.requestId.length < 1 ||
    response.requestId.length > 256 ||
    !/^[\x21-\x7e]+$/.test(response.requestId)
  ) {
    throw new A3TerminalError("A3_COMPUTE_REQUEST_ID_MISSING");
  }
  const body = plainRecord(response.body);
  if (!body || body.model !== model || !Array.isArray(body.choices) || body.choices.length < 1) {
    throw new A3TerminalError("A3_COMPUTE_RESPONSE_MALFORMED");
  }
  const firstChoice = plainRecord(body.choices[0]);
  const message = firstChoice ? plainRecord(firstChoice.message) : null;
  const content = message?.content;
  if (
    typeof content !== "string" ||
    Buffer.byteLength(content, "utf8") < 1 ||
    Buffer.byteLength(content, "utf8") > MAX_RESPONSE_BYTES
  ) {
    throw new A3TerminalError("A3_COMPUTE_RESPONSE_MALFORMED");
  }
  const usage = plainRecord(body.usage);
  let validatedUsage: StrictComputeUsage | null = null;
  if (usage) {
    const promptTokens = usage.prompt_tokens;
    const completionTokens = usage.completion_tokens;
    const totalTokens = usage.total_tokens;
    if (
      !exactKeys(usage, ["completion_tokens", "prompt_tokens", "total_tokens"]) ||
      !Number.isSafeInteger(promptTokens) || Number(promptTokens) < 0 ||
      !Number.isSafeInteger(completionTokens) || Number(completionTokens) < 0 ||
      Number(completionTokens) > MAX_OUTPUT_TOKENS ||
      !Number.isSafeInteger(totalTokens) || totalTokens !== Number(promptTokens) + Number(completionTokens)
    ) {
      throw new A3TerminalError("A3_COMPUTE_USAGE_MALFORMED");
    }
    validatedUsage = {
      promptTokens: Number(promptTokens),
      completionTokens: Number(completionTokens),
      totalTokens: Number(totalTokens),
      actualCostAtomic: "",
    };
  }
  return { content, requestId: response.requestId, usage: validatedUsage };
}

export function validateStrictComputeSignature(value: unknown): StrictComputeSignature {
  const signature = plainRecord(value);
  if (
    !signature ||
    !exactKeys(signature, ["signature", "text"]) ||
    typeof signature.text !== "string" ||
    typeof signature.signature !== "string" ||
    !/^0x[0-9a-fA-F]{130}$/.test(signature.signature)
  ) {
    throw new A3TerminalError("A3_COMPUTE_SIGNATURE_MALFORMED");
  }
  return { text: signature.text, signature: signature.signature };
}

function validateStorageRoot(value: unknown): string {
  const result = plainRecord(value);
  if (!result || !exactKeys(result, ["root"]) || typeof result.root !== "string") {
    throw new A3TerminalError("A3_STORAGE_RECEIPT_MALFORMED");
  }
  if (!ROOT_PATTERN.test(result.root)) {
    throw new A3TerminalError("A3_STORAGE_ROOT_INVALID");
  }
  return result.root;
}

function buildRequestBytes(input: {
  creatorUserId: string;
  creatorWallet: string;
  buyerUserId: string;
  buyerWallet: string;
  agentVersionId: string;
  agentVersionNumber: number;
  manifestHash: string;
  intentId: string;
  inputHash: string;
  provider: string;
  model: string;
  nonce: string;
  deadline: string;
  jobId: string;
  effectId: string;
  instructions: string;
  prompt: string;
}): string {
  const binding: CanonicalValue = {
    agentVersion: {
      id: input.agentVersionId,
      manifestHash: input.manifestHash,
      version: input.agentVersionNumber,
    },
    buyer: { userId: input.buyerUserId, wallet: input.buyerWallet },
    creator: { userId: input.creatorUserId, wallet: input.creatorWallet },
    deadline: input.deadline,
    effectId: input.effectId,
    inputHash: input.inputHash,
    intentId: input.intentId,
    jobId: input.jobId,
    model: input.model,
    nonce: input.nonce,
    policyVersion: POLICY_VERSION,
    provider: input.provider,
  };
  return canonicalJson({
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [
      { content: input.instructions, role: "system" },
      { content: `ALPHADAWG_STRICT_BINDING ${canonicalJson(binding)}`, role: "system" },
      { content: input.prompt, role: "user" },
    ],
    model: input.model,
    stream: false,
    temperature: 0,
    user: input.nonce,
  });
}

function requiredManifestValues(manifest: CanonicalValue): {
  instructions: string;
  ownerWallet: string;
} {
  const object = plainRecord(manifest);
  const runtimePolicy = plainRecord(object?.runtimePolicy);
  const validV5Runtime = object?.schemaVersion !== 5 || (
    runtimePolicy !== null &&
    exactKeys(runtimePolicy, [
      "deadlineMs",
      "framework",
      "maxMcpCalls",
      "maxOutputTokens",
      "modelCalls",
    ]) &&
    runtimePolicy.framework === "langchain-v1" &&
    runtimePolicy.modelCalls === 1 &&
    runtimePolicy.maxMcpCalls === 4 &&
    runtimePolicy.maxOutputTokens === MAX_OUTPUT_TOKENS &&
    runtimePolicy.deadlineMs === REQUEST_DEADLINE_MS
  );
  if (
    !object ||
    (object.schemaVersion !== 1 && object.schemaVersion !== 2 &&
      object.schemaVersion !== 3 && object.schemaVersion !== 5) ||
    !validV5Runtime ||
    object.adapterKey !== "protected-a3" ||
    object.proofPolicy !== "verified-receipt-required" ||
    typeof object.instructions !== "string" ||
    typeof object.ownerWallet !== "string"
  ) {
    throw new A3TerminalError("A3_MANIFEST_INVALID");
  }
  return { instructions: object.instructions, ownerWallet: object.ownerWallet };
}

function requiredInputPrompt(input: CanonicalValue): string {
  const object = plainRecord(input);
  if (!object || !exactKeys(object, ["prompt"]) || typeof object.prompt !== "string") {
    throw new A3TerminalError("A3_INPUT_INVALID");
  }
  return object.prompt;
}

function strictErrorCode(error: unknown): string {
  if (error instanceof A3TerminalError || error instanceof StorageVerifierError) return error.code;
  return "A3_INTERNAL_FAILURE";
}

export class StrictA3Adapter implements KernelAdapter {
  readonly key = "protected-a3" as const;
  readonly requiresVerifiedJournal = true;

  private readonly sql: DatabaseClient;
  private readonly clock: () => Date;
  private readonly deadlineMs: number;
  private readonly hooks: StrictA3Hooks;
  readonly authorityRuntime: EnsAuthorityRuntime | null;
  private readonly runtime: null | {
    provider: string;
    model: string;
    storageIndexerUrl: string;
    compute: StrictComputeTransport;
    storage: StrictStorageTransport;
    verifier: (
      request: StorageVerificationRequest,
      signal: AbortSignal,
    ) => Promise<StorageVerificationResult>;
    chatModel?: StrictA3ChatModel;
    effectId?: string;
    budgetExpiresAt?: Date;
    maxCostAtomic?: string;
    releaseSha?: string;
    reservationAmountAtomic?: string;
    reservationEffectIdentity?: string;
  };

  constructor(options: StrictA3AdapterOptions = {}) {
    this.sql = options.sql ?? getDb();
    const suppliedClock = options.now;
    this.clock = suppliedClock instanceof Date
      ? () => new Date(suppliedClock.getTime())
      : suppliedClock ?? (() => new Date());
    this.deadlineMs = options.deadlineMs ?? REQUEST_DEADLINE_MS;
    if (!Number.isSafeInteger(this.deadlineMs) || this.deadlineMs < 10 || this.deadlineMs > 3_600_000) {
      throw new Error("A3_INVALID_DEADLINE_POLICY");
    }
    this.hooks = options.hooks ?? {};
    this.authorityRuntime = options.authority ?? null;
    if (options.fixture && options.productionRuntime) {
      throw new Error("A3_RUNTIME_MODE_CONFLICT");
    }
    if (options.fixture) {
      this.runtime = options.fixture;
      return;
    }
    if (options.productionRuntime) {
      this.runtime = options.productionRuntime;
      return;
    }
    // Production authority is intentionally absent. Only an explicit local
    // fixture can construct a runtime capable of Compute or Storage effects.
    void options.environment;
    this.runtime = null;
  }

  private async withCurrentClaim<T>(
    job: ClaimedJob,
    operation: (tx: DatabaseClient) => Promise<T>,
  ): Promise<T> {
    const result = await this.sql.begin(async (transaction) => {
      const tx = transactionClient(transaction);
      if (!(await currentClaimHeld(tx, job, this.clock()))) throw new A3ClaimLostError();
      return operation(tx);
    });
    return result as T;
  }

  private async assertCurrentClaim(job: ClaimedJob): Promise<void> {
    await this.withCurrentClaim(job, async () => undefined);
  }

  private async assertFreshAuthority(
    job: ClaimedJob,
    operation: EnsAuthorityOperation,
    signal: AbortSignal,
  ): Promise<void> {
    if (!this.authorityRuntime) throw new A3TerminalError("ENS_AUTHORITY_NOT_CONFIGURED");
    const decision = await checkFreshEnsAuthority(
      job,
      this.authorityRuntime,
      "PRE_EXECUTION",
      operation,
      { now: this.clock(), signal, sql: this.sql },
    );
    if (!decision.allowed) {
      throw new A3TerminalError(decision.errorCode ?? "ENS_AUTHORITY_DENIED");
    }
  }

  private async lineage(tx: DatabaseClient, request: AdapterExecutionRequest): Promise<LineageRow> {
    const rows = await tx<LineageRow[]>`
      SELECT
        v.version AS agent_version_number,
        v.manifest,
        v.manifest_hash,
        v.proof_policy,
        v.owner_wallet,
        a.owner_user_id,
        i.input,
        i.input_hash,
        e.request_hash,
        buyer.wallet_address AS buyer_wallet
      FROM jobs j
      JOIN effects e ON e.job_id = j.id AND e.intent_id = j.intent_id
      JOIN job_intents i ON i.id = j.intent_id AND i.agent_version_id = j.agent_version_id
      JOIN agent_versions v ON v.id = j.agent_version_id
      JOIN kernel_agents a ON a.id = v.agent_id
      JOIN users buyer ON buyer.id = j.buyer_user_id
      WHERE j.id = ${request.jobId}::uuid
        AND j.intent_id = ${request.intentId}::uuid
        AND j.agent_version_id = ${request.agentVersionId}::uuid
        AND j.buyer_user_id = ${request.buyerUserId}
        AND a.owner_user_id = ${request.ownerUserId}
        AND e.id = ${request.effectId}
        AND e.adapter_key = 'protected-a3'
        AND v.adapter_key = 'protected-a3'
        AND v.published = true
    `;
    const lineage = rows[0];
    if (!lineage) throw new A3TerminalError("A3_LINEAGE_MISSING");
    return lineage;
  }

  private validateLineage(
    request: AdapterExecutionRequest,
    lineage: LineageRow,
  ): { manifest: CanonicalValue; input: CanonicalValue; instructions: string; prompt: string } {
    const manifest = asCanonicalValue(lineage.manifest);
    const input = asCanonicalValue(lineage.input);
    const manifestValues = requiredManifestValues(manifest);
    const prompt = requiredInputPrompt(input);
    if (
      domainHash("agent-manifest", manifest) !== lineage.manifest_hash ||
      domainHash("job-input", input) !== lineage.input_hash ||
      lineage.request_hash !== lineage.input_hash ||
      lineage.proof_policy !== "verified-receipt-required" ||
      manifestValues.ownerWallet !== lineage.owner_wallet ||
      canonicalJson(input) !== canonicalJson(request.input)
    ) {
      throw new A3TerminalError("A3_LINEAGE_HASH_MISMATCH");
    }
    return { manifest, input, instructions: manifestValues.instructions, prompt };
  }

  private validateExistingJournal(
    journal: A3JournalRow,
    request: AdapterExecutionRequest,
    lineage: LineageRow,
    values: { manifest: CanonicalValue; input: CanonicalValue; instructions: string; prompt: string },
  ): void {
    if (!this.runtime) throw new A3TerminalError("A3_LIVE_BLOCKED");
    const deadline = new Date(journal.deadline_at);
    const expectedNonce = domainHash("a3-nonce", {
      effectId: request.effectId,
      inputHash: lineage.input_hash,
      jobId: request.jobId,
      model: this.runtime.model,
      provider: this.runtime.provider,
    });
    const expectedRequestBytes = buildRequestBytes({
      creatorUserId: request.ownerUserId,
      creatorWallet: lineage.owner_wallet,
      buyerUserId: request.buyerUserId,
      buyerWallet: lineage.buyer_wallet,
      agentVersionId: request.agentVersionId,
      agentVersionNumber: lineage.agent_version_number,
      manifestHash: lineage.manifest_hash,
      intentId: request.intentId,
      inputHash: lineage.input_hash,
      provider: this.runtime.provider,
      model: this.runtime.model,
      nonce: expectedNonce,
      deadline: deadline.toISOString(),
      jobId: request.jobId,
      effectId: request.effectId,
      instructions: values.instructions,
      prompt: values.prompt,
    });
    if (
      Number.isNaN(deadline.getTime()) ||
      journal.schema_version !== 1 ||
      journal.effect_id !== request.effectId ||
      journal.job_id !== request.jobId ||
      journal.intent_id !== request.intentId ||
      journal.agent_version_id !== request.agentVersionId ||
      journal.creator_user_id !== request.ownerUserId ||
      journal.creator_wallet !== lineage.owner_wallet ||
      journal.buyer_user_id !== request.buyerUserId ||
      journal.buyer_wallet !== lineage.buyer_wallet ||
      journal.agent_version_number !== lineage.agent_version_number ||
      canonicalJson(asCanonicalValue(journal.manifest)) !== canonicalJson(values.manifest) ||
      journal.manifest_hash !== lineage.manifest_hash ||
      canonicalJson(asCanonicalValue(journal.input)) !== canonicalJson(values.input) ||
      journal.input_hash !== lineage.input_hash ||
      journal.provider !== this.runtime.provider ||
      journal.model !== this.runtime.model ||
      journal.nonce !== expectedNonce ||
      journal.policy_version !== POLICY_VERSION ||
      journal.request_bytes !== expectedRequestBytes ||
      journal.request_hash !== sha256Hex(expectedRequestBytes)
    ) {
      throw new A3TerminalError("A3_JOURNAL_BINDING_MISMATCH");
    }
  }

  private async loadOrPrepare(
    request: AdapterExecutionRequest,
    job: ClaimedJob,
  ): Promise<A3JournalRow> {
    const runtime = this.runtime;
    if (!runtime) throw new A3TerminalError("A3_LIVE_BLOCKED");
    return this.withCurrentClaim(job, async (tx) => {
      const lineage = await this.lineage(tx, request);
      const values = this.validateLineage(request, lineage);
      const existing = await tx<A3JournalRow[]>`
        SELECT * FROM a3_execution_journals
        WHERE effect_id = ${request.effectId}
        FOR UPDATE
      `;
      if (existing[0]) {
        this.validateExistingJournal(existing[0], request, lineage, values);
        return existing[0];
      }

      const now = this.clock();
      const deadline = new Date(now.getTime() + this.deadlineMs);
      const nonce = domainHash("a3-nonce", {
        effectId: request.effectId,
        inputHash: lineage.input_hash,
        jobId: request.jobId,
        model: runtime.model,
        provider: runtime.provider,
      });
      const requestBytes = buildRequestBytes({
        creatorUserId: request.ownerUserId,
        creatorWallet: lineage.owner_wallet,
        buyerUserId: request.buyerUserId,
        buyerWallet: lineage.buyer_wallet,
        agentVersionId: request.agentVersionId,
        agentVersionNumber: lineage.agent_version_number,
        manifestHash: lineage.manifest_hash,
        intentId: request.intentId,
        inputHash: lineage.input_hash,
        provider: runtime.provider,
        model: runtime.model,
        nonce,
        deadline: deadline.toISOString(),
        jobId: request.jobId,
        effectId: request.effectId,
        instructions: values.instructions,
        prompt: values.prompt,
      });
      const rows = await tx<A3JournalRow[]>`
        INSERT INTO a3_execution_journals (
          effect_id, job_id, intent_id, agent_version_id, schema_version, version, stage,
          creator_user_id, creator_wallet, buyer_user_id, buyer_wallet,
          agent_version_number, manifest, manifest_hash, input, input_hash,
          provider, model, nonce, deadline_at, policy_version,
          request_bytes, request_hash, created_at, updated_at
        ) VALUES (
          ${request.effectId}, ${request.jobId}::uuid, ${request.intentId}::uuid,
          ${request.agentVersionId}::uuid, 1, 0, 'PREPARED',
          ${request.ownerUserId}, ${lineage.owner_wallet}, ${request.buyerUserId},
          ${lineage.buyer_wallet}, ${lineage.agent_version_number},
          ${tx.json(values.manifest)}, ${lineage.manifest_hash}, ${tx.json(values.input)},
          ${lineage.input_hash}, ${runtime.provider}, ${runtime.model},
          ${nonce}, ${deadline}, ${POLICY_VERSION}, ${requestBytes},
          ${sha256Hex(requestBytes)}, ${now}, ${now}
        )
        RETURNING *
      `;
      const prepared = rows[0];
      if (!prepared) throw new A3TerminalError("A3_JOURNAL_PREPARE_FAILED");
      return prepared;
    });
  }

  private async markRequestSent(job: ClaimedJob, journal: A3JournalRow): Promise<A3JournalRow> {
    return this.withCurrentClaim(job, async (tx) => {
      const runtime = this.runtime;
      if (
        runtime?.releaseSha && runtime.reservationEffectIdentity &&
        runtime.reservationAmountAtomic && runtime.budgetExpiresAt
      ) {
        const reservations = await tx<{
          amount_atomic: string;
          effect_identity: string;
          release_sha: string;
          state: string;
        }[]>`
          SELECT release_sha, effect_identity, amount_atomic::text, state
          FROM og_spend_reservations
          WHERE release_sha = ${runtime.releaseSha}
            AND effect_identity = ${runtime.reservationEffectIdentity}
          FOR UPDATE
        `;
        const reservation = reservations[0];
        if (reservation?.state === "AMBIGUOUS") {
          throw new A3TerminalError("A3_AMBIGUOUS_RESERVATION");
        }
        if (
          !reservation || reservation.release_sha !== runtime.releaseSha ||
          reservation.effect_identity !== runtime.reservationEffectIdentity ||
          reservation.amount_atomic !== runtime.reservationAmountAtomic ||
          reservation.state !== "RESERVED" ||
          runtime.budgetExpiresAt.getTime() <= this.clock().getTime()
        ) {
          throw new A3TerminalError("A3_BUDGET_NOT_ADMITTED");
        }
      }
      const rows = await tx<A3JournalRow[]>`
        UPDATE a3_execution_journals
        SET stage = 'REQUEST_SENT', version = version + 1, updated_at = ${this.clock()}
        WHERE effect_id = ${job.effectId}
          AND stage = 'PREPARED'
          AND version = ${journal.version}
        RETURNING *
      `;
      if (!rows[0]) throw new A3TerminalError("A3_JOURNAL_TRANSITION_RACE");
      return rows[0];
    });
  }

  private async markResponseVerified(
    job: ClaimedJob,
    journal: A3JournalRow,
    values: {
      requestId: string;
      signerAddress: string;
      content: string;
      responseHash: string;
      receiptBytes: string;
      receiptDigest: string;
      signature: string;
      usage: StrictComputeUsage | null;
    },
  ): Promise<A3JournalRow> {
    return this.withCurrentClaim(job, async (tx) => {
      const rows = await tx<A3JournalRow[]>`
        UPDATE a3_execution_journals
        SET stage = 'RESPONSE_VERIFIED', version = version + 1,
            request_id = ${values.requestId}, signer_address = ${values.signerAddress},
            request_signature = ${values.signature},
            response_content = ${values.content}, response_hash = ${values.responseHash},
            compute_receipt_bytes = ${values.receiptBytes},
            compute_receipt_digest = ${values.receiptDigest},
            prompt_tokens = ${values.usage?.promptTokens ?? null},
            completion_tokens = ${values.usage?.completionTokens ?? null},
            total_tokens = ${values.usage?.totalTokens ?? null},
            actual_cost_atomic = ${values.usage?.actualCostAtomic ?? null}::bigint,
            updated_at = ${this.clock()}
        WHERE effect_id = ${job.effectId}
          AND stage = 'REQUEST_SENT'
          AND version = ${journal.version}
        RETURNING *
      `;
      if (!rows[0]) throw new A3TerminalError("A3_JOURNAL_TRANSITION_RACE");
      return rows[0];
    });
  }

  private async markStorageRequested(
    job: ClaimedJob,
    journal: A3JournalRow,
  ): Promise<A3JournalRow> {
    return this.withCurrentClaim(job, async (tx) => {
      const rows = await tx<A3JournalRow[]>`
        UPDATE a3_execution_journals
        SET stage = 'STORAGE_REQUESTED', version = version + 1, updated_at = ${this.clock()}
        WHERE effect_id = ${job.effectId}
          AND stage = 'RESPONSE_VERIFIED'
          AND version = ${journal.version}
        RETURNING *
      `;
      if (!rows[0]) throw new A3TerminalError("A3_JOURNAL_TRANSITION_RACE");
      return rows[0];
    });
  }

  private async markStorageCommitted(
    job: ClaimedJob,
    journal: A3JournalRow,
    values: {
      receiptBytes: string;
      receiptDigest: string;
      root: string;
      digest: string;
      size: number;
    },
  ): Promise<A3JournalRow> {
    return this.withCurrentClaim(job, async (tx) => {
      const rows = await tx<A3JournalRow[]>`
        UPDATE a3_execution_journals
        SET stage = 'STORAGE_COMMITTED', version = version + 1,
            storage_receipt_bytes = ${values.receiptBytes},
            storage_receipt_digest = ${values.receiptDigest},
            expected_root = ${values.root}, expected_digest = ${values.digest},
            expected_size = ${values.size}, updated_at = ${this.clock()}
        WHERE effect_id = ${job.effectId}
          AND stage = 'STORAGE_REQUESTED'
          AND version = ${journal.version}
        RETURNING *
      `;
      if (!rows[0]) throw new A3TerminalError("A3_JOURNAL_TRANSITION_RACE");
      return rows[0];
    });
  }

  private async markReadbackVerified(
    job: ClaimedJob,
    journal: A3JournalRow,
    values: { result: CanonicalValue; proofHash: string },
  ): Promise<A3JournalRow> {
    const result = plainRecord(values.result);
    const readback = plainRecord(result?.readback);
    const terminalResult: CanonicalValue = result && readback
      ? { ...result, readback: { ...readback, verified: true } } as CanonicalValue
      : values.result;
    return this.withCurrentClaim(job, async (tx) => {
      const rows = await tx<A3JournalRow[]>`
        UPDATE a3_execution_journals
        SET stage = 'READBACK_VERIFIED', version = version + 1,
            readback_root = expected_root, readback_digest = expected_digest,
            readback_size = expected_size, result = ${tx.json(terminalResult)},
            proof_hash = ${values.proofHash}, updated_at = ${this.clock()}
        WHERE effect_id = ${job.effectId}
          AND stage = 'STORAGE_COMMITTED'
          AND version = ${journal.version}
        RETURNING *
      `;
      if (!rows[0]) throw new A3TerminalError("A3_JOURNAL_TRANSITION_RACE");
      return rows[0];
    });
  }

  private async markFailed(
    job: ClaimedJob,
    journal: A3JournalRow,
    errorCode: string,
  ): Promise<A3JournalRow> {
    if (journal.stage === "FAILED" || journal.stage === "READBACK_VERIFIED") return journal;
    return this.withCurrentClaim(job, async (tx) => {
      const rows = await tx<A3JournalRow[]>`
        UPDATE a3_execution_journals
        SET stage = 'FAILED', version = version + 1,
            error_code = ${errorCode}, updated_at = ${this.clock()}
        WHERE effect_id = ${job.effectId}
          AND stage = ${journal.stage}
          AND version = ${journal.version}
        RETURNING *
      `;
      if (!rows[0]) throw new A3TerminalError("A3_JOURNAL_TRANSITION_RACE");
      return rows[0];
    });
  }

  private successfulPayload(journal: A3JournalRow): {
    result: CanonicalValue;
    proofHash: string;
  } {
    const payload = deriveA3VerifiedJournalPayload(
      journal,
      journal.stage === "READBACK_VERIFIED",
    );
    if (!payload.ok) throw new A3TerminalError(payload.errorCode);
    return payload;
  }

  private validateVerifierResult(
    value: unknown,
    request: StorageVerificationRequest,
  ): StorageVerificationResult {
    const output = plainRecord(value);
    if (
      !output ||
      !exactKeys(output, ["digest", "effectId", "root", "schemaVersion", "size", "verified"]) ||
      output.schemaVersion !== 1 ||
      output.verified !== true ||
      output.effectId !== request.effectId ||
      output.root !== request.root ||
      output.digest !== request.expectedDigest ||
      output.size !== request.expectedSize ||
      typeof output.effectId !== "string" ||
      typeof output.root !== "string" ||
      typeof output.digest !== "string" ||
      typeof output.size !== "number" ||
      !Number.isSafeInteger(output.size)
    ) {
      throw new A3TerminalError("A3_STORAGE_VERIFIER_BINDING_MISMATCH");
    }
    return {
      schemaVersion: 1,
      effectId: output.effectId,
      root: output.root,
      digest: output.digest,
      size: output.size,
      verified: true,
    };
  }

  async execute(request: AdapterExecutionRequest): Promise<AdapterExecutionResult> {
    const runtime = this.runtime;
    if (!runtime) {
      return { ok: false, errorCode: "A3_LIVE_BLOCKED", retryable: false };
    }
    if (
      runtime.effectId &&
      (request.effectId !== runtime.effectId || !runtime.budgetExpiresAt ||
        runtime.budgetExpiresAt.getTime() <= this.clock().getTime())
    ) {
      return { ok: false, errorCode: "A3_BUDGET_NOT_ADMITTED", retryable: false };
    }
    const job = claimFromRequest(request);
    let journal: A3JournalRow | null = null;
    let deadline: ExecutionDeadline | null = null;
    try {
      checkAbort(request.signal);
      journal = await this.loadOrPrepare(request, job);
      if (journal.stage === "FAILED") {
        return {
          ok: false,
          errorCode: journal.error_code ?? "A3_VERIFICATION_FAILED",
          retryable: false,
        };
      }
      if (journal.stage === "READBACK_VERIFIED") {
        const completed = this.successfulPayload(journal);
        return { ok: true, ...completed, verified: true };
      }
      if (journal.stage === "REQUEST_SENT") {
        throw new A3TerminalError("A3_AMBIGUOUS_COMPUTE_REQUEST");
      }
      if (journal.stage === "STORAGE_REQUESTED") {
        throw new A3TerminalError("A3_AMBIGUOUS_STORAGE_REQUEST");
      }
      deadline = executionDeadline(
        request.signal,
        new Date(journal.deadline_at).getTime() - this.clock().getTime(),
      );
      const activeDeadline = deadline;
      checkExecutionAbort(request.signal, activeDeadline);

      if (journal.stage === "PREPARED") {
        await this.hooks.afterPrepared?.();
        checkExecutionAbort(request.signal, activeDeadline);
        await this.assertCurrentClaim(job);
        const preparedJournal = journal;
        let service: ValidatedService;
        let response: { content: string; requestId: string; usage: StrictComputeUsage | null } | null = null;
        let signature: StrictComputeSignature | null = null;
        if (runtime.chatModel) {
          journal = await this.markRequestSent(job, journal);
          const modelResult = await awaitWithSignal(
            () => runtime.chatModel!.invokeStrict(
              preparedJournal.request_bytes,
              activeDeadline.signal,
              async (operation) => {
                await this.assertCurrentClaim(job);
                await this.assertFreshAuthority(job, operation, activeDeadline.signal);
              },
            ),
            activeDeadline.signal,
          );
          service = modelResult.service;
          response = modelResult.response;
          signature = modelResult.signature;
        } else {
          await this.assertFreshAuthority(job, "COMPUTE_SERVICE", activeDeadline.signal);
          service = validateStrictComputeService(
          await awaitWithSignal(
            () => runtime.compute.resolveService(
              preparedJournal.provider,
              preparedJournal.model,
              activeDeadline.signal,
            ),
            activeDeadline.signal,
          ),
          journal.provider,
          journal.model,
          );
          checkExecutionAbort(request.signal, activeDeadline);
          await this.assertCurrentClaim(job);
          journal = await this.markRequestSent(job, journal);
        }

        if (!runtime.chatModel) {
          await this.assertCurrentClaim(job);
          await this.assertFreshAuthority(job, "COMPUTE_HEADERS", activeDeadline.signal);
          const sentJournal = journal;
          const headers = await awaitWithSignal(
            () => runtime.compute.getRequestHeaders(service, sentJournal.request_bytes, activeDeadline.signal),
            activeDeadline.signal,
          );
          checkExecutionAbort(request.signal, activeDeadline);
          await this.assertCurrentClaim(job);
          await this.assertFreshAuthority(job, "COMPUTE_REQUEST", activeDeadline.signal);
          response = validateStrictComputeResponse(
            await awaitWithSignal(
              () => runtime.compute.sendRequest(service, sentJournal.request_bytes, headers, activeDeadline.signal),
              activeDeadline.signal,
            ), journal.provider, journal.model,
          );
          checkExecutionAbort(request.signal, activeDeadline);
          await this.assertCurrentClaim(job);
          await this.assertFreshAuthority(job, "COMPUTE_SIGNATURE", activeDeadline.signal);
          const validatedResponse = response;
          signature = validateStrictComputeSignature(await awaitWithSignal(
            () => runtime.compute.fetchSignature(service, validatedResponse.requestId, activeDeadline.signal),
            activeDeadline.signal,
          ));
        }
        if (!response || !signature) throw new A3TerminalError("A3_COMPUTE_RESPONSE_MALFORMED");
        if (runtime.maxCostAtomic && (
          !response.usage || !response.usage.actualCostAtomic ||
          BigInt(response.usage.actualCostAtomic) > BigInt(runtime.maxCostAtomic)
        )) {
          throw new A3TerminalError("A3_BUDGET_EXCEEDED");
        }
        checkExecutionAbort(request.signal, activeDeadline);
        await this.assertCurrentClaim(job);
        if (!Buffer.from(signature.text, "utf8").equals(Buffer.from(response.content, "utf8"))) {
          throw new A3TerminalError("A3_COMPUTE_CONTENT_MISMATCH");
        }
        if (!await runtime.compute.verifySignature(
          signature.text,
          signature.signature,
          service.expectedSigner,
        )) {
          throw new A3TerminalError("A3_COMPUTE_SIGNATURE_INVALID");
        }
        const responseHash = sha256Hex(response.content);
        const computeReceiptBytes = canonicalJson({
          contentHash: responseHash,
          effectId: journal.effect_id,
          model: journal.model,
          provider: journal.provider,
          requestHash: journal.request_hash,
          requestId: response.requestId,
          schemaVersion: 1,
          signature: signature.signature,
          signerAddress: service.expectedSigner,
        });
        journal = await this.markResponseVerified(job, journal, {
          requestId: response.requestId,
          signerAddress: service.expectedSigner,
          content: response.content,
          responseHash,
          receiptBytes: computeReceiptBytes,
          receiptDigest: sha256Hex(computeReceiptBytes),
          signature: signature.signature,
          usage: response.usage,
        });
        await this.hooks.afterResponseVerified?.();
      }

      if (journal.stage === "RESPONSE_VERIFIED") {
        if (!journal.response_content) {
          throw new A3TerminalError("A3_VERIFIED_CONTENT_MISSING");
        }
        const contentBytes = Buffer.from(journal.response_content, "utf8");
        const contentDigest = sha256Hex(contentBytes);
        await this.assertFreshAuthority(job, "STORAGE_WRITE", activeDeadline.signal);
        journal = await this.markStorageRequested(job, journal);
        await this.assertCurrentClaim(job);
        const storageJournal = journal;
        const storageRoot = validateStorageRoot(await awaitWithSignal(
          () => runtime.storage.store({
            effectId: storageJournal.effect_id,
            bytes: contentBytes,
            digest: contentDigest,
          }, activeDeadline.signal),
          activeDeadline.signal,
        ));
        checkExecutionAbort(request.signal, activeDeadline);
        await this.assertCurrentClaim(job);
        const storageReceiptBytes = canonicalJson({
          digest: contentDigest,
          effectId: journal.effect_id,
          root: storageRoot,
          schemaVersion: 1,
          size: contentBytes.length,
        });
        journal = await this.markStorageCommitted(job, journal, {
          receiptBytes: storageReceiptBytes,
          receiptDigest: sha256Hex(storageReceiptBytes),
          root: storageRoot,
          digest: contentDigest,
          size: contentBytes.length,
        });
        await this.hooks.afterStorageCommitted?.();
      }

      if (journal.stage === "STORAGE_COMMITTED") {
        if (
          !journal.storage_receipt_bytes ||
          !journal.storage_receipt_digest ||
          !journal.expected_root ||
          !journal.expected_digest ||
          journal.expected_size === null
        ) {
          throw new A3TerminalError("A3_STORAGE_JOURNAL_MISSING");
        }
        const verifierRequest: StorageVerificationRequest = {
          schemaVersion: 1,
          effectId: journal.effect_id,
          expectedDigest: journal.expected_digest,
          expectedSize: journal.expected_size,
          indexerUrl: runtime.storageIndexerUrl,
          receiptBytes: journal.storage_receipt_bytes,
          receiptDigest: journal.storage_receipt_digest,
          root: journal.expected_root,
        };
        await this.assertCurrentClaim(job);
        await this.assertFreshAuthority(job, "STORAGE_READBACK", activeDeadline.signal);
        this.validateVerifierResult(
          await awaitWithSignal(
            () => runtime.verifier(verifierRequest, activeDeadline.signal),
            activeDeadline.signal,
          ),
          verifierRequest,
        );
        checkExecutionAbort(request.signal, activeDeadline);
        await this.assertCurrentClaim(job);
        const completed = this.successfulPayload(journal);
        journal = await this.markReadbackVerified(job, journal, completed);
        await this.hooks.afterReadbackVerified?.();
      }

      if (journal.stage !== "READBACK_VERIFIED") {
        throw new A3TerminalError("A3_JOURNAL_NOT_TERMINAL");
      }
      const completed = this.successfulPayload(journal);
      return { ok: true, ...completed, verified: true };
    } catch (error) {
      if (error instanceof A3SimulatedCrashError) throw error;
      if (error instanceof A3ClaimLostError || request.signal.aborted) throw new A3ClaimLostError();
      const errorCode = deadline?.expired()
        ? "A3_REQUEST_DEADLINE_EXPIRED"
        : strictErrorCode(error);
      if (journal && journal.stage !== "READBACK_VERIFIED" && journal.stage !== "FAILED") {
        journal = await this.markFailed(job, journal, errorCode);
      }
      return { ok: false, errorCode, retryable: false };
    } finally {
      deadline?.cleanup();
    }
  }
}
