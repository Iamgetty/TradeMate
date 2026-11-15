-- Stable public usernames, independent from account display names and immutable user IDs.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username TEXT;

UPDATE user_profiles p
SET username = left(
  COALESCE(NULLIF(trim(both '_' from regexp_replace(lower(u.display_name), '[^a-z0-9]+', '_', 'g')), ''), 'trader'),
  12
) || '_' || left(replace(u.id::text, '-', ''), 8)
FROM users u
WHERE p.user_id = u.id AND (p.username IS NULL OR p.username = '');

INSERT INTO user_profiles (user_id, username)
SELECT u.id,
       left(COALESCE(NULLIF(trim(both '_' from regexp_replace(lower(u.display_name), '[^a-z0-9]+', '_', 'g')), ''), 'trader'), 12)
       || '_' || left(replace(u.id::text, '-', ''), 8)
FROM users u
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE user_profiles ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_lower_uidx ON user_profiles (lower(username));
