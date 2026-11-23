# Cloudflare Workers staging frontend

The canonical web application remains the Next.js app in this directory. The existing Node/Render build (`npm run build`) is unchanged. Cloudflare support is an additional vinext build.

## Cloudflare Workers Build settings

- Repository: `Iamgetty/TradeMate`
- Production branch: `main`
- Root directory: `TradeMate-main/apps/web`
- Build command: `bash scripts/cloudflare-build.sh`
- Deploy command: `bash scripts/cloudflare-deploy.sh`
- Worker name: `trademate`

The build script pins vinext to 1.4.0 and uses the same Cloudflare adapter initialization flags as the repository's isolated Cloudflare CI validation. It generates adapter files in the Cloudflare build checkout; it does not commit generated files or alter the canonical Next.js configuration.

## Required Cloudflare build secrets

Configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as encrypted build secrets/variables in Cloudflare. Scope the token to the intended account and Worker deployment only. Never put either value in Git, the build command, or application source.

The initial Worker deployment is staging-only. Keep Render and production DNS unchanged until the deployed frontend, API proxy, authentication cookies, Identity Pass, and browser acceptance checks have been verified.

## API origin

The frontend API proxy must use the AWS staging API origin through the server-side `TRADEMATE_API_ORIGIN` environment variable. Do not expose API credentials or database connection strings to browser code. Set the actual staging API origin as a Worker secret/variable only after confirming the API's publicly reachable HTTPS endpoint and expected path prefix.

## Validation boundary

The existing CI validates a disposable vinext/Workers build and local runtime. That is not a substitute for a real deployment and browser verification in the Cloudflare account. Treat the first deployment as staging validation, not a production cutover.
