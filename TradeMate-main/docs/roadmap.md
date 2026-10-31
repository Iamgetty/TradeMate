# TradeMate roadmap

This roadmap records the current product direction. It is not a claim that each item is already implemented or deployed.

## Current product principles

- TradeMate connects counterparties; it is not a conventional exchange or product checkout.
- The core outcome is a mutually agreed business contract.
- Current marketplace categories include Services and B2B, alongside Real Estate, Software, NFTs and market-information sections.
- Product listings and product-cart commerce are out of scope for the current build. A dedicated product marketplace may be reconsidered in a future version, subject to a deliberate product decision. It must not silently reappear in the current app.
- Keep P2P separate from the current marketplace contract workflow.

## Current implementation snapshot

The following work is present on the working branch only; it has not been deployed to production.

- **Product removal:** current Product category, product-cart UI and conventional marketplace transaction writes have been removed. Migration `009` converts legacy Product listing records to the explicit B2B type; historical migration files remain unchanged for reproducible database history.
- **B2B:** API and database now use `b2b` as a distinct listing type rather than reusing `product`.
- **Contracts:** persistent Services/B2B proposals, seller acceptance/decline, buyer cancellation, contract messages and dual fulfilment confirmation are implemented in the initial API/UI flow. No payment, escrow or e-signature is included. End-to-end QA remains.
- **Feed:** required title, file attachments, voice-note recording, inline audio playback and image previews are implemented. Mobile-device and failure-state QA remains.
- **Forex:** ten instruments are defined in each of the four requested groups, with a public quote route and no OANDA credentials. Live provider availability still needs verification.
- **Clients/Alpha modes:** the user-facing modes are Clients and Alpha; both have a Contracts view, while enquiries remain a separate Conversations view. Internal Buyer/Seller role values remain unchanged for compatibility. Permission and full workflow QA remains.
- **Validation:** the latest working-branch commit passed the web build, `node --check` for the served app script, API TypeScript build and clean PostgreSQL migration integration job. Live end-to-end and mobile testing remain outstanding.
- **Documents:** no litepaper or white paper source files were found in the available TradeMate repositories. The future Product consideration is recorded here and in the README; the original documents are needed before updating them.

## Pre-P2P completion

1. Remove legacy Product UI, API paths and terminology; retain B2B as its own marketplace offer type.
2. Complete B2B and Services publishing, discovery, review and counterparty flows.
3. Complete end-to-end QA of the initial contract proposal, review, acceptance/rejection, cancellation and mutual fulfilment confirmation flow; extend it consistently across supported market categories and remove all remaining conventional buy/sell/order/bid checkout paths.
4. Make Clients mode and Alpha mode reflect the same durable contract records and permissions without changing internal role permissions or historical records.
5. Complete Feed post titles, file attachments and voice notes, including playback/download and mobile failure states.
6. Verify Forex market groups and public quote availability for the requested top-ten indices, commodities, equities and bonds/treasuries.
7. Audit every tab, detail view, form, filter, menu, responsive layout, authorization boundary and performance hotspot.
8. Update the litepaper and white paper once their source documents are available in the repository.

## Later-stage P2P

P2P work begins only after the pre-P2P requirements are verified and the product owner has supplied the remaining instructions. Any live crypto trading, escrow, custody or payment feature requires jurisdiction-specific legal/compliance review, provider approval, threat modelling and independent security testing.

## Future consideration: Product marketplace

A product marketplace is a possible future feature only. It is not part of the current scope and should not be included in current navigation, search, publishing, checkout or contract flows unless explicitly approved in a future product decision.
