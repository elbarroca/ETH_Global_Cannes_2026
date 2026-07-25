-- TRI_RISK_V1 adds catalog-derived manifest v4, per-user policy defaults,
-- immutable run snapshots, and one nullable risk lane on the existing ledger.

ALTER TABLE public.agent_versions DROP CONSTRAINT agent_versions_manifest_schema_check;
ALTER TABLE public.agent_versions ADD CONSTRAINT agent_versions_manifest_schema_check
  CHECK (
    jsonb_typeof(manifest) = 'object'
    AND manifest->>'schemaVersion' IN ('1', '2', '3', '4')
  );

ALTER TABLE public.agent_versions ADD CONSTRAINT agent_versions_manifest_v4_shape_check
  CHECK (
    manifest->>'schemaVersion' <> '4'
    OR (
      manifest ?& ARRAY[
        'schemaVersion', 'catalogTemplateId', 'catalogSelectionHash', 'name',
        'description', 'instructions', 'capabilities', 'adapterKey', 'endpoint',
        'connectorKey', 'ownerWallet', 'payoutAddress', 'priceAtomic', 'asset',
        'proofPolicy', 'ensBinding', 'ensBindingHash', 'reviewedPromptHash',
        'reviewedConfigHash', 'skills', 'reviewedSources', 'nativeConnections',
        'mcp', 'riskTiers'
      ]
      AND manifest - ARRAY[
        'schemaVersion', 'catalogTemplateId', 'catalogSelectionHash', 'name',
        'description', 'instructions', 'capabilities', 'adapterKey', 'endpoint',
        'connectorKey', 'ownerWallet', 'payoutAddress', 'priceAtomic', 'asset',
        'proofPolicy', 'ensBinding', 'ensBindingHash', 'reviewedPromptHash',
        'reviewedConfigHash', 'skills', 'reviewedSources', 'nativeConnections',
        'mcp', 'riskTiers'
      ] = '{}'::jsonb
      AND manifest->'riskTiers' IN (
        '["LOW"]'::jsonb, '["MID"]'::jsonb, '["HIGH"]'::jsonb,
        '["LOW","MID"]'::jsonb, '["LOW","HIGH"]'::jsonb,
        '["MID","HIGH"]'::jsonb, '["LOW","MID","HIGH"]'::jsonb
      )
      AND manifest->>'catalogTemplateId' IN (
        'alpha-researcher', 'market-pulse', 'liquidity-scout', 'onchain-forensics',
        'defi-risk-sentinel', 'volume-anomaly', 'thesis-synthesizer', 'swap-strategist'
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

-- Reuse the predecessor's fully enumerated V3 catalog verifier for V4 while
-- preserving the exact V2/V3 branches and adding riskTiers only to V4 config.
DO $manifest_v4$
DECLARE definition text;
DECLARE changed text;
BEGIN
  SELECT pg_get_functiondef('public.enforce_manifest_v2_publication()'::regprocedure)
  INTO definition;

  changed := replace(
    definition,
    $old$ELSIF NEW.manifest->>'schemaVersion' = '3' THEN$old$,
    $new$ELSIF NEW.manifest->>'schemaVersion' IN ('3', '4') THEN$new$
  );
  IF changed = definition THEN RAISE EXCEPTION 'manifest catalog verifier branch changed unexpectedly'; END IF;
  definition := changed;

  changed := replace(
    definition,
    $old$        'reviewedSources', NEW.manifest->'reviewedSources',
        'skills', NEW.manifest->'skills'
      ))$old$,
    $new$        'reviewedSources', NEW.manifest->'reviewedSources',
        'skills', NEW.manifest->'skills'
      ) || CASE WHEN NEW.manifest->>'schemaVersion' = '4'
        THEN jsonb_build_object('riskTiers', NEW.manifest->'riskTiers')
        ELSE '{}'::jsonb END)$new$
  );
  IF changed = definition THEN RAISE EXCEPTION 'manifest config verifier changed unexpectedly'; END IF;
  definition := changed;

  changed := replace(
    definition,
    $old$NEW.manifest->>'schemaVersion' NOT IN ('2', '3')$old$,
    $new$NEW.manifest->>'schemaVersion' NOT IN ('2', '3', '4')$new$
  );
  IF changed = definition THEN RAISE EXCEPTION 'manifest publication verifier changed unexpectedly'; END IF;
  EXECUTE changed;
END;
$manifest_v4$;

