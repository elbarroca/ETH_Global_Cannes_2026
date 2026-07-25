-- A5/A6 kernel foundation: manifest-v2 publication, delivery-ready gating,
-- immutable Base Sepolia x402 evidence, and durable Uniswap receipt policy.

ALTER TABLE public.jobs DROP CONSTRAINT jobs_state_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_state_check
  CHECK (state IN (
    'QUEUED', 'RUNNING', 'DELIVERY_READY', 'SUCCEEDED',
    'FAILED', 'CANCELED', 'A3_NOT_CONFIGURED'
  ));

CREATE OR REPLACE FUNCTION public.enforce_job_state_transition()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF OLD.state = NEW.state THEN RETURN NEW; END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'job transition requires optimistic version increment' USING ERRCODE = '23514';
  END IF;
  IF NOT (
    (OLD.state = 'QUEUED' AND NEW.state IN ('RUNNING', 'CANCELED', 'FAILED')) OR
    (OLD.state = 'RUNNING' AND NEW.state IN ('QUEUED', 'DELIVERY_READY', 'FAILED', 'CANCELED', 'A3_NOT_CONFIGURED')) OR
    (OLD.state = 'DELIVERY_READY' AND NEW.state = 'SUCCEEDED')
  ) THEN
    RAISE EXCEPTION 'illegal job state transition: % -> %', OLD.state, NEW.state USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.agent_versions ADD CONSTRAINT agent_versions_manifest_schema_check
  CHECK (
    jsonb_typeof(manifest) = 'object'
    AND manifest->>'schemaVersion' IN ('1', '2')
  );

ALTER TABLE public.agent_versions ADD CONSTRAINT agent_versions_manifest_v2_shape_check
  CHECK (
    manifest->>'schemaVersion' <> '2'
    OR (
      manifest->>'adapterKey' = 'protected-a3'
      AND manifest->'endpoint' = 'null'::jsonb
      AND manifest->'connectorKey' = 'null'::jsonb
      AND manifest->>'ownerWallet' = lower(owner_wallet)
      AND manifest->>'payoutAddress' = lower(payout_address)
      AND payout_address IS NOT NULL
      AND price_atomic = 1000
      AND manifest->>'priceAtomic' = '1000'
      AND asset = 'USDC_ATOMIC'
      AND manifest->>'asset' = 'USDC_ATOMIC'
      AND proof_policy = 'verified-receipt-required'
      AND manifest->>'proofPolicy' = 'verified-receipt-required'
      AND manifest->'mcp' = '[]'::jsonb
      AND jsonb_typeof(manifest->'skills') = 'array'
      AND jsonb_array_length(manifest->'skills') BETWEEN 1 AND 4
      AND jsonb_typeof(manifest->'nativeConnections') = 'array'
      AND manifest->>'reviewedPromptHash' ~ '^[0-9a-f]{64}$'
      AND manifest->>'reviewedConfigHash' ~ '^[0-9a-f]{64}$'
      AND (
        (manifest->'ensBinding' = 'null'::jsonb AND manifest->'ensBindingHash' = 'null'::jsonb)
        OR (jsonb_typeof(manifest->'ensBinding') = 'object' AND manifest->>'ensBindingHash' ~ '^[0-9a-f]{64}$')
      )
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_manifest_v2_publication()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE skill jsonb;
DECLARE connection jsonb;
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
  END IF;
  IF NEW.published AND (TG_OP = 'INSERT' OR NOT OLD.published)
    AND NEW.manifest->>'schemaVersion' <> '2' THEN
    RAISE EXCEPTION 'new publications require manifest schema v2' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER agent_versions_manifest_v2_publication
BEFORE INSERT OR UPDATE ON public.agent_versions
FOR EACH ROW EXECUTE FUNCTION public.enforce_manifest_v2_publication();

CREATE TABLE public.x402_payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE RESTRICT,
  delivery_receipt_id UUID NOT NULL UNIQUE REFERENCES public.receipts(id) ON DELETE RESTRICT,
  agent_version_id UUID NOT NULL REFERENCES public.agent_versions(id) ON DELETE RESTRICT,
  payer_address TEXT NOT NULL,
  creator_recipient TEXT NOT NULL,
  network TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  asset_address TEXT NOT NULL,
  amount_atomic BIGINT NOT NULL,
  facilitator_payload JSONB NOT NULL,
  facilitator_payload_hash TEXT NOT NULL UNIQUE,
  transaction_hash TEXT NOT NULL UNIQUE,
  finality_block BIGINT NOT NULL,
  finality_block_hash TEXT NOT NULL,
  finalized_at TIMESTAMPTZ(6) NOT NULL,
  payer_balance_delta_atomic BIGINT NOT NULL,
  creator_balance_delta_atomic BIGINT NOT NULL,
  request_hash TEXT NOT NULL UNIQUE,
  release_hash TEXT NOT NULL,
  release_sha TEXT NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT x402_receipts_exact_payment_check CHECK (
    network = 'base-sepolia'
    AND chain_id = 84532
    AND asset_address = '0x036cbd53842c5426634e7929541ec2318f3dcf7e'
    AND amount_atomic = 1000
    AND payer_balance_delta_atomic = -1000
    AND creator_balance_delta_atomic = 1000
  ),
  CONSTRAINT x402_receipts_address_check CHECK (
    payer_address ~ '^0x[0-9a-f]{40}$'
    AND creator_recipient ~ '^0x[0-9a-f]{40}$'
  ),
  CONSTRAINT x402_receipts_hash_check CHECK (
    facilitator_payload_hash ~ '^[0-9a-f]{64}$'
    AND transaction_hash ~ '^0x[0-9a-f]{64}$'
    AND finality_block_hash ~ '^0x[0-9a-f]{64}$'
    AND request_hash ~ '^[0-9a-f]{64}$'
    AND release_hash ~ '^[0-9a-f]{64}$'
    AND release_sha ~ '^[0-9a-f]{40}$'
  ),
  CONSTRAINT x402_receipts_finality_check CHECK (
    finality_block > 0
    AND finalized_at <= created_at
    AND jsonb_typeof(facilitator_payload) = 'object'
    AND facilitator_payload <> '{}'::jsonb
  )
);

CREATE INDEX idx_x402_receipts_version
  ON public.x402_payment_receipts(agent_version_id, created_at);

CREATE OR REPLACE FUNCTION public.enforce_x402_payment_receipt()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.users payer ON payer.id = j.buyer_user_id
    JOIN public.agent_versions v ON v.id = j.agent_version_id
    JOIN public.receipts r ON r.id = NEW.delivery_receipt_id
    JOIN public.effects e ON e.id = r.effect_id AND e.job_id = j.id
    WHERE j.id = NEW.job_id
      AND j.state = 'DELIVERY_READY'
      AND j.financial_outcome IS NULL
      AND j.agent_version_id = NEW.agent_version_id
      AND lower(payer.wallet_address) = NEW.payer_address
      AND lower(COALESCE(v.payout_address, v.owner_wallet)) = NEW.creator_recipient
      AND r.job_id = j.id AND r.verified
      AND e.state = 'SUCCEEDED' AND e.result_hash = r.result_hash
      AND NOT EXISTS (SELECT 1 FROM public.settlements s WHERE s.job_id = j.id)
      AND NOT EXISTS (SELECT 1 FROM public.refunds f WHERE f.job_id = j.id)
  ) THEN
    RAISE EXCEPTION 'x402 receipt does not match one delivery-ready job' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER x402_payment_receipts_lineage
