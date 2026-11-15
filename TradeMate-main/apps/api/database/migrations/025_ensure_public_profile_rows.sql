ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username TEXT;

UPDATE user_profiles
SET username = 'tm_' || left(replace(user_id::text, '-', ''), 21)
WHERE username IS NULL OR btrim(username) = '';

INSERT INTO user_profiles (user_id, username)
SELECT u.id, 'tm_' || left(replace(u.id::text, '-', ''), 21)
FROM users u
LEFT JOIN user_profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE user_profiles ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_lower_uidx
  ON user_profiles (lower(username));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_username_format_check'
      AND conrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_username_format_check
      CHECK (username ~ '^[a-z0-9][a-z0-9_]{2,23}$');
  END IF;
END
$$;
