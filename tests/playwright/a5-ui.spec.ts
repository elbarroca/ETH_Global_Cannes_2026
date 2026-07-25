import { expect, test, type Page, type Route } from "@playwright/test";

const TEST_WALLET = "0x1111111111111111111111111111111111111111";
const GOAL_ID = "12121212-1212-4121-8121-121212121212";
const RUN_ID = "13131313-1313-4131-8131-131313131313";
const JOB_ID = "55555555-5555-4555-8555-555555555555";
const SECOND_JOB_ID = "56565656-5656-4565-8565-565656565656";

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
    errorCode: "STORAGE_READBACK_MISMATCH",
  },
} as const;

interface MockOptions {
  goals?: readonly unknown[];
  runs?: readonly unknown[];
  sessionExpired?: boolean;
  onGoalCreate?: (body: Record<string, unknown>) => void;
  onProtectedRequest?: (path: string) => void;
}

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installApiMocks(page: Page, options: MockOptions = {}): Promise<void> {
  let goals = [...(options.goals ?? [GOAL])];
  const runs = [...(options.runs ?? [RUN])];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/auth/session") {
      if (options.sessionExpired) return json(route, { error: "Expired", code: "AUTH_SESSION_EXPIRED" }, 401);
      return json(route, { authenticated: true, walletAddress: TEST_WALLET, userId: USER.id, expiresAt: "2026-07-25T20:00:00.000Z" });
    }
    if (path === "/api/auth/siwe/challenge") return json(route, { challengeId: "challenge-1", message: "localhost wants you to sign in", expiresAt: "2026-07-25T20:00:00.000Z" }, 201);
    if (path === "/api/auth/siwe/verify") return json(route, { authenticated: true, walletAddress: TEST_WALLET, userId: USER.id, expiresAt: "2026-07-25T20:00:00.000Z" });
    if (path === "/api/onboard") return json(route, { userId: USER.id, walletAddress: TEST_WALLET, proxyWalletAddress: null, telegramLinkCode: "A5LINK42", inftTokenId: null, existing: true });
    if (path.startsWith("/api/user/")) return json(route, USER);

    if (path.startsWith("/api/kernel/")) options.onProtectedRequest?.(path);
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
    if (path === `/api/kernel/goals/${GOAL_ID}`) return json(route, { goal: GOAL });
    if (path === "/api/kernel/agents") {
      if (request.method() === "POST") return json(route, { action: "CREATE_DRAFT", version: OWNER_AGENT, planHash: OWNER_AGENT.writePlanHash }, 201);
      return json(route, { agents: [OWNER_AGENT, AVAILABLE_AGENT], drafts: [] });
    }
    if (path === "/api/kernel/agent-recommendations") return json(route, { reviewedPromptDraft: "## Role\nProtected agent", pinnedSkills: [{ id: "research", source: "kernel://skills/research@1", reviewedHash: "a".repeat(64), policy: "metadata-only-never-execute" }], nativeConnections: [{ id: "zero-g-compute", required: true }, { id: "zero-g-storage", required: true }], mcp: [], readiness: "READY", reasons: [] });
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

test.beforeEach(async ({ page }) => { await installApiMocks(page); });

