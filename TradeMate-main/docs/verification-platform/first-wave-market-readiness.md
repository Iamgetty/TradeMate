# VeriFire first-wave commercial market readiness

**Status:** Initial research baseline — 28 November 2026  
**Scope:** Nigeria, Kenya, South Africa, Ghana, Egypt, Uganda, Rwanda and Senegal  
**Decision:** These eight countries are the first commercial-priority markets. This is a market-planning decision, not a claim of live provider access or regulatory approval.

## 1. Purpose

Prioritize markets where digital financial activity creates demand for trusted identity, business, fraud and compliance checks. Assess each country independently for technology and digital-finance adoption; national identity and business-registry infrastructure; lawful access to identity/registry verification; privacy, cross-border transfer and data-residency obligations; provider availability, contractual terms and service quality; commercial demand, language and operational readiness.

Digital-payment adoption is a useful demand signal, but it is not a direct measure of KYC-provider access or willingness to pay. Country indicators below use 2024 survey data published in the World Bank Global Findex 2025 dataset where available. Rwanda's national FinScope 2024 data uses a different survey and definition and must not be directly ranked against Findex figures.

## 2. Digital-finance adoption baseline

| Country | Adults with any account (2024) | Adults using digital payments (2024) | Mobile-money account (2024) | Interpretation |
|---|---:|---:|---:|---|
| Kenya | 90.1% | 89.3% | 87.5% | Very strong digital-finance adoption; compelling KYC/fraud demand |
| Ghana | 81.2% | 80.4% | 78.3% | Strong mobile-money and payment adoption |
| Uganda | 72.8% | 70.6% | 67.7% | Strong mobile-money-led adoption and growth potential |
| South Africa | 81.1% | 67.2% | 31.6% | Mature formal-finance and digital-payment market; not primarily mobile-money-led |
| Nigeria | 63.3% | 54.5% | 32.8% | Large addressable market with substantial digital-finance growth and identity-fraud needs |
| Egypt | 43.1% | 36.3% | 15.6% | Lower current penetration; large catch-up opportunity, but more regulatory and execution work |
| Rwanda | Not directly comparable | Not directly comparable | 77% of adults had a registered mobile wallet in 2024; 86% owned or had used mobile money | Strong recent mobile-money expansion, measured by Rwanda FinScope 2024 |\n| Senegal | 76.5% | 73.5% | 66.9% | Strong mobile-money and digital-payment adoption; promising Francophone West African market |

**Sources and definitions**

- Nigeria, Ghana, Kenya, South Africa and Egypt comparator figures are from 2024 Global Findex results reproduced in SysIN's 2026 Nigeria Financial Inclusion report. Figures are percentages of adults aged 15+; digital payments means making or receiving a digital payment in the past year. [SysIN / Global Findex 2025](https://sysinafrica.com/research/reports/nigeria-financial-inclusion-2026).
- Uganda's 2024 figures are from Global Findex 2025 indicators reproduced by FinObservatory: 72.8% account ownership, 70.6% digital payments and 67.7% mobile-money accounts. [Uganda financial inclusion data](https://finobservatory.org/inclusion/UGA). World Bank country indicator context: [World Bank Digital Finance — Uganda](https://digitalfinance.worldbank.org/country/uganda).
- Senegal's figures are from the World Bank Global Findex 2025 dataset (2024 observations): 76.5% account ownership, 73.5% made or received digital payments, and 66.9% had a mobile-money account. See the [World Bank Little Data Book on Financial Inclusion 2025](https://thedocs.worldbank.org/en/doc/be6615202d1f08a25855c8ac2d615122-0050012025/related/Little-Data-Book-2025-Web.pdf) and [World Bank Digital Finance — Senegal](https://digitalfinance.worldbank.org/country/senegal). FinObservatory reproduces the same Findex wave and provides subgroup detail: [Senegal financial inclusion data](https://finobservatory.org/inclusion/SEN).
- Rwanda's figures are from the official 2024 FinScope survey: 96% overall financial inclusion, 92% formal financial inclusion, 86% of adults owning or having used mobile money, and 77% with a registered mobile wallet in their name (up from 60% in 2020). [National Institute of Statistics of Rwanda — FinScope 2024](https://www.gis.statistics.gov.rw/statistical-publications/business-establishment-finance-trade/finscope-survey-2024) and [Ministry of Finance and Economic Planning summary](https://www.minecofin.gov.rw/news-detail/96-of-rwandans-are-financially-included-finscope-survey-2024).

## 3. Country-by-country readiness baseline

The opportunity descriptions are hypotheses to validate with customer discovery. No provider has been selected or contracted.

### Nigeria — first commercial priority

**Why it matters:** Large addressable market; digital payments and mobile financial services are established, while 2024 Findex data shows further headroom. Strong potential demand from fintech, lending, marketplaces, payments, telecoms and regulated financial institutions.

