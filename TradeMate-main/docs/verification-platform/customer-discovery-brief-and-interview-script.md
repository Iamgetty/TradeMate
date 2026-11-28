# VeriFire customer discovery brief and no-personal-data interview script

**Version:** 1.0 — 28 November 2026  
**Purpose:** Validate commercial demand and customer readiness before any provider selection, integration or live-data pilot.  
**Initial discovery markets:** South Africa, Ghana, Nigeria and Kenya.  
**Status:** Internal preparation only. No outreach is authorized or implied by this document.

## 1. Interview rules

- Interview business, product, risk, compliance, operations and engineering stakeholders at prospective institutional customers.
- Do not request, accept or record real names of end users, national identifiers, identity documents, selfies, fingerprints, biometric templates, account credentials, production API keys or customer data exports.
- Use fictional examples and aggregate metrics only. If a participant begins sharing personal or confidential data, stop them and ask them to remove it from the discussion.
- Do not promise access to a national database, provider, regulator, API, sandbox, price, accuracy level or country launch.
- Do not imply VeriFire is approved, certified, contracted or production-ready in a country.
- Do not contact an authority/provider or send the institutional enquiry pack without separate explicit business approval.
- Record source and confidence for every statement: customer-reported, public-source verified, written authority confirmation, or unverified assumption.

## 2. Ideal customer profile

Prioritize organizations that:
- operate a regulated or clearly accountable digital service in one of the four initial discovery markets;
- perform recurring onboarding, customer due diligence, KYB, fraud prevention or account recovery checks;
- have a named compliance/risk owner and technical integration owner;
- can describe their current verification workflow and its measurable cost;
- have authority to evaluate vendors and a realistic procurement path; and
- are willing to discuss the use case without disclosing personal data.

Potential segments include banks and other regulated financial institutions, fintech/lending providers, payment and mobile-money businesses, insurance, telecoms, marketplaces and e-commerce platforms. Segment eligibility and source access must be verified per country; sector membership does not itself grant access.

## 3. 30–45 minute interview structure

### Opening (3 minutes)

Suggested wording:

> We are researching how organizations manage identity and business verification in [country]. We are not asking for personal data or production records, and we are not presenting any national-source integration as approved or available. We want to understand your current process, operational pain and the requirements a responsible API-first service would need to meet.

Confirm the participant's role and whether they are authorized to discuss the organization's process at a high level.

### Current workflow (8 minutes)

1. Which customer or business journeys require identity or business verification?
2. At what points in the journey do checks occur, and what triggers a re-check?
3. Which checks are performed internally, by a vendor, by a government source, or manually?
4. What happens when a check is unavailable, inconclusive, delayed or disputed?
5. Which teams own the process and its outcomes?

### Volumes and operational pain (8 minutes)

Ask for approximate aggregate ranges only:

- Monthly verification volume: under 1,000; 1,000–10,000; 10,000–100,000; over 100,000.
- Manual-review share: approximate percentage or range.
- Typical decision latency: seconds, minutes, hours or days.
- Failure/retry rate: approximate range and principal causes.
- Main operational cost drivers: vendor fees, staff review, abandonment, fraud loss, delayed activation or compliance overhead.
- Seasonal or peak-volume patterns.

Do not ask for exact transaction examples containing user data.

### Risk, legal and source requirements (8 minutes)

1. What law, regulator rule, licence condition or internal policy requires the check?
2. Which identity or company sources are currently authorized for your organization and purpose?
3. Who is the contracting party with each source?
4. Are external processors/subprocessors permitted? What written approval is required?
5. What consent, notice, lawful-basis and audit evidence must be maintained?
6. What are the requirements for data residency, cross-border transfers, retention, deletion and access logging?
7. Which assurance level and output attributes are actually necessary? Can a match/no-match or limited assertion replace raw evidence?
8. What independent review, DPIA, security assessment or audit is required before a pilot?

Do not interpret a participant's assumption as an authority approval. Capture the exact authority or document they rely on for later verification.

### Technical and operational requirements (8 minutes)

1. Does your team prefer REST APIs, SDKs, webhooks or a combination?
2. What authentication, network allowlisting, key rotation and secret-management requirements apply?
3. What are expected latency, availability, throughput and rate-limit requirements?
4. How should idempotency, retries, timeouts and manual-review outcomes work?
5. What audit events and evidence must be exportable?
6. What support hours, incident notification windows, recovery objectives and escalation paths are required?
7. Would a synthetic-data sandbox be sufficient for initial technical evaluation?
8. Confirm the customer owns the end-user interface and calls VeriFire through its own backend; browser/mobile clients must not receive server API secrets.

### Commercial qualification (7 minutes)

1. What is the current approximate cost per check, including manual handling?
2. How is the current service priced: per transaction, subscription, minimum commitment or enterprise contract?
3. What budget range is allocated to this problem?
4. Who owns the budget and who signs the contract?
5. What procurement, legal, security and compliance reviews are required?
6. What is the decision timeline and what event triggers a purchase?
7. What would make a new service materially better than the current approach?
8. Would the organization sponsor a non-production evaluation using synthetic data, subject to approvals?

Avoid quoting a VeriFire price until product scope, provider costs, support model and unit economics are established.

### Close (3 minutes)

Ask:
- May we follow up with a written summary of the requirements discussed?
- Who else should be involved in a later technical, compliance or procurement discussion?
- Which public documents or non-confidential policies should we review?

Do not ask for credentials, live data, private contracts or introductions to authorities as a condition of the interview.

