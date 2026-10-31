-- Feed post titles and durable file/audio attachments.
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE feed_posts DROP CONSTRAINT IF EXISTS feed_posts_title_length;
ALTER TABLE feed_posts ADD CONSTRAINT feed_posts_title_length CHECK (char_length(title) <= 140);

CREATE TABLE IF NOT EXISTS feed_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 180),
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size BETWEEN 1 AND 5242880),
  content BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feed_attachments_post_idx ON feed_attachments (post_id, created_at);
