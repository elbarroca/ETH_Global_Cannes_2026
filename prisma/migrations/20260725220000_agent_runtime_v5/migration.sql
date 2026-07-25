-- Protected LangChain manifest v5, canonical marketplace indexes, durable hires,
-- exclusive MCP lineage, and release-bound 0G spend reservations.

ALTER TABLE public.agent_versions DROP CONSTRAINT agent_versions_manifest_schema_check;
ALTER TABLE public.agent_versions ADD CONSTRAINT agent_versions_manifest_schema_check CHECK (
  jsonb_typeof(manifest) = 'object'
  AND manifest->>'schemaVersion' IN ('1', '2', '3', '4', '5')
);

ALTER TABLE public.agent_versions ADD CONSTRAINT agent_versions_manifest_v5_shape_check CHECK (
  manifest->>'schemaVersion' <> '5' OR (
    manifest ?& ARRAY[
      'schemaVersion','catalogTemplateId','catalogSelectionHash','name','description',
      'instructions','capabilities','adapterKey','endpoint','connectorKey','ownerWallet',
      'payoutAddress','priceAtomic','asset','proofPolicy','ensBinding','ensBindingHash',
      'reviewedPromptHash','reviewedConfigHash','skills','reviewedSources',
      'nativeConnections','mcp','riskTiers','runtimePolicy'
    ]
    AND manifest - ARRAY[
      'schemaVersion','catalogTemplateId','catalogSelectionHash','name','description',
      'instructions','capabilities','adapterKey','endpoint','connectorKey','ownerWallet',
      'payoutAddress','priceAtomic','asset','proofPolicy','ensBinding','ensBindingHash',
      'reviewedPromptHash','reviewedConfigHash','skills','reviewedSources',
      'nativeConnections','mcp','riskTiers','runtimePolicy'
    ] = '{}'::jsonb
    AND manifest->'runtimePolicy' = '{"framework":"langchain-v1","modelCalls":1,"maxMcpCalls":4,"maxOutputTokens":768,"deadlineMs":300000}'::jsonb
    AND manifest->'riskTiers' IN (
      '["LOW"]'::jsonb, '["MID"]'::jsonb, '["HIGH"]'::jsonb,
      '["LOW","MID"]'::jsonb, '["LOW","HIGH"]'::jsonb,
      '["MID","HIGH"]'::jsonb, '["LOW","MID","HIGH"]'::jsonb
    )
    AND manifest->>'catalogTemplateId' IN (
      'alpha-researcher','market-pulse','liquidity-scout','onchain-forensics',
      'defi-risk-sentinel','volume-anomaly','thesis-synthesizer','swap-strategist'
    )
    AND manifest->>'catalogSelectionHash' ~ '^[0-9a-f]{64}$'
    AND manifest->>'reviewedPromptHash' ~ '^[0-9a-f]{64}$'
    AND manifest->>'reviewedConfigHash' ~ '^[0-9a-f]{64}$'
    AND manifest->>'adapterKey' = 'protected-a3'
    AND manifest->'endpoint' = 'null'::jsonb
    AND manifest->'connectorKey' = 'null'::jsonb
    AND manifest->>'ownerWallet' = lower(owner_wallet)
    AND manifest->>'payoutAddress' = lower(payout_address)
    AND payout_address IS NOT NULL
    AND price_atomic = 1000 AND manifest->>'priceAtomic' = '1000'
    AND asset = 'USDC_ATOMIC' AND manifest->>'asset' = 'USDC_ATOMIC'
    AND proof_policy = 'verified-receipt-required'
    AND manifest->>'proofPolicy' = 'verified-receipt-required'
    AND jsonb_typeof(manifest->'capabilities') = 'array'
    AND jsonb_typeof(manifest->'skills') = 'array'
    AND jsonb_array_length(manifest->'skills') BETWEEN 4 AND 7
    AND jsonb_typeof(manifest->'reviewedSources') = 'array'
    AND jsonb_array_length(manifest->'reviewedSources') BETWEEN 1 AND 4
    AND jsonb_typeof(manifest->'nativeConnections') = 'array'
    AND jsonb_typeof(manifest->'mcp') = 'array'
    AND jsonb_array_length(manifest->'mcp') BETWEEN 2 AND 4
    AND (
      (manifest->'ensBinding' = 'null'::jsonb AND manifest->'ensBindingHash' = 'null'::jsonb)
      OR (jsonb_typeof(manifest->'ensBinding') = 'object' AND manifest->>'ensBindingHash' ~ '^[0-9a-f]{64}$')
    )
  )
);

