-- Kernel publication consumes only accepted W8 ENS decisions. Publication,
-- its append-only event, and the lifecycle transition must agree at commit.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.agent_versions
    WHERE lifecycle_state = 'PUBLISHED'
  ) THEN
    RAISE EXCEPTION 'existing protected publication requires explicit owner adjudication before integrity migration'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

ALTER TABLE public.agent_versions
  ADD COLUMN publication_decision_id UUID,
  ADD CONSTRAINT agent_versions_publication_decision_fkey
    FOREIGN KEY (publication_decision_id)
    REFERENCES public.ens_publication_decisions(id) ON DELETE RESTRICT,
  ADD CONSTRAINT agent_versions_publication_decision_state_check CHECK (
    (lifecycle_state = 'PUBLISHED') = (publication_decision_id IS NOT NULL)
    OR lifecycle_state IS NULL
  );

CREATE UNIQUE INDEX agent_versions_publication_decision_key
  ON public.agent_versions(publication_decision_id)
  WHERE publication_decision_id IS NOT NULL;

CREATE TABLE public.agent_lifecycle_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  agent_version_id UUID,
  completed_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),

  CONSTRAINT agent_lifecycle_actions_pkey PRIMARY KEY (id),
  CONSTRAINT agent_lifecycle_actions_owner_fkey FOREIGN KEY (owner_user_id)
    REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT agent_lifecycle_actions_version_fkey FOREIGN KEY (agent_version_id)
    REFERENCES public.agent_versions(id) ON DELETE RESTRICT,
  CONSTRAINT agent_lifecycle_actions_action_check CHECK (
    action IN ('CREATE_DRAFT', 'BIND_NAME', 'PREPARE_ENS_WRITE', 'PUBLISH_VERSION')
  ),
  CONSTRAINT agent_lifecycle_actions_key_check CHECK (
    idempotency_key ~ '^[A-Za-z0-9._:-]{8,128}$'
  ),
  CONSTRAINT agent_lifecycle_actions_hash_check CHECK (
    payload_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT agent_lifecycle_actions_completion_check CHECK (
    (agent_version_id IS NULL AND completed_at IS NULL)
    OR (agent_version_id IS NOT NULL AND completed_at IS NOT NULL AND completed_at >= created_at)
  ),
  CONSTRAINT agent_lifecycle_actions_owner_action_key UNIQUE (
    owner_user_id, action, idempotency_key
  )
);

CREATE INDEX idx_agent_lifecycle_actions_version_created
  ON public.agent_lifecycle_actions(agent_version_id, created_at);

CREATE OR REPLACE FUNCTION public.enforce_agent_lifecycle_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.agent_version_id IS NOT NULL OR NEW.completed_at IS NOT NULL THEN
      RAISE EXCEPTION 'lifecycle action must start incomplete' USING ERRCODE = '23514';
    END IF;
    NEW.created_at := clock_timestamp();
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
    AND OLD.agent_version_id IS NULL AND OLD.completed_at IS NULL
    AND NEW.agent_version_id IS NOT NULL AND NEW.completed_at IS NOT NULL
    AND NEW.id = OLD.id
    AND NEW.owner_user_id = OLD.owner_user_id
    AND NEW.action = OLD.action
    AND NEW.idempotency_key = OLD.idempotency_key
    AND NEW.payload_hash = OLD.payload_hash
    AND NEW.created_at = OLD.created_at
    AND EXISTS (
      SELECT 1
      FROM public.agent_versions v
      JOIN public.kernel_agents a ON a.id = v.agent_id
      WHERE v.id = NEW.agent_version_id AND a.owner_user_id = NEW.owner_user_id
    )
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'lifecycle actions are immutable after completion' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER agent_lifecycle_actions_integrity
BEFORE INSERT OR UPDATE OR DELETE ON public.agent_lifecycle_actions
FOR EACH ROW EXECUTE FUNCTION public.enforce_agent_lifecycle_action();

CREATE TRIGGER agent_lifecycle_actions_no_truncate
BEFORE TRUNCATE ON public.agent_lifecycle_actions
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_agent_lifecycle_action();

CREATE OR REPLACE FUNCTION public.enforce_agent_publication_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
SET "TimeZone" = 'UTC'
AS $$
DECLARE
  target_version_id UUID;
  version_row public.agent_versions%ROWTYPE;
  decision_row public.ens_publication_decisions%ROWTYPE;
  publication_event_count INTEGER;
  publication_event_payload JSONB;
  authority_now TIMESTAMPTZ;
