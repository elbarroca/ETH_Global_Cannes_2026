-- Additive wallet-authority publication. ENS publication remains intact for
-- existing records, but new wallet publications never create or reference ENS evidence.

ALTER TABLE public.agent_versions
  ADD COLUMN publication_mode TEXT,
  ADD COLUMN agent_wallet_id UUID,
  ADD COLUMN wallet_publication_decision_id UUID;

ALTER TABLE public.agent_versions DISABLE TRIGGER agent_versions_immutable_published;
UPDATE public.agent_versions
SET publication_mode = 'ENS'
WHERE lifecycle_state = 'PUBLISHED';
ALTER TABLE public.agent_versions ENABLE TRIGGER agent_versions_immutable_published;

ALTER TABLE public.agent_lifecycle_actions
  DROP CONSTRAINT agent_lifecycle_actions_action_check,
  ADD CONSTRAINT agent_lifecycle_actions_action_check CHECK (action IN (
    'CREATE_DRAFT', 'ATTACH_AGENT_WALLET', 'BIND_NAME', 'PREPARE_ENS_WRITE',
    'PUBLISH_VERSION', 'PUBLISH_WALLET_VERSION'
  ));

ALTER TABLE public.agent_version_events
  DROP CONSTRAINT agent_version_events_action_check,
  ADD CONSTRAINT agent_version_events_action_check CHECK (action IN (
    'CREATE_DRAFT', 'ATTACH_AGENT_WALLET', 'BIND_NAME', 'PREPARE_ENS_WRITE',
    'PUBLISH_REFUSED', 'PUBLISH_VERSION', 'PUBLISH_WALLET_VERSION'
  ));

CREATE TABLE public.agent_wallet_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL UNIQUE REFERENCES public.kernel_agents(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  provider_wallet_id UUID NOT NULL UNIQUE,
  address TEXT NOT NULL UNIQUE,
  network TEXT NOT NULL,
  account_type TEXT NOT NULL,
  state TEXT NOT NULL,
  evidence_hash TEXT NOT NULL,
  identity_hash TEXT NOT NULL UNIQUE,
  observed_at TIMESTAMPTZ(6) NOT NULL,
  attached_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  lifecycle_action_id UUID NOT NULL UNIQUE
    REFERENCES public.agent_lifecycle_actions(id) ON DELETE RESTRICT,
  CONSTRAINT agent_wallet_identities_shape_check CHECK (
    provider = 'circle' AND address ~ '^0x[0-9a-f]{40}$'
    AND address <> '0x0000000000000000000000000000000000000000'
    AND network = 'UNI-SEPOLIA' AND account_type = 'SCA' AND state = 'LIVE'
    AND evidence_hash ~ '^[0-9a-f]{64}$' AND identity_hash ~ '^[0-9a-f]{64}$'
    AND observed_at <= attached_at
  )
);

ALTER TABLE public.agent_versions
  ADD CONSTRAINT agent_versions_agent_wallet_fkey
    FOREIGN KEY (agent_wallet_id) REFERENCES public.agent_wallet_identities(id) ON DELETE RESTRICT;

CREATE TABLE public.wallet_publication_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_key TEXT NOT NULL UNIQUE,
  agent_version_id UUID NOT NULL UNIQUE
    REFERENCES public.agent_versions(id) ON DELETE RESTRICT,
  agent_wallet_id UUID NOT NULL
    REFERENCES public.agent_wallet_identities(id) ON DELETE RESTRICT,
  publication_action_id UUID NOT NULL UNIQUE
    REFERENCES public.agent_lifecycle_actions(id) ON DELETE RESTRICT,
  agent_version INTEGER NOT NULL,
  manifest_hash TEXT NOT NULL,
  capabilities TEXT[] NOT NULL,
  service TEXT NOT NULL,
  adapter_key TEXT NOT NULL,
  proof_policy TEXT NOT NULL,
  price_atomic BIGINT NOT NULL,
  asset TEXT NOT NULL,
  payout TEXT NOT NULL,
  creator_user_id TEXT NOT NULL,
  creator_wallet TEXT NOT NULL,
  wallet_identity_hash TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_wallet_id UUID NOT NULL,
  wallet_address TEXT NOT NULL,
  network TEXT NOT NULL,
  account_type TEXT NOT NULL,
  wallet_state TEXT NOT NULL,
  release_sha TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  decision TEXT NOT NULL,
  receipt_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT wallet_publication_decisions_shape_check CHECK (
    agent_version > 0 AND manifest_hash ~ '^[0-9a-f]{64}$'
    AND cardinality(capabilities) BETWEEN 1 AND 3
    AND adapter_key = 'protected-a3' AND proof_policy = 'verified-receipt-required'
    AND price_atomic > 0 AND asset = 'USDC_ATOMIC'
    AND payout ~ '^0x[0-9a-f]{40}$' AND creator_wallet ~ '^0x[0-9a-f]{40}$'
    AND wallet_identity_hash ~ '^[0-9a-f]{64}$'
    AND provider = 'circle' AND wallet_address ~ '^0x[0-9a-f]{40}$'
    AND wallet_address <> '0x0000000000000000000000000000000000000000'
    AND network = 'UNI-SEPOLIA' AND account_type = 'SCA' AND wallet_state = 'LIVE'
    AND release_sha ~ '^[0-9a-f]{40}$'
    AND policy_version = 'wallet-publication-v1' AND decision = 'WALLET_AUTHORIZED'
    AND decision_key ~ '^[0-9a-f]{64}$' AND receipt_hash ~ '^[0-9a-f]{64}$'
  )
);

ALTER TABLE public.agent_versions
  ADD CONSTRAINT agent_versions_wallet_publication_decision_fkey
    FOREIGN KEY (wallet_publication_decision_id)
    REFERENCES public.wallet_publication_decisions(id) ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED;