## 4. Qualification record template

Complete one record per organization. Keep company contact details in the approved CRM, not in public repository notes.

| Field | Record |
|---|---|
| Organization / country | |
| Segment / regulated status | |
| Interview date / participant role | |
| Customer journey and verification use case | |
| Existing workflow and sources | |
| Aggregate monthly volume band | |
| Manual review / latency / failure bands | |
| Quantified pain and business impact | |
| Current source entitlement evidence | |
| Customer/controller and processor assumptions | |
| Processor delegation confirmed in writing? | Yes / No / Unknown |
| Required fields and assurance level | |
| Consent / lawful basis / notice requirements | |
| Residency / transfer / retention constraints | |
| API / webhook / security requirements | |
| SLA / support / audit requirements | |
| Budget range and current spend evidence | |
| Economic buyer / technical owner / compliance owner | |
| Procurement steps and timeline | |
| Synthetic sandbox evaluation interest | |
| Unresolved legal or provider questions | |
| Evidence classification | Customer-reported / public / written authority / assumption |
| Qualification outcome | Qualified discovery / nurture / disqualified / pending |
| Next action and owner | |

## 5. Qualification scoring

Score each dimension 0–2. A score is a prioritization aid, not legal or technical approval.

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| Problem severity | No clear problem | Pain described but unquantified | Measurable cost, risk or conversion impact |
| Recurring demand | Rare / unclear | Moderate or seasonal | High, recurring volume |
| Buyer access | No owner identified | Influencer identified | Economic buyer and procurement path identified |
| Compliance readiness | No accountable owner | Owner identified, requirements unclear | Compliance owner and requirements documented |
| Source entitlement | No lawful route identified | Possible route, unconfirmed | Written source entitlement and processor model evidence |
| Technical readiness | No integration owner | Owner identified, architecture unclear | Integration owner and requirements documented |
| Commercial readiness | No budget | Budget hypothesis | Budget range and buying timeline evidenced |

**Interpretation**
- 11–14: priority discovery candidate, subject to legal/provider gates.
- 7–10: continue discovery; resolve buyer, economics or entitlement gaps.
- 0–6: nurture or deprioritize.

A score cannot override a hard legal, privacy, source-access or security blocker. A written source-entitlement score of 0 or 1 means no live-data pilot.

## 6. Country-specific questions to add

### South Africa
- Is the organization currently onboarded to DHA's National Population Register Online Verification Service?
- Which entity holds the DHA agreement and technical connection?
- Does DHA permit a third-party technical operator or processor, and what written approval is needed?
- Has the organization reviewed current DHA tariffs, batch/off-peak conditions and CIPC APIVerse commercial reuse terms?
- What POPIA operator, special-personal-information, retention, transfer and FIC evidence obligations apply to this exact use case?

### Ghana
- Does the organization hold a direct NIA IVSP agreement?
- Has NIA confirmed the permitted verification methods and biometric modality for the use case under the current rules?
- Does NIA permit a named technical processor/subprocessor and what contract or approval is required?
- What DPC certification/registration and data-flow approvals are current?
- What fields, response formats, service levels, fees and test environment are contractually available?

### Nigeria
- Is the organization an approved NINAuth applicant, verification partner or customer of an approved aggregator?
- Does the relevant route require Nigerian physical presence for the applicant, and who satisfies it?
- Has NIMC/aggregator confirmed in writing whether the customer may appoint VeriFire as processor/subprocessor?
- What exact purpose, consent, field permissions, audit, reporting and independent-audit requirements apply?
- How do NINAuth/aggregator retention terms interact with customer and processor deletion obligations?

### Kenya
- Is the organization authorized for the eCitizen Health ID / NRB service and for this precise purpose?
- Does the service permit a technical processor/subprocessor, and what written approval is required?
- What biometric data-centre serving-copy, DPIA submission, ODPC registration and breach-reporting requirements apply?
- What cross-border transfer and support-access arrangements are permissible?
- Can the use case operate with a minimal match assertion rather than retaining biometric samples?

## 7. Pilot readiness — mandatory stop/go gate

Do not propose or activate a live-data pilot until a written decision record identifies:

- named customer and accountable business sponsor;
- source/provider and proof of customer entitlement;
- written approval for VeriFire's exact processor/subprocessor role;
- purpose, lawful basis, consent/notice and data-subject rights workflow;
- exact request/response fields and minimum data design;
- primary, backup, log, support and subprocessor data locations;
- residency, transfer, retention, deletion and legal-hold controls;
- DPIA/security assessment and applicable regulator/authority approvals;
- API authentication, secret custody, rate limits, audit and incident response;
- provider SLA, support, continuity and commercial terms;
- synthetic sandbox results and documented acceptance tests;
- budget, pilot scope, success metrics, stop conditions and exit plan; and
- explicit internal approval to process real data and enable the specific country/product route.

Until all applicable items pass, evaluation must remain limited to public information, synthetic test data and non-production technical work.

## 8. Suggested interview success metrics

After the first 8–12 interviews, report:
- number of organizations interviewed by country and segment;
- proportion with recurring use case and measurable pain;
- aggregate volume bands and manual-review ranges;
- number with a named buyer, compliance owner and technical owner;
- number with written source entitlement and processor delegation evidence;
- recurring legal/data-residency blockers;
- budget evidence and procurement timelines;
- interest in synthetic sandbox evaluation; and
- recommended next market based on evidence.

Do not report a country as launch-ready based only on interview interest.
