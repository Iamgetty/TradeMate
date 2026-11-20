CREATE OR REPLACE FUNCTION trademate_private.resolve_totp_login_challenge(
  p_challenge_hash TEXT
)
RETURNS TABLE (
  challenge_user_id UUID,
  challenge_attempts INTEGER,
  challenge_email TEXT,
  challenge_display_name TEXT,
  challenge_country_code TEXT,
  encrypted_totp_secret TEXT,
  last_totp_counter BIGINT
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF p_challenge_hash IS NULL OR p_challenge_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    c.attempts,
    u.email,
    u.display_name,
    u.country_code::TEXT,
    s.totp_secret_encrypted,
    s.last_totp_counter
  FROM public.auth_login_challenges AS c
  JOIN public.users AS u
    ON u.id = c.user_id
   AND u.status = 'active'
   AND u.email_verified_at IS NOT NULL
  JOIN public.user_auth_security AS s
    ON s.user_id = u.id
   AND s.totp_enabled = true
   AND s.totp_secret_encrypted IS NOT NULL
  WHERE c.token_hash = p_challenge_hash
    AND c.expires_at > pg_catalog.now()
    AND c.consumed_at IS NULL
    AND c.attempts < 5
  FOR UPDATE OF c, u, s;
END;
$function$;

CREATE OR REPLACE FUNCTION trademate_private.record_totp_login_failure(
  p_challenge_hash TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  updated_attempts INTEGER;
BEGIN
  IF p_challenge_hash IS NULL OR p_challenge_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN 0;
  END IF;

  UPDATE public.auth_login_challenges
  SET attempts = attempts + 1
  WHERE token_hash = p_challenge_hash
    AND expires_at > pg_catalog.now()
    AND consumed_at IS NULL
    AND attempts < 5
  RETURNING attempts INTO updated_attempts;

  RETURN COALESCE(updated_attempts, 0);
END;
$function$;

REVOKE ALL ON FUNCTION trademate_private.resolve_totp_login_challenge(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION trademate_private.record_totp_login_failure(TEXT) FROM PUBLIC;

COMMENT ON FUNCTION trademate_private.resolve_totp_login_challenge(TEXT) IS
  'Locks a valid second-factor challenge and its active account security record, returning only the encrypted TOTP material required for API-side cryptographic verification.';

COMMENT ON FUNCTION trademate_private.record_totp_login_failure(TEXT) IS
  'Atomically increments a valid unconsumed second-factor challenge attempt count, capped at five.';
