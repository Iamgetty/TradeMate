-- Reconcile AWS staging with the additive P2P dispute fields present on Render.
-- These fields are nullable and do not alter existing trade state or settlement behavior.
ALTER TABLE public.p2p_trades
  ADD COLUMN IF NOT EXISTS dispute_resolution TEXT,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_reviewer_key_id TEXT;
