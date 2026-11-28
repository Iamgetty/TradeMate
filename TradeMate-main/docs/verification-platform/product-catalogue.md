# Product catalogue and independent releases

## Product selection is not a bundle

The platform has one small CLI installer and a catalogue of separately versioned verification products. Developers choose a product and an explicit version. They can install, upgrade (by selecting a newer published version), list and remove each product independently.

```sh
verification products
verification versions kyc
verification install kyc@1.0.0
verification install kyb@1.0.0
verification list
verification remove kyc
```

There is deliberately no `verification install all` command. Installing the CLI alone does not install any verification product.

## Catalogue contract

The machine-readable catalogue lives at `packages/verification-cli/catalog/products.json`. Each product has a stable identifier, display name, description and list of semantic versions. A release status distinguishes catalogue entries from future states such as preview, available, deprecated or retired.

The first catalogue includes KYC, KYB, AML, sanctions, PEP, age, address, biometric, fraud, transaction monitoring, Travel Rule, phone and email verification. This is a proposed product catalogue, not a statement that every product is already implemented, legally available in every country, or backed by a contracted data provider.

## Meaning of "install" in this foundation slice

Currently the CLI validates the exact product/version against the local catalogue and writes that selection into the project's `.verificationrc.json`. This is intentionally local metadata only. It does not create a remote tenant entitlement, download a verification engine, enable a provider, or make a live verification request.

The future control plane must separately enforce tenant entitlements and provider/country capabilities on every API request. A local config file is never authorization evidence. Product releases, API versions, provider adapters and country availability have independent compatibility lifecycles.

## Release rules

- Require an explicit version; do not silently select a latest release.
- Keep product identifiers stable and version releases independently.
- Never let installing one product implicitly install another.
- Removing a local selection must not revoke server-side data or entitlements; those require explicit authenticated control-plane operations.
- A product version must not be labelled generally available until its API contract, tests, operational support, legal coverage and provider dependencies are approved.
