-- Structured Sports Transfer opportunity drafts. These remain private and unpublished.
-- Existing marketplace listings and the legacy 'sports' division are not modified.

CREATE TABLE IF NOT EXISTS sports_transfer_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL CHECK (sport IN ('football', 'basketball')),
  movement_type TEXT NOT NULL CHECK (
    (sport = 'football' AND movement_type IN (
      'permanent_transfer','loan','loan_with_option','loan_with_obligation',
      'loan_extension','loan_recall','free_agent','pre_contract',
      'player_swap','trial','scouting_invitation','contract_renewal',
      'contract_release','contract_termination','academy_pathway'
    )) OR
    (sport = 'basketball' AND movement_type IN (
      'free_agent_signing','free_agent_resigning','restricted_free_agent',
      'unrestricted_free_agent','player_trade','multi_team_trade',
      'draft_rights','draft_declaration','waiver_claim','contract_assignment',
      'buyout','contract_renewal','contract_release','contract_termination','international_clearance',
      'temporary_assignment','two_way_contract','tryout'
    ))
  ),
  player_profile_id UUID REFERENCES sports_profiles(id) ON DELETE RESTRICT,
  sporting_organization_id UUID REFERENCES sports_organizations(id) ON DELETE RESTRICT,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 5 AND 140),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 5000),
  position_or_role TEXT NOT NULL DEFAULT '' CHECK (char_length(position_or_role) <= 100),
  country_code CHAR(2),
  competition_name TEXT NOT NULL DEFAULT '' CHECK (char_length(competition_name) <= 160),
  season_label TEXT NOT NULL DEFAULT '' CHECK (char_length(season_label) <= 40),
  opportunity_direction TEXT NOT NULL CHECK (opportunity_direction IN ('available','seeking')),
  financial_terms JSONB NOT NULL DEFAULT '{"type":"undisclosed"}'::jsonb
    CHECK (jsonb_typeof(financial_terms) = 'object' AND financial_terms ? 'type')
    CHECK (financial_terms->>'type' IN ('undisclosed','negotiable','structured','not_applicable')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','invitation_only')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','published','paused','closed','rejected','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((player_profile_id IS NOT NULL)::int + (sporting_organization_id IS NOT NULL)::int = 1)
);

CREATE INDEX IF NOT EXISTS sports_transfer_opportunities_player_idx
  ON sports_transfer_opportunities (player_profile_id, status, created_at DESC)
  WHERE player_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sports_transfer_opportunities_org_idx
  ON sports_transfer_opportunities (sporting_organization_id, status, created_at DESC)
  WHERE sporting_organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sports_transfer_opportunities_owner_idx
  ON sports_transfer_opportunities (created_by_user_id, status, created_at DESC);

-- Drafts are not discoverable by public marketplace queries. Submission, review,
-- consent, safeguarding and publication are deliberately separate future steps.
