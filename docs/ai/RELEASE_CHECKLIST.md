# Deployment package — 2026-10-04

Connected rollout completed with explicit user authorization: encrypted backup verified against
all 24 restored tables, local dev server paused, 0017–0019 applied through drizzle-kit, 20/20
matching migration hashes/timestamps and zero post-rollout audit violations. Local server was
restarted; authenticated Dashboard/settings/board read-only smoke checks pass. Backup and its
Windows CurrentUser DPAPI-protected AES key are under ignored `.local-backups/` on this computer.
No raw backup, key, connection credentials or auth records are committed. Keep these files private.

For another database/environment, follow the sequence below; do not activate code against the
old schema. Real mail configuration and broader role/session workflows still require validation.

## Before applying

1. Prepare a recoverable Neon backup/branch with the normal database deployment process.
2. Pause CRM writes and old app instances. Do not use the development seed.
3. Run the 23-invariant audit and read-only journal check against the intended database.
4. Stop if the audit finds violations or hashes differ. Repair only after deliberate review.
5. Apply checked-in migrations with the normal Drizzle runner, not individual SQL fragments.

PowerShell commands for this workstation (private `.env.local` selects the target database):

```powershell
node --env-file=.env.local --import tsx src/db/audit-integrity.ts
node --env-file=.env.local --import tsx src/db/check-migrations.ts
# Only after backup, paused writes and successful audit:
node node_modules/drizzle-kit/bin.cjs migrate
node --env-file=.env.local --import tsx src/db/check-migrations.ts
node --env-file=.env.local --import tsx src/db/audit-integrity.ts
```

Before migration, journal check exit 1 with pending files is expected. Hash mismatch or query
failure is a different error and must be reviewed. After migration expect 20/20 matching hashes
and zero audit violations. Transactional constraint validation must fail rather than repair data.
0017 adds tenant references; 0018 adds bounded-read indexes; 0019 adds custom fields/triggers.

## Enable and verify

Activate matching application code, then validate with controlled synthetic records/accounts:

- Owner/Admin: configure all five field types in each entity, rename/order/archive/restore;
  reject duplicate names, invalid types/options and stale configuration forms.
- Manager: edit allowed parent values, reject configuration without settings.manage.
- Read-only: view allowed values; reject direct mutation calls even if a button is forged.
- Separate Organizations: reject foreign parent/definition IDs and old rendered forms after switch.
- Two sessions: stale custom save/full Deal edit/Stage transition cannot overwrite a newer Deal;
  archived parent blocks value writes, archived field keeps its existing value.
- Configure the verified sender and Resend API key privately per EMAIL_DELIVERY.md. Verify
  controlled invitation, auth verification, reissue/revoke and actual recipient delivery.
- Verify browser board/history pagination and representative concurrent Neon throughput.

Resume writes after successful checks. Existing isolated tests are not production throughput or
full browser certification. Dedicated non-production real PostgreSQL integration CI remains open;
never add the working DATABASE_URL to CI or run existing integration scripts against working data.
