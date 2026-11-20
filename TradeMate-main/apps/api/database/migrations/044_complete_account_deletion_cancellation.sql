CREATE OR REPLACE FUNCTION trademate_private.complete_account_deletion_cancellation(p_token_hash TEXT)
RETURNS TABLE (restored_user_id UUID, restored_email TEXT)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  target_user_id UUID;
  target_email TEXT;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN;
  END IF;

  SELECT d.user_id, u.email
    INTO target_user_id, target_email
  FROM public.user_deletion_requests AS d
  JOIN public.users AS u ON u.id = d.user_id
  WHERE d.cancellation_token_hash = p_token_hash
    AND d.cancelled_at IS NULL
    AND d.scheduled_for > pg_catalog.now()
    AND u.status = 'deletion_pending'
  FOR UPDATE OF d, u;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.users
  SET status = 'active', updated_at = pg_catalog.now()
  WHERE id = target_user_id AND status = 'deletion_pending';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.user_deletion_requests
  SET cancelled_at = pg_catalog.now(), cancellation_token_hash = NULL
  WHERE user_id = target_user_id
    AND cancellation_token_hash = p_token_hash
    AND cancelled_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account deletion cancellation state changed unexpectedly';
  END IF;

  INSERT INTO public.audit_events (
    actor_user_id, event_type, entity_type, entity_id, metadata
  ) VALUES (
    target_user_id, 'account.deletion_cancelled', 'user', target_user_id, '{}'::jsonb
  );

  RETURN QUERY SELECT target_user_id, target_email;
END;
$function$;

REVOKE ALL ON FUNCTION trademate_private.complete_account_deletion_cancellation(TEXT) FROM PUBLIC;

COMMENT ON FUNCTION trademate_private.complete_account_deletion_cancellation(TEXT) IS
  'Atomically restores an account using a valid, unexpired, one-time cancellation-token digest and records the audit event without exposing stored token digests.';
