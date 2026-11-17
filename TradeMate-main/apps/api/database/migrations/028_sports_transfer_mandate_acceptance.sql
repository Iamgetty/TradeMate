-- Capture the representative's response separately from TradeMate authority verification.
ALTER TABLE sports_representative_mandates
  ADD COLUMN IF NOT EXISTS representative_response TEXT NOT NULL DEFAULT 'pending'
    CHECK (representative_response IN ('pending', 'accepted', 'rejected')),
  ADD COLUMN IF NOT EXISTS responded_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_note TEXT NOT NULL DEFAULT '';

ALTER TABLE sports_representative_mandates
  ADD CONSTRAINT sports_mandate_response_actor_consistency
    CHECK (
      (representative_response = 'pending' AND responded_by_user_id IS NULL AND responded_at IS NULL)
      OR
      (representative_response IN ('accepted', 'rejected') AND responded_by_user_id IS NOT NULL AND responded_at IS NOT NULL)
    ),
  ADD CONSTRAINT sports_mandate_rejection_consistency
    CHECK ((representative_response = 'rejected') = (status = 'rejected')),
  ADD CONSTRAINT sports_mandate_active_requires_verified_acceptance
    CHECK (
      status <> 'active'
      OR (
        representative_response = 'accepted'
        AND verified_by_user_id IS NOT NULL
        AND verified_at IS NOT NULL
      )
    ),
  ADD CONSTRAINT sports_mandate_response_note_length
    CHECK (char_length(response_note) <= 500);

CREATE INDEX IF NOT EXISTS sports_mandates_pending_response_idx
  ON sports_representative_mandates (expires_at, created_at)
  WHERE status = 'pending' AND representative_response = 'pending';
