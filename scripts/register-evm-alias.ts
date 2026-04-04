import dotenv from "dotenv";
dotenv.config();

import { Client, AccountId, PrivateKey, TransferTransaction, Hbar } from "@hashgraph/sdk";

async function main() {
  const client = Client.forTestnet().setOperator(
    AccountId.fromString(process.env.OPERATOR_ID!),
    PrivateKey.fromStringED25519(process.env.OPERATOR_KEY!),
  );

  const evmAddr = "0xee02a15F871B8B3798F4931a9614225656C4C760";
  console.log("Registering EVM alias for:", evmAddr);

  const tx = await new TransferTransaction()
    .addHbarTransfer(AccountId.fromString(process.env.OPERATOR_ID!), new Hbar(-1))
    .addHbarTransfer(AccountId.fromEvmAddress(0, 0, evmAddr), new Hbar(1))
    .execute(client);

  await tx.getReceipt(client);
  console.log("EVM alias registered successfully!");

  // Wait for mirror node sync
  await new Promise((r) => setTimeout(r, 6000));

  // Verify via RPC
  const { ethers } = await import("ethers");
  const provider = new ethers.JsonRpcProvider("https://testnet.hashio.io/api");
  const balance = await provider.getBalance(evmAddr);
  console.log("RPC balance:", ethers.formatEther(balance), "HBAR");

  client.close();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
