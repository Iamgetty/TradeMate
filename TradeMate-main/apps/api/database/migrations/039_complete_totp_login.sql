CREATE OR REPLACE FUNCTION trademate_private.complete_totp_login(
  p_challenge_hash TEXT,
  p_matched_counter BIGINT,
  p_session_token_hash TEXT,
  p_session_expires_at TIMESTAMPTZ,
  p_ip_address TEXT,
  p_user_agent TEXT
)
RETURNS TABLE (
  verified_user_id UUID,
  verified_email TEXT,
  verified_display_name TEXT,
  verified_country_code TEXT
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  challenge public.auth_login_challenges%ROWTYPE;
  account public.users%ROWTYPE;
  security_state public.user_auth_security%ROWTYPE;
BEGIN
  IF p_challenge_hash IS NULL
     OR p_challenge_hash !~ '^[0-9a-f]{64}$'
     OR p_matched_counter IS NULL
     OR p_matched_counter < 0
     OR p_session_token_hash IS NULL
     OR p_session_token_hash !~ '^[0-9a-f]{64}$'
     OR p_session_expires_at IS NULL
     OR p_session_expires_at <= pg_catalog.now()
     OR p_session_expires_at > pg_catalog.now() + INTERVAL '8 days'
     OR (p_ip_address IS NOT NULL AND pg_catalog.length(p_ip_address) > 128)
     OR (p_user_agent IS NOT NULL AND pg_catalog.length(p_user_agent) > 500) THEN
    RETURN;
  END IF;

  SELECT c.*
  INTO challenge
  FROM public.auth_login_challenges AS c
  WHERE c.token_hash = p_challenge_hash
    AND c.expires_at > pg_catalog.now()
    AND c.consumed_at IS NULL
    AND c.attempts < 5
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT u.*
  INTO account
  FROM public.users AS u
  WHERE u.id = challenge.user_id
    AND u.status = 'active'
    AND u.email_verified_at IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT s.*
  INTO security_state
  FROM public.user_auth_security AS s
  WHERE s.user_id = account.id
    AND s.totp_enabled = true
  FOR UPDATE;

  IF NOT FOUND
     OR (security_state.last_totp_counter IS NOT NULL
         AND security_state.last_totp_counter >= p_matched_counter) THEN
    RETURN;
  END IF;

  UPDATE public.user_auth_security
  SET last_totp_counter = p_matched_counter,
      updated_at = pg_catalog.now()
  WHERE user_id = account.id
    AND totp_enabled = true
    AND (last_totp_counter IS NULL OR last_totp_counter < p_matched_counter);

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.auth_login_challenges
  SET consumed_at = pg_catalog.now()
  WHERE id = challenge.id
    AND consumed_at IS NULL
    AND attempts < 5;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Two-factor challenge was consumed concurrently.';
  END IF;

  INSERT INTO public.user_sessions (
    user_id, token_hash, expires_at, ip_address, user_agent
  )
  VALUES (
    account.id, p_session_token_hash, p_session_expires_at, p_ip_address, p_user_agent
  );

  INSERT INTO public.user_notifications (
    user_id, category, title, body, icon, action_url
  )
  VALUES (
    account.id,
    'System',
    'New sign-in',
    'A sign-in to your TradeMate account was completed. If this was not you, review your active sessions and secure your account.',
    'shield-check',
    '/settings/security'
  );

  INSERT INTO public.audit_events (
    actor_user_id, event_type, entity_type, entity_id, metadata
  )
  VALUES (
    account.id, 'auth.login_succeeded', 'user', account.id, '{}'::jsonb
  );

  RETURN QUERY
  SELECT account.id, account.email, account.display_name, account.country_code::TEXT;
END;
$function$;

REVOKE ALL ON FUNCTION trademate_private.complete_totp_login(
  TEXT, BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT
) FROM PUBLIC;

COMMENT ON FUNCTION trademate_private.complete_totp_login(
  TEXT, BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT
) IS
  'Consumes a verified TOTP challenge and monotonic counter, creates the session, and records notification and audit entries atomically. The API remains responsible for decrypting and cryptographically verifying the submitted TOTP code.';
