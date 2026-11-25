# Render Expiry Database Backup & Recovery Plan

**Date:** 2026-11-25  
**Purpose:** Protect TradeMate data before Render free Postgres expiry and keep an independently recoverable backup.

## Immediate AWS recovery point

- RDS instance: `trademate-db` (eu-north-1)
- Manual snapshot requested: `trademate-db-pre-render-expiry-20261125`
- Snapshot encryption: enabled
- Snapshot status at creation: `creating` (must be verified as `available` before relying on it)
- Automated RDS backup retention currently: 1 day
- Attempt to set 7-day retention was rejected by AWS Free Tier restriction.

## GitHub backup safety

The TradeMate source repository is **public**. Never put database dumps, user data, credentials, secrets, raw CSV exports, or unencrypted database backups in this repository, its Issues, or CI logs.

GitHub backup target must be a **separate private repository** (recommended: `Iamgetty/TradeMate-db-backups`) and backup payloads must be encrypted before upload. The public source repo may contain only backup code, runbooks, non-secret metadata, and an encryption recipient public key.

## Required setup before automated GitHub database backup

- [ ] Create the separate GitHub repository and set it to **Private**.
- [ ] Generate an age encryption key pair locally. Store the **recipient/public key** as repository secret `AGE_RECIPIENT`; retain the private key offline, not in GitHub.
- [ ] Add source database connection string as GitHub Actions secret `RENDER_DATABASE_URL` (or AWS destination secret for RDS backup), never as repository text.
- [ ] Add a narrowly scoped GitHub credential as `BACKUP_REPO_TOKEN` with write access only to the private backup repo.
- [ ] Configure a backup workflow to dump PostgreSQL using `pg_dump`, encrypt the dump with age using the public recipient, and commit/push only encrypted dump files to the private backup repository.
- [ ] Keep encrypted backups rotated; retain at least 7 daily and 4 weekly copies. Confirm repository storage limits before enabling schedule.
- [ ] Test restore from an encrypted GitHub backup into an isolated database and record table counts/migration status.

## Recovery steps

1. Verify the RDS manual snapshot shows `available`.
2. If needed, restore the snapshot to a separate RDS instance (never overwrite the live DB during recovery).
3. Decrypt a private GitHub backup using the offline age private key.
4. Restore into a separate verification database.
5. Compare table names, row counts, migration state, and critical application workflows.
6. Only after verification, plan a controlled cutover.

## Current caveats

- Snapshot is still `creating` until a follow-up check confirms completion.
- RDS automated retention remains 1 day because AWS Free Tier limits it.
- GitHub encrypted database backup is **not yet uploaded or automated**: the repository is public and a separate private backup repo plus encryption secrets are required.
- Render source expiry timestamp currently reported by Render: 2026-11-25 21:52:06 UTC. Confirm timezone and exact suspension behavior in the Render dashboard before relying on the deadline.
