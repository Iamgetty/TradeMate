-- Reconcile AWS staging with additive fields present on the Render source.
-- Preserve the source's required author identity constraint.
ALTER TABLE public.p2p_trades
  ADD COLUMN IF NOT EXISTS dispute_resolution TEXT,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_reviewer_key_id TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.feed_posts
    WHERE author_user_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce feed_posts.author_user_id NOT NULL: AWS contains rows without an author';
  END IF;
END
$$;

ALTER TABLE public.feed_posts
  ALTER COLUMN author_user_id SET NOT NULL;
