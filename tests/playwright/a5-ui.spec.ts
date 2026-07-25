import { expect, test, type Page, type Route } from "@playwright/test";
import { encodeFunctionResult } from "viem";

const TEST_WALLET = "0x1111111111111111111111111111111111111111";
const GOAL_ID = "12121212-1212-4121-8121-121212121212";
const RUN_ID = "13131313-1313-4131-8131-131313131313";
const JOB_ID = "55555555-5555-4555-8555-555555555555";
const SECOND_JOB_ID = "56565656-5656-4565-8565-565656565656";
const HIRE_REQUEST_ID = "57575757-5757-4575-8575-575757575757";
const ENS_REVERSE_ABI = [{ name: "reverseWithGateways", type: "function", stateMutability: "view", inputs: [{ type: "bytes", name: "reverseName" }, { type: "uint256", name: "coinType" }, { type: "string[]", name: "gateways" }], outputs: [{ type: "string", name: "resolvedName" }, { type: "address", name: "resolver" }, { type: "address", name: "reverseResolver" }] }] as const;

const USER = {
  id: "protected-user",
  walletAddress: TEST_WALLET,
  telegram: { chatId: null, username: null, verified: false, notifyPreference: "every_cycle" },
  agent: { active: false, riskProfile: "balanced", maxTradePercent: 5, lastCycleId: 0, lastCycleAt: null, approvalMode: "always", approvalTimeoutMin: 10 },
  fund: { depositedUsdc: 0, htsShareBalance: 0, currentNav: 0 },
  hotWalletIndex: null,
  hotWalletAddress: null,
  inftTokenId: null,
} as const;

const OWNER_AGENT = {
  agentId: "11111111-1111-4111-8111-111111111111",
  versionId: "22222222-2222-4222-8222-222222222222",
  version: 1,
  name: "Evidence Researcher With A Deliberately Long Registry Name",
  description: "Immutable research specialist used to exercise long content.",
  capabilities: ["research", "market-analysis"],
  manifestHash: "a".repeat(64),
  promptHash: "b".repeat(64),
  configHash: "c".repeat(64),
  adapterKey: "protected-a3",
  ownerWallet: "0x3333333333333333333333333333333333333333",
  priceAtomic: "1000",
  asset: "USDC_ATOMIC",
  proofPolicy: "verified-receipt-required",
  lifecycleState: "PUBLISHED",
  hireable: true,
  ownedByViewer: true,
  creatorParent: "maker.eth",
  agentLabel: "evidence-researcher",
  fullSubname: "evidence-researcher.maker.eth",
  writePlanHash: "e".repeat(64),
  canonicalState: "CANONICAL",
  authorityOwner: TEST_WALLET,
  authorityDelegate: null,
  authorityPolicyVersion: "1",
  refusalReason: null,
  authorityReleaseSha: "f".repeat(40),
  publicationDecisionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  publishedAt: "2026-07-25T10:00:00.000Z",
  manifestSchemaVersion: 3,
  reviewedSources: [{ repository: "coingecko/skills", revision: "0a15620", use: "integration" }],
  skillSummary: [{ id: "persona.researcher", category: "PERSONA" }, { id: "data.coingecko.market", category: "DATA" }],
  mcpSummary: [{ bindingId: "mcp.coingecko.spot-price", provider: "coingecko", capability: "spot-price" }],
  mcpAvailability: "UNAVAILABLE",
  verifiedExternalHires: 3,
  provenance: null,
} as const;

const AVAILABLE_AGENT = {
  ...OWNER_AGENT,
  agentId: "33333333-3333-4333-8333-333333333333",
  versionId: "44444444-4444-4444-8444-444444444444",
  name: "Risk Boundary Agent",
  ownerWallet: "0x4444444444444444444444444444444444444444",
  fullSubname: "risk-boundary.maker.eth",
  ownedByViewer: false,
  verifiedExternalHires: 8,
  provenance: { protocol: "INFT", chainId: 11155111, contractAddress: "0x5555555555555555555555555555555555555555", tokenId: "42", metadataUri: null, evidenceHash: "9".repeat(64), observedAt: "2026-07-25T09:00:00.000Z" },
} as const;

const CATALOG = {
  categories: ["PERSONA", "DATA", "ACTION", "CONNECTION"],
  skills: [
    { id: "persona.researcher", category: "PERSONA", capabilities: ["research"], constraints: [], providerAvailability: "NOT_REQUIRED" },
    { id: "persona.market-analyst", category: "PERSONA", capabilities: ["market-analysis"], constraints: [], providerAvailability: "NOT_REQUIRED" },
    { id: "persona.risk-analyst", category: "PERSONA", capabilities: ["risk-analysis"], constraints: [], providerAvailability: "NOT_REQUIRED" },
    { id: "persona.synthesizer", category: "PERSONA", capabilities: ["research", "market-analysis", "risk-analysis"], constraints: [], providerAvailability: "NOT_REQUIRED" },
    { id: "data.the-graph.read", category: "DATA", capabilities: [], constraints: ["read-only"], providerAvailability: "CONFIGURED" },
    { id: "data.coingecko.market", category: "DATA", capabilities: [], constraints: ["read-only"], providerAvailability: "UNAVAILABLE" },
    { id: "action.uniswap.propose-swap", category: "ACTION", capabilities: ["uniswap-swap"], constraints: ["broadcasting-forbidden", "network:unichain-sepolia", "proposal-only", "signing-forbidden", "wallet-approval-required"], providerAvailability: "NOT_REQUIRED" },
    { id: "connection.0g.compute", category: "CONNECTION", capabilities: [], constraints: ["protected-a3-required"], providerAvailability: "NOT_REQUIRED" },
    { id: "connection.0g.storage", category: "CONNECTION", capabilities: [], constraints: ["protected-a3-required"], providerAvailability: "NOT_REQUIRED" },
  ],
  templates: [
    { id: "alpha-researcher", label: "Alpha Researcher", capabilities: ["research"], skillIds: ["persona.researcher", "data.the-graph.read", "data.coingecko.market", "connection.0g.compute", "connection.0g.storage"], priceAtomic: "1000" },
    { id: "market-pulse", label: "Market Pulse", capabilities: ["market-analysis"], skillIds: ["persona.market-analyst", "data.coingecko.market", "connection.0g.compute", "connection.0g.storage"], priceAtomic: "1000" },
    { id: "liquidity-scout", label: "Liquidity Scout", capabilities: ["research", "market-analysis"], skillIds: ["persona.researcher", "persona.market-analyst", "data.the-graph.read", "connection.0g.compute", "connection.0g.storage"], priceAtomic: "1000" },
    { id: "onchain-forensics", label: "Onchain Forensics", capabilities: ["research", "risk-analysis"], skillIds: ["persona.researcher", "persona.risk-analyst", "data.the-graph.read", "connection.0g.compute", "connection.0g.storage"], priceAtomic: "1000" },
    { id: "defi-risk-sentinel", label: "DeFi Risk Sentinel", capabilities: ["research", "risk-analysis"], skillIds: ["persona.researcher", "persona.risk-analyst", "data.the-graph.read", "data.coingecko.market", "connection.0g.compute", "connection.0g.storage"], priceAtomic: "1000" },
    { id: "volume-anomaly", label: "Volume Anomaly", capabilities: ["market-analysis", "risk-analysis"], skillIds: ["persona.market-analyst", "persona.risk-analyst", "data.the-graph.read", "data.coingecko.market", "connection.0g.compute", "connection.0g.storage"], priceAtomic: "1000" },
    { id: "thesis-synthesizer", label: "Thesis Synthesizer", capabilities: ["research", "market-analysis", "risk-analysis"], skillIds: ["persona.synthesizer", "data.the-graph.read", "data.coingecko.market", "connection.0g.compute", "connection.0g.storage"], priceAtomic: "1000" },
    { id: "swap-strategist", label: "Swap Strategist", capabilities: ["market-analysis", "risk-analysis", "uniswap-swap"], skillIds: ["persona.market-analyst", "persona.risk-analyst", "data.the-graph.read", "data.coingecko.market", "action.uniswap.propose-swap", "connection.0g.compute", "connection.0g.storage"], priceAtomic: "1000" },
  ],
  mcpProviders: [
    { provider: "coingecko", availability: "UNAVAILABLE", capabilities: ["search", "spot-price", "market-snapshot", "trending", "token-by-address", "pool-snapshot", "ohlcv"] },
    { provider: "the-graph", availability: "CONFIGURED", capabilities: ["pinned-deployment-lookup", "liquidity-volume-snapshot"] },
  ],
} as const;