DO $manifest_v5$
DECLARE definition text;
DECLARE changed text;
BEGIN
  SELECT pg_get_functiondef('public.enforce_manifest_v2_publication()'::regprocedure) INTO definition;
  changed := replace(definition,
    $old$ELSIF NEW.manifest->>'schemaVersion' IN ('3', '4') THEN$old$,
    $new$ELSIF NEW.manifest->>'schemaVersion' IN ('3', '4', '5') THEN$new$);
  IF changed = definition THEN RAISE EXCEPTION 'manifest catalog verifier branch changed unexpectedly'; END IF;
  definition := changed;

  changed := replace(definition,
    $old$CASE WHEN NEW.manifest->>'schemaVersion' = '4'
        THEN jsonb_build_object('riskTiers', NEW.manifest->'riskTiers')
        ELSE '{}'::jsonb END$old$,
    $new$CASE WHEN NEW.manifest->>'schemaVersion' IN ('4', '5')
        THEN jsonb_build_object('riskTiers', NEW.manifest->'riskTiers')
        ELSE '{}'::jsonb END || CASE WHEN NEW.manifest->>'schemaVersion' = '5'
        THEN jsonb_build_object('runtimePolicy', NEW.manifest->'runtimePolicy')
        ELSE '{}'::jsonb END$new$);
  IF changed = definition THEN RAISE EXCEPTION 'manifest v5 config verifier changed unexpectedly'; END IF;
  definition := changed;

  changed := replace(definition,
    $old$NEW.manifest->>'schemaVersion' NOT IN ('2', '3', '4')$old$,
    $new$NEW.manifest->>'schemaVersion' NOT IN ('2', '3', '4', '5')$new$);
  IF changed = definition THEN RAISE EXCEPTION 'manifest publication verifier changed unexpectedly'; END IF;
  EXECUTE changed;
END;
$manifest_v5$;

CREATE INDEX idx_agent_versions_capabilities_gin
  ON public.agent_versions USING gin (capabilities)
  WHERE published = true AND lifecycle_state = 'PUBLISHED' AND canonical_state = 'CANONICAL';
CREATE INDEX idx_agent_versions_skills_gin
  ON public.agent_versions USING gin ((manifest->'skills') jsonb_path_ops)
  WHERE published = true AND lifecycle_state = 'PUBLISHED' AND canonical_state = 'CANONICAL';
CREATE INDEX idx_agent_versions_mcp_gin
  ON public.agent_versions USING gin ((manifest->'mcp') jsonb_path_ops)
  WHERE published = true AND lifecycle_state = 'PUBLISHED' AND canonical_state = 'CANONICAL';
CREATE INDEX idx_agent_versions_canonical_price_created
  ON public.agent_versions (price_atomic, published_at DESC, created_at DESC, id DESC)
  WHERE published = true AND lifecycle_state = 'PUBLISHED' AND canonical_state = 'CANONICAL';

