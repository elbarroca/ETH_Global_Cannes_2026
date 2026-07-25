-- W6 hardens publication admission around one database-owner-admitted complete
-- policy per authority release and immutable agent version. Runtime callers
-- provide observations only; policy, release, clock, and convergence identity
-- never cross the function boundary.

DO $$
DECLARE
  runtime_oid OID;
BEGIN
  SELECT oid INTO runtime_oid FROM pg_catalog.pg_roles WHERE rolname = 'alphadawg_runtime';
  IF runtime_oid IS NULL THEN
    RAISE EXCEPTION 'alphadawg_runtime prerequisite is missing' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    WITH RECURSIVE parent_roles(roleid) AS (
      SELECT m.roleid FROM pg_catalog.pg_auth_members m WHERE m.member = runtime_oid
      UNION
      SELECT m.roleid
      FROM pg_catalog.pg_auth_members m
      JOIN parent_roles p ON p.roleid = m.member
    )
    SELECT 1 FROM parent_roles
  ) THEN
    RAISE EXCEPTION 'alphadawg_runtime must not inherit any parent role'
      USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.has_schema_privilege('alphadawg_runtime', 'public', 'CREATE')
    OR pg_catalog.has_table_privilege(
      'alphadawg_runtime', 'public.ens_publication_decisions', 'SELECT'
    )
    OR pg_catalog.has_table_privilege(
      'alphadawg_runtime', 'public.ens_publication_decisions', 'INSERT'
    )
    OR pg_catalog.has_table_privilege(
      'alphadawg_runtime', 'public.ens_publication_decisions', 'UPDATE'
    )
    OR pg_catalog.has_table_privilege(
      'alphadawg_runtime', 'public.ens_publication_decisions', 'DELETE'
    )
    OR pg_catalog.has_table_privilege(
      'alphadawg_runtime', 'public.ens_publication_decisions', 'TRUNCATE'
    )
    OR pg_catalog.has_table_privilege(
      'alphadawg_runtime', 'public.ens_publication_authority_releases', 'SELECT'
    )
    OR pg_catalog.has_table_privilege(
      'alphadawg_runtime', 'public.ens_publication_authority_releases', 'INSERT'
    )
    OR pg_catalog.has_table_privilege(
      'alphadawg_runtime', 'public.ens_publication_authority_releases', 'UPDATE'
    )
    OR pg_catalog.has_table_privilege(
      'alphadawg_runtime', 'public.ens_publication_authority_releases', 'DELETE'
    )
    OR pg_catalog.has_table_privilege(
      'alphadawg_runtime', 'public.ens_publication_authority_releases', 'TRUNCATE'
    )
  THEN
    RAISE EXCEPTION 'alphadawg_runtime has effective authority-table privilege'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

ALTER TABLE public.ens_publication_authority_releases
  ADD CONSTRAINT ens_publication_authority_release_finite_check CHECK (
    pg_catalog.isfinite(not_before) AND pg_catalog.isfinite(expires_at)
  ),
  ADD CONSTRAINT ens_publication_authority_release_max_24h_check CHECK (
    expires_at - not_before <= interval '24 hours'
  ),
  ADD CONSTRAINT ens_publication_authority_release_no_overlap
    EXCLUDE USING gist (tstzrange(not_before, expires_at, '[)') WITH &&);

CREATE TABLE public.ens_publication_authority_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  release_sha TEXT NOT NULL,
  agent_version_id UUID NOT NULL,
  binding JSONB NOT NULL,
  binding_hash TEXT NOT NULL,
  admitted_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT ens_publication_authority_policies_pkey PRIMARY KEY (id),
  CONSTRAINT ens_publication_authority_policy_release_fkey FOREIGN KEY (release_sha)
    REFERENCES public.ens_publication_authority_releases(release_sha) ON DELETE RESTRICT,
  CONSTRAINT ens_publication_authority_policy_version_fkey FOREIGN KEY (agent_version_id)
    REFERENCES public.agent_versions(id) ON DELETE RESTRICT,
  CONSTRAINT ens_publication_authority_policy_hash_check CHECK (
    binding_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT ens_publication_authority_policy_size_check CHECK (
    pg_column_size(binding) <= 65536
  ),
  CONSTRAINT ens_publication_authority_policy_release_version_key UNIQUE (
    release_sha, agent_version_id
  ),
  CONSTRAINT ens_publication_authority_policy_release_binding_key UNIQUE (
    release_sha, binding_hash
  )
);

