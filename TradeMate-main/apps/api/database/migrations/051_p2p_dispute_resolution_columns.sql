-- Reconcile additive schema objects present on the Render source.
-- Preserve existing data and fail closed if an author identity cannot be enforced.
ALTER TABLE public.p2p_trades
  ADD COLUMN IF NOT EXISTS dispute_resolution TEXT,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_reviewer_key_id TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.feed_posts WHERE author_user_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce feed_posts.author_user_id NOT NULL: AWS contains rows without an author';
  END IF;
END
$$;

ALTER TABLE public.feed_posts
  ALTER COLUMN author_user_id SET NOT NULL;

DO $$
DECLARE
  current_definition TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid)
    INTO current_definition
  FROM pg_constraint
  WHERE conrelid = 'public.feed_posts'::regclass
    AND conname = 'feed_posts_author_user_id_fkey';

  IF current_definition IS NOT NULL
     AND current_definition <> 'FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE CASCADE' THEN
    ALTER TABLE public.feed_posts
      DROP CONSTRAINT feed_posts_author_user_id_fkey;
    current_definition := NULL;
  END IF;

  IF current_definition IS NULL THEN
    ALTER TABLE public.feed_posts
      ADD CONSTRAINT feed_posts_author_user_id_fkey
      FOREIGN KEY (author_user_id)
      REFERENCES public.users(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.feed_posts
  VALIDATE CONSTRAINT feed_posts_author_user_id_fkey;
