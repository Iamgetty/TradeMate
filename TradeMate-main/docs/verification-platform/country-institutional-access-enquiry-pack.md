# VeriFire country institutional-access enquiry pack

**Status:** Research and outreach preparation only — no enquiries sent, no provider selected, no access granted.  
**Markets:** Nigeria and Ghana  
**Purpose:** Obtain written answers from the competent identity authorities and their approved access channels before designing or implementing any integration.

## Guardrails

- VeriFire is an API-first verification engine. The customer/installer owns its user interface, notices, consent capture and result presentation.
- Customer-facing apps must call the customer's own backend. No authority credentials, aggregator secrets or VeriFire server-side keys may be exposed in browser/mobile code.
- Do not collect or retain end-user passwords or national-ID portal credentials.
- Do not send live identity data, biometric samples or production traffic during discovery.
- Do not assume a provider, aggregator, authority or customer can authorize another party's access without explicit written approval.
- Obtain counsel's view on controller/processor/subprocessor roles, lawful basis, cross-border transfer and retention before a pilot.

## Nigeria — NINAuth / NIMC

### Verified public process

NINAuth's official private-sector guidance says an applicant must be subject to the Nigeria Data Protection Act, maintain a physical presence in Nigeria, use an approved Verification Partner, obtain informed consent, restrict use to approved purposes, apply security/access controls and logging, provide compliance reports and accept independent audits. The applicant contracts with an approved partner/aggregator, which facilitates the NIMC application and connection.

