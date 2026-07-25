-- W5 binds lifecycle action identity and immutable results to every protected
-- lifecycle event. Publication must additionally bind the exact successful
-- PUBLISH_VERSION action, W8 decision, and version state at deferred commit.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.agent_lifecycle_actions)
    OR EXISTS (SELECT 1 FROM public.agent_version_events)
    OR EXISTS (SELECT 1 FROM public.agent_versions WHERE lifecycle_state IS NOT NULL)
  THEN
    RAISE EXCEPTION 'existing protected lifecycle state requires explicit owner adjudication before W5 action integrity migration'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

ALTER TABLE public.agent_lifecycle_actions
  DROP CONSTRAINT agent_lifecycle_actions_completion_check,
  ADD COLUMN target_agent_version_id UUID,
  ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN attempt INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN lease_token UUID,
  ADD COLUMN lease_expires_at TIMESTAMPTZ(6),
  ADD COLUMN result_snapshot JSONB,
  ADD COLUMN result_hash TEXT,
  ADD COLUMN error_code TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  ADD CONSTRAINT agent_lifecycle_actions_target_version_fkey
    FOREIGN KEY (target_agent_version_id)
    REFERENCES public.agent_versions(id) ON DELETE RESTRICT,
  ADD CONSTRAINT agent_lifecycle_actions_status_check CHECK (
    status IN ('PENDING', 'SUCCEEDED', 'DENIED', 'RETRYABLE')
  ),
  ADD CONSTRAINT agent_lifecycle_actions_attempt_check CHECK (attempt >= 1),
  ADD CONSTRAINT agent_lifecycle_actions_result_hash_check CHECK (
    result_hash IS NULL OR result_hash ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT agent_lifecycle_actions_error_code_check CHECK (
    error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]{2,64}$'
  ),
  ADD CONSTRAINT agent_lifecycle_actions_target_check CHECK (
    (action = 'CREATE_DRAFT' AND target_agent_version_id IS NULL)
    OR (action <> 'CREATE_DRAFT' AND target_agent_version_id IS NOT NULL)
  ),
  ADD CONSTRAINT agent_lifecycle_actions_state_check CHECK (
    (
      status = 'PENDING' AND agent_version_id IS NULL AND completed_at IS NULL
      AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL
      AND result_snapshot IS NULL AND result_hash IS NULL AND error_code IS NULL
    ) OR (
      status = 'RETRYABLE' AND agent_version_id IS NULL AND completed_at IS NULL
      AND lease_token IS NULL AND lease_expires_at IS NOT NULL
      AND result_snapshot IS NULL AND result_hash IS NULL AND error_code IS NOT NULL
    ) OR (
      status = 'SUCCEEDED' AND agent_version_id IS NOT NULL AND completed_at IS NOT NULL
      AND lease_token IS NULL AND lease_expires_at IS NULL
      AND result_snapshot IS NOT NULL AND result_hash IS NOT NULL AND error_code IS NULL
    ) OR (
      status = 'DENIED' AND action = 'PUBLISH_VERSION'
      AND agent_version_id IS NOT NULL AND completed_at IS NOT NULL
      AND lease_token IS NULL AND lease_expires_at IS NULL
      AND result_snapshot IS NOT NULL AND result_hash IS NOT NULL AND error_code IS NOT NULL
    )
  );

ALTER TABLE public.agent_versions
  ADD COLUMN publication_action_id UUID,
  ADD CONSTRAINT agent_versions_publication_action_fkey
    FOREIGN KEY (publication_action_id)
    REFERENCES public.agent_lifecycle_actions(id) ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT agent_versions_publication_action_state_check CHECK (
    (lifecycle_state = 'PUBLISHED') = (publication_action_id IS NOT NULL)
    OR lifecycle_state IS NULL
  );

CREATE UNIQUE INDEX agent_versions_publication_action_key
  ON public.agent_versions(publication_action_id)
  WHERE publication_action_id IS NOT NULL;

CREATE UNIQUE INDEX agent_lifecycle_actions_success_version_key
  ON public.agent_lifecycle_actions(action, agent_version_id)
  WHERE status = 'SUCCEEDED';

ALTER TABLE public.agent_version_events
  ADD COLUMN lifecycle_action_id UUID,
  ADD CONSTRAINT agent_version_events_lifecycle_action_fkey
    FOREIGN KEY (lifecycle_action_id)
    REFERENCES public.agent_lifecycle_actions(id) ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  ALTER COLUMN lifecycle_action_id SET NOT NULL;