CREATE TABLE public.hire_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  agent_version_id UUID NOT NULL REFERENCES public.agent_versions(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  prompt TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  manifest_hash TEXT NOT NULL,
  state TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  claim_owner TEXT,
  claim_epoch BIGINT,
  claim_version INTEGER NOT NULL DEFAULT 0,
  claim_expires_at TIMESTAMPTZ(6),
  context_hash TEXT,
  job_id UUID UNIQUE REFERENCES public.jobs(id) ON DELETE RESTRICT,
  error_code TEXT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uniq_hire_requests_buyer_key UNIQUE (buyer_user_id, idempotency_key),
  CONSTRAINT hire_requests_key_check CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{8,128}$'),
  CONSTRAINT hire_requests_hash_check CHECK (
    prompt_hash ~ '^[0-9a-f]{64}$' AND manifest_hash ~ '^[0-9a-f]{64}$'
    AND (context_hash IS NULL OR context_hash ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT hire_requests_bounds_check CHECK (
    octet_length(prompt) BETWEEN 1 AND 8000 AND version >= 0 AND claim_version >= 0
    AND (error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]{2,64}$')
  ),
  CONSTRAINT hire_requests_state_check CHECK (state IN (
    'PENDING_CONTEXT','CONTEXT_RUNNING','JOB_QUEUED','BLOCKED','FAILED'
  )),
  CONSTRAINT hire_requests_claim_shape_check CHECK (
    (state = 'CONTEXT_RUNNING' AND claim_owner IS NOT NULL AND claim_epoch > 0
      AND claim_version > 0 AND claim_expires_at IS NOT NULL AND error_code IS NULL)
    OR (state <> 'CONTEXT_RUNNING' AND (
      (claim_owner IS NULL AND claim_epoch IS NULL AND claim_expires_at IS NULL AND claim_version = 0)
      OR (claim_owner IS NOT NULL AND claim_epoch > 0 AND claim_expires_at IS NOT NULL AND claim_version > 0)
    ))
  ),
  CONSTRAINT hire_requests_result_shape_check CHECK (
    (state = 'JOB_QUEUED' AND job_id IS NOT NULL AND error_code IS NULL)
    OR (state IN ('PENDING_CONTEXT','CONTEXT_RUNNING') AND context_hash IS NULL AND job_id IS NULL AND error_code IS NULL)
    OR (state IN ('BLOCKED','FAILED') AND error_code IS NOT NULL AND job_id IS NULL)
  )
);
CREATE INDEX idx_hire_requests_buyer_created ON public.hire_requests(buyer_user_id, created_at DESC, id DESC);
CREATE INDEX idx_hire_requests_state_created ON public.hire_requests(state, created_at, id);

CREATE OR REPLACE FUNCTION public.enforce_hire_request()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE version_row public.agent_versions%ROWTYPE;
DECLARE creator_user_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'hire requests cannot be deleted' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT version.* INTO version_row
    FROM public.agent_versions version
    WHERE version.id = NEW.agent_version_id FOR SHARE OF version;
    SELECT owner_user_id INTO creator_user_id FROM public.kernel_agents
    WHERE id = version_row.agent_id;
    IF version_row.id IS NULL OR creator_user_id = NEW.buyer_user_id
      OR NOT version_row.published OR version_row.lifecycle_state <> 'PUBLISHED'
      OR version_row.canonical_state <> 'CANONICAL' OR version_row.manifest_hash <> NEW.manifest_hash
      OR NEW.prompt_hash <> public.kernel_lifecycle_hash('hire-request-prompt', to_jsonb(NEW.prompt))
      OR NEW.version <> 0 OR NEW.claim_version <> 0 OR NEW.job_id IS NOT NULL
      OR NEW.context_hash IS NOT NULL OR NEW.error_code IS NOT NULL
      OR NEW.state <> 'PENDING_CONTEXT'
    THEN RAISE EXCEPTION 'hire request is not bound to one canonical external agent version' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.id <> OLD.id OR NEW.buyer_user_id <> OLD.buyer_user_id
    OR NEW.agent_version_id <> OLD.agent_version_id OR NEW.idempotency_key <> OLD.idempotency_key
    OR NEW.prompt <> OLD.prompt OR NEW.prompt_hash <> OLD.prompt_hash
    OR NEW.manifest_hash <> OLD.manifest_hash OR NEW.created_at <> OLD.created_at
    OR (OLD.job_id IS NOT NULL AND NEW.job_id IS DISTINCT FROM OLD.job_id)
  THEN RAISE EXCEPTION 'hire request identity is immutable' USING ERRCODE = '23514'; END IF;
  IF NEW.version <> OLD.version + 1 THEN RAISE EXCEPTION 'hire request version must increment by one' USING ERRCODE = '23514'; END IF;
  IF NOT (
    (OLD.state = 'PENDING_CONTEXT' AND NEW.state IN ('CONTEXT_RUNNING','BLOCKED','FAILED'))
    OR (OLD.state = 'CONTEXT_RUNNING' AND NEW.state = 'CONTEXT_RUNNING')
    OR (OLD.state = 'CONTEXT_RUNNING' AND NEW.state IN ('JOB_QUEUED','BLOCKED','FAILED'))
  ) THEN RAISE EXCEPTION 'illegal hire request transition' USING ERRCODE = '23514'; END IF;
  IF OLD.state = 'PENDING_CONTEXT' AND NEW.state = 'CONTEXT_RUNNING' THEN
    IF NEW.claim_owner IS NULL OR NEW.claim_epoch IS NULL OR NEW.claim_epoch <= 0
      OR NEW.claim_version <> OLD.claim_version + 1 OR NEW.claim_expires_at <= clock_timestamp()
    THEN RAISE EXCEPTION 'hire request claim is not current' USING ERRCODE = '23514'; END IF;
  ELSIF OLD.state = 'CONTEXT_RUNNING' AND NEW.state = 'CONTEXT_RUNNING' THEN
    IF OLD.claim_expires_at > clock_timestamp() OR NEW.claim_owner IS NULL
      OR NEW.claim_epoch <= OLD.claim_epoch OR NEW.claim_version <> OLD.claim_version + 1
      OR NEW.claim_expires_at <= clock_timestamp() OR NEW.job_id IS NOT NULL
      OR NEW.context_hash IS NOT NULL OR NEW.error_code IS NOT NULL
    THEN RAISE EXCEPTION 'hire request reclaim is not current' USING ERRCODE = '23514'; END IF;
  ELSIF OLD.state = 'CONTEXT_RUNNING' THEN
    IF OLD.claim_expires_at <= clock_timestamp() OR NEW.claim_owner <> OLD.claim_owner
      OR NEW.claim_epoch <> OLD.claim_epoch OR NEW.claim_version <> OLD.claim_version
      OR NEW.claim_expires_at <> OLD.claim_expires_at
    THEN RAISE EXCEPTION 'hire request worker fence is stale' USING ERRCODE = '23514'; END IF;
    IF NEW.state = 'JOB_QUEUED' AND NOT EXISTS (
      SELECT 1 FROM public.jobs job
      WHERE job.id = NEW.job_id AND job.buyer_user_id = NEW.buyer_user_id
        AND job.agent_version_id = NEW.agent_version_id
    ) THEN RAISE EXCEPTION 'queued hire request lacks its canonical job' USING ERRCODE = '23514'; END IF;
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER hire_requests_integrity
BEFORE INSERT OR UPDATE OR DELETE ON public.hire_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_hire_request();
CREATE TRIGGER hire_requests_no_truncate
BEFORE TRUNCATE ON public.hire_requests
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_mcp_invocation_mutation();

ALTER TABLE public.mcp_invocations
  ALTER COLUMN goal_run_job_id DROP NOT NULL,
  ADD COLUMN hire_request_id UUID REFERENCES public.hire_requests(id) ON DELETE RESTRICT,
  ADD COLUMN hire_claim_owner TEXT,
  ADD COLUMN hire_claim_epoch BIGINT,
  ADD COLUMN hire_claim_version INTEGER,
  ADD COLUMN hire_claim_expires_at TIMESTAMPTZ(6),
  ADD CONSTRAINT mcp_invocations_exactly_one_parent CHECK (
    (goal_run_job_id IS NOT NULL)::INTEGER + (hire_request_id IS NOT NULL)::INTEGER = 1
  ),
  ADD CONSTRAINT mcp_invocations_hire_fence_shape CHECK (
    (hire_request_id IS NULL AND hire_claim_owner IS NULL AND hire_claim_epoch IS NULL
      AND hire_claim_version IS NULL AND hire_claim_expires_at IS NULL)
    OR (hire_request_id IS NOT NULL AND hire_claim_owner IS NOT NULL AND hire_claim_epoch > 0
      AND hire_claim_version > 0 AND hire_claim_expires_at IS NOT NULL)
  );
ALTER TABLE public.mcp_invocations DROP CONSTRAINT mcp_invocations_run_job_binding_key;
CREATE UNIQUE INDEX uniq_mcp_invocations_run_job_binding
  ON public.mcp_invocations(goal_run_job_id, binding_id) WHERE goal_run_job_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_mcp_invocations_hire_binding
  ON public.mcp_invocations(hire_request_id, binding_id) WHERE hire_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_mcp_invocation_lineage()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE link public.goal_run_jobs%ROWTYPE;
DECLARE run public.goal_runs%ROWTYPE;
DECLARE hire public.hire_requests%ROWTYPE;
DECLARE version public.agent_versions%ROWTYPE;
BEGIN
  SELECT * INTO version FROM public.agent_versions WHERE id = NEW.agent_version_id FOR SHARE;
  IF version.id IS NULL OR version.manifest_hash <> NEW.manifest_hash
    OR version.manifest->>'schemaVersion' NOT IN ('3','4','5')
    OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(version.manifest->'mcp') binding
      WHERE binding->>'id' = NEW.binding_id AND binding->>'provider' = NEW.provider
        AND binding->>'capability' = NEW.capability AND binding->>'access' = 'read-only'
        AND binding->'timeoutMs' = '8000'::jsonb AND binding->'maxResponseBytes' = '32768'::jsonb
    )
  THEN RAISE EXCEPTION 'MCP invocation version or binding is invalid' USING ERRCODE = '23514'; END IF;
  IF NEW.goal_run_job_id IS NOT NULL THEN
    SELECT * INTO link FROM public.goal_run_jobs WHERE id = NEW.goal_run_job_id FOR SHARE;
    SELECT * INTO run FROM public.goal_runs WHERE id = link.goal_run_id FOR SHARE;
    IF link.id IS NULL OR run.id IS NULL OR link.agent_version_id <> NEW.agent_version_id
      OR link.manifest_hash_snapshot <> NEW.manifest_hash OR run.state NOT IN ('RUNNING','SYNTHESIZING')
    THEN RAISE EXCEPTION 'MCP goal lineage is invalid' USING ERRCODE = '23514'; END IF;
  ELSE
    SELECT * INTO hire FROM public.hire_requests WHERE id = NEW.hire_request_id FOR SHARE;
    IF hire.id IS NULL OR hire.agent_version_id <> NEW.agent_version_id
      OR hire.manifest_hash <> NEW.manifest_hash OR hire.state <> 'CONTEXT_RUNNING'
      OR hire.claim_expires_at <= clock_timestamp()
      OR NEW.hire_claim_owner <> hire.claim_owner OR NEW.hire_claim_epoch <> hire.claim_epoch
      OR NEW.hire_claim_version <> hire.claim_version
      OR NEW.hire_claim_expires_at <> hire.claim_expires_at
    THEN RAISE EXCEPTION 'MCP hire lineage is invalid' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE public.og_spend_budgets (
  release_sha TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  asset TEXT NOT NULL,
  limit_atomic BIGINT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT og_spend_budgets_identity_check CHECK (
    release_sha ~ '^[0-9a-f]{40}$' AND chain_id = 16602 AND asset = 'A0GI' AND limit_atomic > 0
  )
);
CREATE TABLE public.og_spend_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_sha TEXT NOT NULL REFERENCES public.og_spend_budgets(release_sha) ON DELETE RESTRICT,
  effect_identity TEXT NOT NULL UNIQUE,
  amount_atomic BIGINT NOT NULL,
  state TEXT NOT NULL DEFAULT 'RESERVED',
  request_id TEXT UNIQUE,
  transaction_hash TEXT UNIQUE,
  error_code TEXT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT og_spend_reservations_identity_check CHECK (
    effect_identity ~ '^[0-9a-f]{64}$' AND amount_atomic > 0
    AND (transaction_hash IS NULL OR transaction_hash ~ '^0x[0-9a-f]{64}$')
    AND (error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]{2,64}$')
  ),
  CONSTRAINT og_spend_reservations_state_check CHECK (
    (state = 'RESERVED' AND request_id IS NULL AND transaction_hash IS NULL AND error_code IS NULL)
    OR (state = 'CONSUMED' AND request_id IS NOT NULL AND transaction_hash IS NOT NULL AND error_code IS NULL)
    OR (state = 'AMBIGUOUS' AND request_id IS NOT NULL AND transaction_hash IS NULL AND error_code IS NOT NULL)
    OR (state = 'RELEASED' AND transaction_hash IS NULL AND error_code IS NOT NULL)
  )
);
CREATE INDEX idx_og_spend_reservations_release_state ON public.og_spend_reservations(release_sha, state);