const POLICY = {
  cadenceMinutes: 5,
  runMode: "CONTINUOUS",
  executionMode: "PROPOSE_SWAP",
  runLimit: null,
  maxAgents: 2,
  perRunCapAtomic: "3000",
  dailyCapAtomic: "10000",
} as const;

const GOAL = {
  goalId: GOAL_ID,
  objective: "Monitor liquidity evidence and report bounded execution risk",
  requiredCapabilities: ["research", "market-analysis", "uniswap-swap"],
  policy: POLICY,
  state: "ACTIVE",
  nextRunAt: "2026-07-25T18:35:00.000Z",
  completedRuns: 1,
  createdAt: "2026-07-25T18:00:00.000Z",
  updatedAt: "2026-07-25T18:30:00.000Z",
} as const;

const RUN = {
  runId: RUN_ID,
  goalId: GOAL_ID,
  scheduledFor: "2026-07-25T18:30:00.000Z",
  state: "READY",
  objective: GOAL.objective,
  requiredCapabilities: GOAL.requiredCapabilities,
  policy: POLICY,
  policyHash: "1".repeat(64),
  effectIdentity: "2".repeat(64),
  totalPriceAtomic: "2000",
  costReservedAt: "2026-07-25T18:30:01.000Z",
  report: {
    schemaVersion: 1,
    goalId: GOAL_ID,
    runId: RUN_ID,
    status: "READY",
    objective: GOAL.objective,
    summary: "Two immutable external versions completed bounded analysis and agreed on the evidence boundary.",
    conclusion: "Liquidity evidence is sufficient for research, not live execution.",
    evidence: [{ jobId: JOB_ID, agentVersionId: AVAILABLE_AGENT.versionId, resultHash: "3".repeat(64), receiptId: "99999999-9999-4999-8999-999999999999" }],
    swapProposal: { schemaVersion: 1, chainId: 1301, tokenIn: "USDC", tokenOut: "WETH", amountInAtomic: "1000", slippageBps: 50, rationale: "Bounded proposal from verified research output.", requiresWalletApproval: true },
  },
  reportHash: "4".repeat(64),
  errorCode: null,
  startedAt: "2026-07-25T18:30:00.000Z",
  completedAt: "2026-07-25T18:30:08.000Z",
  createdAt: "2026-07-25T18:30:00.000Z",
  updatedAt: "2026-07-25T18:30:08.000Z",
  jobs: [
    { agentVersionId: AVAILABLE_AGENT.versionId, jobId: JOB_ID, role: "ANALYSIS", selectionRank: 1, coveredCapabilities: ["research", "market-analysis"], priceAtomic: "1000", manifestHash: AVAILABLE_AGENT.manifestHash, fullSubname: AVAILABLE_AGENT.fullSubname },
    { agentVersionId: OWNER_AGENT.versionId, jobId: SECOND_JOB_ID, role: "SYNTHESIS", selectionRank: 2, coveredCapabilities: ["research"], priceAtomic: "1000", manifestHash: OWNER_AGENT.manifestHash, fullSubname: OWNER_AGENT.fullSubname },
  ],
} as const;

const JOB_LIST_ITEM = {
  jobId: JOB_ID,
  effectId: "d".repeat(64),
  buyerUserId: USER.id,
  agentVersionId: AVAILABLE_AGENT.versionId,
  state: "FAILED",
  version: 2,
  attempts: 1,
  maxAttempts: 3,
  cancelRequestedAt: null,
  lastErrorCode: "STORAGE_READBACK_MISMATCH",
  financialOutcome: "REFUNDED",
  createdAt: "2026-07-25T18:30:00.000Z",
  updatedAt: "2026-07-25T18:30:05.000Z",
  agent: {
    agentId: AVAILABLE_AGENT.agentId, versionId: AVAILABLE_AGENT.versionId, version: 1, name: AVAILABLE_AGENT.name,
    description: AVAILABLE_AGENT.description, ownerWallet: AVAILABLE_AGENT.ownerWallet, capabilities: AVAILABLE_AGENT.capabilities,
    priceAtomic: "1000", asset: "USDC_ATOMIC", proofPolicy: "verified-receipt-required", creatorParent: "maker.eth",
    fullSubname: AVAILABLE_AGENT.fullSubname, canonicalState: "CANONICAL", authorityOwner: TEST_WALLET,
    authorityDelegate: null, authorityPolicyVersion: "1", refusalReason: null, authorityReleaseSha: "f".repeat(40),
  },
  evidence: { owner: "verified", version: "verified", ens: "verified", compute: "verified", storage: "failed", receipt: "failed" },
} as const;