CREATE UNIQUE INDEX agent_version_events_lifecycle_action_key
  ON public.agent_version_events(lifecycle_action_id)
  WHERE lifecycle_action_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.canonical_kernel_json(input JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  output TEXT;
BEGIN
  CASE jsonb_typeof(input)
    WHEN 'object' THEN
      SELECT '{' || COALESCE(string_agg(
        to_jsonb(entry.key)::text || ':' || public.canonical_kernel_json(entry.value),
        ',' ORDER BY entry.key COLLATE "C"
      ), '') || '}'
      INTO output
      FROM jsonb_each(input) entry;
      RETURN output;
    WHEN 'array' THEN
      SELECT '[' || COALESCE(string_agg(
        public.canonical_kernel_json(entry.value),
        ',' ORDER BY entry.ordinality
      ), '') || ']'
      INTO output
      FROM jsonb_array_elements(input) WITH ORDINALITY entry(value, ordinality);
      RETURN output;
    ELSE
      RETURN input::text;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.kernel_lifecycle_hash(kind TEXT, value JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF kind !~ '^[a-z][a-z0-9-]{1,40}$' THEN
    RAISE EXCEPTION 'invalid kernel hash domain' USING ERRCODE = '23514';
  END IF;
  RETURN encode(sha256(convert_to(
    'alphadawg:a2:' || kind || ':v1:' || public.canonical_kernel_json(value),
    'UTF8'
  )), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_agent_lifecycle_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
SET "TimeZone" = 'UTC'
AS $$
DECLARE
  authority_now TIMESTAMPTZ := clock_timestamp();
  snapshot_version_id TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'PENDING' OR NEW.attempt <> 1
      OR NEW.agent_version_id IS NOT NULL OR NEW.completed_at IS NOT NULL
      OR NEW.result_snapshot IS NOT NULL OR NEW.result_hash IS NOT NULL
      OR NEW.error_code IS NOT NULL OR NEW.lease_token IS NULL
      OR NEW.lease_expires_at IS NULL OR NEW.lease_expires_at <= authority_now
      OR (
        NEW.target_agent_version_id IS NOT NULL AND NOT EXISTS (
          SELECT 1
          FROM public.agent_versions version
          JOIN public.kernel_agents agent ON agent.id = version.agent_id
          WHERE version.id = NEW.target_agent_version_id
            AND agent.owner_user_id = NEW.owner_user_id
        )
      )
    THEN
      RAISE EXCEPTION 'invalid lifecycle action claim' USING ERRCODE = '23514';
    END IF;
    NEW.created_at := authority_now;
    NEW.updated_at := authority_now;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'UPDATE'
    OR NEW.id <> OLD.id
    OR NEW.owner_user_id <> OLD.owner_user_id
    OR NEW.action <> OLD.action
    OR NEW.idempotency_key <> OLD.idempotency_key
    OR NEW.payload_hash <> OLD.payload_hash
    OR NEW.target_agent_version_id IS DISTINCT FROM OLD.target_agent_version_id
    OR NEW.created_at <> OLD.created_at
  THEN
    RAISE EXCEPTION 'lifecycle action identity is immutable' USING ERRCODE = '23514';
  END IF;

  IF OLD.status IN ('PENDING', 'RETRYABLE')
    AND OLD.lease_expires_at <= authority_now
    AND NEW.status = 'PENDING'
    AND NEW.attempt = OLD.attempt + 1
    AND NEW.lease_token IS NOT NULL
    AND NEW.lease_token IS DISTINCT FROM OLD.lease_token
    AND NEW.lease_expires_at > authority_now
    AND NEW.agent_version_id IS NULL AND NEW.completed_at IS NULL
    AND NEW.result_snapshot IS NULL AND NEW.result_hash IS NULL
    AND NEW.error_code IS NULL
  THEN
    NEW.updated_at := authority_now;
    RETURN NEW;
  END IF;

  IF OLD.status = 'PENDING'
    AND NEW.status = 'RETRYABLE'
    AND NEW.attempt = OLD.attempt
    AND NEW.lease_token IS NULL
    AND NEW.lease_expires_at > authority_now
    AND NEW.agent_version_id IS NULL AND NEW.completed_at IS NULL
    AND NEW.result_snapshot IS NULL AND NEW.result_hash IS NULL
    AND NEW.error_code ~ '^[A-Z][A-Z0-9_]{2,64}$'
  THEN
    NEW.updated_at := authority_now;
    RETURN NEW;
  END IF;

  IF OLD.status = 'PENDING'
    AND NEW.status IN ('SUCCEEDED', 'DENIED')
    AND NEW.attempt = OLD.attempt
    AND NEW.agent_version_id IS NOT NULL
    AND NEW.lease_token IS NULL AND NEW.lease_expires_at IS NULL
    AND NEW.result_snapshot IS NOT NULL AND NEW.result_hash IS NOT NULL
    AND pg_column_size(NEW.result_snapshot) <= 65536
    AND NEW.result_hash = public.kernel_lifecycle_hash(
      'agent-lifecycle-result', NEW.result_snapshot
    )
    AND EXISTS (
      SELECT 1
      FROM public.agent_versions version
      JOIN public.kernel_agents agent ON agent.id = version.agent_id
      WHERE version.id = NEW.agent_version_id
        AND agent.owner_user_id = NEW.owner_user_id
    )
    AND (
      NEW.target_agent_version_id IS NULL
      OR NEW.target_agent_version_id = NEW.agent_version_id
    )
  THEN
    IF NEW.result_snapshot->>'schemaVersion' <> '1'
      OR NEW.result_snapshot->>'action' <> NEW.action
    THEN
      RAISE EXCEPTION 'lifecycle result identity mismatch' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'SUCCEEDED' THEN
      IF NEW.error_code IS NOT NULL
        OR NEW.result_snapshot->>'outcome' <> 'SUCCESS'
        OR NOT (NEW.result_snapshot ?& ARRAY['schemaVersion', 'action', 'outcome', 'value'])
        OR NEW.result_snapshot - ARRAY['schemaVersion', 'action', 'outcome', 'value'] <> '{}'::jsonb
      THEN
        RAISE EXCEPTION 'invalid successful lifecycle result' USING ERRCODE = '23514';
      END IF;
      snapshot_version_id := CASE NEW.action
        WHEN 'PREPARE_ENS_WRITE' THEN NEW.result_snapshot#>>'{value,version,versionId}'
        ELSE NEW.result_snapshot#>>'{value,versionId}'
      END;
      IF snapshot_version_id IS DISTINCT FROM NEW.agent_version_id::text
        OR NEW.result_snapshot#>>'{value,ownedByViewer}' <> 'true'
        OR (
          NEW.action = 'CREATE_DRAFT'
          AND NEW.result_snapshot#>>'{value,lifecycleState}' <> 'DRAFT'
        ) OR (
          NEW.action = 'BIND_NAME'
          AND NEW.result_snapshot#>>'{value,lifecycleState}' <> 'NAME_BOUND'
        ) OR (
          NEW.action = 'PREPARE_ENS_WRITE'
          AND NEW.result_snapshot#>>'{value,version,lifecycleState}' <> 'WRITE_PREPARED'
        ) OR (
          NEW.action = 'PUBLISH_VERSION'
          AND NEW.result_snapshot#>>'{value,lifecycleState}' <> 'PUBLISHED'
        )
      THEN
        RAISE EXCEPTION 'lifecycle result does not match action version' USING ERRCODE = '23514';
      END IF;
    ELSE
      IF NEW.action <> 'PUBLISH_VERSION'
        OR NEW.error_code IS NULL
        OR NEW.result_snapshot->>'outcome' <> 'DENIED'
        OR NOT (NEW.result_snapshot ?& ARRAY['schemaVersion', 'action', 'outcome', 'error'])
        OR NEW.result_snapshot - ARRAY['schemaVersion', 'action', 'outcome', 'error'] <> '{}'::jsonb
        OR NEW.result_snapshot#>>'{error,reasonCode}' IS DISTINCT FROM NEW.error_code
        OR (NEW.result_snapshot#>>'{error,status}')::integer NOT BETWEEN 400 AND 599
      THEN
        RAISE EXCEPTION 'invalid denied lifecycle result' USING ERRCODE = '23514';
      END IF;
    END IF;
    NEW.completed_at := authority_now;
    NEW.updated_at := authority_now;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'invalid lifecycle action transition' USING ERRCODE = '23514';
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_agent_action_event_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  target_action_id UUID;
  action_row public.agent_lifecycle_actions%ROWTYPE;
  event_count INTEGER;
  event_row public.agent_version_events%ROWTYPE;
  version_row public.agent_versions%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME = 'agent_lifecycle_actions' THEN
    target_action_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'agent_version_events' THEN
    target_action_id := NEW.lifecycle_action_id;
  ELSE
    target_action_id := NEW.publication_action_id;
  END IF;
  IF target_action_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO action_row
  FROM public.agent_lifecycle_actions
  WHERE id = target_action_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lifecycle action reference is missing' USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer INTO event_count
  FROM public.agent_version_events event
  WHERE event.lifecycle_action_id = target_action_id;
  SELECT * INTO event_row
  FROM public.agent_version_events event
  WHERE event.lifecycle_action_id = target_action_id
  ORDER BY event.id
  LIMIT 1;

  IF action_row.status IN ('SUCCEEDED', 'DENIED') THEN
    SELECT * INTO version_row
    FROM public.agent_versions
    WHERE id = action_row.agent_version_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'completed lifecycle action version is missing' USING ERRCODE = '23514';
    END IF;
    IF event_count <> 1
      OR event_row.agent_version_id IS DISTINCT FROM action_row.agent_version_id
      OR event_row.action IS DISTINCT FROM (CASE
        WHEN action_row.status = 'DENIED' THEN 'PUBLISH_REFUSED'
        ELSE action_row.action
      END)
      OR event_row.payload->>'lifecycleActionId' IS DISTINCT FROM action_row.id::text
      OR event_row.payload->>'resultHash' IS DISTINCT FROM action_row.result_hash
    THEN
      RAISE EXCEPTION 'completed lifecycle action requires one matching event'
        USING ERRCODE = '23514';
    END IF;
    IF action_row.status = 'SUCCEEDED' AND action_row.action = 'CREATE_DRAFT' THEN
      IF version_row.lifecycle_state IS NULL
        OR event_row.payload IS DISTINCT FROM jsonb_build_object(
          'lifecycleActionId', action_row.id::text,
          'manifestHash', action_row.result_snapshot#>>'{value,manifestHash}',
          'resultHash', action_row.result_hash,
          'version', (action_row.result_snapshot#>>'{value,version}')::integer
        )
      THEN
        RAISE EXCEPTION 'create action requires matching version state and exact event'
          USING ERRCODE = '23514';
      END IF;
    ELSIF action_row.status = 'SUCCEEDED' AND action_row.action = 'BIND_NAME' THEN
      IF version_row.lifecycle_state NOT IN ('NAME_BOUND', 'WRITE_PREPARED', 'PUBLISHED')
        OR event_row.payload IS DISTINCT FROM jsonb_build_object(
          'creatorParent', action_row.result_snapshot#>>'{value,creatorParent}',
          'agentLabel', action_row.result_snapshot#>>'{value,agentLabel}',
          'fullSubname', action_row.result_snapshot#>>'{value,fullSubname}',
          'lifecycleActionId', action_row.id::text,
          'manifestHash', action_row.result_snapshot#>>'{value,manifestHash}',
          'resultHash', action_row.result_hash
        )
      THEN
        RAISE EXCEPTION 'bind action requires matching version state and exact event'
          USING ERRCODE = '23514';
      END IF;
    ELSIF action_row.status = 'SUCCEEDED' AND action_row.action = 'PREPARE_ENS_WRITE' THEN
      IF version_row.lifecycle_state NOT IN ('WRITE_PREPARED', 'PUBLISHED')
        OR event_row.payload IS DISTINCT FROM jsonb_build_object(
          'lifecycleActionId', action_row.id::text,
          'planHash', action_row.result_snapshot#>>'{value,planHash}',
          'resultHash', action_row.result_hash
        )
      THEN
        RAISE EXCEPTION 'prepare action requires matching version state and exact event'
          USING ERRCODE = '23514';
      END IF;
    ELSIF action_row.status = 'DENIED' THEN
      IF event_row.payload IS DISTINCT FROM jsonb_build_object(
          'errorCode', action_row.error_code,
          'lifecycleActionId', action_row.id::text,
          'resultHash', action_row.result_hash
        )
      THEN
        RAISE EXCEPTION 'denied publication action requires one exact refusal event'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  ELSIF event_count <> 0 THEN
    RAISE EXCEPTION 'incomplete lifecycle action cannot have an event'
      USING ERRCODE = '23514';
  END IF;

  IF action_row.action = 'PUBLISH_VERSION' THEN
    SELECT * INTO version_row
    FROM public.agent_versions
    WHERE id = COALESCE(action_row.agent_version_id, action_row.target_agent_version_id);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'publication action version is missing' USING ERRCODE = '23514';
    END IF;
    IF action_row.status = 'SUCCEEDED' THEN
      IF version_row.lifecycle_state <> 'PUBLISHED'
        OR version_row.publication_action_id IS DISTINCT FROM action_row.id
      THEN
        RAISE EXCEPTION 'successful publication action requires matching published state'
          USING ERRCODE = '23514';
      END IF;
    ELSIF action_row.status = 'DENIED' THEN
      IF version_row.lifecycle_state = 'PUBLISHED'
        OR version_row.publication_action_id IS NOT NULL
        OR version_row.authority_refusal IS DISTINCT FROM action_row.error_code
      THEN
        RAISE EXCEPTION 'denied publication action requires matching refusal state'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER agent_lifecycle_actions_event_integrity
AFTER INSERT OR UPDATE ON public.agent_lifecycle_actions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.enforce_agent_action_event_integrity();

CREATE CONSTRAINT TRIGGER agent_version_events_action_integrity
AFTER INSERT ON public.agent_version_events
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.enforce_agent_action_event_integrity();

CREATE CONSTRAINT TRIGGER agent_versions_action_integrity
AFTER INSERT OR UPDATE ON public.agent_versions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.enforce_agent_action_event_integrity();

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
  action_row public.agent_lifecycle_actions%ROWTYPE;
  publication_event_count INTEGER;
  publication_event_payload JSONB;
  publication_event_action_id UUID;
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

  SELECT count(*)::integer, (array_agg(payload ORDER BY id))[1],
         (array_agg(lifecycle_action_id ORDER BY id))[1]
    INTO publication_event_count, publication_event_payload, publication_event_action_id
  FROM public.agent_version_events
  WHERE agent_version_id = target_version_id AND action = 'PUBLISH_VERSION';

  IF version_row.lifecycle_state <> 'PUBLISHED' THEN
    IF version_row.publication_decision_id IS NOT NULL
      OR version_row.publication_action_id IS NOT NULL
      OR publication_event_count <> 0
    THEN
      RAISE EXCEPTION 'unpublished version cannot retain publication authority action or event'
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

  SELECT action.* INTO action_row
  FROM public.agent_lifecycle_actions action
  JOIN public.kernel_agents agent ON agent.id = version_row.agent_id
  WHERE action.id = version_row.publication_action_id
    AND action.action = 'PUBLISH_VERSION'
    AND action.status = 'SUCCEEDED'
    AND action.owner_user_id = agent.owner_user_id
    AND action.target_agent_version_id = version_row.id
    AND action.agent_version_id = version_row.id
    AND action.payload_hash = public.kernel_lifecycle_hash(
      'agent-lifecycle-action',
      jsonb_build_object(
        'action', 'PUBLISH_VERSION',
        'ownerUserId', agent.owner_user_id,
        'payload', jsonb_build_object('versionId', version_row.id::text)
      )
    )
    AND action.result_hash = public.kernel_lifecycle_hash(
      'agent-lifecycle-result', action.result_snapshot
    )
    AND action.result_snapshot#>>'{value,versionId}' = version_row.id::text
    AND action.result_snapshot#>>'{value,publicationDecisionId}' = decision_row.id::text
    AND action.result_snapshot#>>'{value,manifestHash}' = version_row.manifest_hash
    AND action.result_snapshot#>>'{value,lifecycleState}' = 'PUBLISHED'
    AND action.result_snapshot#>>'{value,hireable}' = 'true'
    AND action.result_snapshot#>>'{value,canonicalState}' = 'CANONICAL'
    AND action.result_snapshot#>>'{value,authorityOwner}' = decision_row.owner
    AND action.result_snapshot#>>'{value,authorityPolicyVersion}' = decision_row.policy_version
    AND action.result_snapshot#>>'{value,authorityReleaseSha}' = decision_row.release_sha
    AND action.result_snapshot#>>'{value,publishedAt}' = to_char(
      date_trunc('milliseconds', version_row.published_at) AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'published version requires one completed owner-matching publication action'
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
  IF publication_event_count <> 1
    OR publication_event_action_id IS DISTINCT FROM action_row.id
    OR publication_event_payload IS DISTINCT FROM jsonb_build_object(
      'lifecycleActionId', action_row.id::text,
      'manifestHash', decision_row.manifest_hash,
      'policyVersion', decision_row.policy_version,
      'publicationDecisionId', decision_row.id::text,
      'recordHash', decision_row.record_hash,
      'releaseSha', decision_row.release_sha,
      'resultHash', action_row.result_hash
    )
  THEN
    RAISE EXCEPTION 'published version requires one exact action-bound PUBLISH_VERSION event'
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

COMMENT ON FUNCTION public.canonical_kernel_json(JSONB)
  IS 'alphadawg:a4-kernel-action-integrity:v1';
COMMENT ON FUNCTION public.enforce_agent_publication_integrity()
  IS 'alphadawg:a4-kernel-action-integrity:v1';
