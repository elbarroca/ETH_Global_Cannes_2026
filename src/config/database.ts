import postgres from "postgres";
import {
  isLoopbackDatabaseUrl,
  requireDatabaseUrl,
  requireEnsPublicationDatabaseUrl,
  withoutPrismaPoolParameters,
} from "./env";

// Vercel serverless functions use Neon's pooled endpoint. DIRECT_URL is reserved
// for Prisma migrations. prepare:false keeps runtime queries pooler-compatible.

let sql: ReturnType<typeof postgres> | null = null;
let ensPublicationSql: ReturnType<typeof postgres> | null = null;

function connect(url: string): ReturnType<typeof postgres> {
  return postgres(url, {
    ssl: isLoopbackDatabaseUrl(url) ? false : "require",
    max: 1,
    idle_timeout: 20,
    prepare: false,
  });
}

export function getDb(): ReturnType<typeof postgres> {
  if (!sql) {
    const url = withoutPrismaPoolParameters(requireDatabaseUrl());
    sql = connect(url);
  }
  return sql;
}

export function getEnsPublicationDb(): ReturnType<typeof postgres> {
  if (!ensPublicationSql) {
    const url = withoutPrismaPoolParameters(requireEnsPublicationDatabaseUrl());
    ensPublicationSql = connect(url);
  }
  return ensPublicationSql;
}
