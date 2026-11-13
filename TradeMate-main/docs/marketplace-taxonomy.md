# TradeMate marketplace taxonomy

**Status:** Approved target product architecture; implementation is staged and is not implied by this document.

This document defines the target taxonomy for TradeMate's hybrid marketplace. It is a product and domain model, not a statement that every division, listing type, regulated activity, payment rail or contract workflow is currently available.

## 1. Marketplace model

TradeMate has one unified global marketplace with specialist divisions.

- **Unified discovery:** search and discovery can span the marketplace, subject to user permissions, jurisdiction, verification and listing visibility.
- **Specialist divisions:** each division owns its taxonomy, listing attributes, participant rules, evidence requirements and applicable workflow.
- **Shared deal-making:** common identity, organization, communication, offer, negotiation, deal-room, contract, fulfilment, audit and dispute capabilities are reused where appropriate.
- **Contract-first:** the opportunity and intended agreement are central. This is not a conventional product-cart checkout.
- **Division is not transaction type:** the division classifies the subject of an opportunity; the transaction type describes the intended legal/commercial arrangement.

## 2. Top-level divisions

### 2.1 Sports
Covers athlete and coach recruitment, permitted transfers and loans, representation, sponsorship, team partnerships, event participation and sports commercial rights.

Possible subcategories:
- Athletes, coaches and technical staff
- Recruitment, transfer and loan opportunities where permitted by the relevant sport and governing rules
- Player/athlete representation and management
- Sponsorship, endorsement and brand partnerships
- Clubs, teams, academies and training partnerships
- Sports events, media and commercial rights

Division-specific data may include sport, discipline, role/position, age eligibility where lawful, governing body, competition, registration/transfer window, contract duration, compensation structure, representation mandate and consent evidence.

Safeguards: individuals are not assets for sale. Participation, representation and transfer processes require the individual's informed consent and compliance with applicable sport, employment, immigration and safeguarding rules.

### 2.2 Entertainment & Media
Covers creators, artists, performers, production, publishing, recordings, distribution, licensing and live events.

Possible subcategories:
- Artists, musicians, performers and creators
- Representation and management
- Recording, production and distribution agreements
- Publishing, royalties and rights licensing
- Film, television, digital media and production services
- Art, exhibitions, events, bookings and touring
- Media partnerships and sponsorships

Division-specific data may include work/asset description, rights being offered, territory, media, exclusivity, term, royalty or fee basis, credits, deliverables, release schedule and rights ownership/authority evidence.

Safeguards: agreements concern services, representation, bookings and defined rights. They must not imply ownership of a person or rights the counterparty does not control.

### 2.3 Business & Corporate
Covers business opportunities and corporate transactions.

Possible subcategories:
- Businesses for sale and acquisitions
- Mergers and strategic acquisitions
- Franchises and franchise opportunities
- Joint ventures and strategic partnerships
- Distributors, resellers and commercial representation
- Business succession and investment mandates

Division-specific data may include industry, jurisdiction, entity type, operating status, revenue/earnings ranges where disclosed, assets/liabilities scope, valuation basis, transaction perimeter, due-diligence materials, confidentiality requirements and authority to represent.

Safeguards: distinguish an indicative opportunity from a binding offer; require authority and appropriate due diligence before contract acceptance.

### 2.4 Real Estate & Property
Covers property, land, development, occupation and property-related commercial arrangements.

Possible subcategories:
- Residential and commercial property
- Land and development sites
- Industrial and logistics property
- Leasing, tenancy and property management
- Development partnerships and joint ventures
- Concessions and operating rights

Division-specific data may include property type, location, tenure/title status, permitted use, area and units, zoning/planning status, occupancy, lease term, rent/price basis, encumbrances and inspection/document availability.

Safeguards: verify title/authority, planning and local legal requirements. Do not represent a listing as legally transferable solely because documents were uploaded.

### 2.5 Technology & Intellectual Property
Covers technology products and services, software, platforms and commercialisation or licensing of intellectual property.

Possible subcategories:
- Software, SaaS and digital platforms
- AI, APIs, data and integrations
- Technology development and implementation
- Patents, trademarks, copyrights and designs
- Licensing, assignment and commercialisation
- Research, prototypes and technology partnerships

Division-specific data may include technology domain, deployment model, integrations, service levels, security posture, IP owner/authority, licence scope, territory, exclusivity, term, support, data-processing requirements and technical due-diligence materials.

Safeguards: establish ownership and licence authority; address privacy, cybersecurity, data residency and third-party/open-source obligations.

### 2.6 Professional Services & Talent
Covers professional services, independent specialists and recruitment.

Possible subcategories:
- Consulting and advisory
- Legal, accounting and other regulated professional services
- Engineering, design and technical specialists
- Recruitment and talent placement
- Independent contractors and project teams
- Training, research and outsourced services

Division-specific data may include discipline, deliverables, qualifications, licences, experience, location, availability, engagement model, duration, rate basis, service levels and insurance where relevant.

Safeguards: verify licences and professional standing where required. Distinguish employment, recruitment, agency and independent-contractor arrangements.

### 2.7 Industrial, Manufacturing & Trade
Covers industrial capacity, manufacturing, wholesale, supply and physical trade services. It does not introduce a conventional consumer product-cart workflow.

Possible subcategories:
- Manufacturing capacity and contract manufacturing
- Machinery, equipment and industrial assets
- Raw materials and wholesale supply opportunities
- Procurement and sourcing mandates
- Import/export and trade services
- Logistics, freight, warehousing and distribution
- Industrial maintenance and technical operations

Division-specific data may include specification, grade/standard, capacity, quantity bands, production lead time, origin, destination, Incoterms where applicable, inspection/certification, logistics, delivery milestones and supplier qualification.

