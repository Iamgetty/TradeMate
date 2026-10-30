-- P2P payment-state tracking. TradeMate does not custody funds or provide escrow.
ALTER TABLE p2p_trades
  ADD COLUMN IF NOT EXISTS buyer_payment_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS seller_payment_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE p2p_trades
  ADD CONSTRAINT p2p_trades_payment_reference_length
    CHECK (payment_reference IS NULL OR length(payment_reference) <= 160),
  ADD CONSTRAINT p2p_trades_dispute_reason_length
    CHECK (dispute_reason IS NULL OR length(dispute_reason) <= 1000);

CREATE INDEX IF NOT EXISTS p2p_trades_pending_participant_idx
  ON p2p_trades (buyer_user_id, seller_user_id, created_at DESC)
  WHERE status IN ('pending','disputed');
