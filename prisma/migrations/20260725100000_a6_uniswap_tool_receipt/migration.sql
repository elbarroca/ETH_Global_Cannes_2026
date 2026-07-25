-- A6 mandatory Uniswap swap tooling: immutable UniswapToolReceipt model.
-- Binds buyer, job, agentVersion, quote, chain, tokens, amounts, spender,
-- calldata hash, tx state, balance delta, confirmation, and release SHA.
-- A separate receipt from the canonical agent-delivery receipt.

CREATE TABLE public.uniswap_tool_receipts (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  job_id           UUID        NOT NULL,
  buyer_address    TEXT        NOT NULL,
  agent_version_id UUID        NOT NULL,
  quote_request_id TEXT        NOT NULL,
  chain_id         INTEGER     NOT NULL,
  token_in         TEXT        NOT NULL,
  token_out        TEXT        NOT NULL,
  amount_in        BIGINT      NOT NULL,
  amount_out       BIGINT,
  slippage_bps     INTEGER     NOT NULL,
  deadline         INTEGER     NOT NULL,
  spender          TEXT        NOT NULL,
  calldata_hash    TEXT        NOT NULL,
  tx_hash          TEXT,
  tx_status        TEXT        NOT NULL DEFAULT 'QUOTED',
  balance_delta    BIGINT,
  failure_reason   TEXT,
  confirmation_sig TEXT,
  release_sha      TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uniswap_tool_receipts_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX uniswap_tool_receipts_job_id_key      ON public.uniswap_tool_receipts (job_id);
CREATE UNIQUE INDEX uniswap_tool_receipts_quote_request_id_key ON public.uniswap_tool_receipts (quote_request_id);
CREATE        INDEX idx_uniswap_receipts_job              ON public.uniswap_tool_receipts (job_id);
CREATE        INDEX idx_uniswap_receipts_version          ON public.uniswap_tool_receipts (agent_version_id, created_at);

-- Immutable: tx_status may advance QUOTED → SUBMITTED → CONFIRMED | FAILED
-- but never regress. Enforce at the application layer (checked in route handler).
ALTER TABLE public.uniswap_tool_receipts
  ADD CONSTRAINT uniswap_receipts_chain_is_unichain_sepolia
  CHECK (chain_id = 1301);
