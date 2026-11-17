-- Separate legal identity assurance from sporting identity review.
-- This is a manual-review foundation; no external KYC provider is connected.
CREATE TABLE IF NOT EXISTS sports_transfer_verification_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  player_profile_id UUID REFERENCES sports_profiles(id) ON DELETE RESTRICT,
  case_type TEXT NOT NULL CHECK (case_type IN ('legal_identity','sporting_identity')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','processing','needs_review','verified','rejected','expired','cancelled','disputed')),
  country_code CHAR(2),
  claim_statement TEXT NOT NULL CHECK (char_length(claim_statement) BETWEEN 20 AND 2000),
  evidence_url TEXT NOT NULL DEFAULT '' CHECK (evidence_url = '' OR (evidence_url LIKE 'https://%' AND char_length(evidence_url) <= 2048)),
  provider_key TEXT NOT NULL DEFAULT 'manual' CHECK (provider_key IN ('manual','sandbox')),
  provider_subject_reference TEXT NOT NULL DEFAULT '' CHECK (char_length(provider_subject_reference) <= 200),
  policy_version TEXT NOT NULL DEFAULT 'sports-transfer-identity-v1',
  reason_code TEXT NOT NULL DEFAULT '',
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  reviewer_key_id TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((case_type = 'sporting_identity' AND player_profile_id IS NOT NULL) OR (case_type = 'legal_identity' AND player_profile_id IS NULL)),
  CHECK ((reviewed_at IS NULL AND reviewed_by_user_id IS NULL AND reviewer_key_id IS NULL)
      OR (reviewed_at IS NOT NULL AND ((reviewed_by_user_id IS NOT NULL AND reviewer_key_id IS NULL)
      OR (reviewed_by_user_id IS NULL AND reviewer_key_id IS NOT NULL)))),
  CHECK (status NOT IN ('verified','rejected') OR reviewed_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS sports_transfer_verification_user_idx
  ON sports_transfer_verification_cases (subject_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sports_transfer_verification_review_idx
  ON sports_transfer_verification_cases (case_type, status, created_at ASC);
CREATE UNIQUE INDEX IF NOT EXISTS sports_transfer_verification_open_profile_idx
  ON sports_transfer_verification_cases (player_profile_id)
  WHERE case_type = 'sporting_identity' AND status IN ('submitted','processing','needs_review','disputed');
CREATE UNIQUE INDEX IF NOT EXISTS sports_transfer_verification_open_legal_user_idx
  ON sports_transfer_verification_cases (subject_user_id)
  WHERE case_type = 'legal_identity' AND status IN ('submitted','processing','needs_review','disputed');
