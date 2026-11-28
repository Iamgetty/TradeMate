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

### Additional technical candidate — Enhanced NIMC Verification System (eNVS)

NIMC's publicly hosted [Enhanced NIMC Verification System (eNVS) Web Service API Document, Version 1.0](https://nimc.gov.ng/pdfs/nimc_eNVS_API_doc.pdf) describes a separate institutional web-service interface. It is a technical specification, not proof that Metadusk or a customer is currently eligible for access.

The document's stated connection sequence is:
1. Establish connectivity to the service through a VPN.
2. Call `createToken` using an organisation username, password and organisation ID.
3. Use the returned `loginString` for subsequent calls; the document says tokens expire and must be refreshed.

Documented methods include `getPermissionByLevel`, `searchByNIN`, `searchByDemo`, `searchByDemoPhone`, `searchByDocumentNumber`, fingerprint search methods and `verifyFingerWithData`. Permission responses expose field-level booleans for attributes including names, NIN, date of birth, address, phone, photo, signature and other sensitive demographic fields. The specification therefore reinforces the need for strict purpose limitation and field minimization.

**Technical limitation:** the publicly accessible document does not provide a usable service endpoint, WSDL location, transport binding, network allowlisting procedure, complete deployment guide or sandbox details. It is not sufficient to write a production adapter. No endpoint, protocol variant, VPN topology or credential flow beyond what the document states should be inferred.

**Access and governance remain unverified:** the document does not establish current programme status, applicant eligibility, whether customer-held eNVS access may be delegated to a technology processor, permitted use cases, pricing, SLA, retention, audit terms or whether eNVS is integrated with or separate from the current NINAuth partner process. Treat eNVS as a candidate institutional route pending written NIMC confirmation, not as an approved route or an alternative that bypasses NINAuth eligibility.

#### Specific eNVS questions for NIMC

1. Is this Version 1.0 eNVS specification current and supported for new institutional integrations in 2026?
2. Is eNVS a separate access programme from NINAuth, or must an enterprise first qualify through NINAuth and an approved Verification Partner/aggregator?
3. What applicant categories qualify for eNVS credentials and organisation IDs? Does the applicant need a Nigerian physical presence or local incorporation?
4. Can an eligible Nigerian customer remain the credential-holding applicant while authorizing VeriFire as a named processor/subprocessor to operate the server-side integration? Is prior written NIMC approval required?
5. Please provide the current service endpoint(s), WSDL or equivalent machine-readable interface contract, supported transport/security bindings, request/response examples, error catalogue and version/change policy.
6. What VPN type, gateway ownership, IP allowlisting, network topology, certificate requirements, supported hosting regions and connection-monitoring controls are required?
7. What are the credential issuance, rotation, reset, token lifetime, revocation and emergency-compromise procedures? Can credentials be restricted by user, organisation, method and field?
8. Which methods, fields and assurance levels may be authorized for each applicant and purpose? Are biometric methods separately approved?
9. Is there a sandbox or non-production environment with synthetic records, and what test credentials and acceptance process are available?
10. What are the transaction fees, rate limits, concurrency limits, availability commitments, support channels and incident-notification obligations?
11. What are the permitted purposes, consent evidence requirements, audit scope, retention/deletion rules and restrictions on downstream processor access?
12. Are cross-border hosting and processing permitted for the applicant's approved integration, and what NDPA/NDPC transfer safeguards or approvals are required?

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



## Kenya — National Registration Bureau (NRB) / Health ID

### Verified public position

Kenya's official eCitizen Health ID service describes biometric eKYC using face or fingerprint capture, liveness checks and matching against the National Registration Bureau's national biometrics database. Its published FAQ says the service can be used by government agencies, financial institutions, healthcare providers and private companies, and describes authorized entities receiving identity data. This is a concrete government-described institutional service, but the public pages do not disclose the onboarding criteria, API contract, pricing, contracting party, processor delegation model or technical access procedure. Do not infer that any private company is automatically authorized.

