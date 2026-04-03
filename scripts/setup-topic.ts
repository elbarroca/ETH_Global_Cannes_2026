import dotenv from "dotenv";
dotenv.config();

import {
  TopicCreateTransaction,
} from "@hashgraph/sdk";
import { getHederaClient, getOperatorKey } from "../src/config/hedera.js";

async function main(): Promise<void> {
  console.log("Creating private HCS audit topic...");

  const client = getHederaClient();
  const operatorKey = getOperatorKey();

  const tx = await new TopicCreateTransaction()
    .setSubmitKey(operatorKey.publicKey)
    .setAdminKey(operatorKey.publicKey)
    .setTopicMemo("VaultMind Audit Trail")
    .freezeWith(client)
    .sign(operatorKey);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const topicId = receipt.topicId;

  console.log(`Topic created: ${topicId}`);
  console.log(`Paste into .env: HCS_AUDIT_TOPIC_ID=${topicId}`);
  console.log(`View: https://hashscan.io/testnet/topic/${topicId}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
