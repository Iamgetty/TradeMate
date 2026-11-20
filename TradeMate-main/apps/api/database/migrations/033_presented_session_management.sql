-- Session management is scoped to the authenticated session presented by the caller.
-- Enumeration never returns credential digests; revocation and its audit event are atomic.
CREATE OR REPLACE FUNCTION trademate_private.list_presented_user_sessions(p_token_hash TEXT)
RETURNS TABLE (
  session_id UUID,
  created_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  is_current BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT s.id, s.created_at, s.last_seen_at, s.expires_at,
         s.ip_address, s.user_agent, s.token_hash = p_token_hash
  FROM public.user_sessions AS presented
  JOIN public.users AS u ON u.id = presented.user_id
  JOIN public.user_sessions AS s ON s.user_id = presented.user_id
  WHERE p_token_hash ~ '^[0-9a-f]{64}$'
    AND presented.token_hash = p_token_hash
    AND presented.expires_at > statement_timestamp()
    AND u.status = 'active'
    AND s.expires_at > statement_timestamp()
  ORDER BY (s.token_hash = p_token_hash) DESC, s.last_seen_at DESC
  LIMIT 50
$function$;

CREATE OR REPLACE FUNCTION trademate_private.revoke_presented_user_session(
  p_token_hash TEXT,
  p_target_session_id UUID
)
RETURNS TABLE (
  revoked_session_id UUID,
  revoked_user_id UUID,
  was_current BOOLEAN
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  authenticated_user_id UUID;
  deleted_session_id UUID;
  deleted_was_current BOOLEAN;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' OR p_target_session_id IS NULL THEN
    RETURN;
  END IF;

  SELECT s.user_id
    INTO authenticated_user_id
  FROM public.user_sessions AS s
  JOIN public.users AS u ON u.id = s.user_id
  WHERE s.token_hash = p_token_hash
    AND s.expires_at > statement_timestamp()
    AND u.status = 'active'
  FOR UPDATE OF s;

  IF authenticated_user_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.user_sessions AS s
  WHERE s.id = p_target_session_id
    AND s.user_id = authenticated_user_id
  RETURNING s.id, s.token_hash = p_token_hash
    INTO deleted_session_id, deleted_was_current;

  IF deleted_session_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_events (
    actor_user_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    authenticated_user_id,
    'auth.session_revoked',
    'user_session',
    deleted_session_id,
    jsonb_build_object('current', deleted_was_current)
  );

  RETURN QUERY SELECT deleted_session_id, authenticated_user_id, deleted_was_current;
END;
$function$;

REVOKE ALL ON FUNCTION trademate_private.list_presented_user_sessions(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION trademate_private.revoke_presented_user_session(TEXT, UUID) FROM PUBLIC;

COMMENT ON FUNCTION trademate_private.list_presented_user_sessions(TEXT) IS
  'Lists non-secret metadata for at most 50 active sessions belonging to the user authenticated by the presented session digest.';
COMMENT ON FUNCTION trademate_private.revoke_presented_user_session(TEXT, UUID) IS
  'Revokes only a target session owned by the user authenticated by the presented session digest and appends the audit event atomically.';
