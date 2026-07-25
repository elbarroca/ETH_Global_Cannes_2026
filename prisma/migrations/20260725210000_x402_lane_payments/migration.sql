CREATE TABLE public.x402_payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE RESTRICT,
  quote_id UUID NOT NULL UNIQUE REFERENCES public.quotes(id) ON DELETE RESTRICT,
  delivery_receipt_id UUID NOT NULL UNIQUE REFERENCES public.receipts(id) ON DELETE RESTRICT,
  agent_version_id UUID NOT NULL REFERENCES public.agent_versions(id) ON DELETE RESTRICT,
  job_version INTEGER NOT NULL,
  payer_address TEXT NOT NULL,
  creator_recipient TEXT NOT NULL,
  network TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  asset_address TEXT NOT NULL,
  asset TEXT NOT NULL,
  amount_atomic BIGINT NOT NULL,
  effect_request_hash TEXT NOT NULL,
  release_sha TEXT NOT NULL,
  gateway_verifying_contract TEXT NOT NULL,
  expires_at TIMESTAMPTZ(6) NOT NULL,
  server_nonce TEXT NOT NULL UNIQUE,
  server_nonce_hash TEXT NOT NULL UNIQUE,
  challenge JSONB NOT NULL,
  challenge_hash TEXT NOT NULL UNIQUE,
  payment_requirements JSONB,
  signed_payload JSONB,
  signed_payload_hash TEXT UNIQUE,
  authorization_nonce TEXT UNIQUE,
  state TEXT NOT NULL DEFAULT 'PREPARED',
  error_code TEXT,
  gateway_transaction_id UUID UNIQUE,
  gateway_settled_at TIMESTAMPTZ(6),
  finalized_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT x402_attempts_state_check CHECK (
    state IN ('PREPARED', 'SIGNED', 'SUBMITTED', 'GATEWAY_SETTLED', 'FAILED', 'AMBIGUOUS', 'FINALIZED')
  ),
  CONSTRAINT x402_attempts_identity_check CHECK (
    job_version >= 0
    AND amount_atomic > 0
    AND network ~ '^eip155:[1-9][0-9]{0,9}$'
    AND chain_id = split_part(network, ':', 2)::INTEGER
    AND payer_address ~ '^0x[0-9a-f]{40}$'
    AND creator_recipient ~ '^0x[0-9a-f]{40}$'
    AND asset_address ~ '^0x[0-9a-f]{40}$'
    AND gateway_verifying_contract ~ '^0x[0-9a-f]{40}$'
    AND effect_request_hash ~ '^[0-9a-f]{64}$'
    AND release_sha ~ '^[0-9a-f]{40}$'
    AND server_nonce ~ '^0x[0-9a-f]{64}$'
    AND server_nonce_hash ~ '^[0-9a-f]{64}$'
    AND challenge_hash ~ '^[0-9a-f]{64}$'
    AND expires_at > created_at
  ),
  CONSTRAINT x402_attempts_state_shape_check CHECK (
    (
      state = 'PREPARED'
      AND payment_requirements IS NULL AND signed_payload IS NULL
      AND signed_payload_hash IS NULL AND authorization_nonce IS NULL
      AND error_code IS NULL AND gateway_transaction_id IS NULL
      AND gateway_settled_at IS NULL AND finalized_at IS NULL
    ) OR (
      state IN ('SIGNED', 'SUBMITTED')
      AND payment_requirements IS NOT NULL AND signed_payload IS NOT NULL
      AND signed_payload_hash IS NOT NULL AND authorization_nonce IS NOT NULL
      AND error_code IS NULL AND gateway_transaction_id IS NULL
      AND gateway_settled_at IS NULL AND finalized_at IS NULL
    ) OR (
      state IN ('FAILED', 'AMBIGUOUS')
      AND payment_requirements IS NOT NULL AND signed_payload IS NOT NULL
      AND signed_payload_hash IS NOT NULL AND authorization_nonce IS NOT NULL
      AND error_code IS NOT NULL AND gateway_transaction_id IS NULL
      AND gateway_settled_at IS NULL AND finalized_at IS NULL
    ) OR (
      state = 'GATEWAY_SETTLED'
      AND payment_requirements IS NOT NULL AND signed_payload IS NOT NULL
      AND signed_payload_hash IS NOT NULL AND authorization_nonce IS NOT NULL
      AND error_code IS NULL AND gateway_transaction_id IS NOT NULL
      AND gateway_settled_at IS NOT NULL AND finalized_at IS NULL
    ) OR (
      state = 'FINALIZED'
      AND payment_requirements IS NOT NULL AND signed_payload IS NOT NULL
      AND signed_payload_hash IS NOT NULL AND authorization_nonce IS NOT NULL
      AND error_code IS NULL AND gateway_transaction_id IS NOT NULL
      AND gateway_settled_at IS NOT NULL AND finalized_at IS NOT NULL
    )
  )
);

