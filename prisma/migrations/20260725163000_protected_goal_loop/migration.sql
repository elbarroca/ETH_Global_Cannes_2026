-- Protected goal loop. Existing quote/order/job/effect/receipt/payment tables
-- remain the only commerce ledger.

CREATE TABLE "goals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "definition_hash" TEXT NOT NULL,
  "last_mutation_key" TEXT,
  "last_mutation_hash" TEXT,
  "objective" TEXT NOT NULL,
  "required_capabilities" TEXT[] NOT NULL,
  "cadence_minutes" INTEGER NOT NULL,
  "run_mode" TEXT NOT NULL,
  "execution_mode" TEXT NOT NULL,
  "run_limit" INTEGER,
  "max_agents" INTEGER NOT NULL,
  "per_run_cap_atomic" BIGINT NOT NULL,
  "daily_cap_atomic" BIGINT,
  "state" TEXT NOT NULL DEFAULT 'DRAFT',
  "next_run_at" TIMESTAMPTZ(6),
  "completed_runs" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goals_owner_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "goals_idempotency_check" CHECK ("idempotency_key" ~ '^[A-Za-z0-9._:-]{8,128}$'),
  CONSTRAINT "goals_definition_hash_check" CHECK ("definition_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "goals_last_mutation_check" CHECK (
    ("last_mutation_key" IS NULL AND "last_mutation_hash" IS NULL) OR
    ("last_mutation_key" ~ '^[A-Za-z0-9._:-]{8,128}$' AND "last_mutation_hash" ~ '^[0-9a-f]{64}$')
  ),
  CONSTRAINT "goals_objective_check" CHECK (char_length("objective") BETWEEN 10 AND 2000),
  CONSTRAINT "goals_capabilities_check" CHECK (
    cardinality("required_capabilities") BETWEEN 1 AND 4 AND
    array_position("required_capabilities", NULL) IS NULL
  ),
  CONSTRAINT "goals_cadence_check" CHECK ("cadence_minutes" IN (5, 15, 30, 60)),
  CONSTRAINT "goals_mode_check" CHECK (
    "run_mode" IN ('BOUNDED', 'CONTINUOUS') AND
    "execution_mode" IN ('RESEARCH_ONLY', 'PROPOSE_SWAP')
  ),
  CONSTRAINT "goals_limits_check" CHECK (
    "max_agents" BETWEEN 1 AND 4 AND "per_run_cap_atomic" > 0 AND
    "completed_runs" >= 0 AND
    (
      ("run_mode" = 'BOUNDED' AND "run_limit" BETWEEN 1 AND 100 AND "daily_cap_atomic" IS NULL) OR
      ("run_mode" = 'CONTINUOUS' AND "run_limit" IS NULL AND "daily_cap_atomic" > 0)
    )
  ),
  CONSTRAINT "goals_state_check" CHECK ("state" IN ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED')),
  CONSTRAINT "goals_schedule_check" CHECK (("state" = 'ACTIVE') = ("next_run_at" IS NOT NULL))
);

CREATE UNIQUE INDEX "uniq_goals_owner_idempotency" ON "goals"("owner_user_id", "idempotency_key");
CREATE INDEX "idx_goals_owner_created" ON "goals"("owner_user_id", "created_at");
CREATE INDEX "idx_goals_due" ON "goals"("state", "next_run_at");

CREATE TABLE "goal_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "goal_id" UUID NOT NULL,
  "owner_user_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "scheduled_for" TIMESTAMPTZ(6) NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "objective_snapshot" TEXT NOT NULL,
  "capabilities_snapshot" TEXT[] NOT NULL,
  "policy_snapshot" JSONB NOT NULL,
  "policy_hash" TEXT NOT NULL,
  "effect_identity" TEXT NOT NULL,
  "total_price_atomic" BIGINT NOT NULL DEFAULT 0,
  "report" JSONB,
  "report_hash" TEXT,
  "error_code" TEXT,
  "claim_owner" TEXT,
  "claim_epoch" BIGINT,
  "claim_version" INTEGER NOT NULL DEFAULT 0,
  "claim_expires_at" TIMESTAMPTZ(6),
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goal_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goal_runs_goal_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE RESTRICT,
  CONSTRAINT "goal_runs_owner_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "goal_runs_idempotency_check" CHECK ("idempotency_key" ~ '^[A-Za-z0-9._:-]{8,128}$'),
  CONSTRAINT "goal_runs_state_check" CHECK ("state" IN (
    'SCHEDULED', 'SELECTING', 'RUNNING', 'SYNTHESIZING', 'READY',
    'PARTIAL', 'BLOCKED', 'FAILED', 'CANCELED'
  )),
  CONSTRAINT "goal_runs_snapshot_check" CHECK (
    char_length("objective_snapshot") BETWEEN 10 AND 2000 AND
    cardinality("capabilities_snapshot") BETWEEN 1 AND 4 AND
    array_position("capabilities_snapshot", NULL) IS NULL AND
    "policy_hash" ~ '^[0-9a-f]{64}$' AND "effect_identity" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "goal_runs_money_check" CHECK ("total_price_atomic" >= 0),
  CONSTRAINT "goal_runs_report_check" CHECK (
    (("report" IS NULL) = ("report_hash" IS NULL)) AND
    ("report_hash" IS NULL OR "report_hash" ~ '^[0-9a-f]{64}$') AND
    ("state" <> 'READY' OR "report" IS NOT NULL)
  ),
  CONSTRAINT "goal_runs_terminal_check" CHECK (
    ("state" IN ('READY', 'PARTIAL', 'BLOCKED', 'FAILED', 'CANCELED')) = ("completed_at" IS NOT NULL)
  ),
  CONSTRAINT "goal_runs_claim_check" CHECK (
    ("claim_owner" IS NULL AND "claim_epoch" IS NULL AND "claim_expires_at" IS NULL) OR
    ("claim_owner" IS NOT NULL AND "claim_epoch" > 0 AND "claim_version" > 0 AND "claim_expires_at" IS NOT NULL)
  ),
  CONSTRAINT "goal_runs_error_check" CHECK ("error_code" IS NULL OR "error_code" ~ '^[A-Z][A-Z0-9_]{2,64}$')
);