CREATE UNIQUE INDEX agent_versions_wallet_publication_decision_key
  ON public.agent_versions(wallet_publication_decision_id)
  WHERE wallet_publication_decision_id IS NOT NULL;
CREATE INDEX idx_agent_wallet_identities_attached
  ON public.agent_wallet_identities(attached_at, id);
CREATE INDEX idx_wallet_publication_decisions_created
  ON public.wallet_publication_decisions(created_at, id);

CREATE OR REPLACE FUNCTION public.enforce_agent_wallet_identity()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
SET "TimeZone" = 'UTC'
AS $$
DECLARE action_row public.agent_lifecycle_actions%ROWTYPE;
DECLARE version_row public.agent_versions%ROWTYPE;
DECLARE owner_user_id TEXT;
DECLARE authority_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'agent wallet identities are append-only' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO action_row FROM public.agent_lifecycle_actions
  WHERE id = NEW.lifecycle_action_id FOR SHARE;
  SELECT version.* INTO version_row
  FROM public.agent_versions version
  WHERE version.id = action_row.target_agent_version_id FOR SHARE;
  SELECT agent.owner_user_id INTO owner_user_id
  FROM public.kernel_agents agent WHERE agent.id = version_row.agent_id;
  IF action_row.id IS NULL OR version_row.id IS NULL
    OR action_row.action <> 'ATTACH_AGENT_WALLET' OR action_row.status <> 'PENDING'
    OR action_row.owner_user_id <> owner_user_id
    OR action_row.target_agent_version_id <> version_row.id
    OR action_row.lease_token IS NULL OR action_row.lease_expires_at <= authority_now
    OR version_row.lifecycle_state <> 'DRAFT' OR version_row.published
    OR version_row.agent_id <> NEW.agent_id OR version_row.agent_wallet_id IS NOT NULL
    OR NEW.observed_at > authority_now
    OR authority_now - NEW.observed_at > interval '5 minutes'
    OR NEW.identity_hash <> public.kernel_lifecycle_hash(
      'agent-wallet-identity', jsonb_build_object(
        'provider', NEW.provider, 'walletId', NEW.provider_wallet_id::text,
        'address', NEW.address, 'network', NEW.network,
        'accountType', NEW.account_type, 'state', NEW.state,
        'evidenceHash', NEW.evidence_hash,
        'observedAt', to_char(NEW.observed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
    )
  THEN RAISE EXCEPTION 'agent wallet identity is not an exact live attachment'
    USING ERRCODE = '23514'; END IF;
  NEW.attached_at := authority_now;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agent_wallet_identities_integrity
BEFORE INSERT OR UPDATE OR DELETE ON public.agent_wallet_identities
FOR EACH ROW EXECUTE FUNCTION public.enforce_agent_wallet_identity();
CREATE TRIGGER agent_wallet_identities_no_truncate
BEFORE TRUNCATE ON public.agent_wallet_identities
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_agent_wallet_identity();

CREATE OR REPLACE FUNCTION public.enforce_wallet_publication_decision()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
SET "TimeZone" = 'UTC'
AS $$
DECLARE version_row public.agent_versions%ROWTYPE;
DECLARE wallet_row public.agent_wallet_identities%ROWTYPE;
DECLARE action_row public.agent_lifecycle_actions%ROWTYPE;
DECLARE owner_user_id TEXT;
DECLARE expected_key TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'wallet publication decisions are append-only' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO version_row FROM public.agent_versions
  WHERE id = NEW.agent_version_id FOR SHARE;
  SELECT agent.owner_user_id INTO owner_user_id FROM public.kernel_agents agent
  WHERE agent.id = version_row.agent_id;
  SELECT * INTO wallet_row FROM public.agent_wallet_identities
  WHERE id = NEW.agent_wallet_id FOR SHARE;
  SELECT * INTO action_row FROM public.agent_lifecycle_actions
  WHERE id = NEW.publication_action_id FOR SHARE;
  IF version_row.id IS NULL OR wallet_row.id IS NULL OR action_row.id IS NULL
    OR version_row.lifecycle_state <> 'WALLET_ATTACHED' OR version_row.published
    OR version_row.agent_wallet_id <> wallet_row.id OR wallet_row.agent_id <> version_row.agent_id
    OR action_row.action <> 'PUBLISH_WALLET_VERSION' OR action_row.status <> 'PENDING'
    OR action_row.owner_user_id <> owner_user_id
    OR action_row.target_agent_version_id <> version_row.id
    OR action_row.lease_token IS NULL OR action_row.lease_expires_at <= clock_timestamp()
    OR NEW.agent_version <> version_row.version OR NEW.manifest_hash <> version_row.manifest_hash
    OR NEW.capabilities <> version_row.capabilities
    OR NEW.service <> COALESCE(version_row.endpoint, version_row.adapter_key)
    OR NEW.adapter_key <> version_row.adapter_key OR NEW.proof_policy <> version_row.proof_policy
    OR NEW.price_atomic <> version_row.price_atomic OR NEW.asset <> version_row.asset
    OR NEW.payout <> lower(COALESCE(version_row.payout_address, version_row.owner_wallet))
    OR NEW.creator_user_id <> owner_user_id OR NEW.creator_wallet <> lower(version_row.owner_wallet)
    OR NEW.wallet_identity_hash <> wallet_row.identity_hash
    OR NEW.provider <> wallet_row.provider OR NEW.provider_wallet_id <> wallet_row.provider_wallet_id
    OR NEW.wallet_address <> wallet_row.address OR NEW.network <> wallet_row.network
    OR NEW.account_type <> wallet_row.account_type OR NEW.wallet_state <> wallet_row.state
    OR NEW.release_sha !~ '^[0-9a-f]{40}$'
  THEN RAISE EXCEPTION 'wallet publication decision does not match immutable wallet/version lineage'
    USING ERRCODE = '23514'; END IF;
  expected_key := public.kernel_lifecycle_hash(
    'wallet-publication-decision', jsonb_build_object(
      'agentVersionId', NEW.agent_version_id::text,
      'agentWalletId', NEW.agent_wallet_id::text,
      'publicationActionId', NEW.publication_action_id::text,
      'agentVersion', NEW.agent_version, 'manifestHash', NEW.manifest_hash,
      'capabilities', to_jsonb(NEW.capabilities), 'service', NEW.service,
      'adapterKey', NEW.adapter_key, 'proofPolicy', NEW.proof_policy,
      'priceAtomic', NEW.price_atomic::text, 'asset', NEW.asset, 'payout', NEW.payout,
      'creatorUserId', NEW.creator_user_id, 'creatorWallet', NEW.creator_wallet,
      'walletIdentityHash', NEW.wallet_identity_hash, 'provider', NEW.provider,
      'providerWalletId', NEW.provider_wallet_id::text, 'walletAddress', NEW.wallet_address,
      'network', NEW.network, 'accountType', NEW.account_type,
      'walletState', NEW.wallet_state, 'releaseSha', NEW.release_sha,
      'policyVersion', NEW.policy_version,
      'decision', NEW.decision
    )
  );
  NEW.decision_key := expected_key;
  NEW.receipt_hash := public.kernel_lifecycle_hash(
    'wallet-publication-receipt', jsonb_build_object(
      'decisionKey', expected_key, 'agentVersionId', NEW.agent_version_id::text,
      'walletIdentityHash', NEW.wallet_identity_hash, 'manifestHash', NEW.manifest_hash,
      'decision', NEW.decision, 'policyVersion', NEW.policy_version
    )
  );
  NEW.created_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER wallet_publication_decisions_integrity
BEFORE INSERT OR UPDATE OR DELETE ON public.wallet_publication_decisions
FOR EACH ROW EXECUTE FUNCTION public.enforce_wallet_publication_decision();
CREATE TRIGGER wallet_publication_decisions_no_truncate
BEFORE TRUNCATE ON public.wallet_publication_decisions
FOR EACH STATEMENT EXECUTE FUNCTION public.enforce_wallet_publication_decision();

ALTER TABLE public.agent_versions
  DROP CONSTRAINT agent_versions_manifest_v2_shape_check,
  ADD CONSTRAINT agent_versions_manifest_v2_shape_check CHECK (
    manifest->>'schemaVersion' <> '2' OR (
      manifest->>'adapterKey' = 'protected-a3'
      AND manifest->'endpoint' = 'null'::jsonb
      AND manifest->'connectorKey' = 'null'::jsonb
      AND manifest->>'ownerWallet' = lower(owner_wallet)
      AND manifest->>'payoutAddress' = lower(payout_address)
      AND payout_address IS NOT NULL
      AND price_atomic = 1000 AND manifest->>'priceAtomic' = '1000'
      AND asset = 'USDC_ATOMIC' AND manifest->>'asset' = 'USDC_ATOMIC'
      AND proof_policy = 'verified-receipt-required'
      AND manifest->>'proofPolicy' = 'verified-receipt-required'
      AND jsonb_typeof(manifest->'mcp') = 'array'
      AND jsonb_array_length(manifest->'mcp') BETWEEN 0 AND 4
      AND jsonb_typeof(manifest->'skills') = 'array'
      AND jsonb_array_length(manifest->'skills') BETWEEN 1 AND 4
      AND jsonb_typeof(manifest->'nativeConnections') = 'array'
      AND manifest->>'reviewedPromptHash' ~ '^[0-9a-f]{64}$'
      AND manifest->>'reviewedConfigHash' ~ '^[0-9a-f]{64}$'
      AND (
        (manifest->'ensBinding' = 'null'::jsonb AND manifest->'ensBindingHash' = 'null'::jsonb)
        OR (jsonb_typeof(manifest->'ensBinding') = 'object'
          AND manifest->>'ensBindingHash' ~ '^[0-9a-f]{64}$')
      )
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_creator_manifest_mcp()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE binding JSONB;
DECLARE binding_ids TEXT[];
BEGIN
  IF NEW.manifest->>'schemaVersion' <> '2' THEN RETURN NEW; END IF;
  binding_ids := ARRAY(
    SELECT value->>'id'
    FROM jsonb_array_elements(NEW.manifest->'mcp') WITH ORDINALITY entry(value, ordinality)
    ORDER BY ordinality
  );
  FOR binding IN SELECT value FROM jsonb_array_elements(NEW.manifest->'mcp') value LOOP
    IF binding - ARRAY[
        'schemaVersion','id','provider','capability','access','timeoutMs','maxResponseBytes'
      ] <> '{}'::jsonb
      OR NOT (binding ?& ARRAY[
        'schemaVersion','id','provider','capability','access','timeoutMs','maxResponseBytes'
      ])
      OR binding->'schemaVersion' <> '1'::jsonb
      OR binding->>'access' <> 'read-only'
      OR binding->'timeoutMs' <> '8000'::jsonb
      OR binding->'maxResponseBytes' <> '32768'::jsonb
      OR binding->>'id' <> 'mcp.' || binding->>'provider' || '.' || binding->>'capability'
      OR NOT (
        (binding->>'provider' = 'coingecko'
          AND binding->>'capability' IN ('spot-price','market-snapshot'))
        OR (binding->>'provider' = 'the-graph'
          AND binding->>'capability' IN ('pinned-deployment-lookup','liquidity-volume-snapshot'))
      )
    THEN RAISE EXCEPTION 'creator manifest contains an unallowlisted MCP binding'
      USING ERRCODE = '23514'; END IF;
  END LOOP;
  IF cardinality(binding_ids) <> cardinality(ARRAY(SELECT DISTINCT unnest(binding_ids)))
    OR binding_ids IS DISTINCT FROM ARRAY(
      SELECT value->>'id' FROM jsonb_array_elements(NEW.manifest->'mcp') value
      ORDER BY CASE value->>'id'
        WHEN 'mcp.coingecko.spot-price' THEN 1
        WHEN 'mcp.coingecko.market-snapshot' THEN 2
        WHEN 'mcp.the-graph.pinned-deployment-lookup' THEN 3
        WHEN 'mcp.the-graph.liquidity-volume-snapshot' THEN 4
        ELSE 99
      END
    )
  THEN RAISE EXCEPTION 'creator manifest MCP bindings must be unique and server ordered'
    USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agent_versions_creator_manifest_mcp
BEFORE INSERT OR UPDATE ON public.agent_versions
FOR EACH ROW EXECUTE FUNCTION public.enforce_creator_manifest_mcp();

DO $patch_mcp_lineage$
DECLARE definition TEXT;
DECLARE changed TEXT;
BEGIN
  SELECT pg_get_functiondef('public.enforce_mcp_invocation_lineage()'::regprocedure)
  INTO definition;
  changed := replace(definition, $$NOT IN ('3','4','5')$$, $$NOT IN ('2','3','4','5')$$);
  IF changed = definition THEN RAISE EXCEPTION 'MCP lineage version guard changed unexpectedly'; END IF;
  EXECUTE changed;
END;
$patch_mcp_lineage$;

ALTER TABLE public.agent_versions
  DROP CONSTRAINT agent_versions_lifecycle_state_check,
  DROP CONSTRAINT agent_versions_canonical_state_check,
  DROP CONSTRAINT agent_versions_protected_publish_check,
  DROP CONSTRAINT agent_versions_publication_decision_state_check,
  DROP CONSTRAINT agent_versions_publication_action_state_check,
  ADD CONSTRAINT agent_versions_lifecycle_state_check CHECK (
    lifecycle_state IS NULL OR lifecycle_state IN (
      'DRAFT', 'WALLET_ATTACHED', 'NAME_BOUND', 'WRITE_PREPARED', 'PUBLISHED'
    )
  ),
  ADD CONSTRAINT agent_versions_canonical_state_check CHECK (
    canonical_state IN ('UNVERIFIED', 'CANONICAL', 'WALLET_AUTHORIZED', 'REFUSED')
  ),
  ADD CONSTRAINT agent_versions_publication_mode_check CHECK (
    publication_mode IS NULL OR publication_mode IN ('ENS', 'WALLET')
  ),
  ADD CONSTRAINT agent_versions_publication_action_state_check CHECK (
    (lifecycle_state = 'PUBLISHED') = (publication_action_id IS NOT NULL)
    OR lifecycle_state IS NULL
  ),
  ADD CONSTRAINT agent_versions_publication_decision_state_check CHECK (
    lifecycle_state IS NULL OR (
      lifecycle_state <> 'PUBLISHED'
      AND publication_decision_id IS NULL
      AND wallet_publication_decision_id IS NULL
      AND publication_mode IS NULL
    ) OR (
      lifecycle_state = 'PUBLISHED'
      AND (
        (publication_mode = 'ENS' AND publication_decision_id IS NOT NULL
          AND wallet_publication_decision_id IS NULL)
        OR
        (publication_mode = 'WALLET' AND publication_decision_id IS NULL
          AND wallet_publication_decision_id IS NOT NULL)
      )
    )
  ),
  ADD CONSTRAINT agent_versions_protected_publish_check CHECK (
    lifecycle_state IS NULL OR (
      lifecycle_state <> 'PUBLISHED' AND NOT published AND published_at IS NULL
    ) OR (
      lifecycle_state = 'PUBLISHED' AND published AND published_at IS NOT NULL
      AND (
        (
          publication_mode = 'ENS' AND canonical_state = 'CANONICAL'
          AND agent_wallet_id IS NULL AND wallet_publication_decision_id IS NULL
          AND creator_parent IS NOT NULL AND agent_label IS NOT NULL AND full_subname IS NOT NULL
          AND write_plan IS NOT NULL AND write_plan_hash IS NOT NULL
          AND authority_owner IS NOT NULL AND authority_policy_version IS NOT NULL
          AND authority_refusal IS NULL AND authority_record_hash IS NOT NULL
          AND authority_observed_at IS NOT NULL AND authority_fresh_until IS NOT NULL
          AND authority_release_sha IS NOT NULL AND publication_decision_id IS NOT NULL
        ) OR (
          publication_mode = 'WALLET' AND canonical_state = 'WALLET_AUTHORIZED'
          AND agent_wallet_id IS NOT NULL AND wallet_publication_decision_id IS NOT NULL
          AND publication_decision_id IS NULL
          AND creator_parent IS NULL AND agent_label IS NULL AND full_subname IS NULL
          AND write_plan IS NULL AND write_plan_hash IS NULL
          AND authority_owner IS NULL AND authority_delegate IS NULL
          AND authority_policy_version IS NULL AND authority_refusal IS NULL
          AND authority_record_hash IS NULL AND authority_observed_at IS NULL
          AND authority_fresh_until IS NULL AND authority_release_sha IS NULL
        )
      )
    )
  ),
  ADD CONSTRAINT agent_versions_wallet_attachment_state_check CHECK (
    lifecycle_state IS NULL OR (
      lifecycle_state = 'WALLET_ATTACHED'
      AND agent_wallet_id IS NOT NULL AND canonical_state = 'UNVERIFIED'
      AND creator_parent IS NULL AND agent_label IS NULL AND full_subname IS NULL
      AND write_plan IS NULL AND write_plan_hash IS NULL
      AND publication_mode IS NULL AND publication_decision_id IS NULL
      AND wallet_publication_decision_id IS NULL AND publication_action_id IS NULL
    ) OR lifecycle_state <> 'WALLET_ATTACHED'
  );

CREATE OR REPLACE FUNCTION public.enforce_agent_version_lifecycle()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF OLD.lifecycle_state IS NULL OR OLD.lifecycle_state = NEW.lifecycle_state THEN RETURN NEW; END IF;
  IF NOT (
    (OLD.lifecycle_state = 'DRAFT' AND NEW.lifecycle_state IN ('WALLET_ATTACHED', 'NAME_BOUND')) OR
    (OLD.lifecycle_state = 'NAME_BOUND' AND NEW.lifecycle_state = 'WRITE_PREPARED') OR
    (OLD.lifecycle_state = 'WRITE_PREPARED' AND NEW.lifecycle_state = 'PUBLISHED') OR
    (OLD.lifecycle_state = 'WALLET_ATTACHED' AND NEW.lifecycle_state = 'PUBLISHED')
  ) THEN
    RAISE EXCEPTION 'illegal agent version lifecycle transition: % -> %',
      OLD.lifecycle_state, NEW.lifecycle_state USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DO $patch_action$
DECLARE definition TEXT;
DECLARE changed TEXT;
BEGIN
  SELECT pg_get_functiondef('public.enforce_agent_lifecycle_action()'::regprocedure)
  INTO definition;
  changed := replace(definition,
    $old$OR (
          NEW.action = 'PUBLISH_VERSION'
          AND NEW.result_snapshot#>>'{value,lifecycleState}' <> 'PUBLISHED'
        )$old$,
    $new$OR (
          NEW.action = 'ATTACH_AGENT_WALLET'
          AND NEW.result_snapshot#>>'{value,lifecycleState}' <> 'WALLET_ATTACHED'
        ) OR (
          NEW.action = 'PUBLISH_VERSION'
          AND NEW.result_snapshot#>>'{value,lifecycleState}' <> 'PUBLISHED'
        ) OR (
          NEW.action = 'PUBLISH_WALLET_VERSION'
          AND NEW.result_snapshot#>>'{value,lifecycleState}' <> 'PUBLISHED'
        )$new$);
  IF changed = definition THEN
    RAISE EXCEPTION 'wallet lifecycle action verifier changed unexpectedly';
  END IF;
  EXECUTE changed;
END;
$patch_action$;

DO $patch_ens_publication$
DECLARE definition TEXT;
DECLARE changed TEXT;
BEGIN
  SELECT pg_get_functiondef('public.enforce_agent_publication_integrity()'::regprocedure)
  INTO definition;
  changed := replace(definition,
    $old$IF NOT FOUND OR version_row.lifecycle_state IS NULL THEN
    RETURN NULL;
  END IF;$old$,
    $new$IF NOT FOUND OR version_row.lifecycle_state IS NULL THEN
    RETURN NULL;
  END IF;
  IF version_row.lifecycle_state = 'WALLET_ATTACHED'
    OR version_row.publication_mode = 'WALLET'
  THEN RETURN NULL; END IF;$new$);
  IF changed = definition THEN
    RAISE EXCEPTION 'ENS publication integrity guard changed unexpectedly';
  END IF;
  EXECUTE changed;
END;
$patch_ens_publication$;

CREATE OR REPLACE FUNCTION public.agent_version_is_hireable(target_version_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT version.published AND version.lifecycle_state = 'PUBLISHED' AND (
      (
        version.publication_mode = 'ENS' AND version.canonical_state = 'CANONICAL'
        AND version.publication_decision_id IS NOT NULL
        AND version.wallet_publication_decision_id IS NULL
        AND version.full_subname IS NOT NULL AND version.write_plan_hash IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.ens_publication_decisions decision
          JOIN public.agent_lifecycle_actions action ON action.id = version.publication_action_id
          JOIN public.agent_version_events event ON event.lifecycle_action_id = action.id
          WHERE decision.id = version.publication_decision_id
            AND decision.agent_version_id = version.id AND decision.decision = 'ALLOW'
            AND decision.error_code IS NULL AND action.action = 'PUBLISH_VERSION'
            AND action.status = 'SUCCEEDED' AND action.agent_version_id = version.id
            AND action.target_agent_version_id = version.id
            AND action.result_snapshot->>'outcome' = 'SUCCESS'
            AND event.agent_version_id = version.id AND event.action = 'PUBLISH_VERSION'
            AND event.payload->>'publicationDecisionId' = decision.id::text
        )
      ) OR (
        version.publication_mode = 'WALLET'
        AND version.canonical_state = 'WALLET_AUTHORIZED'
        AND version.publication_decision_id IS NULL
        AND version.wallet_publication_decision_id IS NOT NULL
        AND version.agent_wallet_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.wallet_publication_decisions decision
          JOIN public.agent_wallet_identities wallet ON wallet.id = decision.agent_wallet_id
          JOIN public.agent_lifecycle_actions action ON action.id = version.publication_action_id
          JOIN public.agent_version_events event ON event.lifecycle_action_id = action.id
          WHERE decision.id = version.wallet_publication_decision_id
            AND decision.agent_version_id = version.id
            AND decision.agent_wallet_id = version.agent_wallet_id
            AND decision.manifest_hash = version.manifest_hash
            AND decision.wallet_identity_hash = wallet.identity_hash
            AND wallet.agent_id = version.agent_id AND wallet.state = 'LIVE'
            AND decision.decision = 'WALLET_AUTHORIZED'
            AND action.action = 'PUBLISH_WALLET_VERSION' AND action.status = 'SUCCEEDED'
            AND action.agent_version_id = version.id AND action.target_agent_version_id = version.id
            AND action.result_snapshot->>'outcome' = 'SUCCESS'
            AND action.result_snapshot#>>'{value,walletPublicationDecisionId}' = decision.id::text
            AND action.result_snapshot#>>'{value,walletReceiptHash}' = decision.receipt_hash
            AND event.agent_version_id = version.id AND event.action = 'PUBLISH_WALLET_VERSION'
            AND event.payload->>'walletPublicationDecisionId' = decision.id::text
            AND event.payload->>'receiptHash' = decision.receipt_hash
        )
      )
    )
    FROM public.agent_versions version WHERE version.id = target_version_id
  ), false)
$$;

CREATE OR REPLACE FUNCTION public.enforce_wallet_publication_integrity()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
SET "TimeZone" = 'UTC'
AS $$
DECLARE target_version_id UUID;
DECLARE version_row public.agent_versions%ROWTYPE;
DECLARE wallet_row public.agent_wallet_identities%ROWTYPE;
DECLARE attach_action public.agent_lifecycle_actions%ROWTYPE;
DECLARE publish_action public.agent_lifecycle_actions%ROWTYPE;
DECLARE decision_row public.wallet_publication_decisions%ROWTYPE;
DECLARE attach_event public.agent_version_events%ROWTYPE;
DECLARE publish_event public.agent_version_events%ROWTYPE;
DECLARE owner_user_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'agent_versions' THEN
    IF NEW.lifecycle_state IS NULL
      OR NEW.lifecycle_state NOT IN ('WALLET_ATTACHED', 'PUBLISHED')
      OR (NEW.lifecycle_state = 'PUBLISHED' AND NEW.publication_mode IS DISTINCT FROM 'WALLET')
    THEN RETURN NULL; END IF;
    target_version_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'agent_wallet_identities' THEN
    SELECT target_agent_version_id INTO target_version_id
    FROM public.agent_lifecycle_actions WHERE id = NEW.lifecycle_action_id;
  ELSIF TG_TABLE_NAME = 'wallet_publication_decisions' THEN
    target_version_id := NEW.agent_version_id;
  ELSIF TG_TABLE_NAME = 'agent_lifecycle_actions' THEN
    IF NEW.action NOT IN ('ATTACH_AGENT_WALLET', 'PUBLISH_WALLET_VERSION') THEN RETURN NULL; END IF;
    target_version_id := COALESCE(NEW.agent_version_id, NEW.target_agent_version_id);
  ELSE
    IF NEW.action NOT IN ('ATTACH_AGENT_WALLET', 'PUBLISH_WALLET_VERSION') THEN RETURN NULL; END IF;
    target_version_id := NEW.agent_version_id;
  END IF;

  SELECT * INTO version_row FROM public.agent_versions WHERE id = target_version_id;
  IF version_row.id IS NULL OR version_row.lifecycle_state IS NULL
    OR version_row.lifecycle_state NOT IN ('WALLET_ATTACHED', 'PUBLISHED')
  THEN RETURN NULL; END IF;
  SELECT agent.owner_user_id INTO owner_user_id FROM public.kernel_agents agent
  WHERE agent.id = version_row.agent_id;
  SELECT * INTO wallet_row FROM public.agent_wallet_identities
  WHERE id = version_row.agent_wallet_id;
  SELECT * INTO attach_action FROM public.agent_lifecycle_actions
  WHERE id = wallet_row.lifecycle_action_id;
  SELECT * INTO attach_event FROM public.agent_version_events
  WHERE lifecycle_action_id = attach_action.id;
  IF wallet_row.id IS NULL OR wallet_row.agent_id <> version_row.agent_id
    OR attach_action.action <> 'ATTACH_AGENT_WALLET' OR attach_action.status <> 'SUCCEEDED'
    OR attach_action.owner_user_id <> owner_user_id
    OR attach_action.target_agent_version_id <> version_row.id
    OR attach_action.agent_version_id <> version_row.id
    OR attach_action.result_snapshot#>>'{value,versionId}' <> version_row.id::text
    OR attach_action.result_snapshot#>>'{value,agentWallet,walletIdentityId}' <> wallet_row.id::text
    OR attach_action.result_snapshot#>>'{value,agentWallet,identityHash}' <> wallet_row.identity_hash
    OR attach_event.agent_version_id <> version_row.id
    OR attach_event.action <> 'ATTACH_AGENT_WALLET'
    OR attach_event.payload IS DISTINCT FROM jsonb_build_object(
      'identityHash', wallet_row.identity_hash,
      'lifecycleActionId', attach_action.id::text,
      'resultHash', attach_action.result_hash,
      'walletIdentityId', wallet_row.id::text
    )
  THEN RAISE EXCEPTION 'wallet attachment requires one exact action-bound identity/event'
    USING ERRCODE = '23514'; END IF;

  IF version_row.lifecycle_state = 'WALLET_ATTACHED' THEN
    IF version_row.published OR version_row.publication_mode IS NOT NULL
      OR version_row.publication_action_id IS NOT NULL
      OR version_row.wallet_publication_decision_id IS NOT NULL
    THEN RAISE EXCEPTION 'wallet-attached version cannot retain publication evidence'
      USING ERRCODE = '23514'; END IF;
    RETURN NULL;
  END IF;

  SELECT * INTO decision_row FROM public.wallet_publication_decisions
  WHERE id = version_row.wallet_publication_decision_id;
  SELECT * INTO publish_action FROM public.agent_lifecycle_actions
  WHERE id = version_row.publication_action_id;
  SELECT * INTO publish_event FROM public.agent_version_events
  WHERE lifecycle_action_id = publish_action.id;
  IF version_row.publication_mode <> 'WALLET'
    OR version_row.canonical_state <> 'WALLET_AUTHORIZED' OR NOT version_row.published
    OR decision_row.id IS NULL OR decision_row.agent_version_id <> version_row.id
    OR decision_row.agent_wallet_id <> wallet_row.id
    OR decision_row.manifest_hash <> version_row.manifest_hash
    OR decision_row.wallet_identity_hash <> wallet_row.identity_hash
    OR decision_row.decision <> 'WALLET_AUTHORIZED'
    OR publish_action.action <> 'PUBLISH_WALLET_VERSION'
    OR publish_action.status <> 'SUCCEEDED' OR publish_action.owner_user_id <> owner_user_id
    OR publish_action.target_agent_version_id <> version_row.id
    OR publish_action.agent_version_id <> version_row.id
    OR publish_action.result_snapshot#>>'{value,versionId}' <> version_row.id::text
    OR publish_action.result_snapshot#>>'{value,publicationMode}' <> 'WALLET'
    OR publish_action.result_snapshot#>>'{value,canonicalState}' <> 'WALLET_AUTHORIZED'
    OR publish_action.result_snapshot#>>'{value,walletPublicationDecisionId}' <> decision_row.id::text
    OR publish_action.result_snapshot#>>'{value,walletReceiptHash}' <> decision_row.receipt_hash
    OR publish_action.result_snapshot#>>'{value,agentWallet,identityHash}' <> wallet_row.identity_hash
    OR publish_action.result_snapshot#>>'{value,publishedAt}' <> to_char(
      date_trunc('milliseconds', version_row.published_at) AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    )
    OR publish_event.agent_version_id <> version_row.id
    OR publish_event.action <> 'PUBLISH_WALLET_VERSION'
    OR publish_event.payload IS DISTINCT FROM jsonb_build_object(
      'lifecycleActionId', publish_action.id::text,
      'manifestHash', version_row.manifest_hash,
      'policyVersion', decision_row.policy_version,
      'receiptHash', decision_row.receipt_hash,
      'resultHash', publish_action.result_hash,
      'walletIdentityHash', wallet_row.identity_hash,
      'walletPublicationDecisionId', decision_row.id::text
    )
  THEN RAISE EXCEPTION 'wallet publication requires one exact action-bound decision/receipt'
    USING ERRCODE = '23514'; END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER agent_versions_wallet_publication_integrity
