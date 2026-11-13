-- Email ownership verification for newly registered accounts.
-- Existing accounts are grandfathered as verified to avoid locking out current users.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

UPDATE users
SET email_verified_at = COALESCE(email_verified_at, created_at)
WHERE email IS NOT NULL
  AND status = 'active';

CREATE TABLE IF NOT EXISTS email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_verification_codes_user_created_idx
  ON email_verification_codes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS email_verification_codes_expiry_idx
  ON email_verification_codes (expires_at);
