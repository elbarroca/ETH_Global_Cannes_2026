import postgres from "postgres";

let sql: ReturnType<typeof postgres> | null = null;

export function getDb(): ReturnType<typeof postgres> {
  if (!sql) {
    const url = process.env.DIRECT_URL;
    if (!url) throw new Error("DIRECT_URL not set in .env");
    sql = postgres(url, { ssl: "require", max: 2, idle_timeout: 30 });
  }
  return sql;
}
