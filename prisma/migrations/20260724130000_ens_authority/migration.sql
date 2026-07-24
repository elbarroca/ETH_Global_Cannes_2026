CREATE TABLE "ens_authority_bindings" (
    "effect_id" TEXT NOT NULL,
    "job_id" UUID NOT NULL,
    "agent_version_id" UUID NOT NULL,
    "binding_bytes" TEXT NOT NULL,
    "binding_hash" TEXT NOT NULL,
    "creator_name" TEXT NOT NULL,
    "creator_node" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "agent_node" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "registry" TEXT NOT NULL,
    "creator_resolver" TEXT NOT NULL,
    "agent_resolver" TEXT NOT NULL,
    "creator_owner" TEXT NOT NULL,
    "creator_delegate" TEXT NOT NULL,
    "agent_owner" TEXT NOT NULL,
    "agent_delegate" TEXT NOT NULL,
    "manifest_hash" TEXT NOT NULL,
    "capabilities" TEXT[] NOT NULL,
    "service" TEXT NOT NULL,
    "payout" TEXT NOT NULL,
    "max_age_seconds" INTEGER NOT NULL,
    "policy_version" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ens_authority_bindings_pkey" PRIMARY KEY ("effect_id"),
    CONSTRAINT "ens_authority_bindings_job_key" UNIQUE ("job_id"),
    CONSTRAINT "ens_bindings_effect_fk" FOREIGN KEY ("effect_id") REFERENCES "effects"("id") ON DELETE RESTRICT,
    CONSTRAINT "ens_bindings_job_fk" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT,
    CONSTRAINT "ens_bindings_version_fk" FOREIGN KEY ("agent_version_id") REFERENCES "agent_versions"("id") ON DELETE RESTRICT,
    CONSTRAINT "ens_bindings_hash_check" CHECK (
        "effect_id" ~ '^[0-9a-f]{64}$' AND "binding_hash" ~ '^[0-9a-f]{64}$'
        AND "manifest_hash" ~ '^[0-9a-f]{64}$'
        AND "creator_node" ~ '^0x[0-9a-f]{64}$' AND "agent_node" ~ '^0x[0-9a-f]{64}$'
    ),
    CONSTRAINT "ens_bindings_address_check" CHECK (
        "registry" ~ '^0x[0-9a-f]{40}$'
        AND "creator_resolver" ~ '^0x[0-9a-f]{40}$'
        AND "agent_resolver" ~ '^0x[0-9a-f]{40}$'
        AND "creator_owner" ~ '^0x[0-9a-f]{40}$'
        AND "creator_delegate" ~ '^0x[0-9a-f]{40}$'
        AND "agent_owner" ~ '^0x[0-9a-f]{40}$'
        AND "agent_delegate" ~ '^0x[0-9a-f]{40}$'
        AND "payout" ~ '^0x[0-9a-f]{40}$'
    ),
    CONSTRAINT "ens_bindings_bounds_check" CHECK (
        "chain_id" > 0 AND "max_age_seconds" BETWEEN 1 AND 3600
        AND octet_length("binding_bytes") BETWEEN 1 AND 131072
        AND octet_length("creator_name") BETWEEN 3 AND 255
        AND octet_length("agent_name") BETWEEN 5 AND 255
        AND octet_length("service") BETWEEN 1 AND 2048
        AND cardinality("capabilities") BETWEEN 1 AND 32
        AND "policy_version" ~ '^[a-z][a-z0-9-]{2,63}$'
    )
);

CREATE INDEX "idx_ens_bindings_version_created"
    ON "ens_authority_bindings"("agent_version_id", "created_at");

