-- Opaque provider session references only; no document images, biometrics or raw vendor payloads.
CREATE TABLE IF NOT EXISTS sports_transfer_verification_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_case_id UUID NOT NULL REFERENCES sports_transfer_verification_cases(id) ON DELETE RESTRICT,
  provider_key TEXT NOT NULL CHECK (provider_key IN ('sandbox','sumsub','veriff','trulioo')),
  provider_session_reference TEXT NOT NULL CHECK (char_length(provider_session_reference) BETWEEN 1 AND 240),
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','submitted','completed','expired','cancelled','failed')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_key, provider_session_reference)
);
CREATE INDEX IF NOT EXISTS sports_transfer_verification_sessions_case_idx
  ON sports_transfer_verification_sessions (verification_case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sports_transfer_verification_sessions_expiry_idx
  ON sports_transfer_verification_sessions (expires_at)
  WHERE status IN ('created','submitted');
