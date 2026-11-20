DO $$
DECLARE
  app_role RECORD;
  migrator_role RECORD;
  worker_role RECORD;
BEGIN
  SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
  INTO app_role
  FROM pg_roles WHERE rolname = 'trademate_app';

  SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
  INTO migrator_role
  FROM pg_roles WHERE rolname = 'trademate_migrator';

  SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
  INTO worker_role
  FROM pg_roles WHERE rolname = 'trademate_worker';

  IF app_role IS NULL OR migrator_role IS NULL OR worker_role IS NULL THEN
    RAISE EXCEPTION 'TradeMate database roles were not created.';
  END IF;

  IF app_role.rolsuper OR app_role.rolcreatedb OR app_role.rolcreaterole OR app_role.rolbypassrls THEN
    RAISE EXCEPTION 'trademate_app has excessive role attributes.';
  END IF;

  IF migrator_role.rolsuper OR migrator_role.rolcreatedb OR migrator_role.rolcreaterole OR migrator_role.rolbypassrls THEN
    RAISE EXCEPTION 'trademate_migrator has excessive role attributes.';
  END IF;

  IF worker_role.rolsuper OR worker_role.rolcreatedb OR worker_role.rolcreaterole OR worker_role.rolbypassrls THEN
    RAISE EXCEPTION 'trademate_worker has excessive role attributes.';
  END IF;

  IF NOT has_schema_privilege('trademate_migrator', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'trademate_migrator cannot create schema objects.';
  END IF;

  IF has_schema_privilege('trademate_app', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'trademate_app must not create schema objects.';
  END IF;

  IF NOT has_table_privilege('trademate_app', 'public.users', 'SELECT')
     OR NOT has_table_privilege('trademate_app', 'public.user_sessions', 'INSERT')
     OR NOT has_table_privilege('trademate_app', 'public.marketplace_enquiries', 'UPDATE') THEN
    RAISE EXCEPTION 'trademate_app is missing required runtime table privileges.';
  END IF;

  IF has_table_privilege('trademate_app', 'public.user_sessions', 'SELECT')
     OR NOT has_column_privilege('trademate_app', 'public.user_sessions', 'user_id', 'SELECT')
     OR has_column_privilege('trademate_app', 'public.user_sessions', 'token_hash', 'SELECT') THEN
    RAISE EXCEPTION 'trademate_app must not read session bearer-token digests; only the user_id predicate column is available.';
  END IF;

  IF has_table_privilege('trademate_app', 'public.user_credentials', 'SELECT')
     OR NOT has_column_privilege('trademate_app', 'public.user_credentials', 'user_id', 'SELECT')
     OR has_column_privilege('trademate_app', 'public.user_credentials', 'password_hash', 'SELECT') THEN
    RAISE EXCEPTION 'trademate_app must not read password verifiers directly; only the user_id predicate column is available.';
  END IF;

  IF has_table_privilege('trademate_app', 'public.user_auth_security', 'SELECT')
     OR NOT has_column_privilege('trademate_app', 'public.user_auth_security', 'totp_enabled', 'SELECT')
     OR has_column_privilege('trademate_app', 'public.user_auth_security', 'totp_secret_encrypted', 'SELECT')
     OR has_table_privilege('trademate_app', 'public.auth_login_challenges', 'SELECT')
     OR has_column_privilege('trademate_app', 'public.password_reset_tokens', 'token_hash', 'SELECT')
     OR has_column_privilege('trademate_app', 'public.email_verification_codes', 'code_hash', 'SELECT')
     OR has_column_privilege('trademate_app', 'public.user_deletion_requests', 'cancellation_token_hash', 'SELECT') THEN
    RAISE EXCEPTION 'trademate_app must not directly read authentication secrets or one-time token digests.';
  END IF;

  IF NOT has_table_privilege('trademate_app', 'public.audit_events', 'INSERT')
     OR has_table_privilege('trademate_app', 'public.audit_events', 'UPDATE')
     OR has_table_privilege('trademate_app', 'public.audit_events', 'DELETE') THEN
    RAISE EXCEPTION 'audit_events must be append-only for the runtime role.';
  END IF;

  IF has_table_privilege('trademate_app', 'public.schema_migrations', 'SELECT')
     OR has_table_privilege('trademate_app', 'public.schema_migrations', 'INSERT')
     OR has_table_privilege('trademate_app', 'public.schema_migrations', 'UPDATE')
     OR has_table_privilege('trademate_app', 'public.schema_migrations', 'DELETE') THEN
    RAISE EXCEPTION 'trademate_app must not access schema_migrations.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'f', 'S', 'v', 'm')
      AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = 'trademate_app')
  ) THEN
    RAISE EXCEPTION 'trademate_app must not own database objects.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'users'
      AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = 'trademate_migrator')
  ) THEN
    RAISE EXCEPTION 'trademate_migrator must own application tables.';
  END IF;



  IF has_schema_privilege('trademate_worker', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'trademate_worker must not create schema objects.';
  END IF;

  IF NOT has_table_privilege('trademate_worker', 'public.users', 'SELECT')
     OR NOT has_table_privilege('trademate_worker', 'public.user_deletion_requests', 'SELECT')
     OR NOT has_column_privilege('trademate_worker', 'public.users', 'email', 'UPDATE')
     OR NOT has_column_privilege('trademate_worker', 'public.users', 'phone_e164', 'UPDATE')
     OR NOT has_column_privilege('trademate_worker', 'public.users', 'display_name', 'UPDATE')
     OR NOT has_column_privilege('trademate_worker', 'public.users', 'preferred_locale', 'UPDATE')
     OR NOT has_column_privilege('trademate_worker', 'public.users', 'country_code', 'UPDATE')
     OR NOT has_column_privilege('trademate_worker', 'public.users', 'time_zone', 'UPDATE')
     OR NOT has_column_privilege('trademate_worker', 'public.users', 'status', 'UPDATE')
     OR NOT has_column_privilege('trademate_worker', 'public.users', 'updated_at', 'UPDATE')
     OR NOT has_column_privilege('trademate_worker', 'public.user_deletion_requests', 'cancellation_token_hash', 'UPDATE')
     OR NOT has_table_privilege('trademate_worker', 'public.user_sessions', 'DELETE')
     OR NOT has_table_privilege('trademate_worker', 'public.user_credentials', 'DELETE')
     OR NOT has_table_privilege('trademate_worker', 'public.user_preferences', 'DELETE')
     OR NOT has_table_privilege('trademate_worker', 'public.user_notifications', 'DELETE')
     OR NOT has_column_privilege('trademate_worker', 'public.user_sessions', 'user_id', 'SELECT')
     OR NOT has_column_privilege('trademate_worker', 'public.user_credentials', 'user_id', 'SELECT')
     OR NOT has_column_privilege('trademate_worker', 'public.user_preferences', 'user_id', 'SELECT')
     OR NOT has_column_privilege('trademate_worker', 'public.user_notifications', 'user_id', 'SELECT')
     OR NOT has_column_privilege('trademate_worker', 'public.support_ticket_messages', 'sender_user_id', 'SELECT')
     OR NOT has_column_privilege('trademate_worker', 'public.support_ticket_messages', 'sender_type', 'SELECT')
     OR NOT has_column_privilege('trademate_worker', 'public.support_ticket_messages', 'sender_user_id', 'UPDATE')
     OR NOT has_column_privilege('trademate_worker', 'public.support_ticket_messages', 'sender_type', 'UPDATE')
     OR NOT has_column_privilege('trademate_worker', 'public.marketplace_contracts', 'accepted_by_user_id', 'SELECT')
     OR NOT has_column_privilege('trademate_worker', 'public.marketplace_contracts', 'accepted_by_user_id', 'UPDATE')
     OR NOT has_table_privilege('trademate_worker', 'public.audit_events', 'INSERT') THEN
    RAISE EXCEPTION 'trademate_worker is missing required account-deletion privileges.';
  END IF;

  IF pg_get_serial_sequence('public.audit_events', 'id') IS NOT NULL
     AND NOT has_sequence_privilege(
       'trademate_worker',
       pg_get_serial_sequence('public.audit_events', 'id'),
       'USAGE'
     ) THEN
    RAISE EXCEPTION 'trademate_worker cannot allocate audit_events identifiers.';
  END IF;

  IF has_table_privilege('trademate_worker', 'public.audit_events', 'UPDATE')
     OR has_table_privilege('trademate_worker', 'public.audit_events', 'DELETE')
     OR has_table_privilege('trademate_worker', 'public.marketplace_enquiries', 'SELECT')
     OR has_table_privilege('trademate_worker', 'public.marketplace_enquiries', 'UPDATE') THEN
    RAISE EXCEPTION 'trademate_worker has excessive privileges.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'f', 'S', 'v', 'm')
      AND c.relowner = (SELECT oid FROM pg_roles WHERE rolname = 'trademate_worker')
  ) THEN
    RAISE EXCEPTION 'trademate_worker must not own database objects.';
  END IF;
  IF NOT has_schema_privilege('trademate_app', 'trademate_private', 'USAGE')
     OR NOT has_function_privilege('trademate_app', 'trademate_private.resolve_presented_session(text)', 'EXECUTE')
     OR NOT has_function_privilege('trademate_app', 'trademate_private.touch_presented_session(text)', 'EXECUTE')
     OR NOT has_function_privilege('trademate_app', 'trademate_private.list_presented_user_sessions(text)', 'EXECUTE')
     OR NOT has_function_privilege('trademate_app', 'trademate_private.revoke_presented_user_session(text,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('trademate_app', 'trademate_private.logout_presented_session(text)', 'EXECUTE')
     OR NOT has_function_privilege('trademate_app', 'trademate_private.revoke_other_presented_sessions(text)', 'EXECUTE')
     OR NOT has_function_privilege('trademate_app', 'trademate_private.complete_password_reset(text,text)', 'EXECUTE')
     OR NOT has_function_privilege('trademate_app', 'trademate_private.issue_password_login_session(uuid,text,text,timestamp with time zone,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('trademate_app', 'trademate_private.complete_email_verification(text,text,text,timestamp with time zone,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('trademate_app', 'trademate_private.complete_totp_login(text,bigint,text,timestamp with time zone,text,text)', 'EXECUTE')
     OR NOT has_function_privilege('trademate_app', 'trademate_private.resolve_totp_login_challenge(text)', 'EXECUTE')
     OR NOT has_function_privilege('trademate_app', 'trademate_private.record_totp_login_failure(text)', 'EXECUTE')
     OR NOT has_function_privilege('trademate_app', 'trademate_private.begin_totp_enrollment(text,text)', 'EXECUTE')
     OR NOT has_function_privilege('trademate_app', 'trademate_private.resolve_totp_enrollment(text)', 'EXECUTE')
     OR NOT has_function_privilege('trademate_app', 'trademate_private.complete_totp_enrollment(text,bigint)', 'EXECUTE')
     OR NOT has_function_privilege('trademate_app', 'trademate_private.resolve_enabled_totp(text)', 'EXECUTE')
     OR NOT has_function_privilege('trademate_app', 'trademate_private.disable_totp(text,bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'trademate_app must have the reviewed narrow session operations.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
    WHERE n.nspname = 'trademate_private'
      AND p.proname IN ('resolve_presented_session', 'touch_presented_session', 'list_presented_user_sessions', 'revoke_presented_user_session', 'logout_presented_session', 'revoke_other_presented_sessions', 'complete_password_reset', 'issue_password_login_session', 'complete_email_verification', 'complete_totp_login', 'resolve_totp_login_challenge', 'record_totp_login_failure', 'begin_totp_enrollment', 'resolve_totp_enrollment', 'complete_totp_enrollment', 'resolve_enabled_totp', 'disable_totp', 'resolve_password_login_credentials', 'resolve_presented_password_credentials', 'complete_account_deletion_cancellation', 'discard_password_reset_token', 'rollback_account_deletion_request')
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'PUBLIC must not execute the presented-session resolver.';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'trademate_private'
      AND p.proname IN ('resolve_presented_session', 'touch_presented_session', 'list_presented_user_sessions', 'revoke_presented_user_session', 'logout_presented_session', 'revoke_other_presented_sessions', 'complete_password_reset', 'issue_password_login_session', 'complete_email_verification', 'complete_totp_login', 'resolve_totp_login_challenge', 'record_totp_login_failure', 'begin_totp_enrollment', 'resolve_totp_enrollment', 'complete_totp_enrollment', 'resolve_enabled_totp', 'disable_totp', 'resolve_password_login_credentials', 'resolve_presented_password_credentials', 'complete_account_deletion_cancellation', 'discard_password_reset_token', 'rollback_account_deletion_request')
      AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=pg_catalog']
      AND pg_get_userbyid(p.proowner) <> 'trademate_app'
  ) <> 22 THEN
    RAISE EXCEPTION 'Every private session operation must be SECURITY DEFINER with a fixed safe search_path and non-runtime owner.';
  END IF;
END
$$;