CREATE OR REPLACE FUNCTION public.enforce_og_spend_reservation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE spend_limit BIGINT;
DECLARE reserved BIGINT;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION '0G spend reservations cannot be deleted' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT limit_atomic INTO spend_limit FROM public.og_spend_budgets
    WHERE release_sha = NEW.release_sha FOR UPDATE;
    SELECT COALESCE(sum(amount_atomic), 0) INTO reserved FROM public.og_spend_reservations
    WHERE release_sha = NEW.release_sha AND state IN ('RESERVED','AMBIGUOUS','CONSUMED');
    IF spend_limit IS NULL OR reserved + NEW.amount_atomic > spend_limit
    THEN RAISE EXCEPTION '0G release spend budget exceeded' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.id <> OLD.id OR NEW.release_sha <> OLD.release_sha
    OR NEW.effect_identity <> OLD.effect_identity OR NEW.amount_atomic <> OLD.amount_atomic
    OR NEW.created_at <> OLD.created_at
  THEN RAISE EXCEPTION '0G spend reservation identity is immutable' USING ERRCODE = '23514'; END IF;
  IF NOT (
    (OLD.state = 'RESERVED' AND NEW.state IN ('CONSUMED','AMBIGUOUS','RELEASED'))
    OR (OLD.state = 'AMBIGUOUS' AND NEW.state = 'CONSUMED')
  ) THEN RAISE EXCEPTION 'illegal 0G spend reservation transition' USING ERRCODE = '23514'; END IF;
  IF OLD.state = 'AMBIGUOUS' AND NEW.request_id <> OLD.request_id
  THEN RAISE EXCEPTION 'ambiguous 0G request identity is immutable' USING ERRCODE = '23514'; END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER og_spend_reservations_integrity
