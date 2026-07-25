import { BaseChatModel, type BaseChatModelCallOptions } from "@langchain/core/language_models/chat_models";
import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";
import type { EnsAuthorityRuntime, EnsAuthorityOperation } from "../ens/authority";
import { domainHash } from "../kernel/canonical";
import type { DatabaseClient } from "../kernel/service";
import {
  A3TerminalError,
  StrictA3Adapter,
  type StrictA3ChatModel,
  type StrictA3ChatModelResult,
  type StrictComputeTransport,
  type StrictComputeService,
  validateStrictComputeResponse,
  validateStrictComputeService,
  validateStrictComputeSignature,
} from "./strict-a3";
import type { StrictStorageTransport } from "./strict-a3";
import type { StorageVerificationRequest, StorageVerificationResult } from "./storage-verifier";

const CHAIN_ID = 16602;
const DEADLINE_MS = 300_000;
const MAX_OUTPUT_TOKENS = 768;
const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/;
const HASH_PATTERN = /^[0-9a-f]{40}$/;
const EFFECT_PATTERN = /^[0-9a-f]{64}$/;

interface ZeroGCallOptions extends BaseChatModelCallOptions {
  requestBytes: string;
  beforeEffect: (operation: EnsAuthorityOperation) => Promise<void>;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requestMessages(requestBytes: string): BaseMessage[] {
  let body: Record<string, unknown> | null = null;
  try {
    body = record(JSON.parse(requestBytes));
  } catch {
    throw new A3TerminalError("A3_REQUEST_BYTES_MALFORMED");
  }
  if (
    !body || body.max_tokens !== MAX_OUTPUT_TOKENS || body.stream !== false ||
    body.temperature !== 0 || "tools" in body || "tool_choice" in body ||
    !Array.isArray(body.messages) || body.messages.length !== 3
  ) {
    throw new A3TerminalError("A3_LANGCHAIN_POLICY_MISMATCH");
  }
  return body.messages.map((value) => {
    const message = record(value);
    if (!message || typeof message.content !== "string") {
      throw new A3TerminalError("A3_REQUEST_BYTES_MALFORMED");
    }
    if (message.role === "system") return new SystemMessage(message.content);
    if (message.role === "user") return new HumanMessage(message.content);
    throw new A3TerminalError("A3_LANGCHAIN_POLICY_MISMATCH");
  });
}

function assertMessageBinding(messages: BaseMessage[], requestBytes: string): void {
  const expected = requestMessages(requestBytes);
  if (
    messages.length !== expected.length ||
    messages.some((message, index) =>
      message.type !== expected[index]?.type || message.text !== expected[index]?.text)
  ) {
    throw new A3TerminalError("A3_LANGCHAIN_MESSAGE_MISMATCH");
  }
}

export class ZeroGStrictChatModel extends BaseChatModel<ZeroGCallOptions> implements StrictA3ChatModel {
  private readonly provider: string;
  private readonly model: string;
  private readonly transport: StrictComputeTransport;

  constructor(input: { provider: string; model: string; transport: StrictComputeTransport }) {
    super({ disableStreaming: true });
    this.provider = input.provider;
    this.model = input.model;
    this.transport = input.transport;
  }

  _llmType(): string {
    return "0g-strict-compute";
  }

