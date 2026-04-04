import { ethers } from "ethers";
import { encrypt, decrypt } from "./crypto";

export function generateProxyWallet(): { address: string; encryptedKey: string } {
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    encryptedKey: encrypt(wallet.privateKey),
  };
}

export function loadProxyWallet(encryptedKey: string, provider: ethers.JsonRpcProvider): ethers.Wallet {
  const privateKey = decrypt(encryptedKey);
  return new ethers.Wallet(privateKey, provider);
}