AFTER INSERT OR UPDATE ON public.agent_versions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION public.enforce_wallet_publication_integrity();
CREATE CONSTRAINT TRIGGER agent_wallet_identities_publication_integrity
AFTER INSERT ON public.agent_wallet_identities
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION public.enforce_wallet_publication_integrity();
CREATE CONSTRAINT TRIGGER wallet_publication_decisions_publication_integrity
AFTER INSERT ON public.wallet_publication_decisions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION public.enforce_wallet_publication_integrity();
CREATE CONSTRAINT TRIGGER agent_lifecycle_actions_wallet_publication_integrity
AFTER INSERT OR UPDATE ON public.agent_lifecycle_actions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION public.enforce_wallet_publication_integrity();
CREATE CONSTRAINT TRIGGER agent_version_events_wallet_publication_integrity
AFTER INSERT ON public.agent_version_events
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION public.enforce_wallet_publication_integrity();

ALTER TABLE public.receipts
  ALTER COLUMN authority_check_id DROP NOT NULL,
  ADD COLUMN wallet_publication_decision_id UUID,
  ADD CONSTRAINT receipts_wallet_publication_decision_fkey
    FOREIGN KEY (wallet_publication_decision_id)
    REFERENCES public.wallet_publication_decisions(id) ON DELETE RESTRICT,
  ADD CONSTRAINT receipts_authority_mode_check CHECK (
    (authority_check_id IS NOT NULL) <> (wallet_publication_decision_id IS NOT NULL)
  );
