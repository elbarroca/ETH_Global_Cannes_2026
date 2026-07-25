-- Database-owned admission boundary for ENS publication decisions. The
-- application role may resolve evidence and request admission, but it cannot
-- choose a release identity, convergence key, durable timestamps, or write the
-- authority tables directly.

DO $$
DECLARE
  runtime_role pg_roles%ROWTYPE;
BEGIN
  SELECT * INTO runtime_role FROM pg_roles WHERE rolname = 'alphadawg_runtime';
  IF NOT FOUND THEN
    CREATE ROLE alphadawg_runtime
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT;
  ELSIF runtime_role.rolcanlogin
    OR runtime_role.rolsuper
    OR runtime_role.rolcreatedb
    OR runtime_role.rolcreaterole
    OR runtime_role.rolreplication
    OR runtime_role.rolbypassrls
    OR NOT runtime_role.rolinherit
  THEN
    RAISE EXCEPTION 'alphadawg_runtime exists with unsafe attributes' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- The inherited W4 trigger resolves its lineage tables by name. Make that
-- resolution deterministic without leaving any untrusted CREATE-capable schema
-- in its path.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER FUNCTION public.enforce_ens_publication_decision()
  SET search_path = pg_catalog, public, pg_temp;

CREATE TABLE "ens_publication_authority_releases" (
  "release_sha" TEXT NOT NULL,
  "not_before" TIMESTAMPTZ(6) NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "admitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT "ens_publication_authority_releases_pkey" PRIMARY KEY ("release_sha"),
  CONSTRAINT "ens_publication_authority_release_sha_check" CHECK (
    "release_sha" ~ '^[0-9a-f]{40}$'
  ),
  CONSTRAINT "ens_publication_authority_release_window_check" CHECK (
    "not_before" < "expires_at" AND "admitted_at" <= "expires_at"
  )
);

CREATE OR REPLACE FUNCTION enforce_ens_publication_authority_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'ENS publication authority releases are append-only' USING ERRCODE = '23514';
  END IF;
  NEW."admitted_at" := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ens_publication_authority_releases_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "ens_publication_authority_releases"
FOR EACH ROW EXECUTE FUNCTION enforce_ens_publication_authority_release();

CREATE TRIGGER "ens_publication_authority_releases_no_truncate"
BEFORE TRUNCATE ON "ens_publication_authority_releases"
FOR EACH STATEMENT EXECUTE FUNCTION enforce_ens_publication_authority_release();

