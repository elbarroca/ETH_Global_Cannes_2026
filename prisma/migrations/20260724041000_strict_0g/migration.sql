CREATE TABLE "a3_execution_journals" (
    "effect_id" TEXT NOT NULL,
    "job_id" UUID NOT NULL,
    "intent_id" UUID NOT NULL,
    "agent_version_id" UUID NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT NOT NULL,
    "creator_user_id" TEXT NOT NULL,
    "creator_wallet" TEXT NOT NULL,
    "buyer_user_id" TEXT NOT NULL,
    "buyer_wallet" TEXT NOT NULL,
    "agent_version_number" INTEGER NOT NULL,
    "manifest" JSONB NOT NULL,
    "manifest_hash" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "input_hash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "deadline_at" TIMESTAMPTZ(6) NOT NULL,
    "policy_version" TEXT NOT NULL,
    "request_bytes" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "request_id" TEXT,
    "signer_address" TEXT,
    "response_content" TEXT,
    "response_hash" TEXT,
    "compute_receipt_bytes" TEXT,
    "compute_receipt_digest" TEXT,
    "storage_receipt_bytes" TEXT,
    "storage_receipt_digest" TEXT,
    "expected_root" TEXT,
    "expected_digest" TEXT,
    "expected_size" INTEGER,
    "readback_root" TEXT,
    "readback_digest" TEXT,
    "readback_size" INTEGER,
    "result" JSONB,
    "proof_hash" TEXT,
    "error_code" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "a3_execution_journals_pkey" PRIMARY KEY ("effect_id"),
    CONSTRAINT "a3_journals_job_key" UNIQUE ("job_id"),
    CONSTRAINT "a3_journals_effect_fk" FOREIGN KEY ("effect_id") REFERENCES "effects"("id") ON DELETE RESTRICT,
    CONSTRAINT "a3_journals_job_fk" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT,
    CONSTRAINT "a3_journals_intent_fk" FOREIGN KEY ("intent_id") REFERENCES "job_intents"("id") ON DELETE RESTRICT,
    CONSTRAINT "a3_journals_agent_version_fk" FOREIGN KEY ("agent_version_id") REFERENCES "agent_versions"("id") ON DELETE RESTRICT,
    CONSTRAINT "a3_journals_schema_check" CHECK ("schema_version" = 1),
    CONSTRAINT "a3_journals_version_check" CHECK ("version" >= 0),
    CONSTRAINT "a3_journals_stage_check" CHECK ("stage" IN (
        'PREPARED', 'REQUEST_SENT', 'RESPONSE_VERIFIED', 'STORAGE_REQUESTED',
        'STORAGE_COMMITTED', 'READBACK_VERIFIED', 'FAILED'
    )),
    CONSTRAINT "a3_journals_identity_check" CHECK (
        "agent_version_number" > 0
        AND length("creator_user_id") BETWEEN 1 AND 160
        AND length("buyer_user_id") BETWEEN 1 AND 160
        AND length("creator_wallet") BETWEEN 3 AND 160
        AND length("buyer_wallet") BETWEEN 3 AND 160
    ),
    CONSTRAINT "a3_journals_hashes_check" CHECK (
        "effect_id" ~ '^[0-9a-f]{64}$'
        AND "manifest_hash" ~ '^[0-9a-f]{64}$'
        AND "input_hash" ~ '^[0-9a-f]{64}$'
        AND "nonce" ~ '^[0-9a-f]{64}$'
        AND "request_hash" ~ '^[0-9a-f]{64}$'
        AND ("response_hash" IS NULL OR "response_hash" ~ '^[0-9a-f]{64}$')
        AND ("compute_receipt_digest" IS NULL OR "compute_receipt_digest" ~ '^[0-9a-f]{64}$')
        AND ("storage_receipt_digest" IS NULL OR "storage_receipt_digest" ~ '^[0-9a-f]{64}$')
        AND ("expected_digest" IS NULL OR "expected_digest" ~ '^[0-9a-f]{64}$')
        AND ("readback_digest" IS NULL OR "readback_digest" ~ '^[0-9a-f]{64}$')
        AND ("proof_hash" IS NULL OR "proof_hash" ~ '^[0-9a-f]{64}$')
    ),
    CONSTRAINT "a3_journals_roots_check" CHECK (
        ("expected_root" IS NULL OR "expected_root" ~ '^0x[0-9a-f]{64}$')
        AND ("readback_root" IS NULL OR "readback_root" ~ '^0x[0-9a-f]{64}$')
    ),
    CONSTRAINT "a3_journals_bounds_check" CHECK (
        octet_length("request_bytes") BETWEEN 1 AND 131072
        AND octet_length("provider") BETWEEN 1 AND 160
        AND octet_length("model") BETWEEN 1 AND 256
        AND octet_length("policy_version") BETWEEN 1 AND 64
        AND ("response_content" IS NULL OR octet_length("response_content") BETWEEN 1 AND 1048576)
        AND ("compute_receipt_bytes" IS NULL OR octet_length("compute_receipt_bytes") BETWEEN 1 AND 131072)
        AND ("storage_receipt_bytes" IS NULL OR octet_length("storage_receipt_bytes") BETWEEN 1 AND 131072)
        AND ("expected_size" IS NULL OR "expected_size" BETWEEN 1 AND 1048576)
        AND ("readback_size" IS NULL OR "readback_size" BETWEEN 1 AND 1048576)
    ),
    CONSTRAINT "a3_journals_response_stage_check" CHECK (
        "stage" NOT IN ('RESPONSE_VERIFIED', 'STORAGE_REQUESTED', 'STORAGE_COMMITTED', 'READBACK_VERIFIED')
        OR (
            "request_id" IS NOT NULL AND "signer_address" IS NOT NULL
            AND "response_content" IS NOT NULL AND "response_hash" IS NOT NULL
            AND "compute_receipt_bytes" IS NOT NULL AND "compute_receipt_digest" IS NOT NULL
        )
    ),
    CONSTRAINT "a3_journals_storage_stage_check" CHECK (
        "stage" NOT IN ('STORAGE_COMMITTED', 'READBACK_VERIFIED')
        OR (
            "storage_receipt_bytes" IS NOT NULL AND "storage_receipt_digest" IS NOT NULL
            AND "expected_root" IS NOT NULL AND "expected_digest" IS NOT NULL
            AND "expected_size" IS NOT NULL
        )
    ),
    CONSTRAINT "a3_journals_readback_stage_check" CHECK (
        "stage" <> 'READBACK_VERIFIED'
        OR (
            "readback_root" = "expected_root" AND "readback_digest" = "expected_digest"
            AND "readback_size" = "expected_size" AND "result" IS NOT NULL
            AND "proof_hash" IS NOT NULL AND "error_code" IS NULL
        )
    ),
    CONSTRAINT "a3_journals_failure_stage_check" CHECK (
        ("stage" = 'FAILED' AND "error_code" ~ '^[A-Z][A-Z0-9_]{2,64}$')
        OR ("stage" <> 'FAILED' AND "error_code" IS NULL)
    )
);

