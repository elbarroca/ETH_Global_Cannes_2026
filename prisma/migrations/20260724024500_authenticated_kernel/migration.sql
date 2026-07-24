-- A2 authenticated commerce kernel. Additive only: inherited Cannes tables and
-- rows are neither rewritten nor used as authorization authority here.

CREATE TABLE "auth_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message" TEXT NOT NULL,
    "message_hash" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "issued_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_challenges_wallet_check" CHECK ("wallet_address" ~ '^0x[0-9a-f]{40}$'),
    CONSTRAINT "auth_challenges_nonce_check" CHECK ("nonce" ~ '^[A-Za-z0-9]{32,128}$'),
    CONSTRAINT "auth_challenges_time_check" CHECK ("expires_at" > "issued_at")
);

CREATE UNIQUE INDEX "auth_challenges_nonce_key" ON "auth_challenges"("nonce");
CREATE INDEX "idx_auth_challenges_wallet_expiry" ON "auth_challenges"("wallet_address", "expires_at");

CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "challenge_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "auth_sessions_token_hash_check" CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "auth_sessions_wallet_check" CHECK ("wallet_address" ~ '^0x[0-9a-f]{40}$'),
    CONSTRAINT "auth_sessions_time_check" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "auth_sessions_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "auth_challenges"("id") ON DELETE RESTRICT,
    CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "auth_sessions_challenge_id_key" ON "auth_sessions"("challenge_id");
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");
CREATE INDEX "idx_auth_sessions_wallet_expiry" ON "auth_sessions"("wallet_address", "expires_at");
CREATE INDEX "idx_auth_sessions_user_expiry" ON "auth_sessions"("user_id", "expires_at");

CREATE TABLE "kernel_agents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kernel_agents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "kernel_agents_name_check" CHECK (char_length("name") BETWEEN 2 AND 80),
    CONSTRAINT "kernel_agents_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "uniq_kernel_agents_owner_name" ON "kernel_agents"("owner_user_id", "name");
CREATE INDEX "idx_kernel_agents_owner_created" ON "kernel_agents"("owner_user_id", "created_at");

CREATE TABLE "agent_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "manifest" JSONB NOT NULL,
    "manifest_hash" TEXT NOT NULL,
    "prompt_hash" TEXT NOT NULL,
    "config_hash" TEXT NOT NULL,
    "capabilities" TEXT[] NOT NULL,
    "adapter_key" TEXT NOT NULL,
    "endpoint" TEXT,
    "connector_key" TEXT,
    "owner_wallet" TEXT NOT NULL,
    "payout_address" TEXT,
    "price_atomic" BIGINT NOT NULL,
    "asset" TEXT NOT NULL,
    "proof_policy" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_versions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agent_versions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "kernel_agents"("id") ON DELETE RESTRICT,
    CONSTRAINT "agent_versions_version_check" CHECK ("version" > 0),
    CONSTRAINT "agent_versions_price_check" CHECK ("price_atomic" >= 0),
    CONSTRAINT "agent_versions_publish_check" CHECK (("published" AND "published_at" IS NOT NULL) OR (NOT "published" AND "published_at" IS NULL)),
    CONSTRAINT "agent_versions_adapter_check" CHECK ("adapter_key" = 'protected-a3'),
    CONSTRAINT "agent_versions_endpoint_check" CHECK ("endpoint" IS NULL),
    CONSTRAINT "agent_versions_connector_check" CHECK ("connector_key" IS NULL),
    CONSTRAINT "agent_versions_proof_policy_check" CHECK ("proof_policy" = 'verified-receipt-required')
);

CREATE UNIQUE INDEX "uniq_agent_versions_agent_version" ON "agent_versions"("agent_id", "version");
CREATE INDEX "idx_agent_versions_published_created" ON "agent_versions"("published", "created_at");

