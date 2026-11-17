-- Sports Transfer identity, sporting-organization and authority foundation.
-- This migration deliberately creates private domain records only. No public API is
-- enabled by this migration; access must be implemented with explicit authorization.
-- Existing marketplace division key 'sports' remains unchanged.

CREATE TABLE IF NOT EXISTS sports_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  sport TEXT NOT NULL CHECK (sport IN ('football', 'basketball')),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 100),
  biography TEXT NOT NULL DEFAULT '' CHECK (char_length(biography) <= 1600),
  primary_position TEXT NOT NULL DEFAULT '' CHECK (char_length(primary_position) <= 80),
  country_code CHAR(2),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'connections', 'public')),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, sport)
);
CREATE INDEX IF NOT EXISTS sports_profiles_discovery_idx
  ON sports_profiles (sport, country_code, visibility, created_at DESC)
  WHERE visibility = 'public';

CREATE TABLE IF NOT EXISTS sports_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_mate_organization_id UUID UNIQUE REFERENCES organizations(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('club', 'team', 'academy', 'league', 'federation', 'association', 'agency', 'school', 'university')),
  legal_name TEXT NOT NULL CHECK (char_length(legal_name) BETWEEN 2 AND 180),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 120),
  country_code CHAR(2) NOT NULL,
  governing_body TEXT NOT NULL DEFAULT '' CHECK (char_length(governing_body) <= 160),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected', 'expired')),
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sports_organizations_discovery_idx
  ON sports_organizations (entity_type, country_code, verification_status, display_name);

CREATE TABLE IF NOT EXISTS sports_org_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sports_organization_id UUID NOT NULL REFERENCES sports_organizations(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'sporting_director', 'general_manager', 'recruiter', 'coach', 'legal_adviser', 'scout', 'member')),
  permission_scope TEXT NOT NULL DEFAULT 'workspace' CHECK (permission_scope IN ('workspace', 'recruitment', 'negotiation', 'documents', 'signing', 'read_only')),
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended', 'revoked')),
  invited_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sports_organization_id, user_id),
  CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at)
);
CREATE INDEX IF NOT EXISTS sports_org_memberships_user_idx
  ON sports_org_memberships (user_id, status, sports_organization_id);

CREATE TABLE IF NOT EXISTS sports_player_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_profile_id UUID NOT NULL REFERENCES sports_profiles(id) ON DELETE RESTRICT,
  granted_to_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  granted_to_organization_id UUID REFERENCES sports_organizations(id) ON DELETE RESTRICT,
  purpose TEXT NOT NULL CHECK (purpose IN ('profile_discovery', 'direct_contact', 'opportunity_publication', 'negotiation', 'document_sharing', 'representative_access')),
  scope JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(scope) = 'object'),
  status TEXT NOT NULL DEFAULT 'granted' CHECK (status IN ('granted', 'revoked', 'expired')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((granted_to_user_id IS NOT NULL)::int + (granted_to_organization_id IS NOT NULL)::int = 1),
  CHECK (expires_at IS NULL OR expires_at > granted_at),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);
CREATE INDEX IF NOT EXISTS sports_player_consents_active_idx
  ON sports_player_consents (player_profile_id, purpose, expires_at)
  WHERE status = 'granted' AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS sports_representative_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_profile_id UUID NOT NULL REFERENCES sports_profiles(id) ON DELETE RESTRICT,
  representative_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  representative_organization_id UUID REFERENCES sports_organizations(id) ON DELETE RESTRICT,
  mandate_type TEXT NOT NULL CHECK (mandate_type IN ('agent', 'intermediary', 'legal_adviser', 'guardian_representative')),
  permitted_actions TEXT[] NOT NULL CHECK (cardinality(permitted_actions) > 0 AND permitted_actions <@ ARRAY['view_profile','contact_clubs','create_opportunities','negotiate','share_documents','receive_offers']::TEXT[]),
  territory_codes CHAR(2)[] NOT NULL DEFAULT '{}',
  competition_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected', 'revoked', 'expired')),
  evidence_reference TEXT,
  verified_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  verified_at TIMESTAMPTZ,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((representative_user_id IS NOT NULL)::int + (representative_organization_id IS NOT NULL)::int = 1),
  CHECK (expires_at > COALESCE(starts_at, created_at)),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE INDEX IF NOT EXISTS sports_mandates_player_active_idx
  ON sports_representative_mandates (player_profile_id, status, expires_at);
CREATE INDEX IF NOT EXISTS sports_mandates_representative_user_idx
  ON sports_representative_mandates (representative_user_id, status, expires_at)
  WHERE representative_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sports_guardian_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_profile_id UUID NOT NULL REFERENCES sports_profiles(id) ON DELETE RESTRICT,
  guardian_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('parent', 'legal_guardian', 'court_appointed_guardian')),
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'expired', 'revoked')),
  permitted_actions TEXT[] NOT NULL DEFAULT ARRAY['safeguarding_contact']::TEXT[]
    CHECK (cardinality(permitted_actions) > 0 AND permitted_actions <@ ARRAY['safeguarding_contact','manage_profile_visibility','approve_contact','approve_opportunity','approve_document_sharing']::TEXT[]),
  evidence_reference TEXT,
  verified_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  verified_at TIMESTAMPTZ,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_profile_id, guardian_user_id),
  CHECK (expires_at IS NULL OR expires_at > COALESCE(starts_at, created_at))
);
CREATE INDEX IF NOT EXISTS sports_guardian_player_status_idx
  ON sports_guardian_relationships (player_profile_id, verification_status);

CREATE TABLE IF NOT EXISTS sports_authority_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sports_organization_id UUID REFERENCES sports_organizations(id) ON DELETE RESTRICT,
  subject_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  check_type TEXT NOT NULL CHECK (check_type IN ('organization_identity', 'signatory_authority', 'representative_mandate', 'guardian_authority', 'agent_licence', 'membership_role')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'rejected', 'expired', 'requires_manual_review')),
  source_name TEXT NOT NULL DEFAULT '' CHECK (char_length(source_name) <= 160),
  source_reference TEXT,
  evidence_reference TEXT,
  checked_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  checked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sports_organization_id IS NOT NULL OR subject_user_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS sports_authority_checks_org_idx
  ON sports_authority_checks (sports_organization_id, check_type, status, created_at DESC)
  WHERE sports_organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sports_authority_checks_user_idx
  ON sports_authority_checks (subject_user_id, check_type, status, created_at DESC)
  WHERE subject_user_id IS NOT NULL;

-- No public route is added here. Subsequent API work must check user identity,
-- active membership, mandate scope, explicit consent and guardian requirements
-- before exposing or mutating any record in these tables.