BEFORE INSERT ON public.x402_payment_receipts
FOR EACH ROW EXECUTE FUNCTION public.enforce_x402_payment_receipt();

CREATE OR REPLACE FUNCTION public.reject_x402_payment_receipt_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'x402 payment receipts are immutable' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER x402_payment_receipts_immutable
BEFORE UPDATE OR DELETE ON public.x402_payment_receipts
FOR EACH ROW EXECUTE FUNCTION public.reject_x402_payment_receipt_mutation();
CREATE TRIGGER x402_payment_receipts_no_truncate
BEFORE TRUNCATE ON public.x402_payment_receipts
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_x402_payment_receipt_mutation();

CREATE OR REPLACE FUNCTION public.claim_settlement_outcome()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.receipts r
    JOIN public.effects e ON e.id = r.effect_id
    JOIN public.x402_payment_receipts payment
      ON payment.job_id = NEW.job_id AND payment.delivery_receipt_id = r.id
    WHERE r.id = NEW.receipt_id
      AND r.job_id = NEW.job_id
      AND r.verified
      AND e.state = 'SUCCEEDED'
      AND e.result_hash = r.result_hash
  ) THEN
    RAISE EXCEPTION 'settlement requires matching delivery and x402 receipts' USING ERRCODE = '23514';
  END IF;
  UPDATE public.jobs
  SET financial_outcome = 'SETTLED', updated_at = clock_timestamp()
  WHERE id = NEW.job_id AND state = 'SUCCEEDED' AND financial_outcome IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job already has a terminal financial outcome or is not successful' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_verified_commission()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE settled_amount BIGINT;
BEGIN
  SELECT s.amount_atomic INTO settled_amount
  FROM public.settlements s
  JOIN public.x402_payment_receipts payment ON payment.job_id = s.job_id
  WHERE s.id = NEW.settlement_id AND s.job_id = NEW.job_id;
  IF settled_amount IS NULL OR NEW.amount_atomic > settled_amount THEN
    RAISE EXCEPTION 'commission requires matching payment receipt and settlement' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP INDEX public.uniswap_tool_receipts_job_id_key;
