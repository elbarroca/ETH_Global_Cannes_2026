import {
  TokenMintTransaction,
  TokenBurnTransaction,
  TokenGrantKycTransaction,
  TokenFreezeTransaction,
  TokenUnfreezeTransaction,
  AccountBalanceQuery,
  TokenId,
  AccountId,
} from "@hashgraph/sdk";
import { getHederaClient, getOperatorKey } from "../config/hedera.js";

const MIRROR_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

function getTokenId(): string {
  const id = process.env.HTS_FUND_TOKEN_ID;
  if (!id) throw new Error("HTS_FUND_TOKEN_ID not set in .env");
  return id;
}

export async function mintShares(amount: number): Promise<{ newTotalSupply: number }> {
  try {
    const client = getHederaClient();
    const tx = await new TokenMintTransaction()
      .setTokenId(TokenId.fromString(getTokenId()))
      .setAmount(amount)
      .freezeWith(client)
      .sign(getOperatorKey());

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);
    const newTotalSupply = receipt.totalSupply?.toNumber() ?? 0;

    console.log(`[HTS] Minted ${amount} shares → totalSupply=${newTotalSupply}`);
    return { newTotalSupply };
  } catch (err) {
    throw new Error(`HTS mintShares failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function burnShares(amount: number): Promise<{ newTotalSupply: number }> {
  try {
    const client = getHederaClient();
    const tx = await new TokenBurnTransaction()
      .setTokenId(TokenId.fromString(getTokenId()))
      .setAmount(amount)
      .freezeWith(client)
      .sign(getOperatorKey());

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);
    const newTotalSupply = receipt.totalSupply?.toNumber() ?? 0;

    console.log(`[HTS] Burned ${amount} shares → totalSupply=${newTotalSupply}`);
    return { newTotalSupply };
  } catch (err) {
    throw new Error(`HTS burnShares failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function grantKyc(accountId: string): Promise<void> {
  try {
    const client = getHederaClient();
    const tx = await new TokenGrantKycTransaction()
      .setTokenId(TokenId.fromString(getTokenId()))
      .setAccountId(AccountId.fromString(accountId))
      .freezeWith(client)
      .sign(getOperatorKey());

    await tx.execute(client);
    console.log(`[HTS] KYC granted for ${accountId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Ignore if KYC already granted
    if (msg.includes("TOKEN_HAS_NO_KYC_KEY") || msg.includes("ALREADY")) {
      console.log(`[HTS] KYC already granted for ${accountId}`);
      return;
    }
    throw new Error(`HTS grantKyc failed: ${msg}`);
  }
}

export async function freezeAccount(accountId: string): Promise<void> {
  try {
    const client = getHederaClient();
    const tx = await new TokenFreezeTransaction()
      .setTokenId(TokenId.fromString(getTokenId()))
      .setAccountId(AccountId.fromString(accountId))
      .freezeWith(client)
      .sign(getOperatorKey());

    await tx.execute(client);
    console.log(`[HTS] Account frozen: ${accountId}`);
  } catch (err) {
    throw new Error(`HTS freezeAccount failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function unfreezeAccount(accountId: string): Promise<void> {
  try {
    const client = getHederaClient();
    const tx = await new TokenUnfreezeTransaction()
      .setTokenId(TokenId.fromString(getTokenId()))
      .setAccountId(AccountId.fromString(accountId))
      .freezeWith(client)
      .sign(getOperatorKey());

    await tx.execute(client);
    console.log(`[HTS] Account unfrozen: ${accountId}`);
  } catch (err) {
    throw new Error(`HTS unfreezeAccount failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function getTokenInfo(): Promise<{
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  tokenId: string;
  customFees: unknown;
}> {
  try {
    const tokenId = getTokenId();
    const res = await fetch(`${MIRROR_BASE}/tokens/${tokenId}`);
    if (!res.ok) {
      throw new Error(`Mirror node returned ${res.status}`);
    }
    const data = (await res.json()) as {
      name: string;
      symbol: string;
      decimals: string;
      total_supply: string;
      token_id: string;
      custom_fees?: { fixed_fees?: unknown[]; fractional_fees?: unknown[] };
    };
    return {
      name: data.name,
      symbol: data.symbol,
      decimals: Number(data.decimals),
      totalSupply: data.total_supply,
      tokenId: data.token_id,
      customFees: data.custom_fees ?? null,
    };
  } catch (err) {
    throw new Error(`HTS getTokenInfo failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function getBalance(accountId: string): Promise<number> {
  try {
    const client = getHederaClient();
    const balance = await new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(accountId))
      .execute(client);

    return balance.tokens?.get(TokenId.fromString(getTokenId()))?.toNumber() ?? 0;
  } catch (err) {
    throw new Error(`HTS getBalance failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
