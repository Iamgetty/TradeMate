-- Complete email verification and issue the first session as one
-- database-controlled operation. The caller supplies only the normalized
-- email, a digest of the submitted code, and a digest of the new session token.
CREATE OR REPLACE FUNCTION trademate_private.complete_email_verification(
  p_email TEXT,
  p_code_hash TEXT,
  p_token_hash TEXT,
  p_expires_at TIMESTAMPTZ,
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
AS $$
DECLARE
  target_user public.users%ROWTYPE;
  verification public.email_verification_codes%ROWTYPE;
BEGIN
  IF p_email IS NULL
     OR p_email <> pg_catalog.lower(pg_catalog.btrim(p_email))
     OR pg_catalog.length(p_email) = 0
     OR pg_catalog.length(p_email) > 254
     OR p_code_hash IS NULL
     OR p_code_hash !~ '^[0-9a-f]{64}$'
     OR p_token_hash IS NULL
     OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_expires_at IS NULL
     OR p_expires_at <= pg_catalog.now()
     OR p_expires_at > pg_catalog.now() + INTERVAL '8 days'
     OR (p_ip_address IS NOT NULL AND pg_catalog.length(p_ip_address) > 128)
     OR (p_user_agent IS NOT NULL AND pg_catalog.length(p_user_agent) > 500) THEN
    RETURN;
  END IF;

  SELECT u.*
  INTO target_user
  FROM public.users AS u
  WHERE pg_catalog.lower(u.email) = p_email
    AND u.email_verified_at IS NULL
    AND u.status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT ev.*
  INTO verification
  FROM public.email_verification_codes AS ev
  WHERE ev.user_id = target_user.id
    AND ev.used_at IS NULL
  ORDER BY ev.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND
     OR verification.expires_at <= pg_catalog.now()
     OR verification.attempts >= 5 THEN
    RETURN;
  END IF;

  IF verification.code_hash <> p_code_hash THEN
    UPDATE public.email_verification_codes
    SET attempts = attempts + 1
    WHERE id = verification.id
      AND attempts < 5;
    RETURN;
  END IF;

  UPDATE public.users
  SET email_verified_at = pg_catalog.now(),
      status = 'active',
      updated_at = pg_catalog.now()
  WHERE id = target_user.id
    AND email_verified_at IS NULL
    AND status = 'pending'
  RETURNING * INTO target_user;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.email_verification_codes
  SET used_at = pg_catalog.now()
  WHERE id = verification.id
    AND used_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Email verification code was consumed concurrently.';
  END IF;

  INSERT INTO public.user_sessions (
    user_id, token_hash, expires_at, ip_address, user_agent
  )
  VALUES (
    target_user.id, p_token_hash, p_expires_at, p_ip_address, p_user_agent
  );

  INSERT INTO public.audit_events (
    actor_user_id, event_type, entity_type, entity_id, metadata
  )
  VALUES (
    target_user.id, 'auth.email_verified', 'user', target_user.id, '{}'::jsonb
  );

  RETURN QUERY
  SELECT target_user.id, target_user.email,
         target_user.display_name, target_user.country_code;
END;
$$;

REVOKE ALL ON FUNCTION trademate_private.complete_email_verification(
  TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT
) FROM PUBLIC;

COMMENT ON FUNCTION trademate_private.complete_email_verification(
  TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT
) IS
  'Consumes a pending account email-verification code, activates that account, creates its first session, and records the audit event atomically. The caller cannot choose a user identifier.';
