-- W8 preflights every immutable publication decision before this migration is
-- marked complete. It never rewrites evidence. Deployments upgrading from W6
-- or earlier must keep application admission stopped across the separate W7
-- and W8 migrations and enable readiness only after W8 commits successfully.

-- One DO statement is one PostgreSQL transaction. Keeping every lock, ACL
-- change, preflight, and readiness marker inside it prevents Prisma from
-- masking the bounded refusal with follow-on commands in an aborted explicit
-- transaction.
DO $upgrade$
BEGIN
  EXECUTE 'LOCK TABLE public.ens_publication_decisions IN ACCESS EXCLUSIVE MODE';
  PERFORM pg_catalog.set_config('TimeZone', 'UTC', TRUE);
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.admit_ens_publication_decision(
    UUID, JSONB, NUMERIC, TIMESTAMPTZ, TEXT, TEXT
  ) FROM alphadawg_runtime';

  IF EXISTS (
    SELECT 1
    FROM public.ens_publication_decisions d
    CROSS JOIN LATERAL (
      SELECT d.block_number::numeric(20,0) AS normalized_block_number
    ) normalized
    CROSS JOIN LATERAL (
      SELECT normalized.normalized_block_number::text AS normalized_block_number_text
    ) canonical_block
    CROSS JOIN LATERAL (
      SELECT pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          pg_catalog.jsonb_build_object(
            'schemaVersion', 3,
            'agentVersionId', d.agent_version_id::text,
            'bindingHash', d.binding_hash,
            'releaseSha', d.release_sha,
            'decision', d.decision,
            'errorCode', d.error_code,
            'recordHash', d.record_hash,
            'blockNumber', canonical_block.normalized_block_number_text,
            'blockTimestampUtc', CASE WHEN d.block_timestamp IS NULL THEN NULL ELSE pg_catalog.to_char(
              d.block_timestamp AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            ) END,
            'freshUntilUtc', CASE WHEN d.fresh_until IS NULL THEN NULL ELSE pg_catalog.to_char(
              d.fresh_until AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
            ) END,
            'transactionHash', lower(d.transaction_hash)
          )::text,
          'UTF8'
        )),
        'hex'
      ) AS expected_decision_key
    ) canonical
    WHERE d.block_number IS DISTINCT FROM normalized.normalized_block_number
      OR d.block_number IS NOT NULL AND (
        d.block_number::text IN ('NaN', 'Infinity', '-Infinity')
        OR d.block_number < 0
        OR d.block_number > 99999999999999999999
        OR d.block_number <> pg_catalog.trunc(d.block_number)
      )
      OR d.decision_key IS DISTINCT FROM canonical.expected_decision_key
  ) THEN
    RAISE EXCEPTION 'ENS publication W8 preflight found noncanonical durable decision evidence; explicit owner adjudication required'
      USING ERRCODE = '23514';
  END IF;

  EXECUTE 'COMMENT ON FUNCTION public.admit_ens_publication_decision(
    UUID, JSONB, NUMERIC, TIMESTAMPTZ, TEXT, TEXT
  ) IS ''alphadawg:a4-publication-upgrade-preflight:v1''';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.admit_ens_publication_decision(
    UUID, JSONB, NUMERIC, TIMESTAMPTZ, TEXT, TEXT
  ) TO alphadawg_runtime';
END;
$upgrade$;
