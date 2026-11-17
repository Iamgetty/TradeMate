-- Provider webhook inbox: persist only event identifiers and payload hashes, never raw identity payloads.
CREATE TABLE IF NOT EXISTS sports_transfer_verification_provider_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key TEXT NOT NULL CHECK (provider_key IN ('sumsub','veriff','trulioo','sandbox')),
  provider_event_id TEXT NOT NULL CHECK (char_length(provider_event_id) BETWEEN 1 AND 200),
  verification_case_id UUID REFERENCES sports_transfer_verification_cases(id) ON DELETE RESTRICT,
  payload_sha256 CHAR(64) NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  mapped_outcome TEXT NOT NULL CHECK (mapped_outcome IN ('succeeded','failed','review_required','unmatched')),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_key, provider_event_id)
);
CREATE INDEX IF NOT EXISTS sports_transfer_provider_events_case_idx
  ON sports_transfer_verification_provider_events (verification_case_id, processed_at DESC);