CREATE OR REPLACE FUNCTION public.enforce_ens_publication_authority_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
SET "TimeZone" = 'UTC'
AS $$
DECLARE
  lineage public.agent_versions%ROWTYPE;
  expected_binding JSONB;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'ENS publication authority policies are append-only'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.binding IS NULL OR pg_catalog.pg_column_size(NEW.binding) > 65536 THEN
    RAISE EXCEPTION 'ENS publication authority policy exceeds 65536 bytes'
      USING ERRCODE = '22001';
  END IF;
  IF pg_catalog.jsonb_typeof(NEW.binding) <> 'object'
    OR pg_catalog.octet_length(COALESCE(NEW.binding->>'creatorName', '')) > 255
    OR pg_catalog.octet_length(COALESCE(NEW.binding->>'agentName', '')) > 255
    OR pg_catalog.octet_length(COALESCE(NEW.binding->>'service', '')) > 2048
    OR pg_catalog.octet_length(COALESCE(NEW.binding->>'ccipGateway', '')) > 2048
    OR pg_catalog.octet_length(COALESCE(NEW.binding->>'policyVersion', '')) > 64
    OR pg_catalog.octet_length(COALESCE(NEW.binding->>'creatorNode', '')) > 66
    OR pg_catalog.octet_length(COALESCE(NEW.binding->>'agentNode', '')) > 66
    OR pg_catalog.jsonb_typeof(NEW.binding->'capabilities') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(NEW.binding->'capabilities') NOT BETWEEN 1 AND 32
    OR pg_catalog.jsonb_typeof(NEW.binding->'roles') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(NEW.binding->'roles') NOT BETWEEN 2 AND 32
    OR pg_catalog.jsonb_typeof(NEW.binding->'externalGrants') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(NEW.binding->'externalGrants') <> 0
  THEN
    RAISE EXCEPTION 'ENS publication authority policy scalar or array bounds are invalid'
      USING ERRCODE = '22001';
  END IF;

  SELECT v.* INTO lineage
  FROM public.agent_versions v
  JOIN public.kernel_agents a ON a.id = v.agent_id
  WHERE v.id = NEW.agent_version_id
    AND v.lifecycle_state = 'WRITE_PREPARED'
    AND NOT v.published
    AND v.adapter_key = 'protected-a3'
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ENS publication policy does not match immutable version lineage'
      USING ERRCODE = '23514';
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
    'chainId', (NEW.binding->>'chainId')::integer,
    'creatorName', lineage.creator_parent,
    'creatorNode', NEW.binding->>'creatorNode',
    'creatorDnsName', lineage.manifest->'ensBinding'->>'creatorDnsName',
    'agentLabel', lineage.agent_label,
    'agentName', lineage.full_subname,
    'agentNode', NEW.binding->>'agentNode',
    'agentDnsName', lineage.manifest->'ensBinding'->>'agentDnsName',
    'owner', lower(lineage.owner_wallet),
    'delegate', lower(COALESCE(lineage.payout_address, lineage.owner_wallet)),
    'rootRegistry', lower(NEW.binding->>'rootRegistry'),
    'universalResolver', lower(NEW.binding->>'universalResolver'),
    'creatorCanonicalRegistry', lower(NEW.binding->>'creatorCanonicalRegistry'),
    'agentParentRegistry', lower(NEW.binding->>'agentParentRegistry'),
    'agentCanonicalRegistry', lower(NEW.binding->>'agentCanonicalRegistry'),
    'roles', NEW.binding->'roles',
    'externalGrants', NEW.binding->'externalGrants',
    'parentExpiry', pg_catalog.to_char(
      (NEW.binding->>'parentExpiry')::timestamptz AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'agentExpiry', pg_catalog.to_char(
      (NEW.binding->>'agentExpiry')::timestamptz AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'parentLink', NEW.binding->'parentLink',
    'alias', (NEW.binding->>'alias')::boolean,
    'creatorResolverAddress', lower(NEW.binding->>'creatorResolverAddress'),
    'resolverAddress', lower(NEW.binding->>'resolverAddress'),
    'resolverSuffix', NEW.binding->>'resolverSuffix',
    'resolverMode', NEW.binding->>'resolverMode',
    'ccipGateway', NEW.binding->>'ccipGateway',
    'policyVersion', NEW.binding->>'policyVersion',
    'maxAgeSeconds', (NEW.binding->>'maxAgeSeconds')::integer
  );
  IF NEW.binding <> expected_binding THEN
    RAISE EXCEPTION 'ENS publication authority policy is not exact'
      USING ERRCODE = '23514';
  END IF;

  NEW.binding := expected_binding;
  NEW.binding_hash := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(NEW.binding::text, 'UTF8')),
    'hex'
  );
  NEW.admitted_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ens_publication_authority_policies_append_only
