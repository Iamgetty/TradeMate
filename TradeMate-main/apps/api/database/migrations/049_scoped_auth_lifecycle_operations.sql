-- Scoped, atomic issuance of verification/reset tokens and account deletion requests.
-- Raw tokens and codes remain in the API process and are never stored in PostgreSQL.

CREATE OR REPLACE FUNCTION trademate_private.resend_email_verification_code(
  p_email TEXT,
  p_code_hash TEXT
)
RETURNS TABLE(delivery_email TEXT)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  target_user_id UUID;
  target_email TEXT;
BEGIN
  IF p_email IS NULL OR pg_catalog.length(p_email) > 254
     OR p_code_hash IS NULL OR p_code_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid verification request.' USING ERRCODE = '22023';
  END IF;

  SELECT u.id, u.email INTO target_user_id, target_email
  FROM public.users AS u
  WHERE pg_catalog.lower(u.email) = pg_catalog.lower(pg_catalog.btrim(p_email))
    AND u.email_verified_at IS NULL
    AND u.status = 'pending'
  FOR UPDATE OF u;

  IF target_user_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.email_verification_codes WHERE user_id = target_user_id;
  INSERT INTO public.email_verification_codes (user_id, code_hash, expires_at)
  VALUES (target_user_id, p_code_hash, pg_catalog.now() + INTERVAL '10 minutes');

  INSERT INTO public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  VALUES (target_user_id, 'auth.email_verification_requested', 'user', target_user_id, '{}'::jsonb);

  RETURN QUERY SELECT target_email;
END;
$function$;

CREATE OR REPLACE FUNCTION trademate_private.issue_password_reset(
  p_email TEXT,
  p_token_hash TEXT
)
RETURNS TABLE(delivery_email TEXT)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  target_user_id UUID;
  target_email TEXT;
BEGIN
  IF p_email IS NULL OR pg_catalog.length(p_email) > 254
     OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid password-reset request.' USING ERRCODE = '22023';
  END IF;

  SELECT u.id, u.email INTO target_user_id, target_email
  FROM public.users AS u
  WHERE pg_catalog.lower(u.email) = pg_catalog.lower(pg_catalog.btrim(p_email))
    AND u.status = 'active'
  FOR UPDATE OF u;

  IF target_user_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.password_reset_tokens WHERE user_id = target_user_id;
  INSERT INTO public.password_reset_tokens (user_id, token_hash, expires_at)
  VALUES (target_user_id, p_token_hash, pg_catalog.now() + INTERVAL '30 minutes');

  INSERT INTO public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  VALUES (target_user_id, 'auth.password_reset_requested', 'user', target_user_id, '{}'::jsonb);

  RETURN QUERY SELECT target_email;
END;
$function$;

CREATE OR REPLACE FUNCTION trademate_private.request_presented_account_deletion(
  p_session_token_hash TEXT,
  p_expected_password_hash TEXT,
  p_cancellation_token_hash TEXT
)
RETURNS TABLE(delivery_email TEXT)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  target_user_id UUID;
  target_email TEXT;
  current_password_hash TEXT;
BEGIN
  IF p_session_token_hash IS NULL OR p_session_token_hash !~ '^[0-9a-f]{64}$'
     OR p_expected_password_hash IS NULL
     OR p_cancellation_token_hash IS NULL OR p_cancellation_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN;
  END IF;

  SELECT u.id, u.email, c.password_hash
    INTO target_user_id, target_email, current_password_hash
  FROM public.user_sessions AS s
  JOIN public.users AS u ON u.id = s.user_id
  JOIN public.user_credentials AS c ON c.user_id = u.id
  WHERE s.token_hash = p_session_token_hash
    AND s.expires_at > pg_catalog.now()
    AND u.status = 'active'
  FOR UPDATE OF s, u, c;

  IF target_user_id IS NULL OR current_password_hash <> p_expected_password_hash
     OR target_email IS NULL OR pg_catalog.btrim(target_email) = '' THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = target_user_id AND member_role = 'owner'
  ) THEN
    RETURN;
  END IF;

  UPDATE public.users
  SET status = 'deletion_pending', updated_at = pg_catalog.now()
  WHERE id = target_user_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.user_deletion_requests
    (user_id, cancellation_token_hash, requested_at, scheduled_for)
  VALUES
    (target_user_id, p_cancellation_token_hash, pg_catalog.now(), pg_catalog.now() + INTERVAL '30 days')
  ON CONFLICT (user_id) DO UPDATE
    SET cancellation_token_hash = EXCLUDED.cancellation_token_hash,
        requested_at = pg_catalog.now(),
        scheduled_for = pg_catalog.now() + INTERVAL '30 days',
        cancelled_at = NULL;

  DELETE FROM public.user_sessions WHERE user_id = target_user_id;

  INSERT INTO public.audit_events (actor_user_id, event_type, entity_type, entity_id, metadata)
  VALUES (
    target_user_id, 'account.deletion_requested', 'user', target_user_id,
    '{"grace_period_days":30}'::jsonb
  );

  RETURN QUERY SELECT target_email;
END;
$function$;

REVOKE ALL ON FUNCTION trademate_private.resend_email_verification_code(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION trademate_private.issue_password_reset(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION trademate_private.request_presented_account_deletion(TEXT, TEXT, TEXT) FROM PUBLIC;

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'trademate_app') THEN
    GRANT EXECUTE ON FUNCTION trademate_private.resend_email_verification_code(TEXT, TEXT) TO trademate_app;
    GRANT EXECUTE ON FUNCTION trademate_private.issue_password_reset(TEXT, TEXT) TO trademate_app;
    GRANT EXECUTE ON FUNCTION trademate_private.request_presented_account_deletion(TEXT, TEXT, TEXT) TO trademate_app;
  END IF;
END;
$migration$;

COMMENT ON FUNCTION trademate_private.resend_email_verification_code(TEXT, TEXT) IS
  'Replaces a pending account email-verification digest and appends its audit event atomically; returns only the delivery email.';
COMMENT ON FUNCTION trademate_private.issue_password_reset(TEXT, TEXT) IS
  'Replaces an active account password-reset digest and appends its audit event atomically; returns only the delivery email.';
COMMENT ON FUNCTION trademate_private.request_presented_account_deletion(TEXT, TEXT, TEXT) IS
  'Schedules deletion only for the active account bound to a valid presented session and unchanged verified password hash; revokes sessions and audits atomically.';
