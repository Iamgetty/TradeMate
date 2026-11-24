-- Restore the two public read views whose Render definitions include
-- production-specific query logic absent from the original bootstrap migrations.

CREATE OR REPLACE VIEW public.marketplace_public_completed_trades AS
SELECT
  t.id AS transaction_reference,
  l.id AS listing_id,
  l.title AS listing_title,
  l.listing_type,
  t.quantity,
  (t.unit_price_minor_units)::text AS unit_price_minor_units,
  (t.total_minor_units)::text AS total_minor_units,
  t.currency_code,
  'BUY'::text AS side,
  t.completed_at
FROM marketplace_transactions t
JOIN listings l ON l.id = t.listing_id
WHERE t.status = 'completed' AND t.completed_at IS NOT NULL;

CREATE OR REPLACE VIEW public.p2p_public_completed_trades AS
SELECT
  t.id AS trade_reference,
  CASE WHEN o.side = 'sell'::text THEN 'BUY'::text ELSE 'SELL'::text END AS side,
  t.asset_code,
  t.fiat_code,
  t.price,
  t.quantity,
  t.fiat_total,
  t.completed_at
FROM p2p_trades t
JOIN p2p_orders o ON o.id = t.order_id
WHERE t.status = 'completed' AND t.completed_at IS NOT NULL;