const JOB_DETAIL = {
  ...JOB_LIST_ITEM,
  evidenceDetail: {
    timeline: [{ version: 0, eventType: "JOB_CREATED", fromState: null, toState: "QUEUED", createdAt: JOB_LIST_ITEM.createdAt }, { version: 2, eventType: "JOB_FAILED", fromState: "RUNNING", toState: "FAILED", createdAt: JOB_LIST_ITEM.updatedAt }],
    latestEnsDecision: { checkId: "91", phase: "PRE_EXECUTION", operation: "EXECUTE", decision: "ALLOW", errorCode: null, recordHash: "e".repeat(64), chainId: 11155111, blockNumber: "100", blockTimestamp: JOB_LIST_ITEM.createdAt, observedAt: JOB_LIST_ITEM.createdAt, freshUntil: "2026-07-25T18:35:00.000Z", transactionHash: null },
    execution: { stage: "FAILED", requestHash: "f".repeat(64), requestId: "request-1", responseHash: "1".repeat(64), computeReceiptDigest: "2".repeat(64), proofHash: null, updatedAt: JOB_LIST_ITEM.updatedAt },
    storage: { expectedRoot: `0x${"3".repeat(64)}`, expectedDigest: "4".repeat(64), expectedSize: 128, storageReceiptDigest: "5".repeat(64), readbackRoot: `0x${"6".repeat(64)}`, readbackDigest: "7".repeat(64), readbackSize: 128, verified: false },
    receipt: null,
    delivery: null,
    financial: { settlement: null, refund: { amountAtomic: "1000", asset: "USDC_ATOMIC", reasonCode: "STORAGE_READBACK_MISMATCH", createdAt: JOB_LIST_ITEM.updatedAt } },
    mcpInvocations: [{ schemaVersion: 1, invocationId: "98989898-9898-4989-8989-989898989898", bindingId: "mcp.the-graph.liquidity-volume-snapshot", provider: "the-graph", capability: "liquidity-volume-snapshot", state: "SUCCEEDED", requestHash: "8".repeat(64), responseHash: "7".repeat(64), contextHash: "6".repeat(64), responseBytes: 512, errorCode: null, releaseSha: "f".repeat(40), completedAt: JOB_LIST_ITEM.updatedAt, sourceMetadata: { subgraphId: "8e4dRt4P4WHXnKbEq7STaQfU2g99WZ5S4w39f2PcUTjD", deploymentId: "QmGraphDeployment", network: "mainnet", blockNumber: "23456789", blockHash: `0x${"5".repeat(64)}`, completedAt: JOB_LIST_ITEM.updatedAt } }],
    errorCode: "STORAGE_READBACK_MISMATCH",
  },
} as const;

const OWNER_EARNINGS = {
  asset: "USDC_ATOMIC",
  decimals: 6,
  grossSettledAtomic: "9007199254740993000",
  ownerEarningsAtomic: "9007199254740993000",
  platformFeeAtomic: "0",
  settledHireCount: 3,
  lastSettledAt: "2026-07-25T18:31:00.000Z",
  agents: [{ agentVersionId: OWNER_AGENT.versionId, name: OWNER_AGENT.name, fullSubname: OWNER_AGENT.fullSubname, ownerEarningsAtomic: "9007199254740993000", settledHireCount: 3, lastSettledAt: "2026-07-25T18:31:00.000Z" }],
} as const;

