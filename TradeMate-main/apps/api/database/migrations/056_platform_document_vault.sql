-- TradeMate platform document vault.
-- Private bytes stay in PostgreSQL until a separately reviewed object-storage migration.
-- Access is granted only by the authenticated owner, organization membership, or contract participation.
CREATE TABLE IF NOT EXISTS user_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'account', 'email_verification', 'identity_verification', 'persona_agreement',
    'organization_registration', 'organization_verification', 'contract',
    'contract_negotiation', 'marketplace_transaction', 'user_upload'
  )),
  source_id UUID,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'agreement', 'identity', 'address', 'organization', 'contract',
    'statement', 'receipt', 'invoice', 'negotiation', 'other'
  )),
  document_status TEXT NOT NULL DEFAULT 'received' CHECK (document_status IN (
    'draft', 'generated', 'received', 'signed', 'archived'
  )),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'organization', 'contract_participants')),
  file_name TEXT NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 180),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  file_size INTEGER NOT NULL CHECK (file_size BETWEEN 1 AND 10485760),
  file_sha256 CHAR(64) NOT NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  file_data BYTEA NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (visibility <> 'organization' OR organization_id IS NOT NULL),
  CHECK (visibility <> 'contract_participants' OR (source_type IN ('contract', 'contract_negotiation') AND source_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS user_documents_owner_created_idx
  ON user_documents (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_documents_org_created_idx
  ON user_documents (organization_id, created_at DESC) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_documents_source_idx
  ON user_documents (source_type, source_id, created_at DESC) WHERE source_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS user_document_access (
  document_id UUID NOT NULL REFERENCES user_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  access_reason TEXT NOT NULL CHECK (access_reason IN ('contract_participant', 'explicit_share')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, user_id)
);
CREATE INDEX IF NOT EXISTS user_document_access_user_idx
  ON user_document_access (user_id, created_at DESC);
