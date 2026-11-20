CREATE OR REPLACE FUNCTION trademate_private.discard_password_reset_token(p_token_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  removed_count INTEGER;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;

  DELETE FROM public.password_reset_tokens
  WHERE token_hash = p_token_hash;
  GET DIAGNOSTICS removed_count = ROW_COUNT;
  RETURN removed_count = 1;
END;
$function$;

CREATE OR REPLACE FUNCTION trademate_private.rollback_account_deletion_request(p_token_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  target_user_id UUID;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;

  SELECT d.user_id INTO target_user_id
  FROM public.user_deletion_requests AS d
  JOIN public.users AS u ON u.id = d.user_id
  WHERE d.cancellation_token_hash = p_token_hash
    AND d.cancelled_at IS NULL
    AND u.status = 'deletion_pending'
  FOR UPDATE OF d, u;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.users
  SET status = 'active', updated_at = pg_catalog.now()
  WHERE id = target_user_id AND status = 'deletion_pending';
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.user_deletion_requests
  SET cancellation_token_hash = NULL, cancelled_at = pg_catalog.now()
  WHERE user_id = target_user_id
    AND cancellation_token_hash = p_token_hash
    AND cancelled_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account deletion rollback state changed unexpectedly';
  END IF;

  INSERT INTO public.audit_events (
    actor_user_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    target_user_id, 'account.deletion_request_rolled_back', 'user', target_user_id,
    '{"reason":"notification_delivery_failed"}'::jsonb
  );

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION trademate_private.discard_password_reset_token(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION trademate_private.rollback_account_deletion_request(TEXT) FROM PUBLIC;

-- Credential-bearing columns are not readable by the general API login.
-- Keep only the non-secret predicates and status fields used by ordinary routes.
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'trademate_app') THEN
    REVOKE SELECT ON TABLE public.user_auth_security FROM trademate_app;
    GRANT SELECT (user_id, totp_enabled, totp_confirmed_at)
      ON TABLE public.user_auth_security TO trademate_app;

    REVOKE SELECT ON TABLE public.auth_login_challenges FROM trademate_app;

    REVOKE SELECT ON TABLE public.password_reset_tokens FROM trademate_app;
    GRANT SELECT (user_id) ON TABLE public.password_reset_tokens TO trademate_app;

    REVOKE SELECT ON TABLE public.email_verification_codes FROM trademate_app;
    GRANT SELECT (user_id) ON TABLE public.email_verification_codes TO trademate_app;

    REVOKE SELECT ON TABLE public.user_deletion_requests FROM trademate_app;
    GRANT SELECT (user_id) ON TABLE public.user_deletion_requests TO trademate_app;
  END IF;
END;
$migration$;

COMMENT ON FUNCTION trademate_private.discard_password_reset_token(TEXT) IS
  'Deletes one password-reset token by its presented digest without granting the runtime role direct access to stored token hashes.';
COMMENT ON FUNCTION trademate_private.rollback_account_deletion_request(TEXT) IS
  'Restores an account and consumes its deletion cancellation token atomically when notification delivery fails.';