**Identity / verification landscape:** NIN is the national identity foundation. BVN is a banking-sector identity/biometric system and must not be treated as a general-purpose national identity source. NIMC's official NINAuth partner guidance now provides a concrete route for private-sector organisations: the applicant must be subject to the Nigeria Data Protection Act, maintain a physical presence in Nigeria, use an approved NINAuth Verification Partner/aggregator, obtain informed consent for matching, restrict use to approved purposes, maintain security controls and usage logs, provide compliance reporting and accept independent audits. The applicant first contracts with an aggregator; NIMC says the formal application decision is expected within 5–7 business days after the aggregator submits the application, with connection setup facilitated by that aggregator. This is **not** an open direct API. VeriFire must establish whether it qualifies as the applicant, whether its Nigerian presence meets NIMC's criterion, and whether a customer/tenant can contract as the applicant while VeriFire acts as an explicitly authorized processor/subprocessor. Do not route NIN data until the approved partner, data roles, purpose and technical flow are confirmed. NINAuth publishes an [approved-partner lookup](https://ninauth.nimc.gov.ng/approved-partners); the directory is searchable and should be checked at procurement time rather than copying a static list into this document. NINAuth's user-facing flows include QR scan, time-limited share codes and a raw-NIN matching pathway; these are different consent and data-minimization models, and the applicable partner API/SDK specifications must be obtained from the selected aggregator before choosing one. [NINAuth — Verification Partner eligibility and onboarding](https://ninauth.nimc.gov.ng/verification-partner) · [Approved partner lookup](https://ninauth.nimc.gov.ng/approved-partners) · [NINAuth — Get Started](https://ninauth.nimc.gov.ng/get-started). NINAuth's published terms also describe indefinite retention of verification transactions and consent/audit records, with archival after 90 days of inactivity. Treat this as a material retention and deletion diligence item: establish which records are held by NIMC, the aggregator and the customer; whether the stated terms apply to the proposed partner service; and whether retention, deletion, legal-hold and data-subject rights can be reconciled with VeriFire's data-minimization commitments before contracting. [NINAuth Terms of Service](https://ninauth.nimc.gov.ng/legal/terms-of-service).

**Privacy / regulatory starting point:** Nigeria Data Protection Act 2023; regulator is the Nigeria Data Protection Commission (NDPC). The NDPC's 2025 General Application and Implementation Directive (GAID) provides additional implementation guidance, including territorial scope and cross-border transfer mechanisms. Assess controller/processor roles, lawful basis, sensitive-data handling, DPIA requirements where applicable, registration obligations, retention, breach duties and transfer grounds before choosing hosting or subprocessors. [Nigeria Data Protection Act 2023](https://ndpc.gov.ng/wp-content/uploads/2024/03/Nigeria_Data_Protection_Act_2023.pdf) · [NDPC GAID 2025](https://ndpc.gov.ng/wp-content/uploads/2025/07/NDP-ACT-GAID-2025-MARCH-20TH.pdf?exec=cyxgdpr_83654).

**First research actions:** Establish whether VeriFire has an eligible Nigerian physical presence or must rely on customer-led onboarding; obtain the approved NINAuth aggregator list and compare permitted purposes, pricing, API, subprocessor rules and audit rights; map BVN use restrictions and approved access; identify CAC company-search/verification options; interview 10–15 fintech and marketplace prospects; confirm NDPC and sector-regulator obligations.

**Current status:** Planned — no approved provider route.

### Kenya — first commercial priority

**Why it matters:** Highest digital-payment and mobile-money adoption among this seven-country group in the cited 2024 Findex figures. Strong fit for fintech, merchant platforms, lending, marketplaces and fraud prevention.

**Identity / verification landscape:** National identity and civil-registration sources are potential verification anchors. Access to government records must be validated; do not assume public API access. Map commercial KYC providers and their actual Kenyan source coverage.

**Privacy / regulatory starting point:** Data Protection Act 2019 and regulations administered by the Office of the Data Protection Commissioner (ODPC). Review controller/processor registration, lawful basis, sensitive and biometric data, DPIAs, processor contracts and cross-border transfers.

**First research actions:** Confirm ODPC registration applicability; identify permitted identity verification channels and onboarding conditions; validate company-registry access; shortlist providers only after source-level coverage and consent requirements are documented.

**Current status:** Planned — no approved provider route.

### South Africa — first commercial priority

**Why it matters:** Strong account ownership and substantial digital-payment use, with a mature banking, insurance, telecom and enterprise market. Its opportunity is broader formal-financial and enterprise verification, not simply mobile-money growth.

**Identity / verification landscape:** Department of Home Affairs identity verification and company-registration records are potential sources. Government and commercial access permissions, use-case limits, pricing and service-level terms need direct confirmation.

**Privacy / regulatory starting point:** Protection of Personal Information Act (POPIA), overseen by the Information Regulator. Review special personal information and biometrics, operator obligations, prior authorization where applicable, automated decision-making, security safeguards and cross-border transfers.

**First research actions:** Confirm Home Affairs verification access for private entities; map CIPC business verification services; identify sector-specific FICA obligations for target customers; validate POPIA transfer and operator requirements.

**Current status:** Planned — no approved provider route.

### Ghana — first commercial priority

**Why it matters:** High mobile-money and digital-payment adoption, with clear demand potential from financial services, telecoms, digital lenders, marketplaces and regulated businesses.

**Identity / verification landscape:** NIA's published IVSP onboarding process requires the institution to submit a request form, then provide (as applicable) proof of business registration, regulator-issued business licence, law(s) authorizing personal-data collection, a valid Data Protection Commission certificate, SSNIT employer certificate, business profile, process-flow description and requested datasets. NIA reviews the submission and schedules discussions; access is granted only after the institution has completed technical infrastructure setup and executed a direct identity-verification contract with NIA. The official form also asks the applicant to specify requested identity attributes, so VeriFire should request only fields necessary for the agreed use case. The eligibility of a foreign platform or a customer-led integration with VeriFire as processor is not established by the published material and needs written NIA confirmation. [NIA — Identity Verification Services](https://nia.gov.gh/service/verification-services/) · [NIA IVSP request form](https://nia.gov.gh/wp-content/uploads/IVSP-User-Request-Form_v2.225F.pdf).

**Important 2026 rule change:** NIA's 16 July 2026 notice says the National Identity Register (Amendment) Regulations 2026, L.I. 2523, took effect on 9 June 2026. It states that identity verification must use real-time biometric verification where available; visual inspection and photocopying/scanning/retaining Ghana Card copies for identity verification are not permitted except where law allows. NIA says institutions should begin IVSP onboarding and provides the institutional contact idverification@nia.gov.gh. VeriFire must not design a Ghana flow around card-image collection or visual-only checks. Confirm supported biometric modalities, user-consent mechanics, fallback handling and accessibility requirements with NIA before implementation. [NIA — L.I. 2523 notice](https://nia.gov.gh/government-makes-biometric-verification-mandatory-for-ghana-card-verification-under-new-l-i-2523/).

**Privacy / regulatory starting point:** Data Protection Act 2012 (Act 843) and Data Protection Commission requirements. The Act provides for controller registration and requires registration particulars to include purposes, categories of data, recipients and intended transfer countries. Confirm the current certification/registration status required by NIA, and whether VeriFire is a controller, processor or subprocessor for the proposed flow. [Ghana Data Protection Act 2012](https://dataprotection.org.gh/wp-content/uploads/2025/05/Data-Protection-Act-2012-Act-843.pdf).

**First research actions:** Send NIA a structured institutional eligibility enquiry covering foreign applicants, customer-led onboarding, processor/subprocessor participation, API/sandbox and biometric modalities; obtain current technical specifications, pricing, test environment, SLA, consent/notice requirements, fallback and contract terms; confirm DPC certification path; assess non-NIA alternatives only if lawful.

**Current status:** Planned — NIA has a published institutional onboarding route, but VeriFire has no contract or access.

### Egypt — first commercial priority

**Why it matters:** Large population and growing digital-finance market, although cited 2024 Findex indicators show lower digital-payment penetration than the other first-wave markets. Treat Egypt as a strategic growth/catch-up market rather than assuming the same immediate digital-KYC demand as Kenya or Ghana.

**Identity / verification landscape:** National ID and civil-status sources, commercial KYC vendors and financial-sector identity processes require jurisdiction-specific diligence. No direct access route is assumed.

**Privacy / regulatory starting point:** Personal Data Protection Law No. 151 of 2020. Egypt's Ministry of Communications and Information Technology fintech landscape report describes licensing/permit and security-accreditation requirements, including for processing and cross-border transfers, and heightened requirements for sensitive personal data. Confirm current implementing regulations, regulator processes, licences and local-representative requirements with Egyptian counsel before processing.

**First research actions:** Commission local legal review; clarify PDPC licensing and cross-border-transfer requirements; identify approved national-ID verification and company-registry access routes; assess local hosting/residency expectations and Arabic-language operational support.

**Current status:** Planned — legal and access diligence is a priority gate.

### Uganda — first commercial priority

**Why it matters:** Strong mobile-money adoption: 67.7% of adults had a mobile-money account and 70.6% made or received a digital payment in 2024 in the cited Findex indicators. Attractive for mobile-money, lending, agent networks, digital commerce and fraud-prevention use cases.

**Identity / verification landscape:** NIRA's 2015 Access and Use Regulations establish a formal route for non-government applicants: apply to NIRA in Form 1, specify the person, applicant capacity and purpose, and provide the data subject's prescribed consent for individual-record access; fees apply and NIRA retains refusal discretion. Separately, NIRA published a 2024 PKI-secured-services initiative seeking vetted, registered third-party providers for citizen e-consent eKYC and verification of digitally signed NIRA documents. This is a promising route to investigate, but it is not evidence that a general-purpose API is open or that VeriFire has been approved. [Access and Use Regulations 2015](https://www.nira.go.ug/media/2022/08/Access-and-Use-of-Information.pdf) · [NIRA PKI-secured-services initiative](https://www.nira.go.ug/media/2024/02/Provision-of-PKI-Secured-Services.pdf).

**Privacy / regulatory starting point:** Uganda's 2021 Data Protection and Privacy Regulations restrict processing or storage outside Uganda unless adequate protection is demonstrated to PDPO or the data subject consents; onward transfer has an express-consent condition. PDPO's current portal requires organisations collecting personal data to register as controllers, processors or collectors and obtain a certificate. Offshore providers are not automatically outside the law. Confirm the current application of the Regulations, transfer mechanism and sector requirements with Ugandan counsel. [PDPO](https://pdpo.go.ug/) · [Data Protection and Privacy Regulations 2021](https://pdpo.go.ug/media/2022/03/Data_Protection_and_Privacy_Regulations-2021.pdf).

**First research actions:** Ask NIRA whether its PKI initiative remains active, whether new third-party eKYC providers are being onboarded, and whether an eligible Ugandan customer may hold the access agreement while VeriFire acts as named processor/subprocessor. Obtain current API/PKI specifications, sandbox, pricing, consent form, allowed purposes and data-transfer requirements. Confirm Metadusk's PDPO registration and Uganda hosting/transfer obligations.

**Current status:** Statutory institutional access route and a third-party PKI/e-consent initiative identified; commercial access and provider onboarding unconfirmed — no approved provider route.

### Senegal — first commercial priority

**Why it matters:** Senegal adds a Francophone West African market to the first commercial wave and creates a route to validate VeriFire's product, language and support model beyond Anglophone markets. Digital financial services, mobile money and regional payment interoperability are promising demand areas, but customer demand and adoption levels must be quantified with current, comparable country data before setting revenue assumptions.

**Identity / verification landscape:** The Ministry of Interior identifies the Direction de l'Automatisation des Fichiers (DAF) as the office to contact for the biometric national identity card. The DAF's official mandate includes managing non-police population files and centralizing and processing information held by the Ministry of Interior. This establishes the competent institutional lead, **not** a verified private-sector API or commercial access right. Obtain written confirmation of eligible entities, lawful purposes, technical interface, fees, assurance level, auditability and permitted onward processing before designing a DAF route. The Ministry's February 2026 notice reported a temporary suspension of national-ID card production following a system incident; the DAF later announced production resumed on 1 April 2026. Treat operational resilience, incident disclosure and continuity arrangements as explicit provider/authority diligence items.

**Privacy / regulatory starting point:** Review Senegal's Law No. 2008-12 and the Commission de Protection des Données Personnelles (CDP). The CDP's published filing guidance distinguishes ordinary declarations from authorization requests for sensitive processing (including biometric and interconnected processing) and transfers to third countries. VeriFire must obtain Senegalese counsel's determination of the applicable filing/authorization path before processing or transferring data. Also assess applicable BCEAO/WAEMU and sector rules for the intended customer and product.

**First research actions:** Obtain written CDP guidance on VeriFire's likely controller/processor and cross-border roles; open an institutional access enquiry with DAF and obtain its current private-sector verification onboarding rules; validate the public OHADA RCCM portal's Senegal record coverage, data freshness, legal reliance and permitted commercial reuse; shortlist French-speaking fintech, payment and marketplace design partners; validate the 2024 Findex baseline against current BCEAO/WAEMU and national market data.

**Verified institutional research (28 November 2026):**
- The Ministry of Interior's official service page directs national identity-card enquiries to the DAF. Its DAF profile describes responsibility for non-police population files and centralized processing; this is an institutional contact, not evidence of a private-sector verification API. [Ministry of Interior — biometric national identity card](https://www.interieur.gouv.sn/en/services/services-aux-usagers/carte-nationale-d-identite-biometrique) · [DAF mandate](https://interieur.gouv.sn/en/le-ministere/directions/direction-de-l-automatisation-des-fichiers-daf).
- The DAF announced that national-ID card production was temporarily suspended after a system incident on 5 February 2026; the Senegalese Press Agency reported that production resumed on 1 April 2026. This is a concrete operational-continuity diligence point, not evidence that identity records were compromised. [DAF notice](https://interieur.gouv.sn/actualites/communiques/communique-de-la-direction-de-l-automatisation-des-fichiers-du-05-fevrier-2026) · [APS report on resumption](https://aps.sn/la-daf-annonce-la-reprise-de-la-confection-des-cartes-nationales-didentite-depuis-le-1er-avril/).
- The CDP's current filing page states that authorization requests cover sensitive processing such as biometric/interconnected processing and transfers to third countries; ordinary database processing follows a declaration route. The exact applicable route must be confirmed with counsel and the CDP. [CDP filing formalities](https://www.cdp.sn/conformite/formalites) · [Law No. 2008-12](https://www.cdp.sn/legislation/textes-legislatifs).
- The OHADA regional RCCM portal describes public access to official company/trader register information across 17 member states, including company history and legal filings. This is a promising KYB research source, but record-level completeness, Senegal coverage, legal reliance, commercial reuse terms and service-level guarantees still need validation. [OHADA RCCM portal](https://rccm.ohada.org/).
- BCEAO's PI-SPI interoperable instant-payment platform was officially launched in Dakar on 30 September 2025 for the eight UEMOA countries. This supports the regional digital-payments demand thesis; it is not an identity-verification source or permission to access payment customer data. [BCEAO PI-SPI launch](https://pispi.bceao.int/Actuali%C3%A9s/lancement-officiel-de-la-plateforme-interoperable-du-systeme-de-paiement-instantane-pi-0) · [PI-SPI service overview](https://pispi.bceao.int/).

**Current status:** Planned — no approved provider route; legal, institutional-access and French-language operating requirements remain to be validated.

### Rwanda — first commercial priority

**Why it matters:** Official FinScope 2024 data reports 96% financial inclusion, 92% formal financial inclusion, 86% of adults owning or having used mobile money, and registered mobile wallets rising from 60% in 2020 to 77% in 2024. This is strong evidence of expanding digital-finance usage and supports prioritizing Rwanda commercially.

**Identity / verification landscape:** National Identification Agency (NIDA) identity infrastructure is a potential anchor. Institutional access, permissible purposes, technical channels, biometric rules, fees and contractual terms need confirmation. No direct NIDA integration is assumed.

**Privacy / regulatory starting point:** Law No. 058/2021 relating to the protection of personal data and privacy. Rwanda's Data Protection and Privacy Office identifies the National Cyber Security Authority as the supervisory authority. Confirm controller/processor registration, cross-border transfers, sensitive/biometric data conditions, local representative and retention obligations.

**First research actions:** Contact NIDA regarding institutional verification onboarding; consult the Data Protection and Privacy Office on registration and cross-border processing; map RDB business-registration verification options; seek local fintech and financial-institution design partners.

**Current status:** Planned — no approved provider route.

## 4. Cross-country product opportunities to validate

| VeriFire product area | Initial commercial hypothesis | Key caution |
|---|---|---|
| Person KYC / identity verification | Core demand across all eight markets | Country-specific source access and lawful purpose required |
| KYB / business verification | Fintechs, lenders, marketplaces, payment providers and suppliers | Confirm company-registry access and beneficial-ownership data quality |
| Phone verification | Account opening, account recovery and fraud controls | SIM ownership data access is restricted; do not infer identity from phone possession |
| Fraud-risk signals | Synthetic identity, account takeover and onboarding abuse | Signals need provenance, accuracy, explainability and human-review paths |
| PEP / sanctions screening | Regulated financial services and risk-based onboarding | Define list sources, update frequency, false-positive handling and permitted use |
| AML / transaction monitoring | Potential later product for regulated customers | Customer licensing, regulatory obligations and transaction-data access need separate design |
| Biometric verification | Potentially relevant, particularly Ghana's 2026 NIA route | High-risk sensitive data; use only approved methods, avoid retaining biometric templates |

## 5. Provider discovery — do not contract or integrate yet

For each candidate provider or government authority, collect the same evidence pack:

1. Legal entity, regulator status and contracting entity.
2. Exact country, product, subject type and assurance-level coverage.
3. Authoritative source(s) accessed and proof of permission to access them.
4. Onboarding eligibility, permitted customer types and permitted purposes.
5. API documentation, sandbox, uptime/SLA, rate limits and support.
6. Pricing, minimum commitments, implementation fees and currency.
7. Data controller/processor roles, subprocessors and data-processing agreement.
8. Data location, transfer mechanism, retention, deletion and audit evidence.
9. Security certifications, penetration-test summary, incident handling and business continuity.
10. Match accuracy, false-positive/false-negative evidence, dispute and correction process.

A provider's claim of "Africa-wide coverage" is not evidence that it has lawful, direct, current access to each country's authoritative source.

## 6. Commercial validation plan

### Stage A — demand validation
- Interview at least 10 target buyers per country across fintech, lending, payments, marketplaces, telecoms and regulated financial services.
- Identify onboarding volumes, fraud losses, current verification vendors, failed-verification rates, turnaround-time needs and price tolerance.
- Separate customer interest in KYC, KYB, phone, fraud, sanctions and AML; do not assume one buyer needs all products.

### Stage B — provider and legal feasibility
- Build one source-to-product map per country.
- Obtain written provider onboarding requirements and sample contracts.
- Obtain country-specific legal advice for data processing, biometrics, cross-border transfers, retention and regulated-use restrictions.
- Determine whether local entities, registrations, representatives or local hosting are required.

### Stage C — technical pilot gate
A country/product route remains Planned until all of these are evidenced and approved:
- lawful purpose and data-processing roles;
- provider contract and permitted source access;
- privacy, security and cross-border/residency approval;
- verified sandbox and production technical behaviour;
- match quality, error handling, manual review and dispute path;
- operational support, monitoring, incident response and fallback.

Only then can a restricted pilot be considered. Live requires a separate production-readiness approval. No country should be activated by marketing priority alone.

## 7. Decisions and open blockers

| Decision / input | Current position |
|---|---|
| First commercial countries | Nigeria, Kenya, South Africa, Ghana, Egypt, Uganda, Rwanda, Senegal |
| Technical African reference registry | Existing 54-country foundation; registry is not a live-coverage promise |
| Provider selection | Not selected |
| Government-source access | Not approved or contracted |
| Data-residency / hosting region | Not decided |
| AWS resource inventory | Incomplete because connected AWS role encountered organization explicit-deny discovery errors |
| Cloudflare data services | Connected account review found no D1/Queues and R2 not enabled; this is not proof about other accounts or external services |
| Production persistence adapter | Blocked pending hosting ownership, residency, data classification, recovery and security decisions |
| Live country/product routes | None approved |

## 8. Recommended immediate work order

1. **Nigeria and Ghana:** Nigeria's NINAuth route is aggregator-mediated and requires applicant Nigerian physical presence, consent, auditability and approved-purpose controls. Verify the proposed aggregator in NINAuth's live approved-partner lookup and resolve the published retention terms before any contract. Ghana's NIA IVSP route requires an institutional evidence pack, technical readiness and direct contract, with real-time biometric verification where available. Resolve VeriFire's eligible contracting/processor role in both countries before designing integrations.
2. **Kenya and Uganda:** verify government identity-source access and ODPC/NITA-U obligations; prioritize mobile-money and fintech customer interviews.
3. **Rwanda:** pursue NIDA access and Data Protection Office guidance; its 2024 mobile-money growth makes it a first-wave market, not a later expansion.
4. **South Africa:** assess Home Affairs and CIPC access, POPIA requirements and enterprise/bank customer demand.
5. **Senegal:** validate CDP requirements, national identity and RCCM access, and French-language buyer demand; map BCEAO/WAEMU requirements for target customers.
6. **Egypt:** commission legal and data-transfer diligence early; maintain commercial priority while treating legal/access feasibility as a gating workstream.

This document is a research baseline and execution plan, not legal advice, provider endorsement, approval to process personal data, or a declaration of live VeriFire coverage.


## Rwanda — NIDA / Single Digital Identity (SDID) institutional access research (28 November 2026)

### Verified programme and procurement position

NIDA is consolidating identity records into a unified digital identity profile. NIDA reported that the nationwide identity-detail verification and photography exercise concluded on 4 October 2026, with 13,725,589 people photographed; the stated objective is a unified identity profile for access to services. This confirms an active national identity modernization programme, not private-sector API access.

RISA's 2026 procurement for biometric verification endpoint technologies is a more concrete technical signal. The procurement is a multi-supplier, multi-user framework for NIDA and other specifically authorized government institutions. The public tender portal records an extension of the bid-submission deadline to 13 May 2026; this primary procurement window has passed. The procurement is not an open identity-data API or proof that a private verification platform may query the National Population Register.

The published clarification responses state that:
- SDID Core is the master demographic/credential repository; the surrounding ecosystem includes AMBAS/ABIS biometric matching, IDAM, audit ingestion, Irembo and Rwanda NPKI.
- Interoperability is expected through REST/JSON, TLS 1.3 with mutual TLS, OAuth 2.0 and OIDC/SAML as applicable.
- Detailed API specifications and sandbox credentials are supplied to awarded suppliers at Call-off Contract stage, not in the public clarification pack.
- For SaaS, personal and biometric data must be hosted in Rwanda. The clarification further says personal data, biometrics, logs and analytics under the framework must not be transmitted or mirrored outside Rwanda except with explicit written NIDA approval and subject to NDPO compliance. A DPA with NIDA is required at Call-off stage; NDPO registration applies as required.
- The framework's multi-user model names NIDA and authorized government institutions as users. It does not say that ordinary private customers or foreign processors are automatically eligible to obtain SDID access.

Official references:
- [NIDA — nationwide digital ID verification exercise completed 4 October 2026](https://www.nida.gov.rw/news-details/abarenga-miliyoni-13-nibo-bamaze-gufotorerwa-e-ndangamuntu-mu-gihe-cyumwaka)
- [RISA — biometric verification endpoint procurement and addenda](https://www.risa.gov.rw/publications/tenders)
- [RISA — consolidated bidder clarification responses (RFB RW-RISA-526975-GO-RFB (2.1))](https://www.risa.gov.rw/fileadmin/user_upload/RISA/Publications/Tenders/Consolidated_Bidder_Clarification_Responses_for_biometric_verification_endpoint_technologies.pdf)
- [RISA — SDID biometric verification endpoint procurement notice](https://www.risa.gov.rw/fileadmin/user_upload/RISA/Publications/Tenders/Specific_Procurement_Notice_for_SDID_Biometric_Verification.pdf)
- NIDA public contact: info@nida.gov.rw; call centre 3500.
- RISA procurement contact shown in tender notices: rdapprocurement@risa.gov.rw.

### Rwanda privacy and residency gates

Law No. 058/2021 applies to controllers, processors and third parties established in Rwanda and to entities outside Rwanda processing personal data of people located in Rwanda. The DPO's institutional FAQ says controllers and processors intending to process personal data must register; biometric information is sensitive personal data. It also requires a designated data protection officer.

Articles 48–50 establish important cross-border and storage conditions:
- Transfers outside Rwanda require an applicable legal condition; one route is supervisory-authority authorization supported by appropriate safeguards, while the law also identifies other limited grounds including data-subject consent and specified contractual grounds.
- Article 49 requires a written contract setting out roles and responsibilities where a person is authorized to access, share or transfer data outside Rwanda.
- Personal data is stored in Rwanda. Storage outside Rwanda requires a valid authorization/registration certificate from the supervisory authority.
- Article 52 limits retention to the purpose period unless a specified statutory, contractual or other listed ground justifies longer retention; data must be destroyed so it cannot be reconstructed in intelligible form at the end of the retention period.

For VeriFire, assume Rwanda-local hosting for any Rwanda identity or biometric data unless the DPO grants the required written authorization. Do not assume consent alone overrides the separate Article 50 storage authorization requirement. Obtain Rwanda counsel's advice on the precise Article 48 transfer basis, Article 50 storage certificate, processor registration and the SDID-specific NIDA restrictions before architecture selection.

Official references:
- [DPO — Law No. 058/2021, scope and definitions](https://dpo.gov.rw/dpp-law/general-provisions)
- [DPO — institutional FAQ, controller/processor registration, biometrics and DPO](https://dpo.gov.rw/faqs)
- [DPO — sharing, transfer, storage and retention, Articles 48–52](https://dpo.gov.rw/dpp-law/sharing-transferstorage-and-retention-of-personal-data)
- [Official Gazette text hosted by RISA](https://www.risa.gov.rw/fileadmin/user_upload/RISA/Publications/2.Laws/Law_relating_to_the_protection_of_personal_data_and_privacy.pdf)

### Questions for NIDA / RISA / DPO

1. Is SDID currently accepting any new non-government institutional participants, or is access limited to NIDA and named/authorized public institutions under the 2026 framework?
2. Is there a separate statutory or contractual route for a regulated private-sector institution (bank, fintech, telecom, insurer or marketplace) to request identity verification against SDID/NPR?
3. Can an eligible Rwandan institution be the direct applicant and contracting party while a foreign platform such as VeriFire is appointed as its named processor/subprocessor? Does NIDA need to approve that arrangement in writing?
4. Must the technology provider itself be established in Rwanda, registered with NDPO, or hold a local data-centre/hosting capability? What requirements apply to a foreign processor?
5. Does the biometric verification endpoint framework's multi-user list permit private-sector customers to use any awarded supplier, or only NIDA and the authorized government institutions listed in the procurement documents?
6. Is the primary procurement framework now awarded, and which suppliers/solutions have been selected? Are new call-offs or a later procurement expected?
7. What are the current SDID Core/AMBAS API onboarding, technical certification, mTLS/OAuth/OIDC, audit integration and sandbox procedures for an authorized participant?
8. Which methods are permitted (1:1 identity-bound verification, face/fingerprint/iris, signed QR validation)? Is 1:N identification restricted to defined deduplication or government functions?
9. What exact attributes and outcomes can an authorized institution receive, and can the service return a minimal result without exposing raw biometric templates or demographic records?
10. What consent or other lawful authority must be recorded for each query, and can the institution capture that evidence in its own customer interface?
11. Must all query payloads, results, biometrics, logs, telemetry, backups and support access remain in Rwanda? What written NIDA/DPO approvals are required for any remote support or cross-border access?
12. What are the DPA terms, retention/deletion rules, audit rights, incident-notification timelines, pricing, rate limits, SLA and service-continuity commitments?

### Draft institutional enquiry (not sent)

**To:** info@nida.gov.rw; rdapprocurement@risa.gov.rw  
**Subject:** Institutional enquiry — SDID identity-verification access and authorized technology-provider model

Dear NIDA / RISA Team,

We are conducting an initial institutional-access assessment for Metadusk VeriFire, a headless, server-to-server verification platform. We have reviewed NIDA's public digital identity programme information and RISA's 2026 procurement and consolidated clarifications for biometric verification endpoint technologies supporting the Single Digital Identity (SDID) ecosystem.

Before considering any application or technical work, please clarify:
- whether SDID/National Population Register verification is currently available to private-sector institutions, and the applicable eligibility and contracting route;
- whether a Rwandan institution may be the direct applicant and contracting party while VeriFire operates as its expressly authorized processor/subprocessor;
- whether a foreign technology provider must establish locally, register with the NDPO, or meet additional NIDA/NCSA requirements;
- whether the 2026 multi-user framework is restricted to NIDA and named/authorized government institutions, and whether any later onboarding or procurement route is planned;
- current API, authentication, sandbox and certification requirements for eligible institutions;
- supported identity-bound verification methods, permissible result fields, consent evidence and restrictions on biometric identification;
- Rwanda hosting, cross-border access, retention/deletion, audit and incident obligations; and
- applicable fees, rate limits, service levels and onboarding timelines.

We will not request credentials, submit live identity data or initiate production access during this assessment. Please direct us to the responsible institutional-access and data-protection teams and advise which formal application materials are required.

Kind regards,
[Authorized representative]
[Legal entity]
[Applicant institution, if different]
[Business address]
[Business email and telephone]

### Decision

Rwanda is a strategic market with an active national digital identity programme and a defined SDID technical ecosystem, but the available public evidence does not establish a private-sector access route for VeriFire. Treat the NIDA/SDID path as **institutional diligence only**. The 2026 framework's Rwanda-only hosting and explicit NIDA approval requirements are material constraints for a shared multi-country platform. No provider has been selected, no outreach has been sent, no credentials requested, no integration built and no country route enabled.


### South Africa — source-verified institutional access update (28 November 2026)

**Identity verification — Home Affairs NPR / Online Verification Service (OVS):** The Department of Home Affairs publicly confirms that its upgraded National Population Register verification service launched on 1 July 2025 for both government users and private-sector clients. The Department said three major private-sector users had transitioned at launch, and published tariffs of R10 per real-time verification and R1 per off-peak batch transaction under the fee structure effective 1 July 2025. These are dated published tariffs, not a guaranteed current quote. The Department's March 2025 announcement described rollout to all existing public/private clients; the July 2025 statement described the service as available to companies and government users. This is stronger evidence of a real institutional access route than a generic national-ID portal, but it does not establish that VeriFire itself qualifies, that a customer can delegate access to a foreign platform, or what onboarding/security conditions apply today. Obtain current written confirmation from Home Affairs before designing an adapter. [Home Affairs — upgraded verification system launch and fees](https://www.gov.za/news/media-statements/home-affairs-launch-world-class-new-identity-verification-service-and-cost) · [Home Affairs — March 2025 system upgrade](https://www.gov.za/news/media-statements/home-affairs-upgrades-critical-digital-verification-system-24-mar-2025).

**Digital Partnership / bank integrations:** Home Affairs' 9 March 2026 update confirms that participating banks connect directly to Home Affairs systems through a secure API-based Digital Gateway for Smart ID services. The initial phase went live at Capitec and Standard Bank branches, with FNB in final testing at that date; the rollout was phased. This is a bank-specific government partnership, not proof that the same Digital Gateway is generally available to identity-verification vendors or other businesses. Treat it as a separate institutional partnership route to enquire about, not an assumed OVS API. [Home Affairs — first bank branches go live under the Digital Partnership Model](https://www.gov.za/news/media-statements/home-affairs-first-bank-branches-go-live-under-new-digital-partnership-model).

**Company verification — CIPC APIVerse:** CIPC's official developer portal exposes a commercial read-only Companies API for searching and retrieving company data. CIPC API products use an OAuth 2.0 Authorisation API; the portal describes self-service app creation, API subscription, testing and usage monitoring. A beneficial-ownership API is listed as a subscription product, while filing, disqualified-director, XBRL, documents and streaming capabilities are shown as coming soon on the portal page reviewed. This is a concrete KYB research path, but data fields, beneficial-ownership coverage, pricing, permissible reuse, rate limits and production subscription terms still need validation. [CIPC APIVerse Hub](https://developer.cipc.co.za/) · [CIPC API documentation](https://developer.cipc.co.za/static/docs) · [CIPC API catalogue](https://developer.cipc.co.za/apis).

**POPIA / biometric and cross-border gates:** POPIA treats biometric information as special personal information (s26). Processing is generally prohibited unless an applicable s27 or category-specific exception/authorization applies; consent is one possible general authorization, not a universal substitute for analysing purpose, roles and the other conditions. A responsible party engaging an operator must authorize the processing and have a written contract imposing s19 security safeguards; the operator must notify the responsible party immediately of suspected unauthorized access/acquisition (ss20–21). The responsible party must notify the Regulator and affected data subjects as soon as reasonably possible after a security compromise (s22). Section 14 limits retention and requires secure deletion/de-identification when no longer authorized. Section 72 allows transfers to a foreign recipient only under one of its specified grounds, including adequate protection under law/binding rules/agreement, consent or defined contractual/benefit grounds. Section 57 prior authorization is specifically triggered by the listed processing patterns (including certain reuse/linking of unique identifiers, criminal-behaviour processing on behalf of third parties, credit reporting, and specified transfers of special/children's data to a country without adequate protection); biometric processing alone is not listed as an automatic s57 trigger, though s26–27 still apply. The Information Regulator's portal describes the prior-authorization application process. [POPIA — official Act text](https://www.justice.gov.za/legislation/acts/2013-004.pdf) · [Information Regulator — prior authorisation](https://eservices.inforegulator.org.za/priorauthorisation/default.aspx).

**FICA customer obligations:** FIC Guidance Note 7B, published 3 August 2026, says accountable institutions must keep customer due-diligence records, including copies of or references to information obtained to verify identity. This is a customer-recordkeeping obligation; it does not mean VeriFire should retain raw identity documents by default. Design configurable evidence references, customer-controlled retention and deletion, and ensure the institution's statutory recordkeeping duties are not silently transferred to the platform. [FIC Guidance Note 7B (3 August 2026)](https://www.fic.gov.za/wp-content/uploads/2026/08/Guidance-Note-7B-%E2%80%93-Implementation-of-various-aspects-of-the-FIC-Act.pdf).

**First research actions:** Ask Home Affairs for current OVS onboarding criteria, whether VeriFire can be a named technical operator under a customer's direct contract, permitted query fields/methods, API/security specification, test environment, tariff schedule and SLA. Separately ask CIPC to confirm commercial Companies/beneficial-ownership API subscription terms and permitted resale/processor use. Obtain South African counsel's POPIA analysis for VeriFire's exact controller/operator/suboperator roles, biometric legal basis, s57 prior-authorisation triggers, s72 transfer structure, Information Officer registration and sector-specific FICA obligations.

**Current status:** Home Affairs private-sector NPR verification and CIPC commercial company-data APIs are publicly documented access channels. Neither has been contracted or tested by VeriFire; no delegation, foreign-processor eligibility or live route is confirmed.


### Egypt — source-verified institutional access update (28 November 2026)

**Digital Financial Identity (DFI) / bank eKYC:** The Central Bank of Egypt (CBE) issued regulations on 23 August 2026 for the Digital Financial Identity platform used to identify bank customers and verify their identities electronically. CBE's official summary says the framework applies to all Egyptian banks, licensed entities eligible to join the approved DFI platform, CBE-authorized banking agents and other parties involved in DFI services. Supported functions include eKYC, identity verification and updates, electronic authentication of banking transactions and consent, and digital identity sharing. This is a significant institutional channel for the financial sector, but participation is eligibility-gated; it is not a public API or general entitlement for foreign verification vendors. VeriFire must establish whether a licensed Egyptian customer can sponsor an approved integration and whether a foreign technology processor may participate. [CBE — Digital Financial Identity](https://www.cbe.org.eg/en/payment-systems-and-services/digital-financial-identity) · [CBE — DFI/eKYC regulations announcement, 24 August 2026](https://www.cbe.org.eg/en/news-publications/news/2026/08/24/09/40/ekyc-2026).

**National biometric verification system / Civil Status Sector:** MCIT announced on 26 August 2026 that, with the Ministry of Interior, it had established an integration platform coordinated with the Civil Status Sector and an infrastructure for biometric verification and e-signature services. The initial pilot enables licensed telecom operators to provide identity-verification and e-signature services through mobile applications. NTRA, ITIDA, CyShield and licensed e-signature companies are involved. This is a live/piloting national digital-identity ecosystem, but the announcement identifies licensed telecom operators as the initial channel and does not establish general private-company or foreign-platform access to the Civil Status database. Treat this as a government/telecom partnership enquiry, not an available open API. [MCIT — biometric verification and e-signature pilot, 26 August 2026](https://mcit.gov.eg/en/Media_Center/Latest_News/News/117426).

**Non-bank financial institutions / FRA:** The Financial Regulatory Authority's 25 August 2026 statement says entities under FRA supervision using fintech, including fintech outsourcing service providers, must verify national-ID authenticity, confirm mobile-line ownership and screen clients against AML/asset-freeze watchlists. It also describes OTP verification at contract execution and fund disbursement for consumer-finance and MSME-finance institutions, with a compliance grace period ending the following January for the remaining institutions. This creates clear demand for regulated, auditable verification workflows, but does not itself grant VeriFire access to government identity data or authorize it to provide a regulated service. The applicable FRA resolutions, amendments, outsourcing approvals and customer responsibilities must be obtained. [FRA — customer identity and data verification standards, 25 August 2026](https://fra.gov.eg/en/fra_news/%D8%AF-%D8%A5%D8%B3%D9%84%D8%A7%D9%85-%D8%B9%D8%B2%D8%A7%D9%85-%D8%B1%D8%A6%D9%8A%D8%B3-%D8%A7%D9%84%D9%87%D9%8A%D8%A6%D8%A9-%D8%A7%D9%84%D8%B9%D8%A7%D9%85%D8%A9-%D9%84%D9%84%D8%B1%D9%82%D8%A7%D8%A8-2/).

**Commercial registry:** MCIT announced that nine commercial-registry services became available exclusively through the Digital Egypt platform from 1 January 2026, including inquiries and verification of commercial registration and issuance of extracts/certificates. This establishes an official digital verification service for registry information, but the announcement does not describe a public API or commercial redistribution licence. Confirm whether a business-facing integration or authorised data-provider model exists. [MCIT — nine commercial registry services on Digital Egypt, 1 January 2026](https://mcit.gov.eg/en/Media_Center/Press_Room/Press_Releases/98927).

**PDPL compliance — now an immediate market-entry gate:** Egypt's Personal Data Protection Law No. 151 of 2020 is now supplemented by Executive Regulations issued under Decree No. 816 of 2025. The one-year compliance transition ended at the end of October / beginning of November 2026; current legal updates describe the framework as fully enforceable from 1 November 2026. The PDPC's electronic portal for licence, permit and accreditation applications was reported launched in October 2026. Foreign controllers/processors can fall within the regime; current commentary reports that portal authentication for foreign entities relies on a duly authorized local representative using Digital Egypt credentials. The MCIT's official 2024 fintech landscape report already describes a licensing/permit regime, PDPC oversight, DPO registration and a local-representative requirement for foreign controllers. The practical portal workflow and precise licence categories must be confirmed directly with PDPC and Egyptian counsel; do not assume that a generic consent checkbox or customer contract is enough.

Cross-border processing is particularly material for VeriFire: the PDPL and Executive Regulations establish a licensing/permit framework for transfer, storage, sharing or processing across borders. Secondary legal analysis of Article 15 of the Executive Regulations describes a destination-specific PDPC licence for cross-border transfers, with narrow statutory exceptions that do not remove the underlying safeguards and regulator assessment. Obtain the official Arabic text and a certified legal interpretation before selecting a hosting region or transferring Egyptian identity/biometric data. Sensitive personal data processing is separately subject to heightened requirements, including explicit consent and PDPC authorization/licensing as applicable. [MCIT — Egyptian FinTech Landscape 2024, PDPL summary](https://mcit.gov.eg/Upcont/Documents/Reports%20and%20Documents_1332025000_Egyptian_FinTech_Landscape_2024_13032025.pdf) · [PDPC / MCIT — recent regulator activity, 24 November 2026](https://mcit.gov.eg/en/Media_Center/Latest_News/News/121665) · [Baker McKenzie — PDPL update, 7 October 2026](https://www.bakermckenzie.com/en/insight/publications/2026/10/egypt-personal-data-protection-law-update) · [Executive Regulations, English translation (secondary source)](https://eg.andersen.com/wp-content/uploads/2026/02/Law-No.-151-of-2020.pdf).

**First research actions:** Ask CBE about DFI ecosystem membership and customer-sponsored vendor participation; ask MCIT/Ministry of Interior/NTRA whether the biometric pilot will admit additional licensed participants or technical providers; ask FRA what approvals apply to an outsourced verification platform; confirm Digital Egypt commercial-registry access rights; and obtain PDPC written guidance on controller/processor licences, local representation, sensitive-data authorization, cross-border permits, data localization, breach reporting and DPO obligations.

**Current status:** Egypt has an active regulated bank eKYC framework, a biometric identity pilot initially involving licensed telecom operators, a digital commercial-registry service and a newly operationalizing data-protection licensing regime. These are promising institutional leads, not proof of VeriFire access. No provider has been selected or approved.
