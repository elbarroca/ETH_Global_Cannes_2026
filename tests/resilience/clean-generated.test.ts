import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { cleanGenerated } from "../../scripts/clean-generated";

test("generated cleanup removes only known runtime outputs", async () => {
  const root = await mkdtemp(join(tmpdir(), "alphadawg-clean-"));
  try {
    await mkdir(join(root, ".next", "cache"), { recursive: true });
    await mkdir(join(root, "coverage"), { recursive: true });
    await writeFile(join(root, ".next", "cache", "entry"), "generated");
    await writeFile(join(root, "coverage", "result"), "generated");
    await writeFile(join(root, "tsconfig.tsbuildinfo"), "generated");
    await writeFile(join(root, "keep.txt"), "keep");

    const removed = await cleanGenerated(root);
    assert.ok(removed.includes(".next"));
    assert.ok(removed.includes("coverage"));
    assert.ok(removed.includes("tsconfig.tsbuildinfo"));
    assert.equal(await readFile(join(root, "keep.txt"), "utf8"), "keep");
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