CREATE INDEX idx_x402_attempts_state_updated
  ON public.x402_payment_attempts(state, updated_at);
CREATE INDEX idx_x402_attempts_version_created
  ON public.x402_payment_attempts(agent_version_id, created_at);

CREATE OR REPLACE FUNCTION public.enforce_x402_payment_attempt()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'PREPARED'
      OR NEW.challenge_hash <> public.kernel_lifecycle_hash('x402-lane-challenge', NEW.challenge)
      OR NEW.server_nonce_hash <> public.kernel_lifecycle_hash('x402-server-nonce', to_jsonb(NEW.server_nonce))
      OR NEW.challenge <> jsonb_build_object(
        'schemaVersion', 1,
        'quoteId', NEW.quote_id::TEXT,
        'jobId', NEW.job_id::TEXT,
        'deliveryReceiptId', NEW.delivery_receipt_id::TEXT,
        'jobVersion', NEW.job_version,
        'payer', NEW.payer_address,
        'recipient', NEW.creator_recipient,
        'amountAtomic', NEW.amount_atomic::TEXT,
        'asset', NEW.asset,
        'assetAddress', NEW.asset_address,
        'network', NEW.network,
        'gatewayVerifyingContract', NEW.gateway_verifying_contract,
        'effectRequestHash', NEW.effect_request_hash,
        'releaseSha', NEW.release_sha,
        'expiresAt', to_char(NEW.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'serverNonce', NEW.server_nonce,
        'serverNonceHash', NEW.server_nonce_hash
      )
      OR NOT EXISTS (
        SELECT 1
        FROM public.jobs job
        JOIN public.kernel_orders order_row ON order_row.id = job.order_id
        JOIN public.quotes quote ON quote.id = order_row.quote_id
        JOIN public.receipts receipt ON receipt.id = NEW.delivery_receipt_id
        JOIN public.effects effect ON effect.id = receipt.effect_id AND effect.job_id = job.id
        JOIN public.agent_versions version ON version.id = job.agent_version_id
        JOIN public.users payer ON payer.id = job.buyer_user_id
        WHERE job.id = NEW.job_id
          AND job.state = 'DELIVERY_READY' AND job.financial_outcome IS NULL
          AND job.version = NEW.job_version
          AND job.agent_version_id = NEW.agent_version_id
          AND quote.id = NEW.quote_id
          AND quote.buyer_user_id = job.buyer_user_id
          AND quote.agent_version_id = job.agent_version_id
          AND order_row.buyer_user_id = job.buyer_user_id
          AND order_row.agent_version_id = job.agent_version_id
          AND order_row.intent_id = job.intent_id
          AND quote.amount_atomic = order_row.amount_atomic
          AND version.price_atomic = order_row.amount_atomic
          AND NEW.amount_atomic = order_row.amount_atomic
          AND quote.asset = order_row.asset AND version.asset = order_row.asset
          AND NEW.asset = order_row.asset
          AND receipt.job_id = job.id AND receipt.verified
          AND effect.state = 'SUCCEEDED' AND effect.result_hash = receipt.result_hash
          AND effect.request_hash = NEW.effect_request_hash
          AND lower(payer.wallet_address) = NEW.payer_address
          AND lower(COALESCE(version.payout_address, version.owner_wallet)) = NEW.creator_recipient
          AND NOT EXISTS (SELECT 1 FROM public.x402_payment_receipts payment WHERE payment.job_id = job.id)
          AND NOT EXISTS (SELECT 1 FROM public.settlements settlement WHERE settlement.job_id = job.id)
          AND NOT EXISTS (SELECT 1 FROM public.commissions commission WHERE commission.job_id = job.id)
          AND NOT EXISTS (SELECT 1 FROM public.refunds refund WHERE refund.job_id = job.id)
      )
    THEN
      RAISE EXCEPTION 'x402 payment attempt does not match one frozen delivery-ready lane'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id <> OLD.id OR NEW.job_id <> OLD.job_id OR NEW.quote_id <> OLD.quote_id
    OR NEW.delivery_receipt_id <> OLD.delivery_receipt_id
    OR NEW.agent_version_id <> OLD.agent_version_id OR NEW.job_version <> OLD.job_version
    OR NEW.payer_address <> OLD.payer_address OR NEW.creator_recipient <> OLD.creator_recipient
    OR NEW.network <> OLD.network OR NEW.chain_id <> OLD.chain_id
    OR NEW.asset_address <> OLD.asset_address OR NEW.asset <> OLD.asset
    OR NEW.amount_atomic <> OLD.amount_atomic OR NEW.effect_request_hash <> OLD.effect_request_hash
    OR NEW.release_sha <> OLD.release_sha
    OR NEW.gateway_verifying_contract <> OLD.gateway_verifying_contract
    OR NEW.expires_at <> OLD.expires_at OR NEW.server_nonce <> OLD.server_nonce
    OR NEW.server_nonce_hash <> OLD.server_nonce_hash OR NEW.challenge <> OLD.challenge
    OR NEW.challenge_hash <> OLD.challenge_hash OR NEW.created_at <> OLD.created_at
  THEN
    RAISE EXCEPTION 'x402 payment attempt identity is immutable' USING ERRCODE = '23514';
  END IF;

  IF OLD.state <> 'PREPARED' AND (
    NEW.payment_requirements IS DISTINCT FROM OLD.payment_requirements
    OR NEW.signed_payload IS DISTINCT FROM OLD.signed_payload
    OR NEW.signed_payload_hash IS DISTINCT FROM OLD.signed_payload_hash
    OR NEW.authorization_nonce IS DISTINCT FROM OLD.authorization_nonce
  ) THEN
    RAISE EXCEPTION 'x402 signed payload is immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.state IN ('GATEWAY_SETTLED', 'FINALIZED') AND (
    NEW.gateway_transaction_id IS DISTINCT FROM OLD.gateway_transaction_id
    OR NEW.gateway_settled_at IS DISTINCT FROM OLD.gateway_settled_at
  ) THEN
    RAISE EXCEPTION 'x402 Gateway settlement is immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD.state IN ('FAILED', 'FINALIZED') THEN
    RAISE EXCEPTION 'terminal x402 payment attempts are immutable' USING ERRCODE = '23514';
  END IF;
  IF NOT (
    (OLD.state = 'PREPARED' AND NEW.state = 'SIGNED')
    OR (OLD.state = 'SIGNED' AND NEW.state = 'SUBMITTED')
    OR (OLD.state = 'SUBMITTED' AND NEW.state IN ('GATEWAY_SETTLED', 'FAILED', 'AMBIGUOUS'))
    OR (OLD.state = 'AMBIGUOUS' AND NEW.state IN ('GATEWAY_SETTLED', 'FAILED'))
    OR (OLD.state = 'GATEWAY_SETTLED' AND NEW.state = 'FINALIZED')
  ) THEN
    RAISE EXCEPTION 'illegal x402 payment attempt transition: % -> %', OLD.state, NEW.state
      USING ERRCODE = '23514';
  END IF;

  IF NEW.state <> 'PREPARED' AND (
    jsonb_typeof(NEW.payment_requirements) <> 'object'
    OR NEW.payment_requirements - ARRAY['scheme', 'network', 'asset', 'amount', 'payTo', 'maxTimeoutSeconds', 'extra'] <> '{}'::jsonb
    OR NEW.payment_requirements->>'scheme' <> 'exact'
    OR NEW.payment_requirements->>'network' <> NEW.network
    OR NEW.payment_requirements->>'asset' <> NEW.asset_address
    OR NEW.payment_requirements->>'amount' <> NEW.amount_atomic::TEXT
    OR lower(NEW.payment_requirements->>'payTo') <> NEW.creator_recipient
    OR (NEW.payment_requirements->>'maxTimeoutSeconds')::INTEGER NOT BETWEEN 1 AND 3600
    OR NEW.payment_requirements->'extra' <> jsonb_build_object(
      'name', 'GatewayWalletBatched',
      'version', '1',
      'verifyingContract', NEW.gateway_verifying_contract
    )
    OR jsonb_typeof(NEW.signed_payload) <> 'object'
    OR NEW.signed_payload - ARRAY['x402Version', 'accepted', 'payload'] <> '{}'::jsonb
    OR NEW.signed_payload->'x402Version' <> '2'::jsonb
    OR NEW.signed_payload->'accepted' <> NEW.payment_requirements
    OR (NEW.signed_payload->'payload') - ARRAY['signature', 'authorization'] <> '{}'::jsonb
    OR NEW.signed_payload->'payload'->>'signature' !~ '^0x[0-9a-f]{130}$'
    OR (NEW.signed_payload->'payload'->'authorization') - ARRAY['from', 'to', 'value', 'validAfter', 'validBefore', 'nonce'] <> '{}'::jsonb
    OR lower(NEW.signed_payload->'payload'->'authorization'->>'from') <> NEW.payer_address
    OR lower(NEW.signed_payload->'payload'->'authorization'->>'to') <> NEW.creator_recipient
    OR NEW.signed_payload->'payload'->'authorization'->>'value' <> NEW.amount_atomic::TEXT
    OR NEW.signed_payload->'payload'->'authorization'->>'validAfter' !~ '^[0-9]{1,12}$'
    OR NEW.signed_payload->'payload'->'authorization'->>'validBefore' !~ '^[0-9]{1,12}$'
    OR (NEW.signed_payload->'payload'->'authorization'->>'validBefore')::BIGINT
       > extract(epoch FROM NEW.expires_at)::BIGINT
    OR (NEW.signed_payload->'payload'->'authorization'->>'validBefore')::BIGINT
       <= (NEW.signed_payload->'payload'->'authorization'->>'validAfter')::BIGINT
    OR lower(NEW.signed_payload->'payload'->'authorization'->>'nonce') <> NEW.authorization_nonce
    OR NEW.authorization_nonce !~ '^0x[0-9a-f]{64}$'
    OR NEW.signed_payload_hash <> public.kernel_lifecycle_hash('x402-signed-payload', NEW.signed_payload)
  ) THEN
    RAISE EXCEPTION 'x402 signed payload does not match the prepared challenge'
      USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER x402_payment_attempts_integrity
