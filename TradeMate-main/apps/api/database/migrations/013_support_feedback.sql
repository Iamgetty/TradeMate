-- Persistent customer-support tickets, conversations and feedback.
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code TEXT NOT NULL UNIQUE DEFAULT ('TM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (char_length(category) BETWEEN 1 AND 80),
  subject TEXT NOT NULL CHECK (char_length(subject) BETWEEN 2 AND 180),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON support_tickets (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'support', 'system')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 10000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_ticket_messages_order_idx ON support_ticket_messages (ticket_id, created_at, id);

CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('Idea', 'Bug', 'Complaint', 'Praise')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 10000),
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'reviewing', 'planned', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_feedback_user_idx ON user_feedback (user_id, created_at DESC);