  async _generate(messages: BaseMessage[], options: this["ParsedCallOptions"]): Promise<ChatResult> {
    if (options.tool_choice !== "none" || typeof options.beforeEffect !== "function") {
      throw new A3TerminalError("A3_LANGCHAIN_TOOLS_FORBIDDEN");
    }
    assertMessageBinding(messages, options.requestBytes);
    await options.beforeEffect("COMPUTE_SERVICE");
    const service = validateStrictComputeService(
      await this.transport.resolveService(this.provider, this.model, options.signal ?? new AbortController().signal),
      this.provider,
      this.model,
    );
    await options.beforeEffect("COMPUTE_HEADERS");
    const headers = await this.transport.getRequestHeaders(
      service,
      options.requestBytes,
      options.signal ?? new AbortController().signal,
    );
    await options.beforeEffect("COMPUTE_REQUEST");
    const rawResponse = await this.transport.sendRequest(
      service,
      options.requestBytes,
      headers,
      options.signal ?? new AbortController().signal,
    );
    const response = validateStrictComputeResponse(rawResponse, this.provider, this.model);
    if (!response.usage) throw new A3TerminalError("A3_COMPUTE_USAGE_MISSING");
    if (
      typeof service.inputPriceAtomic !== "string" || !/^(0|[1-9][0-9]*)$/.test(service.inputPriceAtomic) ||
      typeof service.outputPriceAtomic !== "string" || !/^(0|[1-9][0-9]*)$/.test(service.outputPriceAtomic)
    ) {
      throw new A3TerminalError("A3_COMPUTE_PRICE_MISSING");
    }
    response.usage.actualCostAtomic = (
      BigInt(response.usage.promptTokens) * BigInt(service.inputPriceAtomic) +
      BigInt(response.usage.completionTokens) * BigInt(service.outputPriceAtomic)
    ).toString();
    await options.beforeEffect("COMPUTE_SIGNATURE");
    const signature = validateStrictComputeSignature(
      await this.transport.fetchSignature(service, response.requestId, options.signal ?? new AbortController().signal),
    );
    if (
      !Buffer.from(signature.text, "utf8").equals(Buffer.from(response.content, "utf8")) ||
      !await this.transport.verifySignature(signature.text, signature.signature, service.expectedSigner)
    ) {
      throw new A3TerminalError("A3_COMPUTE_SIGNATURE_INVALID");
    }
    return {
      generations: [{
        text: response.content,
        message: new AIMessage({
          content: response.content,
          response_metadata: { service, response, signature },
          usage_metadata: {
            input_tokens: response.usage.promptTokens,
            output_tokens: response.usage.completionTokens,
            total_tokens: response.usage.totalTokens,
          },
        }),
      }],
    };
  }