BEFORE INSERT OR UPDATE ON public.x402_payment_attempts
FOR EACH ROW EXECUTE FUNCTION public.enforce_x402_payment_attempt();

CREATE OR REPLACE FUNCTION public.reject_x402_payment_attempt_deletion()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'x402 payment attempts cannot be deleted or truncated' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER x402_payment_attempts_no_delete
BEFORE DELETE ON public.x402_payment_attempts
FOR EACH ROW EXECUTE FUNCTION public.reject_x402_payment_attempt_deletion();
CREATE TRIGGER x402_payment_attempts_no_truncate
BEFORE TRUNCATE ON public.x402_payment_attempts
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_x402_payment_attempt_deletion();

ALTER TABLE public.x402_payment_receipts
  ADD COLUMN payment_attempt_id UUID UNIQUE REFERENCES public.x402_payment_attempts(id) ON DELETE RESTRICT,
  ADD COLUMN quote_id UUID REFERENCES public.quotes(id) ON DELETE RESTRICT,
  ADD COLUMN challenge_hash TEXT,
  ADD COLUMN settlement_kind TEXT NOT NULL DEFAULT 'LEGACY_EVM',
  ADD COLUMN gateway_transaction_id UUID UNIQUE,
  ADD COLUMN gateway_settled_at TIMESTAMPTZ(6),
  ALTER COLUMN transaction_hash DROP NOT NULL,
  ALTER COLUMN finality_block DROP NOT NULL,
  ALTER COLUMN finality_block_hash DROP NOT NULL,
  ALTER COLUMN finalized_at DROP NOT NULL,
  ALTER COLUMN payer_balance_delta_atomic DROP NOT NULL,
  ALTER COLUMN creator_balance_delta_atomic DROP NOT NULL,
  DROP CONSTRAINT x402_receipts_exact_payment_check,
  DROP CONSTRAINT x402_receipts_hash_check,
  DROP CONSTRAINT x402_receipts_finality_check,
  ADD CONSTRAINT x402_receipts_settlement_kind_check CHECK (
    settlement_kind IN ('LEGACY_EVM', 'GATEWAY_NANOPAYMENT')
  ),
  ADD CONSTRAINT x402_receipts_exact_payment_check CHECK (
    (
      settlement_kind = 'LEGACY_EVM'
      AND payment_attempt_id IS NULL AND quote_id IS NULL AND challenge_hash IS NULL
      AND gateway_transaction_id IS NULL AND gateway_settled_at IS NULL
      AND network = 'base-sepolia' AND chain_id = 84532
      AND asset_address = '0x036cbd53842c5426634e7929541ec2318f3dcf7e'
      AND amount_atomic = 1000
      AND transaction_hash IS NOT NULL AND finality_block IS NOT NULL
      AND finality_block_hash IS NOT NULL AND finalized_at IS NOT NULL
      AND payer_balance_delta_atomic = -1000 AND creator_balance_delta_atomic = 1000
    ) OR (
      settlement_kind = 'GATEWAY_NANOPAYMENT'
      AND payment_attempt_id IS NOT NULL AND quote_id IS NOT NULL
      AND challenge_hash IS NOT NULL AND gateway_transaction_id IS NOT NULL
      AND gateway_settled_at IS NOT NULL
      AND network ~ '^eip155:[1-9][0-9]{0,9}$'
      AND chain_id = split_part(network, ':', 2)::INTEGER
      AND amount_atomic > 0
      AND transaction_hash IS NULL AND finality_block IS NULL
      AND finality_block_hash IS NULL AND finalized_at IS NULL
      AND payer_balance_delta_atomic IS NULL AND creator_balance_delta_atomic IS NULL
    )
  ),
  ADD CONSTRAINT x402_receipts_hash_check CHECK (
    facilitator_payload_hash ~ '^[0-9a-f]{64}$'
    AND (challenge_hash IS NULL OR challenge_hash ~ '^[0-9a-f]{64}$')
    AND (transaction_hash IS NULL OR transaction_hash ~ '^0x[0-9a-f]{64}$')
    AND (finality_block_hash IS NULL OR finality_block_hash ~ '^0x[0-9a-f]{64}$')
    AND request_hash ~ '^[0-9a-f]{64}$'
    AND release_hash ~ '^[0-9a-f]{64}$'
    AND release_sha ~ '^[0-9a-f]{40}$'
  ),
  ADD CONSTRAINT x402_receipts_finality_check CHECK (
    jsonb_typeof(facilitator_payload) = 'object'
    AND facilitator_payload <> '{}'::jsonb
    AND (
      (settlement_kind = 'LEGACY_EVM' AND finality_block > 0 AND finalized_at <= created_at)
      OR (settlement_kind = 'GATEWAY_NANOPAYMENT' AND gateway_settled_at <= created_at)
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_x402_payment_receipt()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.settlement_kind = 'LEGACY_EVM' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.jobs job
      JOIN public.users payer ON payer.id = job.buyer_user_id
      JOIN public.agent_versions version ON version.id = job.agent_version_id
      JOIN public.receipts receipt ON receipt.id = NEW.delivery_receipt_id
      JOIN public.effects effect ON effect.id = receipt.effect_id AND effect.job_id = job.id
      WHERE job.id = NEW.job_id
        AND job.state = 'DELIVERY_READY' AND job.financial_outcome IS NULL
        AND job.agent_version_id = NEW.agent_version_id
        AND lower(payer.wallet_address) = NEW.payer_address
        AND lower(COALESCE(version.payout_address, version.owner_wallet)) = NEW.creator_recipient
        AND receipt.job_id = job.id AND receipt.verified
        AND effect.state = 'SUCCEEDED' AND effect.result_hash = receipt.result_hash
        AND NOT EXISTS (SELECT 1 FROM public.settlements settlement WHERE settlement.job_id = job.id)
        AND NOT EXISTS (SELECT 1 FROM public.refunds refund WHERE refund.job_id = job.id)
    ) THEN
      RAISE EXCEPTION 'legacy x402 receipt does not match one delivery-ready job' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.x402_payment_attempts attempt
    JOIN public.jobs job ON job.id = attempt.job_id
    JOIN public.kernel_orders order_row ON order_row.id = job.order_id
    JOIN public.quotes quote ON quote.id = order_row.quote_id
    JOIN public.receipts receipt ON receipt.id = attempt.delivery_receipt_id
    JOIN public.effects effect ON effect.id = receipt.effect_id AND effect.job_id = job.id
    JOIN public.agent_versions version ON version.id = job.agent_version_id
    JOIN public.users payer ON payer.id = job.buyer_user_id
    WHERE attempt.id = NEW.payment_attempt_id
      AND attempt.state = 'GATEWAY_SETTLED'
      AND attempt.job_id = NEW.job_id AND attempt.quote_id = NEW.quote_id
      AND attempt.delivery_receipt_id = NEW.delivery_receipt_id
      AND attempt.agent_version_id = NEW.agent_version_id
      AND attempt.challenge_hash = NEW.challenge_hash
      AND attempt.payer_address = NEW.payer_address
      AND attempt.creator_recipient = NEW.creator_recipient
      AND attempt.network = NEW.network AND attempt.chain_id = NEW.chain_id
      AND attempt.asset_address = NEW.asset_address
      AND attempt.amount_atomic = NEW.amount_atomic
      AND attempt.signed_payload = NEW.facilitator_payload
      AND attempt.signed_payload_hash = NEW.facilitator_payload_hash
      AND attempt.gateway_transaction_id = NEW.gateway_transaction_id
      AND attempt.gateway_settled_at = NEW.gateway_settled_at
      AND attempt.effect_request_hash = NEW.request_hash
      AND attempt.release_sha = NEW.release_sha
      AND NEW.release_hash = public.kernel_lifecycle_hash('x402-release', to_jsonb(NEW.release_sha))
      AND job.state = 'DELIVERY_READY' AND job.version = attempt.job_version
      AND job.financial_outcome IS NULL AND job.agent_version_id = attempt.agent_version_id
      AND quote.amount_atomic = order_row.amount_atomic
      AND version.price_atomic = order_row.amount_atomic
      AND attempt.amount_atomic = order_row.amount_atomic
      AND quote.asset = order_row.asset AND version.asset = order_row.asset
      AND attempt.asset = order_row.asset
      AND receipt.job_id = job.id AND receipt.verified
      AND effect.state = 'SUCCEEDED' AND effect.result_hash = receipt.result_hash
      AND effect.request_hash = attempt.effect_request_hash
      AND lower(payer.wallet_address) = attempt.payer_address
      AND lower(COALESCE(version.payout_address, version.owner_wallet)) = attempt.creator_recipient
      AND NOT EXISTS (SELECT 1 FROM public.settlements settlement WHERE settlement.job_id = job.id)
      AND NOT EXISTS (SELECT 1 FROM public.commissions commission WHERE commission.job_id = job.id)
      AND NOT EXISTS (SELECT 1 FROM public.refunds refund WHERE refund.job_id = job.id)
  ) THEN
    RAISE EXCEPTION 'Gateway x402 receipt does not match one settled delivery-ready attempt'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_settlement_outcome()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.receipts receipt
    JOIN public.effects effect ON effect.id = receipt.effect_id
    JOIN public.x402_payment_receipts payment
      ON payment.job_id = NEW.job_id AND payment.delivery_receipt_id = receipt.id
    JOIN public.jobs job ON job.id = NEW.job_id
    JOIN public.kernel_orders order_row ON order_row.id = job.order_id
    WHERE receipt.id = NEW.receipt_id
      AND receipt.job_id = NEW.job_id AND receipt.verified
      AND effect.state = 'SUCCEEDED' AND effect.result_hash = receipt.result_hash
      AND NEW.amount_atomic = payment.amount_atomic
      AND NEW.amount_atomic = order_row.amount_atomic
      AND NEW.asset = order_row.asset
  ) THEN
    RAISE EXCEPTION 'settlement amount or asset does not match delivery and x402 receipts'
      USING ERRCODE = '23514';
  END IF;
  UPDATE public.jobs
  SET financial_outcome = 'SETTLED', updated_at = clock_timestamp()
  WHERE id = NEW.job_id AND state = 'SUCCEEDED' AND financial_outcome IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job already has a terminal financial outcome or is not successful'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_verified_commission()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.settlements settlement
    JOIN public.x402_payment_receipts payment ON payment.job_id = settlement.job_id
    JOIN public.jobs job ON job.id = settlement.job_id
    JOIN public.agent_versions version ON version.id = job.agent_version_id
    JOIN public.kernel_agents agent ON agent.id = version.agent_id
    WHERE settlement.id = NEW.settlement_id AND settlement.job_id = NEW.job_id
      AND NEW.recipient_user_id = agent.owner_user_id
      AND NEW.amount_atomic = settlement.amount_atomic
      AND NEW.amount_atomic = payment.amount_atomic
      AND NEW.asset = settlement.asset
  ) THEN
    RAISE EXCEPTION 'commission must pay the agent owner the full settled amount and asset'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