CREATE UNIQUE INDEX "uniq_goal_runs_scheduled_slot" ON "goal_runs"("goal_id", "scheduled_for");
CREATE UNIQUE INDEX "uniq_goal_runs_owner_idempotency" ON "goal_runs"("owner_user_id", "idempotency_key");
CREATE UNIQUE INDEX "goal_runs_effect_identity_key" ON "goal_runs"("effect_identity");
CREATE INDEX "idx_goal_runs_owner_created" ON "goal_runs"("owner_user_id", "created_at");
CREATE INDEX "idx_goal_runs_state_scheduled" ON "goal_runs"("state", "scheduled_for");

CREATE TABLE "goal_run_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "goal_run_id" UUID NOT NULL,
  "agent_version_id" UUID NOT NULL,
  "job_id" UUID,
  "role" TEXT NOT NULL,
  "selection_rank" INTEGER NOT NULL,
  "covered_capabilities" TEXT[] NOT NULL,
  "price_atomic_snapshot" BIGINT NOT NULL,
  "manifest_hash_snapshot" TEXT NOT NULL,
  "full_subname_snapshot" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goal_run_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goal_run_jobs_run_fkey" FOREIGN KEY ("goal_run_id") REFERENCES "goal_runs"("id") ON DELETE RESTRICT,
  CONSTRAINT "goal_run_jobs_version_fkey" FOREIGN KEY ("agent_version_id") REFERENCES "agent_versions"("id") ON DELETE RESTRICT,
  CONSTRAINT "goal_run_jobs_job_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT,
  CONSTRAINT "goal_run_jobs_role_check" CHECK ("role" IN ('ANALYSIS', 'SYNTHESIS')),
  CONSTRAINT "goal_run_jobs_rank_check" CHECK ("selection_rank" BETWEEN 1 AND 5),
  CONSTRAINT "goal_run_jobs_capabilities_check" CHECK (
    cardinality("covered_capabilities") BETWEEN 1 AND 4 AND
    array_position("covered_capabilities", NULL) IS NULL
  ),
  CONSTRAINT "goal_run_jobs_price_check" CHECK ("price_atomic_snapshot" > 0),
  CONSTRAINT "goal_run_jobs_hash_check" CHECK ("manifest_hash_snapshot" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "goal_run_jobs_subname_check" CHECK (char_length("full_subname_snapshot") BETWEEN 3 AND 255)
);

CREATE UNIQUE INDEX "uniq_goal_run_jobs_role_version" ON "goal_run_jobs"("goal_run_id", "role", "agent_version_id");
CREATE UNIQUE INDEX "goal_run_jobs_job_id_key" ON "goal_run_jobs"("job_id");
CREATE INDEX "idx_goal_run_jobs_rank" ON "goal_run_jobs"("goal_run_id", "selection_rank");

CREATE TABLE "agent_version_provenance" (
  "agent_version_id" UUID NOT NULL,
  "protocol" TEXT NOT NULL,
  "chain_id" INTEGER NOT NULL,
  "contract_address" TEXT NOT NULL,
  "token_id" TEXT NOT NULL,
  "metadata_uri" TEXT,
  "evidence_hash" TEXT NOT NULL,
  "observed_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_version_provenance_pkey" PRIMARY KEY ("agent_version_id"),
  CONSTRAINT "agent_version_provenance_version_fkey" FOREIGN KEY ("agent_version_id") REFERENCES "agent_versions"("id") ON DELETE RESTRICT,
  CONSTRAINT "agent_version_provenance_protocol_check" CHECK ("protocol" = 'INFT'),
  CONSTRAINT "agent_version_provenance_chain_check" CHECK ("chain_id" > 0),
  CONSTRAINT "agent_version_provenance_address_check" CHECK ("contract_address" ~ '^0x[0-9a-f]{40}$'),
  CONSTRAINT "agent_version_provenance_token_check" CHECK ("token_id" ~ '^(0|[1-9][0-9]{0,77})$'),
  CONSTRAINT "agent_version_provenance_uri_check" CHECK (
    "metadata_uri" IS NULL OR (
      char_length("metadata_uri") BETWEEN 8 AND 500 AND
      "metadata_uri" ~ '^(ipfs://|https://)[^[:space:]]+$'
    )
  ),
  CONSTRAINT "agent_version_provenance_hash_check" CHECK ("evidence_hash" ~ '^[0-9a-f]{64}$')
);