DO $mcp_v4$
DECLARE definition text;
DECLARE changed text;
BEGIN
  SELECT pg_get_functiondef('public.enforce_mcp_invocation_lineage()'::regprocedure)
  INTO definition;
  changed := replace(
    definition,
    $old$version.manifest->>'schemaVersion' <> '3'$old$,
    $new$version.manifest->>'schemaVersion' NOT IN ('3', '4')$new$
  );
  IF changed = definition THEN RAISE EXCEPTION 'MCP lineage verifier changed unexpectedly'; END IF;
  EXECUTE changed;
END;
$mcp_v4$;

ALTER TABLE public.goals
  ADD COLUMN policy_schema_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN orchestration_mode TEXT;

ALTER TABLE public.goals ADD CONSTRAINT goals_policy_version_check CHECK (
  (policy_schema_version = 1 AND orchestration_mode IS NULL)
  OR (policy_schema_version = 2 AND orchestration_mode = 'TRI_RISK_V1' AND max_agents = 3)
);

ALTER TABLE public.goal_runs ADD CONSTRAINT goal_runs_policy_shape_check CHECK (
  jsonb_typeof(policy_snapshot) = 'object' AND (
    (
      NOT (policy_snapshot ? 'schemaVersion')
      AND policy_snapshot ?& ARRAY[
        'cadenceMinutes', 'runMode', 'executionMode', 'runLimit', 'maxAgents',
        'perRunCapAtomic', 'dailyCapAtomic'
      ]
      AND policy_snapshot - ARRAY[
        'cadenceMinutes', 'runMode', 'executionMode', 'runLimit', 'maxAgents',
        'perRunCapAtomic', 'dailyCapAtomic'
      ] = '{}'::jsonb
    ) OR (
      policy_snapshot->'schemaVersion' = '2'::jsonb
      AND policy_snapshot->>'orchestrationMode' = 'TRI_RISK_V1'
      AND policy_snapshot->'maxAgents' = '3'::jsonb
      AND policy_snapshot ?& ARRAY[
        'schemaVersion', 'orchestrationMode', 'cadenceMinutes', 'runMode',
        'executionMode', 'runLimit', 'maxAgents', 'perRunCapAtomic', 'dailyCapAtomic'
      ]
      AND policy_snapshot - ARRAY[
        'schemaVersion', 'orchestrationMode', 'cadenceMinutes', 'runMode',
        'executionMode', 'runLimit', 'maxAgents', 'perRunCapAtomic', 'dailyCapAtomic'
      ] = '{}'::jsonb
    )
  )
);

