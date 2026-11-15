-- Stable public usernames, independent from account display names and immutable user IDs.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username TEXT;

UPDATE user_profiles p
SET username = left(
  COALESCE(NULLIF(trim(both '_' from regexp_replace(lower(u.display_name), '[^a-z0-9]+', '_', 'g')), ''), 'trader'),
  10
) || '_' || left(replace(u.id::text, '-', ''), 12)
FROM users u
WHERE p.user_id = u.id AND (p.username IS NULL OR p.username = '');

INSERT INTO user_profiles (user_id, username)
SELECT u.id,
       left(COALESCE(NULLIF(trim(both '_' from regexp_replace(lower(u.display_name), '[^a-z0-9]+', '_', 'g')), ''), 'trader'), 10)
       || '_' || left(replace(u.id::text, '-', ''), 12)
FROM users u
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE user_profiles ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_lower_uidx ON user_profiles (lower(username));

-- Ensure every account created after this migration receives a public username immediately.
CREATE OR REPLACE FUNCTION create_default_user_profile() RETURNS trigger AS $$
DECLARE
  base_name TEXT;
BEGIN
  base_name := COALESCE(NULLIF(trim(both '_' from regexp_replace(lower(NEW.display_name), '[^a-z0-9]+', '_', 'g')), ''), 'trader');
  INSERT INTO user_profiles (user_id, username)
  VALUES (NEW.id, left(base_name, 10) || '_' || left(replace(NEW.id::text, '-', ''), 12))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_create_default_profile ON users;
CREATE TRIGGER users_create_default_profile
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION create_default_user_profile();
