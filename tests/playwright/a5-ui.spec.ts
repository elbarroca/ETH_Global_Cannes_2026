import { expect, test, type Page, type Route } from "@playwright/test";

const OWNER_AGENT = {
  agentId: "11111111-1111-4111-8111-111111111111",
  versionId: "22222222-2222-4222-8222-222222222222",
  version: 1,
  name: "Evidence Researcher With A Deliberately Long Registry Name",
  description: "Immutable research specialist used to exercise long copy and responsive cards.",
  capabilities: ["research", "market-analysis"],
  manifestHash: "a".repeat(64),
  promptHash: "b".repeat(64),
  configHash: "c".repeat(64),
  adapterKey: "protected-a3",
  ownerWallet: "0x3333333333333333333333333333333333333333",
  priceAtomic: "1000",
  asset: "USDC_ATOMIC",
  proofPolicy: "verified-receipt-required",
  ownedByViewer: true,
  publishedAt: "2026-07-24T14:00:00.000Z",
} as const;

const AVAILABLE_AGENT = {
  ...OWNER_AGENT,
  agentId: "33333333-3333-4333-8333-333333333333",
  versionId: "44444444-4444-4444-8444-444444444444",
  name: "Risk Boundary Agent",
  ownerWallet: "0x4444444444444444444444444444444444444444",
  ownedByViewer: false,
} as const;

const JOB_ID = "55555555-5555-4555-8555-555555555555";
const EFFECT_ID = "d".repeat(64);

const JOB_LIST_ITEM = {
  jobId: JOB_ID,
  effectId: EFFECT_ID,
  buyerUserId: "buyer",
  agentVersionId: AVAILABLE_AGENT.versionId,
  state: "FAILED",
  version: 2,
  attempts: 1,
  maxAttempts: 3,
  cancelRequestedAt: null,
  lastErrorCode: "STORAGE_READBACK_MISMATCH",
  financialOutcome: "REFUNDED",
  createdAt: "2026-07-24T14:10:00.000Z",
  updatedAt: "2026-07-24T14:10:05.000Z",
  agent: {
    agentId: AVAILABLE_AGENT.agentId,
    versionId: AVAILABLE_AGENT.versionId,
    version: AVAILABLE_AGENT.version,
    name: AVAILABLE_AGENT.name,
    description: AVAILABLE_AGENT.description,
    ownerWallet: AVAILABLE_AGENT.ownerWallet,
    capabilities: AVAILABLE_AGENT.capabilities,
    priceAtomic: AVAILABLE_AGENT.priceAtomic,
    asset: AVAILABLE_AGENT.asset,
    proofPolicy: AVAILABLE_AGENT.proofPolicy,
  },
  evidence: {
    owner: "verified",
    version: "verified",
    ens: "verified",
    compute: "verified",
    storage: "failed",
    receipt: "failed",
  },
} as const;

const JOB_DETAIL = {
  ...JOB_LIST_ITEM,
  evidenceDetail: {
    timeline: [
      {
        version: 0,
        eventType: "JOB_CREATED",
        fromState: null,
        toState: "QUEUED",
        createdAt: JOB_LIST_ITEM.createdAt,
      },
      {
        version: 2,
        eventType: "JOB_FAILED",
        fromState: "RUNNING",
        toState: "FAILED",
        createdAt: JOB_LIST_ITEM.updatedAt,
      },
    ],
    latestEnsDecision: {
      checkId: "91",
      phase: "PRE_EXECUTION",
      operation: "EXECUTE",
      decision: "ALLOW",
      errorCode: null,
      recordHash: "e".repeat(64),
      chainId: 11155111,
      blockNumber: "100",
      blockTimestamp: "2026-07-24T14:10:01.000Z",
      observedAt: "2026-07-24T14:10:01.000Z",
      freshUntil: "2026-07-24T14:15:01.000Z",
      transactionHash: null,
    },
    execution: {
      stage: "FAILED",
      requestHash: "f".repeat(64),
      requestId: "request-1",
      responseHash: "1".repeat(64),
      computeReceiptDigest: "2".repeat(64),
      proofHash: null,
      updatedAt: JOB_LIST_ITEM.updatedAt,
    },
    storage: {
      expectedRoot: `0x${"3".repeat(64)}`,
      expectedDigest: "4".repeat(64),
      expectedSize: 128,
      storageReceiptDigest: "5".repeat(64),
      readbackRoot: `0x${"6".repeat(64)}`,
      readbackDigest: "7".repeat(64),
      readbackSize: 128,
      verified: false,
    },
    receipt: null,
    delivery: null,
    financial: {
      settlement: null,
      refund: {
        amountAtomic: "1000",
        asset: "USDC_ATOMIC",
        reasonCode: "STORAGE_READBACK_MISMATCH",
        createdAt: JOB_LIST_ITEM.updatedAt,
      },
    },
    errorCode: "STORAGE_READBACK_MISMATCH",
  },
} as const;

