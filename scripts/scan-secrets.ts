import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface SecretPattern {
  label: string;
  expression: RegExp;
}

export interface SecretFinding {
  file: string;
  line: number;
  kind: string;
}

const SECRET_PATTERNS: readonly SecretPattern[] = [
  { label: "private-key", expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { label: "aws-access-key", expression: /\bAKIA[0-9A-Z]{16}\b/g },
  { label: "github-token", expression: /\bgh[pousr]_[0-9A-Za-z]{36,}\b/g },
  { label: "google-api-key", expression: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { label: "stripe-secret-key", expression: /\bsk_(?:live|test)_[0-9A-Za-z]{16,}\b/g },
  { label: "openai-secret-key", expression: /\bsk-proj-[0-9A-Za-z_-]{16,}\b/g },
];

export function findSecretFindings(file: string, text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const pattern of SECRET_PATTERNS) {
    pattern.expression.lastIndex = 0;
    for (const match of text.matchAll(pattern.expression)) {
      const line = text.slice(0, match.index).split("\n").length;
      findings.push({ file, line, kind: pattern.label });
    }
  }
  return findings;
}

export async function scanTrackedFiles(root = process.cwd()): Promise<SecretFinding[]> {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "buffer",
  });
  if (result.status !== 0) throw new Error("git ls-files failed");

  const files = result.stdout.toString("utf8").split("\0").filter(Boolean);
  const findings: SecretFinding[] = [];
  for (const file of files) {
    const contents = await readFile(resolve(root, file));
    if (contents.includes(0)) continue;
    findings.push(...findSecretFindings(file, contents.toString("utf8")));
  }
  return findings;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  scanTrackedFiles()
    .then((findings) => {
      if (findings.length === 0) {
        console.log("Secret scan passed: no high-confidence patterns in tracked files");
        return;
      }
      for (const finding of findings) {
        console.error(`${finding.file}:${finding.line} ${finding.kind}`);
      }
      process.exitCode = 1;
    })
    .catch((error: unknown) => {
      console.error(`Secret scan failed: ${error instanceof Error ? error.message : "unknown error"}`);
      process.exitCode = 1;
    });
}
