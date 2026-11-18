-- Allow the existing restricted review-key moderation workflow to be attributed
-- without pretending that a shared service key is a human TradeMate user account.
ALTER TABLE sports_transfer_data_sources
  ADD COLUMN IF NOT EXISTS reviewer_key_id TEXT;
ALTER TABLE sports_transfer_external_player_records
  ADD COLUMN IF NOT EXISTS reviewer_key_id TEXT;

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'sports_transfer_data_sources'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%rights_status <> ''approved''%'
  LOOP
    EXECUTE format('ALTER TABLE sports_transfer_data_sources DROP CONSTRAINT %I', c.conname);
  END LOOP;
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'sports_transfer_external_player_records'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) LIKE '%reviewed_at IS NULL%'
        OR pg_get_constraintdef(oid) LIKE '%review_status <> ''approved''%'
      )
  LOOP
    EXECUTE format('ALTER TABLE sports_transfer_external_player_records DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE sports_transfer_data_sources
  ADD CONSTRAINT sports_transfer_data_sources_review_attribution_check
  CHECK (
    (reviewed_at IS NULL AND reviewed_by_user_id IS NULL AND reviewer_key_id IS NULL)
    OR (reviewed_at IS NOT NULL AND
        ((reviewed_by_user_id IS NOT NULL AND reviewer_key_id IS NULL)
         OR (reviewed_by_user_id IS NULL AND reviewer_key_id IS NOT NULL)))
  ),
  ADD CONSTRAINT sports_transfer_data_sources_approval_evidence_check
  CHECK (
    rights_status <> 'approved'
    OR (reviewed_at IS NOT NULL
        AND (reviewed_by_user_id IS NOT NULL OR reviewer_key_id IS NOT NULL)
        AND char_length(rights_basis) >= 10 AND char_length(terms_reference) >= 3
        AND cardinality(permitted_data_categories) > 0
        AND cardinality(permitted_purposes) > 0)
  );

ALTER TABLE sports_transfer_external_player_records
  ADD CONSTRAINT sports_transfer_external_player_review_attribution_check
  CHECK (
    (reviewed_at IS NULL AND reviewed_by_user_id IS NULL AND reviewer_key_id IS NULL)
    OR (reviewed_at IS NOT NULL AND
        ((reviewed_by_user_id IS NOT NULL AND reviewer_key_id IS NULL)
         OR (reviewed_by_user_id IS NULL AND reviewer_key_id IS NOT NULL)))
  ),
  ADD CONSTRAINT sports_transfer_external_player_approval_attribution_check
  CHECK (
    review_status <> 'approved'
    OR (reviewed_at IS NOT NULL AND
        (reviewed_by_user_id IS NOT NULL OR reviewer_key_id IS NOT NULL))
  );
