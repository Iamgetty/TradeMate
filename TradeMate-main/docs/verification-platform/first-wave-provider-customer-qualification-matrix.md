# VeriFire first-wave provider and customer qualification matrix

**Status:** Research-based qualification plan — 28 November 2026  
**Scope:** Nigeria, Kenya, South Africa, Ghana, Egypt, Uganda, Rwanda and Senegal  
**Decision boundary:** This matrix prioritizes diligence and customer discovery. It does not select a provider, establish API access, approve a processor relationship, authorize data processing or enable a country route.

## 1. How to read the matrix

Evidence labels describe only what the reviewed public material establishes:

- **Documented institutional route:** an authority publishes a defined access, onboarding or commercial service route. Eligibility for VeriFire and the proposed customer/processor model may still be unconfirmed.
- **Potential customer-sponsored route:** public material suggests a regulated or eligible customer may be able to access a service, but VeriFire's participation as a processor/subprocessor needs written confirmation.
- **No commercial identity route established:** research identifies an authority or national system, but not a verified private-sector API or entitlement.
- **KYB lead only:** a company-register search or API exists, but commercial reuse, paid redistribution and API access terms remain to be confirmed.

No market is currently production-ready for VeriFire identity processing.

## 2. Executive qualification matrix

| Market | Identity access evidence | KYB / company-data lead | Main legal / operational gate | Customer-led model | Current qualification |
|---|---|---|---|---|---|
| **Nigeria** | NINAuth publishes a private-sector verification-partner/aggregator route; eNVS technical document exists but lacks usable endpoint/interface deployment details. | CAC/company-search route requires separate commercial/API and reuse diligence. | NINAuth requires applicant physical presence in Nigeria, approved partner/aggregator, consent, approved purpose, audit/logging and reporting. Published retention terms need contractual reconciliation. | **Unconfirmed and material.** Metadusk currently has no Nigerian entity/physical presence; ask NIMC/aggregator whether a Nigerian customer may contract and name VeriFire as processor. | **High demand / conditional access.** Do not treat as directly accessible. |
| **Kenya** | eCitizen Health ID describes face/fingerprint, liveness and NRB matching; FAQ identifies private companies among potential authorized users. API, onboarding and delegation remain unconfirmed. | Business-registration and beneficial-ownership sources need commercial access validation. | ODPC registration; biometric DPIA submitted at least 60 days before processing; Kenya serving-copy/data-centre requirement under 2025 guidance; cross-border transfer controls. | **Potential, unconfirmed.** Establish whether eligible Kenyan customer can sponsor VeriFire and what local storage and operator obligations apply. | **High digital-finance demand / high compliance burden.** |
| **South Africa** | DHA National Population Register Online Verification Service was launched for government and private-sector clients; current onboarding, foreign processor delegation and fees need reconfirmation. | CIPC APIVerse lists read-only Companies and beneficial-ownership APIs with OAuth 2.0; production terms and paid reuse need confirmation. | POPIA special-personal-information and biometric rules, operator contract/security duties, retention, cross-border transfers and specific prior-authorisation triggers. FIC customer evidence-retention obligations may affect design. | **Most concrete published private-sector signal**, but customer sponsorship and foreign operator eligibility are not established. | **Strong KYB/identity discovery candidate.** |
| **Ghana** | NIA IVSP publishes institutional onboarding and requires technical readiness plus a direct identity-verification contract. | ORC/company data access and permitted commercial reuse need separate validation. | NIA's 2026 L.I. 2523 notice requires real-time biometric verification where available; card photocopy/visual-only design is not a safe default. DPC certification/registration and controller/processor roles require confirmation. | **Plausible but unconfirmed.** Determine whether NIA permits an eligible Ghanaian institution to contract while VeriFire is a named technical processor. | **Documented authority process / direct contract gate.** |
| **Egypt** | CBE DFI/eKYC framework covers eligible licensed entities and participants; MCIT biometric pilot initially targets licensed telecom operators. No general open API established. | Digital Egypt commercial-registry inquiry services exist; commercial API/reuse rights not established. | PDPL Law 151/2020 and Decree 816/2025: licensing/permits, foreign representation and cross-border processing require immediate legal confirmation following end of transition period. | **Possible only through eligible regulated participant if expressly permitted.** Foreign processor status and delegation are unconfirmed. | **Strategic market / highest regulatory qualification effort.** |
| **Uganda** | NIRA regulations define non-government access by Form 1, purpose and subject consent; 2024 PKI/e-consent initiative sought vetted third-party providers, current onboarding unconfirmed. | URSB company information and commercial access terms require validation. | PDPO controller/processor/collector registration; cross-border processing/storage requires adequate protection or applicable consent; local counsel must confirm offshore application. | **Potential.** Ask whether Ugandan customer may hold access agreement and appoint VeriFire as named processor. | **Documented statutory route / initiative status unknown.** |
| **Rwanda** | RISA's March 2026 SDID biometric-endpoint procurement was a closed, multi-user/multi-supplier government framework for NIDA and authorized public purchasers; published deadline extended to 13 May 2026 and has passed. No public private-sector API or tenant entitlement established. | RDB company registry and permitted commercial API/data reuse require separate validation. | DPO confirms controller/processor registration, Rwanda storage as default, and authorization/certificate requirements for overseas storage and transfers; biometric data is sensitive. Logging and processing-record duties also apply. | **Unconfirmed.** Ask RISA/NIDA whether private institutions can be participating purchasers and whether a named foreign processor is allowed; separately obtain NCSA/DPO authorization for any foreign storage/transfer or support access. | **Strong digital adoption / government-procurement-gated access; strict residency gate.** |
| **Senegal** | DAF is the competent national identity-card office; no commercial identity-verification API identified. | SEN'INFOGREFFE and OHADA RCCM provide official search portals; API, paid use, bulk access and redistribution rights unconfirmed. | CDP authorization for national ID numbers/biometrics and certain interconnections; written processor contract; local representative and third-country transfer filings/approvals. | **Unconfirmed for identity.** KYB may be the nearer discovery route, subject to register terms and CDP requirements. | **Francophone market / KYB-first hypothesis.** |

