-- Persistent, user-owned notification inbox.
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('Contracts', 'P2P', 'Promotions', 'System')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  body TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 500),
  icon TEXT NOT NULL DEFAULT 'bell',
  action_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_notifications_inbox_idx
  ON user_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_notifications_unread_idx
  ON user_notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;