ALTER TABLE public.uniswap_tool_receipts
  ADD COLUMN api_request_id TEXT,
  ADD COLUMN request_hash TEXT,
  ADD COLUMN route_hash TEXT,
  ADD COLUMN finality_block BIGINT,
  ADD COLUMN finality_block_hash TEXT,
  ADD COLUMN finalized_at TIMESTAMPTZ(6);

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.uniswap_tool_receipts
    WHERE request_hash IS NULL OR route_hash IS NULL
  ) THEN
    RAISE EXCEPTION 'existing Uniswap receipts require reviewed request and route hashes';
  END IF;
END;
$preflight$;

ALTER TABLE public.uniswap_tool_receipts
  ALTER COLUMN request_hash SET NOT NULL,
  ALTER COLUMN route_hash SET NOT NULL,
  ADD CONSTRAINT uniswap_receipts_job_fk FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE RESTRICT,
  ADD CONSTRAINT uniswap_receipts_version_fk FOREIGN KEY (agent_version_id) REFERENCES public.agent_versions(id) ON DELETE RESTRICT,
  ADD CONSTRAINT uniswap_receipts_amount_check CHECK (amount_in > 0 AND (amount_out IS NULL OR amount_out >= 0)),
  ADD CONSTRAINT uniswap_receipts_slippage_check CHECK (slippage_bps BETWEEN 0 AND 1000),
  ADD CONSTRAINT uniswap_receipts_status_check CHECK (tx_status IN ('QUOTED', 'SUBMITTED', 'CONFIRMED', 'FAILED')),
  ADD CONSTRAINT uniswap_receipts_hash_check CHECK (
    request_hash ~ '^[0-9a-f]{64}$'
    AND route_hash ~ '^[0-9a-f]{64}$'
    AND calldata_hash ~ '^[0-9a-f]{64}$'
    AND (tx_hash IS NULL OR tx_hash ~ '^0x[0-9a-f]{64}$')
    AND (finality_block_hash IS NULL OR finality_block_hash ~ '^0x[0-9a-f]{64}$')
  ),
  ADD CONSTRAINT uniswap_receipts_terminal_shape_check CHECK (
    (tx_status = 'FAILED' AND failure_reason IS NOT NULL)
    OR (tx_status = 'CONFIRMED' AND tx_hash IS NOT NULL AND finality_block > 0
      AND finality_block_hash IS NOT NULL AND finalized_at IS NOT NULL
      AND balance_delta IS NOT NULL AND failure_reason IS NULL)
    OR (tx_status IN ('QUOTED', 'SUBMITTED') AND failure_reason IS NULL
      AND finality_block IS NULL AND finality_block_hash IS NULL AND finalized_at IS NULL)
  );

CREATE UNIQUE INDEX uniswap_tool_receipts_api_request_id_key
  ON public.uniswap_tool_receipts(api_request_id) WHERE api_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_uniswap_receipt_transition()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF OLD.tx_status IN ('CONFIRMED', 'FAILED') THEN
    RAISE EXCEPTION 'terminal Uniswap receipt is immutable' USING ERRCODE = '23514';
  END IF;
  IF ROW(
    OLD.job_id, OLD.buyer_address, OLD.agent_version_id, OLD.quote_request_id,
    OLD.api_request_id, OLD.chain_id, OLD.token_in, OLD.token_out, OLD.amount_in,
    OLD.amount_out, OLD.slippage_bps, OLD.deadline, OLD.spender,
    OLD.request_hash, OLD.route_hash, OLD.calldata_hash, OLD.release_sha, OLD.created_at
  ) IS DISTINCT FROM ROW(
    NEW.job_id, NEW.buyer_address, NEW.agent_version_id, NEW.quote_request_id,
    NEW.api_request_id, NEW.chain_id, NEW.token_in, NEW.token_out, NEW.amount_in,
    NEW.amount_out, NEW.slippage_bps, NEW.deadline, NEW.spender,
    NEW.request_hash, NEW.route_hash, NEW.calldata_hash, NEW.release_sha, NEW.created_at
  ) THEN
    RAISE EXCEPTION 'Uniswap receipt identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.tx_status = NEW.tx_status THEN RETURN NEW; END IF;
  IF NOT (
    (OLD.tx_status = 'QUOTED' AND NEW.tx_status IN ('SUBMITTED', 'FAILED')) OR
    (OLD.tx_status = 'SUBMITTED' AND NEW.tx_status IN ('CONFIRMED', 'FAILED'))
  ) THEN
    RAISE EXCEPTION 'illegal Uniswap receipt transition: % -> %', OLD.tx_status, NEW.tx_status USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER uniswap_tool_receipts_legal_transitions
BEFORE UPDATE ON public.uniswap_tool_receipts
FOR EACH ROW EXECUTE FUNCTION public.enforce_uniswap_receipt_transition();
CREATE TRIGGER uniswap_tool_receipts_append_only
BEFORE DELETE ON public.uniswap_tool_receipts
FOR EACH ROW EXECUTE FUNCTION public.reject_x402_payment_receipt_mutation();
CREATE TRIGGER uniswap_tool_receipts_no_truncate
BEFORE TRUNCATE ON public.uniswap_tool_receipts
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_x402_payment_receipt_mutation();
