# Database integrity rollout (D052)

Latest connected rollout (2026-10-04): user-authorized encrypted backup/isolated restore and
paused local writes preceded normal application of 0017/0018/0019. Journal verifies 20/20
hashes/timestamps; post-rollout 23-counter audit is clean. Local CRM restarted and Owner read-only
browser checks passed. Other environments must follow the procedure below independently.

Migration: `drizzle/0013_tenant_integrity.sql`. Application and migration must ship together.

## Before rollout

Run `npm run db:audit-integrity` against the intended database using its local environment configuration.
This reads counts in one snapshot; it never mutates rows/schema or prints personal records.
Exit 0 means all 23 checked invariants passed. Exit 1 means violations or an audit error.
If there are violations, inspect affected records securely and decide repairs explicitly. Do not run the
development seed or automatically reassign records to another Organization.

The audit is a preflight, not a lock: intervening writes may introduce violations. The migration
validates the actual committed rows and must fail if they are inconsistent.

## Coordinated release

1. Prepare a recoverable database backup/branch under the normal deployment process.
2. Pause CRM writes and old application instances that assign roles.
3. Run the audit again, then `npm run db:migrate` using the deployment environment.
4. Confirm migration 0013 is recorded in the Drizzle migration journal.
5. Activate the matching application, verify login, Organization selection, invitation acceptance,
   Team role changes and Deal edits, then resume writes.

Do not deploy this code against a schema without 0013: new assignment writers include `organization_id`.
Do not run old assignment writers after migration: they omit the now-required column.
Follow normal migration tooling so the backfill and constraints commit transactionally. Do not run
individual SQL statements manually outside that transaction or edit already-applied migrations.
Adding validated constraints can lock tables; schedule rollout for an appropriate maintenance window.

## Scope and verification

Constraints protect core Stage/Deal pipeline/tenant relationships, Client/Company links, core owner
references, Deal Company and Member/Role assignments. Stage type/probability and money have checks.
Deletion still nulls optional owner/company references without changing the record's Organization.
An unchanged inactive owner is allowed; application policy still rejects newly assigned inactive owners.

`npm test` includes the actual migration/journal, populated upgrade, invalid legacy rollback,
invalid direct writes and assignment workflow SQL against isolated PGlite PostgreSQL without secrets.
Live multi-session PostgreSQL and browser workflow checks remain separate. Task/Comment/Activity
and invitation reference constraints are outside this migration; default Pipeline uniqueness is deferred.

On 2026-10-03 the connected database's read-only preflight passed. A follow-up recovery applied
missing migrations 0012 and 0013 through drizzle-kit after Organization creation failed on the
absent `organization_creations` table. All 14 journal hashes matched local migrations, required
schema was verified and the post-migration audit passed. Browser creation still requires a retry;
other deployment environments have not been verified by this recovery.

## Task and history rollout (D059/D060)

0017_task_activity_integrity.sql and 0018_bounded_read_indexes.sql are tested in isolated
PostgreSQL but not applied to the connected database. The 23-counter read-only audit was clean
on 2026-10-04. Recheck immediately before rollout; generated constraints do not repair data.
Use the same backup, paused-writes and normal Drizzle transaction/journal procedure. Composite
referenced UNIQUE constraints intentionally precede FKs in 0017. Existing parent history prevents
hard deletion; archive/restore is unchanged. 0018 replaces history indexes with UUID tie breakers
and adds active-board/archived-Deal partial indexes. Index creation takes locks; plan maintenance.

## Custom-field rollout (D062)

0019_custom_fields.sql follows 0017/0018. It adds tenant definitions, parent JSONB values/custom
versions, Organization revision and configuration/value/history triggers. Existing records get
empty values; no required definitions are added automatically. Types/tenant/required/archived
values are validated when custom values change or a record is created. Legacy unrelated edits
remain possible. Config limit checks serialize under the Organization row lock.

On 2026-10-04 the read-only journal checker confirmed 17/20 matching applied hashes/timestamps
with 0017/0018/0019 pending. User selected isolated verification only: no migration was applied.
Follow RELEASE_CHECKLIST.md; old working schema cannot serve the updated custom-field pages.
The existing 23-counter audit covers 0017 prerequisites, not completeness of required values in
legacy records (missing newly required fields is intentionally allowed until an explicit save).
