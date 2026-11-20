CREATE OR REPLACE FUNCTION trademate_private.issue_totp_login_challenge(
  p_user_id UUID,
  p_challenge_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF p_user_id IS NULL
     OR p_challenge_hash IS NULL
     OR p_challenge_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;

  -- Only issue a challenge for an active, verified account with TOTP enabled.
  -- The raw challenge token is never stored or returned by this function.
  INSERT INTO public.auth_login_challenges (user_id, token_hash, expires_at)
  SELECT u.id, p_challenge_hash, pg_catalog.now() + INTERVAL '5 minutes'
  FROM public.users AS u
  JOIN public.user_auth_security AS s ON s.user_id = u.id
  WHERE u.id = p_user_id
    AND u.status = 'active'
    AND u.email_verified_at IS NOT NULL
    AND s.totp_enabled = true
    AND s.totp_secret_encrypted IS NOT NULL;

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION trademate_private.issue_totp_login_challenge(UUID, TEXT) FROM PUBLIC;

COMMENT ON FUNCTION trademate_private.issue_totp_login_challenge(UUID, TEXT) IS
  'Issues a short-lived TOTP login challenge only for an active, verified account with TOTP enabled; stores only the challenge digest.';

-- Challenge rows are now created only by the scoped SECURITY DEFINER operation.
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'trademate_app') THEN
    REVOKE INSERT, UPDATE, DELETE ON TABLE public.auth_login_challenges FROM trademate_app;
  END IF;
END;
$migration$;
