CREATE OR REPLACE FUNCTION trademate_private.resolve_password_login_credentials(p_email TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  country_code TEXT,
  account_status TEXT,
  email_verified_at TIMESTAMPTZ,
  password_hash TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT u.id, u.email, u.display_name, u.country_code::TEXT, u.status,
         u.email_verified_at, c.password_hash
  FROM public.users AS u
  JOIN public.user_credentials AS c ON c.user_id = u.id
  WHERE p_email IS NOT NULL
    AND pg_catalog.length(p_email) BETWEEN 3 AND 254
    AND pg_catalog.lower(u.email) = pg_catalog.lower(pg_catalog.btrim(p_email))
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION trademate_private.resolve_presented_password_credentials(p_session_token_hash TEXT)
RETURNS TABLE (user_id UUID, email TEXT, password_hash TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT u.id, u.email, c.password_hash
  FROM trademate_private.resolve_presented_session(p_session_token_hash) AS s
  JOIN public.users AS u ON u.id = s.resolved_user_id AND u.status = 'active'
  JOIN public.user_credentials AS c ON c.user_id = u.id
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION trademate_private.resolve_password_login_credentials(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION trademate_private.resolve_presented_password_credentials(TEXT) FROM PUBLIC;

-- Runtime callers must use the narrowly scoped credential resolvers.
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'trademate_app') THEN
    REVOKE SELECT ON TABLE public.user_credentials FROM trademate_app;
    GRANT SELECT (user_id) ON TABLE public.user_credentials TO trademate_app;
  END IF;
END;
$migration$;

COMMENT ON FUNCTION trademate_private.resolve_password_login_credentials(TEXT) IS
  'Returns the password verifier and minimal account fields for one email lookup used by the rate-limited password-login flow.';
COMMENT ON FUNCTION trademate_private.resolve_presented_password_credentials(TEXT) IS
  'Returns the password verifier only for the active account resolved from a presented valid session digest.';