Official references:
- [eCitizen Health ID](https://ekyc.ecitizen.go.ke/)
- [Health ID help and support](https://ekyc.ecitizen.go.ke/help-and-support) — support@ecitizen.go.ke; +254 207 903 260
- [National Registration Bureau on eCitizen](https://nrb.ecitizen.go.ke/)

### Material privacy and biometric requirements

The ODPC's official FAQ says controllers and processors handling Kenyan data subjects' personal data must register even when not established in Kenya. It identifies biometric data as sensitive personal data. The ODPC's 2025 Biometric Data Guidance further states:
- All entities processing biometric data must register with the ODPC as controllers and/or processors.
- Biometric processing requires a lawful basis and additional sensitive-data conditions, transparent notices, purpose limitation and minimization.
- A DPIA is required before high-risk biometric processing; the guidance says it must be conducted and submitted at least 60 days before biometric processing begins.
- At least one full, up-to-date serving copy of biometric data must be stored in a data centre located in Kenya.
- Biometric data breaches must be reported to the ODPC within 72 hours and affected data subjects without undue delay.

These requirements are significant architecture gates. A generic offshore-only biometric storage design is not acceptable without a Kenya-specific compliant arrangement and legal review.

Official references:
- [ODPC FAQ — controller/processor registration and territorial scope](https://odpc.go.ke/faqs/)
- [ODPC Guidance Notes on Biometric Data (2025)](https://www.odpc.go.ke/wp-content/uploads/2025/11/ODPC-%E2%80%93-Guidance-Note-on-Biometric-Data.pdf)
- [ODPC Guidance Notes for Cross-border Data Transfers (2026)](https://odpc.go.ke/wp-content/uploads/2026/09/ODPC-%E2%80%93-Guidance-Notes-for-Cross-border-Data-Transfers.pdf)

### Questions for NRB / eCitizen Health ID

1. Is Health ID currently open to new private-sector institutional integrations, and which legal entity/agency is the contracting authority?
2. What types of private companies and regulated institutions qualify as authorized entities? Are foreign companies eligible?
3. Can a Kenyan customer be the applicant and contract holder while a foreign technology platform operates the integration as its expressly authorized processor/subprocessor?
4. Does NRB/eCitizen require the technology processor itself to be incorporated, registered or physically present in Kenya?
5. What are the formal onboarding stages, application documents, approvals, fees and expected timelines?
6. Please provide the current API/SDK specifications, endpoints, authentication and signing requirements, supported biometric modalities, liveness rules, device requirements and error catalogue.
7. Is a sandbox with synthetic identities available? What is the certification and production acceptance process?
8. Which attributes and verification outcomes may be returned, and can the customer select a minimum attribute set per lawful purpose?
9. Are biometric samples or templates exposed to the customer or technology processor, or does NRB return only a match result and approved attributes?
10. What Kenya data-centre/localization model is required for biometric data, and does the service retain a serving copy on behalf of the institution?
11. What are the controller/processor roles, consent evidence requirements, audit rights, retention/deletion rules and cross-border processing restrictions?
12. What are the transaction charges, rate limits, availability SLA, support arrangements and breach-notification requirements?

### Draft enquiry

**To:** support@ecitizen.go.ke  
**Subject:** Institutional integration enquiry — Health ID biometric eKYC and authorized technology-provider model

Dear eCitizen / Health ID Support Team,

We are assessing the official Health ID service for a potential institutional integration with Metadusk VeriFire, a headless, server-to-server verification platform. We understand from the public Health ID materials that authorized entities may use biometric eKYC with liveness and matching against NRB records.

Before any technical or commercial commitment, please direct us to the responsible NRB/Health ID institutional onboarding team and clarify:
- eligibility and application requirements for private-sector and foreign institutions;
- whether a Kenyan customer can be the direct applicant and contracting party while VeriFire operates as an expressly authorized processor/subprocessor;
- required local establishment, registration and approval status for the applicant and technology provider;
- current API/SDK documentation, sandbox, certification and production access procedure;
- biometric modalities, consent evidence, permitted attributes, and whether raw samples/templates are disclosed;
- Kenya biometric data-localization, DPIA, retention/deletion, audit and cross-border requirements; and
- pricing, rate limits, SLA, support and incident-notification terms.

We will not request or process live identity data during this assessment. Please advise the formal institutional enquiry route and documentation required.

Kind regards,
[Authorized representative]
[Legal entity]
[Business address]
[Business email and telephone]

## Uganda — National Identification and Registration Authority (NIRA)

### Verified public position

Uganda's Registration of Persons Act 2015 provides that access to the National Identification Register by non-government persons is governed by regulations. The Registration of Persons (Access and Use of Information) Regulations, 2015 require a non-government applicant to apply to NIRA in Form 1. The application must identify the person whose information is sought, the applicant's address, the applicant's capacity where acting for another person and the purpose. An individual-record request must be accompanied by the data subject's consent in the prescribed Form 2. NIRA may refuse access where privacy, state security or other grounds warrant refusal; fees apply.

Separately, NIRA published a PKI-secured-services initiative seeking vetted, registered third-party providers to support:
- e-consent for eKYC, where a citizen can consent to a third party's request for information in the National Identification Register through a fingerprint-matched, secure PKI workflow; and
- point-of-service verification of digitally signed documents generated from the NIRA portal.

The published initiative requests proposals describing workflows and PKI infrastructure. It is not proof that a general-purpose commercial API is available, that a current procurement/onboarding window is open, or that VeriFire has been selected/approved. It is, however, a promising institutional engagement path because it explicitly contemplates third-party eKYC providers and citizen-mediated consent.

Official references:
- [Registration of Persons (Access and Use of Information) Regulations, 2015](https://www.nira.go.ug/media/2022/08/Access-and-Use-of-Information.pdf)
- [NIRA PKI-secured services initiative](https://www.nira.go.ug/media/2024/02/Provision-of-PKI-Secured-Services.pdf)
- [Registration of Persons Act 2015](https://www.nira.go.ug/publications/registration-of-person-act-2015-2)
- NIRA contact: info@nira.go.ug; +256 312 119 600 / +256 312 119 631 / +256 312 119 639.

### Privacy and cross-border requirements

Uganda's Data Protection and Privacy Regulations, 2021, regulation 30, restrict processing or storage outside Uganda unless the organisation demonstrates adequate protection in the destination country or obtains the data subject's consent; further onward transfer requires express consent. The current PDPO portal says organisations collecting personal data must register as a controller, processor or collector and obtain a certificate before processing. The 2025 Google decision is also relevant to offshore providers: Ugandan obligations can apply regardless of where an organisation is based. Obtain Uganda counsel's confirmation of the current statutory text and the application of the regulations to the proposed data flow before selecting hosting regions.

Official references:
- [Uganda Data Protection and Privacy Regulations, 2021](https://pdpo.go.ug/media/2022/03/Data_Protection_and_Privacy_Regulations-2021.pdf)
- [Personal Data Protection Office (PDPO)](https://pdpo.go.ug/)
- [PDPO registration guidance and resources](https://pdpo.go.ug/knowledge-center/resources)
- [PDPO decision: Ssekamwa Frank & others v Google LLC](https://pdpo.go.ug/media/2025/07/Ssekamwa-Frank-3-Ors-vs-Google-LLC-PDPO-Decision-18th-July-2024.pdf)

### Questions for NIRA

1. Is the 2024 PKI-secured-services initiative still active, and is NIRA onboarding additional third-party providers for e-consent/eKYC?
2. Is there a separate route for an institution to apply under the 2015 Access and Use Regulations without becoming a PKI service provider?
3. Can a foreign technology provider apply directly, or must an eligible Ugandan institution be the applicant and contracting party?
4. Can a Ugandan customer appoint VeriFire as a named processor/subprocessor to operate the integration, and what written NIRA approval is required?
5. What are the current application forms, eligibility criteria, supporting documents, fees and approval stages for commercial use?
6. What lawful purposes and sectors are eligible, and are there restrictions on lending, fintech, telecoms, marketplaces or fraud prevention?
7. What consent form and proof are required for each request? Can the customer's own interface collect consent and pass verifiable evidence to NIRA?
8. What fields and verification methods are available, and are biometric templates/samples ever disclosed to third parties?
9. Please provide current API specifications, endpoints, authentication, PKI/certificate profiles, signing and verification requirements, sandbox and test process.
10. What hosting, encryption, key custody, local presence, audit, retention/deletion and incident-response controls are mandatory?
11. What restrictions apply to processing or storing NIRA data outside Uganda, and what evidence does PDPO/NIRA require for the proposed architecture?
12. What are the transaction fees, minimum commitments, rate limits, SLA, support and service continuity arrangements?

### Draft enquiry

**To:** info@nira.go.ug  
**Subject:** Institutional enquiry — NIR eKYC access, PKI e-consent initiative and authorized technology-provider model

Dear NIRA Team,

We are assessing a privacy-preserving institutional integration with the National Identification Register for Metadusk VeriFire, a headless verification platform. We reviewed the Registration of Persons (Access and Use of Information) Regulations, 2015 and NIRA's published PKI-secured-services initiative describing citizen e-consent for eKYC and point-of-service verification of digitally signed documents.

Please advise:
- whether NIRA is currently onboarding third-party providers under the PKI-secured-services initiative;
- whether there is a separate institutional access route under the 2015 Regulations for an eligible Ugandan customer;
- whether a Ugandan institution may be the applicant and contracting party while VeriFire is an expressly authorized processor/subprocessor;
- the applicable eligibility, consent, purpose, application, fee and approval requirements;
- current technical specifications, PKI/certificate requirements, sandbox and production certification;
- permitted data fields, biometric handling, retention/deletion, audit and security obligations; and
- Uganda data-protection, local hosting and cross-border processing requirements for the proposed arrangement.

We will not request or process live NIR records during this assessment. Please direct us to the responsible institutional-access or technical team and the current formal application materials.

Kind regards,
[Authorized representative]
[Legal entity]
[Business address]
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


## Rwanda — National Identification Agency (NIDA) / Single Digital Identity (SDID)

### Verified public position

NIDA's nationwide identity-detail verification and photography exercise concluded on 4 October 2026. NIDA reported 13,725,589 people photographed and described the objective as consolidating records into a unified digital identity profile. This confirms an active national identity modernization programme, not commercial API availability.

RISA's 2026 procurement for biometric verification endpoint technologies is a concrete SDID ecosystem signal. It is a multi-supplier, multi-user framework for NIDA and other specifically authorized government institutions. The published procurement portal records an extension of the bid-submission deadline to 13 May 2026; that primary procurement window has passed. The documents do not establish an open commercial API or automatic private-sector eligibility.

The consolidated procurement clarifications state that SDID Core is the master demographic/credential repository and identify AMBAS/ABIS, IDAM, Irembo, audit ingestion and Rwanda NPKI as related components. Interoperability is expected through REST/JSON, TLS 1.3 with mutual TLS, OAuth 2.0 and OIDC/SAML as applicable. Detailed API specifications and sandbox credentials are provided to awarded suppliers at Call-off Contract stage. For the framework, personal data, biometrics, logs and analytics must be hosted in Rwanda; cross-border transmission or mirroring requires explicit written NIDA approval and NDPO compliance. A DPA with NIDA is required at Call-off stage, and NDPO registration applies as required.

Official references:
- [NIDA — digital ID verification exercise completed 4 October 2026](https://www.nida.gov.rw/news-details/abarenga-miliyoni-13-nibo-bamaze-gufotorerwa-e-ndangamuntu-mu-gihe-cyumwaka)
- [RISA — biometric verification endpoint procurement](https://www.risa.gov.rw/publications/tenders)
- [RISA — consolidated bidder clarification responses](https://www.risa.gov.rw/fileadmin/user_upload/RISA/Publications/Tenders/Consolidated_Bidder_Clarification_Responses_for_biometric_verification_endpoint_technologies.pdf)
- NIDA: info@nida.gov.rw; call centre 3500.
- RISA procurement: rdapprocurement@risa.gov.rw.

### Privacy and data-residency requirements

Law No. 058/2021 applies to entities established in Rwanda and to foreign entities processing personal data of people located in Rwanda. The DPO FAQ says controllers and processors intending to process personal data must register; biometric data is sensitive personal data and a DPO must be designated.

Articles 48–50 govern international transfer and storage. Transfers require an applicable legal ground; supervisory authorization supported by safeguards is one route, with other limited statutory grounds. Article 49 requires a written allocation of roles and responsibilities for authorized access or transfers. Personal data must be stored in Rwanda unless a valid supervisory-authority authorization/certificate permits storage outside Rwanda. Article 52 limits retention to the purpose period unless a listed ground justifies longer retention, followed by secure destruction.

Official references:
- [DPO — institutional FAQ](https://dpo.gov.rw/faqs)
- [DPO — Articles 48–52](https://dpo.gov.rw/dpp-law/sharing-transferstorage-and-retention-of-personal-data)
- [DPO — scope and definitions](https://dpo.gov.rw/dpp-law/general-provisions)

### Questions for NIDA / RISA

1. Is SDID currently accepting non-government institutional participants, or is access limited to NIDA and specifically authorized public institutions?
2. Is there a separate statutory or contractual route for a regulated private-sector institution to request identity verification against SDID/NPR?
3. Can a Rwandan institution be the direct applicant and contracting party while VeriFire is its named processor/subprocessor, and what written NIDA approval is required?
4. Must the technology provider be locally established, NDPO-registered or provide Rwanda-based hosting? What applies to a foreign processor?
5. Does the multi-user framework permit private-sector customers to use awarded suppliers, or only the authorized government institutions named by NIDA/RISA?
6. Has the primary procurement framework been awarded, and are later call-offs or a new onboarding window expected?
7. What are the current SDID Core/AMBAS API onboarding, mTLS/OAuth/OIDC, audit and sandbox procedures?
8. Which methods are permitted (1:1 identity-bound verification, face/fingerprint/iris, signed QR), and is 1:N limited to defined deduplication/government use cases?
9. Which minimum attributes/outcomes may be returned, and can raw biometric templates and full demographic records remain undisclosed?
10. What lawful basis and consent evidence are required per query, and can an institution collect that evidence in its own interface?
11. Must query payloads, results, biometrics, logs, backups, telemetry and support access remain in Rwanda? What approvals are required for remote support or cross-border access?
12. What DPA, retention/deletion, audit, incident, pricing, rate-limit, SLA and continuity terms apply?

### Draft enquiry (not sent)

**To:** info@nida.gov.rw; rdapprocurement@risa.gov.rw  
**Subject:** Institutional enquiry — SDID identity-verification access and authorized technology-provider model

Dear NIDA / RISA Team,

We are conducting an initial institutional-access assessment for Metadusk VeriFire, a headless, server-to-server verification platform. We have reviewed NIDA's public digital identity programme information and RISA's 2026 procurement and consolidated clarifications for biometric verification endpoint technologies supporting the Single Digital Identity ecosystem.

Before considering any application or technical work, please clarify:
- whether SDID/National Population Register verification is available to private-sector institutions and the applicable eligibility/contracting route;
- whether a Rwandan institution may be the direct applicant and contracting party while VeriFire operates as its expressly authorized processor/subprocessor;
- local establishment, NDPO registration and NIDA/NCSA requirements for a foreign technology provider;
- whether the 2026 framework is restricted to NIDA and authorized government institutions and whether a later onboarding route is planned;
- current API, authentication, sandbox and certification requirements;
- supported verification methods, permissible result fields, consent evidence and biometric restrictions;
- Rwanda hosting, cross-border access, retention/deletion, audit and incident obligations; and
- fees, rate limits, service levels and onboarding timelines.

We will not request credentials, submit live identity data or initiate production access during this assessment. Please direct us to the responsible institutional-access and data-protection teams and advise which formal application materials are required.

Kind regards,
[Authorized representative]
[Legal entity]
[Applicant institution, if different]
[Business address]
[Business email and telephone]