interface MockOptions {
  goals?: readonly unknown[];
  runs?: readonly unknown[];
  sessionExpired?: boolean;
  sessionMissing?: boolean;
  actionRequiredOnce?: boolean;
  noAgents?: boolean;
  lifecycleStatus?: 500 | 503;
  hireTerminal?: "JOB_QUEUED" | "BLOCKED" | "FAILED";
  hirePollStatus?: 503;
  earningsStatus?: 403;
  ensPrimaryName?: string | null;
  ensRpcFailure?: boolean;
  catalog?: unknown;
  onGoalCreate?: (body: Record<string, unknown>) => void;
  onGoalAction?: (body: Record<string, unknown>) => void;
  onAgentCreate?: (body: Record<string, unknown>) => void;
  onChallenge?: (body: Record<string, unknown>) => void;
  onProtectedRequest?: (path: string) => void;
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installApiMocks(page: Page, options: MockOptions = {}): Promise<void> {
  let goals = [...(options.goals ?? [GOAL])];
  const runs = [...(options.runs ?? [RUN])];
  let sessionAction: "missing" | "onboard" | "authenticate" = options.sessionMissing ? "missing" : "authenticate";
  let challengeAction: "onboard" | "authenticate" = "onboard";
  let userCreated = !options.sessionMissing;
  let actionRequiredRemaining = options.actionRequiredOnce === true;
  let drafts: unknown[] = [];
  let hirePolls = 0;
  await page.unroute("https://eth.merkle.io/**");
  await page.route("https://eth.merkle.io/**", async (route) => {
    if (options.ensRpcFailure) return route.fulfill({ status: 503, body: "unavailable" });
    const request = route.request().postDataJSON() as { id?: number; method?: string };
    const result = request.method === "eth_chainId" ? "0x1" : encodeFunctionResult({
      abi: ENS_REVERSE_ABI,
      functionName: "reverseWithGateways",
      result: [options.ensPrimaryName ?? "", "0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222"],
    });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: request.id ?? 1, result }) });
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/auth/session") {
      if (options.sessionExpired) return json(route, { error: "Expired", code: "AUTH_SESSION_EXPIRED" }, 401);
      if (sessionAction === "missing") return json(route, { error: "Authentication required", code: "AUTH_REQUIRED" }, 401);
      return json(route, { authenticated: true, walletAddress: TEST_WALLET, userId: userCreated ? USER.id : null, expiresAt: "2026-07-25T20:00:00.000Z" });
    }
    if (path === "/api/auth/siwe/challenge") {
      const body = request.postDataJSON() as Record<string, unknown>;
      options.onChallenge?.(body);
      challengeAction = body.action === "authenticate" ? "authenticate" : "onboard";
      return json(route, { challengeId: "challenge-1", message: `localhost wants you to ${challengeAction}`, expiresAt: "2026-07-25T20:00:00.000Z" }, 201);
    }
    if (path === "/api/auth/siwe/verify") {
      sessionAction = challengeAction;
      return json(route, { authenticated: true, walletAddress: TEST_WALLET, userId: userCreated ? USER.id : null, expiresAt: "2026-07-25T20:00:00.000Z" });
    }
    if (path === "/api/onboard") {
      userCreated = true;
      return json(route, { userId: USER.id, walletAddress: TEST_WALLET, proxyWalletAddress: null, telegramLinkCode: "A5LINK42", inftTokenId: null, existing: false });
    }
    if (path.startsWith("/api/user/")) return json(route, USER);

    if (path.startsWith("/api/kernel/")) options.onProtectedRequest?.(path);
    if (path.startsWith("/api/kernel/") && (sessionAction !== "authenticate" || actionRequiredRemaining)) {
      actionRequiredRemaining = false;
      sessionAction = "onboard";
      return json(route, { error: "Fresh authorization is required for this action", code: "AUTH_ACTION_REQUIRED" }, 403);
    }
    if (path === "/api/kernel/goals") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as Record<string, unknown>;
        options.onGoalCreate?.(body);
        const created = { ...GOAL, ...body };
        goals = [created];
        return json(route, { goal: created, replayed: false }, 201);
      }
      return json(route, { goals });
    }
    if (path === `/api/kernel/goals/${GOAL_ID}/runs`) {
      if (request.method() === "POST") return json(route, { run: RUN, replayed: false }, 201);
      return json(route, { runs });
    }
    if (path === `/api/kernel/goals/${GOAL_ID}`) {
      if (request.method() === "PATCH") {
        const body = request.postDataJSON() as Record<string, unknown>;
        options.onGoalAction?.(body);
        const state = body.action === "PAUSE" ? "PAUSED" : body.action === "ACTIVATE" || body.action === "RESUME" ? "ACTIVE" : GOAL.state;
        goals = [{ ...GOAL, state }];
        return json(route, { goal: goals[0] });
      }
      return json(route, { goal: goals[0] ?? GOAL });
    }
    if (path === "/api/kernel/agents") {
      if (request.method() === "POST") {
        const body = request.postDataJSON() as Record<string, unknown>;
        if (body.action === "CREATE_DRAFT") {
          options.onAgentCreate?.(body);
          const draft = { ...OWNER_AGENT, name: body.name, description: body.description, lifecycleState: "DRAFT", hireable: false, fullSubname: null, creatorParent: null, agentLabel: null, canonicalState: "UNVERIFIED", authorityOwner: null, authorityReleaseSha: null, publicationDecisionId: null, publishedAt: null };
          drafts = [draft];
          return json(route, { action: "CREATE_DRAFT", version: draft }, 201);
        }
        if (body.action === "BIND_NAME") {
          const bound = { ...(drafts[0] as typeof OWNER_AGENT), lifecycleState: "NAME_BOUND", creatorParent: body.creatorParent, agentLabel: body.agentLabel, fullSubname: `${body.agentLabel}.${String(body.creatorParent).replace(/\.eth$/, "")}.eth` };
          drafts = [bound];
          return json(route, { action: "BIND_NAME", version: bound });
        }
        if (body.action === "PREPARE_ENS_WRITE") {
          const prepared = { ...(drafts[0] as typeof OWNER_AGENT), lifecycleState: "WRITE_PREPARED" };
          drafts = [prepared];
          return json(route, { action: "PREPARE_ENS_WRITE", version: prepared, plan: { kind: "LOCAL_ONLY_UNAUTHORIZED" }, planHash: OWNER_AGENT.writePlanHash });
        }
        const published = { ...(drafts[0] as typeof OWNER_AGENT), lifecycleState: "PUBLISHED", hireable: true, canonicalState: "CANONICAL", authorityOwner: TEST_WALLET, authorityReleaseSha: "f".repeat(40), publicationDecisionId: OWNER_AGENT.publicationDecisionId, publishedAt: OWNER_AGENT.publishedAt };
        drafts = [];
        return json(route, { action: "PUBLISH_VERSION", version: published });
      }
      if (options.lifecycleStatus) return json(route, { error: `Protected catalog returned ${options.lifecycleStatus}`, code: "KERNEL_UNAVAILABLE" }, options.lifecycleStatus);
      return json(route, { agents: options.noAgents ? [] : [OWNER_AGENT, AVAILABLE_AGENT], drafts });
    }
    if (path === "/api/kernel/agent-recommendations") return json(route, options.catalog ?? CATALOG);
    if (path === "/api/kernel/earnings") {
      if (options.earningsStatus) return json(route, { error: "Owner earnings denied", code: "KERNEL_FORBIDDEN" }, options.earningsStatus);
      return json(route, OWNER_EARNINGS);
    }
    if (path === "/api/kernel/hire-requests") {
      if (request.method() === "POST") return json(route, { hireRequest: { hireRequestId: HIRE_REQUEST_ID, agentVersionId: AVAILABLE_AGENT.versionId, promptHash: "1".repeat(64), state: "PENDING_CONTEXT", version: 0, jobId: null, contextHash: null, errorCode: null, claimEpoch: null, claimVersion: 0, claimExpiresAt: null, createdAt: JOB_LIST_ITEM.createdAt, updatedAt: JOB_LIST_ITEM.createdAt, replayed: false } }, 202);
      if (options.hirePollStatus) return json(route, { error: "Hire status unavailable", code: "KERNEL_UNAVAILABLE" }, options.hirePollStatus);
      hirePolls += 1;
      const state = hirePolls === 1 ? "CONTEXT_RUNNING" : options.hireTerminal ?? "JOB_QUEUED";
      return json(route, { hireRequests: [{ hireRequestId: HIRE_REQUEST_ID, agentVersionId: AVAILABLE_AGENT.versionId, promptHash: "1".repeat(64), state, version: hirePolls, jobId: state === "JOB_QUEUED" ? JOB_ID : null, contextHash: "2".repeat(64), errorCode: state === "BLOCKED" ? "GOAL_MCP_CONTEXT_UNAVAILABLE" : state === "FAILED" ? "GOAL_MCP_PROVIDER_FAILED" : null, claimEpoch: null, claimVersion: 1, claimExpiresAt: null, createdAt: JOB_LIST_ITEM.createdAt, updatedAt: JOB_LIST_ITEM.updatedAt, replayed: false }] });
    }
    if (path === "/api/kernel/jobs") {
      if (request.method() === "POST") return json(route, { job: { quoteId: "66666666-6666-4666-8666-666666666666", intentId: "77777777-7777-4777-8777-777777777777", orderId: "88888888-8888-4888-8888-888888888888", jobId: JOB_ID, effectId: "d".repeat(64), state: "QUEUED", version: 0, amountAtomic: "1000", asset: "USDC_ATOMIC", replayed: false } }, 201);
      return json(route, new URL(request.url()).searchParams.has("jobId") ? { job: JOB_DETAIL } : { jobs: [JOB_LIST_ITEM] });
    }
    return json(route, { error: "Not configured in A5 fixture" }, 503);
  });
}

