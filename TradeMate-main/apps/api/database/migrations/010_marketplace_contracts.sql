-- Durable contract proposals between buyers and the organization behind a Services/B2B offer.
-- This records commercial terms and mutual fulfilment confirmation; it does not process payments or provide escrow.
CREATE TABLE IF NOT EXISTS marketplace_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seller_organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 140),
  scope TEXT NOT NULL CHECK (char_length(scope) BETWEEN 5 AND 5000),
  terms TEXT NOT NULL CHECK (char_length(terms) BETWEEN 5 AND 10000),
  amount_minor_units NUMERIC(24,0) NOT NULL CHECK (amount_minor_units >= 0),
  currency_code CHAR(3) NOT NULL,
  requested_start_date DATE,
  requested_completion_date DATE,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'accepted', 'rejected', 'cancelled', 'completed', 'disputed')),
  accepted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  buyer_confirmed_at TIMESTAMPTZ,
  seller_confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    requested_start_date IS NULL OR requested_completion_date IS NULL
    OR requested_completion_date >= requested_start_date
  ),
  CHECK (
    status <> 'completed'
    OR (buyer_confirmed_at IS NOT NULL AND seller_confirmed_at IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS marketplace_contracts_buyer_idx
  ON marketplace_contracts (buyer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_contracts_seller_idx
  ON marketplace_contracts (seller_organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_contracts_listing_idx
  ON marketplace_contracts (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS marketplace_contracts_status_idx
  ON marketplace_contracts (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_contract_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES marketplace_contracts(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketplace_contract_messages_idx
  ON marketplace_contract_messages (contract_id, created_at, id);