const VERIFIED_JOB_LIST_ITEM = {
  ...JOB_LIST_ITEM,
  state: "SUCCEEDED",
  version: 4,
  lastErrorCode: null,
  financialOutcome: "SETTLED",
  evidence: {
    owner: "verified",
    version: "verified",
    ens: "verified",
    compute: "verified",
    storage: "verified",
    receipt: "verified",
  },
} as const;

const VERIFIED_JOB_DETAIL = {
  ...VERIFIED_JOB_LIST_ITEM,
  evidenceDetail: {
    timeline: [
      {
        version: 0,
        eventType: "JOB_CREATED",
        fromState: null,
        toState: "QUEUED",
        createdAt: JOB_LIST_ITEM.createdAt,
      },
      {
        version: 4,
        eventType: "JOB_SUCCEEDED",
        fromState: "RUNNING",
        toState: "SUCCEEDED",
        createdAt: JOB_LIST_ITEM.updatedAt,
      },
    ],
    latestEnsDecision: JOB_DETAIL.evidenceDetail.latestEnsDecision,
    execution: {
      ...JOB_DETAIL.evidenceDetail.execution,
      stage: "READBACK_VERIFIED",
      proofHash: "8".repeat(64),
    },
    storage: {
      ...JOB_DETAIL.evidenceDetail.storage,
      readbackRoot: JOB_DETAIL.evidenceDetail.storage.expectedRoot,
      readbackDigest: JOB_DETAIL.evidenceDetail.storage.expectedDigest,
      readbackSize: JOB_DETAIL.evidenceDetail.storage.expectedSize,
      verified: true,
    },
    receipt: {
      receiptId: "99999999-9999-4999-8999-999999999999",
      adapterKey: "protected-a3",
      proofHash: "8".repeat(64),
      resultHash: "9".repeat(64),
      verified: true,
      createdAt: JOB_LIST_ITEM.updatedAt,
    },
    delivery: {
      resultHash: "9".repeat(64),
      result: { summary: "Verified bounded delivery" },
      terminalAt: JOB_LIST_ITEM.updatedAt,
    },
    financial: {
      settlement: {
        amountAtomic: "1000",
        asset: "USDC_ATOMIC",
        createdAt: JOB_LIST_ITEM.updatedAt,
      },
      refund: null,
    },
    errorCode: null,
  },
} as const;

interface ApiMockOptions {
  submissionReplayed?: boolean;
  jobList?: readonly unknown[];
  jobDetail?: unknown;
  onJobSubmit?: () => void;
  onCancel?: () => void;
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installApiMocks(page: Page, options: ApiMockOptions = {}): Promise<void> {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/kernel/agents") {
      if (request.method() === "POST") {
        await fulfillJson(route, { agent: OWNER_AGENT }, 201);
        return;
      }
      await fulfillJson(route, { agents: [OWNER_AGENT, AVAILABLE_AGENT] });
      return;
    }
    if (path === "/api/kernel/jobs") {
      if (request.method() === "POST") {
        options.onJobSubmit?.();
        await fulfillJson(route, {
          job: {
            quoteId: "66666666-6666-4666-8666-666666666666",
            intentId: "77777777-7777-4777-8777-777777777777",
            orderId: "88888888-8888-4888-8888-888888888888",
            jobId: JOB_ID,
            effectId: EFFECT_ID,
            state: "QUEUED",
            version: 0,
            amountAtomic: "1000",
            asset: "USDC_ATOMIC",
            replayed: options.submissionReplayed ?? false,
          },
        }, 201);
        return;
      }
      await fulfillJson(route, url.searchParams.has("jobId")
        ? { job: options.jobDetail ?? JOB_DETAIL }
        : { jobs: options.jobList ?? [JOB_LIST_ITEM] });
      return;
    }
    if (path.endsWith("/cancel")) {
      options.onCancel?.();
      await fulfillJson(route, { job: JOB_LIST_ITEM });
      return;
    }
    if (path === "/api/swarm/health") {
      await fulfillJson(route, { agents: [], summary: { online: 0, total: 0 } });
      return;
    }
    if (path === "/api/marketplace/earnings") {
      await fulfillJson(route, { agents: {} });
      return;
    }
    if (path.includes("/api/marketplace") || path.includes("/api/cycle")) {
      await fulfillJson(route, path.includes("history") ? [] : { agents: [] });
      return;
    }
    await fulfillJson(route, { error: "Not configured in browser fixture" }, 503);
  });
}

test.beforeEach(async ({ page }) => {
  await installApiMocks(page);
});

test("preserves the product shell without horizontal overflow", async ({ page }) => {
  const widths = [390, 768, 1024, 1280, 1440];
  const routes = ["/", "/marketplace", "/dashboard", "/infrastructure"];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of routes) {
      await page.goto(path);
      await expect(page.locator("main, body").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} overflows at ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});

