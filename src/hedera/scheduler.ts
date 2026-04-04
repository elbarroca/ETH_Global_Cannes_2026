import {
  ScheduleCreateTransaction,
  ScheduleSignTransaction,
  TopicMessageSubmitTransaction,
  TopicId,
  Timestamp,
} from "@hashgraph/sdk";
import { getHederaClient, getOperatorKey, getOperatorId } from "../config/hedera";

export async function scheduleNextHeartbeat(
  delaySec = 300,
): Promise<{ scheduleId: string }> {
  const client = getHederaClient();
  const operatorKey = getOperatorKey();
  const topicId = process.env.HCS_AUDIT_TOPIC_ID;

  if (!topicId) {
    throw new Error("HCS_AUDIT_TOPIC_ID not set in .env");
  }

  const heartbeatPayload = JSON.stringify({
    type: "heartbeat",
    t: new Date().toISOString(),
    scheduledFor: new Date(Date.now() + delaySec * 1000).toISOString(),
  });

  // Inner transaction: submit heartbeat message to HCS topic
  const innerTx = new TopicMessageSubmitTransaction()
    .setTopicId(TopicId.fromString(topicId))
    .setMessage(heartbeatPayload);

  // Wrap in ScheduleCreateTransaction — fires after delaySec
  const expirationTime = Timestamp.fromDate(
    new Date(Date.now() + delaySec * 1000),
  );

  try {
    const scheduleTx = await new ScheduleCreateTransaction()
      .setScheduledTransaction(innerTx)
      .setAdminKey(operatorKey.publicKey)
      .setPayerAccountId(getOperatorId())
      .setScheduleMemo("AlphaDawg heartbeat")
      .setExpirationTime(expirationTime)
      .setWaitForExpiry(true)
      .freezeWith(client)
      .sign(operatorKey);

    const response = await scheduleTx.execute(client);
    const receipt = await response.getReceipt(client);
    const scheduleId = receipt.scheduleId;

    if (!scheduleId) {
      throw new Error("ScheduleCreateTransaction returned no scheduleId");
    }

    // Sign with operator key for the inner TopicMessageSubmitTransaction
    // (HCS topic has a submit key — the scheduled tx needs this signature to execute)
    const signTx = await new ScheduleSignTransaction()
      .setScheduleId(scheduleId)
      .freezeWith(client)
      .sign(operatorKey);
    await signTx.execute(client);

    const id = scheduleId.toString();
    console.log(`[scheduler] Scheduled heartbeat: ${id} (fires in ${delaySec}s)`);
    console.log(`[scheduler] View: https://hashscan.io/testnet/schedule/${id}`);

    return { scheduleId: id };
  } catch (err) {
    throw new Error(`Scheduler failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
