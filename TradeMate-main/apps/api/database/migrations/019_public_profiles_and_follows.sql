-- Persistent public trader profiles, profile media, highlights and follow graph.
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT NOT NULL DEFAULT '' CHECK (char_length(bio) <= 160),
  instagram_username TEXT NOT NULL DEFAULT '' CHECK (char_length(instagram_username) <= 30),
  x_username TEXT NOT NULL DEFAULT '' CHECK (char_length(x_username) <= 15),
  website_url TEXT NOT NULL DEFAULT '' CHECK (char_length(website_url) <= 2048),
  profile_photo_data TEXT NOT NULL DEFAULT '',
  cover_photo_data TEXT NOT NULL DEFAULT '',
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(highlights) = 'array' AND jsonb_array_length(highlights) <= 12),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_follows (
  follower_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_user_id, followed_user_id),
  CHECK (follower_user_id <> followed_user_id)
);
CREATE INDEX IF NOT EXISTS user_follows_followed_idx ON user_follows (followed_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_follows_follower_idx ON user_follows (follower_user_id, created_at DESC);