Official references:
- [NINAuth Verification Partner eligibility and onboarding](https://ninauth.nimc.gov.ng/verification-partner)
- [NINAuth approved-partner lookup](https://ninauth.nimc.gov.ng/approved-partners)
- [NINAuth Get Started / user flows](https://ninauth.nimc.gov.ng/get-started)
- [NINAuth Terms of Service](https://ninauth.nimc.gov.ng/legal/terms-of-service)
- NINAuth contact published on its official site: ninauth@nimc.gov.ng

### Questions for NINAuth / NIMC

1. Is VeriFire eligible to apply as the verification partner or enterprise applicant, given its current corporate structure and Nigerian physical-presence position?
2. If a Nigerian customer is the approved enterprise applicant, may VeriFire act as its processor or subprocessor and operate the integration server-to-server? What written approval and contract clauses are required?
3. Which approved aggregators currently support enterprise use, and how can their current authorization be independently verified?
4. For each supported flow (QR, share code, raw-NIN matching), what exact APIs/SDKs, data fields, consent evidence, assurance level and user journey are required?
5. Does the selected flow require the end user to use the NINAuth app or present a code? What accessibility and fallback options are authorized?
6. What are the permitted purposes and restrictions by industry (fintech, lending, marketplaces, payments, telecoms)?
7. What are the transaction fees, minimum commitments, rate limits, uptime/SLA, sandbox availability, support and incident-notification terms?
8. Which party is controller, processor or independent controller for each data element and each audit record?
9. What data is retained by NIMC, the aggregator and the enterprise; for how long; where; and under what deletion, legal-hold and data-subject request rules?
10. NINAuth's published terms describe indefinite retention of verification transactions and consent/audit records, with archival after 90 days of inactivity. Do these terms apply to the proposed enterprise/partner service? Can a DPA or service agreement specify retention, deletion and lawful exceptions?
11. Are biometric templates or raw biometric samples ever transmitted to or stored by the enterprise, aggregator or VeriFire? If not, what response metadata is returned?
12. What audit scope, frequency, reporting format, independent-auditor requirements and remediation timelines apply?
13. What security certifications, penetration-test evidence, encryption requirements, key-management controls and breach-notification SLAs are mandatory?
14. Are data transfers outside Nigeria permitted for the proposed service? What NDPC transfer mechanism and approvals/evidence are required?

### Draft enquiry

**To:** ninauth@nimc.gov.ng  
**Subject:** Request for clarification — NINAuth enterprise eligibility and approved integration model

Dear NINAuth Team,

We are assessing a privacy-preserving, server-to-server identity-verification integration for Metadusk VeriFire. Before selecting an approved integration route, we would appreciate written clarification on eligibility and the required contracting structure.

In particular, please confirm:
- whether a non-Nigerian technology platform may participate as an authorized processor/subprocessor for a Nigerian enterprise applicant;
- the Nigerian physical-presence requirement and how it applies to the enterprise applicant versus its technology provider;
- the current approved Verification Partner/aggregator directory and the process for validating partner authorization;
- supported integration flows, technical documentation, sandbox access and permitted identity-verification purposes;
- data roles, retention/deletion, audit, security and cross-border-transfer requirements; and
- applicable fees, service levels and onboarding stages.

We will not transmit live identity data or initiate production access during this assessment. We can provide our corporate, security and data-protection documentation through your approved channel when you advise which materials are required.

Kind regards,  
[Authorized representative]  
[Legal entity]  
[Business address / Nigerian presence details]  
[Business email and telephone]

## Ghana — National Identification Authority (NIA) IVSP

### Verified public process

NIA's published process requires an institution to submit a request form and, after NIA responds, provide relevant business registration, regulator licence, legal authority to collect personal data, valid Data Protection Commission certification, SSNIT certificate (where applicable), business profile, process flow and requested datasets. NIA reviews the materials, schedules a discussion and grants access only after technical infrastructure is set up and a direct identity-verification contract is executed.

NIA's 16 July 2026 notice says L.I. 2523 took effect on 9 June 2026. Where biometric verification is available, real-time biometric verification is required; visual inspection and photocopying/scanning/retaining Ghana Card copies for identity verification are not permitted except where law allows.

Official references:
- [NIA Identity Verification Services and onboarding process](https://nia.gov.gh/service/verification-services/)
- [NIA IVSP user request form](https://nia.gov.gh/wp-content/uploads/IVSP-User-Request-Form_v2.225F.pdf)
- [NIA L.I. 2523 implementation notice](https://nia.gov.gh/government-makes-biometric-verification-mandatory-for-ghana-card-verification-under-new-l-i-2523/)
- NIA IVSP onboarding email published by NIA: idverification@nia.gov.gh

### Questions for NIA

1. Can a foreign technology provider participate as an authorized processor/subprocessor for a Ghanaian institution that is the direct NIA contracting party?
2. Must VeriFire itself be incorporated, registered or licensed in Ghana, or can a Ghanaian customer be the applicant and contract holder?
3. What exact legal authority must an applicant demonstrate for each intended use case (KYC, lending, payments, marketplace onboarding, KYB)?
4. What current DPC certification/registration evidence is required from the institution and from its processors/subprocessors?
5. Which biometric modalities are supported (for example, face or fingerprint), and what are the liveness, device, quality and accessibility requirements?
6. What is the approved consent and notice sequence? Can consent be captured in the customer's own UI, and what evidence must be passed to NIA?
7. What happens when a user cannot complete biometric verification or the modality is unavailable? What alternative is legally permitted?
8. Which identity attributes can be returned, and can the institution request a minimum field set for each use case?
9. Are raw biometric samples, biometric templates or Ghana Card images ever returned to or retained by the institution or its technology provider?
10. What are the API specifications, authentication method, sandbox/test environment, rate limits, uptime/SLA, support and incident-notification terms?
11. What are the fees, minimum volumes, implementation charges and contract duration?
12. What retention/deletion, audit, access logging, security assessment and cross-border transfer requirements apply to the institution and its technology providers?

### Draft enquiry

**To:** idverification@nia.gov.gh  
**Subject:** Request for institutional guidance — NIA IVSP eligibility and authorized technology-provider model

Dear NIA IVSP Team,

We are assessing a server-to-server integration with the NIA Identity Verification System Platform for Metadusk VeriFire, a headless verification service intended to support institutions through their own customer-facing applications and backend systems.

Before submitting a formal application, please clarify:
- whether a Ghanaian customer may be the direct NIA applicant and contracting institution while VeriFire participates as its authorized processor/subprocessor;
- whether VeriFire itself must be incorporated, registered or licensed in Ghana;
- the required legal authority, business/regulatory documents and DPC certification for the applicant and its technology providers;
- supported real-time biometric modalities, consent requirements, technical specifications and sandbox access;
- permitted fallback and exception handling where biometric verification is unavailable or unsuccessful;
- data fields returned, retention/deletion, audit and cross-border-transfer requirements; and
- fees, service levels and onboarding timelines.

We understand that L.I. 2523 took effect on 9 June 2026 and that visual-only Ghana Card checks and retaining card copies for identity verification are not acceptable where the law requires real-time biometric verification. We do not intend to build a card-image or visual-only verification flow.

Please advise the correct formal application route and the documentation you would require for an initial institutional assessment.

Kind regards,  
[Authorized representative]  
[Legal entity]  
[Applicant institution, if different]  
[Business address / Ghana presence details]  
[Business email and telephone]

## Decision gates before any integration

| Gate | Evidence required | Current status |
|---|---|---|
| Applicant eligibility | Written authority/aggregator confirmation of applicant and platform roles | Open |
| Contracting chain | Executed agreement(s), explicit processor/subprocessor authorization and flow-down obligations | Open |
| Lawful purpose | Country-specific legal analysis and customer use-case approval | Open |
| Privacy | DPA, data map, retention/deletion, transfer mechanism and data-subject handling | Open |
| Security | Technical specifications, threat model, key management, audit and incident obligations | Open |
| Technical | Official API docs, sandbox, test credentials, error semantics and SLA | Open |
| Commercial | Verified pricing, minimums, support and termination terms | Open |
| Product readiness | Installer-owned consent UI and backend-to-backend integration; no VeriFire-hosted customer UI | Open |

**No outreach has been sent.** These drafts are prepared for review and must be completed with the actual applicant entity, legal status and Nigerian/Ghanaian presence details before sending.