async function installWallet(page: Page, rejectSignature = false): Promise<void> {
  await page.addInitScript(({ address, reject }) => {
    let connected = window.sessionStorage.getItem("a5-wallet-connected") === "1";
    const provider = {
      request: async ({ method }: { method: string }): Promise<unknown> => {
        if (method === "eth_requestAccounts") { connected = true; window.sessionStorage.setItem("a5-wallet-connected", "1"); return [address]; }
        if (method === "eth_accounts") return connected ? [address] : [];
        if (method === "eth_chainId") return "0x4cef52";
        if (method === "personal_sign") {
          const count = Number(window.sessionStorage.getItem("a5-sign-count") ?? "0") + 1;
          window.sessionStorage.setItem("a5-sign-count", String(count));
          if (reject) throw { cause: { cause: { code: 4001 } } };
          return `0x${"1".repeat(130)}`;
        }
        return null;
      },
      on: (): void => undefined,
      removeListener: (): void => undefined,
    };
    Object.defineProperty(window, "ethereum", { configurable: true, value: provider });
  }, { address: TEST_WALLET, reject: rejectSignature });
}

async function connectReady(page: Page, path: string): Promise<void> {
  await installWallet(page);
  await page.goto(path);
  await page.getByRole("button", { name: "Connect Wallet" }).click();
  await expect(page.getByRole("button", { name: "Disconnect wallet" })).toBeVisible();
}

function monitorErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function expectNoOverflow(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

async function reachFirstAgentEns(page: Page, name: string): Promise<void> {
  await page.getByLabel("Agent name").fill(name);
  await page.getByLabel("Description").fill("Exercises the first-agent primary ENS convenience boundary.");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: /Alpha Researcher/ }).click();
  await page.getByRole("button", { name: /Continue/ }).click();
}

test.beforeEach(async ({ page }) => { await installApiMocks(page); });

