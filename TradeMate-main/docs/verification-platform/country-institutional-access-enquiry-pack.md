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



## South Africa — Department of Home Affairs (DHA), CIPC and Information Regulator

### Verified institutional access findings

**1. Home Affairs National Population Register / Online Verification Service (OVS)**

The Department of Home Affairs announced that its upgraded NPR verification service launched on 1 July 2025 for government users and private-sector clients. The Department said three major private-sector users had transitioned at launch. Its published tariff at that time was R10 per real-time verification and R1 per off-peak batch transaction, effective 1 July 2025. Treat these as historical published tariffs and request the current fee schedule before commercial modelling.

DHA's March 2025 statement described the service as enabling public and private organisations, including financial-sector businesses, to verify client identities against the National Population Register using biometric features such as fingerprints and facial recognition. The 2025 launch statement says registered users can check identities and other biographical information. It does not publish a complete public API specification, a general eligibility checklist, a self-service sandbox or a foreign-processor delegation policy.

**2. DHA Digital Partnership Model**

DHA's 9 March 2026 announcement says participating banks connect directly to Home Affairs systems through a secure API-based Digital Gateway for Smart ID services. Capitec and Standard Bank branches were live at launch, and FNB was in final testing; rollout was phased. This is a specific bank/Home Affairs partnership, not evidence that VeriFire or all private companies can use the same gateway. Ask whether a separate technology-provider partnership route exists.

**3. Companies and beneficial ownership — CIPC APIVerse**

CIPC's developer portal lists a commercial read-only Companies API for searching and retrieving company data. All APIs use an OAuth 2.0 Authorisation API, which must be subscribed to before other API products. The portal offers self-service app creation, testing and usage monitoring. A beneficial-ownership API is listed as a subscription product; several other products (including filing, disqualified-director, XBRL, documents and streaming) were labelled coming soon on the page reviewed. Obtain current field-level docs, pricing, production approval and reuse rights. Do not represent the portal's product listing as confirmation of a specific beneficial-owner dataset's completeness or unrestricted access.

