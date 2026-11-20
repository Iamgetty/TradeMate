CREATE OR REPLACE FUNCTION trademate_private.current_presented_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT s.resolved_user_id
  FROM trademate_private.resolve_presented_session(
    NULLIF(pg_catalog.current_setting('app.session_token_hash', true), '')
  ) AS s
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION trademate_private.current_presented_user_id() FROM PUBLIC;

COMMENT ON FUNCTION trademate_private.current_presented_user_id() IS
  'Returns the user bound to the presented opaque session digest for RLS policies; never trusts caller-set app.user_id.';