Safeguards: apply customs, sanctions, export-control, product-safety and environmental requirements. Any physical goods workflow must be an explicitly approved commercial agreement, not an unapproved product-cart checkout.

### 2.8 Agriculture & Natural Resources
Covers agricultural production, inputs, processing, natural-resource projects and supply partnerships.

Possible subcategories:
- Farms, crops and livestock
- Fisheries and aquaculture
- Agricultural inputs, equipment and services
- Processing, storage and agricultural logistics
- Mining, minerals and extractive projects
- Forestry and sustainable resource management
- Offtake, supply and production partnerships

Division-specific data may include commodity/species, grade, season, volume, origin, production capacity, land/concession rights, certifications, traceability, delivery window and environmental/social evidence.

Safeguards: verify licences, land/resource rights, environmental approvals, traceability and applicable wildlife, forestry, mining and food-safety rules.

### 2.9 Finance & Investment
Covers financing and investment-related mandates, subject to jurisdiction-specific licensing and approval.

Possible subcategories:
- Venture capital and private equity mandates
- Business funding and capital raising
- Trade finance and structured finance
- Debt and financing opportunities
- Insurance-related mandates
- Investment advisory and corporate finance engagements

Division-specific data may include instrument/mandate type, issuer or counterparty, jurisdiction, investor eligibility, amount/range, term, risk disclosures, fees, licensing status and required offering documents.

Safeguards: no unlicensed securities offering, investment advice, lending, insurance distribution or financial promotion. Gate functionality by jurisdiction, provider authorisation, participant eligibility and legal review. Listing an opportunity is not regulatory approval or a recommendation.

### 2.10 Institutions & Infrastructure
Covers public and private institutional counterparties and large-scale infrastructure.

Possible subcategories:
- Government and public-sector procurement
- Energy, utilities and power
- Healthcare institutions and health infrastructure
- Education, universities and research institutions
- Transport, aviation, ports and mobility
- Telecommunications and digital infrastructure
- Construction and major development
- Environmental, water and climate infrastructure
- Public-private partnerships, concessions and operating agreements

Division-specific data may include procuring authority, tender/RFP reference, procurement method, eligibility, jurisdiction, scope, budget/range where public, submission deadlines, technical standards, permits, financing, milestones and required certifications.

Safeguards: verify institutional identity and signatory authority. Public procurement, concessions and institutional contracts require the applicable tender, transparency, anti-corruption, procurement and compliance checks.

## 3. Shared transaction types

Transaction types are selected independently from the division and constrained by that division's policy and jurisdiction.

- Sale or acquisition
- Transfer or loan, where the subject and rules permit
- Lease, rental or concession
- Recruitment, appointment or engagement
- Representation or agency mandate
- Licence or assignment of defined rights
- Investment, financing or capital mandate
- Partnership or joint venture
- Service or professional-services agreement
- Supply, procurement or offtake agreement
- Tender/RFP response
- Distribution, franchise or operating agreement

The platform must not expose every transaction type in every division. A division-specific compatibility policy determines which types are valid.

## 4. Shared platform capabilities

The target shared capabilities are:

1. Identity, account security and organisation profiles.
2. Participant, organisation, authority and document verification.
3. Division-aware listing creation, validation, moderation and discovery.
4. Search, filters, saved opportunities and controlled visibility.
5. Enquiries, counterparty communication and consent-aware contact.
6. Offers, counteroffers and negotiation history.
7. Private deal rooms, document access controls and audit trails.
8. Contract drafting/review, versioning, acceptance and status history.
9. Fulfilment milestones, evidence, completion confirmation and disputes.
10. Reputation, reporting, moderation and risk controls.
11. Notifications, internationalisation, localisation and jurisdiction controls.

These capabilities should be shared only where their semantics are genuinely common. Specialist workflows may add states, evidence and approvals without weakening shared authorization or audit controls.

## 5. P2P and market information boundaries

P2P crypto remains a separate product workflow from the contract-first marketplace. Its future direction may include fiat and crypto exchange, local-currency deposits and withdrawals, sending and receiving, and cross-border transfers. Those capabilities require separate ledger, payment-provider, custody, AML/KYC, sanctions, wallet-screening, dispute, liquidity and jurisdictional architecture.

Crypto and Forex market information is informational data, not an offer to execute a trade. Neither market quotes nor the Finance & Investment division should silently turn TradeMate into a spot, derivatives or foreign-exchange trading venue.

## 6. Implementation and release rules

- The approved target contains ten divisions; it does not mean ten production-ready marketplaces exist.
- The currently established persistent marketplace contract paths are Services and B2B. Other divisions and specialist transaction flows must be implemented and tested incrementally.
- Do not mark a division complete based on navigation, labels, a listing form or an API route alone.
- Completion requires frontend-to-backend-to-database wiring, authorization and organization-boundary tests, audit coverage, failure/retry handling, responsive QA, and end-to-end acceptance for the relevant workflow.
- Regulated workflows remain gated until legal/compliance review, jurisdiction mapping, provider approval, threat modelling and security testing are complete.
- Keep the authoritative implementation status, sequencing and release gates in [roadmap.md](roadmap.md). This taxonomy does not replace or reorder that roadmap.

## 7. Governance for taxonomy changes

A taxonomy change should document:
- Division and category affected
- Intended counterparties and transaction types
- Required listing fields and validation
- Permission, verification and evidence requirements
- Jurisdictional/regulatory constraints
- Shared versus specialist workflow states
- API, database, UI, audit and test impact
- Rollout, migration and backward-compatibility plan

Do not add a new top-level division, change the approved ten-division structure or silently broaden P2P/financial scope without an explicit product decision.
