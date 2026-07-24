-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateSequence
-- Current user creation allocates a deterministic HD-wallet index from this
-- application-owned sequence. PostgreSQL defaults are sufficient because the
-- application observes only nextval(); existing databases resolve this baseline
-- only after confirming their sequence is present.
CREATE SEQUENCE "hot_wallet_index_seq"
    AS BIGINT
    INCREMENT BY 1
    MINVALUE 1
    MAXVALUE 9223372036854775807
    START WITH 1
    CACHE 1
    NO CYCLE
    OWNED BY NONE;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "proxy_wallet" JSONB NOT NULL DEFAULT '{}',
    "telegram" JSONB NOT NULL DEFAULT '{"chatId": null, "username": null, "verified": false, "notifyPreference": "every_cycle"}',
    "agent" JSONB NOT NULL DEFAULT '{"active": false, "goal": "", "cycleCount": 0, "cyclesRemaining": 0, "lastCycleAt": null, "lastCycleId": 0, "riskProfile": "balanced", "maxTradePercent": 10}',
    "fund" JSONB NOT NULL DEFAULT '{"currentNav": 0, "depositedUsdc": 0, "htsShareBalance": 0}',
    "inft_token_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hot_wallet_index" INTEGER,
    "hot_wallet_address" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "goal" TEXT,
    "payments" JSONB,
    "specialists" JSONB NOT NULL DEFAULT '[]',
    "alpha_action" TEXT,
    "alpha_pct" INTEGER,
    "alpha_attestation" TEXT,
    "risk_challenge" TEXT,
    "risk_max_pct" INTEGER,
    "risk_attestation" TEXT,
    "exec_action" TEXT,
    "exec_pct" INTEGER,
    "exec_stop_loss" TEXT,
    "exec_attestation" TEXT,
    "alpha_reasoning" TEXT,
    "risk_reasoning" TEXT,
    "exec_reasoning" TEXT,
    "decision" TEXT,
    "asset" TEXT,
    "decision_pct" INTEGER,
    "hcs_seq_num" INTEGER,
    "hashscan_url" TEXT,
    "storage_hash" TEXT,
    "total_cost_usd" DOUBLE PRECISION,
    "nav_after" DOUBLE PRECISION,
    "swap_tx_hash" TEXT,
    "swap_chain" TEXT DEFAULT 'arc-testnet',
    "swap_amount" TEXT,
    "swap_asset_in" TEXT,
    "swap_asset_out" TEXT,
    "swap_explorer_url" TEXT,
    "debate_duration_ms" INTEGER,
    "debate_turns" INTEGER,
    "narrative" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "cycle_id" UUID,
    "action_type" TEXT NOT NULL,
    "agent_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "payload" JSONB,
    "attestation_hash" TEXT,
    "tee_verified" BOOLEAN,
    "payment_amount" TEXT,
    "payment_network" TEXT,
    "payment_tx_hash" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_agents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "price" TEXT NOT NULL DEFAULT '$0.001',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reputation" INTEGER NOT NULL DEFAULT 500,
    "total_hires" INTEGER NOT NULL DEFAULT 0,
    "correct_calls" INTEGER NOT NULL DEFAULT 0,
    "inft_token_id" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "specialist_type" TEXT DEFAULT 'analysis',
    "data_sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "openclaw_agent_id" TEXT,
    "wallet_address" TEXT,
    "storage_root_hash" TEXT,
    "storage_uri" TEXT,
    "mint_tx_hash" TEXT,
    "description" TEXT,
    "instructions" TEXT,
    "tools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by" TEXT,

    CONSTRAINT "marketplace_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_ratings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "cycle_id" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "reputation_before" INTEGER NOT NULL,
    "reputation_after" INTEGER NOT NULL,
    "hcs_seq_num" INTEGER,
    "hcs_topic_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialist_pick_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cycle_id" UUID NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "specialist_name" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "signal" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "entry_price_usd" DOUBLE PRECISION NOT NULL,
    "entered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluated_at" TIMESTAMPTZ(6),
    "exit_price_usd" DOUBLE PRECISION,
    "pnl_pct" DOUBLE PRECISION,
    "correct" BOOLEAN,
    "scored" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "specialist_pick_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debate_transcripts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cycle_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "turn_number" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "from_agent" TEXT NOT NULL,
    "to_agent" TEXT,
    "message_content" TEXT NOT NULL,
    "response_content" TEXT,
    "attestation_hash" TEXT,
    "tee_verified" BOOLEAN DEFAULT false,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_hired_agents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "agent_id" UUID NOT NULL,
    "hired_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_hired_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_cycles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "goal" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "origin" TEXT NOT NULL DEFAULT 'ui',
    "specialists" JSONB NOT NULL DEFAULT '[]',
    "debate" JSONB NOT NULL DEFAULT '{}',
    "compact_record" JSONB NOT NULL DEFAULT '{}',
    "rich_record" JSONB,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" TEXT,
    "modified_pct" INTEGER,
    "telegram_msg_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naryo_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "tx_hash" TEXT,
    "decoded_data" JSONB,
    "raw_payload" JSONB NOT NULL,
    "correlation_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "naryo_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naryo_correlations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "description" TEXT NOT NULL,
    "chains" TEXT[],
    "proof_tx_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "naryo_correlations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE INDEX "idx_users_wallet" ON "users"("wallet_address");