## 3. Recommended qualification order

This is an order for **discovery work**, not a declaration that one country is legally or technically ready.

### Track A — first customer discovery

1. **South Africa:** validate DHA private-sector onboarding and CIPC APIVerse commercial terms. It has the clearest public signal of private-sector identity verification plus a concrete company-data API candidate.
2. **Ghana:** obtain NIA's current applicant pack, direct-contract requirements, biometric modalities and written position on customer-led processor participation.
3. **Nigeria:** interview Nigerian fintechs and approved NINAuth aggregators in parallel; resolve the physical-presence requirement and customer-sponsored processor model before spending on integration.
4. **Kenya:** qualify eCitizen/NRB access and customer eligibility while obtaining a Kenya-specific biometric storage, DPIA and transfer design from counsel.

### Track B — targeted institutional qualification

5. **Uganda:** establish whether NIRA's PKI/e-consent initiative is still onboarding third parties and whether a customer-sponsored technical processor is accepted.
6. **Rwanda:** determine whether NIDA/RISA has a private-sector access route outside the completed government procurement framework; confirm hosting and cross-border conditions early.
7. **Senegal:** pursue KYB discovery with SEN'INFOGREFFE/RCCM and fintech prospects first; separately ask DAF whether any institutional identity verification service exists.
8. **Egypt:** qualify regulated-customer demand and obtain a focused PDPL/local-representation opinion before technical or provider work.

This sequencing balances visible institutional pathways with commercial learning. Reorder it if qualified customer interviews reveal stronger near-term demand or a regulator confirms a materially easier route.

## 4. Customer qualification: what must be proven

Do not count a prospect as a qualified launch customer merely because it wants KYC. For each country, obtain evidence for all applicable items:

1. **Real use case:** exact customer journey, user population, volumes, required assurance level, fraud problem and business outcome.
2. **Regulated status:** legal entity, operating countries, sector regulator, licence/registration and accountable compliance owner.
3. **Lawful role allocation:** customer/controller, VeriFire/processor or subprocessor, source authority/provider, and any other recipients.
4. **Source entitlement:** the customer is eligible for the specific source and purpose; contract explicitly permits the proposed technical provider and onward processing.
5. **Data scope:** exact fields, matching method, consent/notice, legal basis, retention and deletion; no unnecessary raw documents or biometrics.
6. **Data geography:** primary processing, serving copies, backups, logs, support access, subprocessors and transfer mechanism are approved for the jurisdiction.
7. **Commercial case:** willingness to pay, target unit economics, minimum volumes, implementation budget, procurement owner and decision timeline.
8. **Operational readiness:** service SLA, support hours, dispute/manual-review handling, incident response, audit evidence and business continuity.
9. **Integration readiness:** customer-owned UX, customer backend, server-to-server VeriFire integration, secret custody and test-data-only sandbox.
10. **Written approvals:** legal counsel and the relevant authority/provider confirm any required approvals before live personal data is processed.

## 5. Provider qualification scorecard

Use this scorecard for every provider or government source. Do not award a pass from marketing material alone.

| Gate | Evidence required | Pass condition |
|---|---|---|
| Legal access | Current statute/rule, authority letter or executed agreement | Customer and VeriFire's exact roles, purposes and access rights are permitted |
| Delegation | Written provider/authority confirmation | Customer may appoint VeriFire as processor/subprocessor or technical operator |
| Technical access | Current API spec, authentication/network design, sandbox and versioning | A real test integration can be built without reverse engineering or undocumented endpoints |
| Data minimization | Field-level schema, match semantics, permitted outputs | Only approved minimum attributes/assertions are returned and retained |
| Privacy/security | DPA, DPIA where required, transfer/residency assessment, security controls | All jurisdictional and contractual controls are evidenced |
| Commercial | Current price sheet, minimums, billing, rate limits and SLA | Unit economics and customer pricing are viable |
| Operations | Support/escalation, availability, DR, incident and audit terms | Production support and continuity are acceptable |
| Exit/retention | Deletion, termination, portability and legal-hold terms | Data and credentials can be safely removed or returned at contract end |

**Automatic fail / hold:** unclear source authority; no permitted processor delegation; undocumented endpoint; credentials shared outside approved custody; unapproved cross-border transfer; mandatory retention incompatible with the use case; or request to store end-user portal passwords, national-ID portal credentials or provider account login credentials.

## 6. Commercial validation sequence

### Stage 1 — customer problem validation (no personal data)

- Conduct structured discovery with 8–12 prospective customers across Track A, including fintech/lending, payments/mobile money, marketplaces/e-commerce and regulated financial institutions.
- Ask for current verification workflow, monthly volumes, failure/fraud costs, source coverage, manual-review rates, current vendor spend, SLA needs and buying authority.
- Use synthetic examples only. Do not request real identity documents, identifiers, biometrics, credentials or production exports.
- Record evidence separately from assumptions; do not claim customer interest without a named, documented interview outcome.

### Stage 2 — institutional eligibility (no credentials/live data)

- Send the prepared authority/provider enquiries only after explicit business approval.
- Request written answers on customer eligibility, foreign processor/subprocessor participation, permitted purpose, fields, method, residency, transfers, retention, sandbox, pricing and SLA.
- Obtain counsel review for each proposed customer/provider/data flow.
- Do not interpret silence, a public portal, a procurement notice or a generic API listing as permission.

### Stage 3 — non-production technical proof

- Use only an authorized sandbox and synthetic/test identities.
- Validate authentication, consent evidence, field minimization, idempotency, audit, timeouts, error mapping, rate limits and deletion.
- Keep provider credentials in approved server-side secret custody; never expose them to customer browser/mobile applications.
- No country route is marked live until all gates are signed off.

### Stage 4 — controlled pilot decision

