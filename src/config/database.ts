import postgres from "postgres";
import { isLoopbackDatabaseUrl, requireDatabaseUrl, withoutPrismaPoolParameters } from "./env";

// Vercel serverless functions must hit the Supabase PgBouncer pooler (:6543),
// not the direct connection (:5432). Direct connections get exhausted fast under
// fan-out invocations. DIRECT_URL is reserved for Prisma migrations only.
// prepare:false is required by PgBouncer transaction mode.

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