CREATE TABLE "ens_authority_checks" (
    "id" BIGSERIAL NOT NULL,
    "effect_id" TEXT NOT NULL,
    "job_id" UUID NOT NULL,
    "agent_version_id" UUID NOT NULL,
    "binding_hash" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "error_code" TEXT,
    "record_bytes" TEXT,
    "record_hash" TEXT,
    "chain_id" INTEGER,
    "block_number" NUMERIC(20,0),
    "block_timestamp" TIMESTAMPTZ(6),
    "observed_at" TIMESTAMPTZ(6) NOT NULL,
    "fresh_until" TIMESTAMPTZ(6),
    "transaction_hash" TEXT,
    "lease_owner" TEXT NOT NULL,
    "worker_epoch" BIGINT NOT NULL,
    "claim_version" INTEGER NOT NULL,
    "claim_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ens_authority_checks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ens_checks_binding_fk" FOREIGN KEY ("effect_id") REFERENCES "ens_authority_bindings"("effect_id") ON DELETE RESTRICT,
    CONSTRAINT "ens_checks_job_fk" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT,
    CONSTRAINT "ens_checks_version_fk" FOREIGN KEY ("agent_version_id") REFERENCES "agent_versions"("id") ON DELETE RESTRICT,
    CONSTRAINT "ens_checks_binding_hash_check" CHECK ("binding_hash" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "ens_checks_phase_check" CHECK (
        ("phase" = 'PRE_DELIVERY' AND "operation" = 'ACCEPT_DELIVERY')
        OR ("phase" = 'PRE_EXECUTION' AND "operation" IN (
            'COMPUTE_SERVICE', 'COMPUTE_HEADERS', 'COMPUTE_REQUEST',
            'COMPUTE_SIGNATURE', 'STORAGE_WRITE', 'STORAGE_READBACK'
        ))
    ),
    CONSTRAINT "ens_checks_decision_check" CHECK (
        ("decision" = 'ALLOW' AND "error_code" IS NULL
            AND "record_bytes" IS NOT NULL AND "record_hash" ~ '^[0-9a-f]{64}$'
            AND "chain_id" IS NOT NULL AND "block_number" IS NOT NULL
            AND "block_timestamp" IS NOT NULL AND "fresh_until" IS NOT NULL)
        OR ("decision" = 'DENY' AND "error_code" ~ '^ENS_AUTHORITY_[A-Z0-9_]{2,48}$'
            AND "record_bytes" IS NULL AND "record_hash" IS NULL)
    ),
    CONSTRAINT "ens_checks_observation_check" CHECK (
        "worker_epoch" > 0 AND "claim_version" > 0
        AND ("transaction_hash" IS NULL OR "transaction_hash" ~ '^0x[0-9a-f]{64}$')
    )
);

CREATE INDEX "idx_ens_checks_effect_phase"
    ON "ens_authority_checks"("effect_id", "phase", "id");
CREATE INDEX "idx_ens_checks_job_decision"
    ON "ens_authority_checks"("job_id", "decision", "created_at");

ALTER TABLE "receipts" ADD COLUMN "authority_check_id" BIGINT NOT NULL;
CREATE UNIQUE INDEX "receipts_authority_check_key" ON "receipts"("authority_check_id");
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_authority_check_fk"
    FOREIGN KEY ("authority_check_id") REFERENCES "ens_authority_checks"("id") ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION enforce_ens_authority_binding()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'ENS authority bindings are immutable';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM effects e
        JOIN jobs j ON j.id = e.job_id AND j.intent_id = e.intent_id
        JOIN agent_versions v ON v.id = j.agent_version_id
        JOIN kernel_agents a ON a.id = v.agent_id
        WHERE e.id = NEW.effect_id AND e.job_id = NEW.job_id
          AND e.adapter_key = 'protected-a3'
          AND j.agent_version_id = NEW.agent_version_id
          AND v.published AND v.adapter_key = 'protected-a3'
          AND v.manifest_hash = NEW.manifest_hash
          AND v.capabilities = NEW.capabilities
          AND COALESCE(v.endpoint, v.adapter_key) = NEW.service
          AND lower(v.owner_wallet) = NEW.creator_owner
          AND lower(v.owner_wallet) = NEW.agent_owner
          AND lower(COALESCE(v.payout_address, v.owner_wallet)) = NEW.creator_delegate
          AND lower(COALESCE(v.payout_address, v.owner_wallet)) = NEW.agent_delegate
          AND lower(COALESCE(v.payout_address, v.owner_wallet)) = NEW.payout
    ) THEN
        RAISE EXCEPTION 'ENS authority binding does not match immutable lineage';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ens_authority_bindings_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "ens_authority_bindings"