CREATE OR REPLACE FUNCTION admit_ens_publication_decision(
  p_agent_version_id UUID,
  p_binding JSONB,
  p_record JSONB,
  p_block_number NUMERIC,
  p_block_timestamp TIMESTAMPTZ,
  p_transaction_hash TEXT,
  p_error_code TEXT,
  p_test_observed_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  decision_id UUID,
  decision TEXT,
  error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  authority_now TIMESTAMPTZ := clock_timestamp();
  caller_is_superuser BOOLEAN := FALSE;
  active_release_count INTEGER;
  admitted_release_sha TEXT;
  lineage public.agent_versions%ROWTYPE;
  expected_binding JSONB;
  binding_bytes TEXT;
  binding_hash TEXT;
  record_bytes TEXT;
  record_hash TEXT;
  fresh_until TIMESTAMPTZ;
  derived_decision TEXT;
  derived_key TEXT;
  inserted_id UUID;
  inserted_decision TEXT;
  inserted_error_code TEXT;
BEGIN
  SELECT r.rolsuper INTO caller_is_superuser
  FROM pg_catalog.pg_roles r
  WHERE r.rolname = session_user;
  IF p_test_observed_at IS NOT NULL THEN
    IF NOT COALESCE(caller_is_superuser, FALSE) THEN
      RAISE EXCEPTION 'disposable ENS publication test clock requires database superuser'
        USING ERRCODE = '42501';
    END IF;
    authority_now := p_test_observed_at;
  END IF;
  IF NOT COALESCE(caller_is_superuser, FALSE)
    AND pg_catalog.has_schema_privilege(session_user, 'public', 'CREATE')
  THEN
    RAISE EXCEPTION 'ENS publication runtime caller must not create in public schema'
      USING ERRCODE = '42501';
  END IF;

  IF p_binding IS NULL OR p_agent_version_id IS NULL THEN
    RAISE EXCEPTION 'ENS publication admission requires version and binding evidence'
      USING ERRCODE = '23514';
  END IF;

  SELECT v.* INTO lineage
  FROM public.agent_versions v
  JOIN public.kernel_agents a ON a.id = v.agent_id
  WHERE v.id = p_agent_version_id
    AND v.lifecycle_state = 'WRITE_PREPARED'
    AND NOT v.published
    AND v.adapter_key = 'protected-a3'
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ENS publication decision does not match immutable version lineage'
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer, min(r.release_sha)
    INTO active_release_count, admitted_release_sha
  FROM public.ens_publication_authority_releases r
  WHERE r.not_before <= authority_now AND r.expires_at > authority_now;
  IF active_release_count <> 1 OR admitted_release_sha IS NULL THEN
    RAISE EXCEPTION 'exactly one ENS publication authority release must be admitted'
      USING ERRCODE = '42501';
  END IF;

  binding_bytes := p_binding::text;
  binding_hash := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(binding_bytes, 'UTF8')),
    'hex'
  );
  IF p_record IS NULL THEN
    record_bytes := NULL;
    record_hash := NULL;
    fresh_until := NULL;
  ELSE
    record_bytes := p_record::text;
    record_hash := pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(record_bytes, 'UTF8')),
      'hex'
    );
    fresh_until := (p_record->>'freshUntil')::timestamptz;
  END IF;
  expected_binding := pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'agentVersionId', lineage.id::text,
    'agentVersion', lineage.version,
    'manifestHash', lineage.manifest_hash,
    'capabilities', pg_catalog.to_jsonb(lineage.capabilities),
    'service', COALESCE(lineage.endpoint, lineage.adapter_key),
    'priceAtomic', lineage.price_atomic::text,
    'payout', lower(COALESCE(lineage.payout_address, lineage.owner_wallet)),
    'chainId', (p_binding->>'chainId')::integer,
    'creatorName', lineage.creator_parent,
    'creatorNode', p_binding->>'creatorNode',
    'creatorDnsName', lineage.manifest->'ensBinding'->>'creatorDnsName',
    'agentLabel', lineage.agent_label,
    'agentName', lineage.full_subname,
    'agentNode', p_binding->>'agentNode',
    'agentDnsName', lineage.manifest->'ensBinding'->>'agentDnsName',
    'owner', lower(lineage.owner_wallet),
    'delegate', lower(COALESCE(lineage.payout_address, lineage.owner_wallet)),
    'rootRegistry', lower(p_binding->>'rootRegistry'),
    'universalResolver', lower(p_binding->>'universalResolver'),
    'creatorCanonicalRegistry', lower(p_binding->>'creatorCanonicalRegistry'),
    'agentParentRegistry', lower(p_binding->>'agentParentRegistry'),
    'agentCanonicalRegistry', lower(p_binding->>'agentCanonicalRegistry'),
    'roles', p_binding->'roles',
    'externalGrants', p_binding->'externalGrants',
    'parentExpiry', pg_catalog.to_char(
      (p_binding->>'parentExpiry')::timestamptz AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'agentExpiry', pg_catalog.to_char(
      (p_binding->>'agentExpiry')::timestamptz AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'parentLink', p_binding->'parentLink',
    'alias', (p_binding->>'alias')::boolean,
    'creatorResolverAddress', lower(p_binding->>'creatorResolverAddress'),
    'resolverAddress', lower(p_binding->>'resolverAddress'),
    'resolverSuffix', p_binding->>'resolverSuffix',
    'resolverMode', p_binding->>'resolverMode',
    'ccipGateway', p_binding->>'ccipGateway',
    'policyVersion', p_binding->>'policyVersion',
    'maxAgeSeconds', (p_binding->>'maxAgeSeconds')::integer
  );
  IF p_binding <> expected_binding THEN
    RAISE EXCEPTION 'ENS publication admission binding mismatch' USING ERRCODE = '23514';
  END IF;
  derived_decision := CASE WHEN p_error_code IS NULL THEN 'ALLOW' ELSE 'DENY' END;
  derived_key := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(
      pg_catalog.jsonb_build_object(
        'schemaVersion', 2,
        'agentVersionId', p_agent_version_id::text,
        'bindingHash', binding_hash,
        'releaseSha', admitted_release_sha,
        'decision', derived_decision,
        'errorCode', p_error_code,
        'recordHash', record_hash,
        'blockNumber', p_block_number,
        'blockTimestamp', p_block_timestamp,
        'freshUntil', fresh_until,
        'transactionHash', p_transaction_hash
      )::text,
      'UTF8'
    )),
    'hex'
  );

  INSERT INTO public.ens_publication_decisions (
    decision_key, agent_version_id, agent_version, binding_bytes, binding_hash,
    manifest_hash, capabilities, service, price_atomic, payout,
    creator_name, creator_node, creator_dns_name, agent_label, agent_name,
    agent_node, agent_dns_name, owner, delegate, chain_id, root_registry,
    universal_resolver, creator_canonical_registry, agent_parent_registry,
    agent_canonical_registry, roles, external_grants, parent_expiry, agent_expiry,
    parent_link, alias, creator_resolver_address, resolver_address, resolver_suffix,
    resolver_mode, ccip_gateway, policy_version, max_age_seconds, record_bytes,
    record_hash, block_number, block_timestamp, transaction_hash, observed_at,
    fresh_until, release_sha, decision, error_code, disposable_test_clock, created_at
  ) VALUES (
    derived_key,
    lineage.id,
    lineage.version,
    binding_bytes,
    binding_hash,
    lineage.manifest_hash,
    lineage.capabilities,
    COALESCE(lineage.endpoint, lineage.adapter_key),
    lineage.price_atomic,
    lower(COALESCE(lineage.payout_address, lineage.owner_wallet)),
    lineage.creator_parent,
    p_binding->>'creatorNode',
    lineage.manifest->'ensBinding'->>'creatorDnsName',
    lineage.agent_label,
    lineage.full_subname,
    p_binding->>'agentNode',
    lineage.manifest->'ensBinding'->>'agentDnsName',
    lower(lineage.owner_wallet),
    lower(COALESCE(lineage.payout_address, lineage.owner_wallet)),
    (p_binding->>'chainId')::integer,
    lower(p_binding->>'rootRegistry'),
    lower(p_binding->>'universalResolver'),
    lower(p_binding->>'creatorCanonicalRegistry'),
    lower(p_binding->>'agentParentRegistry'),
    lower(p_binding->>'agentCanonicalRegistry'),
    p_binding->'roles',
    p_binding->'externalGrants',
    (p_binding->>'parentExpiry')::timestamptz,
    (p_binding->>'agentExpiry')::timestamptz,
    p_binding->'parentLink',
    (p_binding->>'alias')::boolean,
    lower(p_binding->>'creatorResolverAddress'),
    lower(p_binding->>'resolverAddress'),
    p_binding->>'resolverSuffix',
    p_binding->>'resolverMode',
    p_binding->>'ccipGateway',
    p_binding->>'policyVersion',
    (p_binding->>'maxAgeSeconds')::integer,
    record_bytes,
    record_hash,
    p_block_number,
    p_block_timestamp,
    lower(p_transaction_hash),
    authority_now,
    fresh_until,
    admitted_release_sha,
    derived_decision,
    p_error_code,
    p_test_observed_at IS NOT NULL,
    authority_now
  )
  ON CONFLICT (decision_key) DO NOTHING
  RETURNING id, ens_publication_decisions.decision, ens_publication_decisions.error_code
    INTO inserted_id, inserted_decision, inserted_error_code;

  IF inserted_id IS NULL THEN
    SELECT d.id, d.decision, d.error_code
      INTO inserted_id, inserted_decision, inserted_error_code
    FROM public.ens_publication_decisions d
    WHERE d.decision_key = derived_key;
  END IF;
  IF inserted_id IS NULL
    OR inserted_decision <> derived_decision
    OR inserted_error_code IS DISTINCT FROM p_error_code
  THEN
    RAISE EXCEPTION 'ENS publication decision admission failed' USING ERRCODE = '23514';
  END IF;

  RETURN QUERY SELECT inserted_id, inserted_decision, inserted_error_code;
END;
$$;

REVOKE ALL ON SCHEMA public FROM alphadawg_runtime;
REVOKE ALL ON TABLE public.ens_publication_decisions FROM PUBLIC, alphadawg_runtime;
REVOKE ALL ON TABLE public.ens_publication_authority_releases FROM PUBLIC, alphadawg_runtime;
REVOKE ALL ON FUNCTION public.admit_ens_publication_decision(
  UUID, JSONB, JSONB, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TIMESTAMPTZ
) FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO alphadawg_runtime;
GRANT SELECT (
  id, agent_id, version, manifest_hash, manifest, capabilities, endpoint,
  adapter_key, price_atomic, owner_wallet, payout_address, lifecycle_state,
  published, creator_parent, agent_label, full_subname
) ON public.agent_versions TO alphadawg_runtime;
GRANT SELECT (id) ON public.kernel_agents TO alphadawg_runtime;
GRANT EXECUTE ON FUNCTION public.admit_ens_publication_decision(
  UUID, JSONB, JSONB, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TIMESTAMPTZ
) TO alphadawg_runtime;
