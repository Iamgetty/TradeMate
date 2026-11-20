CREATE OR REPLACE FUNCTION trademate_private.begin_totp_enrollment(
  p_user_id UUID,
  p_encrypted_secret TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  account_active BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR p_encrypted_secret IS NULL
     OR pg_catalog.length(p_encrypted_secret) < 16
     OR pg_catalog.length(p_encrypted_secret) > 2048 THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id AND status = 'active' AND email_verified_at IS NOT NULL
  ) INTO account_active;
  IF NOT account_active THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_auth_security (
    user_id, totp_secret_encrypted, totp_enabled, last_totp_counter,
    setup_expires_at, updated_at
  )
  VALUES (
    p_user_id, p_encrypted_secret, false, NULL,
    pg_catalog.now() + INTERVAL '15 minutes', pg_catalog.now()
  )
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
  p_user_id UUID
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
  WHERE s.user_id = p_user_id
    AND u.status = 'active'
    AND u.email_verified_at IS NOT NULL
    AND s.totp_enabled = false
    AND s.totp_secret_encrypted IS NOT NULL
    AND s.setup_expires_at > pg_catalog.now()
  FOR UPDATE OF s
$function$;

CREATE OR REPLACE FUNCTION trademate_private.complete_totp_enrollment(
  p_user_id UUID,
  p_matched_counter BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  updated_user UUID;
BEGIN
  IF p_user_id IS NULL OR p_matched_counter IS NULL OR p_matched_counter < 0 THEN
    RETURN false;
  END IF;

  UPDATE public.user_auth_security
  SET totp_enabled = true,
      last_totp_counter = p_matched_counter,
      totp_confirmed_at = pg_catalog.now(),
      setup_expires_at = NULL,
      updated_at = pg_catalog.now()
  WHERE user_id = p_user_id
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
  p_user_id UUID
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
  WHERE s.user_id = p_user_id
    AND u.status = 'active'
    AND s.totp_enabled = true
    AND s.totp_secret_encrypted IS NOT NULL
  FOR UPDATE OF s
$function$;

CREATE OR REPLACE FUNCTION trademate_private.disable_totp(
  p_user_id UUID,
  p_matched_counter BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  updated_user UUID;
BEGIN
  IF p_user_id IS NULL OR p_matched_counter IS NULL OR p_matched_counter < 0 THEN
    RETURN false;
  END IF;

  UPDATE public.user_auth_security
  SET totp_enabled = false,
      last_totp_counter = p_matched_counter,
      totp_secret_encrypted = NULL,
      totp_confirmed_at = NULL,
      setup_expires_at = NULL,
      updated_at = pg_catalog.now()
  WHERE user_id = p_user_id
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

REVOKE ALL ON FUNCTION trademate_private.begin_totp_enrollment(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION trademate_private.resolve_totp_enrollment(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION trademate_private.complete_totp_enrollment(UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION trademate_private.resolve_enabled_totp(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION trademate_private.disable_totp(UUID, BIGINT) FROM PUBLIC;

COMMENT ON FUNCTION trademate_private.begin_totp_enrollment(UUID, TEXT) IS
  'Starts or replaces an unconfirmed TOTP enrollment for an active verified account; an enabled authenticator cannot be overwritten.';
COMMENT ON FUNCTION trademate_private.resolve_totp_enrollment(UUID) IS
  'Locks and returns unexpired, unconfirmed encrypted TOTP enrollment material for API-side code verification.';
COMMENT ON FUNCTION trademate_private.complete_totp_enrollment(UUID, BIGINT) IS
  'Atomically enables a pending TOTP enrollment using a fresh API-verified counter and writes the security audit event.';
COMMENT ON FUNCTION trademate_private.resolve_enabled_totp(UUID) IS
  'Locks and returns the encrypted authenticator secret and replay counter only for an active account with TOTP enabled.';
COMMENT ON FUNCTION trademate_private.disable_totp(UUID, BIGINT) IS
  'Atomically disables TOTP only when the API supplies a fresh verified counter, clears the secret, and writes the audit event.';
