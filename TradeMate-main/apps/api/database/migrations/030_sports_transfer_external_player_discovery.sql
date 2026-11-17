-- Source-governed external player discovery foundation.
-- Stores sourced sporting facts only. Contact details, private identifiers, medical data
-- and confidential contract documents must never be stored in these discovery tables.

CREATE TABLE IF NOT EXISTS sports_transfer_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL UNIQUE CHECK (char_length(source_key) BETWEEN 2 AND 100),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 180),
  source_type TEXT NOT NULL CHECK (source_type IN (
    'official_federation','official_league','official_club','official_agent_register',
    'licensed_sports_data','licensed_professional_directory','public_announcement','verified_referral'
  )),
  website_url TEXT NOT NULL DEFAULT '' CHECK (char_length(website_url) <= 2048),
  access_method TEXT NOT NULL DEFAULT 'manual_review' CHECK (access_method IN ('manual_review','licensed_api','licensed_bulk','partner_feed')),
  rights_status TEXT NOT NULL DEFAULT 'candidate' CHECK (rights_status IN ('candidate','under_review','approved','suspended','revoked')),
  rights_basis TEXT NOT NULL DEFAULT '' CHECK (char_length(rights_basis) <= 2000),
  terms_reference TEXT NOT NULL DEFAULT '' CHECK (char_length(terms_reference) <= 2048),
  permitted_data_categories TEXT[] NOT NULL DEFAULT '{}'
    CHECK (permitted_data_categories <@ ARRAY['player_identity','sporting_profile','roster','transfer_activity','availability_status','competition_data','contact_data']::TEXT[]),
  permitted_purposes TEXT[] NOT NULL DEFAULT '{}'
    CHECK (permitted_purposes <@ ARRAY['internal_research','player_discovery','public_sporting_profile','availability_monitoring']::TEXT[]),
  contact_data_permission TEXT NOT NULL DEFAULT 'not_approved'
    CHECK (contact_data_permission IN ('not_approved','under_review','approved','revoked')),
  coverage_sports TEXT[] NOT NULL DEFAULT '{}'
    CHECK (coverage_sports <@ ARRAY['football','basketball']::TEXT[]),
  coverage_country_codes CHAR(2)[] NOT NULL DEFAULT '{}',
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT NOT NULL DEFAULT '' CHECK (char_length(review_note) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    rights_status <> 'approved'
    OR (reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL
        AND char_length(rights_basis) >= 10 AND char_length(terms_reference) >= 3
        AND cardinality(permitted_data_categories) > 0
        AND cardinality(permitted_purposes) > 0)
  ),
  CHECK (
    contact_data_permission <> 'approved'
    OR (rights_status = 'approved' AND 'contact_data' = ANY(permitted_data_categories))
  )
);

CREATE TABLE IF NOT EXISTS sports_transfer_external_player_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID NOT NULL REFERENCES sports_transfer_data_sources(id) ON DELETE RESTRICT,
  sport TEXT NOT NULL CHECK (sport IN ('football','basketball')),
  external_player_key TEXT NOT NULL CHECK (char_length(external_player_key) BETWEEN 1 AND 180),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 160),
  position_or_role TEXT NOT NULL DEFAULT '' CHECK (char_length(position_or_role) <= 100),
  current_team_name TEXT NOT NULL DEFAULT '' CHECK (char_length(current_team_name) <= 180),
  competition_name TEXT NOT NULL DEFAULT '' CHECK (char_length(competition_name) <= 180),
  country_code CHAR(2),
  availability_status TEXT NOT NULL DEFAULT 'unknown' CHECK (
    (sport = 'football' AND availability_status IN (
      'unknown','transfer_listed_reported','loan_listed_reported','out_of_contract_reported',
      'free_agent_reported','free_agent_confirmed','available_for_trial_reported',
      'signed','unavailable','other'
    )) OR
    (sport = 'basketball' AND availability_status IN (
      'unknown','restricted_free_agent_reported','unrestricted_free_agent_reported',
      'waivers_reported','trade_available_reported','draft_eligible_reported',
      'draft_rights_available_reported','free_agent_confirmed','signed','unavailable','other'
    ))
  ),
  source_record_url TEXT NOT NULL DEFAULT '' CHECK (char_length(source_record_url) <= 2048),
  source_published_at TIMESTAMPTZ,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  confidence_score NUMERIC(5,4) CHECK (confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1),
  review_status TEXT NOT NULL DEFAULT 'pending_review' CHECK (review_status IN ('pending_review','approved','rejected','stale','withdrawn')),
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT NOT NULL DEFAULT '' CHECK (char_length(review_note) <= 2000),
  claimed_profile_id UUID REFERENCES sports_profiles(id) ON DELETE RESTRICT,
  claim_status TEXT NOT NULL DEFAULT 'unclaimed' CHECK (claim_status IN ('unclaimed','pending','verified','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (data_source_id, sport, external_player_key),
  CHECK (expires_at IS NULL OR expires_at > observed_at),
  CHECK ((reviewed_at IS NULL) = (reviewed_by_user_id IS NULL)),
  CHECK (review_status <> 'approved' OR (reviewed_at IS NOT NULL AND reviewed_by_user_id IS NOT NULL)),
  CHECK ((claim_status = 'verified') = (claimed_profile_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS sports_transfer_external_player_discovery_idx
  ON sports_transfer_external_player_records (sport, availability_status, review_status, observed_at DESC);
CREATE INDEX IF NOT EXISTS sports_transfer_external_player_source_idx
  ON sports_transfer_external_player_records (data_source_id, review_status, observed_at DESC);
CREATE INDEX IF NOT EXISTS sports_transfer_external_player_claim_idx
  ON sports_transfer_external_player_records (claimed_profile_id)
  WHERE claimed_profile_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sports_transfer_external_player_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_player_record_id UUID NOT NULL REFERENCES sports_transfer_external_player_records(id) ON DELETE RESTRICT,
  data_source_id UUID NOT NULL REFERENCES sports_transfer_data_sources(id) ON DELETE RESTRICT,
  change_type TEXT NOT NULL CHECK (change_type IN ('created','source_refresh','availability_changed','corrected','reviewed','staled','withdrawn','claimed')),
  previous_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(previous_snapshot) = 'object'),
  current_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(current_snapshot) = 'object'),
  source_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS sports_transfer_external_player_history_idx
  ON sports_transfer_external_player_history (external_player_record_id, recorded_at DESC);

-- No contact columns are intentionally present. No public discovery route is enabled
-- by this schema. Future ingestion must require an approved source and permitted
-- sporting-data purpose; public display additionally requires review and freshness.