A pilot proposal must name the customer, source/provider, exact purpose and data fields, legal basis, data locations, processor chain, retention, security owner, SLA, incident plan, budget and exit criteria. Obtain explicit approval before enabling any live route or processing real data.

## 7. Immediate next actions

| Priority | Action | Owner / evidence | Completion test |
|---|---|---|---|
| P0 | Confirm target customer segments and interview list for South Africa, Ghana, Nigeria and Kenya | Commercial owner; named prospects and interview notes | 8–12 completed or scheduled qualified interviews |
| P0 | Prepare a standard customer qualification brief and no-personal-data discovery script | VeriFire product/commercial | Same fields captured consistently across all interviews |
| P0 | Obtain written customer-sponsored processor eligibility answers from DHA/CIPC, NIA, NIMC/NINAuth and eCitizen/NRB | Authorized business representative; authority/provider replies | Explicit written yes/no plus conditions; no inference |
| P1 | Complete Uganda NIRA and Rwanda NIDA/RISA status checks | Institutional research | Current route, applicant criteria and processor role evidenced |
| P1 | Confirm Senegal RCCM paid/commercial reuse and DAF identity route | Institutional research | Written data-access and redistribution terms |
| P1 | Obtain Egypt PDPL/local representation opinion and CBE/FRA customer eligibility | Egyptian counsel and regulated prospects | Written legal memo and authority/customer position |
| P1 | Build a per-country data-flow and residency decision record | Privacy/security owner | No unresolved location, transfer, retention or subprocessor assumptions |
| P2 | Re-rank countries using interview evidence and verified provider terms | Product/commercial | Updated priority based on evidence, not market-size intuition |

## 8. Current platform decision

- The eight countries remain **commercial research priorities only**.
- No provider is selected or contracted.
- No institutional enquiry in the existing pack has been sent.
- No provider credentials, sandbox access or production access have been obtained.
- No country-specific provider adapter or live route is approved.
- No customer personal data should be processed through these proposed routes.
- VeriFire remains headless: customers build and own their end-user UX; their backend integrates with VeriFire server-to-server.
- Database, hosting, data-residency and secret-custody decisions remain separate architecture gates.

## 9. Research references

Use the country-by-country source links and detailed institutional questions in:
- [First-wave market readiness baseline](./first-wave-market-readiness.md)
- [Country institutional-access enquiry pack](./country-institutional-access-enquiry-pack.md)
- [Persistence-adapter architecture gate](./persistence-adapter-architecture-gate.md)

Revalidate all authority pages, fees, programme status and legal interpretations before commercial commitment; this matrix is a dated research snapshot, not legal advice.


### Rwanda evidence update (28 November 2026)

RISA's official procurement notice describes a closed multi-user/multi-supplier framework on behalf of NIDA and other authorized government entities. The published bid deadline was 29 April 2026, later extended on RISA's tender page to 13 May 2026; both have passed. The framework does not create a public API entitlement, and a framework supplier is not guaranteed a call-off. The official DPO FAQ says the law applies to foreign organizations processing data of people located in Rwanda, requires controller/processor registration, treats biometrics as sensitive data, and states that personal data is stored in Rwanda unless the controller/processor holds a valid certificate authorizing overseas storage. Transfers abroad are subject to Article 48 grounds/authorization and safeguards; written contracts and detailed logging/processing records also apply. The exact scope of remote support access and any lawful transfer ground must be confirmed with NCSA/DPO and Rwandan counsel.

Sources: [RISA SDID biometric framework notice](https://www.risa.gov.rw/fileadmin/user_upload/RISA/Publications/Tenders/Specific_Procurement_Notice_for_SDID_Biometric_Verification.pdf) · [RISA tender updates](https://www.risa.gov.rw/publications/tenders) · [DPO institutional FAQs](https://dpo.gov.rw/faqs) · [DPO Law Articles 48–50](https://dpo.gov.rw/dpp-law/sharing-transferstorage-and-retention-of-personal-data) · [DPO processing logs and records](https://dpo.gov.rw/dpp-law/processing-and-quality-of-personal-data).
