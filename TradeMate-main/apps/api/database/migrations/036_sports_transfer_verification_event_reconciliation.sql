-- Preserve provider references for unmatched events so delayed case mapping can be reconciled.
ALTER TABLE sports_transfer_verification_provider_events
  ADD COLUMN IF NOT EXISTS provider_subject_reference TEXT NOT NULL DEFAULT ''
  CHECK (char_length(provider_subject_reference) <= 200);

CREATE INDEX IF NOT EXISTS sports_transfer_provider_events_unmatched_idx
  ON sports_transfer_verification_provider_events (provider_key, provider_subject_reference, processed_at)
  WHERE verification_case_id IS NULL;
