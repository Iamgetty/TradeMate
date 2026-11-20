-- Authenticated, transaction-bound identity context for RLS.
-- The API signs only the opaque presented session digest; the verifier key is
-- stored in a private table readable only by the SECURITY DEFINER owner.
-- Provision pgcrypto (public.hmac) as the database administrator before this
-- migration; AWS RDS PostgreSQL supports pgcrypto on PostgreSQL 18.

DO $check$
BEGIN
  IF pg_catalog.to_regprocedure('public.hmac(bytea,bytea,text)') IS NULL THEN
    RAISE EXCEPTION 'pgcrypto public.hmac(bytea,bytea,text) is required; provision pgcrypto as the database administrator before migration 050.';
  END IF;
END;
$check$;

CREATE TABLE IF NOT EXISTS trademate_private.rls_context_hmac_keys (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  key_bytes BYTEA NOT NULL CHECK (pg_catalog.octet_length(key_bytes) = 32),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

REVOKE ALL ON TABLE trademate_private.rls_context_hmac_keys FROM PUBLIC;
DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'trademate_app') THEN
    REVOKE ALL ON TABLE trademate_private.rls_context_hmac_keys FROM trademate_app;
  END IF;
END;
$grants$;

CREATE OR REPLACE FUNCTION trademate_private.current_presented_user_id()
RETURNS UUID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  presented_hash TEXT;
  presented_xid TEXT;
  presented_pid TEXT;
  presented_signature TEXT;
  verifier_key BYTEA;
  signed_payload TEXT;
  expected_signature_bytes BYTEA;
  presented_signature_bytes BYTEA;
  comparison_difference INTEGER := 0;
  byte_index INTEGER;
BEGIN
  presented_hash := NULLIF(pg_catalog.current_setting('app.session_token_hash', true), '');
  presented_xid := NULLIF(pg_catalog.current_setting('app.session_transaction_id', true), '');
  presented_pid := NULLIF(pg_catalog.current_setting('app.session_backend_pid', true), '');
  presented_signature := NULLIF(pg_catalog.current_setting('app.session_signature', true), '');

  IF presented_hash IS NULL OR presented_hash !~ '^[0-9a-f]{64}$'
     OR presented_xid IS NULL OR presented_pid IS NULL
     OR presented_signature IS NULL OR presented_signature !~ '^[0-9a-f]{64}$' THEN
    RETURN NULL;
  END IF;

  -- A signature is valid only in the transaction and backend for which the
  -- API minted it. A captured assertion cannot be replayed in another txn.
  IF presented_xid <> pg_catalog.txid_current()::TEXT
     OR presented_pid <> pg_catalog.pg_backend_pid()::TEXT THEN
    RETURN NULL;
  END IF;

  SELECT key_bytes INTO verifier_key
  FROM trademate_private.rls_context_hmac_keys
  WHERE singleton = TRUE;

  IF verifier_key IS NULL THEN
    RETURN NULL;
  END IF;

  signed_payload := 'trademate-rls-context:v1|' || presented_xid || '|' ||
    presented_pid || '|' || presented_hash;
  expected_signature_bytes := public.hmac(
    pg_catalog.convert_to(signed_payload, 'UTF8'), verifier_key, 'sha256'
  );
  presented_signature_bytes := pg_catalog.decode(presented_signature, 'hex');

  -- Compare all 32 MAC bytes without an early exit on the first mismatch.
  IF pg_catalog.octet_length(expected_signature_bytes) <> 32
     OR pg_catalog.octet_length(presented_signature_bytes) <> 32 THEN
    RETURN NULL;
  END IF;
  FOR byte_index IN 0..31 LOOP
    comparison_difference := comparison_difference |
      (pg_catalog.get_byte(expected_signature_bytes, byte_index) #
       pg_catalog.get_byte(presented_signature_bytes, byte_index));
  END LOOP;
  IF comparison_difference <> 0 THEN
    RETURN NULL;
  END IF;

  RETURN (
    SELECT s.resolved_user_id
    FROM trademate_private.resolve_presented_session(presented_hash) AS s
    LIMIT 1
  );
END;
$function$;

REVOKE ALL ON FUNCTION trademate_private.current_presented_user_id() FROM PUBLIC;
DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'trademate_app') THEN
    GRANT EXECUTE ON FUNCTION trademate_private.current_presented_user_id() TO trademate_app;
  END IF;
END;
$grants$;

COMMENT ON TABLE trademate_private.rls_context_hmac_keys IS
  'Private 256-bit verifier key for API-signed, transaction-bound RLS identity assertions; never grant runtime access.';
COMMENT ON FUNCTION trademate_private.current_presented_user_id() IS
  'Resolves a presented session only when its digest, transaction ID and backend PID carry a valid API HMAC; caller-set GUCs alone are untrusted.';
