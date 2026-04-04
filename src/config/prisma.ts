import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      datasources: {
        db: {
          url: `${process.env.DATABASE_URL ?? ""}&connection_limit=3&pool_timeout=30`,
        },
      },
    });
  }
  return prisma;
}
