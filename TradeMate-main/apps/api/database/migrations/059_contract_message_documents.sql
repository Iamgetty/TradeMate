-- Link private-vault negotiation files to the exact contract conversation message.
-- The document itself remains scoped to its contract and participant visibility.
CREATE UNIQUE INDEX IF NOT EXISTS marketplace_contract_messages_id_contract_uidx
  ON public.marketplace_contract_messages (id, contract_id);
CREATE TABLE IF NOT EXISTS public.marketplace_contract_message_documents (
  contract_message_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES public.user_documents(id) ON DELETE RESTRICT,
  contract_id UUID NOT NULL,
  attached_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contract_message_id, document_id),
  UNIQUE (document_id),
  CONSTRAINT marketplace_contract_message_documents_message_contract_fk
    FOREIGN KEY (contract_message_id, contract_id)
    REFERENCES public.marketplace_contract_messages(id, contract_id) ON DELETE CASCADE,
  CONSTRAINT marketplace_contract_message_documents_contract_fk
    FOREIGN KEY (contract_id) REFERENCES public.marketplace_contracts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS marketplace_contract_message_documents_contract_idx
  ON public.marketplace_contract_message_documents (contract_id, created_at DESC);
REVOKE ALL ON TABLE public.marketplace_contract_message_documents FROM PUBLIC;
DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'trademate_app') THEN
    GRANT SELECT, INSERT ON TABLE public.marketplace_contract_message_documents TO trademate_app;
  END IF;
END;
$grants$;
COMMENT ON TABLE public.marketplace_contract_message_documents IS
  'Authenticated links between contract conversation messages and participant-visible vault documents; files remain in the private document vault.';
