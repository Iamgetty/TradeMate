-- Minimal, PII-free receipt log for Persona webhook delivery.
-- Verification decisions remain unavailable until an inquiry-to-user mapping
-- and the authenticated inquiry-creation flow are implemented.
CREATE TABLE IF NOT EXISTS public.persona_webhook_events (
  event_id TEXT PRIMARY KEY CHECK (event_id ~ '^evt_[A-Za-z0-9]+$'),
  event_name TEXT NOT NULL CHECK (event_name IN (
    'inquiry.created', 'inquiry.started', 'inquiry.completed', 'inquiry.approved',
    'inquiry.declined', 'inquiry.marked-for-review', 'inquiry.failed', 'inquiry.expired'
  )),
  inquiry_id TEXT NOT NULL CHECK (inquiry_id ~ '^inq_[A-Za-z0-9]+$'),
  inquiry_status TEXT,
  event_created_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload_sha256 CHAR(64) NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS persona_webhook_events_inquiry_idx
  ON public.persona_webhook_events (inquiry_id, event_created_at DESC);

REVOKE ALL ON TABLE public.persona_webhook_events FROM PUBLIC;
DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'trademate_app') THEN
    REVOKE ALL ON TABLE public.persona_webhook_events FROM trademate_app;
    GRANT INSERT ON TABLE public.persona_webhook_events TO trademate_app;
  END IF;
END;
$grants$;

COMMENT ON TABLE public.persona_webhook_events IS
  'PII-free, idempotent receipt log for signed Persona inquiry webhook events; does not itself confer verified status.';
