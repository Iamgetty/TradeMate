-- Organization verification documents. File bytes are private and only accessible to organization members and authorized reviewers.
CREATE TABLE IF NOT EXISTS organization_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 180),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  file_size INTEGER NOT NULL CHECK (file_size BETWEEN 1 AND 5242880),
  file_data BYTEA NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewer_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organization_documents_org_idx
  ON organization_documents (organization_id, created_at DESC);
