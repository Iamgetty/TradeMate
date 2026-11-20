CREATE OR REPLACE FUNCTION trademate_private.begin_totp_enrollment(
  p_session_token_hash TEXT,
  p_encrypted_secret TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  authenticated_user_id UUID;
BEGIN
  IF p_session_token_hash IS NULL OR p_session_token_hash !~ '^[0-9a-f]{64}$'
     OR p_encrypted_secret IS NULL
     OR pg_catalog.length(p_encrypted_secret) < 16
     OR pg_catalog.length(p_encrypted_secret) > 2048 THEN
    RETURN false;
  END IF;

  SELECT resolved_user_id INTO authenticated_user_id
  FROM trademate_private.resolve_presented_session(p_session_token_hash);
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_auth_security (
    user_id, totp_secret_encrypted, totp_enabled, last_totp_counter,
    setup_expires_at, updated_at
  )
  SELECT u.id, p_encrypted_secret, false, NULL,
         pg_catalog.now() + INTERVAL '15 minutes', pg_catalog.now()
  FROM public.users AS u
  WHERE u.id = authenticated_user_id
    AND u.status = 'active'
    AND u.email_verified_at IS NOT NULL
  ON CONFLICT (user_id) DO UPDATE
  SET totp_secret_encrypted = EXCLUDED.totp_secret_encrypted,
      last_totp_counter = NULL,
      setup_expires_at = EXCLUDED.setup_expires_at,
      updated_at = pg_catalog.now()
  WHERE public.user_auth_security.totp_enabled = false;

  RETURN FOUND;
END;
$function$;

CREATE OR REPLACE FUNCTION trademate_private.resolve_totp_enrollment(
  p_session_token_hash TEXT
)
RETURNS TABLE (
  encrypted_totp_secret TEXT,
  enrollment_expires_at TIMESTAMPTZ,
  last_totp_counter BIGINT
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT s.totp_secret_encrypted, s.setup_expires_at, s.last_totp_counter
  FROM public.user_auth_security AS s
  JOIN public.users AS u ON u.id = s.user_id
  JOIN trademate_private.resolve_presented_session(p_session_token_hash) AS session
    ON session.resolved_user_id = s.user_id
  WHERE p_session_token_hash ~ '^[0-9a-f]{64}$'
    AND u.status = 'active'
    AND u.email_verified_at IS NOT NULL
    AND s.totp_enabled = false
    AND s.totp_secret_encrypted IS NOT NULL
    AND s.setup_expires_at > pg_catalog.now()
  FOR UPDATE OF s
$function$;

CREATE OR REPLACE FUNCTION trademate_private.complete_totp_enrollment(
  p_session_token_hash TEXT,
  p_matched_counter BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  authenticated_user_id UUID;
  updated_user UUID;
BEGIN
  IF p_session_token_hash IS NULL OR p_session_token_hash !~ '^[0-9a-f]{64}$'
     OR p_matched_counter IS NULL OR p_matched_counter < 0 THEN
    RETURN false;
  END IF;

  SELECT resolved_user_id INTO authenticated_user_id
  FROM trademate_private.resolve_presented_session(p_session_token_hash);
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.user_auth_security
  SET totp_enabled = true,
      last_totp_counter = p_matched_counter,
      totp_confirmed_at = pg_catalog.now(),
      setup_expires_at = NULL,
      updated_at = pg_catalog.now()
  WHERE user_id = authenticated_user_id
    AND totp_enabled = false
    AND totp_secret_encrypted IS NOT NULL
    AND setup_expires_at > pg_catalog.now()
    AND (last_totp_counter IS NULL OR last_totp_counter < p_matched_counter)
  RETURNING user_id INTO updated_user;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  VALUES (updated_user, 'auth.totp_enabled', 'user', updated_user, '{}'::jsonb);

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION trademate_private.resolve_enabled_totp(
  p_session_token_hash TEXT
)
RETURNS TABLE (
  encrypted_totp_secret TEXT,
  last_totp_counter BIGINT
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  SELECT s.totp_secret_encrypted, s.last_totp_counter
  FROM public.user_auth_security AS s
  JOIN public.users AS u ON u.id = s.user_id
  JOIN trademate_private.resolve_presented_session(p_session_token_hash) AS session
    ON session.resolved_user_id = s.user_id
  WHERE p_session_token_hash ~ '^[0-9a-f]{64}$'
    AND u.status = 'active'
    AND s.totp_enabled = true
    AND s.totp_secret_encrypted IS NOT NULL
  FOR UPDATE OF s
$function$;

CREATE OR REPLACE FUNCTION trademate_private.disable_totp(
  p_session_token_hash TEXT,
  p_matched_counter BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  authenticated_user_id UUID;
  updated_user UUID;
BEGIN
  IF p_session_token_hash IS NULL OR p_session_token_hash !~ '^[0-9a-f]{64}$'
     OR p_matched_counter IS NULL OR p_matched_counter < 0 THEN
    RETURN false;
  END IF;

  SELECT resolved_user_id INTO authenticated_user_id
  FROM trademate_private.resolve_presented_session(p_session_token_hash);
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.user_auth_security
  SET totp_enabled = false,
      last_totp_counter = p_matched_counter,
      totp_secret_encrypted = NULL,
      totp_confirmed_at = NULL,
      setup_expires_at = NULL,
      updated_at = pg_catalog.now()
  WHERE user_id = authenticated_user_id
    AND totp_enabled = true
    AND (last_totp_counter IS NULL OR last_totp_counter < p_matched_counter)
  RETURNING user_id INTO updated_user;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  VALUES (updated_user, 'auth.totp_disabled', 'user', updated_user, '{}'::jsonb);

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION trademate_private.begin_totp_enrollment(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION trademate_private.resolve_totp_enrollment(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION trademate_private.complete_totp_enrollment(TEXT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION trademate_private.resolve_enabled_totp(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION trademate_private.disable_totp(TEXT, BIGINT) FROM PUBLIC;

COMMENT ON FUNCTION trademate_private.begin_totp_enrollment(TEXT, TEXT) IS
  'Starts or replaces an unconfirmed TOTP enrollment only for the account resolved from a presented active session digest; an enabled authenticator cannot be overwritten.';
COMMENT ON FUNCTION trademate_private.resolve_totp_enrollment(TEXT) IS
  'Locks and returns unexpired, unconfirmed encrypted TOTP enrollment material only for the account authenticated by the presented session digest.';
COMMENT ON FUNCTION trademate_private.complete_totp_enrollment(TEXT, BIGINT) IS
  'Atomically enables a pending TOTP enrollment for the account authenticated by the presented session, using a fresh API-verified counter and recording an audit event.';
COMMENT ON FUNCTION trademate_private.resolve_enabled_totp(TEXT) IS
  'Locks and returns encrypted authenticator material only for the account authenticated by the presented active session digest.';
COMMENT ON FUNCTION trademate_private.disable_totp(TEXT, BIGINT) IS
  'Atomically disables TOTP only for the account authenticated by the presented session, clears the secret, and records the audit event.';
