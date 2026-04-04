import dotenv from "dotenv";
dotenv.config();

import {
  PrivateKey,
  AccountCreateTransaction,
  TransferTransaction,
  Hbar,
  Client,
  AccountId,
} from "@hashgraph/sdk";

/**
 * Creates a new Hedera testnet account with an ECDSA secp256k1 key.
 * Required because Hedera EVM (Smart Contracts Service) only works with ECDSA keys,
 * while the existing operator uses ED25519.
 *
 * Funds the new account with 50 HBAR from the existing operator.
 */
async function main(): Promise<void> {
  const operatorId = process.env.OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;

  if (!operatorId || !operatorKey) {
    console.error("ERROR: Set OPERATOR_ID and OPERATOR_KEY in .env");
    process.exit(1);
  }

  const client = Client.forTestnet().setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromStringED25519(operatorKey),
  );

  // Generate ECDSA key pair
  const ecdsaKey = PrivateKey.generateECDSA();
  const publicKey = ecdsaKey.publicKey;

  console.log("Generated ECDSA key pair");
  console.log("Public key:", publicKey.toStringRaw());

  // Create account with 50 HBAR initial balance
  const tx = await new AccountCreateTransaction()
    .setKey(publicKey)
    .setInitialBalance(new Hbar(50))
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const newAccountId = receipt.accountId!;

  // Register EVM address alias by transferring HBAR to the EVM address
  // This is required for the Hedera JSON-RPC relay to recognize the account
  const evmAddress = publicKey.toEvmAddress();
  console.log("EVM address:", evmAddress);
  console.log("Registering EVM alias via HBAR transfer...");

  const aliasTx = await new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(operatorId), new Hbar(-1))
    .addHbarTransfer(AccountId.fromEvmAddress(0, 0, evmAddress), new Hbar(1))
    .execute(client);
  await aliasTx.getReceipt(client);
  console.log("EVM alias registered.");

  console.log("\n════════════════════════════════════════");
  console.log("New Hedera EVM Account Created!");
  console.log(`Account ID: ${newAccountId.toString()}`);
  console.log(`EVM Address: 0x${evmAddress}`);
  console.log(`\nAdd to .env:`);
  console.log(`HEDERA_EVM_ACCOUNT_ID=${newAccountId.toString()}`);
  console.log(`HEDERA_EVM_PRIVATE_KEY=0x${ecdsaKey.toStringRaw()}`);
  console.log("════════════════════════════════════════");
  console.log(`\nView on Hashscan: https://hashscan.io/testnet/account/${newAccountId.toString()}`);

  client.close();
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
