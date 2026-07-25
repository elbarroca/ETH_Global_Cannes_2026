-- ENS-owned pre-publication authority. Decisions are version-keyed and do not
-- depend on a commerce job, effect, receipt, worker claim, or delivery state.

CREATE TABLE "ens_publication_decisions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "decision_key" TEXT NOT NULL,
  "agent_version_id" UUID NOT NULL,
  "agent_version" INTEGER NOT NULL,
  "binding_bytes" TEXT NOT NULL,
  "binding_hash" TEXT NOT NULL,
  "manifest_hash" TEXT NOT NULL,
  "capabilities" TEXT[] NOT NULL,
  "service" TEXT NOT NULL,
  "price_atomic" BIGINT NOT NULL,
  "payout" TEXT NOT NULL,
  "creator_name" TEXT NOT NULL,
  "creator_node" TEXT NOT NULL,
  "creator_dns_name" TEXT NOT NULL,
  "agent_label" TEXT NOT NULL,
  "agent_name" TEXT NOT NULL,
  "agent_node" TEXT NOT NULL,
  "agent_dns_name" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "delegate" TEXT NOT NULL,
  "chain_id" INTEGER NOT NULL,
  "root_registry" TEXT NOT NULL,
  "universal_resolver" TEXT NOT NULL,
  "creator_canonical_registry" TEXT NOT NULL,
  "agent_parent_registry" TEXT NOT NULL,
  "agent_canonical_registry" TEXT,
  "roles" JSONB NOT NULL,
  "external_grants" JSONB NOT NULL DEFAULT '[]',
  "parent_expiry" TIMESTAMPTZ(6) NOT NULL,
  "agent_expiry" TIMESTAMPTZ(6) NOT NULL,
  "parent_link" JSONB NOT NULL,
  "alias" BOOLEAN NOT NULL,
  "creator_resolver_address" TEXT NOT NULL,
  "resolver_address" TEXT NOT NULL,
  "resolver_suffix" TEXT NOT NULL,
  "resolver_mode" TEXT NOT NULL,
  "ccip_gateway" TEXT NOT NULL,
  "policy_version" TEXT NOT NULL,
  "max_age_seconds" INTEGER NOT NULL,
  "record_bytes" TEXT,
  "record_hash" TEXT,
  "block_number" NUMERIC(20,0),
  "block_timestamp" TIMESTAMPTZ(6),
  "transaction_hash" TEXT,
  "observed_at" TIMESTAMPTZ(6) NOT NULL,
  "fresh_until" TIMESTAMPTZ(6),
  "release_sha" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "error_code" TEXT,
  "disposable_test_clock" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ens_publication_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ens_publication_version_fkey" FOREIGN KEY ("agent_version_id")
    REFERENCES "agent_versions"("id") ON DELETE RESTRICT,
  CONSTRAINT "ens_publication_hash_shape_check" CHECK (
    "decision_key" ~ '^[0-9a-f]{64}$' AND
    "binding_hash" ~ '^[0-9a-f]{64}$' AND
    "manifest_hash" ~ '^[0-9a-f]{64}$' AND
    ("record_hash" IS NULL OR "record_hash" ~ '^[0-9a-f]{64}$') AND
    "release_sha" ~ '^[0-9a-f]{40}$'
  ),
  CONSTRAINT "ens_publication_name_shape_check" CHECK (
    "creator_node" ~ '^0x[0-9a-f]{64}$' AND "agent_node" ~ '^0x[0-9a-f]{64}$' AND
    "creator_dns_name" ~ '^0x([0-9a-f]{2})+$' AND "agent_dns_name" ~ '^0x([0-9a-f]{2})+$' AND
    octet_length("creator_name") BETWEEN 5 AND 255 AND
    octet_length("agent_name") BETWEEN 7 AND 255 AND
    "agent_label" ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
  ),
  CONSTRAINT "ens_publication_address_shape_check" CHECK (
    "payout" ~ '^0x[0-9a-f]{40}$' AND "owner" ~ '^0x[0-9a-f]{40}$' AND
    "delegate" ~ '^0x[0-9a-f]{40}$' AND "root_registry" ~ '^0x[0-9a-f]{40}$' AND
    "universal_resolver" ~ '^0x[0-9a-f]{40}$' AND
    "creator_canonical_registry" ~ '^0x[0-9a-f]{40}$' AND
    "agent_parent_registry" ~ '^0x[0-9a-f]{40}$' AND
    ("agent_canonical_registry" IS NULL OR "agent_canonical_registry" ~ '^0x[0-9a-f]{40}$') AND
    "creator_resolver_address" ~ '^0x[0-9a-f]{40}$' AND
    "resolver_address" ~ '^0x[0-9a-f]{40}$' AND
    ("transaction_hash" IS NULL OR "transaction_hash" ~ '^0x[0-9a-f]{64}$')
  ),
  CONSTRAINT "ens_publication_bounds_check" CHECK (
    "agent_version" > 0 AND "chain_id" > 0 AND "price_atomic" > 0 AND
    "max_age_seconds" BETWEEN 1 AND 3600 AND cardinality("capabilities") BETWEEN 1 AND 32 AND
    octet_length("binding_bytes") BETWEEN 1 AND 131072 AND
    ("record_bytes" IS NULL OR octet_length("record_bytes") BETWEEN 1 AND 131072) AND
    octet_length("service") BETWEEN 1 AND 2048 AND octet_length("ccip_gateway") BETWEEN 1 AND 2048 AND
    "policy_version" ~ '^[a-z][a-z0-9-]{2,63}$' AND "resolver_mode" IN ('EXPLICIT', 'INHERITED')
  ),
  CONSTRAINT "ens_publication_hierarchy_shape_check" CHECK (
    jsonb_typeof("roles") = 'array' AND jsonb_array_length("roles") BETWEEN 2 AND 32 AND
    jsonb_typeof("external_grants") = 'array' AND jsonb_array_length("external_grants") = 0 AND
    jsonb_typeof("parent_link") = 'object' AND
    "parent_link" ?& ARRAY['parentName', 'childName', 'forward', 'back'] AND
    "parent_link" - ARRAY['parentName', 'childName', 'forward', 'back'] = '{}'::jsonb AND
    "alias" = FALSE
  ),
  CONSTRAINT "ens_publication_decision_shape_check" CHECK (
    ("decision" = 'ALLOW' AND "error_code" IS NULL AND
      "record_bytes" IS NOT NULL AND "record_hash" IS NOT NULL AND
      "block_number" IS NOT NULL AND "block_timestamp" IS NOT NULL AND "fresh_until" IS NOT NULL)
    OR
    ("decision" = 'DENY' AND "error_code" ~ '^ENS_(AUTHORITY|PUBLICATION)_[A-Z0-9_]{2,48}$' AND (
      ("record_bytes" IS NULL AND "record_hash" IS NULL AND "block_number" IS NULL AND
        "block_timestamp" IS NULL AND "fresh_until" IS NULL AND "transaction_hash" IS NULL)
      OR
      ("record_bytes" IS NOT NULL AND "record_hash" IS NOT NULL AND "block_number" IS NOT NULL AND
        "block_timestamp" IS NOT NULL AND "fresh_until" IS NOT NULL)
    ))
  )
);

