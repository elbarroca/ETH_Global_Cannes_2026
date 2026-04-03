import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import type { UserRecord } from "../types/index.js";

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../data");
const FILE_PATH = path.join(DATA_DIR, "users.json");

const users = new Map<string, UserRecord>();

export function loadStore(): void {
  users.clear();
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, "[]", "utf8");
    return;
  }
  try {
    const raw = fs.readFileSync(FILE_PATH, "utf8");
    const arr: UserRecord[] = JSON.parse(raw);
    for (const u of arr) {
      users.set(u.id, u);
    }
  } catch {
    console.warn("[user-store] Failed to parse users.json — starting fresh");
  }
}

function persist(): void {
  const arr = Array.from(users.values());
  fs.writeFileSync(FILE_PATH, JSON.stringify(arr, null, 2), "utf8");
}

export function createUser(
  walletAddress: string,
  proxyWallet: { address: string; encryptedKey: string },
): UserRecord {
  const now = new Date().toISOString();
  const user: UserRecord = {
    id: crypto.randomUUID(),
    walletAddress,
    proxyWallet,
    telegram: {
      chatId: null,
      username: null,
      verified: false,
      notifyPreference: "every_cycle",
    },
    agent: {
      active: false,
      riskProfile: "balanced",
      maxTradePercent: 10,
      lastCycleId: 0,
      lastCycleAt: null,
    },
    fund: {
      depositedUsdc: 0,
      htsShareBalance: 0,
      currentNav: 0,
    },
    createdAt: now,
    updatedAt: now,
  };
  users.set(user.id, user);
  persist();
  return user;
}

export function getUserById(id: string): UserRecord | undefined {
  return users.get(id);
}

export function getUserByWallet(walletAddress: string): UserRecord | undefined {
  const lower = walletAddress.toLowerCase();
  for (const u of users.values()) {
    if (u.walletAddress.toLowerCase() === lower) return u;
  }
  return undefined;
}

export function getUserByChatId(chatId: string): UserRecord | undefined {
  for (const u of users.values()) {
    if (u.telegram.chatId === chatId) return u;
  }
  return undefined;
}

export function getActiveUsers(): UserRecord[] {
  return Array.from(users.values()).filter((u) => u.agent.active);
}

interface UserPatch {
  telegram?: Partial<UserRecord["telegram"]>;
  agent?: Partial<UserRecord["agent"]>;
  fund?: Partial<UserRecord["fund"]>;
}

export function updateUser(id: string, patch: UserPatch): UserRecord {
  const existing = users.get(id);
  if (!existing) throw new Error(`User ${id} not found`);
  const updated: UserRecord = {
    ...existing,
    telegram: patch.telegram ? { ...existing.telegram, ...patch.telegram } : existing.telegram,
    agent: patch.agent ? { ...existing.agent, ...patch.agent } : existing.agent,
    fund: patch.fund ? { ...existing.fund, ...patch.fund } : existing.fund,
    updatedAt: new Date().toISOString(),
  };
  users.set(id, updated);
  persist();
  return updated;
}

export function getAllUsers(): UserRecord[] {
  return Array.from(users.values());
}
