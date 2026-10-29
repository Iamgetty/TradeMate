-- Marketplace transaction ledger.
-- A transaction is only marked completed after BOTH buyer and seller confirm fulfilment.
-- Enquiries and messages are deliberately not transactions.
CREATE TABLE IF NOT EXISTS marketplace_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seller_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  quantity BIGINT NOT NULL CHECK (quantity > 0),
  unit_price_minor_units BIGINT NOT NULL CHECK (unit_price_minor_units >= 0),
  total_minor_units NUMERIC(24,0) NOT NULL CHECK (total_minor_units >= 0),
  currency_code CHAR(3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_confirmation'
    CHECK (status IN ('awaiting_confirmation', 'completed', 'cancelled', 'disputed')),
  buyer_confirmed_at TIMESTAMPTZ,
  seller_confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (buyer_confirmed_at IS NULL OR seller_confirmed_at IS NULL OR completed_at IS NOT NULL),
  CHECK (status <> 'completed' OR (buyer_confirmed_at IS NOT NULL AND seller_confirmed_at IS NOT NULL AND completed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS marketplace_transactions_completed_idx
  ON marketplace_transactions (completed_at DESC, id)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS marketplace_transactions_buyer_idx
  ON marketplace_transactions (buyer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS marketplace_transactions_seller_idx
  ON marketplace_transactions (seller_organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION trademate_set_marketplace_transaction_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.buyer_confirmed_at IS NOT NULL AND NEW.seller_confirmed_at IS NOT NULL THEN
    NEW.status := 'completed';
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSIF NEW.status IN ('cancelled', 'disputed') THEN
    NEW.completed_at := NULL;
  ELSE
    NEW.status := 'awaiting_confirmation';
    NEW.completed_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS marketplace_transaction_completion ON marketplace_transactions;
CREATE TRIGGER marketplace_transaction_completion
BEFORE INSERT OR UPDATE ON marketplace_transactions
FOR EACH ROW EXECUTE FUNCTION trademate_set_marketplace_transaction_completion();

CREATE OR REPLACE VIEW marketplace_public_completed_trades AS
SELECT
  t.id AS transaction_reference,
  l.id AS listing_id,
  l.title AS listing_title,
  l.listing_type,
  t.quantity,
  t.unit_price_minor_units::text AS unit_price_minor_units,
  t.total_minor_units::text AS total_minor_units,
  t.currency_code,
  'BUY'::text AS side,
  t.completed_at
FROM marketplace_transactions t
JOIN listings l ON l.id = t.listing_id
WHERE t.status = 'completed' AND t.completed_at IS NOT NULL
UNION ALL
SELECT
  t.id AS transaction_reference,
  l.id AS listing_id,
  l.title AS listing_title,
  l.listing_type,
  t.quantity,
  t.unit_price_minor_units::text AS unit_price_minor_units,
  t.total_minor_units::text AS total_minor_units,
  t.currency_code,
  'SELL'::text AS side,
  t.completed_at
FROM marketplace_transactions t
JOIN listings l ON l.id = t.listing_id
WHERE t.status = 'completed' AND t.completed_at IS NOT NULL;