CREATE TABLE public.augmented_layer_policies (
  owner_user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE RESTRICT,
  policy JSONB NOT NULL,
  policy_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT augmented_layer_policies_hash_check CHECK (policy_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT augmented_layer_policies_policy_check CHECK (
    jsonb_typeof(policy) = 'object'
    AND policy ?& ARRAY[
      'schemaVersion', 'orchestrationMode', 'cadenceMinutes', 'runMode',
      'executionMode', 'runLimit', 'maxAgents', 'perRunCapAtomic', 'dailyCapAtomic'
    ]
    AND policy - ARRAY[
      'schemaVersion', 'orchestrationMode', 'cadenceMinutes', 'runMode',
      'executionMode', 'runLimit', 'maxAgents', 'perRunCapAtomic', 'dailyCapAtomic'
    ] = '{}'::jsonb
    AND policy->'schemaVersion' = '2'::jsonb
    AND policy->>'orchestrationMode' = 'TRI_RISK_V1'
    AND policy->'maxAgents' = '3'::jsonb
    AND policy->'cadenceMinutes' IN ('5'::jsonb, '15'::jsonb, '30'::jsonb, '60'::jsonb)
    AND policy->>'runMode' IN ('BOUNDED', 'CONTINUOUS')
    AND policy->>'executionMode' IN ('RESEARCH_ONLY', 'PROPOSE_SWAP')
    AND policy->>'perRunCapAtomic' ~ '^[1-9][0-9]{0,18}$'
    AND (
      (policy->>'runMode' = 'BOUNDED' AND (policy->>'runLimit')::integer BETWEEN 1 AND 100
        AND policy->'dailyCapAtomic' = 'null'::jsonb)
      OR (policy->>'runMode' = 'CONTINUOUS' AND policy->'runLimit' = 'null'::jsonb
        AND policy->>'dailyCapAtomic' ~ '^[1-9][0-9]{0,18}$')
    )
  )
);

CREATE TABLE public.augmented_layer_policy_mutations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  result_snapshot JSONB NOT NULL,
  result_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT augmented_layer_policy_mutations_key_check
    CHECK (idempotency_key ~ '^[A-Za-z0-9._:-]{8,128}$'),
  CONSTRAINT augmented_layer_policy_mutations_hash_check CHECK (
    payload_hash ~ '^[0-9a-f]{64}$' AND result_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT augmented_layer_policy_mutations_result_check CHECK (
    jsonb_typeof(result_snapshot) = 'object'
    AND result_snapshot ?& ARRAY['policy', 'policyHash', 'updatedAt']
    AND result_snapshot - ARRAY['policy', 'policyHash', 'updatedAt'] = '{}'::jsonb
    AND result_snapshot->>'policyHash' ~ '^[0-9a-f]{64}$'
  )
);

CREATE UNIQUE INDEX uniq_augmented_layer_policy_mutations_owner_key
  ON public.augmented_layer_policy_mutations(owner_user_id, idempotency_key);
CREATE INDEX idx_augmented_layer_policy_mutations_owner_created
  ON public.augmented_layer_policy_mutations(owner_user_id, created_at);

CREATE OR REPLACE FUNCTION public.enforce_augmented_layer_policy()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.policy_hash <> public.kernel_lifecycle_hash('goal-policy', NEW.policy) THEN
    RAISE EXCEPTION 'augmented layer policy hash mismatch' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.owner_user_id <> NEW.owner_user_id THEN
    RAISE EXCEPTION 'augmented layer policy owner is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER augmented_layer_policies_integrity
BEFORE INSERT OR UPDATE ON public.augmented_layer_policies
FOR EACH ROW EXECUTE FUNCTION public.enforce_augmented_layer_policy();

CREATE OR REPLACE FUNCTION public.reject_augmented_layer_policy_history_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'augmented layer policy history is append-only' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER augmented_layer_policy_mutations_append_only
BEFORE UPDATE OR DELETE ON public.augmented_layer_policy_mutations
FOR EACH ROW EXECUTE FUNCTION public.reject_augmented_layer_policy_history_mutation();
CREATE TRIGGER augmented_layer_policy_mutations_no_truncate
BEFORE TRUNCATE ON public.augmented_layer_policy_mutations
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_augmented_layer_policy_history_mutation();

ALTER TABLE public.goal_run_jobs ADD COLUMN risk_lane TEXT;
ALTER TABLE public.goal_run_jobs DROP CONSTRAINT goal_run_jobs_capabilities_check;
ALTER TABLE public.goal_run_jobs ADD CONSTRAINT goal_run_jobs_capabilities_check CHECK (
  array_position(covered_capabilities, NULL) IS NULL
  AND (
    (risk_lane IS NULL AND cardinality(covered_capabilities) BETWEEN 1 AND 4)
    OR (risk_lane IS NOT NULL AND cardinality(covered_capabilities) BETWEEN 0 AND 4)
  )
);
ALTER TABLE public.goal_run_jobs ADD CONSTRAINT goal_run_jobs_risk_lane_check CHECK (
  risk_lane IS NULL OR (
    role = 'ANALYSIS' AND risk_lane IN ('LOW', 'MID', 'HIGH')
    AND selection_rank = CASE risk_lane WHEN 'LOW' THEN 1 WHEN 'MID' THEN 2 WHEN 'HIGH' THEN 3 END
  )
);
CREATE UNIQUE INDEX uniq_goal_run_jobs_risk_lane
  ON public.goal_run_jobs(goal_run_id, risk_lane) WHERE risk_lane IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_goal_run_job_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.goal_run_id <> NEW.goal_run_id OR OLD.agent_version_id <> NEW.agent_version_id OR
     OLD.role <> NEW.role OR OLD.risk_lane IS DISTINCT FROM NEW.risk_lane OR
     OLD.selection_rank <> NEW.selection_rank OR
     OLD.covered_capabilities IS DISTINCT FROM NEW.covered_capabilities OR
     OLD.price_atomic_snapshot <> NEW.price_atomic_snapshot OR
     OLD.manifest_hash_snapshot <> NEW.manifest_hash_snapshot OR
     OLD.full_subname_snapshot <> NEW.full_subname_snapshot OR
     (OLD.job_id IS NOT NULL AND OLD.job_id IS DISTINCT FROM NEW.job_id) THEN
    RAISE EXCEPTION 'goal run job snapshot is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.goal_runs ADD CONSTRAINT goal_runs_tri_risk_report_check CHECK (
  report IS NULL OR policy_snapshot->>'schemaVersion' <> '2' OR (
    report->>'orchestrationMode' = 'TRI_RISK_V1'
    AND jsonb_typeof(report->'lanes') = 'array'
    AND jsonb_array_length(report->'lanes') BETWEEN 1 AND 3
    AND report->>'agreement' IN ('AGREEMENT', 'DISAGREEMENT')
    AND (state <> 'READY' OR jsonb_array_length(report->'lanes') = 3)
    AND (state <> 'PARTIAL' OR report->'swapProposal' = 'null'::jsonb)
  )
);