test("supports keyboard dialog flow and immutable publication copy", async ({ page }) => {
  await page.goto("/marketplace");
  const publishButton = page.getByRole("button", { name: /Publish agent/ });
  await publishButton.click();
  const dialog = page.getByRole("dialog", { name: "Publish a protected agent" });
  await expect(dialog).toBeVisible();
  await page.getByLabel("Agent name").fill("Manual Evidence Agent");
  await page.getByLabel("What should this agent do?").fill("Analyze bounded evidence without inventing execution claims.");
  await page.getByRole("button", { name: "Write instructions manually" }).click();
  await expect(dialog).toContainText("Manual draft");
  await page.getByLabel("Instructions").fill("Inspect the supplied evidence, state uncertainty, and return a concise result.");
  await page.getByRole("button", { name: "Publish immutable version" }).click();
  await expect(dialog).toContainText("Immutable version 1 is published");
  await expect(dialog).not.toContainText(/deployed|minted|sealed/i);
  await page.getByRole("button", { name: "Close dialog" }).click();

  await publishButton.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(publishButton).toBeFocused();
});

test("submits one job and fails closed when receipt and storage verification are absent", async ({ page }) => {
  await page.goto("/marketplace");
  await page.getByRole("button", { name: "Submit protected job" }).nth(1).click();
  const dialog = page.getByRole("dialog", { name: `Run ${AVAILABLE_AGENT.name}` });
  await page.getByLabel("Task prompt").fill("Assess this evidence boundary.");
  await dialog.getByRole("button", { name: "Submit protected job" }).click();
  const submittedDialog = page.getByRole("dialog", { name: "Protected job submitted" });
  await expect(submittedDialog).toContainText("Job accepted");
  await expect(submittedDialog).not.toContainText(/sealed|deployed|minted/i);

  await page.goto(`/dashboard/compute/${JOB_ID}`);
  await expect(page.getByRole("heading", { name: /Risk Boundary Agent/ })).toBeVisible();
  const receiptSection = page.getByRole("region", { name: "Canonical receipt and delivery" });
  await expect(receiptSection).toContainText("Failed");
  await expect(receiptSection.getByText("No canonical verified receipt is available.")).toBeVisible();
  await expect(page.getByText(/^Refunded 1000 USDC_ATOMIC at/)).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/sealed execution|deployed agent|minted agent/i);
});

test("shows verified delivery only with matching receipt and storage evidence", async ({ page }) => {
  await page.unroute("**/api/**");
  await installApiMocks(page, {
    jobList: [VERIFIED_JOB_LIST_ITEM],
    jobDetail: VERIFIED_JOB_DETAIL,
  });
  await page.goto(`/dashboard/compute/${JOB_ID}`);

  const receiptSection = page.getByRole("region", { name: "Canonical receipt and delivery" });
  await expect(receiptSection).toContainText("Verified");
  await expect(receiptSection).toContainText("Verified bounded delivery");
  await expect(page.getByRole("region", { name: "Financial evidence" })).toContainText(
    "Settled 1000 USDC_ATOMIC",
  );
  await expect(page.locator("body")).not.toContainText(/deployed agent|minted agent|sealed execution/i);
});

test("renders an idempotent replay as the original job without a second submission", async ({ page }) => {
  let submissions = 0;
  await page.unroute("**/api/**");
  await installApiMocks(page, {
    submissionReplayed: true,
    onJobSubmit: () => {
      submissions += 1;
    },
  });
  await page.goto("/marketplace");
  await page.getByRole("button", { name: "Submit protected job" }).nth(1).click();
  const dialog = page.getByRole("dialog", { name: `Run ${AVAILABLE_AGENT.name}` });
  await page.getByLabel("Task prompt").fill("Replay this bounded request safely.");
  await dialog.getByRole("button", { name: "Submit protected job" }).click();

  await expect(page.getByRole("dialog", { name: "Protected job submitted" })).toContainText(
    "Existing job returned safely",
  );
  expect(submissions).toBe(1);
});

test("supports canceling an active protected job", async ({ page }) => {
  let cancellations = 0;
  const queuedJob = {
    ...JOB_LIST_ITEM,
    state: "QUEUED",
    lastErrorCode: null,
    financialOutcome: null,
    evidence: {
      owner: "verified",
      version: "verified",
      ens: "pending",
      compute: "pending",
      storage: "pending",
      receipt: "pending",
    },
  } as const;
  await page.unroute("**/api/**");
  await installApiMocks(page, {
    jobList: [queuedJob],
    onCancel: () => {
      cancellations += 1;
    },
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Cancel job" }).click();
  await expect.poll(() => cancellations).toBe(1);
});

test("remains operable at 200 percent zoom", async ({ page }) => {
  // Browser zoom reduces the CSS viewport. A 1280px window at 200% exposes
  // 640 CSS pixels and activates the same responsive breakpoints as users see.
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto("/marketplace");
  await expect(page.getByRole("heading", { name: "Protected agent registry" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Publish agent/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("honors reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page.locator(".fade-in-up").first().evaluate((element) =>
    getComputedStyle(element).animationDuration,
  );
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.00001);
});
