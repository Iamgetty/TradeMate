-- The API reconciles inquiry status by reading the PII-free Persona event receipt log.
-- Keep write access and add only the SELECT privilege required by that query.
DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'trademate_app') THEN
    GRANT SELECT ON TABLE public.persona_webhook_events TO trademate_app;
  END IF;
END;
$grants$;
