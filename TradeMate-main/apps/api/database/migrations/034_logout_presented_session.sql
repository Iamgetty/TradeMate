-- Logout accepts only the digest of a live, active session and records the
-- revocation in the same transaction. The raw bearer token never reaches SQL.
CREATE OR REPLACE FUNCTION trademate_private.logout_presented_session(p_token_hash TEXT)
RETURNS TABLE (logged_out_user_id UUID)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  authenticated_user_id UUID;
  deleted_user_id UUID;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
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
  WHERE s.token_hash = p_token_hash
    AND s.user_id = authenticated_user_id
  RETURNING s.user_id INTO deleted_user_id;

  IF deleted_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_events (
    actor_user_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    authenticated_user_id,
    'auth.logout',
    'user',
    authenticated_user_id,
    '{}'::jsonb
  );

  RETURN QUERY SELECT deleted_user_id;
END;
$function$;

REVOKE ALL ON FUNCTION trademate_private.logout_presented_session(TEXT) FROM PUBLIC;

COMMENT ON FUNCTION trademate_private.logout_presented_session(TEXT) IS
  'Deletes only the active session identified by the presented SHA-256 digest and appends its logout audit event atomically.';
