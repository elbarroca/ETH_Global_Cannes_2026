import postgres from "postgres";
import {
  isLoopbackDatabaseUrl,
  requireDatabaseUrl,
  requireEnsPublicationDatabaseIdentity,
  withoutPrismaPoolParameters,
} from "./env";

// Vercel serverless functions use Neon's pooled endpoint. DIRECT_URL is reserved
// for Prisma migrations. prepare:false keeps runtime queries pooler-compatible.

let sql: ReturnType<typeof postgres> | null = null;
let ensPublicationSql: Promise<ReturnType<typeof postgres>> | null = null;

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

export async function verifyEnsPublicationDatabaseClient(
  client: ReturnType<typeof postgres>,
  expectedUsername: string,
): Promise<void> {
  const rows = await client<{
    current_user: string;
    session_user: string;
    rolsuper: boolean;
    rolinherit: boolean;
    rolcreaterole: boolean;
    rolcreatedb: boolean;
    rolcanlogin: boolean;
    rolreplication: boolean;
    rolbypassrls: boolean;
    runtime_memberships: number;
    parent_memberships: number;
    owns_database: boolean;
    owns_public_schema: boolean;
    owns_authority_relation: boolean;
    authority_table_privilege: boolean;
    public_create: boolean;
    admission_execute: boolean;
  }[]>`
    SELECT
      current_user::text,
      session_user::text,
      role.rolsuper,
      role.rolinherit,
      role.rolcreaterole,
      role.rolcreatedb,
      role.rolcanlogin,
      role.rolreplication,
      role.rolbypassrls,
      (SELECT count(*)::int
       FROM pg_catalog.pg_auth_members membership
       JOIN pg_catalog.pg_roles parent ON parent.oid = membership.roleid
       WHERE membership.member = role.oid AND parent.rolname = 'alphadawg_runtime'
      ) AS runtime_memberships,
      (SELECT count(*)::int
       FROM pg_catalog.pg_auth_members membership
       WHERE membership.member = role.oid
      ) AS parent_memberships,
      EXISTS (
        SELECT 1 FROM pg_catalog.pg_database database
        WHERE database.datname = current_database() AND database.datdba = role.oid
      ) AS owns_database,
      EXISTS (
        SELECT 1 FROM pg_catalog.pg_namespace namespace
        WHERE namespace.nspname = 'public' AND namespace.nspowner = role.oid
      ) AS owns_public_schema,
      EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class relation
        JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relname IN (
            'ens_publication_decisions',
            'ens_publication_authority_policies',
            'ens_publication_authority_releases'
          )
          AND relation.relowner = role.oid
      ) AS owns_authority_relation,
      EXISTS (
        SELECT 1
        FROM unnest(ARRAY[
          'public.ens_publication_decisions',
          'public.ens_publication_authority_policies',
          'public.ens_publication_authority_releases'
        ]) relation_name
        WHERE pg_catalog.has_table_privilege(
          current_user,
          relation_name,
          'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
        )
      ) AS authority_table_privilege,
      pg_catalog.has_schema_privilege(current_user, 'public', 'CREATE') AS public_create,
      pg_catalog.has_function_privilege(
        current_user,
        'public.admit_ens_publication_decision(uuid,jsonb,numeric,timestamptz,text,text)',
        'EXECUTE'
      ) AS admission_execute
    FROM pg_catalog.pg_roles role
    WHERE role.rolname = current_user
  `;
  const row = rows[0];
  if (
    !row || row.current_user !== expectedUsername || row.session_user !== expectedUsername ||
    row.rolsuper || !row.rolinherit || row.rolcreaterole || row.rolcreatedb ||
    !row.rolcanlogin || row.rolreplication || row.rolbypassrls ||
    row.runtime_memberships !== 1 || row.parent_memberships !== 1 ||
    row.owns_database || row.owns_public_schema || row.owns_authority_relation ||
    row.authority_table_privilege || row.public_create || !row.admission_execute
  ) {
    throw new Error("ENS_PUBLICATION_DATABASE_ROLE_INVALID");
  }
}

export function getEnsPublicationDb(): Promise<ReturnType<typeof postgres>> {
  if (!ensPublicationSql) {
    ensPublicationSql = (async () => {
      let client: ReturnType<typeof postgres> | null = null;
      try {
        const identity = requireEnsPublicationDatabaseIdentity();
        client = connect(withoutPrismaPoolParameters(identity.url));
        await verifyEnsPublicationDatabaseClient(client, identity.username);
        return client;
      } catch {
        await client?.end({ timeout: 1 }).catch(() => undefined);
        ensPublicationSql = null;
        throw new Error("ENS_PUBLICATION_DATABASE_NOT_ISOLATED");
      }
    })();
  }
  return ensPublicationSql;
}
