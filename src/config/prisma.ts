import { PrismaClient } from "@prisma/client";

// Vercel serverless requires a very small connection footprint per lambda —
// each cold invocation gets its own Prisma instance. connection_limit=1 +
// pgbouncer=true is the Prisma-docs-recommended config for PgBouncer pooler
// URLs (Supabase :6543).

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      datasources: {
        db: {
          url: `${process.env.DATABASE_URL ?? ""}&connection_limit=1&pool_timeout=20&pgbouncer=true`,
        },
      },
    });
  }
  return prisma;
}