BEFORE INSERT OR UPDATE OR DELETE ON public.ens_publication_authority_policies
FOR EACH ROW EXECUTE FUNCTION public.enforce_ens_publication_authority_policy();

CREATE TRIGGER ens_publication_authority_policies_no_truncate
BEFORE TRUNCATE ON public.ens_publication_authority_policies
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_ens_publication_authority_policy();

DROP FUNCTION public.admit_ens_publication_decision(
  UUID, JSONB, JSONB, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, TIMESTAMPTZ
);

CREATE FUNCTION public.admit_ens_publication_decision(
  p_agent_version_id UUID,
  p_record JSONB,
  p_block_number NUMERIC,
  p_block_timestamp TIMESTAMPTZ,
  p_transaction_hash TEXT,
  p_error_code TEXT
)
RETURNS TABLE (
  decision_id UUID,
  decision TEXT,
  error_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
SET "TimeZone" = 'UTC'
AS $$
DECLARE
  authority_now TIMESTAMPTZ := clock_timestamp();
  caller_role pg_roles%ROWTYPE;
  runtime_role pg_roles%ROWTYPE;
  caller_oid OID;
  runtime_oid OID;
  caller_parent_count INTEGER;
  active_release_count INTEGER;
  admitted_release_sha TEXT;
  admitted_policy_count INTEGER;
  lineage public.agent_versions%ROWTYPE;
  binding_record JSONB;
  binding_bytes TEXT;
  binding_hash TEXT;
  record_bytes TEXT;
  record_hash TEXT;
  fresh_until TIMESTAMPTZ;
  derived_decision TEXT;
  derived_key TEXT;
  block_timestamp_utc TEXT;
  fresh_until_utc TEXT;
  inserted_id UUID;
  inserted_decision TEXT;
  inserted_error_code TEXT;
BEGIN
  SELECT * INTO caller_role FROM pg_catalog.pg_roles WHERE rolname = session_user;
  SELECT * INTO runtime_role FROM pg_catalog.pg_roles WHERE rolname = 'alphadawg_runtime';
  caller_oid := caller_role.oid;
  runtime_oid := runtime_role.oid;
  IF caller_oid IS NULL OR runtime_oid IS NULL
    OR caller_role.rolsuper OR caller_role.rolcreatedb OR caller_role.rolcreaterole
    OR caller_role.rolreplication OR caller_role.rolbypassrls OR NOT caller_role.rolinherit
    OR runtime_role.rolcanlogin OR runtime_role.rolsuper OR runtime_role.rolcreatedb
    OR runtime_role.rolcreaterole OR runtime_role.rolreplication
    OR runtime_role.rolbypassrls OR NOT runtime_role.rolinherit
    OR pg_catalog.current_setting('role') <> 'none'
  THEN
    RAISE EXCEPTION 'ENS publication runtime caller role is unsafe'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_auth_members m
    WHERE m.roleid = runtime_oid AND m.member = caller_oid
  ) THEN
    RAISE EXCEPTION 'ENS publication caller is not a direct runtime member'
      USING ERRCODE = '42501';
  END IF;
  SELECT count(*)::integer INTO caller_parent_count
  FROM (
    WITH RECURSIVE parent_roles(roleid) AS (
      SELECT m.roleid FROM pg_catalog.pg_auth_members m WHERE m.member = caller_oid
      UNION
      SELECT m.roleid
      FROM pg_catalog.pg_auth_members m
      JOIN parent_roles p ON p.roleid = m.member
    )
    SELECT roleid FROM parent_roles
  ) parents;
  IF caller_parent_count <> 1 THEN
    RAISE EXCEPTION 'ENS publication caller has unsafe inherited role membership'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    WITH RECURSIVE parent_roles(roleid) AS (
      SELECT m.roleid FROM pg_catalog.pg_auth_members m WHERE m.member = runtime_oid
      UNION
      SELECT m.roleid
      FROM pg_catalog.pg_auth_members m
      JOIN parent_roles p ON p.roleid = m.member
    )
    SELECT 1 FROM parent_roles
  ) THEN
    RAISE EXCEPTION 'alphadawg_runtime has unsafe inherited role membership'
      USING ERRCODE = '42501';
  END IF;
  IF pg_catalog.has_schema_privilege(session_user, 'public', 'CREATE')
    OR pg_catalog.has_table_privilege(session_user, 'public.ens_publication_decisions', 'SELECT')
    OR pg_catalog.has_table_privilege(session_user, 'public.ens_publication_decisions', 'INSERT')
    OR pg_catalog.has_table_privilege(session_user, 'public.ens_publication_decisions', 'UPDATE')
    OR pg_catalog.has_table_privilege(session_user, 'public.ens_publication_decisions', 'DELETE')
    OR pg_catalog.has_table_privilege(session_user, 'public.ens_publication_decisions', 'TRUNCATE')
    OR pg_catalog.has_table_privilege(session_user, 'public.ens_publication_authority_releases', 'SELECT')
    OR pg_catalog.has_table_privilege(session_user, 'public.ens_publication_authority_releases', 'INSERT')
    OR pg_catalog.has_table_privilege(session_user, 'public.ens_publication_authority_releases', 'UPDATE')
    OR pg_catalog.has_table_privilege(session_user, 'public.ens_publication_authority_releases', 'DELETE')
    OR pg_catalog.has_table_privilege(session_user, 'public.ens_publication_authority_releases', 'TRUNCATE')
    OR pg_catalog.has_table_privilege(session_user, 'public.ens_publication_authority_policies', 'SELECT')
    OR pg_catalog.has_table_privilege(session_user, 'public.ens_publication_authority_policies', 'INSERT')
    OR pg_catalog.has_table_privilege(session_user, 'public.ens_publication_authority_policies', 'UPDATE')
    OR pg_catalog.has_table_privilege(session_user, 'public.ens_publication_authority_policies', 'DELETE')
    OR pg_catalog.has_table_privilege(session_user, 'public.ens_publication_authority_policies', 'TRUNCATE')
    OR EXISTS (
      SELECT 1 FROM pg_catalog.pg_tables t
      WHERE t.schemaname = 'public'
        AND t.tablename IN (
          'ens_publication_decisions',
          'ens_publication_authority_releases',
          'ens_publication_authority_policies'
        )
        AND t.tableowner = session_user
    )
  THEN
    RAISE EXCEPTION 'ENS publication caller has effective authority-table privilege'
      USING ERRCODE = '42501';
  END IF;

  IF p_agent_version_id IS NULL
    OR p_record IS NOT NULL AND pg_catalog.pg_column_size(p_record) > 131072
    OR p_error_code IS NOT NULL AND pg_catalog.octet_length(p_error_code) > 64
    OR p_transaction_hash IS NOT NULL AND pg_catalog.octet_length(p_transaction_hash) > 66
    OR p_block_number IS NOT NULL AND (
      p_block_number < 1 OR p_block_number > 99999999999999999999
    )
    OR p_block_timestamp IS NOT NULL AND NOT pg_catalog.isfinite(p_block_timestamp)
  THEN
    RAISE EXCEPTION 'ENS publication observation exceeds early bounds'
      USING ERRCODE = '22001';
  END IF;
  IF p_record IS NOT NULL AND (
    pg_catalog.jsonb_typeof(p_record) <> 'object'
    OR pg_catalog.octet_length(COALESCE(p_record->>'freshUntil', '')) > 32
    OR pg_catalog.octet_length(COALESCE(p_record->>'service', '')) > 2048
    OR pg_catalog.octet_length(COALESCE(p_record->>'policyVersion', '')) > 64
    OR pg_catalog.jsonb_typeof(p_record->'capabilities') IS DISTINCT FROM 'array'
    OR pg_catalog.jsonb_array_length(p_record->'capabilities') NOT BETWEEN 1 AND 32
  ) THEN
    RAISE EXCEPTION 'ENS publication observation scalar or array bounds are invalid'
      USING ERRCODE = '22001';
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
    RAISE EXCEPTION 'exactly one finite ENS publication authority release must be admitted'
      USING ERRCODE = '42501';
  END IF;

  SELECT count(*)::integer INTO admitted_policy_count
  FROM public.ens_publication_authority_policies p
  WHERE p.release_sha = admitted_release_sha
    AND p.agent_version_id = p_agent_version_id;
  IF admitted_policy_count <> 1 THEN
    RAISE EXCEPTION 'exactly one ENS publication authority policy must be admitted'
      USING ERRCODE = '42501';
  END IF;
  SELECT p.binding, p.binding_hash INTO binding_record, binding_hash
  FROM public.ens_publication_authority_policies p
  WHERE p.release_sha = admitted_release_sha
    AND p.agent_version_id = p_agent_version_id;

  binding_bytes := binding_record::text;
  IF binding_hash <> pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(binding_bytes, 'UTF8')),
    'hex'
  ) THEN
    RAISE EXCEPTION 'ENS publication authority policy hash is invalid'
      USING ERRCODE = '23514';
  END IF;
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
  derived_decision := CASE WHEN p_error_code IS NULL THEN 'ALLOW' ELSE 'DENY' END;
  block_timestamp_utc := CASE WHEN p_block_timestamp IS NULL THEN NULL ELSE pg_catalog.to_char(
    p_block_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
  ) END;
  fresh_until_utc := CASE WHEN fresh_until IS NULL THEN NULL ELSE pg_catalog.to_char(
    fresh_until AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
  ) END;
  derived_key := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(
      pg_catalog.jsonb_build_object(
        'schemaVersion', 3,
        'agentVersionId', p_agent_version_id::text,
        'bindingHash', binding_hash,
        'releaseSha', admitted_release_sha,
        'decision', derived_decision,
        'errorCode', p_error_code,
        'recordHash', record_hash,
        'blockNumber', CASE WHEN p_block_number IS NULL THEN NULL ELSE p_block_number::text END,
        'blockTimestampUtc', block_timestamp_utc,
        'freshUntilUtc', fresh_until_utc,
        'transactionHash', lower(p_transaction_hash)
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
    derived_key, lineage.id, lineage.version, binding_bytes, binding_hash,
    lineage.manifest_hash, lineage.capabilities,
    COALESCE(lineage.endpoint, lineage.adapter_key), lineage.price_atomic,
    lower(COALESCE(lineage.payout_address, lineage.owner_wallet)),
    lineage.creator_parent, binding_record->>'creatorNode',
    lineage.manifest->'ensBinding'->>'creatorDnsName', lineage.agent_label,
    lineage.full_subname, binding_record->>'agentNode',
    lineage.manifest->'ensBinding'->>'agentDnsName', lower(lineage.owner_wallet),
    lower(COALESCE(lineage.payout_address, lineage.owner_wallet)),
    (binding_record->>'chainId')::integer, lower(binding_record->>'rootRegistry'),
    lower(binding_record->>'universalResolver'),
    lower(binding_record->>'creatorCanonicalRegistry'),
    lower(binding_record->>'agentParentRegistry'),
    lower(binding_record->>'agentCanonicalRegistry'), binding_record->'roles',
    binding_record->'externalGrants', (binding_record->>'parentExpiry')::timestamptz,
    (binding_record->>'agentExpiry')::timestamptz, binding_record->'parentLink',
    (binding_record->>'alias')::boolean,
    lower(binding_record->>'creatorResolverAddress'),
    lower(binding_record->>'resolverAddress'), binding_record->>'resolverSuffix',
    binding_record->>'resolverMode', binding_record->>'ccipGateway',
    binding_record->>'policyVersion', (binding_record->>'maxAgeSeconds')::integer,
    record_bytes, record_hash, p_block_number, p_block_timestamp,
    lower(p_transaction_hash), authority_now, fresh_until, admitted_release_sha,
    derived_decision, p_error_code, FALSE, authority_now
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
REVOKE ALL ON TABLE public.ens_publication_authority_policies FROM PUBLIC, alphadawg_runtime;
REVOKE ALL ON FUNCTION public.admit_ens_publication_decision(
  UUID, JSONB, NUMERIC, TIMESTAMPTZ, TEXT, TEXT
) FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO alphadawg_runtime;
GRANT EXECUTE ON FUNCTION public.admit_ens_publication_decision(
  UUID, JSONB, NUMERIC, TIMESTAMPTZ, TEXT, TEXT
) TO alphadawg_runtime;