CREATE INDEX "idx_agent_version_provenance_token"
  ON "agent_version_provenance"("chain_id", "contract_address", "token_id");

CREATE OR REPLACE FUNCTION enforce_goal_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."state" = NEW."state" THEN RETURN NEW; END IF;
  IF NOT (
    (OLD."state" = 'DRAFT' AND NEW."state" = 'ACTIVE') OR
    (OLD."state" = 'ACTIVE' AND NEW."state" IN ('PAUSED', 'COMPLETED')) OR
    (OLD."state" = 'PAUSED' AND NEW."state" IN ('ACTIVE', 'COMPLETED'))
  ) THEN
    RAISE EXCEPTION 'illegal goal transition: % -> %', OLD."state", NEW."state" USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "goals_legal_transition"
BEFORE UPDATE ON "goals" FOR EACH ROW EXECUTE FUNCTION enforce_goal_transition();

CREATE OR REPLACE FUNCTION enforce_goal_run_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."state" = NEW."state" THEN RETURN NEW; END IF;
  IF NOT (
    (OLD."state" = 'SCHEDULED' AND NEW."state" IN ('SELECTING', 'CANCELED')) OR
    (OLD."state" = 'SELECTING' AND NEW."state" IN ('RUNNING', 'BLOCKED', 'FAILED', 'CANCELED')) OR
    (OLD."state" = 'RUNNING' AND NEW."state" IN ('SYNTHESIZING', 'READY', 'PARTIAL', 'FAILED', 'CANCELED')) OR
    (OLD."state" = 'SYNTHESIZING' AND NEW."state" IN ('READY', 'PARTIAL', 'FAILED', 'CANCELED'))
  ) THEN
    RAISE EXCEPTION 'illegal goal run transition: % -> %', OLD."state", NEW."state" USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "goal_runs_legal_transition"
BEFORE UPDATE ON "goal_runs" FOR EACH ROW EXECUTE FUNCTION enforce_goal_run_transition();

CREATE OR REPLACE FUNCTION enforce_goal_run_snapshot()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."goal_id" <> NEW."goal_id" OR OLD."owner_user_id" <> NEW."owner_user_id" OR
     OLD."idempotency_key" <> NEW."idempotency_key" OR OLD."scheduled_for" <> NEW."scheduled_for" OR
     OLD."objective_snapshot" <> NEW."objective_snapshot" OR
     OLD."capabilities_snapshot" IS DISTINCT FROM NEW."capabilities_snapshot" OR
     OLD."policy_snapshot" IS DISTINCT FROM NEW."policy_snapshot" OR
     OLD."policy_hash" <> NEW."policy_hash" OR OLD."effect_identity" <> NEW."effect_identity" THEN
    RAISE EXCEPTION 'goal run snapshot is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "goal_runs_snapshot_immutable"
BEFORE UPDATE ON "goal_runs" FOR EACH ROW EXECUTE FUNCTION enforce_goal_run_snapshot();

CREATE OR REPLACE FUNCTION enforce_goal_run_job_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."goal_run_id" <> NEW."goal_run_id" OR OLD."agent_version_id" <> NEW."agent_version_id" OR
     OLD."role" <> NEW."role" OR OLD."selection_rank" <> NEW."selection_rank" OR
     OLD."covered_capabilities" IS DISTINCT FROM NEW."covered_capabilities" OR
     OLD."price_atomic_snapshot" <> NEW."price_atomic_snapshot" OR
     OLD."manifest_hash_snapshot" <> NEW."manifest_hash_snapshot" OR
     OLD."full_subname_snapshot" <> NEW."full_subname_snapshot" OR
     (OLD."job_id" IS NOT NULL AND OLD."job_id" IS DISTINCT FROM NEW."job_id") THEN
    RAISE EXCEPTION 'goal run job snapshot is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "goal_run_jobs_immutable"
BEFORE UPDATE ON "goal_run_jobs" FOR EACH ROW EXECUTE FUNCTION enforce_goal_run_job_immutability();

CREATE OR REPLACE FUNCTION reject_agent_version_provenance_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'agent version provenance is append-only' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "agent_version_provenance_append_only"
BEFORE UPDATE OR DELETE ON "agent_version_provenance"
FOR EACH ROW EXECUTE FUNCTION reject_agent_version_provenance_mutation();