CREATE INDEX "idx_a3_journals_job_stage"
    ON "a3_execution_journals"("job_id", "stage");

CREATE OR REPLACE FUNCTION enforce_a3_journal_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'A3 journals cannot be deleted';
    END IF;
    IF TG_OP = 'INSERT' THEN
        IF NEW."stage" <> 'PREPARED' OR NEW."version" <> 0
           OR NEW."request_id" IS NOT NULL OR NEW."signer_address" IS NOT NULL
           OR NEW."response_content" IS NOT NULL OR NEW."response_hash" IS NOT NULL
           OR NEW."compute_receipt_bytes" IS NOT NULL OR NEW."compute_receipt_digest" IS NOT NULL
           OR NEW."storage_receipt_bytes" IS NOT NULL OR NEW."storage_receipt_digest" IS NOT NULL
           OR NEW."expected_root" IS NOT NULL OR NEW."expected_digest" IS NOT NULL
           OR NEW."expected_size" IS NOT NULL OR NEW."readback_root" IS NOT NULL
           OR NEW."readback_digest" IS NOT NULL OR NEW."readback_size" IS NOT NULL
           OR NEW."result" IS NOT NULL OR NEW."proof_hash" IS NOT NULL
           OR NEW."error_code" IS NOT NULL THEN
            RAISE EXCEPTION 'A3 journal must begin at an empty PREPARED stage';
        END IF;
        IF NOT EXISTS (
            SELECT 1
            FROM "effects" e
            JOIN "jobs" j ON j."id" = e."job_id" AND j."intent_id" = e."intent_id"
            JOIN "job_intents" i ON i."id" = j."intent_id"
            JOIN "agent_versions" v ON v."id" = j."agent_version_id"
            JOIN "kernel_agents" a ON a."id" = v."agent_id"
            JOIN "users" buyer ON buyer."id" = j."buyer_user_id"
            WHERE e."id" = NEW."effect_id"
              AND e."job_id" = NEW."job_id"
              AND e."intent_id" = NEW."intent_id"
              AND e."adapter_key" = 'protected-a3'
              AND e."request_hash" = NEW."input_hash"
              AND j."agent_version_id" = NEW."agent_version_id"
              AND j."buyer_user_id" = NEW."buyer_user_id"
              AND i."buyer_user_id" = NEW."buyer_user_id"
              AND i."agent_version_id" = NEW."agent_version_id"
              AND i."input" = NEW."input"
              AND i."input_hash" = NEW."input_hash"
              AND v."version" = NEW."agent_version_number"
              AND v."manifest" = NEW."manifest"
              AND v."manifest_hash" = NEW."manifest_hash"
              AND v."owner_wallet" = NEW."creator_wallet"
              AND v."proof_policy" = 'verified-receipt-required'
              AND v."published"
              AND a."owner_user_id" = NEW."creator_user_id"
              AND buyer."wallet_address" = NEW."buyer_wallet"
        ) THEN
            RAISE EXCEPTION 'A3 journal lineage does not match the protected effect';
        END IF;
        RETURN NEW;
    END IF;
    IF OLD."stage" IN ('READBACK_VERIFIED', 'FAILED') THEN
        RAISE EXCEPTION 'terminal A3 journal is immutable';
    END IF;
    IF NEW."version" <> OLD."version" + 1 THEN
        RAISE EXCEPTION 'A3 journal version must increment by one';
    END IF;
    IF NEW."effect_id" IS DISTINCT FROM OLD."effect_id"
       OR NEW."job_id" IS DISTINCT FROM OLD."job_id"
       OR NEW."intent_id" IS DISTINCT FROM OLD."intent_id"
       OR NEW."agent_version_id" IS DISTINCT FROM OLD."agent_version_id"
       OR NEW."schema_version" IS DISTINCT FROM OLD."schema_version"
       OR NEW."creator_user_id" IS DISTINCT FROM OLD."creator_user_id"
       OR NEW."creator_wallet" IS DISTINCT FROM OLD."creator_wallet"
       OR NEW."buyer_user_id" IS DISTINCT FROM OLD."buyer_user_id"
       OR NEW."buyer_wallet" IS DISTINCT FROM OLD."buyer_wallet"
       OR NEW."agent_version_number" IS DISTINCT FROM OLD."agent_version_number"
       OR NEW."manifest" IS DISTINCT FROM OLD."manifest"
       OR NEW."manifest_hash" IS DISTINCT FROM OLD."manifest_hash"
       OR NEW."input" IS DISTINCT FROM OLD."input"
       OR NEW."input_hash" IS DISTINCT FROM OLD."input_hash"
       OR NEW."provider" IS DISTINCT FROM OLD."provider"
       OR NEW."model" IS DISTINCT FROM OLD."model"
       OR NEW."nonce" IS DISTINCT FROM OLD."nonce"
       OR NEW."deadline_at" IS DISTINCT FROM OLD."deadline_at"
       OR NEW."policy_version" IS DISTINCT FROM OLD."policy_version"
       OR NEW."request_bytes" IS DISTINCT FROM OLD."request_bytes"
       OR NEW."request_hash" IS DISTINCT FROM OLD."request_hash"
       OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
        RAISE EXCEPTION 'A3 journal binding is immutable';
    END IF;
    IF (OLD."request_id" IS NOT NULL AND NEW."request_id" IS DISTINCT FROM OLD."request_id")
       OR (OLD."signer_address" IS NOT NULL AND NEW."signer_address" IS DISTINCT FROM OLD."signer_address")
       OR (OLD."response_content" IS NOT NULL AND NEW."response_content" IS DISTINCT FROM OLD."response_content")
       OR (OLD."response_hash" IS NOT NULL AND NEW."response_hash" IS DISTINCT FROM OLD."response_hash")
       OR (OLD."compute_receipt_bytes" IS NOT NULL AND NEW."compute_receipt_bytes" IS DISTINCT FROM OLD."compute_receipt_bytes")
       OR (OLD."compute_receipt_digest" IS NOT NULL AND NEW."compute_receipt_digest" IS DISTINCT FROM OLD."compute_receipt_digest")
       OR (OLD."storage_receipt_bytes" IS NOT NULL AND NEW."storage_receipt_bytes" IS DISTINCT FROM OLD."storage_receipt_bytes")
       OR (OLD."storage_receipt_digest" IS NOT NULL AND NEW."storage_receipt_digest" IS DISTINCT FROM OLD."storage_receipt_digest")
       OR (OLD."expected_root" IS NOT NULL AND NEW."expected_root" IS DISTINCT FROM OLD."expected_root")
       OR (OLD."expected_digest" IS NOT NULL AND NEW."expected_digest" IS DISTINCT FROM OLD."expected_digest")
       OR (OLD."expected_size" IS NOT NULL AND NEW."expected_size" IS DISTINCT FROM OLD."expected_size")
       OR (OLD."readback_root" IS NOT NULL AND NEW."readback_root" IS DISTINCT FROM OLD."readback_root")
       OR (OLD."readback_digest" IS NOT NULL AND NEW."readback_digest" IS DISTINCT FROM OLD."readback_digest")
       OR (OLD."readback_size" IS NOT NULL AND NEW."readback_size" IS DISTINCT FROM OLD."readback_size")
       OR (OLD."result" IS NOT NULL AND NEW."result" IS DISTINCT FROM OLD."result")
       OR (OLD."proof_hash" IS NOT NULL AND NEW."proof_hash" IS DISTINCT FROM OLD."proof_hash") THEN
        RAISE EXCEPTION 'A3 journal evidence is append-only';
    END IF;
    IF NEW."stage" IN ('REQUEST_SENT', 'STORAGE_REQUESTED', 'FAILED') AND (
        NEW."request_id" IS DISTINCT FROM OLD."request_id"
        OR NEW."signer_address" IS DISTINCT FROM OLD."signer_address"
        OR NEW."response_content" IS DISTINCT FROM OLD."response_content"
        OR NEW."response_hash" IS DISTINCT FROM OLD."response_hash"
        OR NEW."compute_receipt_bytes" IS DISTINCT FROM OLD."compute_receipt_bytes"
        OR NEW."compute_receipt_digest" IS DISTINCT FROM OLD."compute_receipt_digest"
        OR NEW."storage_receipt_bytes" IS DISTINCT FROM OLD."storage_receipt_bytes"
        OR NEW."storage_receipt_digest" IS DISTINCT FROM OLD."storage_receipt_digest"
        OR NEW."expected_root" IS DISTINCT FROM OLD."expected_root"
        OR NEW."expected_digest" IS DISTINCT FROM OLD."expected_digest"
        OR NEW."expected_size" IS DISTINCT FROM OLD."expected_size"
        OR NEW."readback_root" IS DISTINCT FROM OLD."readback_root"
        OR NEW."readback_digest" IS DISTINCT FROM OLD."readback_digest"
        OR NEW."readback_size" IS DISTINCT FROM OLD."readback_size"
        OR NEW."result" IS DISTINCT FROM OLD."result"
        OR NEW."proof_hash" IS DISTINCT FROM OLD."proof_hash"
    ) THEN
        RAISE EXCEPTION 'A3 journal stage cannot rewrite evidence';
    END IF;
    IF NEW."stage" = 'RESPONSE_VERIFIED' AND (
        NEW."storage_receipt_bytes" IS DISTINCT FROM OLD."storage_receipt_bytes"
        OR NEW."storage_receipt_digest" IS DISTINCT FROM OLD."storage_receipt_digest"
        OR NEW."expected_root" IS DISTINCT FROM OLD."expected_root"
        OR NEW."expected_digest" IS DISTINCT FROM OLD."expected_digest"
        OR NEW."expected_size" IS DISTINCT FROM OLD."expected_size"
        OR NEW."readback_root" IS DISTINCT FROM OLD."readback_root"
        OR NEW."readback_digest" IS DISTINCT FROM OLD."readback_digest"
        OR NEW."readback_size" IS DISTINCT FROM OLD."readback_size"
        OR NEW."result" IS DISTINCT FROM OLD."result"
        OR NEW."proof_hash" IS DISTINCT FROM OLD."proof_hash"
    ) THEN
        RAISE EXCEPTION 'A3 response stage cannot add storage evidence';
    END IF;
    IF NEW."stage" = 'STORAGE_COMMITTED' AND (
        NEW."request_id" IS DISTINCT FROM OLD."request_id"
        OR NEW."signer_address" IS DISTINCT FROM OLD."signer_address"
        OR NEW."response_content" IS DISTINCT FROM OLD."response_content"
        OR NEW."response_hash" IS DISTINCT FROM OLD."response_hash"
        OR NEW."compute_receipt_bytes" IS DISTINCT FROM OLD."compute_receipt_bytes"
        OR NEW."compute_receipt_digest" IS DISTINCT FROM OLD."compute_receipt_digest"
        OR NEW."readback_root" IS DISTINCT FROM OLD."readback_root"
        OR NEW."readback_digest" IS DISTINCT FROM OLD."readback_digest"
        OR NEW."readback_size" IS DISTINCT FROM OLD."readback_size"
        OR NEW."result" IS DISTINCT FROM OLD."result"
        OR NEW."proof_hash" IS DISTINCT FROM OLD."proof_hash"
    ) THEN
        RAISE EXCEPTION 'A3 storage stage cannot rewrite compute or readback evidence';
    END IF;
    IF NEW."stage" = 'READBACK_VERIFIED' AND (
        NEW."request_id" IS DISTINCT FROM OLD."request_id"
        OR NEW."signer_address" IS DISTINCT FROM OLD."signer_address"
        OR NEW."response_content" IS DISTINCT FROM OLD."response_content"
        OR NEW."response_hash" IS DISTINCT FROM OLD."response_hash"
        OR NEW."compute_receipt_bytes" IS DISTINCT FROM OLD."compute_receipt_bytes"
        OR NEW."compute_receipt_digest" IS DISTINCT FROM OLD."compute_receipt_digest"
        OR NEW."storage_receipt_bytes" IS DISTINCT FROM OLD."storage_receipt_bytes"
        OR NEW."storage_receipt_digest" IS DISTINCT FROM OLD."storage_receipt_digest"
        OR NEW."expected_root" IS DISTINCT FROM OLD."expected_root"
        OR NEW."expected_digest" IS DISTINCT FROM OLD."expected_digest"
        OR NEW."expected_size" IS DISTINCT FROM OLD."expected_size"
    ) THEN
        RAISE EXCEPTION 'A3 readback stage cannot rewrite prior evidence';
    END IF;
    IF NOT (
        (OLD."stage" = 'PREPARED' AND NEW."stage" IN ('REQUEST_SENT', 'FAILED'))
        OR (OLD."stage" = 'REQUEST_SENT' AND NEW."stage" IN ('RESPONSE_VERIFIED', 'FAILED'))
        OR (OLD."stage" = 'RESPONSE_VERIFIED' AND NEW."stage" IN ('STORAGE_REQUESTED', 'FAILED'))
        OR (OLD."stage" = 'STORAGE_REQUESTED' AND NEW."stage" IN ('STORAGE_COMMITTED', 'FAILED'))
        OR (OLD."stage" = 'STORAGE_COMMITTED' AND NEW."stage" IN ('READBACK_VERIFIED', 'FAILED'))
    ) THEN
        RAISE EXCEPTION 'illegal A3 journal transition: % -> %', OLD."stage", NEW."stage";
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "a3_journals_legal_transitions"
BEFORE INSERT OR UPDATE OR DELETE ON "a3_execution_journals"
FOR EACH ROW EXECUTE FUNCTION enforce_a3_journal_transition();
