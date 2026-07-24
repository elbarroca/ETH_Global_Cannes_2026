import postgres from "postgres";
import { isLoopbackDatabaseUrl, requireDatabaseUrl, withoutPrismaPoolParameters } from "./env";

// Vercel serverless functions use Neon's pooled endpoint. DIRECT_URL is reserved
// for Prisma migrations. prepare:false keeps runtime queries pooler-compatible.

let sql: ReturnType<typeof postgres> | null = null;

export function getDb(): ReturnType<typeof postgres> {
  if (!sql) {
    const url = withoutPrismaPoolParameters(requireDatabaseUrl());
    sql = postgres(url, {
      ssl: isLoopbackDatabaseUrl(url) ? false : "require",
      max: 1,
      idle_timeout: 20,
      prepare: false,
    });
  }
  return sql;
}
