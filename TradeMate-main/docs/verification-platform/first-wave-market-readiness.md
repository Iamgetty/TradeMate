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
