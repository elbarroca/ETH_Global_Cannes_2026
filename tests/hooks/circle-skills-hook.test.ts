import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const hook = join(process.cwd(), ".codex/hooks/circle-skills-context.sh");

function runHook(event: string, prompt = "", skillsDir?: string): string {
  const result = spawnSync(hook, [event], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      CIRCLE_API_KEY: "",
      CIRCLE_ENTITY_SECRET: "",
      CIRCLE_WALLET_SET_ID: "",
      DATABASE_URL: "",
      ...(skillsDir ? { CIRCLE_SKILLS_DIR: skillsDir } : {}),
    },
    input: JSON.stringify({ prompt }),
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test("Circle hook validates skills and ignores unrelated prompts", () => {
  assert.equal(runHook("UserPromptSubmit", "Update the landing page copy"), "");

  const output = JSON.parse(
    runHook("UserPromptSubmit", "Fund the Circle agent wallet"),
  ) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
  assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.match(output.hookSpecificOutput.additionalContext, /All 17 project Circle skills validated/);
  assert.match(output.hookSpecificOutput.additionalContext, /Local Circle\/UI E2E is not ready/);
  assert.match(output.hookSpecificOutput.additionalContext, /proxyWallet\.address/);
  assert.match(output.hookSpecificOutput.additionalContext, /BLOCKED_NO_UI_AGENT_WALLET/);
  assert.match(output.hookSpecificOutput.additionalContext, /Sepolia assets stay on Sepolia/);
});

test("Circle hook fails closed when project skills are missing", () => {
  const emptySkills = mkdtempSync(join(tmpdir(), "circle-skills-"));
  try {
    const output = JSON.parse(runHook("SessionStart", "", emptySkills)) as {
      hookSpecificOutput: { additionalContext: string };
    };
    assert.match(output.hookSpecificOutput.additionalContext, /Missing project Circle skills/);
  } finally {
    rmSync(emptySkills, { recursive: true, force: true });
  }
});