CREATE TABLE "quotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "buyer_user_id" TEXT NOT NULL,
    "agent_version_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "input_hash" TEXT NOT NULL,
    "amount_atomic" BIGINT NOT NULL,
    "asset" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "quotes_amount_check" CHECK ("amount_atomic" >= 0),
    CONSTRAINT "quotes_expiry_check" CHECK ("expires_at" > "created_at"),
    CONSTRAINT "quotes_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
    CONSTRAINT "quotes_agent_version_id_fkey" FOREIGN KEY ("agent_version_id") REFERENCES "agent_versions"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "uniq_quotes_buyer_idempotency" ON "quotes"("buyer_user_id", "idempotency_key");
CREATE INDEX "idx_quotes_version_created" ON "quotes"("agent_version_id", "created_at");

CREATE TABLE "job_intents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "buyer_user_id" TEXT NOT NULL,
    "agent_version_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "input_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_intents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "job_intents_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
    CONSTRAINT "job_intents_agent_version_id_fkey" FOREIGN KEY ("agent_version_id") REFERENCES "agent_versions"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "uniq_job_intents_buyer_idempotency" ON "job_intents"("buyer_user_id", "idempotency_key");
CREATE INDEX "idx_job_intents_version_created" ON "job_intents"("agent_version_id", "created_at");

CREATE TABLE "kernel_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "buyer_user_id" TEXT NOT NULL,
    "agent_version_id" UUID NOT NULL,
    "intent_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "amount_atomic" BIGINT NOT NULL,
    "asset" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kernel_orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "kernel_orders_amount_check" CHECK ("amount_atomic" >= 0),
    CONSTRAINT "kernel_orders_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
    CONSTRAINT "kernel_orders_agent_version_id_fkey" FOREIGN KEY ("agent_version_id") REFERENCES "agent_versions"("id") ON DELETE RESTRICT,
    CONSTRAINT "kernel_orders_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "job_intents"("id") ON DELETE RESTRICT,
    CONSTRAINT "kernel_orders_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "kernel_orders_intent_id_key" ON "kernel_orders"("intent_id");
CREATE UNIQUE INDEX "kernel_orders_quote_id_key" ON "kernel_orders"("quote_id");
CREATE INDEX "idx_kernel_orders_buyer_created" ON "kernel_orders"("buyer_user_id", "created_at");

CREATE TABLE "jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "intent_id" UUID NOT NULL,
    "buyer_user_id" TEXT NOT NULL,
    "agent_version_id" UUID NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'QUEUED',
    "version" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_owner" TEXT,
    "lease_expires_at" TIMESTAMPTZ(6),
    "cancel_requested_at" TIMESTAMPTZ(6),
    "financial_outcome" TEXT,
    "last_error_code" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "jobs_state_check" CHECK ("state" IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'A3_NOT_CONFIGURED')),
    CONSTRAINT "jobs_attempts_check" CHECK ("attempts" >= 0 AND "max_attempts" BETWEEN 1 AND 10 AND "attempts" <= "max_attempts"),
    CONSTRAINT "jobs_outcome_check" CHECK ("financial_outcome" IS NULL OR "financial_outcome" IN ('SETTLED', 'REFUNDED')),
    CONSTRAINT "jobs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "kernel_orders"("id") ON DELETE RESTRICT,
    CONSTRAINT "jobs_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "job_intents"("id") ON DELETE RESTRICT,
    CONSTRAINT "jobs_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
    CONSTRAINT "jobs_agent_version_id_fkey" FOREIGN KEY ("agent_version_id") REFERENCES "agent_versions"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "jobs_order_id_key" ON "jobs"("order_id");
CREATE UNIQUE INDEX "jobs_intent_id_key" ON "jobs"("intent_id");
CREATE INDEX "idx_jobs_state_available" ON "jobs"("state", "available_at");
CREATE INDEX "idx_jobs_buyer_created" ON "jobs"("buyer_user_id", "created_at");

