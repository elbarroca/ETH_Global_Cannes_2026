-- Harden protected goal-loop budget reservations, PATCH idempotency, and
-- terminal report integrity without changing the existing commerce ledger.

ALTER TABLE "goal_runs" ADD COLUMN "cost_reserved_at" TIMESTAMPTZ(6);

ALTER TABLE "goal_runs" ADD CONSTRAINT "goal_runs_reservation_check" CHECK (
  ("total_price_atomic" = 0 AND "cost_reserved_at" IS NULL) OR
  ("total_price_atomic" > 0 AND "cost_reserved_at" IS NOT NULL)
);

ALTER TABLE "goal_runs" ADD CONSTRAINT "goal_runs_report_binding_check" CHECK (
  "report" IS NULL OR CASE
    WHEN jsonb_typeof("report") = 'object' AND jsonb_typeof("report"->'evidence') = 'array' THEN
      "state" IN ('READY', 'PARTIAL') AND
      "report"->>'goalId' = "goal_id"::text AND
      "report"->>'runId' = "id"::text AND
      "report"->>'status' = "state" AND
      jsonb_array_length("report"->'evidence') BETWEEN 1 AND 5 AND
      ("state" <> 'PARTIAL' OR "report"->'swapProposal' = 'null'::jsonb) AND
      ("policy_snapshot"->>'executionMode' <> 'RESEARCH_ONLY' OR
        "report"->'swapProposal' = 'null'::jsonb)
    ELSE false
  END
);

CREATE INDEX "idx_goal_runs_daily_reservation"
  ON "goal_runs"("goal_id", "cost_reserved_at")
  WHERE "cost_reserved_at" IS NOT NULL;

ALTER TABLE "goals" ADD CONSTRAINT "goals_id_owner_key" UNIQUE ("id", "owner_user_id");

CREATE TABLE "goal_mutations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "goal_id" UUID NOT NULL,
  "owner_user_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "result_snapshot" JSONB NOT NULL,
  "result_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goal_mutations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goal_mutations_goal_owner_fkey"
    FOREIGN KEY ("goal_id", "owner_user_id")
    REFERENCES "goals"("id", "owner_user_id") ON DELETE RESTRICT,
  CONSTRAINT "goal_mutations_owner_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "goal_mutations_idempotency_check"
    CHECK ("idempotency_key" ~ '^[A-Za-z0-9._:-]{8,128}$'),
  CONSTRAINT "goal_mutations_hash_check" CHECK (
    "payload_hash" ~ '^[0-9a-f]{64}$' AND "result_hash" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "goal_mutations_result_check" CHECK (
    jsonb_typeof("result_snapshot") = 'object' AND
    "result_snapshot"->>'goalId' = "goal_id"::text AND
    "result_snapshot"->>'state' IN ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED')
  )
);

CREATE UNIQUE INDEX "uniq_goal_mutations_owner_idempotency"
  ON "goal_mutations"("owner_user_id", "idempotency_key");
CREATE INDEX "idx_goal_mutations_goal_created"
  ON "goal_mutations"("goal_id", "created_at");

CREATE OR REPLACE FUNCTION enforce_goal_run_reservation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."total_price_atomic" IS DISTINCT FROM NEW."total_price_atomic" OR
     OLD."cost_reserved_at" IS DISTINCT FROM NEW."cost_reserved_at" THEN
    IF OLD."total_price_atomic" <> 0 OR OLD."cost_reserved_at" IS NOT NULL OR
       OLD."state" <> 'SELECTING' OR NEW."state" <> 'RUNNING' OR
       NEW."total_price_atomic" <= 0 OR NEW."cost_reserved_at" IS NULL THEN
      RAISE EXCEPTION 'goal run cost reservation is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "goal_runs_reservation_immutable"
BEFORE UPDATE ON "goal_runs"
FOR EACH ROW EXECUTE FUNCTION enforce_goal_run_reservation();

CREATE OR REPLACE FUNCTION reject_terminal_goal_run_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."state" IN ('READY', 'PARTIAL', 'BLOCKED', 'FAILED', 'CANCELED') THEN
    RAISE EXCEPTION 'terminal goal run is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "goal_runs_terminal_immutable"
BEFORE UPDATE ON "goal_runs"
FOR EACH ROW EXECUTE FUNCTION reject_terminal_goal_run_mutation();

CREATE OR REPLACE FUNCTION reject_goal_mutation_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'goal mutation record is append-only' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "goal_mutations_append_only"
BEFORE UPDATE OR DELETE ON "goal_mutations"
FOR EACH ROW EXECUTE FUNCTION reject_goal_mutation_change();

CREATE OR REPLACE FUNCTION reject_terminal_goal_run_job_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  run_state TEXT;
BEGIN
  SELECT "state" INTO run_state FROM "goal_runs" WHERE "id" = NEW."goal_run_id" FOR UPDATE;
  IF run_state IN ('READY', 'PARTIAL', 'BLOCKED', 'FAILED', 'CANCELED') THEN
    RAISE EXCEPTION 'terminal goal run jobs are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "goal_run_jobs_terminal_insert_guard"
BEFORE INSERT ON "goal_run_jobs"
FOR EACH ROW EXECUTE FUNCTION reject_terminal_goal_run_job_insert();
