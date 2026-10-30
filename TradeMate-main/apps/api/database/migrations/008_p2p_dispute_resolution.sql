-- Record moderator decisions so disputed P2P orders can reach a terminal state.
ALTER TABLE p2p_trades
  ADD COLUMN IF NOT EXISTS dispute_resolution TEXT,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_reviewer_key_id TEXT;
