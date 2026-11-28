# Nigeria KYC/KYB Country Policy Baseline

**Status:** engineering baseline; not legal advice and not approved for production enforcement  
**Country:** Nigeria (NG)  
**Policy version:** NG-0.1-draft  
**Initial rollout:** Nigeria only; schema and orchestration must remain multi-country.

## 1. Legal and operational approval

Before production, qualified Nigerian counsel and the designated privacy/compliance owner must confirm TradeMate's actual operating model, customer types, transaction flows and legal perimeter. KYC/AML duties differ by regulated activity and entity category. Do not assume every marketplace activity makes TradeMate a bank, financial institution, capital-market operator or DNFBP.

The review must cover, as applicable:
- Nigeria Data Protection Act 2023 and NDPC General Application and Implementation Directive;
- Money Laundering (Prevention and Prohibition) Act 2022 and applicable sector-specific AML/CFT/PF regulations;
- applicable beneficial ownership and company disclosure rules under CAMA 2020 and CAC regulations;
- NIMC/NIN access and authentication requirements;
- sanctions, PEP, suspicious-activity escalation and record-retention duties for the actual products and counterparties.

## 2. Individual KYC

### Initial path
Use the existing TradeMate Persona individual inquiry integration as the first implementation path, subject to verified Production configuration and full acceptance. Persona hosted document capture and liveness should collect only the fields/checks configured in the approved template.

### Nigeria identity evidence
The country policy must allow the provider to establish actual supported Nigerian document types. Do not assume all national IDs or document variants are supported simply because the provider advertises Nigeria coverage.

NIN is sensitive and must not be treated as a public identifier. NIMC describes NIN as a unique lifetime identifier and instructs individuals to guard it. Do not expose it in public profiles, logs, support tickets or ordinary business documents.

A direct NIMC/NINAuth route is a separate, conditional adapter:
- use only an officially approved organization/developer access path;
- obtain explicit, purpose-specific user consent where required;
- follow NIMC provisioning, authentication, security and data-use rules;
- do not scrape, reverse-engineer or call undocumented endpoints;
- do not store raw NIN or biometric source data by default;
- store only the minimum verification result, transaction/reference ID and audit evidence permitted by the approved terms.

If NIMC access is unavailable, use the accepted Persona document/liveness path or documented manual fallback. Never tell users that NIN has been verified when only a document image was submitted.

## 3. Business KYB — CAC registered entities

### Entity categories
Support distinct entity types rather than a single generic company form:
- private/public company limited by shares;
- company limited by guarantee, where relevant to the marketplace;
- incorporated trustee, where relevant;
- registered business name / sole proprietor;
- partnership or other legally recognized form where CAC evidence and counsel approve the workflow.

The form must capture country, legal name, trading name (if different), entity type, CAC registration number, registration date, registered office, operating address (if different), business activity and authorized representative.

Do not require a company registration number from an entity type that does not have one. Route unsupported or ambiguous legal forms to manual review.

### Registry verification
The Corporate Affairs Commission's official iCRP portal exposes a Public Search function and official registration resources. Engineering must record the source, lookup date, searched identifier, result and evidence reference.

At this baseline:
- the public portal is an official manual/reference path;
- no public, generally available CAC API is assumed;
- do not scrape the portal or automate browser access without written authorization;
- use a licensed provider/official integration only after confirming its authority, source, permitted purposes, contract, API documentation and data-protection terms;
- where automatic lookup is unavailable, request the appropriate CAC certificate/extract/status evidence and use trained manual review with a documented reason and source.

A registry match should compare registration number, legal name, entity type and status; name-only matches are insufficient.

### Directors, owners and authorized representatives
Collect a role-based declaration for:
- directors and persons with equivalent control;
- beneficial owners and persons exercising control;
- the person submitting the KYB case;
- authorized signatories/representatives.