  async invokeStrict(
    requestBytes: string,
    signal: AbortSignal,
    beforeEffect: (operation: EnsAuthorityOperation) => Promise<void>,
  ): Promise<StrictA3ChatModelResult> {
    const message = await this.invoke(requestMessages(requestBytes), {
      beforeEffect,
      requestBytes,
      signal,
      tool_choice: "none",
    });
    const metadata = record(message.response_metadata);
    const service = metadata?.service;
    const response = metadata?.response;
    const signature = metadata?.signature;
    if (!service || !response || !signature) {
      throw new A3TerminalError("A3_LANGCHAIN_RESULT_MALFORMED");
    }
    return { service, response, signature } as StrictA3ChatModelResult;
  }
}

export interface ProductionA3Config {
  chainId: number;
  railwayService: string;
  databaseSecretPresent: boolean;
  ogSignerSecretPresent: boolean;
  rpcUrl: string;
  provider: string;
  model: string;
  expectedSigner: string;
  storageIndexerUrl: string;
  releaseSha: string;
  effectId: string;
  reservationEffectIdentity: string;
  reservationAmountAtomic: string;
  budgetExpiresAt: Date;
}

export interface ProductionA3FactoryOptions {
  config: ProductionA3Config;
  sql: DatabaseClient;
  now?: Date;
  signal: AbortSignal;
  authority: EnsAuthorityRuntime;
  compute: StrictComputeTransport;
  verifiedService: StrictComputeService;
  storage: StrictStorageTransport;
  verifier: (
    request: StorageVerificationRequest,
    signal: AbortSignal,
  ) => Promise<StorageVerificationResult>;
}

interface BudgetRow {
  release_sha: string;
  chain_id: number;
  asset: string;
  limit_atomic: string;
  reservation_id: string | null;
  effect_identity: string | null;
  amount_atomic: string | null;
  state: string | null;
}

function validHttps(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function reservationIdentity(config: ProductionA3Config): string {
  return domainHash("og-compute-reservation", {
    amountAtomic: config.reservationAmountAtomic,
    budgetExpiresAt: config.budgetExpiresAt.toISOString(),
    effectId: config.effectId,
    model: config.model,
    provider: config.provider,
    releaseSha: config.releaseSha,
  });
}

export async function createProductionStrictA3Runtime(
  options: ProductionA3FactoryOptions,
): Promise<StrictA3Adapter> {
  const { config } = options;
  const now = options.now ?? new Date();
  if (
    config.chainId !== CHAIN_ID || !config.railwayService.trim() ||
    !config.databaseSecretPresent || !config.ogSignerSecretPresent ||
    !validHttps(config.rpcUrl) || !validHttps(config.storageIndexerUrl) ||
    !ADDRESS_PATTERN.test(config.provider) || !config.model.trim() ||
    !ADDRESS_PATTERN.test(config.expectedSigner) || !HASH_PATTERN.test(config.releaseSha) ||
    !EFFECT_PATTERN.test(config.effectId) || !EFFECT_PATTERN.test(config.reservationEffectIdentity) ||
    config.reservationEffectIdentity !== reservationIdentity(config) ||
    !/^[1-9][0-9]*$/.test(config.reservationAmountAtomic) ||
    Number.isNaN(config.budgetExpiresAt.getTime()) || config.budgetExpiresAt.getTime() <= now.getTime()
  ) {
    throw new A3TerminalError("A3_LIVE_BLOCKED");
  }
  const rows = await options.sql<BudgetRow[]>`
    SELECT budget.release_sha, budget.chain_id, budget.asset, budget.limit_atomic::text,
      reservation.id::text AS reservation_id, reservation.effect_identity,
      reservation.amount_atomic::text, reservation.state
    FROM og_spend_budgets budget
    LEFT JOIN og_spend_reservations reservation
      ON reservation.release_sha = budget.release_sha
      AND reservation.effect_identity = ${config.reservationEffectIdentity}
    WHERE budget.release_sha = ${config.releaseSha}
  `;
  const budget = rows[0];
  if (
    !budget || budget.chain_id !== CHAIN_ID || budget.asset !== "A0GI" ||
    !budget.reservation_id || budget.effect_identity !== config.reservationEffectIdentity ||
    budget.amount_atomic !== config.reservationAmountAtomic ||
    !/^[1-9][0-9]*$/.test(budget.limit_atomic) ||
    BigInt(budget.amount_atomic) > BigInt(budget.limit_atomic)
  ) {
    throw new A3TerminalError("A3_BUDGET_NOT_ADMITTED");
  }
  if (budget.state === "AMBIGUOUS") {
    throw new A3TerminalError("A3_AMBIGUOUS_RESERVATION");
  }
  if (budget.state !== "RESERVED") throw new A3TerminalError("A3_BUDGET_NOT_ADMITTED");
  const service = validateStrictComputeService(
    options.verifiedService,
    config.provider,
    config.model,
  );
  if (service.expectedSigner !== config.expectedSigner) {
    throw new A3TerminalError("A3_PROVIDER_SIGNER_MISMATCH");
  }
  if (
    typeof service.inputPriceAtomic !== "string" || !/^(0|[1-9][0-9]*)$/.test(service.inputPriceAtomic) ||
    typeof service.outputPriceAtomic !== "string" || !/^(0|[1-9][0-9]*)$/.test(service.outputPriceAtomic)
  ) {
    throw new A3TerminalError("A3_COMPUTE_PRICE_MISSING");
  }
  return new StrictA3Adapter({
    authority: options.authority,
    deadlineMs: DEADLINE_MS,
    now,
    sql: options.sql,
    productionRuntime: {
      budgetExpiresAt: config.budgetExpiresAt,
      chatModel: new ZeroGStrictChatModel({
        provider: config.provider,
        model: config.model,
        transport: options.compute,
      }),
      compute: options.compute,
      effectId: config.effectId,
      model: config.model,
      maxCostAtomic: config.reservationAmountAtomic,
      provider: config.provider,
      storage: options.storage,
      storageIndexerUrl: config.storageIndexerUrl,
      verifier: options.verifier,
    },
  });
}