CREATE UNIQUE INDEX receipts_wallet_publication_decision_key
  ON public.receipts(wallet_publication_decision_id)
  WHERE wallet_publication_decision_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_receipt_authority()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
SET "TimeZone" = 'UTC'
AS $$
DECLARE
  authority_now TIMESTAMPTZ;
  disposable_clock BOOLEAN;
  role_is_superuser BOOLEAN;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'receipts are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.wallet_publication_decision_id IS NOT NULL THEN
    authority_now := NEW.created_at;
    IF NEW.authority_check_id IS NOT NULL OR NOT EXISTS (
      SELECT 1
      FROM public.jobs job
      JOIN public.effects effect ON effect.id = NEW.effect_id AND effect.job_id = job.id
      JOIN public.agent_versions version ON version.id = job.agent_version_id
      JOIN public.wallet_publication_decisions decision
        ON decision.id = NEW.wallet_publication_decision_id
       AND decision.id = version.wallet_publication_decision_id
       AND decision.agent_version_id = version.id
      JOIN public.agent_wallet_identities wallet
        ON wallet.id = decision.agent_wallet_id AND wallet.id = version.agent_wallet_id
      JOIN public.kernel_agents agent ON agent.id = version.agent_id
      JOIN public.worker_leases lease ON lease.key = 'kernel-worker'
      WHERE job.id = NEW.job_id AND job.state = 'RUNNING'
        AND job.lease_owner = lease.owner_id AND job.lease_expires_at > authority_now
        AND lease.expires_at > authority_now
        AND effect.state = 'SUCCEEDED' AND effect.result_hash = NEW.result_hash
        AND effect.terminal_at IS NOT NULL
        AND decision.creator_user_id = agent.owner_user_id
        AND decision.creator_wallet = lower(version.owner_wallet)
        AND decision.wallet_identity_hash = wallet.identity_hash
        AND public.agent_version_is_hireable(version.id)
        AND NEW.verified AND NEW.adapter_key = 'protected-a3'
    ) THEN
      RAISE EXCEPTION 'receipt requires an exact wallet publication authority decision'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.authority_check_id IS NULL THEN
    RAISE EXCEPTION 'receipt authority is missing' USING ERRCODE = '23514';
  END IF;
  SELECT disposable_test_clock INTO disposable_clock
  FROM public.ens_authority_checks WHERE id = NEW.authority_check_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'receipt requires a fresh exact PRE_DELIVERY ENS authority ALLOW'
      USING ERRCODE = '23514';
  END IF;
  IF disposable_clock THEN
    SELECT rolsuper INTO role_is_superuser FROM pg_roles WHERE rolname = current_user;
    IF NOT COALESCE(role_is_superuser, FALSE) THEN
      RAISE EXCEPTION 'disposable ENS authority test clock requires database superuser'
        USING ERRCODE = '23514';
    END IF;
    authority_now := NEW.created_at;
  ELSE
    authority_now := clock_timestamp();
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.ens_authority_checks check_row
    JOIN public.ens_authority_bindings binding ON binding.effect_id = check_row.effect_id
    JOIN public.jobs job ON job.id = check_row.job_id
    JOIN public.effects effect ON effect.id = check_row.effect_id AND effect.job_id = job.id
    JOIN public.worker_leases lease ON lease.key = 'kernel-worker'
    WHERE check_row.id = NEW.authority_check_id
      AND check_row.id = (
        SELECT max(latest.id) FROM public.ens_authority_checks latest
        WHERE latest.effect_id = check_row.effect_id
      )
      AND check_row.phase = 'PRE_DELIVERY' AND check_row.operation = 'ACCEPT_DELIVERY'
      AND check_row.decision = 'ALLOW' AND check_row.error_code IS NULL
      AND check_row.effect_id = NEW.effect_id AND check_row.job_id = NEW.job_id
      AND check_row.agent_version_id = job.agent_version_id
      AND check_row.binding_hash = binding.binding_hash
      AND binding.job_id = NEW.job_id AND binding.agent_version_id = job.agent_version_id
      AND NEW.created_at >= check_row.created_at
      AND NEW.created_at <= authority_now + interval '1 second'
      AND check_row.observed_at <= authority_now AND check_row.fresh_until >= authority_now
      AND authority_now - check_row.observed_at <= make_interval(secs => binding.max_age_seconds)
      AND job.state = 'RUNNING' AND job.version = check_row.claim_version
      AND job.lease_owner = check_row.lease_owner AND job.lease_expires_at > authority_now
      AND job.lease_expires_at >= check_row.claim_expires_at
      AND lease.owner_id = check_row.lease_owner AND lease.epoch = check_row.worker_epoch
      AND lease.expires_at > authority_now
      AND NEW.verified AND NEW.adapter_key = 'protected-a3'
  ) THEN
    RAISE EXCEPTION 'receipt requires a fresh exact PRE_DELIVERY ENS authority ALLOW'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DO $patch_hire$