-- CreateIndex
CREATE INDEX "idx_cycles_user_cycle" ON "cycles"("user_id", "cycle_number");

-- CreateIndex
CREATE INDEX "idx_agent_actions_created" ON "agent_actions"("created_at");

-- CreateIndex
CREATE INDEX "idx_agent_actions_cycle" ON "agent_actions"("cycle_id");

-- CreateIndex
CREATE INDEX "idx_agent_actions_user_type" ON "agent_actions"("user_id", "action_type");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_agents_name_key" ON "marketplace_agents"("name");

-- CreateIndex
CREATE INDEX "idx_agent_ratings_agent" ON "agent_ratings"("agent_name", "created_at");

-- CreateIndex
CREATE INDEX "idx_agent_ratings_user" ON "agent_ratings"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_user_agent_cycle_rating" ON "agent_ratings"("user_id", "agent_name", "cycle_id");

-- CreateIndex
CREATE INDEX "idx_pick_entries_specialist" ON "specialist_pick_entries"("specialist_name", "entered_at");

-- CreateIndex
CREATE INDEX "idx_pick_entries_cycle" ON "specialist_pick_entries"("cycle_id");

-- CreateIndex
CREATE INDEX "idx_pick_entries_asset" ON "specialist_pick_entries"("asset", "entered_at");

-- CreateIndex
CREATE INDEX "idx_pick_entries_scored" ON "specialist_pick_entries"("scored", "entered_at");

-- CreateIndex
CREATE INDEX "idx_debate_transcripts_cycle_turn" ON "debate_transcripts"("cycle_id", "turn_number");

-- CreateIndex
CREATE INDEX "idx_debate_transcripts_user" ON "debate_transcripts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_user_hired_agents_user" ON "user_hired_agents"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_hired_agents_agent" ON "user_hired_agents"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_hired_agents_user_id_agent_id_key" ON "user_hired_agents"("user_id", "agent_id");

-- CreateIndex
CREATE INDEX "idx_pending_cycles_user_status" ON "pending_cycles"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_pending_cycles_expires" ON "pending_cycles"("expires_at");

-- CreateIndex
CREATE INDEX "idx_chat_messages_user" ON "chat_messages"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_naryo_events_source" ON "naryo_events"("source", "created_at");

-- CreateIndex
CREATE INDEX "idx_naryo_events_chain" ON "naryo_events"("chain", "created_at");

-- CreateIndex
CREATE INDEX "idx_naryo_events_correlation" ON "naryo_events"("correlation_id");

-- AddForeignKey
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "debate_transcripts" ADD CONSTRAINT "debate_transcripts_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_hired_agents" ADD CONSTRAINT "user_hired_agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_hired_agents" ADD CONSTRAINT "user_hired_agents_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "marketplace_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_cycles" ADD CONSTRAINT "pending_cycles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "naryo_events" ADD CONSTRAINT "naryo_events_correlation_id_fkey" FOREIGN KEY ("correlation_id") REFERENCES "naryo_correlations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
