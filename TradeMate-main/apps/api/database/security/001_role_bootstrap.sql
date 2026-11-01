-- TradeMate PostgreSQL role bootstrap.
-- Run ONCE as the current Render database administrator after creating
-- Render-managed credentials named trademate_app, trademate_migrator and trademate_worker.
-- Do not run this script against production until the API is ready to use
-- the split DATABASE_URL / MIGRATION_DATABASE_URL settings.
--
-- This script does not set or print passwords. Create/manage credentials in
-- Render Dashboard > PostgreSQL > Info > Credentials.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trademate_app') THEN
    CREATE ROLE trademate_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trademate_migrator') THEN
    CREATE ROLE trademate_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trademate_worker') THEN
    CREATE ROLE trademate_worker LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;

ALTER ROLE trademate_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
ALTER ROLE trademate_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
ALTER ROLE trademate_worker LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

-- Permit the current administrator to transfer existing object ownership.
GRANT trademate_migrator TO CURRENT_USER;

DO $$
BEGIN
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO trademate_app, trademate_migrator, trademate_worker',
    current_database()
  );
END
$$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

GRANT USAGE, CREATE ON SCHEMA public TO trademate_migrator;
GRANT USAGE ON SCHEMA public TO trademate_app;

-- Transfer application tables, sequences and views to the migration owner.
-- The app login must never own these objects.
DO $$
DECLARE
  object_record RECORD;
BEGIN
  FOR object_record IN
    SELECT c.relname, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'f', 'S', 'v', 'm')
    ORDER BY CASE
      WHEN c.relkind IN ('r', 'p', 'f') THEN 1
      WHEN c.relkind = 'S' THEN 2
      ELSE 3
    END
  LOOP
    IF object_record.relkind = 'S' THEN
      EXECUTE format('ALTER SEQUENCE public.%I OWNER TO trademate_migrator', object_record.relname);
    ELSIF object_record.relkind = 'v' THEN
      EXECUTE format('ALTER VIEW public.%I OWNER TO trademate_migrator', object_record.relname);
    ELSIF object_record.relkind = 'm' THEN
      EXECUTE format('ALTER MATERIALIZED VIEW public.%I OWNER TO trademate_migrator', object_record.relname);
    ELSIF object_record.relkind = 'f' THEN
      EXECUTE format('ALTER FOREIGN TABLE public.%I OWNER TO trademate_migrator', object_record.relname);
    ELSE
      EXECUTE format('ALTER TABLE public.%I OWNER TO trademate_migrator', object_record.relname);
    END IF;
  END LOOP;
END
$$;

ALTER SCHEMA public OWNER TO trademate_migrator;

-- Runtime CRUD privileges. RLS policies will subsequently restrict rows.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO trademate_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO trademate_app;

-- Audit and migration history are not mutable/readable by the runtime role.
REVOKE UPDATE, DELETE ON TABLE public.audit_events FROM trademate_app;
REVOKE ALL ON TABLE public.schema_migrations FROM trademate_app;

-- Objects created by the migrator in future migrations receive runtime grants.
ALTER DEFAULT PRIVILEGES FOR ROLE trademate_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO trademate_app;
ALTER DEFAULT PRIVILEGES FOR ROLE trademate_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO trademate_app;

-- The runtime role is not an owner, schema creator, superuser or RLS bypass.


-- Narrow background-worker grants. The account-deletion worker must not use
-- the API role and must never mutate or delete audit history.
GRANT USAGE ON SCHEMA public TO trademate_worker;
GRANT SELECT ON TABLE public.users, public.user_deletion_requests TO trademate_worker;
GRANT UPDATE (email, phone_e164, display_name, preferred_locale, country_code, time_zone, status, updated_at)
  ON TABLE public.users TO trademate_worker;
GRANT UPDATE (cancellation_token_hash) ON TABLE public.user_deletion_requests TO trademate_worker;
GRANT DELETE ON TABLE public.user_sessions, public.user_credentials,
  public.user_preferences, public.user_notifications TO trademate_worker;
GRANT UPDATE (sender_user_id, sender_type) ON TABLE public.support_ticket_messages TO trademate_worker;
GRANT UPDATE (accepted_by_user_id) ON TABLE public.marketplace_contracts TO trademate_worker;
GRANT INSERT ON TABLE public.audit_events TO trademate_worker;

DO $$
DECLARE
  audit_sequence TEXT;
BEGIN
  audit_sequence := pg_get_serial_sequence('public.audit_events', 'id');
  IF audit_sequence IS NOT NULL THEN
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO trademate_worker', audit_sequence);
  END IF;
END
$$;
