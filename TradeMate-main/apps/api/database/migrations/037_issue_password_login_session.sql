-- Issue a password-authenticated session only when the password hash verified by
-- the API still matches the locked credential row. Account identity and eligibility
-- are re-derived here; callers cannot mint a session for an arbitrary user.
CREATE OR REPLACE FUNCTION trademate_private.issue_password_login_session(
  p_user_id UUID,
  p_verified_password_hash TEXT,
  p_token_hash TEXT,
  p_expires_at TIMESTAMPTZ,
  p_ip_address TEXT,
  p_user_agent TEXT
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  issued_session_id UUID;
BEGIN
  IF p_user_id IS NULL
     OR p_verified_password_hash IS NULL
     OR pg_catalog.length(p_verified_password_hash) < 20
     OR pg_catalog.length(p_verified_password_hash) > 512
     OR p_token_hash IS NULL
     OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_expires_at IS NULL
     OR p_expires_at <= pg_catalog.now()
     OR p_expires_at > pg_catalog.now() + INTERVAL '8 days'
     OR (p_ip_address IS NOT NULL AND pg_catalog.length(p_ip_address) > 128)
     OR (p_user_agent IS NOT NULL AND pg_catalog.length(p_user_agent) > 500) THEN
    RETURN NULL;
  END IF;

  PERFORM 1
  FROM public.users AS u
  JOIN public.user_credentials AS c ON c.user_id = u.id
  WHERE u.id = p_user_id
    AND u.status = 'active'
    AND u.email_verified_at IS NOT NULL
    AND c.password_hash = p_verified_password_hash
  FOR UPDATE OF u, c;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.user_sessions (
    user_id, token_hash, expires_at, ip_address, user_agent
  )
  VALUES (
    p_user_id, p_token_hash, p_expires_at, p_ip_address, p_user_agent
  )
  RETURNING id INTO issued_session_id;

  INSERT INTO public.user_notifications (
    user_id, category, title, body, icon, action_url
  )
  VALUES (
    p_user_id,
    'System',
    'New sign-in',
    'A sign-in to your TradeMate account was completed. If this was not you, review your active sessions and secure your account.',
    'shield-check',
    '/settings/security'
  );

  INSERT INTO public.audit_events (
    actor_user_id, event_type, entity_type, entity_id, metadata
  )
  VALUES (
    p_user_id, 'auth.login_succeeded', 'user', p_user_id, '{}'::jsonb
  );

  RETURN issued_session_id;
END;
$$;

REVOKE ALL ON FUNCTION trademate_private.issue_password_login_session(
  UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT
) FROM PUBLIC;

COMMENT ON FUNCTION trademate_private.issue_password_login_session(
  UUID, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT
) IS
  'Atomically issues a password-login session only for an active, verified account whose locked credential hash still matches the API-verified hash, and records its notification and audit event.';
