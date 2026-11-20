-- Narrow, non-enumerating presented-session resolver.
-- The runtime role receives EXECUTE only; it must not read token_hash directly.
-- This is an incremental primitive. It does not enable RLS or establish a
-- trusted app.user_id context by itself.
CREATE SCHEMA IF NOT EXISTS trademate_private;
REVOKE ALL ON SCHEMA trademate_private FROM PUBLIC;
GRANT USAGE ON SCHEMA trademate_private TO trademate_app;

CREATE OR REPLACE FUNCTION trademate_private.resolve_presented_session(p_token_hash TEXT)
RETURNS TABLE (resolved_user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT s.user_id
  FROM public.user_sessions AS s
  INNER JOIN public.users AS u ON u.id = s.user_id
  WHERE p_token_hash ~ '^[0-9a-f]{64}$'
    AND s.token_hash = p_token_hash
    AND s.expires_at > statement_timestamp()
    AND u.status = 'active'
  LIMIT 1
$function$;

REVOKE ALL ON FUNCTION trademate_private.resolve_presented_session(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION trademate_private.resolve_presented_session(TEXT) TO trademate_app;

COMMENT ON FUNCTION trademate_private.resolve_presented_session(TEXT) IS
  'Resolves one presented SHA-256 session-token digest to an active user ID; never returns token material. Runtime callers must not have direct token_hash access.';
