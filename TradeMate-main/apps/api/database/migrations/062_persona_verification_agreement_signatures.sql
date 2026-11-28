-- Capture a typed full-name electronic signature for the TradeMate Persona Verification Agreement.
-- Existing v1.0 consent records remain immutable; v1.1 requires a new explicit signature.
ALTER TABLE public.persona_verification_agreement_acceptances
  ADD COLUMN IF NOT EXISTS signature_name TEXT;

ALTER TABLE public.persona_verification_agreement_acceptances
  ADD CONSTRAINT persona_verification_agreement_signature_name_check
  CHECK (signature_name IS NULL OR (char_length(btrim(signature_name)) BETWEEN 2 AND 120));

COMMENT ON COLUMN public.persona_verification_agreement_acceptances.signature_name IS
  'Typed full legal name supplied by the account holder as their electronic signature for the versioned verification agreement; not a cryptographic signature.';