test("landing communicates the protected recurring loop at 375, 768, and 1440", async ({ page }) => {
  const errors = monitorErrors(page);
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 950 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "One goal. A verified agent loop." })).toBeVisible();
    await expect(page.getByAltText("AlphaDawg").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Enter workspace/ })).toBeVisible();
    await expect(page.getByText("Publish · Hire · Prove")).toBeVisible();
    await expectNoOverflow(page);
    await page.screenshot({ path: `test-results/visual/a5-landing-${width}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});

test("does not request protected data before ready and normalizes nested signature rejection", async ({ page }) => {
  const protectedRequests: string[] = [];
  await page.unroute("**/api/**");
  await installApiMocks(page, { sessionExpired: true, onProtectedRequest: (path) => protectedRequests.push(path) });
  await installWallet(page, true);
  await page.goto("/dashboard");
  expect(protectedRequests).toEqual([]);
  await page.getByRole("button", { name: "Connect Wallet" }).click();
  await expect(page.getByText("WALLET_SIGNATURE_REJECTED: Signature canceled. Retry when ready.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry SIWE" })).toHaveCount(1);
  expect(protectedRequests).toEqual([]);
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
  await expect(page.getByLabel("Per-run cap, atomic")).toHaveValue("3000");
  await expect(page.getByLabel("Daily cap, atomic")).toHaveValue("10000");
  await expect(page.getByLabel("Execution mode")).toHaveValue("PROPOSE_SWAP");
  await page.getByRole("button", { name: "Activate goal" }).click();
  await expect.poll(() => created).not.toBeNull();
  expect(created).toMatchObject({ state: "ACTIVE", policy: POLICY });
});

test("workspace demonstrates agents, terminal report, proof links, and blocked A6 proposal", async ({ page }) => {
  const errors = monitorErrors(page);
  await connectReady(page, "/dashboard");
  await expect(page.getByRole("heading", { name: GOAL.objective })).toBeVisible();
  await expect(page.getByText("3000 / run")).toBeVisible();
  await expect(page.getByText("SCHEDULED", { exact: true })).toBeVisible();
  await expect(page.getByText("SYNTHESIZING", { exact: true })).toBeVisible();
  await expect(page.getByText("READY", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(AVAILABLE_AGENT.fullSubname).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Liquidity evidence is sufficient for research, not live execution." })).toBeVisible();
  await expect(page.getByText("A6_BLOCKED_LIVE")).toBeVisible();
  await expect(page.getByRole("button", { name: "Wallet execution unavailable" })).toBeDisabled();
  await expectNoOverflow(page);
  await page.screenshot({ path: "test-results/visual/a5-dashboard-1440.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("marketplace preserves URL tabs, dense authority rows, and external hire", async ({ page }) => {
  await connectReady(page, "/marketplace?view=available");
  await expect(page.getByRole("tab", { name: "available" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(AVAILABLE_AGENT.fullSubname).first()).toBeVisible();
  await expect(page.getByText(/v1 · 44444444/)).toBeVisible();
  await expect(page.getByText("1000 USDC_ATOMIC").first()).toBeVisible();
  await page.getByRole("link", { name: "Hire agent" }).click();
  await expect(page).toHaveURL(new RegExp(`agentId=${AVAILABLE_AGENT.versionId}`));
  await expect(page.getByRole("dialog", { name: `Run ${AVAILABLE_AGENT.name}` })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page).not.toHaveURL(/agentId=/);
  await page.getByRole("tab", { name: "mine" }).click();
  await expect(page).toHaveURL(/view=mine/);
  await page.reload();
  await expect(page.getByRole("tab", { name: "mine" })).toHaveAttribute("aria-selected", "true");
});

test("verify deep link shows six honest proof dimensions and exact refusal", async ({ page }) => {
  await connectReady(page, `/verify?jobId=${JOB_ID}`);
  for (const title of ["Agent identity", "ENS authority", "0G Compute", "Storage readback", "Canonical receipt", "Settlement or refund"]) {
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
  await expect(page.getByText("STORAGE_READBACK_MISMATCH").first()).toBeVisible();
  await expect(page.getByText("Readback mismatch")).toBeVisible();
  await expect(page.getByText("Unavailable", { exact: true }).first()).toBeVisible();
  await expectNoOverflow(page);
  await page.screenshot({ path: "test-results/visual/a5-proof-1440.png", fullPage: true });
});

test("all primary routes remain usable and overflow-free at mobile, tablet, and desktop", async ({ page }) => {
  await installWallet(page);
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/dashboard", "/marketplace?view=available", "/verify"]) {
      await page.goto(path);
      const connect = page.getByRole("button", { name: "Connect Wallet" });
      if (await connect.isVisible()) await connect.click();
      await expect(page.locator("main").first()).toBeVisible();
      await expectNoOverflow(page);
      await page.screenshot({ path: `test-results/visual/a5-${path.split("?")[0].slice(1)}-${width}.png`, fullPage: true });
    }
  }
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
