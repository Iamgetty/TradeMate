-- TradeMate P2P public book and completed-trade ledger.
-- Offers are orders; only explicitly completed, settled orders enter p2p_trades.
CREATE TABLE IF NOT EXISTS p2p_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  side TEXT NOT NULL CHECK (side IN ('buy','sell')),
  asset_code VARCHAR(16) NOT NULL,
  fiat_code CHAR(3) NOT NULL,
  price NUMERIC(24,10) NOT NULL CHECK (price > 0),
  quantity NUMERIC(28,12) NOT NULL CHECK (quantity > 0),
  remaining_quantity NUMERIC(28,12) NOT NULL CHECK (remaining_quantity >= 0 AND remaining_quantity <= quantity),
  min_fiat_amount NUMERIC(24,2) NOT NULL DEFAULT 0 CHECK (min_fiat_amount >= 0),
  max_fiat_amount NUMERIC(24,2) NOT NULL DEFAULT 0 CHECK (max_fiat_amount >= min_fiat_amount),
  payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','partially_filled','filled','cancelled','expired','disputed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(payment_methods) = 'array')
);
CREATE INDEX IF NOT EXISTS p2p_orders_book_idx
  ON p2p_orders (asset_code, fiat_code, side, price, created_at DESC)
  WHERE status IN ('open','partially_filled') AND remaining_quantity > 0;
CREATE INDEX IF NOT EXISTS p2p_orders_owner_idx
  ON p2p_orders (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS p2p_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES p2p_orders(id) ON DELETE RESTRICT,
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seller_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  asset_code VARCHAR(16) NOT NULL,
  fiat_code CHAR(3) NOT NULL,
  price NUMERIC(24,10) NOT NULL CHECK (price > 0),
  quantity NUMERIC(28,12) NOT NULL CHECK (quantity > 0),
  fiat_total NUMERIC(28,2) NOT NULL CHECK (fiat_total > 0),
  status TEXT NOT NULL CHECK (status IN ('pending','completed','cancelled','disputed','refunded')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (buyer_user_id <> seller_user_id),
  CHECK ((status = 'completed' AND completed_at IS NOT NULL) OR status <> 'completed')
);
CREATE INDEX IF NOT EXISTS p2p_trades_public_history_idx
  ON p2p_trades (asset_code, fiat_code, completed_at DESC)
  WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS p2p_trades_buyer_idx ON p2p_trades (buyer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS p2p_trades_seller_idx ON p2p_trades (seller_user_id, created_at DESC);

-- Public transparency views intentionally expose no names, contact details, or payment data.
CREATE OR REPLACE VIEW p2p_public_book AS
SELECT id, side, asset_code, fiat_code, price, remaining_quantity AS quantity,
       min_fiat_amount, max_fiat_amount, created_at, updated_at
FROM p2p_orders
WHERE status IN ('open','partially_filled') AND remaining_quantity > 0;

CREATE OR REPLACE VIEW p2p_public_completed_trades AS
SELECT id AS trade_reference, 'BUY'::text AS side, asset_code, fiat_code, price, quantity, fiat_total, completed_at
FROM p2p_trades WHERE status = 'completed' AND completed_at IS NOT NULL
UNION ALL
SELECT id AS trade_reference, 'SELL'::text AS side, asset_code, fiat_code, price, quantity, fiat_total, completed_at
FROM p2p_trades WHERE status = 'completed' AND completed_at IS NOT NULL;
