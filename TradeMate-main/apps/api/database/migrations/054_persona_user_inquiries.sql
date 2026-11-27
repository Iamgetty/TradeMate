-- Link Persona inquiries to authenticated TradeMate users without storing identity documents or PII.
CREATE TABLE IF NOT EXISTS public.persona_user_inquiries (
  inquiry_id TEXT PRIMARY KEY CHECK (inquiry_id ~ '^inq_[A-Za-z0-9]+$'),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','submitted','review','approved','declined','failed','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS persona_user_inquiries_user_created_idx ON public.persona_user_inquiries (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS persona_user_inquiries_active_idx ON public.persona_user_inquiries (user_id, status, created_at DESC)
  WHERE status IN ('pending','in_progress','submitted','review');
REVOKE ALL ON TABLE public.persona_user_inquiries FROM PUBLIC;
DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'trademate_app') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE public.persona_user_inquiries TO trademate_app;
  END IF;
END;
$grants$;
COMMENT ON TABLE public.persona_user_inquiries IS
  'Maps authenticated TradeMate users to Persona inquiry IDs and authoritative verification state; no identity documents or raw PII are stored.';