Official references:
- [DHA — upgraded NPR verification service launch and 2025 tariff notice](https://www.gov.za/news/media-statements/home-affairs-launch-world-class-new-identity-verification-service-and-cost)
- [DHA — system upgrade announcement, 24 March 2025](https://www.gov.za/news/media-statements/home-affairs-upgrades-critical-digital-verification-system-24-mar-2025)
- [DHA — Digital Partnership Model, 9 March 2026](https://www.gov.za/news/media-statements/home-affairs-first-bank-branches-go-live-under-new-digital-partnership-model)
- [CIPC APIVerse developer portal](https://developer.cipc.co.za/)
- [CIPC API documentation](https://developer.cipc.co.za/static/docs)
- [CIPC API catalogue](https://developer.cipc.co.za/apis)

### POPIA / FICA compliance gates

The Protection of Personal Information Act 4 of 2013 (POPIA) applies to the proposed South African data flows. This summary is an issue list for counsel, not a legal opinion:

- **Biometrics:** Section 26 classifies biometric information as special personal information. Section 27 sets out general authorizations/exceptions, including data-subject consent and certain legal grounds; category-specific provisions and any Information Regulator authorization may also matter. Do not assume that biometric processing is automatically lawful merely because a customer asks for it.
- **Operator / sub-operator:** Sections 20–21 require processing on behalf of a responsible party to be authorized and confidential, and require a written contract ensuring the operator maintains section 19 security safeguards. The operator must notify the responsible party immediately on reasonable grounds to believe personal information was accessed/acquired by an unauthorized person.
- **Security compromise:** Section 22 requires the responsible party to notify the Regulator and affected data subjects as soon as reasonably possible after discovery, subject to statutory conditions.
- **Retention:** Section 14 limits retention to what is necessary unless a listed ground permits longer retention, and requires deletion/destruction or de-identification when retention is no longer authorized. FIC Guidance Note 7B (3 August 2026) says accountable institutions must keep CDD records, including copies of or references to identity-verification information. That is the institution's statutory duty; the platform should support evidence references and customer-controlled retention rather than defaulting to raw document/biometric retention.
- **Cross-border:** Section 72 permits transfers to a foreign recipient only under a specified condition, such as adequate protection under law/binding corporate rules/agreement, consent, or the defined contractual/benefit grounds. Map onward transfers and subprocessors; do not rely on a generic claim that the destination is adequate.
- **Prior authorisation:** Section 57 is triggered by specific patterns, including certain use/linking of unique identifiers for a different purpose, processing criminal-behaviour information on behalf of third parties, credit reporting, and certain transfers of special/children's information to a country without adequate protection. Biometric processing by itself is not listed as an automatic section 57 trigger, but sections 26–27 still govern it. The Regulator's eServices portal describes the prior-authorisation process.
- **Information Officer:** POPIA section 55(2) requires the responsible party's Information Officer to be registered with the Regulator before taking up the statutory duties. The Regulator's eServices portal supports registration.

Official references:
- [POPIA — official Act text](https://www.justice.gov.za/legislation/acts/2013-004.pdf)
- [Information Regulator — prior authorisation portal](https://eservices.inforegulator.org.za/priorauthorisation/default.aspx)
- [Information Regulator — eServices](https://eservices.inforegulator.org.za/)
- [FIC Guidance Note 7B, 3 August 2026](https://www.fic.gov.za/wp-content/uploads/2026/08/Guidance-Note-7B-%E2%80%93-Implementation-of-various-aspects-of-the-FIC-Act.pdf)

### Questions for DHA — OVS / NPR verification

1. Is the upgraded OVS currently onboarding new private-sector customers, and what categories of legal entities qualify?
2. Must the applicant be a South African-incorporated entity, locally registered foreign company, FIC accountable institution, or another regulated entity? Can a foreign platform apply directly?
3. Can a South African customer be the OVS contracting party while Metadusk VeriFire is its expressly named operator/technical processor or sub-operator? Is prior written DHA approval required for that delegation?
4. Does DHA permit a technology provider to serve multiple customer institutions through a single approved connection, or must each customer contract and connect independently?
5. What is the current application, due-diligence, security assessment and contracting process, and what evidence of lawful purpose/consent is required?
6. Please provide current OVS API/interface specifications, authentication, encryption, network connectivity, certificate/key custody, test environment and certification procedure.
7. Which verification methods are available to private-sector clients (demographic, fingerprint, facial, liveness), and which are limited to specific customer classes or use cases?
8. What minimum input attributes and result fields are permitted? Can the service return a minimal match/no-match or approved verification result without exposing source-register data or biometric templates?
9. What are the current real-time and batch tariffs, volume tiers, minimum commitments, rate limits, batch windows, SLA, support and outage/fallback terms?
10. What audit logs, transaction-level consent evidence, record retention, deletion and data-subject rights requirements apply to DHA, customer and operator records?
11. Are there restrictions on hosting, remote administration, support access or onward processing outside South Africa? Does DHA require local data residency or local personnel?
12. What is the distinction between OVS verification access and the bank-specific Digital Gateway under the Digital Partnership Model? Is there a formal technology-partner route for non-bank providers?

### Questions for CIPC — Companies / beneficial ownership APIs

1. Can a foreign software provider subscribe to the Companies API and beneficial-ownership API directly, or must the subscriber be a South African entity?
2. What are the current product subscription, identity/business verification, pricing, billing and production approval requirements?
3. Please provide current schemas, fields, search limits, pagination, freshness/update cadence, error handling, sandbox/test data and OAuth 2.0 credential lifecycle.
4. What beneficial-ownership fields are available, what are the access conditions, and are there distinctions between public and restricted information?
5. May a subscriber use the API to provide verification results to its business customers as a paid service? Are caching, redistribution, resale, sub-licensing or retention restricted?
6. Can VeriFire act as an authorized operator for a customer's CIPC subscription, or must each customer subscribe and hold its own credentials?
7. What are the audit, security, rate-limit, service-level, change-notice and termination requirements?

### Questions for the Information Regulator / counsel

1. For VeriFire's proposed model, which entity is the responsible party and which is operator/sub-operator for identity verification, biometrics, AML screening and KYB enrichment?
2. Which section 27 authorization applies to each biometric workflow, and does any category-specific provision or section 27(2) authorization need to be obtained?
3. Does a proposed use of SA ID numbers/unique identifiers across multiple independent customer datasets trigger section 57(1)(a) prior authorisation? Does any sanctions/PEP/fraud/criminal-risk product process criminal-behaviour information on behalf of third parties under section 57(1)(b)?
4. Does any proposed transfer of biometric or other special personal information from South Africa to the platform's foreign environment trigger section 57(1)(d), and is the destination considered adequate under section 72?
5. What contract terms, sub-operator approvals, transfer instruments, Information Officer registration and breach-response commitments should be documented before a pilot?
6. Are there sector-specific FICA or other regulatory requirements for a verification technology provider serving banks, fintechs, insurers, lenders or other accountable institutions?

### Draft DHA enquiry (not sent)

**To:** Department of Home Affairs — Online Verification Service / National Population Register institutional onboarding team (please route to the responsible team through the official DHA contact channel)  
**Subject:** Institutional access enquiry — NPR Online Verification Service and authorized technology-provider model

Dear Department of Home Affairs Team,

We are assessing the Department's upgraded National Population Register Online Verification Service for a potential institutional integration with Metadusk VeriFire, a headless, server-to-server verification platform.

The Department's public announcements confirm that the upgraded OVS supports government and private-sector users and that the 2025 Digital Partnership Model provides participating banks with secure API-based integration. We would appreciate referral to the team responsible for new private-sector OVS onboarding and clarification of:
- eligibility and application requirements for a new private-sector applicant;
- whether a South African customer may contract directly with DHA while VeriFire is its expressly authorized operator/technical processor;
- whether one approved technical connection may serve multiple customers or each customer requires a separate contract and connection;
- current API/interface documentation, security assessment, sandbox and certification;
- permitted methods, data fields and minimum-result options;
- current tariffs, rate limits, SLA and support;
- audit, consent evidence, retention/deletion and breach obligations; and
- local hosting, remote support and cross-border processing restrictions.

We will not request credentials, submit live identity data or initiate production access during this assessment. Please advise the formal institutional enquiry route and required application documents.

Kind regards,
[Authorized representative]
[Legal entity]
[South African applicant/customer, if different]
[Business address]
[Business email and telephone]

### Draft CIPC enquiry (not sent)

**To:** CIPC APIVerse support — via [official developer portal](https://developer.cipc.co.za/)  
**Subject:** Commercial API subscription and authorized operator enquiry — Companies and beneficial ownership data

Dear CIPC APIVerse Team,

We are evaluating CIPC's Companies API and beneficial-ownership API for Metadusk VeriFire, a headless business-verification platform.

Please confirm foreign-provider eligibility, subscription and production approval requirements, current pricing, available company and beneficial-ownership fields, API documentation and test facilities. We would also appreciate clarification on whether VeriFire may provide API-derived verification results to customer institutions as a paid service, and whether a customer may hold its own CIPC subscription while VeriFire operates as its expressly authorized operator. Please specify any restrictions on caching, retention, redistribution, resale, sub-licensing, audit, rate limits and onward disclosure.

We will not access or redistribute production data until the applicable licence and customer authorization are confirmed.

Kind regards,
[Authorized representative]
[Legal entity]
[Business email and telephone]

### Decision

South Africa is the strongest first-wave market so far for documented institutional access breadth: DHA publicly confirms a private-sector NPR verification service, and CIPC publicly exposes commercial Companies and beneficial-ownership API products. However, there is no confirmed VeriFire contract, foreign-processor approval, customer-led delegation permission, API sandbox credential or current tariff quote. Keep both routes at institutional diligence only. No outreach has been sent, no provider selected, no credentials requested and no country route enabled.


## Egypt — CBE, MCIT / Ministry of Interior, FRA, Digital Egypt and PDPC

### Verified institutional access findings

**1. Central Bank of Egypt — Digital Financial Identity (DFI) platform**

CBE issued regulations in August 2026 governing the Digital Financial Identity platform for identifying bank customers and verifying identities electronically (eKYC). CBE's official summary says the framework covers all Egyptian banks, licensed entities eligible to join the approved DFI platform, CBE-authorized banking agents and other parties involved in DFI services. Functions include electronic customer identification and identity verification/updates, electronic authentication of banking transactions and payment instructions, customer consent and digital-identity sharing.

This is the most direct formal institutional eKYC route found for Egypt's financial sector. However, eligibility is restricted to banks and licensed entities approved for the platform. The published summary does not establish that an independent foreign verification vendor can join directly, nor does it specify whether an approved customer may appoint a foreign processor/subprocessor. Obtain the complete regulations, technical standards and CBE confirmation before designing a connector.

Official references:
- [CBE — Digital Financial Identity](https://www.cbe.org.eg/en/payment-systems-and-services/digital-financial-identity)
- [CBE — DFI/eKYC regulations announcement, 24 August 2026](https://www.cbe.org.eg/en/news-publications/news/2026/08/24/09/40/ekyc-2026)
- [CBE — circulars listing, including 23 August 2026 DFI rules](https://www.cbe.org.eg/en/laws-regulations/regulations/circulars)

**2. Ministry of Communications / Ministry of Interior — biometric verification pilot**

MCIT announced on 26 August 2026 that it had established, in cooperation with the Ministry of Interior, the regulatory framework, infrastructure and integration platform for biometric verification and e-signature services. The platform is coordinated with the Civil Status Sector at the Ministry of Interior. NTRA, ITIDA, CyShield and licensed e-signature companies are involved. The initial pilot allows licensed telecom operators to offer identity-verification and e-signature services through their smartphone apps; operators are rolling out progressively as they become technically ready.

This establishes a current national digital-identity integration programme, but the published announcement does not provide a public API, vendor application route, or general private-sector entitlement to query Civil Status records. The pilot's initial access is described as a licensed-telecom-operator model. Any role for VeriFire would need written confirmation from MCIT, Ministry of Interior/Civil Status Sector and NTRA, and may require an eligible local licensee to sponsor the arrangement.

Official reference:
- [MCIT — Egypt launches biometric verification and e-signature system, 26 August 2026](https://mcit.gov.eg/en/Media_Center/Latest_News/News/117426)

**3. Financial Regulatory Authority — non-bank finance verification requirements**

FRA's 25 August 2026 statement says entities under FRA supervision operating through fintech, including fintech outsourcing service providers, must verify national-ID authenticity, confirm mobile-line ownership and screen clients against AML/asset-freeze watchlists. Consumer-finance and MSME-finance firms, associations and institutions must issue OTPs to verified phone numbers at contract execution and again at fund disbursement, retaining proof. FRA refers to Resolution No. 186 of 2024 as amended, most recently by Resolution No. 133 of 2026. Its statement says the remaining institutions' OTP compliance grace period ends the following January.

This creates a strong compliance need for verifiable identity, phone-ownership and watchlist workflows. It does not itself grant access to national ID records or authorize VeriFire as a regulated provider. Obtain the underlying resolutions and confirm whether a foreign outsourced platform needs FRA notification/approval, local contracting, cybersecurity assessment or other conditions.

Official reference:
- [FRA — strict customer identity and data verification standards, 25 August 2026](https://fra.gov.eg/en/fra_news/%D8%AF-%D8%A5%D8%B3%D9%84%D8%A7%D9%85-%D8%B9%D8%B2%D8%A7%D9%85-%D8%B1%D8%A6%D9%8A%D8%B3-%D8%A7%D9%84%D9%87%D9%8A%D8%A6%D8%A9-%D8%A7%D9%84%D8%B9%D8%A7%D9%85%D8%A9-%D9%84%D9%84%D8%B1%D9%82%D8%A7%D8%A8-2/)

**4. Digital Egypt — commercial-registry services**

MCIT announced that nine commercial-registry services became available exclusively through the Digital Egypt platform from 1 January 2026. The services include inquiries about and verification of commercial registration, updates, extracts and certificates. This is an official digital registry channel, but the announcement does not establish a public API or a commercial redistribution licence. Do not scrape or resell records without confirming the terms and an authorized technical route.

Official reference:
- [MCIT — nine commercial-registry services through Digital Egypt, 1 January 2026](https://mcit.gov.eg/en/Media_Center/Press_Room/Press_Releases/98927)

### PDPL / PDPC compliance gate — current as of 28 November 2026

Egypt's Personal Data Protection Law No. 151 of 2020 is supplemented by Executive Regulations issued under Ministerial Decree No. 816 of 2025. The one-year transitional compliance period has ended (sources describe the operative date as 1 November 2026). The Personal Data Protection Center (PDPC) is now an active regulator: MCIT reported PDPC international regulatory engagement on 24 November 2026. The PDPC electronic portal for licences, permits and accreditations was reported launched in October 2026.

The MCIT's official Egyptian FinTech Landscape 2024 report describes the PDPL framework as requiring licensing/permits and security accreditation for data processing, sensitive data and cross-border transfers; it also describes DPO registration and a local representative for foreign controllers. Later legal updates report that foreign controllers/processors can use the PDPC portal through an authorized local representative who authenticates with Digital Egypt credentials. Verify the current portal workflow and exact licence categories directly with PDPC before relying on that route.

For VeriFire, treat the following as mandatory diligence gates, not optional future clean-up:
- Determine the controller, processor and any subprocessor roles for each customer flow. Verify whether VeriFire itself needs a controller/processor licence or permit and whether local representative appointment is required.
- Confirm the PDPC licence/permit required for sensitive identity/biometric data and whether explicit consent is sufficient for the intended processing or additional authorization is mandatory.
- Obtain a destination-specific cross-border transfer licence/permit where required before sending Egyptian personal data to any foreign environment. Secondary analysis of Article 15 of the Executive Regulations describes licensing and destination assessment, with narrow exceptions that should not be assumed to remove the need for safeguards or PDPC review.
- Confirm any Egypt-local storage, access, support, backup, log and onward-transfer requirements. Do not assume offshore-only storage is permissible.
- Confirm DPO appointment/registration, records of processing, notices, data-subject rights, retention/deletion and breach notification obligations under the Law and Regulations.
- Confirm whether foreign processors must appoint a local representative and whether that representative can submit applications on their behalf.

Sources:
- [MCIT — Egyptian FinTech Landscape 2024, PDPL summary](https://mcit.gov.eg/Upcont/Documents/Reports%20and%20Documents_1332025000_Egyptian_FinTech_Landscape_2024_13032025.pdf)
- [MCIT — PDPC international regulatory engagement, 24 November 2026](https://mcit.gov.eg/en/Media_Center/Latest_News/News/121665)
- [Baker McKenzie — PDPL update, 7 October 2026](https://www.bakermckenzie.com/en/insight/publications/2026/10/egypt-personal-data-protection-law-update)
- [Law No. 151 of 2020 and Executive Regulations English translation (secondary source)](https://shehatalaw.com/wp-content/uploads/2026/01/Shehata-Partners-Publications-Data-Protection-Executive-Regulations-English.pdf)
- [PDPC portal](https://portal.pdpc.gov.eg/) (portal endpoint did not load during this research; verify availability directly)

### Questions for CBE — Digital Financial Identity

1. Which classes of non-bank licensed entities are currently eligible to join the approved DFI platform, and what licence types qualify?
2. Can an eligible Egyptian bank or licensed entity appoint a foreign verification platform as a named technology supplier, processor or subprocessor? What prior CBE/platform approval is required?
3. Can a technology supplier participate across multiple approved customers, or must each bank/customer obtain separate approval and establish its own integration?
4. What are the platform operator, governance, onboarding, technical certification and participant approval processes?
5. Please provide the full DFI rules, API specifications, interface standards, authentication, encryption, network connectivity, sandbox and test-data process.
6. Which national-ID fields, biometric methods and identity results may be used or disclosed? Can the platform return a minimal verification result without disclosing raw biometric templates or full registry data?
7. What consent and customer-authentication evidence must be captured, and can an institution collect this within its own customer interface?
8. What local hosting, data residency, cybersecurity, audit, retention, deletion, incident notification and outsourcing requirements apply?
9. What fees, transaction limits, rate limits, SLA, support and service-continuity arrangements apply?

### Questions for MCIT / Ministry of Interior / NTRA — biometric identity platform

1. Is the August 2026 biometric verification/e-signature pilot currently limited to licensed mobile-network operators, or are other regulated institutions and technology providers being onboarded?
2. Which authority owns the Civil Status Sector integration platform and accepts institutional/vendor applications?
3. Can an eligible Egyptian telecom operator, bank or other licensed institution sponsor a foreign technical processor such as VeriFire? What written approval and contractual structure are required?
4. Does the system support identity-bound 1:1 verification only, or any other biometric matching mode? Which methods (face, fingerprint, liveness) are approved for each participant class?
5. What data fields and response semantics are exposed, and can the result be limited to match/no-match or another minimal assertion?
6. What are the technical specifications, security certification, sandbox, onboarding, consent, pricing, SLA and production acceptance requirements?
7. Are there local establishment, local hosting, local key custody, NTRA licence or Egyptian cybersecurity accreditation requirements for a technology provider?
8. What are the retention/deletion, audit, cross-border transfer, remote-support and incident-notification requirements?

### Questions for FRA — fintech outsourcing / non-bank finance

1. Please provide the current consolidated text of Resolution No. 186 of 2024 and amendments, including Resolution No. 133 of 2026, and confirm the exact effective dates and scope.
2. Which obligations apply directly to fintech outsourcing service providers, and which remain the regulated customer's responsibility?
3. Does an offshore verification platform serving an FRA-regulated customer require prior approval, notification, registration, local representation or a local contract?
4. Which identity-verification, mobile-line ownership and AML/watchlist sources are acceptable, and what evidence must the institution retain?
5. What standards apply to OTP delivery and evidence at contract signing and disbursement, and may the institution use an external provider?
6. What are the outsourcing, audit, cybersecurity, incident, data residency, subcontractor and cross-border data requirements?

### Questions for PDPC / Egyptian counsel

1. Which controller/processor licence or permit category applies to Metadusk VeriFire if it processes Egyptian identity data solely on documented customer instructions?
2. Must VeriFire appoint a local representative, and can the representative authenticate on Digital Egypt and submit all PDPC applications for a foreign legal entity?
3. Which separate authorization/licence is required for biometric or other sensitive personal data processing, and is explicit consent also required?
4. What cross-border transfer licence/permit applies to each destination and data category? Does the PDPC require destination-specific safeguards, local storage or prior approval for remote access/support?
5. Are any exceptions to the transfer-licence requirement available to a processor acting for an Egyptian bank or regulated customer, and what conditions must be documented?
6. What are the DPO appointment/registration, processing-register, privacy notice, consent, DPIA/impact assessment, data-subject request, retention/deletion and breach notification requirements?
7. What are the current licence/permit fees, renewal periods, processing timelines, audit rights and sanctions for non-compliance?
8. Is the PDPC portal fully operational for foreign applicants now that the grace period has ended, and what authenticated application documents are required?

### Draft CBE enquiry (not sent)

**To:** Central Bank of Egypt — Digital Financial Identity / eKYC platform team (via official CBE contact channel)  
**Subject:** Institutional participation enquiry — Digital Financial Identity platform and authorized technology-provider model

Dear Central Bank of Egypt Team,

We are assessing the Digital Financial Identity platform established under the CBE's August 2026 eKYC regulations for a potential institutional integration with Metadusk VeriFire, a headless, server-to-server verification platform.

Please clarify the eligibility and onboarding route for licensed entities, whether an eligible Egyptian bank or licensed institution may appoint VeriFire as its expressly authorized foreign technology supplier/processor, and whether a separate approval is required for each customer integration. We would also appreciate the current platform rules, technical specifications, sandbox and certification process, permitted identity/biometric methods and result fields, consent requirements, local hosting and cybersecurity controls, outsourcing and cross-border requirements, fees and service levels.

We will not request credentials, submit live identity data or initiate production access during this assessment. Please direct us to the team responsible for DFI participant onboarding and advise the formal application materials.

Kind regards,
[Authorized representative]
[Legal entity]
[Potential Egyptian applicant/customer, if different]
[Business address]
[Business email and telephone]

### Draft MCIT / Ministry of Interior enquiry (not sent)

**To:** MCIT / Ministry of Interior Civil Status Sector / NTRA — via official institutional contact channels  
**Subject:** Institutional enquiry — biometric verification integration platform and authorized technical-provider participation

Dear Team,

We are assessing Egypt's biometric verification and e-signature integration platform announced in August 2026, including the pilot for licensed telecom operators and its coordination with the Civil Status Sector.

Please clarify whether participation is currently limited to licensed telecom operators, whether additional regulated institutions or technology providers may apply, and whether an eligible Egyptian institution may sponsor Metadusk VeriFire as an expressly authorized foreign processor/technical supplier. Please also provide the responsible contracting authority, eligibility criteria, application and approval process, API/interface specifications, sandbox, permitted verification methods and fields, local hosting and security requirements, consent and retention rules, cross-border restrictions, fees and SLA.

We will not request credentials or process live identity data during this assessment. Please advise the formal institutional enquiry route and required documents.

Kind regards,
[Authorized representative]
[Legal entity]
[Potential Egyptian applicant/customer, if different]
[Business address]
[Business email and telephone]

### Draft FRA enquiry (not sent)

**To:** Financial Regulatory Authority — fintech / non-bank financial activities supervision (via official FRA contact channel)  
**Subject:** Regulatory clarification — outsourced identity verification services under FRA customer-data verification rules

Dear FRA Team,

We are assessing how Metadusk VeriFire, a headless verification platform, could support an FRA-regulated Egyptian institution with national-ID authenticity checks, mobile-line ownership verification, AML/watchlist screening and auditable OTP evidence.

Please identify the applicable current consolidated rules, including Resolution No. 186 of 2024 and Resolution No. 133 of 2026, and clarify the obligations applying to the regulated institution versus its fintech outsourcing service provider. In particular, please advise whether a foreign verification platform requires prior approval, notification, local representation or local contracting; which source providers and verification methods are acceptable; and what outsourcing, cybersecurity, audit, data-residency, cross-border and incident requirements apply.

We will not access live identity data or provide regulated services during this assessment. Please direct us to the responsible supervisory team and the formal process for obtaining a written interpretation.

Kind regards,
[Authorized representative]
[Legal entity]
[Potential Egyptian customer, if different]
[Business address]
[Business email and telephone]

### Decision

Egypt is a high-potential regulated market, but the compliance burden is now immediate rather than prospective. The strongest near-term customer-led route appears to be an eligible CBE DFI participant or FRA-regulated institution sponsoring a clearly authorized technology provider; neither delegation nor foreign-processor eligibility is confirmed. The national biometric pilot is initially telecom-operator-led, while Digital Egypt's commercial-registry verification service has no public commercial API entitlement established by the source reviewed. PDPC licensing, local representation and cross-border permits must be resolved before any Egyptian personal data enters VeriFire. No outreach has been sent, no provider selected, no credentials requested, no integration built and no country route enabled.
