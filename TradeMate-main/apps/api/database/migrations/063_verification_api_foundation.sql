-- Provider-neutral verification cases and sanitized lifecycle events.
-- Raw identity documents, national identifiers, biometrics and provider payloads do not belong here.
CREATE TABLE IF NOT EXISTS public.verification_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_type TEXT NOT NULL CHECK (case_type IN ('kyc','kyb')),
  subject_user_id UUID REFERENCES public.users(id) ON DELETE RESTRICT,
  subject_organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  created_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  country_code CHAR(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  entity_type TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','pending','in_review','needs_information','approved','rejected','expired','cancelled')),
  risk_tier TEXT NOT NULL DEFAULT 'standard'
    CHECK (risk_tier IN ('standard','elevated','high','restricted')),
  policy_version TEXT NOT NULL,
  provider_key TEXT,
  provider_reference TEXT,
  idempotency_key TEXT,
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (case_type = 'kyc' AND subject_user_id IS NOT NULL AND subject_organization_id IS NULL)
    OR
    (case_type = 'kyb' AND subject_user_id IS NULL AND subject_organization_id IS NOT NULL)
  ),
  CHECK (idempotency_key IS NULL OR char_length(idempotency_key) BETWEEN 8 AND 128)
);

CREATE INDEX IF NOT EXISTS verification_cases_user_idx
  ON public.verification_cases (subject_user_id, created_at DESC)
  WHERE subject_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS verification_cases_org_idx
  ON public.verification_cases (subject_organization_id, created_at DESC)
  WHERE subject_organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS verification_cases_status_idx
  ON public.verification_cases (status, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS verification_cases_user_idempotency_idx
  ON public.verification_cases (created_by_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.verification_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.verification_cases(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL CHECK (check_type IN (
    'identity','document_authenticity','liveness','registry','ownership',
    'representative_authority','sanctions','pep','adverse_media','address','phone','email'
  )),
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','pending','passed','failed','review_required','not_applicable')),
  provider_key TEXT,
  provider_reference TEXT,
  result_code TEXT,
  result_summary TEXT,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, check_type)
);
CREATE INDEX IF NOT EXISTS verification_checks_case_idx
  ON public.verification_checks (case_id, created_at);

CREATE TABLE IF NOT EXISTS public.verification_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.verification_cases(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type ~ '^verification\\.[a-z_]+$'),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_events_case_idx
  ON public.verification_events (case_id, created_at, id);

CREATE TABLE IF NOT EXISTS public.verification_country_policies (
  country_code CHAR(2) PRIMARY KEY CHECK (country_code ~ '^[A-Z]{2}$'),
  policy_version TEXT NOT NULL,
  policy_status TEXT NOT NULL CHECK (policy_status IN ('draft','active','suspended')),
  supported_case_types TEXT[] NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(configuration) = 'object'),
  effective_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.verification_country_policies
  (country_code, policy_version, policy_status, supported_case_types, configuration)
VALUES
  ('NG', 'NG-0.1-draft', 'draft', ARRAY['kyc','kyb']::TEXT[],
   '{"registry":"CAC manual evidence pending authorized integration","identity":"Existing Persona integration pending staging runtime acceptance","automated_decisions":false}'::jsonb)
ON CONFLICT (country_code) DO NOTHING;

REVOKE ALL ON TABLE public.verification_cases, public.verification_checks,
  public.verification_events, public.verification_country_policies FROM PUBLIC;
DO $grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'trademate_app') THEN
    GRANT SELECT, INSERT, UPDATE ON public.verification_cases TO trademate_app;
    GRANT SELECT, INSERT, UPDATE ON public.verification_checks TO trademate_app;
    GRANT SELECT, INSERT ON public.verification_events TO trademate_app;
    GRANT SELECT ON public.verification_country_policies TO trademate_app;
    GRANT USAGE, SELECT ON SEQUENCE public.verification_events_id_seq TO trademate_app;
  END IF;
END;
$grants$;

COMMENT ON TABLE public.verification_cases IS
  'Provider-neutral KYC/KYB workflow cases. Subject identity is explicit; approval requires separately completed policy checks.';
COMMENT ON TABLE public.verification_checks IS
  'Normalized verification check outcomes. Never store raw identity numbers, biometrics, documents or unredacted provider payloads.';
COMMENT ON TABLE public.verification_events IS
  'Append-only sanitized lifecycle events for verification cases; intended for authenticated REST/socket delivery.';
COMMENT ON TABLE public.verification_country_policies IS
  'Versioned country verification policy registry. Draft policies are discoverable but cannot be used to auto-approve cases.';