Record the person's role, ownership/control basis and percentage where relevant, declaration date and whether the person has a TradeMate account. Link to a user's KYC case only after verifying the account relationship. Do not infer that the uploader is authorized to bind the organization.

The beneficial ownership threshold, aggregation rules and fallback for complex ownership chains must be configurable by legal entity type, current Nigerian law and TradeMate's risk policy. Do not hard-code a universal 25% threshold without legal confirmation. If ownership cannot be reliably established, escalate to senior/manual review.

## 4. Risk and compliance checks

The policy engine should support, when required by the approved legal perimeter and risk assessment:
- sanctions and designated-person screening;
- PEP screening and relevant family/close-associate checks;
- adverse media with source, date and analyst disposition;
- high-risk geography and industry risk;
- ownership/control opacity and nominee arrangements;
- inconsistent registry, address, document or representative information;
- periodic and event-triggered refresh.

A possible match is a review case, not an automatic adverse decision. Record match rationale, source, confidence, reviewer, disposition and any appeal. Do not expose screening data to other marketplace users.

## 5. Evidence, storage and retention

- Keep CAC certificates, extracts, board resolutions, powers of attorney and other submitted evidence private.
- Record file hash, type, size, upload actor, organization, evidence category, received date and review outcome.
- Validate actual file signatures; declared MIME type alone is not sufficient.
- Provide reviewer preview/download only through authenticated, audited endpoints.
- Never expose raw files or reviewer notes in public organization responses.
- Define retention and deletion periods by legal purpose, contractual requirement and applicable law before production.
- Record any cross-border transfer assessment and safeguards before sending evidence or personal data to a foreign provider.

## 6. Manual-review decision requirements

Reviewer outcomes:
- **approved:** all required registry, entity, authority, ownership and risk checks meet policy;
- **needs_information:** specify missing evidence and allow resubmission without losing audit history;
- **rejected:** record a reason category and reviewer rationale; provide an appeal route where appropriate;
- **escalated:** suspected fraud, sanctions/PEP match, ownership opacity, conflicting evidence or legal uncertainty.

Organization activation, listing moderation and KYB approval must remain distinct state machines. A business may be active in the existing marketplace workflow without that fact being represented as a completed legal KYB check; marketplace permissions must be updated only through a separately approved policy.

## 7. Re-verification

Re-open or refresh a KYB case when:
- registry status changes or evidence expires;
- ownership, directors, control or signatory authority changes;
- the organization changes jurisdiction or legal form;
- a material risk alert, adverse media or sanctions-list update occurs;
- the risk tier requires periodic review;
- provider data becomes stale or a previous check is invalidated.

## 8. Official reference sources

- CAC official Company Registration Portal (iCRP): https://icrp.cac.gov.ng/
- CAC official Business Name registration guidance: https://cac.gov.ng/services/business-name
- NIMC official NIN information: https://nimc.gov.ng/nin/
- NIMC NINAuth official service: https://ninauth.nimc.gov.ng/
- NIMC NINAuth developer/access guidance: https://nimccbs.gov.ng/
- Nigeria Data Protection Act 2023 (NDPC-hosted GAID reference): https://ndpc.gov.ng/wp-content/uploads/2025/03/NDP-ACT-GAID-2025-MARCH-20TH.pdf
- EFCC/SCUML Regulations 2022 (applicability to be determined by counsel): https://www.efcc.gov.ng/efcc/images/EFGGSCUML_Regulations_2022.pdf

## 9. Open acceptance decisions

These must be closed before production:
1. Nigerian legal entity types and exact evidence list by type.
2. Applicable UBO/control thresholds and aggregation rules.
3. TradeMate's AML/CTF/PF regulatory perimeter and reporting obligations.
4. Lawful basis, notice and consent language for each check.
5. Retention periods, legal holds and cross-border transfer safeguards.
6. Approved CAC verification source/provider and access rights.
7. Whether/when direct NIMC/NINAuth integration is available to TradeMate.
8. Provider coverage for non-Nigerian residents and foreign directors/UBOs.
