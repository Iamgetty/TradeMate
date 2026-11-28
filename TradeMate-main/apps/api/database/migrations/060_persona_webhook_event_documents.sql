-- One private evidence PDF per signed Persona inquiry event and mapped account.
CREATE TABLE IF NOT EXISTS public.persona_webhook_event_documents (
  event_id TEXT PRIMARY KEY REFERENCES public.persona_webhook_events(event_id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  document_id UUID NOT NULL UNIQUE REFERENCES public.user_documents(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS persona_webhook_event_documents_user_idx
  ON public.persona_webhook_event_documents (user_id, created_at DESC);
REVOKE ALL ON TABLE public.persona_webhook_event_documents FROM PUBLIC;
DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'trademate_app') THEN
    GRANT SELECT, INSERT ON TABLE public.persona_webhook_event_documents TO trademate_app;
  END IF;
END;
$grants$;
COMMENT ON TABLE public.persona_webhook_event_documents IS
  'Idempotent mapping from verified Persona webhook events to private account-owned verification status PDFs; no biometric source images are copied.';
