-- Idempotent per-party vault receipts for completed P2P trades.
CREATE TABLE IF NOT EXISTS public.p2p_trade_receipt_documents (
  p2p_trade_id UUID NOT NULL REFERENCES public.p2p_trades(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  document_id UUID NOT NULL UNIQUE REFERENCES public.user_documents(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (p2p_trade_id, user_id)
);
CREATE INDEX IF NOT EXISTS p2p_trade_receipt_documents_user_idx
  ON public.p2p_trade_receipt_documents (user_id, created_at DESC);
REVOKE ALL ON TABLE public.p2p_trade_receipt_documents FROM PUBLIC;
DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'trademate_app') THEN
    GRANT SELECT, INSERT ON TABLE public.p2p_trade_receipt_documents TO trademate_app;
  END IF;
END;
$grants$;
COMMENT ON TABLE public.p2p_trade_receipt_documents IS
  'Idempotent private vault receipt mapping for each party to a completed P2P trade.';
