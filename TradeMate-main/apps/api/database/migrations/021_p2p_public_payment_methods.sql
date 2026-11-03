-- Expose the seller's selected payment-method labels on public P2P offers.
-- These are user-selected method names only; bank account details and payment credentials
-- are never stored in or exposed by this public view.
CREATE OR REPLACE VIEW p2p_public_book AS
SELECT id, side, asset_code, fiat_code, price, remaining_quantity AS quantity,
       min_fiat_amount, max_fiat_amount, created_at, updated_at, payment_methods
FROM p2p_orders
WHERE status IN ('open','partially_filled') AND remaining_quantity > 0;
