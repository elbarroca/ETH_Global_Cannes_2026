-- Catalog-derived manifest v3 and append-only MCP invocation evidence.
-- Existing manifest v1/v2 rows and the canonical commerce ledger are unchanged.

ALTER TABLE public.agent_versions DROP CONSTRAINT agent_versions_manifest_schema_check;
ALTER TABLE public.agent_versions ADD CONSTRAINT agent_versions_manifest_schema_check
  CHECK (
    jsonb_typeof(manifest) = 'object'
    AND manifest->>'schemaVersion' IN ('1', '2', '3')
  );

ALTER TABLE public.agent_versions ADD CONSTRAINT agent_versions_manifest_v3_shape_check
  CHECK (
    manifest->>'schemaVersion' <> '3'
    OR (
      manifest ?& ARRAY[
        'schemaVersion', 'catalogTemplateId', 'catalogSelectionHash', 'name',
        'description', 'instructions', 'capabilities', 'adapterKey', 'endpoint',
        'connectorKey', 'ownerWallet', 'payoutAddress', 'priceAtomic', 'asset',
        'proofPolicy', 'ensBinding', 'ensBindingHash', 'reviewedPromptHash',
        'reviewedConfigHash', 'skills', 'reviewedSources', 'nativeConnections', 'mcp'
      ]
      AND manifest - ARRAY[
        'schemaVersion', 'catalogTemplateId', 'catalogSelectionHash', 'name',
        'description', 'instructions', 'capabilities', 'adapterKey', 'endpoint',
        'connectorKey', 'ownerWallet', 'payoutAddress', 'priceAtomic', 'asset',
        'proofPolicy', 'ensBinding', 'ensBindingHash', 'reviewedPromptHash',
        'reviewedConfigHash', 'skills', 'reviewedSources', 'nativeConnections', 'mcp'
      ] = '{}'::jsonb
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

CREATE OR REPLACE FUNCTION public.enforce_manifest_v2_publication()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE skill jsonb;
DECLARE source jsonb;
DECLARE connection jsonb;
DECLARE binding jsonb;
DECLARE skill_ids text[];
DECLARE source_ids text[];
DECLARE connection_ids text[];
DECLARE binding_ids text[];
DECLARE expected_capabilities text[];
DECLARE expected_skill_ids text[];
DECLARE expected_source_ids text[];
DECLARE expected_connection_ids text[];
DECLARE expected_binding_ids text[];
DECLARE expected_selection_hash text;
DECLARE expected_prompt_hash text;
BEGIN
  IF NEW.manifest->>'schemaVersion' = '2' THEN
    IF NEW.capabilities <> ARRAY(
      SELECT value->>'id'
      FROM jsonb_array_elements(NEW.manifest->'skills') value
      ORDER BY value->>'id'
    ) THEN
      RAISE EXCEPTION 'manifest capabilities must equal sorted pinned skill ids' USING ERRCODE = '23514';
    END IF;
    FOR skill IN SELECT value FROM jsonb_array_elements(NEW.manifest->'skills') value LOOP
      IF (SELECT count(*) FROM jsonb_object_keys(skill)) <> 4 OR NOT (
        (skill->>'id' = 'research'
          AND skill->>'source' = 'kernel://skills/research@1'
          AND skill->>'reviewedHash' = '3a352e1c42081e155b178c9b8af7d82ed633ef9e531cdb2f73dff43eddf91b8f') OR
        (skill->>'id' = 'market-analysis'
          AND skill->>'source' = 'kernel://skills/market-analysis@1'
          AND skill->>'reviewedHash' = '2dea672a577b11b36813102056073761dc6f5e83e0c6b1a36d532a288bf120c4') OR
        (skill->>'id' = 'risk-analysis'
          AND skill->>'source' = 'kernel://skills/risk-analysis@1'
          AND skill->>'reviewedHash' = 'de868a76ab8204afee2dd486c3463d3263c5a26f10276d0b4fa3ba3fe36c705b') OR
        (skill->>'id' = 'uniswap-swap'
          AND skill->>'source' = 'https://github.com/Uniswap/uniswap-ai/tree/main/skills/swap-integration'
          AND skill->>'reviewedHash' = '62d97be9abe4d753ad28044a3ed4c1a4c3b07afaa798c6a283934f707d6de57f')
      ) OR skill->>'policy' <> 'metadata-only-never-execute' THEN
        RAISE EXCEPTION 'manifest contains an unreviewed skill' USING ERRCODE = '23514';
      END IF;
    END LOOP;
    FOR connection IN SELECT value FROM jsonb_array_elements(NEW.manifest->'nativeConnections') value LOOP
      IF (SELECT count(*) FROM jsonb_object_keys(connection)) <> 2
        OR connection->>'id' NOT IN ('zero-g-compute', 'zero-g-storage', 'uniswap-api')
        OR connection->'required' <> 'true'::jsonb THEN
        RAISE EXCEPTION 'manifest contains an unsupported native connection' USING ERRCODE = '23514';
      END IF;
    END LOOP;
  ELSIF NEW.manifest->>'schemaVersion' = '3' THEN
    skill_ids := ARRAY(
      SELECT value->>'id' FROM jsonb_array_elements(NEW.manifest->'skills') WITH ORDINALITY entry(value, ordinality)
      ORDER BY ordinality
    );
    source_ids := ARRAY(
      SELECT value->>'repository' FROM jsonb_array_elements(NEW.manifest->'reviewedSources') WITH ORDINALITY entry(value, ordinality)
      ORDER BY ordinality
    );
    connection_ids := ARRAY(
      SELECT value->>'id' FROM jsonb_array_elements(NEW.manifest->'nativeConnections') WITH ORDINALITY entry(value, ordinality)
      ORDER BY ordinality
    );
    binding_ids := ARRAY(
      SELECT value->>'id' FROM jsonb_array_elements(NEW.manifest->'mcp') WITH ORDINALITY entry(value, ordinality)
      ORDER BY ordinality
    );

    CASE NEW.manifest->>'catalogTemplateId'
      WHEN 'alpha-researcher' THEN
        expected_capabilities := ARRAY['research'];
        expected_skill_ids := ARRAY['persona.researcher','data.the-graph.read','data.coingecko.market','connection.0g.compute','connection.0g.storage'];
        expected_source_ids := ARRAY['graphops/subgraph-mcp','coingecko/skills'];
        expected_connection_ids := ARRAY['zero-g-compute','zero-g-storage'];
        expected_binding_ids := ARRAY['mcp.the-graph.pinned-deployment-lookup','mcp.the-graph.liquidity-volume-snapshot','mcp.coingecko.spot-price','mcp.coingecko.market-snapshot'];
        expected_selection_hash := '88f0135041200624a617ec2ede6a5623b2d426c3ec0a1fcf95f697b1f5a62e51';
        expected_prompt_hash := 'ff97fa5a0791398f0fe73291faa56802bb2739a10da1c10957b87f2d6de38c4b';
      WHEN 'market-pulse' THEN
        expected_capabilities := ARRAY['market-analysis'];
        expected_skill_ids := ARRAY['persona.market-analyst','data.coingecko.market','connection.0g.compute','connection.0g.storage'];
        expected_source_ids := ARRAY['coingecko/skills'];
        expected_connection_ids := ARRAY['zero-g-compute','zero-g-storage'];
        expected_binding_ids := ARRAY['mcp.coingecko.spot-price','mcp.coingecko.market-snapshot'];
        expected_selection_hash := '6a959a9cbaddb553c3cdce4851970a306245a90f54bebaf85e651431b55fa6e6';
        expected_prompt_hash := 'bfd1565be9bd3167383e189ee31e4f3f1910ce8cb2b83cc628789f60e734db61';
      WHEN 'liquidity-scout' THEN
        expected_capabilities := ARRAY['market-analysis','research'];
        expected_skill_ids := ARRAY['persona.researcher','persona.market-analyst','data.the-graph.read','connection.0g.compute','connection.0g.storage'];
        expected_source_ids := ARRAY['graphops/subgraph-mcp'];
        expected_connection_ids := ARRAY['zero-g-compute','zero-g-storage'];
        expected_binding_ids := ARRAY['mcp.the-graph.pinned-deployment-lookup','mcp.the-graph.liquidity-volume-snapshot'];
        expected_selection_hash := 'a4d1a3393c6c40702c420f0a0d89841732b5f5c934b96a0e749e4975ead76d7d';
        expected_prompt_hash := 'f012f14bbdcd9f7dc93ee443715c9345df86d154c0e8a9ead86ec8ed743b1108';
      WHEN 'onchain-forensics' THEN
        expected_capabilities := ARRAY['research','risk-analysis'];
        expected_skill_ids := ARRAY['persona.researcher','persona.risk-analyst','data.the-graph.read','connection.0g.compute','connection.0g.storage'];
        expected_source_ids := ARRAY['graphops/subgraph-mcp'];
        expected_connection_ids := ARRAY['zero-g-compute','zero-g-storage'];
        expected_binding_ids := ARRAY['mcp.the-graph.pinned-deployment-lookup','mcp.the-graph.liquidity-volume-snapshot'];
        expected_selection_hash := 'e0e9e2c42575069abdf282ef8510584485c4ed3b1a28a50d04b9e164dfb60abb';
        expected_prompt_hash := '9f88c147c5d84650aa1883fe78c5b42dbb47c3a24e2f9b557849ea9761a94593';
      WHEN 'defi-risk-sentinel' THEN
        expected_capabilities := ARRAY['research','risk-analysis'];
        expected_skill_ids := ARRAY['persona.researcher','persona.risk-analyst','data.the-graph.read','data.coingecko.market','connection.0g.compute','connection.0g.storage'];
        expected_source_ids := ARRAY['graphops/subgraph-mcp','coingecko/skills'];
        expected_connection_ids := ARRAY['zero-g-compute','zero-g-storage'];
        expected_binding_ids := ARRAY['mcp.the-graph.pinned-deployment-lookup','mcp.the-graph.liquidity-volume-snapshot','mcp.coingecko.spot-price','mcp.coingecko.market-snapshot'];
        expected_selection_hash := 'ad9ada95f408f7d14ae180b7a6d2e1c070c4ce418a41923068d4d98ef8c7c07a';
        expected_prompt_hash := 'ba14d03749309e6455db14b42e70fcfb84dc56f1172a46c507f35cea620d5a66';
      WHEN 'volume-anomaly' THEN
        expected_capabilities := ARRAY['market-analysis','risk-analysis'];
        expected_skill_ids := ARRAY['persona.market-analyst','persona.risk-analyst','data.the-graph.read','data.coingecko.market','connection.0g.compute','connection.0g.storage'];
        expected_source_ids := ARRAY['graphops/subgraph-mcp','coingecko/skills'];
        expected_connection_ids := ARRAY['zero-g-compute','zero-g-storage'];
        expected_binding_ids := ARRAY['mcp.the-graph.pinned-deployment-lookup','mcp.the-graph.liquidity-volume-snapshot','mcp.coingecko.spot-price','mcp.coingecko.market-snapshot'];
        expected_selection_hash := '3060ba95688c40a240deb86c3f0522eec86c76de9ed74cf769b376ccf1941d9e';
        expected_prompt_hash := '105ade03d57ad5152663946abcf43d5200d9216bc7cad090c8cd048607626116';
      WHEN 'thesis-synthesizer' THEN
        expected_capabilities := ARRAY['market-analysis','research','risk-analysis'];
        expected_skill_ids := ARRAY['persona.synthesizer','data.the-graph.read','data.coingecko.market','connection.0g.compute','connection.0g.storage'];
        expected_source_ids := ARRAY['graphops/subgraph-mcp','coingecko/skills'];
        expected_connection_ids := ARRAY['zero-g-compute','zero-g-storage'];
        expected_binding_ids := ARRAY['mcp.the-graph.pinned-deployment-lookup','mcp.the-graph.liquidity-volume-snapshot','mcp.coingecko.spot-price','mcp.coingecko.market-snapshot'];
        expected_selection_hash := 'bf3724b2ce1ad41753c3e93f6750f7adf78176bbdd6d7c6ec41101b2ce0c84e7';
        expected_prompt_hash := 'cad51c5c4da5c72cd57d119dc5fdd773ed0cfd253899d141ef060afc8acc1054';
      WHEN 'swap-strategist' THEN
        expected_capabilities := ARRAY['market-analysis','risk-analysis','uniswap-swap'];
        expected_skill_ids := ARRAY['persona.market-analyst','persona.risk-analyst','data.the-graph.read','data.coingecko.market','action.uniswap.propose-swap','connection.0g.compute','connection.0g.storage'];
        expected_source_ids := ARRAY['graphops/subgraph-mcp','coingecko/skills','circlefin/skills','Uniswap/uniswap-ai'];
        expected_connection_ids := ARRAY['zero-g-compute','zero-g-storage','uniswap-api'];
        expected_binding_ids := ARRAY['mcp.the-graph.pinned-deployment-lookup','mcp.the-graph.liquidity-volume-snapshot','mcp.coingecko.spot-price','mcp.coingecko.market-snapshot'];
        expected_selection_hash := 'ee3cf07e93e18db148a8a8b5b52e4fae3e2baf86b29f38eb6cf00617c334b3de';
        expected_prompt_hash := '5564548010f0f673d1cc509f36142ca9d6eb39758c83f0633c4990481816c0f5';
      ELSE
        RAISE EXCEPTION 'manifest contains an unknown founding template' USING ERRCODE = '23514';
    END CASE;

    IF NEW.capabilities <> expected_capabilities
      OR NEW.manifest->'capabilities' <> to_jsonb(expected_capabilities)
      OR skill_ids <> expected_skill_ids OR source_ids <> expected_source_ids
      OR connection_ids <> expected_connection_ids OR binding_ids <> expected_binding_ids
      OR NEW.manifest->>'catalogSelectionHash' <> expected_selection_hash
      OR NEW.manifest->>'reviewedPromptHash' <> expected_prompt_hash
      OR NEW.prompt_hash <> expected_prompt_hash
      OR NEW.prompt_hash <> public.kernel_lifecycle_hash('agent-prompt', to_jsonb(NEW.manifest->>'instructions'))
      OR NEW.config_hash <> NEW.manifest->>'reviewedConfigHash'
      OR NEW.config_hash <> public.kernel_lifecycle_hash('agent-config', jsonb_build_object(
        'adapterKey', NEW.manifest->'adapterKey',
        'capabilities', NEW.manifest->'capabilities',
        'catalogSelectionHash', NEW.manifest->'catalogSelectionHash',
        'catalogTemplateId', NEW.manifest->'catalogTemplateId',
        'connectorKey', NEW.manifest->'connectorKey',
        'endpoint', NEW.manifest->'endpoint',
        'ensBinding', NEW.manifest->'ensBinding',
        'ensBindingHash', NEW.manifest->'ensBindingHash',
        'mcp', NEW.manifest->'mcp',
        'nativeConnections', NEW.manifest->'nativeConnections',
        'payoutAddress', NEW.manifest->'payoutAddress',
        'priceAtomic', NEW.manifest->'priceAtomic',
        'proofPolicy', NEW.manifest->'proofPolicy',
        'reviewedSources', NEW.manifest->'reviewedSources',
        'skills', NEW.manifest->'skills'
      ))
    THEN
      RAISE EXCEPTION 'manifest does not match its catalog template' USING ERRCODE = '23514';
    END IF;

    FOR skill IN SELECT value FROM jsonb_array_elements(NEW.manifest->'skills') value LOOP
      IF skill - ARRAY['schemaVersion','id','category','capabilities','constraints','snapshotHash'] <> '{}'::jsonb
        OR NOT (skill ?& ARRAY['schemaVersion','id','category','capabilities','constraints','snapshotHash'])
        OR skill->'schemaVersion' <> '1'::jsonb
        OR skill->>'snapshotHash' <> public.kernel_lifecycle_hash('agent-skill-snapshot', skill - 'snapshotHash')
        OR NOT (
          (skill->>'id' = 'persona.researcher' AND skill->>'category' = 'PERSONA' AND skill->'capabilities' = '["research"]'::jsonb AND skill->'constraints' = '[]'::jsonb) OR
          (skill->>'id' = 'persona.market-analyst' AND skill->>'category' = 'PERSONA' AND skill->'capabilities' = '["market-analysis"]'::jsonb AND skill->'constraints' = '[]'::jsonb) OR
          (skill->>'id' = 'persona.risk-analyst' AND skill->>'category' = 'PERSONA' AND skill->'capabilities' = '["risk-analysis"]'::jsonb AND skill->'constraints' = '[]'::jsonb) OR
          (skill->>'id' = 'persona.synthesizer' AND skill->>'category' = 'PERSONA' AND skill->'capabilities' = '["research","market-analysis","risk-analysis"]'::jsonb AND skill->'constraints' = '[]'::jsonb) OR
          (skill->>'id' IN ('data.the-graph.read','data.coingecko.market') AND skill->>'category' = 'DATA' AND skill->'capabilities' = '[]'::jsonb AND skill->'constraints' = '["read-only"]'::jsonb) OR
          (skill->>'id' = 'action.uniswap.propose-swap' AND skill->>'category' = 'ACTION' AND skill->'capabilities' = '["uniswap-swap"]'::jsonb AND skill->'constraints' = '["broadcasting-forbidden","network:unichain-sepolia","proposal-only","signing-forbidden","wallet-approval-required"]'::jsonb) OR
          (skill->>'id' IN ('connection.0g.compute','connection.0g.storage') AND skill->>'category' = 'CONNECTION' AND skill->'capabilities' = '[]'::jsonb AND skill->'constraints' = '["protected-a3-required"]'::jsonb)
        )
      THEN
        RAISE EXCEPTION 'manifest contains a tampered founding skill snapshot' USING ERRCODE = '23514';
      END IF;
    END LOOP;

    FOR connection IN SELECT value FROM jsonb_array_elements(NEW.manifest->'nativeConnections') value LOOP
      IF connection - ARRAY['id','required'] <> '{}'::jsonb
        OR connection->>'id' NOT IN ('zero-g-compute','zero-g-storage','uniswap-api')
        OR connection->'required' <> 'true'::jsonb
      THEN RAISE EXCEPTION 'manifest contains an unsupported native connection' USING ERRCODE = '23514'; END IF;
    END LOOP;

    FOR binding IN SELECT value FROM jsonb_array_elements(NEW.manifest->'mcp') value LOOP
      IF binding - ARRAY['schemaVersion','id','provider','capability','access','timeoutMs','maxResponseBytes'] <> '{}'::jsonb
        OR binding->'schemaVersion' <> '1'::jsonb OR binding->>'access' <> 'read-only'
        OR binding->'timeoutMs' <> '8000'::jsonb OR binding->'maxResponseBytes' <> '32768'::jsonb
        OR (binding->>'id') <> ('mcp.' || (binding->>'provider') || '.' || (binding->>'capability'))
        OR NOT (
          (binding->>'provider' = 'coingecko' AND binding->>'capability' IN ('spot-price','market-snapshot')) OR
          (binding->>'provider' = 'the-graph' AND binding->>'capability' IN ('pinned-deployment-lookup','liquidity-volume-snapshot'))
        )
      THEN RAISE EXCEPTION 'manifest contains an unallowlisted MCP binding' USING ERRCODE = '23514'; END IF;
    END LOOP;

    FOR source IN SELECT value FROM jsonb_array_elements(NEW.manifest->'reviewedSources') value LOOP
      IF source - ARRAY['schemaVersion','repository','revision','license','use','files'] <> '{}'::jsonb
        OR source->'schemaVersion' <> '1'::jsonb
        OR NOT (
          source = '{"schemaVersion":1,"repository":"graphops/subgraph-mcp","revision":"1fe9d4aadd5187df9b2220e0e3fee02daca783bb","license":"Apache-2.0","use":"integration","files":[{"path":"README.md","sha256":"2bf96a3a57c2cee01a42f21900a0d5ccfb58435c32063f83c1fd37c2efec3317"},{"path":"src/types.rs","sha256":"aac6cc6dcf15874d8d006e8126fe9b7af6f4e09c503f7fa43ba931876bdad7ba"}]}'::jsonb OR
          source = '{"schemaVersion":1,"repository":"coingecko/skills","revision":"0a15620d47186c63d7fc26da09b0736c8d95e46b","license":"MIT","use":"integration","files":[{"path":"SKILL.md","sha256":"b6f1743c3e8150431bb5e360a1872195dcf9952078bc041a1fb2e3e89a5ab253"},{"path":"references/common-use-cases.md","sha256":"ee93be0a4e295088df64b8e1f6c2393b0235d1595ee3a846969a8f4bb01150e3"}]}'::jsonb OR
          source = '{"schemaVersion":1,"repository":"circlefin/skills","revision":"c7d269a2025e26410e0e23fb5a73c769dc07d088","license":"Apache-2.0","use":"guidance-only","files":[{"path":"plugins/circle/skills/swap-tokens/SKILL.md","sha256":"f62443de49e5b2e73a392b7639a804d614d9e72300bf4a3233fc747b9b125f73"},{"path":"plugins/circle/skills/agent-wallet-policy/SKILL.md","sha256":"f523dce272e2933c55db5a28a9f41efa1623f8f4d55b9077b07241fbab6a3164"},{"path":"plugins/circle/skills/pay-via-agent-wallet/SKILL.md","sha256":"a4a96e7561fb63e1da3ca3499631cc7735019a4a3846c83f964cfa48af82c50c"}]}'::jsonb OR
          source = '{"schemaVersion":1,"repository":"Uniswap/uniswap-ai","revision":"3ddd8a9de93ef9201314c8759b5761c96ee7aebf","license":"MIT","use":"integration","files":[{"path":"packages/plugins/uniswap-trading/skills/swap-integration/SKILL.md","sha256":"8fa9ad8b6375b44b80fe1313cef7f3f5ab81051b7d8592b53c8687af2debaac7"}]}'::jsonb
        )
      THEN RAISE EXCEPTION 'manifest contains an unreviewed source snapshot' USING ERRCODE = '23514'; END IF;
    END LOOP;
  END IF;

  IF NEW.published AND (TG_OP = 'INSERT' OR NOT OLD.published)
    AND NEW.manifest->>'schemaVersion' NOT IN ('2', '3') THEN
    RAISE EXCEPTION 'new publications require manifest schema v2 or v3' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_goal_run_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."state" = NEW."state" THEN RETURN NEW; END IF;
  IF NOT (
    (OLD."state" = 'SCHEDULED' AND NEW."state" IN ('SELECTING', 'CANCELED')) OR
    (OLD."state" = 'SELECTING' AND NEW."state" IN ('RUNNING', 'BLOCKED', 'FAILED', 'CANCELED')) OR
    (OLD."state" = 'RUNNING' AND NEW."state" IN ('SYNTHESIZING', 'READY', 'PARTIAL', 'BLOCKED', 'FAILED', 'CANCELED')) OR
    (OLD."state" = 'SYNTHESIZING' AND NEW."state" IN ('READY', 'PARTIAL', 'BLOCKED', 'FAILED', 'CANCELED'))
  ) THEN
    RAISE EXCEPTION 'illegal goal run transition: % -> %', OLD."state", NEW."state" USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE public.mcp_invocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_run_job_id UUID NOT NULL REFERENCES public.goal_run_jobs(id) ON DELETE RESTRICT,
  agent_version_id UUID NOT NULL REFERENCES public.agent_versions(id) ON DELETE RESTRICT,
  manifest_hash TEXT NOT NULL,
  binding_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  capability TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  response_hash TEXT,
  context_hash TEXT,
  normalized_response JSONB,
  response_bytes INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL,
  error_code TEXT,
  release_sha TEXT NOT NULL,
  started_at TIMESTAMPTZ(6) NOT NULL,
  completed_at TIMESTAMPTZ(6) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT mcp_invocations_run_job_binding_key UNIQUE (goal_run_job_id, binding_id),
  CONSTRAINT mcp_invocations_hash_check CHECK (
    manifest_hash ~ '^[0-9a-f]{64}$' AND idempotency_key ~ '^[0-9a-f]{64}$'
    AND request_hash ~ '^[0-9a-f]{64}$'
    AND (response_hash IS NULL OR response_hash ~ '^[0-9a-f]{64}$')
    AND (context_hash IS NULL OR context_hash ~ '^[0-9a-f]{64}$')
    AND release_sha ~ '^[0-9a-f]{40}$'
  ),
  CONSTRAINT mcp_invocations_binding_check CHECK (
    binding_id = ('mcp.' || provider || '.' || capability)
    AND (
      (provider = 'coingecko' AND capability IN (
        'search','spot-price','market-snapshot','trending','token-by-address','pool-snapshot','ohlcv'
      )) OR
      (provider = 'the-graph' AND capability IN (
        'pinned-deployment-lookup','schema-read','bounded-query','liquidity-volume-snapshot'
      ))
    )
  ),
  CONSTRAINT mcp_invocations_terminal_check CHECK (
    response_bytes BETWEEN 0 AND 32768 AND completed_at >= started_at
    AND (error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]{2,64}$')
  ),
  CONSTRAINT mcp_invocations_state_check CHECK (
    (state = 'SUCCEEDED' AND error_code IS NULL AND normalized_response IS NOT NULL
      AND response_hash IS NOT NULL AND context_hash IS NOT NULL
      AND response_bytes = octet_length(public.canonical_kernel_json(normalized_response)))
    OR
    (state = 'FAILED' AND error_code IS NOT NULL AND normalized_response IS NULL
      AND response_hash IS NULL AND context_hash IS NULL AND response_bytes = 0)
  )
);

CREATE INDEX idx_mcp_invocations_version_created
  ON public.mcp_invocations(agent_version_id, created_at);

CREATE OR REPLACE FUNCTION public.enforce_mcp_invocation_lineage()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE link public.goal_run_jobs%ROWTYPE;
DECLARE run public.goal_runs%ROWTYPE;
DECLARE version public.agent_versions%ROWTYPE;
BEGIN
  SELECT * INTO link FROM public.goal_run_jobs WHERE id = NEW.goal_run_job_id FOR SHARE;
  SELECT * INTO run FROM public.goal_runs WHERE id = link.goal_run_id FOR SHARE;
  SELECT * INTO version FROM public.agent_versions WHERE id = NEW.agent_version_id FOR SHARE;
  IF NOT FOUND OR link.id IS NULL OR run.id IS NULL OR version.id IS NULL
    OR link.agent_version_id <> NEW.agent_version_id
    OR link.manifest_hash_snapshot <> NEW.manifest_hash
    OR version.manifest_hash <> NEW.manifest_hash
    OR version.manifest->>'schemaVersion' <> '3'
    OR run.state NOT IN ('RUNNING','SYNTHESIZING')
    OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(version.manifest->'mcp') binding
      WHERE binding->>'id' = NEW.binding_id
        AND binding->>'provider' = NEW.provider
        AND binding->>'capability' = NEW.capability
        AND binding->>'access' = 'read-only'
        AND binding->'timeoutMs' = '8000'::jsonb
        AND binding->'maxResponseBytes' = '32768'::jsonb
    )
  THEN
    RAISE EXCEPTION 'MCP invocation lineage or binding is invalid' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mcp_invocations_lineage
BEFORE INSERT ON public.mcp_invocations
FOR EACH ROW EXECUTE FUNCTION public.enforce_mcp_invocation_lineage();

CREATE OR REPLACE FUNCTION public.reject_mcp_invocation_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'MCP invocation evidence is append-only' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER mcp_invocations_append_only
BEFORE UPDATE OR DELETE ON public.mcp_invocations
FOR EACH ROW EXECUTE FUNCTION public.reject_mcp_invocation_mutation();

CREATE TRIGGER mcp_invocations_no_truncate
BEFORE TRUNCATE ON public.mcp_invocations
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_mcp_invocation_mutation();
