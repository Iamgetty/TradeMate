-- Store limited session context for account security review.
ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

COMMENT ON COLUMN user_sessions.ip_address IS 'IP address observed when this session was created; may be affected by trusted proxy configuration.';
COMMENT ON COLUMN user_sessions.user_agent IS 'User-Agent header observed when this session was created; client supplied and not verified.';
