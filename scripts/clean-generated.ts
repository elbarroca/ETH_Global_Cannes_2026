import { readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GENERATED_DIRECTORIES = [".next", "coverage", "out", "build"] as const;

export async function cleanGenerated(root = process.cwd()): Promise<string[]> {
  const absoluteRoot = resolve(root);
  const removed: string[] = [];

  for (const relativePath of GENERATED_DIRECTORIES) {
    await rm(resolve(absoluteRoot, relativePath), { force: true, recursive: true });
    removed.push(relativePath);
  }

  const entries = await readdir(absoluteRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".tsbuildinfo")) continue;
    await rm(resolve(absoluteRoot, entry.name), { force: true });
    removed.push(entry.name);
  }

  return removed;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  cleanGenerated()
    .then((removed) => console.log(`Cleaned generated paths: ${removed.join(", ")}`))
    .catch((error: unknown) => {
      console.error(`Generated cleanup failed: ${error instanceof Error ? error.message : "unknown error"}`);
      process.exitCode = 1;
    });
}
