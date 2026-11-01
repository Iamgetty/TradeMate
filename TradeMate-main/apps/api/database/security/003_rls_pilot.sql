-- CI-only RLS pilot. Do not add this file to the production migration runner
-- until the full auth-bootstrap and table-policy inventory is approved.
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_preferences_owner_access ON public.user_preferences;
CREATE POLICY user_preferences_owner_access ON public.user_preferences
  FOR ALL TO trademate_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_notifications_owner_access ON public.user_notifications;
CREATE POLICY user_notifications_owner_access ON public.user_notifications
  FOR ALL TO trademate_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

ALTER TABLE public.user_auth_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_auth_security FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_auth_security_owner_access ON public.user_auth_security;
CREATE POLICY user_auth_security_owner_access ON public.user_auth_security
  FOR ALL TO trademate_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
