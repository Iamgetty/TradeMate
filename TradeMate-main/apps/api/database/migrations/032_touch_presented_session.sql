-- Narrow session-activity mutation for a presented session only.
-- This does not grant session enumeration or expose credential material.
CREATE OR REPLACE FUNCTION trademate_private.touch_presented_session(p_token_hash TEXT)
RETURNS TABLE (touched_user_id UUID)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  UPDATE public.user_sessions AS s
  SET last_seen_at = statement_timestamp()
  FROM public.users AS u
  WHERE p_token_hash ~ '^[0-9a-f]{64}$'
    AND s.token_hash = p_token_hash
    AND s.user_id = u.id
    AND s.expires_at > statement_timestamp()
    AND u.status = 'active'
  RETURNING s.user_id
$function$;

REVOKE ALL ON FUNCTION trademate_private.touch_presented_session(TEXT) FROM PUBLIC;

COMMENT ON FUNCTION trademate_private.touch_presented_session(TEXT) IS
  'Updates activity for one unexpired session identified by its presented SHA-256 digest; returns only its user ID and never returns token material.';
