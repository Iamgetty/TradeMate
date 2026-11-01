-- Audit history is append-only. User/organization records are anonymised or
-- retained for contractual and regulatory reasons rather than rewriting history.
CREATE OR REPLACE FUNCTION public.reject_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only; % is not permitted', TG_OP
    USING ERRCODE = '55000';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS audit_events_immutable_row ON public.audit_events;
CREATE TRIGGER audit_events_immutable_row
  BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_audit_event_mutation();

DROP TRIGGER IF EXISTS audit_events_immutable_truncate ON public.audit_events;
CREATE TRIGGER audit_events_immutable_truncate
  BEFORE TRUNCATE ON public.audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION public.reject_audit_event_mutation();

ALTER TABLE public.audit_events ENABLE ALWAYS TRIGGER audit_events_immutable_row;
ALTER TABLE public.audit_events ENABLE ALWAYS TRIGGER audit_events_immutable_truncate;
