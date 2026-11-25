# Render Expiry Database Backup & Recovery Plan

**Date:** 2026-11-25  
**Purpose:** Protect TradeMate data before Render free Postgres expiry and keep an independently recoverable backup.

## AWS recovery point (verified)

- RDS instance: `trademate-db` (eu-north-1)
- Manual snapshot: `trademate-db-pre-render-expiry-20261125`
- Snapshot encryption: enabled (AWS KMS)
- Snapshot status: **available, 100% complete**
- Snapshot size: ~3.59 GB
- Automated RDS backup retention: **1 day**
- Attempt to set 7-day retention was rejected by AWS Free Tier restriction.

## GitHub backup safety

The TradeMate source repository is **public**. Never put database dumps, user data, credentials, secrets, raw CSV exports, or unencrypted database backups in it.

The backup target must be a separate private repository (recommended `Iamgetty/TradeMate-db-backups`). Backup payloads must be encrypted before upload. The previous workflow's 7-day Actions artifact upload was unsafe for a public repository, so it has been replaced with a workflow that pushes **only age-encrypted ciphertext** to the specified private repository and does not publish an Actions artifact.

## Secure backup workflow implemented

Workflow file: `.github/workflows/render-database-backup.yml`

- Manual `workflow_dispatch`; requires the confirmation input `BACKUP`.
- Runs on the existing self-hosted `aws-staging` runner.
- Uses `pg_dump` custom format and validates the plaintext archive with `pg_restore --list` before encryption.
- Encrypts with age using the public recipient key.
- Pushes ciphertext and checksum to the private backup repository using a scoped token.
- Removes the temporary plaintext dump and uploads no Actions artifact.
- It is **not run yet**; required private repo and secrets are not configured/verified.

## Required user-side setup (only remaining action for GitHub backup)

1. Create a new GitHub repository `TradeMate-db-backups` and make sure **Private** is selected.
2. On a trusted local machine, install age and generate a key: `age-keygen -o trademate-backup-age.key`. Keep the private key file offline and never upload it.
3. Add three Actions secrets in the **public TradeMate source repository**:
   - `RENDER_DATABASE_URL`: Render source DB connection string
   - `AGE_RECIPIENT`: public age recipient (starts `age1`)
   - `BACKUP_REPO_TOKEN`: fine-grained token scoped only to the private backup repo, Contents read/write
4. Open Actions → **Encrypted Render PostgreSQL backup to private GitHub repository** → Run workflow. Enter `BACKUP`, leave repository default `Iamgetty/TradeMate-db-backups`, and run.
5. Confirm the encrypted file and checksum exist in the private backup repo. Keep the private age key offline for restore.
6. Restore-test by decrypting and restoring into an isolated database; record table counts and migrations. A dump's listing check is not a full restore test.

## Recovery steps

1. Use the completed encrypted GitHub dump as a logical backup; decrypt with the offline age private key.
2. If needed, restore the AWS manual snapshot into a separate RDS instance (never overwrite the live DB during recovery).
3. Restore backup into an isolated verification database.
4. Compare table names, row counts, migration history, and critical app workflows.
5. Only after verification, plan a controlled cutover.

## Migration status / caveats

- Render free PostgreSQL expiry: **2026-11-25 21:52:06 UTC**.
- AWS snapshot is available and encrypted, but it captures AWS target data, not a fresh Render source backup.
- RDS automated retention remains 1 day due to the AWS Free Tier restriction.
- Encrypted GitHub source backup workflow is committed but has not been run because the private repo and required secrets are not yet available to this session.
- Render web/API/feed services still show live in the Render workspace; AWS/Cloudflare alternatives are health-checked, but final legacy Render service retirement is not yet confirmed.
- Root and www custom domains are currently attached to the staging Worker. Production promotion is intentionally gated and has not been performed.
- MT5 ingestion remains blocked by missing token/configuration; feed health currently reports 0 MT5 quotes and no public redistribution permission.
- FX is not configured on the feed.