test("landing explains the two protected paths at 375, 768, and 1440", async ({ page }) => {
  const errors = monitorErrors(page);
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 950 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Get work done with reviewed agents." })).toBeVisible();
    const home = page.getByRole("link", { name: "AlphaDawg home" });
    await expect(home).toBeVisible();
    await expect(home.locator('img[src*="logo-square.png"]')).toBeVisible();
    await expect(page.getByRole("link", { name: /Hire an agent/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Create an agent/ }).first()).toBeVisible();
    await expect(page.getByText("Choose a goal, hire a reviewed agent, and inspect the result and proof.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "How AlphaDawg works" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Choose your path" })).toBeVisible();
    await expect(page.getByText("You earn only when another user hires it and receipt-backed settlement succeeds.", { exact: false })).toBeVisible();
    await expect(page.getByText("A hire count alone is not payment evidence.", { exact: false })).toBeVisible();
    await expectNoOverflow(page);
    await page.screenshot({ path: `test-results/visual/a5-landing-${width}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});

test("landing core content remains visible without client JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Get work done with reviewed agents." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How AlphaDawg works" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Choose your path" })).toBeVisible();
  await context.close();
});

test("does not request protected data before ready and normalizes nested signature rejection", async ({ page }) => {
  const protectedRequests: string[] = [];
  await page.unroute("**/api/**");
  await installApiMocks(page, { sessionMissing: true, onProtectedRequest: (path) => protectedRequests.push(path) });
  await installWallet(page, true);
  await page.goto("/dashboard");
  expect(protectedRequests).toEqual([]);
  await page.getByRole("button", { name: "Connect Wallet" }).click();
  await expect(page.getByText("WALLET_SIGNATURE_REJECTED: Signature canceled. No authorization was granted.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry signature" })).toHaveCount(1);
  expect(protectedRequests).toEqual([]);
});

test("onboards once and waits for explicit authenticate authorization", async ({ page }) => {
  const actions: unknown[] = [];
  const protectedRequests: string[] = [];
  await page.unroute("**/api/**");
  await installApiMocks(page, { sessionMissing: true, onChallenge: (body) => actions.push(body.action), onProtectedRequest: (path) => protectedRequests.push(path) });
  await installWallet(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Connect Wallet" }).click();
  await expect(page.getByRole("heading", { name: "Workspace authorization required" })).toBeVisible();
  expect(actions).toEqual(["onboard"]);
  expect(await page.evaluate(() => window.sessionStorage.getItem("a5-sign-count"))).toBe("1");
  expect(protectedRequests).toEqual([]);
  await page.getByRole("button", { name: "Authorize workspace" }).click();
  await expect(page.getByRole("heading", { name: GOAL.objective })).toBeVisible();
  expect(actions).toEqual(["onboard", "authenticate"]);
  expect(await page.evaluate(() => window.sessionStorage.getItem("a5-sign-count"))).toBe("2");
  expect(protectedRequests.length).toBeGreaterThan(0);
});

test("recovers AUTH_ACTION_REQUIRED without treating every 403 as stale", async ({ page }) => {
  const actions: unknown[] = [];
  await page.unroute("**/api/**");
  await installApiMocks(page, { actionRequiredOnce: true, onChallenge: (body) => actions.push(body.action) });
  await installWallet(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Connect Wallet" }).click();
  await expect(page.getByRole("heading", { name: "Workspace authorization required" })).toBeVisible();
  await page.getByRole("button", { name: "Authorize workspace" }).click();
  await expect(page.getByRole("heading", { name: GOAL.objective })).toBeVisible();
  expect(actions).toEqual(["authenticate"]);
});

test("shows expired authorization without opening a signature prompt", async ({ page }) => {
  await page.unroute("**/api/**");
  await installApiMocks(page, { sessionExpired: true });
  await installWallet(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Connect Wallet" }).click();
  await expect(page.getByRole("heading", { name: "Authorization expired" })).toBeVisible();
  expect(await page.evaluate(() => window.sessionStorage.getItem("a5-sign-count"))).toBeNull();
});

test("creates a recurring protected goal with explicit demo boundaries", async ({ page }) => {
  let created: Record<string, unknown> | null = null;
  await page.unroute("**/api/**");
  await installApiMocks(page, { goals: [], runs: [], onGoalCreate: (body) => { created = body; } });
  await connectReady(page, "/dashboard");
  await expect(page.getByRole("heading", { name: "Define your first goal" })).toBeVisible();
  await page.getByLabel("Goal statement").fill("Monitor liquidity evidence and report bounded execution risk");
  await expect(page.getByLabel("Cadence")).toHaveValue("5");
  await expect(page.getByLabel("Maximum agents")).toHaveValue("2");
  await expect(page.getByLabel("Per-run cap")).toHaveValue("3000");
  await expect(page.getByLabel("Daily cap")).toHaveValue("10000");
  await expect(page.getByLabel("Execution mode")).toHaveValue("PROPOSE_SWAP");
  const research = page.getByLabel("Research", { exact: true });
  await research.focus();
  await expect(research).toBeFocused();
  await page.keyboard.press("Space");
  await expect(research).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(research).toBeChecked();
  await page.getByRole("button", { name: "Activate goal" }).click();
  await expect.poll(() => created).not.toBeNull();
  expect(created).toMatchObject({ state: "ACTIVE", policy: POLICY });
});

test("workspace demonstrates agents, terminal report, proof links, and blocked A6 proposal", async ({ page }) => {
  const errors = monitorErrors(page);
  await connectReady(page, "/dashboard");
  await expect(page.getByRole("heading", { name: GOAL.objective })).toBeVisible();
  await expect(page.getByText("0.003 USDC per run")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Latest run" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Selected agent lanes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Converged report" })).toBeVisible();
  await expect(page.getByText("READY", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(AVAILABLE_AGENT.fullSubname).first()).toBeVisible();
  await expect(page.getByLabel("Converged report").getByText("Liquidity evidence is sufficient for research, not live execution.")).toBeVisible();
  await expect(page.getByText("A6_BLOCKED_LIVE")).toBeVisible();
  await expect(page.getByRole("button", { name: "Wallet execution unavailable" })).toBeDisabled();
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoOverflow(page);
    await page.screenshot({ path: `test-results/visual/a5-dashboard-${width}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});

test("workspace can run now and pause through the protected goal controls", async ({ page }) => {
  const actions: unknown[] = [];
  const protectedRequests: string[] = [];
  await page.unroute("**/api/**");
  await installApiMocks(page, { onGoalAction: (body) => actions.push(body.action), onProtectedRequest: (path) => protectedRequests.push(path) });
  await connectReady(page, "/dashboard");
  await page.getByRole("button", { name: "Run now" }).click();
  await expect.poll(() => protectedRequests.filter((path) => path.endsWith("/runs")).length).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect.poll(() => actions).toContain("PAUSE");
});

test("workspace renders partial output without promoting it to verified", async ({ page }) => {
  const partial = { ...RUN, state: "PARTIAL", report: { ...RUN.report, status: "PARTIAL", swapProposal: null } };
  await page.unroute("**/api/**");
  await installApiMocks(page, { runs: [partial] });
  await connectReady(page, "/dashboard");
  await expect(page.getByText("PARTIAL", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("A6_BLOCKED_LIVE")).toHaveCount(0);
});

test("marketplace preserves URL tabs, authority evidence, and external hire", async ({ page }) => {
  await connectReady(page, "/marketplace?view=available");
  await expect(page.getByRole("link", { name: "Available" })).toHaveAttribute("aria-current", "page");
  const card = page.getByRole("listitem").filter({ hasText: AVAILABLE_AGENT.fullSubname });
  await expect(card.getByText(AVAILABLE_AGENT.fullSubname).first()).toBeVisible();
  await expect(card.getByText("Version", { exact: true })).toBeVisible();
  await expect(card.getByText(String(AVAILABLE_AGENT.version), { exact: true })).toBeVisible();
  await expect(card.getByText("Settled earnings", { exact: true })).toHaveCount(0);
  await expect(card.getByText("Provenance recorded")).toBeVisible();
  await card.getByText("Identity, authority, and provenance").click();
  await expect(card.getByText(AVAILABLE_AGENT.versionId, { exact: true })).toBeVisible();
  await expect(card.getByText("0.001 USDC (1,000 atomic units)")).toBeVisible();
  await page.getByRole("link", { name: "Hire agent" }).click();
  await expect(page).toHaveURL(new RegExp(`agentId=${AVAILABLE_AGENT.versionId}`));
  await expect(page.getByRole("dialog", { name: `Run ${AVAILABLE_AGENT.name}` })).toBeVisible();
  await page.getByLabel("Task prompt").fill("Analyze live liquidity evidence and preserve exact proof metadata.");
  await page.getByRole("button", { name: "Submit protected hire" }).click();
  await expect(page.getByText("Pending context", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Job queued", { exact: true }).first()).toBeVisible({ timeout: 7_000 });
  await expect(page.getByRole("link", { name: "Open verifier" })).toHaveAttribute("href", `/verify?jobId=${JOB_ID}`);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page).not.toHaveURL(/agentId=/);
  await page.getByRole("link", { name: "Mine" }).click();
  await expect(page).toHaveURL(/view=mine/);
  await page.reload();
  await expect(page.getByRole("link", { name: "Mine" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByLabel("Owner settled earnings").getByText("3", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Owner settled earnings").getByText(/9,007,199,254,740,993,000 atomic units/)).toBeVisible();
  await page.getByText("Identity, authority, and provenance").click();
  await expect(page.getByText("Provenance", { exact: true })).toBeVisible();
  await expect(page.getByText("Unavailable", { exact: true }).first()).toBeVisible();
});

for (const terminalState of ["BLOCKED", "FAILED"] as const) {
  test(`protected hire renders exact ${terminalState.toLowerCase()} refusal`, async ({ page }) => {
    await page.unroute("**/api/**");
    await installApiMocks(page, { hireTerminal: terminalState });
    await connectReady(page, `/marketplace?view=available&agentId=${AVAILABLE_AGENT.versionId}`);
    await page.getByLabel("Task prompt").fill("Analyze bounded liquidity evidence.");
    await page.getByRole("button", { name: "Submit protected hire" }).click();
    await expect(page.getByText(terminalState === "BLOCKED" ? "GOAL_MCP_CONTEXT_UNAVAILABLE" : "GOAL_MCP_PROVIDER_FAILED")).toBeVisible({ timeout: 7_000 });
    await expect(page.getByRole("button", { name: "Replay same request safely" })).toBeVisible();
  });
}

test("accepted hire preserves an explicit ambiguous polling state", async ({ page }) => {
  await page.unroute("**/api/**");
  await installApiMocks(page, { hirePollStatus: 503 });
  await connectReady(page, `/marketplace?view=available&agentId=${AVAILABLE_AGENT.versionId}`);
  await page.getByLabel("Task prompt").fill("Analyze bounded liquidity evidence.");
  await page.getByRole("button", { name: "Submit protected hire" }).click();
  await expect(page.getByText(/Latest hire state is ambiguous/)).toBeVisible({ timeout: 7_000 });
  await expect(page.getByText(/Do not submit a new request/)).toBeVisible();
});

test("owner earnings denial remains explicit and retryable", async ({ page }) => {
  await page.unroute("**/api/**");
  await installApiMocks(page, { earningsStatus: 403 });
  await connectReady(page, "/marketplace?view=mine");
  await expect(page.getByText("Owner earnings denied. Reauthorize the authenticated creator wallet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry earnings" })).toBeVisible();
});

test("catalog V3 creation sends only template identity fields and publishes the returned version", async ({ page }) => {
  const errors = monitorErrors(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  let createBody: Record<string, unknown> | null = null;
  await page.unroute("**/api/**");
  await installApiMocks(page, { onAgentCreate: (body) => { createBody = body; } });
  await connectReady(page, "/marketplace?view=mine&create=1");
  await expect(page.getByRole("dialog", { name: "Create a protected agent" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Publication progress" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Identity" })).toBeVisible();
  const dialogBox = await page.getByRole("dialog", { name: "Create a protected agent" }).boundingBox();
  const stageBox = await page.getByTestId("agent-stage").boundingBox();
  const descriptionBox = await page.getByLabel("Description").boundingBox();
  expect(dialogBox?.height).toBeLessThan(760);
  expect(stageBox?.height).toBeLessThan(420);
  expect(descriptionBox?.height).toBeLessThan(140);
  await page.getByLabel("Agent name").focus();
  await expect(page.getByLabel("Agent name")).toBeFocused();
  expect(await page.getByLabel("Agent name").evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
  await page.getByLabel("Agent name").fill("Bounded Market Researcher");
  await page.getByLabel("Description").fill("Researches bounded market evidence with explicit source and execution limits.");
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByTestId("agent-stage")).toBeFocused();
  expect(await page.getByTestId("agent-stage").evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("none");
  await expect(page.getByRole("button", { name: /Alpha Researcher/ })).toBeVisible();
  await page.getByRole("button", { name: /Alpha Researcher/ }).click();
  await page.getByText("Inspect exact skills and constraints").click();
  await page.getByText("Inspect catalog provider readiness").click();
  await expect(page.locator("[data-category-heading-icon]")).toHaveCount(4);
  await expect(page.getByText("The role and reasoning stance the agent follows.")).toBeVisible();
  await expect(page.getByText("Read-only sources the protected runtime may query.")).toBeVisible();
  await expect(page.getByText("Included by template").first()).toBeVisible();
  await expect(page.getByText("CONFIGURED means server credentials are present", { exact: false })).toBeVisible();
  const providerReadiness = page.locator("details").filter({ hasText: "Inspect catalog provider readiness" });
  await expect(providerReadiness.getByText("UNAVAILABLE", { exact: true }).first()).toBeVisible();
  await expect(providerReadiness.getByText("CONFIGURED", { exact: true })).toBeVisible();
  await page.locator('[data-category-icon="PERSONA"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/visual/a5-create-capabilities-1440.png" });
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page.getByLabel("Creator ENS parent")).toHaveValue("maker.eth");
  await expect(page.getByTestId("agent-subname-preview")).toHaveText("bounded-market-researcher.maker.eth");
  await page.waitForTimeout(250);
  await page.screenshot({ path: "test-results/visual/a5-create-ens-1440.png" });
  await page.getByRole("button", { name: "Prepare immutable draft" }).click();
  await expect(page.getByLabel("Immutable server preview")).toBeVisible();
  expect(Object.keys(createBody ?? {}).sort()).toEqual(["action", "description", "name", "templateId"]);
  expect(createBody).toMatchObject({ action: "CREATE_DRAFT", templateId: "alpha-researcher", name: "Bounded Market Researcher" });
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: "Publish immutable version" }).click();
  await expect(page.getByRole("heading", { name: "Publication receipt" })).toBeVisible();
  await expect(page.getByLabel("Publication receipt").getByText("ELIGIBLE", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Publication receipt").getByText("0.001 USDC (1,000 atomic units)")).toBeVisible();
  await expect(page.getByLabel("Publication receipt").getByText("Open Mine to view finalized owner-only earnings.")).toBeVisible();
  await page.getByRole("button", { name: /View my agents/ }).click();
  await expect(page).toHaveURL(/view=mine/);
  expect(errors).toEqual([]);
});

test("agent catalog empty state and provider availability remain explicit", async ({ page }) => {
  await page.unroute("**/api/**");
  await installApiMocks(page, { noAgents: true, catalog: { ...CATALOG, mcpProviders: [{ ...CATALOG.mcpProviders[0], availability: "AVAILABLE" }, CATALOG.mcpProviders[1]] } });
  await connectReady(page, "/marketplace?view=available");
  await expect(page.getByText("No external canonical versions are available.")).toBeVisible();
  await page.getByRole("link", { name: "Create agent" }).click();
  await page.getByLabel("Agent name").fill("Provider Availability Agent");
  await page.getByLabel("Description").fill("Shows exact provider availability from the authenticated catalog response.");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: /Alpha Researcher/ }).click();
  const providerSummary = page.getByText("Inspect catalog provider readiness");
  await providerSummary.click();
  const availability = providerSummary.locator("..");
  await expect(availability.getByText("AVAILABLE", { exact: true }).first()).toBeVisible();
  await expect(availability.getByText("CONFIGURED", { exact: true }).first()).toBeVisible();
});

test("first agent keeps ENS parent blank and never invents a wallet-derived name", async ({ page }) => {
  await page.unroute("**/api/**");
  await installApiMocks(page, { noAgents: true, ensPrimaryName: null });
  await connectReady(page, "/marketplace?view=mine&create=1");
  await reachFirstAgentEns(page, "First Evidence Agent");
  await expect(page.getByLabel("Creator ENS parent")).toHaveValue("");
  await expect(page.getByTestId("agent-subname-preview")).toHaveText("Unavailable until a canonical creator parent is entered.");
  await expect(page.getByText("No primary ENS name was available.", { exact: false })).toBeVisible();
  await expect(page.getByText("CREATOR_PARENT_REQUIRED: No wallet-derived ENS parent was substituted.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Prepare immutable draft" })).toBeDisabled();
});

test("mainnet primary ENS prefills a first-agent candidate without granting authority", async ({ page }) => {
  await page.unroute("**/api/**");
  await installApiMocks(page, { noAgents: true, ensPrimaryName: "first-agent.eth" });
  await connectReady(page, "/marketplace?view=mine&create=1");
  await reachFirstAgentEns(page, "Primary Name Agent");
  await expect(page.getByLabel("Creator ENS parent")).toHaveValue("first-agent.eth");
  await expect(page.getByText("PREPARE_ENS_WRITE and server A4 authority checks remain decisive.")).toBeVisible();
});

test("non-ENS reverse results preserve manual entry and grant no authority", async ({ page }) => {
  await page.unroute("**/api/**");
  await installApiMocks(page, { noAgents: true, ensPrimaryName: "not-an-ens-name.example" });
  await connectReady(page, "/marketplace?view=mine&create=1");
  await reachFirstAgentEns(page, "Invalid Reverse Agent");
  await expect(page.getByLabel("Creator ENS parent")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Prepare immutable draft" })).toBeDisabled();
});

for (const status of [500, 503] as const) {
  test(`kernel catalog ${status} remains an error, not empty data`, async ({ page }) => {
    await installWallet(page);
    await page.unroute("**/api/**");
    await installApiMocks(page, { lifecycleStatus: status });
    await page.goto("/marketplace?view=available");
    const connect = page.getByRole("button", { name: "Connect Wallet" });
    if (await connect.isVisible()) await connect.click();
    await expect(page.getByText(`Protected catalog returned ${status}`)).toBeVisible();
    await expect(page.getByText("No external canonical versions are available.")).toHaveCount(0);
  });
}

test("creation dialog traps focus, returns focus, and contains no legacy manual flow", async ({ page }) => {
  await connectReady(page, "/marketplace?view=available");
  const open = page.getByRole("link", { name: "Create agent" });
  await open.focus();
  await open.click();
  await expect(page.getByRole("button", { name: "Close dialog" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await expect(page.getByText("Markdown instructions")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
});

test("verify deep link shows authoritative MCP and proof failure precedence", async ({ page }) => {
  await connectReady(page, `/verify?jobId=${JOB_ID}`);
  for (const title of ["Matched agent", "Hire and ENS authority", "MCP query context", "0G reasoning", "Storage readback", "Canonical receipt", "Delivered result", "Settlement or refund"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
  await page.getByRole("heading", { name: "MCP query context" }).locator("..").getByText("Exact evidence tuple").click();
  await expect(page.getByText("the-graph: liquidity-volume-snapshot")).toBeVisible();
  await expect(page.getByText(`Request hash: ${"8".repeat(64)}`)).toBeVisible();
  await expect(page.getByText("Subgraph ID: 8e4dRt4P4WHXnKbEq7STaQfU2g99WZ5S4w39f2PcUTjD")).toBeVisible();
  await expect(page.getByText("Block number: 23456789")).toBeVisible();
  await expect(page.getByText(`Block hash: 0x${"5".repeat(64)}`)).toBeVisible();
  await expect(page.getByText("STORAGE_READBACK_MISMATCH").first()).toBeVisible();
  await expect(page.getByText("Readback mismatch")).toBeVisible();
  await expect(page.getByText("Verified", { exact: true })).toHaveCount(0);
  await expectNoOverflow(page);
  await page.screenshot({ path: "test-results/visual/a5-proof-1440.png", fullPage: true });
});

test("all primary routes remain usable and overflow-free at mobile, tablet, and desktop", async ({ page }) => {
  const errors = monitorErrors(page);
  await installWallet(page);
  const routes = [
    ["/", "landing"],
    ["/dashboard", "dashboard"],
    ["/marketplace?view=mine&create=1", "marketplace-create"],
    ["/marketplace?view=available", "marketplace-available"],
    ["/verify", "verify"],
  ] as const;
  let connected = false;
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, label] of routes) {
      await page.goto(path);
      if (!connected && path !== "/") {
        await page.getByRole("button", { name: "Connect Wallet" }).click();
        await expect(page.getByRole("button", { name: "Disconnect wallet" })).toBeVisible();
        connected = true;
      }
      await expect(page.locator("main").first()).toBeVisible();
      if (path.includes("create=1")) {
        await expect(page.getByRole("list", { name: "Publication progress" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Identity" })).toBeVisible();
      }
      await expectNoOverflow(page);
      await page.screenshot({ path: `test-results/visual/a5-route-${label}-${width}.png`, fullPage: !path.includes("create=1") });
    }
  }
  expect(errors).toEqual([]);
});

test("mobile navigation, focus return, and reduced motion remain operable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open navigation menu" });
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("navigation", { name: "Mobile primary" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expectNoOverflow(page);
});

test("malformed proof deep links refuse without substituting evidence", async ({ page }) => {
  await connectReady(page, "/verify?jobId=not-a-uuid");
  await expect(page.getByRole("heading", { name: "Invalid protected job ID" })).toBeVisible();
  await expect(page.getByText("No alternate evidence was substituted.")).toBeVisible();
});

test("legacy primary routes redirect while UUID job detail remains protected", async ({ page }) => {
  await connectReady(page, "/dashboard");
  for (const path of ["/deposit", "/history", "/portfolio", "/dashboard/compute/42"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard$/);
  }
  await page.goto("/infrastructure");
  await expect(page).toHaveURL(/\/verify$/);
  await page.goto(`/dashboard/compute/${JOB_ID}`);
  await expect(page.getByRole("heading", { name: new RegExp(AVAILABLE_AGENT.name) })).toBeVisible();
  await expect(page.getByText("STORAGE_READBACK_MISMATCH").first()).toBeVisible();
});
