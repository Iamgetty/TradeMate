-- Per-user read state for marketplace enquiry conversations.
-- Each participant (including each member of a seller organization) has independent read state.
CREATE TABLE IF NOT EXISTS enquiry_reads (
  enquiry_id UUID NOT NULL REFERENCES marketplace_enquiries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (enquiry_id, user_id)
);
CREATE INDEX IF NOT EXISTS enquiry_reads_user_idx ON enquiry_reads (user_id, last_read_at DESC);
