-- Transactional email configuration support and reversible account deletion requests.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('pending', 'active', 'suspended', 'closed', 'deletion_pending'));

CREATE TABLE IF NOT EXISTS user_deletion_requests (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  cancellation_token_hash TEXT UNIQUE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_for TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  CHECK (scheduled_for > requested_at)
);
CREATE INDEX IF NOT EXISTS user_deletion_requests_due_idx
  ON user_deletion_requests (scheduled_for)
  WHERE cancelled_at IS NULL;