DECLARE definition TEXT;
DECLARE changed TEXT;
BEGIN
  SELECT pg_get_functiondef('public.enforce_hire_request()'::regprocedure) INTO definition;
  changed := replace(definition,
    $old$OR NOT version_row.published OR version_row.lifecycle_state <> 'PUBLISHED'
      OR version_row.canonical_state <> 'CANONICAL' OR version_row.manifest_hash <> NEW.manifest_hash$old$,
    $new$OR NOT public.agent_version_is_hireable(NEW.agent_version_id)
      OR version_row.manifest_hash <> NEW.manifest_hash$new$);
  IF changed = definition THEN RAISE EXCEPTION 'hire request authority verifier changed unexpectedly'; END IF;
  EXECUTE changed;
END;
$patch_hire$;

ALTER TABLE public.goal_run_jobs ALTER COLUMN full_subname_snapshot DROP NOT NULL;
ALTER TABLE public.goal_run_jobs DROP CONSTRAINT goal_run_jobs_subname_check;
ALTER TABLE public.goal_run_jobs ADD CONSTRAINT goal_run_jobs_subname_check CHECK (
  full_subname_snapshot IS NULL OR char_length(full_subname_snapshot) BETWEEN 3 AND 255
);

DO $patch_goal_snapshot$
DECLARE definition TEXT;
DECLARE changed TEXT;
BEGIN
  SELECT pg_get_functiondef('public.enforce_goal_run_job_immutability()'::regprocedure)
  INTO definition;
  changed := replace(definition,
    'OLD.full_subname_snapshot <> NEW.full_subname_snapshot',
    'OLD.full_subname_snapshot IS DISTINCT FROM NEW.full_subname_snapshot');
  IF changed = definition THEN RAISE EXCEPTION 'goal job identity verifier changed unexpectedly'; END IF;
  EXECUTE changed;
END;
$patch_goal_snapshot$;

CREATE INDEX idx_agent_versions_wallet_authorized_created
  ON public.agent_versions(published_at DESC, id DESC)
  WHERE published = true AND lifecycle_state = 'PUBLISHED'
    AND publication_mode = 'WALLET' AND canonical_state = 'WALLET_AUTHORIZED';

COMMENT ON FUNCTION public.agent_version_is_hireable(UUID)
  IS 'alphadawg:wallet-authority-publication:v1';
COMMENT ON TABLE public.agent_wallet_identities
  IS 'Append-only Circle UNI-SEPOLIA SCA identity; contains no credential or private key';
COMMENT ON TABLE public.wallet_publication_decisions
  IS 'Append-only SIWE creator wallet-authority publication decision and receipt';
