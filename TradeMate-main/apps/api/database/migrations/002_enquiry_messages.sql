-- Conversation replies for marketplace enquiries.
-- Apply after 001_initial_marketplace.sql.
CREATE TABLE IF NOT EXISTS enquiry_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id UUID NOT NULL REFERENCES marketplace_enquiries(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS enquiry_messages_thread_idx
  ON enquiry_messages (enquiry_id, created_at ASC, id);

