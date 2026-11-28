# VeriFire CLI

The CLI is the terminal installer and product selector for the standalone verification platform. Each verification product is selected and versioned independently; there is no all-products installation command.

## Install the CLI

```sh
npm install --global @metadusk/verifire-cli
verifire init --url <hosted-api-url>
```

## Browse and select products

```sh
verifire products
verifire versions kyc
verifire install kyc@1.0.0
verifire install kyb@1.0.0
verifire list
verifire remove kyc
```

A product installation requires an explicit product and version. It records that selection in the current project's `.verifirerc.json`. Multiple products may be selected independently and may use different versions.

## Important current limitation

The initial catalogue is a versioned product-selection contract. At this stage, `install` records a local selection only. It does **not** activate a hosted entitlement, provision a tenant, connect a provider, install a local verification engine, or imply that the selected product is live. Those require the future hosted control plane and approved provider coverage.

The CLI never collects end-user identity evidence or stores integration API keys in the project configuration. Do not put secrets in source control or shell history.

## Run the CLI tests

From this directory, run `npm test` using Node.js 20 or later.
