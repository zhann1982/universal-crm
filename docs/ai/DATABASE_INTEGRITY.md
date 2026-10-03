# Database integrity rollout (D052)

Migration: `drizzle/0013_tenant_integrity.sql`. Application and migration must ship together.

## Before rollout

Run `npm run db:audit-integrity` against the intended database using its local environment configuration.
This reads counts in one snapshot; it never mutates rows/schema or prints personal records.
Exit 0 means all 12 checked invariants passed. Exit 1 means violations or an audit error.
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

On 2026-10-03 the connected database's read-only preflight passed. This task did not apply migrations
to that database; isolated verification must not be reported as a deployed schema update.
