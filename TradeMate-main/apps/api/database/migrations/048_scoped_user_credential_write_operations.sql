-- Scoped, atomic write operations for password credentials.
--
-- Registration and password change previously wrote user_credentials directly
-- through the runtime login. These SECURITY DEFINER operations replace those
-- writes so the runtime role never needs INSERT/UPDATE/DELETE on the table.
-- Callers supply only precomputed digests/hashes; account identity is derived
-- from the new row (registration) or the locked, valid presented session
-- (password change). No caller-supplied user ID is trusted.

CREATE OR REPLACE FUNCTION trademate_private.register_password_account(
  p_email TEXT,
  p_display_name TEXT,
  p_password_hash TEXT,
  p_verification_code_hash TEXT
)
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  normalized_email TEXT;
  normalized_name TEXT;
  new_user_id UUID;
BEGIN
  normalized_email := pg_catalog.lower(pg_catalog.btrim(p_email));
  normalized_name := pg_catalog.btrim(p_display_name);

  IF normalized_email IS NULL
     OR pg_catalog.length(normalized_email) > 254
     OR normalized_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
     OR normalized_name IS NULL
     OR pg_catalog.length(normalized_name) NOT BETWEEN 2 AND 80
     OR p_password_hash IS NULL
     OR pg_catalog.length(p_password_hash) NOT BETWEEN 20 AND 512
     OR p_verification_code_hash IS NULL
     OR p_verification_code_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid registration parameters.' USING ERRCODE = '22023';
  END IF;

  -- A duplicate email raises unique_violation (23505) here; the API maps it
  -- to a conflict response and the whole operation rolls back.
  INSERT INTO public.users (email, display_name, status)
  VALUES (normalized_email, normalized_name, 'pending')
  RETURNING id INTO new_user_id;

  INSERT INTO public.user_credentials (user_id, password_hash)
  VALUES (new_user_id, p_password_hash);

  INSERT INTO public.email_verification_codes (user_id, code_hash, expires_at)
  VALUES (new_user_id, p_verification_code_hash, pg_catalog.now() + INTERVAL '10 minutes');

  INSERT INTO public.audit_events (
    actor_user_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    new_user_id, 'auth.email_verification_requested', 'user', new_user_id, '{}'::jsonb
  );

  RETURN new_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION trademate_private.change_presented_password(
  p_session_token_hash TEXT,
  p_expected_password_hash TEXT,
  p_new_password_hash TEXT
)
RETURNS TABLE(changed_user_id UUID, changed_email TEXT)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  authenticated_user_id UUID;
  authenticated_email TEXT;
  updated_credentials INTEGER;
BEGIN
  IF p_session_token_hash IS NULL OR p_session_token_hash !~ '^[0-9a-f]{64}$'
     OR p_expected_password_hash IS NULL
     OR p_new_password_hash IS NULL
     OR pg_catalog.length(p_new_password_hash) NOT BETWEEN 20 AND 512
     OR p_new_password_hash = p_expected_password_hash THEN
    RETURN;
  END IF;

  SELECT s.user_id, u.email
  INTO authenticated_user_id, authenticated_email
  FROM public.user_sessions AS s
  JOIN public.users AS u ON u.id = s.user_id
  WHERE s.token_hash = p_session_token_hash
    AND s.expires_at > pg_catalog.now()
    AND u.status = 'active'
  FOR UPDATE OF s;

  IF authenticated_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Compare-and-swap: the API verified the current password against
  -- p_expected_password_hash; if the credential changed since (concurrent
  -- change or reset), refuse rather than overwrite it.
  UPDATE public.user_credentials
  SET password_hash = p_new_password_hash,
      updated_at = pg_catalog.now()
  WHERE user_id = authenticated_user_id
    AND password_hash = p_expected_password_hash;

  GET DIAGNOSTICS updated_credentials = ROW_COUNT;
  IF updated_credentials <> 1 THEN
    RETURN;
  END IF;

  PERFORM trademate_private.revoke_other_presented_sessions(p_session_token_hash);

  INSERT INTO public.audit_events (
    actor_user_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    authenticated_user_id, 'auth.password_changed', 'user', authenticated_user_id, '{}'::jsonb
  );

  RETURN QUERY SELECT authenticated_user_id, authenticated_email;
END;
$function$;

REVOKE ALL ON FUNCTION trademate_private.register_password_account(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION trademate_private.change_presented_password(TEXT, TEXT, TEXT) FROM PUBLIC;

-- Grant the reviewed operations when the runtime role already exists; the
-- role bootstrap grants the same EXECUTE privileges on fresh databases.
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'trademate_app') THEN
    GRANT EXECUTE ON FUNCTION trademate_private.register_password_account(TEXT, TEXT, TEXT, TEXT) TO trademate_app;
    GRANT EXECUTE ON FUNCTION trademate_private.change_presented_password(TEXT, TEXT, TEXT) TO trademate_app;
  END IF;
END;
$migration$;

COMMENT ON FUNCTION trademate_private.register_password_account(TEXT, TEXT, TEXT, TEXT) IS
  'Atomically creates a pending account, its password credential, its email-verification code digest and the audit event; raises 23505 for a duplicate email.';
COMMENT ON FUNCTION trademate_private.change_presented_password(TEXT, TEXT, TEXT) IS
  'Atomically replaces the password hash for the active account behind a valid presented session (compare-and-swap on the verified hash), revokes its other sessions and records the audit event.';
