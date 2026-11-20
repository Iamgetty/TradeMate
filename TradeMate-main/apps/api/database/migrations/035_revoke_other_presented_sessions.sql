-- Revoke every other session for the account authenticated by the presented session.
-- The current session is locked and retained; no caller-supplied user ID is trusted.
CREATE OR REPLACE FUNCTION trademate_private.revoke_other_presented_sessions(
  p_token_hash TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  authenticated_user_id UUID;
  revoked_count INTEGER;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN 0;
  END IF;

  SELECT s.user_id
  INTO authenticated_user_id
  FROM public.user_sessions AS s
  JOIN public.users AS u ON u.id = s.user_id
  WHERE s.token_hash = p_token_hash
    AND s.expires_at > pg_catalog.now()
    AND u.status = 'active'
  FOR UPDATE OF s;

  IF authenticated_user_id IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM public.user_sessions AS s
  WHERE s.user_id = authenticated_user_id
    AND s.token_hash <> p_token_hash;

  GET DIAGNOSTICS revoked_count = ROW_COUNT;

  IF revoked_count > 0 THEN
    INSERT INTO public.audit_events (
      actor_user_id,
      event_type,
      entity_type,
      entity_id,
      metadata
    )
    VALUES (
      authenticated_user_id,
      'auth.sessions_revoked',
      'user',
      authenticated_user_id,
      pg_catalog.jsonb_build_object(
        'reason', 'password_changed',
        'revoked_count', revoked_count
      )
    );
  END IF;

  RETURN revoked_count;
END;
$$;

REVOKE ALL ON FUNCTION trademate_private.revoke_other_presented_sessions(TEXT) FROM PUBLIC;

COMMENT ON FUNCTION trademate_private.revoke_other_presented_sessions(TEXT) IS
  'Atomically revokes all sessions except the valid presented session for its active account and records the security event.';
