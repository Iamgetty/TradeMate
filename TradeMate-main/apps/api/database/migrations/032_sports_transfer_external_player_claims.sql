-- Player-initiated identity claims for source-derived sporting records.
-- A claim never merges records into a player profile. Linking occurs only after
-- a verified profile, approved source/record and independent human review.
CREATE TABLE IF NOT EXISTS sports_transfer_external_player_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_player_record_id UUID NOT NULL
    REFERENCES sports_transfer_external_player_records(id) ON DELETE RESTRICT,
  player_profile_id UUID NOT NULL REFERENCES sports_profiles(id) ON DELETE RESTRICT,
  claimant_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  claim_statement TEXT NOT NULL CHECK (char_length(claim_statement) BETWEEN 20 AND 2000),
  evidence_url TEXT NOT NULL DEFAULT '' CHECK (char_length(evidence_url) <= 2048),
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','approved','rejected','withdrawn')),
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  reviewer_key_id TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT NOT NULL DEFAULT '' CHECK (char_length(review_note) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (reviewed_at IS NULL AND reviewed_by_user_id IS NULL AND reviewer_key_id IS NULL)
    OR (reviewed_at IS NOT NULL AND
        ((reviewed_by_user_id IS NOT NULL AND reviewer_key_id IS NULL)
         OR (reviewed_by_user_id IS NULL AND reviewer_key_id IS NOT NULL)))
  ),
  CHECK (status <> 'approved' OR reviewed_at IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS sports_transfer_external_claim_pending_record_idx
  ON sports_transfer_external_player_claims (external_player_record_id)
  WHERE status = 'pending_review';
CREATE UNIQUE INDEX IF NOT EXISTS sports_transfer_external_claim_profile_record_idx
  ON sports_transfer_external_player_claims (external_player_record_id, player_profile_id)
  WHERE status IN ('pending_review','approved');
CREATE INDEX IF NOT EXISTS sports_transfer_external_claim_user_idx
  ON sports_transfer_external_player_claims (claimant_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sports_transfer_external_claim_review_idx
  ON sports_transfer_external_player_claims (status, created_at ASC);

-- The record's pending state is a summary only. The claim table remains the
-- authoritative record of who requested the match and the evidence/review trail.
