import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { canonicalJson, domainHash } from "../../src/kernel/canonical";
import { deriveA3VerifiedJournalPayload } from "../../src/worker/store";

test("verified A3 recovery retains LangChain usage, cost, signature, and readback evidence", () => {
  const effectId = "a".repeat(64);
  const provider = "0x3333333333333333333333333333333333333333";
  const signerAddress = "0x4444444444444444444444444444444444444444";
  const signature = `0x${"5".repeat(130)}`;
  const requestHash = "6".repeat(64);
  const content = "verified recovery output";
  const responseHash = createHash("sha256").update(content).digest("hex");
  const root = `0x${"7".repeat(64)}`;
  const computeReceiptBytes = canonicalJson({
    contentHash: responseHash,
    effectId,
    model: "fixture-model",
    provider,
    requestHash,
    requestId: "request-1",
    schemaVersion: 1,
    signature,
    signerAddress,
  });
  const storageReceiptBytes = canonicalJson({
    digest: responseHash,
    effectId,
    root,
    schemaVersion: 1,
    size: Buffer.byteLength(content, "utf8"),
  });
  const proofHash = domainHash("a3-proof", {
    computeReceiptDigest: createHash("sha256").update(computeReceiptBytes).digest("hex"),
    effectId,
    responseHash,
    storageDigest: responseHash,
    storageReceiptDigest: createHash("sha256").update(storageReceiptBytes).digest("hex"),
    storageRoot: root,
    storageSize: Buffer.byteLength(content, "utf8"),
  });
  const result = {
    compute: {
      actualCostAtomic: "56",
      completionTokens: 12,
      inputTokens: 10,
      teeSignature: signature,
      totalTokens: 22,
    },
    content,
    effectId,
    model: "fixture-model",
    provider,
    readback: {
      digest: responseHash,
      root,
      size: Buffer.byteLength(content, "utf8"),
      verified: true,
    },
    requestId: "request-1",
    storage: {
      digest: responseHash,
      receiptDigest: createHash("sha256").update(storageReceiptBytes).digest("hex"),
      root,
      size: Buffer.byteLength(content, "utf8"),
    },
  };
  assert.deepEqual(deriveA3VerifiedJournalPayload({
    actual_cost_atomic: "56",
    completion_tokens: 12,
    compute_receipt_bytes: computeReceiptBytes,
    compute_receipt_digest: createHash("sha256").update(computeReceiptBytes).digest("hex"),
    effect_id: effectId,
    expected_digest: responseHash,
    expected_root: root,
    expected_size: Buffer.byteLength(content, "utf8"),
    job_id: "00000000-0000-4000-8000-000000000001",
    model: "fixture-model",
    prompt_tokens: 10,
    proof_hash: proofHash,
    provider,
    readback_digest: responseHash,
    readback_root: root,
    readback_size: Buffer.byteLength(content, "utf8"),
    request_hash: requestHash,
    request_id: "request-1",
    request_signature: signature,
    response_content: content,
    response_hash: responseHash,
    result,
    signer_address: signerAddress,
    stage: "READBACK_VERIFIED",
    storage_receipt_bytes: storageReceiptBytes,
    storage_receipt_digest: createHash("sha256").update(storageReceiptBytes).digest("hex"),
    total_tokens: 22,
  }, true), { ok: true, proofHash, result });
});