BEGIN
  IF TG_TABLE_NAME = 'agent_version_events' THEN
    target_version_id := NEW.agent_version_id;
  ELSE
    target_version_id := NEW.id;
  END IF;
  SELECT * INTO version_row
  FROM public.agent_versions
  WHERE id = target_version_id;
  IF NOT FOUND OR version_row.lifecycle_state IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*)::integer, (array_agg(payload ORDER BY id))[1]
    INTO publication_event_count, publication_event_payload
  FROM public.agent_version_events
  WHERE agent_version_id = target_version_id AND action = 'PUBLISH_VERSION';

  IF version_row.lifecycle_state <> 'PUBLISHED' THEN
    IF version_row.publication_decision_id IS NOT NULL OR publication_event_count <> 0 THEN
      RAISE EXCEPTION 'unpublished version cannot retain publication authority or event'
        USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
  END IF;

  authority_now := clock_timestamp();
  SELECT d.* INTO decision_row
  FROM public.ens_publication_decisions d
  JOIN public.ens_publication_authority_policies p
    ON p.release_sha = d.release_sha
   AND p.agent_version_id = d.agent_version_id
   AND p.binding_hash = d.binding_hash
   AND p.binding = d.binding_bytes::jsonb
  JOIN public.ens_publication_authority_releases r ON r.release_sha = d.release_sha
  WHERE d.id = version_row.publication_decision_id
    AND d.agent_version_id = version_row.id
    AND d.decision = 'ALLOW' AND d.error_code IS NULL
    AND d.record_bytes IS NOT NULL AND d.record_hash IS NOT NULL
    AND d.agent_version = version_row.version
    AND d.manifest_hash = version_row.manifest_hash
    AND d.capabilities = version_row.capabilities
    AND d.service = COALESCE(version_row.endpoint, version_row.adapter_key)
    AND d.price_atomic = version_row.price_atomic
    AND d.payout = lower(COALESCE(version_row.payout_address, version_row.owner_wallet))
    AND d.creator_name = version_row.creator_parent
    AND d.agent_label = version_row.agent_label
    AND d.agent_name = version_row.full_subname
    AND d.creator_dns_name = version_row.manifest->'ensBinding'->>'creatorDnsName'
    AND d.agent_dns_name = version_row.manifest->'ensBinding'->>'agentDnsName'
    AND d.owner = lower(version_row.owner_wallet)
    AND d.delegate = lower(COALESCE(version_row.payout_address, version_row.owner_wallet))
    AND d.chain_id = (p.binding->>'chainId')::integer
    AND d.root_registry = lower(p.binding->>'rootRegistry')
    AND d.universal_resolver = lower(p.binding->>'universalResolver')
    AND d.creator_canonical_registry = lower(p.binding->>'creatorCanonicalRegistry')
    AND d.agent_parent_registry = lower(p.binding->>'agentParentRegistry')
    AND d.agent_canonical_registry IS NOT DISTINCT FROM lower(p.binding->>'agentCanonicalRegistry')
    AND d.roles = p.binding->'roles'
    AND d.external_grants = p.binding->'externalGrants'
    AND d.parent_link = p.binding->'parentLink'
    AND d.alias = false
    AND d.creator_resolver_address = lower(p.binding->>'creatorResolverAddress')
    AND d.resolver_address = lower(p.binding->>'resolverAddress')
    AND d.resolver_suffix = p.binding->>'resolverSuffix'
    AND d.resolver_mode = p.binding->>'resolverMode'
    AND d.ccip_gateway = p.binding->>'ccipGateway'
    AND d.policy_version = p.binding->>'policyVersion'
    AND r.not_before <= authority_now AND r.expires_at > authority_now
    AND d.observed_at <= authority_now AND d.fresh_until > authority_now
    AND authority_now - d.observed_at <= make_interval(secs => d.max_age_seconds)
    AND d.parent_expiry > authority_now AND d.agent_expiry > authority_now
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(d.roles) role
      WHERE (role->>'expiresAt')::timestamptz <= authority_now
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'published version requires a fresh exact accepted A4 decision'
      USING ERRCODE = '23514';
  END IF;

  IF obj_description(
      to_regprocedure('public.admit_ens_publication_decision(uuid,jsonb,numeric,timestamptz,text,text)'),
      'pg_proc'
    ) IS DISTINCT FROM 'alphadawg:a4-publication-upgrade-preflight:v1'
  THEN
    RAISE EXCEPTION 'published version requires W8 publication readiness'
      USING ERRCODE = '23514';
  END IF;
  IF publication_event_count <> 1 OR publication_event_payload IS DISTINCT FROM jsonb_build_object(
    'manifestHash', decision_row.manifest_hash,
    'policyVersion', decision_row.policy_version,
    'publicationDecisionId', decision_row.id::text,
    'recordHash', decision_row.record_hash,
    'releaseSha', decision_row.release_sha
  ) THEN
    RAISE EXCEPTION 'published version requires one exact PUBLISH_VERSION event'
      USING ERRCODE = '23514';
  END IF;
  IF version_row.canonical_state <> 'CANONICAL'
    OR NOT version_row.published
    OR version_row.published_at IS NULL
    OR version_row.authority_owner IS DISTINCT FROM decision_row.owner
    OR version_row.authority_delegate IS DISTINCT FROM decision_row.delegate
    OR version_row.authority_policy_version IS DISTINCT FROM decision_row.policy_version
    OR version_row.authority_record_hash IS DISTINCT FROM decision_row.record_hash
    OR version_row.authority_observed_at IS DISTINCT FROM decision_row.observed_at
    OR version_row.authority_fresh_until IS DISTINCT FROM decision_row.fresh_until
    OR version_row.authority_release_sha IS DISTINCT FROM decision_row.release_sha
    OR version_row.authority_refusal IS NOT NULL
    OR version_row.published_at < decision_row.observed_at
  THEN
    RAISE EXCEPTION 'published version fields do not match accepted A4 decision'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER agent_versions_publication_integrity
AFTER INSERT OR UPDATE ON public.agent_versions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.enforce_agent_publication_integrity();

CREATE CONSTRAINT TRIGGER agent_version_events_publication_integrity
AFTER INSERT ON public.agent_version_events
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.enforce_agent_publication_integrity();
