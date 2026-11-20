-- The runtime role may create and revoke sessions, but must not read bearer-token digests.
-- Session lookup and metadata are mediated by fixed-search-path SECURITY DEFINER operations.
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'trademate_app') THEN
    REVOKE SELECT ON TABLE public.user_sessions FROM trademate_app;
    GRANT SELECT (user_id) ON TABLE public.user_sessions TO trademate_app;
  END IF;
END;
$migration$;