BEFORE INSERT OR UPDATE OR DELETE ON public.og_spend_reservations
FOR EACH ROW EXECUTE FUNCTION public.enforce_og_spend_reservation();
CREATE TRIGGER og_spend_reservations_no_truncate
BEFORE TRUNCATE ON public.og_spend_reservations
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_mcp_invocation_mutation();

ALTER TABLE public.a3_execution_journals
  ADD COLUMN request_signature TEXT,
  ADD COLUMN prompt_tokens INTEGER,
  ADD COLUMN completion_tokens INTEGER,
  ADD COLUMN total_tokens INTEGER,
  ADD COLUMN actual_cost_atomic BIGINT,
  ADD CONSTRAINT a3_journals_usage_check CHECK (
    (prompt_tokens IS NULL AND completion_tokens IS NULL AND total_tokens IS NULL AND actual_cost_atomic IS NULL)
    OR (prompt_tokens >= 0 AND completion_tokens >= 0 AND total_tokens = prompt_tokens + completion_tokens
      AND actual_cost_atomic >= 0)
  ),
  ADD CONSTRAINT a3_journals_request_signature_check CHECK (
    request_signature IS NULL OR request_signature ~ '^0x[0-9a-f]{130}$'
  );

CREATE OR REPLACE FUNCTION public.enforce_a3_v5_evidence_immutability()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF (OLD.request_signature IS NOT NULL AND NEW.request_signature IS DISTINCT FROM OLD.request_signature)
    OR (OLD.prompt_tokens IS NOT NULL AND NEW.prompt_tokens IS DISTINCT FROM OLD.prompt_tokens)
    OR (OLD.completion_tokens IS NOT NULL AND NEW.completion_tokens IS DISTINCT FROM OLD.completion_tokens)
    OR (OLD.total_tokens IS NOT NULL AND NEW.total_tokens IS DISTINCT FROM OLD.total_tokens)
    OR (OLD.actual_cost_atomic IS NOT NULL AND NEW.actual_cost_atomic IS DISTINCT FROM OLD.actual_cost_atomic)
  THEN RAISE EXCEPTION 'A3 provider usage evidence is append-only' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER a3_journals_v5_evidence_immutable
BEFORE UPDATE ON public.a3_execution_journals
FOR EACH ROW EXECUTE FUNCTION public.enforce_a3_v5_evidence_immutability();
