-- Encrypted TOTP authenticator enrollment and short-lived login challenges.
CREATE TABLE IF NOT EXISTS user_auth_security (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  totp_secret_encrypted TEXT,
  totp_enabled BOOLEAN NOT NULL DEFAULT false,
  totp_confirmed_at TIMESTAMPTZ,
  setup_expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT totp_enabled OR (totp_secret_encrypted IS NOT NULL AND totp_confirmed_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS auth_login_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_login_challenges_expiry_idx ON auth_login_challenges (expires_at);