CREATE TABLE "job_events" (
    "id" BIGSERIAL NOT NULL,
    "job_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "from_state" TEXT,
    "to_state" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "job_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "uniq_job_events_job_version" ON "job_events"("job_id", "version");
CREATE INDEX "idx_job_events_job_created" ON "job_events"("job_id", "created_at");

CREATE TABLE "effects" (
    "id" TEXT NOT NULL,
    "job_id" UUID NOT NULL,
    "intent_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "adapter_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "result_hash" TEXT,
    "result" JSONB,
    "error_code" TEXT,
    "terminal_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "effects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "effects_id_check" CHECK ("id" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "effects_state_check" CHECK ("state" IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED')),
    CONSTRAINT "effects_attempt_check" CHECK ("attempt" >= 0),
    CONSTRAINT "effects_terminal_check" CHECK (("state" IN ('SUCCEEDED', 'FAILED', 'CANCELED')) = ("terminal_at" IS NOT NULL)),
    CONSTRAINT "effects_adapter_check" CHECK ("adapter_key" = 'protected-a3'),
    CONSTRAINT "effects_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT,
    CONSTRAINT "effects_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "job_intents"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "effects_job_id_key" ON "effects"("job_id");
CREATE UNIQUE INDEX "effects_intent_id_key" ON "effects"("intent_id");
CREATE UNIQUE INDEX "effects_idempotency_key_key" ON "effects"("idempotency_key");

CREATE TABLE "receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "effect_id" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL,
    "adapter_key" TEXT NOT NULL,
    "proof_hash" TEXT NOT NULL,
    "result_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "receipts_verified_check" CHECK ("verified"),
    CONSTRAINT "receipts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT,
    CONSTRAINT "receipts_effect_id_fkey" FOREIGN KEY ("effect_id") REFERENCES "effects"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "receipts_job_id_key" ON "receipts"("job_id");
CREATE UNIQUE INDEX "receipts_effect_id_key" ON "receipts"("effect_id");

CREATE TABLE "settlements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "amount_atomic" BIGINT NOT NULL,
    "asset" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "settlements_amount_check" CHECK ("amount_atomic" >= 0),
    CONSTRAINT "settlements_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT,
    CONSTRAINT "settlements_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "settlements_job_id_key" ON "settlements"("job_id");
CREATE UNIQUE INDEX "settlements_receipt_id_key" ON "settlements"("receipt_id");

CREATE TABLE "commissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "settlement_id" UUID NOT NULL,
    "recipient_user_id" TEXT NOT NULL,
    "amount_atomic" BIGINT NOT NULL,
    "asset" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commissions_amount_check" CHECK ("amount_atomic" >= 0),
    CONSTRAINT "commissions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT,
    CONSTRAINT "commissions_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE RESTRICT,
    CONSTRAINT "commissions_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "commissions_job_id_key" ON "commissions"("job_id");
CREATE UNIQUE INDEX "commissions_settlement_id_key" ON "commissions"("settlement_id");

CREATE TABLE "refunds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "amount_atomic" BIGINT NOT NULL,
    "asset" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "refunds_amount_check" CHECK ("amount_atomic" >= 0),
    CONSTRAINT "refunds_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "refunds_job_id_key" ON "refunds"("job_id");

CREATE TABLE "worker_leases" (
    "key" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "epoch" BIGINT NOT NULL DEFAULT 1,
    "heartbeat_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "worker_leases_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "worker_leases_time_check" CHECK ("expires_at" > "heartbeat_at")
);

CREATE OR REPLACE FUNCTION reject_published_agent_version_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."published" THEN
    RAISE EXCEPTION 'published agent versions are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER "agent_versions_immutable_published"
BEFORE UPDATE OR DELETE ON "agent_versions"
FOR EACH ROW EXECUTE FUNCTION reject_published_agent_version_mutation();

CREATE OR REPLACE FUNCTION reject_job_event_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'job events are append-only' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "job_events_append_only"
BEFORE UPDATE OR DELETE ON "job_events"
FOR EACH ROW EXECUTE FUNCTION reject_job_event_mutation();

CREATE OR REPLACE FUNCTION enforce_job_state_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."state" = NEW."state" THEN
    RETURN NEW;
  END IF;
  IF NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'job transition requires optimistic version increment' USING ERRCODE = '23514';
  END IF;
  IF NOT (
    (OLD."state" = 'QUEUED' AND NEW."state" IN ('RUNNING', 'CANCELED', 'FAILED')) OR
    (OLD."state" = 'RUNNING' AND NEW."state" IN ('QUEUED', 'SUCCEEDED', 'FAILED', 'CANCELED', 'A3_NOT_CONFIGURED'))
  ) THEN
    RAISE EXCEPTION 'illegal job state transition: % -> %', OLD."state", NEW."state" USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "jobs_legal_transitions"
BEFORE UPDATE ON "jobs"
FOR EACH ROW EXECUTE FUNCTION enforce_job_state_transition();

CREATE OR REPLACE FUNCTION enforce_effect_state_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."state" IN ('SUCCEEDED', 'FAILED', 'CANCELED') THEN
    RAISE EXCEPTION 'terminal effects are immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD."state" = NEW."state" THEN
    RETURN NEW;
  END IF;
  IF NOT (
    (OLD."state" = 'PENDING' AND NEW."state" IN ('RUNNING', 'CANCELED')) OR
    (OLD."state" = 'RUNNING' AND NEW."state" IN ('SUCCEEDED', 'FAILED', 'CANCELED'))
  ) THEN
    RAISE EXCEPTION 'illegal effect state transition: % -> %', OLD."state", NEW."state" USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "effects_legal_transitions"
BEFORE UPDATE ON "effects"
FOR EACH ROW EXECUTE FUNCTION enforce_effect_state_transition();

CREATE OR REPLACE FUNCTION claim_settlement_outcome()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "receipts" r
    JOIN "effects" e ON e."id" = r."effect_id"
    WHERE r."id" = NEW."receipt_id"
      AND r."job_id" = NEW."job_id"
      AND r."verified"
      AND e."state" = 'SUCCEEDED'
  ) THEN
    RAISE EXCEPTION 'settlement requires a verified successful receipt' USING ERRCODE = '23514';
  END IF;
  UPDATE "jobs"
  SET "financial_outcome" = 'SETTLED', "updated_at" = CURRENT_TIMESTAMP
  WHERE "id" = NEW."job_id" AND "state" = 'SUCCEEDED' AND "financial_outcome" IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job already has a terminal financial outcome or is not successful' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "settlements_exclusive_verified"
BEFORE INSERT ON "settlements"
FOR EACH ROW EXECUTE FUNCTION claim_settlement_outcome();

CREATE OR REPLACE FUNCTION claim_refund_outcome()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "jobs"
  SET "financial_outcome" = 'REFUNDED', "updated_at" = CURRENT_TIMESTAMP
  WHERE "id" = NEW."job_id"
    AND "state" IN ('FAILED', 'CANCELED', 'A3_NOT_CONFIGURED')
    AND "financial_outcome" IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job already has a terminal financial outcome or is not refundable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "refunds_exclusive_terminal"
BEFORE INSERT ON "refunds"
FOR EACH ROW EXECUTE FUNCTION claim_refund_outcome();

CREATE OR REPLACE FUNCTION enforce_verified_commission()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  settled_amount BIGINT;
BEGIN
  SELECT "amount_atomic" INTO settled_amount
  FROM "settlements"
  WHERE "id" = NEW."settlement_id" AND "job_id" = NEW."job_id";
  IF settled_amount IS NULL OR NEW."amount_atomic" > settled_amount THEN
    RAISE EXCEPTION 'commission requires a matching verified settlement' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "commissions_verified_settlement_only"
BEFORE INSERT ON "commissions"
FOR EACH ROW EXECUTE FUNCTION enforce_verified_commission();