FOR EACH ROW EXECUTE FUNCTION enforce_ens_authority_binding();

CREATE OR REPLACE FUNCTION enforce_ens_authority_check()
RETURNS TRIGGER AS $$
DECLARE
    binding ens_authority_bindings%ROWTYPE;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'ENS authority checks are append-only';
    END IF;
    SELECT * INTO binding FROM ens_authority_bindings
    WHERE effect_id = NEW.effect_id FOR UPDATE;
    IF NOT FOUND OR binding.job_id <> NEW.job_id
       OR binding.agent_version_id <> NEW.agent_version_id
       OR binding.binding_hash <> NEW.binding_hash THEN
        RAISE EXCEPTION 'ENS authority check binding mismatch';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM jobs j
        JOIN effects e ON e.job_id = j.id
        JOIN worker_leases w ON w.key = 'kernel-worker'
        WHERE j.id = NEW.job_id AND e.id = NEW.effect_id
          AND j.agent_version_id = NEW.agent_version_id
          AND j.state = 'RUNNING' AND j.version = NEW.claim_version
          AND j.lease_owner = NEW.lease_owner
          AND j.lease_expires_at > NEW.observed_at
          AND j.lease_expires_at = NEW.claim_expires_at
          AND w.owner_id = NEW.lease_owner AND w.epoch = NEW.worker_epoch
          AND w.expires_at > NEW.observed_at
    ) THEN
        RAISE EXCEPTION 'ENS authority check has no current worker claim';
    END IF;
    IF NEW.decision = 'ALLOW' AND (
        NEW.chain_id <> binding.chain_id
        OR NEW.block_timestamp > NEW.observed_at
        OR NEW.observed_at - NEW.block_timestamp > make_interval(secs => binding.max_age_seconds)
        OR NEW.fresh_until <= NEW.observed_at
        OR NEW.fresh_until - NEW.block_timestamp > make_interval(secs => binding.max_age_seconds)
    ) THEN
        RAISE EXCEPTION 'ENS authority ALLOW is not fresh or exact';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ens_authority_checks_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "ens_authority_checks"
FOR EACH ROW EXECUTE FUNCTION enforce_ens_authority_check();

CREATE OR REPLACE FUNCTION enforce_receipt_authority()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'receipts are immutable';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM ens_authority_checks c
        JOIN ens_authority_bindings b ON b.effect_id = c.effect_id
        JOIN jobs j ON j.id = c.job_id
        JOIN effects e ON e.id = c.effect_id AND e.job_id = j.id
        JOIN worker_leases w ON w.key = 'kernel-worker'
        WHERE c.id = NEW.authority_check_id
          AND c.id = (SELECT max(latest.id) FROM ens_authority_checks latest WHERE latest.effect_id = c.effect_id)
          AND c.phase = 'PRE_DELIVERY' AND c.operation = 'ACCEPT_DELIVERY'
          AND c.decision = 'ALLOW' AND c.error_code IS NULL
          AND c.effect_id = NEW.effect_id AND c.job_id = NEW.job_id
          AND c.agent_version_id = j.agent_version_id
          AND c.binding_hash = b.binding_hash
          AND b.job_id = NEW.job_id AND b.agent_version_id = j.agent_version_id
          AND c.observed_at <= NEW.created_at AND c.fresh_until >= NEW.created_at
          AND NEW.created_at - c.observed_at <= make_interval(secs => b.max_age_seconds)
          AND j.state = 'RUNNING' AND j.version = c.claim_version
          AND j.lease_owner = c.lease_owner AND j.lease_expires_at > NEW.created_at
          AND j.lease_expires_at >= c.claim_expires_at
          AND w.owner_id = c.lease_owner AND w.epoch = c.worker_epoch
          AND w.expires_at > NEW.created_at
          AND NEW.verified AND NEW.adapter_key = 'protected-a3'
    ) THEN
        RAISE EXCEPTION 'receipt requires a fresh exact PRE_DELIVERY ENS authority ALLOW';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "receipts_require_ens_authority"
BEFORE INSERT OR UPDATE OR DELETE ON "receipts"
FOR EACH ROW EXECUTE FUNCTION enforce_receipt_authority();
