DROP INDEX IF EXISTS public.uniq_mcp_invocations_hire_binding;

CREATE UNIQUE INDEX uniq_mcp_invocations_hire_claim_binding
  ON public.mcp_invocations(hire_request_id, binding_id, hire_claim_version)
  WHERE hire_request_id IS NOT NULL;

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
      OR NEW.claim_epoch < OLD.claim_epoch
      OR (NEW.claim_epoch = OLD.claim_epoch AND NEW.claim_owner <> OLD.claim_owner)
      OR NEW.claim_version <> OLD.claim_version + 1
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
