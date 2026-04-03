import {
  Client,
  AccountId,
  PrivateKey,
  Hbar,
} from "@hashgraph/sdk";

let clientInstance: Client | null = null;
let keyInstance: PrivateKey | null = null;
let idInstance: AccountId | null = null;

export function getOperatorId(): AccountId {
  if (!idInstance) {
    idInstance = AccountId.fromString(process.env.OPERATOR_ID!);
  }
  return idInstance;
}

export function getOperatorKey(): PrivateKey {
  if (!keyInstance) {
    keyInstance = PrivateKey.fromStringED25519(process.env.OPERATOR_KEY!);
  }
  return keyInstance;
}

export function getHederaClient(): Client {
  if (!clientInstance) {
    clientInstance = Client.forTestnet().setOperator(getOperatorId(), getOperatorKey());
    clientInstance.setDefaultMaxTransactionFee(new Hbar(5));
  }
  return clientInstance;
}
