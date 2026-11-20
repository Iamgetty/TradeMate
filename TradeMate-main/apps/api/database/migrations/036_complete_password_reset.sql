-- Consume a password-reset credential and invalidate every session atomically.
-- The caller supplies only the opaque token digest and a precomputed password hash;
-- account identity is derived exclusively from the locked, unexpired reset record.
CREATE OR REPLACE FUNCTION trademate_private.complete_password_reset(
  p_token_hash TEXT,
  p_password_hash TEXT
)
RETURNS TABLE(reset_user_id UUID, reset_email TEXT)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  target_user_id UUID;
  target_email TEXT;
  updated_credentials INTEGER;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_password_hash IS NULL OR pg_catalog.length(p_password_hash) < 20
     OR pg_catalog.length(p_password_hash) > 512 THEN
    RETURN;
  END IF;

  SELECT t.user_id, u.email
  INTO target_user_id, target_email
  FROM public.password_reset_tokens AS t
  JOIN public.users AS u ON u.id = t.user_id
  WHERE t.token_hash = p_token_hash
    AND t.used_at IS NULL
    AND t.expires_at > pg_catalog.now()
    AND u.status = 'active'
  FOR UPDATE OF t, u;

  IF target_user_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.user_credentials
  SET password_hash = p_password_hash,
      updated_at = pg_catalog.now()
  WHERE user_id = target_user_id;

  GET DIAGNOSTICS updated_credentials = ROW_COUNT;
  IF updated_credentials <> 1 THEN
    RAISE EXCEPTION 'Password reset could not update account credentials.';
  END IF;

  UPDATE public.password_reset_tokens
  SET used_at = pg_catalog.now()
  WHERE token_hash = p_token_hash
    AND used_at IS NULL
    AND expires_at > pg_catalog.now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Password reset token was concurrently consumed.';
  END IF;

  DELETE FROM public.user_sessions
  WHERE user_id = target_user_id;

  UPDATE public.auth_login_challenges
  SET consumed_at = pg_catalog.now()
  WHERE user_id = target_user_id
    AND consumed_at IS NULL;

  DELETE FROM public.password_reset_tokens
  WHERE user_id = target_user_id
    AND token_hash <> p_token_hash;

  INSERT INTO public.audit_events (
    actor_user_id, event_type, entity_type, entity_id, metadata
  )
  VALUES (
    target_user_id,
    'auth.password_reset_completed',
    'user',
    target_user_id,
    '{}'::jsonb
  );

  RETURN QUERY SELECT target_user_id, target_email;
END;
$$;

REVOKE ALL ON FUNCTION trademate_private.complete_password_reset(TEXT, TEXT) FROM PUBLIC;

COMMENT ON FUNCTION trademate_private.complete_password_reset(TEXT, TEXT) IS
  'Atomically consumes a valid password-reset token, updates the credential hash, revokes all account sessions and outstanding login challenges, removes sibling reset tokens, and appends the security audit event.';