CREATE UNIQUE INDEX "ens_publication_decisions_key_key"
  ON "ens_publication_decisions"("decision_key");
CREATE UNIQUE INDEX "uniq_ens_publication_decision_evidence"
  ON "ens_publication_decisions"(
    "agent_version_id", "binding_hash", "release_sha", "decision",
    COALESCE("error_code", ''), COALESCE("record_hash", ''),
    COALESCE("block_number", 0), COALESCE("block_timestamp", 'epoch'::timestamptz),
    COALESCE("fresh_until", 'epoch'::timestamptz), COALESCE("transaction_hash", '')
  );
CREATE INDEX "idx_ens_publication_version_created"
  ON "ens_publication_decisions"("agent_version_id", "created_at");

CREATE OR REPLACE FUNCTION enforce_ens_publication_decision()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  authority_now TIMESTAMPTZ;
  role_is_superuser BOOLEAN;
  binding_record JSONB;
  expected_binding JSONB;
  authority_record JSONB;
  hierarchy JSONB;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'ENS publication decisions are append-only' USING ERRCODE = '23514';
  END IF;

  IF NEW."disposable_test_clock" THEN
    SELECT rolsuper INTO role_is_superuser FROM pg_roles WHERE rolname = current_user;
    IF NOT COALESCE(role_is_superuser, FALSE) THEN
      RAISE EXCEPTION 'disposable ENS publication test clock requires database superuser' USING ERRCODE = '42501';
    END IF;
    authority_now := NEW."observed_at";
  ELSE
    authority_now := clock_timestamp();
    NEW."observed_at" := authority_now;
  END IF;
  NEW."created_at" := authority_now;

  IF NOT EXISTS (
    SELECT 1
    FROM "agent_versions" v
    JOIN "kernel_agents" a ON a."id" = v."agent_id"
    WHERE v."id" = NEW."agent_version_id"
      AND v."version" = NEW."agent_version"
      AND v."lifecycle_state" = 'WRITE_PREPARED' AND NOT v."published"
      AND v."adapter_key" = 'protected-a3'
      AND v."manifest_hash" = NEW."manifest_hash"
      AND v."capabilities" = NEW."capabilities"
      AND COALESCE(v."endpoint", v."adapter_key") = NEW."service"
      AND v."price_atomic" = NEW."price_atomic"
      AND lower(v."owner_wallet") = NEW."owner"
      AND lower(COALESCE(v."payout_address", v."owner_wallet")) = NEW."delegate"
      AND lower(COALESCE(v."payout_address", v."owner_wallet")) = NEW."payout"
      AND v."creator_parent" = NEW."creator_name"
      AND v."agent_label" = NEW."agent_label"
      AND v."full_subname" = NEW."agent_name"
      AND v."manifest"->'ensBinding'->>'creatorParent' = NEW."creator_name"
      AND v."manifest"->'ensBinding'->>'agentLabel' = NEW."agent_label"
      AND v."manifest"->'ensBinding'->>'fullSubname' = NEW."agent_name"
      AND v."manifest"->'ensBinding'->>'creatorDnsName' = NEW."creator_dns_name"
      AND v."manifest"->'ensBinding'->>'agentDnsName' = NEW."agent_dns_name"
  ) THEN
    RAISE EXCEPTION 'ENS publication decision does not match immutable version lineage' USING ERRCODE = '23514';
  END IF;

  binding_record := NEW."binding_bytes"::jsonb;
  expected_binding := jsonb_build_object(
    'schemaVersion', 1,
    'agentVersionId', NEW."agent_version_id"::text,
    'agentVersion', NEW."agent_version",
    'manifestHash', NEW."manifest_hash",
    'capabilities', to_jsonb(NEW."capabilities"),
    'service', NEW."service",
    'priceAtomic', NEW."price_atomic"::text,
    'payout', NEW."payout",
    'chainId', NEW."chain_id",
    'creatorName', NEW."creator_name",
    'creatorNode', NEW."creator_node",
    'creatorDnsName', NEW."creator_dns_name",
    'agentLabel', NEW."agent_label",
    'agentName', NEW."agent_name",
    'agentNode', NEW."agent_node",
    'agentDnsName', NEW."agent_dns_name",
    'owner', NEW."owner",
    'delegate', NEW."delegate",
    'rootRegistry', NEW."root_registry",
    'universalResolver', NEW."universal_resolver",
    'creatorCanonicalRegistry', NEW."creator_canonical_registry",
    'agentParentRegistry', NEW."agent_parent_registry",
    'agentCanonicalRegistry', NEW."agent_canonical_registry",
    'roles', NEW."roles",
    'externalGrants', NEW."external_grants",
    'parentExpiry', to_char(NEW."parent_expiry" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'agentExpiry', to_char(NEW."agent_expiry" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'parentLink', NEW."parent_link",
    'alias', NEW."alias",
    'creatorResolverAddress', NEW."creator_resolver_address",
    'resolverAddress', NEW."resolver_address",
    'resolverSuffix', NEW."resolver_suffix",
    'resolverMode', NEW."resolver_mode",
    'ccipGateway', NEW."ccip_gateway",
    'policyVersion', NEW."policy_version",
    'maxAgeSeconds', NEW."max_age_seconds"
  );
  IF binding_record <> expected_binding THEN
    RAISE EXCEPTION 'ENS publication binding bytes do not match decision columns' USING ERRCODE = '23514';
  END IF;
  IF encode(sha256(convert_to(NEW."binding_bytes", 'UTF8')), 'hex') <> NEW."binding_hash" THEN
    RAISE EXCEPTION 'ENS publication binding hash does not match canonical bytes' USING ERRCODE = '23514';
  END IF;
  IF NEW."record_bytes" IS NOT NULL AND
    encode(sha256(convert_to(NEW."record_bytes", 'UTF8')), 'hex') <> NEW."record_hash"
  THEN
    RAISE EXCEPTION 'ENS publication record hash does not match canonical bytes' USING ERRCODE = '23514';
  END IF;

  IF NEW."decision" = 'ALLOW' THEN
    authority_record := NEW."record_bytes"::jsonb;
    hierarchy := authority_record->'ensv2';
    IF authority_record->>'schemaVersion' <> '2'
      OR NOT authority_record ?& ARRAY[
        'schemaVersion', 'creator', 'agent', 'agentVersionId', 'agentVersion',
        'manifestHash', 'capabilities', 'service', 'chainId', 'payout', 'policyVersion',
        'freshUntil', 'creatorDnsName', 'agentLabel', 'agentDnsName', 'priceAtomic',
        'rootRegistry', 'universalResolver', 'ensv2'
      ]
      OR authority_record - ARRAY[
        'schemaVersion', 'creator', 'agent', 'agentVersionId', 'agentVersion',
        'manifestHash', 'capabilities', 'service', 'chainId', 'payout', 'policyVersion',
        'freshUntil', 'creatorDnsName', 'agentLabel', 'agentDnsName', 'priceAtomic',
        'rootRegistry', 'universalResolver', 'ensv2'
      ] <> '{}'::jsonb
      OR authority_record->>'agentVersionId' <> NEW."agent_version_id"::text
      OR (authority_record->>'agentVersion')::integer <> NEW."agent_version"
      OR authority_record->>'manifestHash' <> NEW."manifest_hash"
      OR authority_record->'capabilities' <> to_jsonb(NEW."capabilities")
      OR authority_record->>'service' <> NEW."service"
      OR (authority_record->>'chainId')::integer <> NEW."chain_id"
      OR authority_record->>'payout' <> NEW."payout"
      OR authority_record->>'policyVersion' <> NEW."policy_version"
      OR authority_record->>'creatorDnsName' <> NEW."creator_dns_name"
      OR authority_record->>'agentLabel' <> NEW."agent_label"
      OR authority_record->>'agentDnsName' <> NEW."agent_dns_name"
      OR authority_record->>'priceAtomic' <> NEW."price_atomic"::text
      OR lower(authority_record->>'rootRegistry') <> NEW."root_registry"
      OR lower(authority_record->>'universalResolver') <> NEW."universal_resolver"
      OR (authority_record->>'freshUntil')::timestamptz <> NEW."fresh_until"
      OR authority_record->'creator' <> jsonb_build_object(
        'name', NEW."creator_name", 'node', NEW."creator_node",
        'owner', NEW."owner", 'delegate', NEW."delegate",
        'registry', NEW."root_registry", 'resolver', NEW."creator_resolver_address"
      )
      OR authority_record->'agent' <> jsonb_build_object(
        'name', NEW."agent_name", 'node', NEW."agent_node",
        'owner', NEW."owner", 'delegate', NEW."delegate",
        'registry', NEW."root_registry", 'resolver', NEW."resolver_address"
      )
      OR hierarchy->'roles' <> NEW."roles"
      OR hierarchy->'externalGrants' <> NEW."external_grants"
      OR hierarchy->'parentLink' <> NEW."parent_link"
      OR (hierarchy->>'alias')::boolean <> NEW."alias"
      OR lower(hierarchy->>'creatorCanonicalRegistry') <> NEW."creator_canonical_registry"
      OR lower(hierarchy->>'agentParentRegistry') <> NEW."agent_parent_registry"
      OR lower(hierarchy->>'agentCanonicalRegistry') IS DISTINCT FROM NEW."agent_canonical_registry"
      OR lower(hierarchy->>'owner') <> NEW."owner"
      OR lower(hierarchy->>'delegate') <> NEW."delegate"
      OR (hierarchy->>'parentExpiry')::timestamptz <> NEW."parent_expiry"
      OR (hierarchy->>'agentExpiry')::timestamptz <> NEW."agent_expiry"
      OR lower(hierarchy->'resolver'->>'address') <> NEW."resolver_address"
      OR hierarchy->'resolver'->>'suffix' <> NEW."resolver_suffix"
      OR hierarchy->'resolver'->>'mode' <> NEW."resolver_mode"
      OR lower(hierarchy->'ccip'->>'universalResolver') <> NEW."universal_resolver"
      OR hierarchy->'ccip'->>'gateway' <> NEW."ccip_gateway"
      OR hierarchy->'ccip'->>'status' <> 'VERIFIED'
      OR hierarchy->'ccip'->>'responseHash' !~ '^[0-9a-f]{64}$'
    THEN
      RAISE EXCEPTION 'ENS publication ALLOW record is not exact' USING ERRCODE = '23514';
    END IF;
    IF NEW."block_timestamp" > authority_now
      OR authority_now - NEW."block_timestamp" > make_interval(secs => NEW."max_age_seconds")
      OR NEW."fresh_until" <= authority_now
      OR NEW."fresh_until" - NEW."block_timestamp" > make_interval(secs => NEW."max_age_seconds")
      OR NEW."parent_expiry" <= authority_now OR NEW."agent_expiry" <= authority_now
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(NEW."roles") role
        WHERE (role->>'expiresAt')::timestamptz <= authority_now
      )
    THEN
      RAISE EXCEPTION 'ENS publication ALLOW is stale, expired, or not current' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ens_publication_decisions_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "ens_publication_decisions"
FOR EACH ROW EXECUTE FUNCTION enforce_ens_publication_decision();
