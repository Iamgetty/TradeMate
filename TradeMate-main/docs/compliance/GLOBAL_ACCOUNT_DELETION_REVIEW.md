# Global account deletion review

## Product policy

Users have 30 days to cancel an account-deletion request. This is a product policy, not a statutory retention period and not permission to erase records that must be retained.

## Global legal scope

TradeMate is a global platform. Do not assume Nigerian law is the sole or default framework for every user. Before permanent deletion is enabled, qualified legal and compliance reviewers must assess the laws and obligations applicable to the user, organisation, transaction, data category, and processing locations.

The assessment should cover, where applicable:

- Privacy and data-protection laws and data-subject rights.
- Cross-border transfers, international hosting, subprocessors, and data-localisation rules.
- Financial, tax, accounting, payments, AML/CFT, sanctions, and sector-specific record retention.
- Contractual duties, commercial records, disputes, complaints, chargebacks, investigations, and litigation holds.
- Which records must be deleted, anonymised, access-restricted, or retained for a defined period, with a documented basis and expiry.
- Organisation ownership, membership, and records concerning counterparties or other users.

Nigerian requirements must be considered where applicable, alongside all other relevant national, regional, and sector-specific requirements. This is an engineering control, not legal advice.

## Activation gate

The deletion worker remains dry-run by default. Do not schedule destructive execution until a global, jurisdiction-specific legal review and a complete data-retention inventory are approved.

Execution requires both environment variables:
- `ACCOUNT_DELETION_EXECUTE=true`
- `ACCOUNT_DELETION_LEGAL_APPROVAL=true`

The second variable is an operational acknowledgement of completed review; setting it does not establish legal compliance. Keep both unset until approval.

Before activation, map personal data across account records, files, messages, verification records, transactions, contracts, disputes, support records, audit events, backups, and processors. Define retention and deletion rules, legal-hold handling, processor deletion, and monitoring. Expiry of the 30-day cancellation period alone is never sufficient authority to erase a record.
