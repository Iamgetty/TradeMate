DO $$
DECLARE
  app_role RECORD;
  migrator_role RECORD;
BEGIN
  SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
  INTO app_role
  FROM pg_roles WHERE rolname = 'trademate_app';

  SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
  INTO migrator_role
  FROM pg_roles WHERE rolname = 'trademate_migrator';

  IF app_role IS NULL OR migrator_role IS NULL THEN
    RAISE EXCEPTION 'TradeMate database roles were not created.';
  END IF;

  IF app_role.rolsuper OR app_role.rolcreatedb OR app_role.rolcreaterole OR app_role.rolbypassrls THEN
    RAISE EXCEPTION 'trademate_app has excessive role attributes.';
  END IF;

  IF migrator_role.rolsuper OR migrator_role.rolcreatedb OR migrator_role.rolcreaterole OR migrator_role.rolbypassrls THEN
    RAISE EXCEPTION 'trademate_migrator has excessive role attributes.';
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
END
$$;
