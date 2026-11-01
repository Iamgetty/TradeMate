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

-- Public profile fields are intentionally public; writes remain owner-only.
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_profiles_public_read ON public.user_profiles;
CREATE POLICY user_profiles_public_read ON public.user_profiles
  FOR SELECT TO trademate_app USING (true);
DROP POLICY IF EXISTS user_profiles_owner_insert ON public.user_profiles;
CREATE POLICY user_profiles_owner_insert ON public.user_profiles
  FOR INSERT TO trademate_app
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
DROP POLICY IF EXISTS user_profiles_owner_update ON public.user_profiles;
CREATE POLICY user_profiles_owner_update ON public.user_profiles
  FOR UPDATE TO trademate_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
DROP POLICY IF EXISTS user_profiles_owner_delete ON public.user_profiles;
CREATE POLICY user_profiles_owner_delete ON public.user_profiles
  FOR DELETE TO trademate_app
  USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);

-- Follow graph is public for profile counts and lists; users may create/remove
-- only edges for themselves as the follower.
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_follows_public_read ON public.user_follows;
CREATE POLICY user_follows_public_read ON public.user_follows
  FOR SELECT TO trademate_app USING (true);
DROP POLICY IF EXISTS user_follows_owner_insert ON public.user_follows;
CREATE POLICY user_follows_owner_insert ON public.user_follows
  FOR INSERT TO trademate_app
  WITH CHECK (follower_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
DROP POLICY IF EXISTS user_follows_owner_delete ON public.user_follows;
CREATE POLICY user_follows_owner_delete ON public.user_follows
  FOR DELETE TO trademate_app
  USING (follower_user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);
