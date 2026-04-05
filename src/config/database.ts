import postgres from "postgres";

// Vercel serverless functions must hit the Supabase PgBouncer pooler (:6543),
// not the direct connection (:5432). Direct connections get exhausted fast under
// fan-out invocations. DIRECT_URL is reserved for Prisma migrations only.
// prepare:false is required by PgBouncer transaction mode.

let sql: ReturnType<typeof postgres> | null = null;

export function getDb(): ReturnType<typeof postgres> {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set in .env");
    sql = postgres(url, { ssl: "require", max: 1, idle_timeout: 20, prepare: false });
  }
  return sql;
}
