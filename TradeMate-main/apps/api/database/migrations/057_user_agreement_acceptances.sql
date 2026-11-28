-- Versioned, auditable acceptance of the TradeMate platform user agreement.
-- No existing user is pre-accepted: accounts without a row must review it on next sign-in.
CREATE TABLE IF NOT EXISTS user_agreement_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  agreement_key TEXT NOT NULL,
  agreement_version TEXT NOT NULL,
  agreement_sha256 CHAR(64) NOT NULL CHECK (agreement_sha256 ~ '^[0-9a-f]{64}$'),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acceptance_method TEXT NOT NULL CHECK (acceptance_method = 'explicit_in_app'),
  ip_address INET,
  user_agent TEXT CHECK (user_agent IS NULL OR char_length(user_agent) <= 500),
  UNIQUE (user_id, agreement_key, agreement_version)
);
CREATE INDEX IF NOT EXISTS user_agreement_acceptances_user_idx
  ON user_agreement_acceptances (user_id, accepted_at DESC);
REVOKE ALL ON TABLE public.user_agreement_acceptances FROM PUBLIC;
DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'trademate_app') THEN
    GRANT SELECT, INSERT ON TABLE public.user_agreement_acceptances TO trademate_app;
  END IF;
END;
$grants$;
COMMENT ON TABLE public.user_agreement_acceptances IS
  'Immutable, versioned records of explicit in-app acceptance of TradeMate platform agreements.';
