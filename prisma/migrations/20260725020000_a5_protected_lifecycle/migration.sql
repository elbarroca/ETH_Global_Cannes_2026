-- A5 protected agent lifecycle. Legacy rows remain readable but cannot satisfy
-- the protected publication/hire predicate because lifecycle_state is NULL.

ALTER TABLE "agent_versions"
  ADD COLUMN "lifecycle_state" TEXT,
  ADD COLUMN "creator_parent" TEXT,
  ADD COLUMN "agent_label" TEXT,
  ADD COLUMN "full_subname" TEXT,
  ADD COLUMN "write_plan" JSONB,
  ADD COLUMN "write_plan_hash" TEXT,
  ADD COLUMN "canonical_state" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN "authority_owner" TEXT,
  ADD COLUMN "authority_delegate" TEXT,
  ADD COLUMN "authority_policy_version" TEXT,
  ADD COLUMN "authority_refusal" TEXT,
  ADD COLUMN "authority_record_hash" TEXT,
  ADD COLUMN "authority_observed_at" TIMESTAMPTZ(6),
  ADD COLUMN "authority_fresh_until" TIMESTAMPTZ(6),
  ADD COLUMN "authority_release_sha" TEXT;

ALTER TABLE "agent_versions"
  ADD CONSTRAINT "agent_versions_lifecycle_state_check"
    CHECK ("lifecycle_state" IS NULL OR "lifecycle_state" IN ('DRAFT', 'NAME_BOUND', 'WRITE_PREPARED', 'PUBLISHED')),
  ADD CONSTRAINT "agent_versions_canonical_state_check"
    CHECK ("canonical_state" IN ('UNVERIFIED', 'CANONICAL', 'REFUSED')),
  ADD CONSTRAINT "agent_versions_name_binding_check"
    CHECK (
      ("creator_parent" IS NULL AND "agent_label" IS NULL AND "full_subname" IS NULL) OR
      ("creator_parent" IS NOT NULL AND "agent_label" IS NOT NULL AND "full_subname" IS NOT NULL)
    ),
  ADD CONSTRAINT "agent_versions_write_plan_check"
    CHECK (("write_plan" IS NULL) = ("write_plan_hash" IS NULL)),
  ADD CONSTRAINT "agent_versions_hash_shape_check"
    CHECK (
      ("write_plan_hash" IS NULL OR "write_plan_hash" ~ '^[0-9a-f]{64}$') AND
      ("authority_record_hash" IS NULL OR "authority_record_hash" ~ '^[0-9a-f]{64}$') AND
      ("authority_release_sha" IS NULL OR "authority_release_sha" ~ '^[0-9a-f]{40}$')
    ),
  ADD CONSTRAINT "agent_versions_authority_address_check"
    CHECK (
      ("authority_owner" IS NULL OR "authority_owner" ~ '^0x[0-9a-f]{40}$') AND
      ("authority_delegate" IS NULL OR "authority_delegate" ~ '^0x[0-9a-f]{40}$')
    ),
  ADD CONSTRAINT "agent_versions_authority_time_check"
    CHECK (
      ("authority_observed_at" IS NULL AND "authority_fresh_until" IS NULL) OR
      ("authority_observed_at" IS NOT NULL AND "authority_fresh_until" > "authority_observed_at")
    ),
  ADD CONSTRAINT "agent_versions_protected_publish_check"
    CHECK (
      "lifecycle_state" IS NULL OR
      (
        "lifecycle_state" <> 'PUBLISHED' AND NOT "published"
      ) OR
      (
        "lifecycle_state" = 'PUBLISHED' AND "published" AND "published_at" IS NOT NULL AND
        "creator_parent" IS NOT NULL AND "agent_label" IS NOT NULL AND "full_subname" IS NOT NULL AND
        "write_plan" IS NOT NULL AND "write_plan_hash" IS NOT NULL AND
        "canonical_state" = 'CANONICAL' AND "authority_owner" IS NOT NULL AND
        "authority_policy_version" IS NOT NULL AND "authority_refusal" IS NULL AND
        "authority_record_hash" IS NOT NULL AND "authority_observed_at" IS NOT NULL AND
        "authority_fresh_until" IS NOT NULL AND "authority_release_sha" IS NOT NULL
      )
    );

CREATE UNIQUE INDEX "uniq_agent_versions_protected_subname"
  ON "agent_versions"("full_subname")
  WHERE "lifecycle_state" = 'PUBLISHED';

CREATE TABLE "agent_version_events" (
  "id" BIGSERIAL NOT NULL,
  "agent_version_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_version_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "agent_version_events_version_fkey"
    FOREIGN KEY ("agent_version_id") REFERENCES "agent_versions"("id") ON DELETE RESTRICT,
  CONSTRAINT "agent_version_events_sequence_check" CHECK ("sequence" >= 0),
  CONSTRAINT "agent_version_events_action_check"
    CHECK ("action" IN ('CREATE_DRAFT', 'BIND_NAME', 'PREPARE_ENS_WRITE', 'PUBLISH_REFUSED', 'PUBLISH_VERSION'))
);

CREATE UNIQUE INDEX "uniq_agent_version_events_sequence"
  ON "agent_version_events"("agent_version_id", "sequence");
CREATE INDEX "idx_agent_version_events_created"
  ON "agent_version_events"("agent_version_id", "created_at");

CREATE OR REPLACE FUNCTION enforce_agent_version_lifecycle()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."lifecycle_state" IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD."lifecycle_state" = NEW."lifecycle_state" THEN
    RETURN NEW;
  END IF;
  IF NOT (
    (OLD."lifecycle_state" = 'DRAFT' AND NEW."lifecycle_state" = 'NAME_BOUND') OR
    (OLD."lifecycle_state" = 'NAME_BOUND' AND NEW."lifecycle_state" = 'WRITE_PREPARED') OR
    (OLD."lifecycle_state" = 'WRITE_PREPARED' AND NEW."lifecycle_state" = 'PUBLISHED')
  ) THEN
    RAISE EXCEPTION 'illegal agent version lifecycle transition: % -> %',
      OLD."lifecycle_state", NEW."lifecycle_state" USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "agent_versions_legal_lifecycle"
BEFORE UPDATE ON "agent_versions"
FOR EACH ROW EXECUTE FUNCTION enforce_agent_version_lifecycle();

CREATE OR REPLACE FUNCTION reject_agent_version_event_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'agent version events are append-only' USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "agent_version_events_append_only"
BEFORE UPDATE OR DELETE ON "agent_version_events"
FOR EACH ROW EXECUTE FUNCTION reject_agent_version_event_mutation();
