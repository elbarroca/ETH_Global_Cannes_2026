import dotenv from "dotenv";
dotenv.config();

import {
  TokenCreateTransaction,
  CustomFractionalFee,
  TokenSupplyType,
  TokenType,
} from "@hashgraph/sdk";
import { getHederaClient, getOperatorKey, getOperatorId } from "../src/config/hedera.js";

async function main(): Promise<void> {
  console.log("Creating HTS fund token (VMFS)...");

  const client = getHederaClient();
  const operatorKey = getOperatorKey();
  const operatorId = getOperatorId();

  const tx = await new TokenCreateTransaction()
    .setTokenName("VaultMind Fund Share")
    .setTokenSymbol("VMFS")
    .setDecimals(2)
    .setInitialSupply(0)
    .setTreasuryAccountId(operatorId)
    .setTokenType(TokenType.FungibleCommon)
    .setSupplyType(TokenSupplyType.Infinite)
    .setAdminKey(operatorKey.publicKey)
    .setSupplyKey(operatorKey.publicKey)
    .setFreezeKey(operatorKey.publicKey)
    .setKycKey(operatorKey.publicKey)
    .setFeeScheduleKey(operatorKey.publicKey)
    .setFreezeDefault(false)
    .setCustomFees([
      new CustomFractionalFee()
        .setNumerator(1)
        .setDenominator(100)
        .setFeeCollectorAccountId(operatorId),
    ])
    .freezeWith(client)
    .sign(operatorKey);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const tokenId = receipt.tokenId;

  console.log(`Token created: ${tokenId}`);
  console.log(`Paste into .env: HTS_FUND_TOKEN_ID=${tokenId}`);
  console.log(`View: https://hashscan.io/testnet/token/${tokenId}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
