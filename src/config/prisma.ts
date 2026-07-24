import { PrismaClient } from "@prisma/client";
import { requireDatabaseUrl, withPrismaPoolParameters } from "./env";

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
          url: withPrismaPoolParameters(requireDatabaseUrl()),
        },
      },
    });
  }
  return prisma;
}
