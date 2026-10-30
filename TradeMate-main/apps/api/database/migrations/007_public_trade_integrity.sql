-- Correct public market records to represent each completed transaction once.
-- Payment methods are public offer terms, not private account or payment credentials.
CREATE OR REPLACE VIEW p2p_public_book AS
SELECT id, side, asset_code, fiat_code, price, remaining_quantity AS quantity,
       min_fiat_amount, max_fiat_amount, created_at, updated_at, payment_methods
FROM p2p_orders
WHERE status IN ('open','partially_filled') AND remaining_quantity > 0;

-- A marketplace transaction is one execution, not separate synthetic BUY and SELL rows.
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
WHERE t.status = 'completed' AND t.completed_at IS NOT NULL;

-- One P2P execution is shown once. Side is the taker's side relative to the ad.
CREATE OR REPLACE VIEW p2p_public_completed_trades AS
SELECT
  t.id AS trade_reference,
  CASE WHEN o.side = 'sell' THEN 'BUY'::text ELSE 'SELL'::text END AS side,
  t.asset_code,
  t.fiat_code,
  t.price,
  t.quantity,
  t.fiat_total,
  t.completed_at
FROM p2p_trades t
JOIN p2p_orders o ON o.id = t.order_id
WHERE t.status = 'completed' AND t.completed_at IS NOT NULL;
