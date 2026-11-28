# Verification CLI

This package is the terminal installation and developer setup experience for the standalone verification platform.

Target developer experience (illustrative only; package name and exact commands remain provisional):

```sh
npm install --global @metadusk/verification-cli
verification init
verification connect
verification doctor
```

The CLI must never collect end-user identity credentials or biometric evidence. It must not print API keys, put secrets in shell history, or commit plaintext secrets to project files. Authentication should use a one-time key display and a supported secure local credential mechanism, or explicit runtime secret injection.

The CLI configures a client for the hosted verification service. It is not itself the verification engine and must not claim to validate identity data offline.
