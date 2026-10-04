# Universal CRM — Current Status

## Five-point stabilization implementation — 2026-10-04

D058–D061 implement permission-safe Deal details; rendered-version lifecycle mutations;
Task/Schedule/Comment/Activity tenant constraints (0017); bounded board/archive/history and
searchable references with indexes (0018); invitation administration and optional email transport.
Full-edit drafts capture their initial version even if refreshed props change. Existing owners and
selected relationships remain usable outside the first 50 reference options. Board counts/sums
cover the complete filtered set and keep currencies separate. History cursors retain microseconds;
comment bodies are fetched only with comments.read and for visible event references.

Verification: 206/206 local tests passed, including actual PostgreSQL constraint/direct-write,
Deal lifecycle conflict/history rollback, related-name/Team Role query permission combinations, 4000 Deal
keyset traversal, 700 history events with timestamp ties, bounded reference search, invitation
token rotation/stale/revoked/accepted checks and mocked email transport. Tests are serial to avoid
PGlite worker memory exhaustion. TypeScript, ESLint and the final production build passed. Drizzle generation reports no schema
differences after migration snapshot/index verification.

Connected read-only audit: all 23 counters zero. Migrations 0017/0018 are NOT applied to the
connected Neon database; schedule coordinated rollout with writes paused. Real email is NOT
configured or verified. Resend API acceptance is reported separately from recipient delivery.
Browser Owner checks passed: create Deal, manual Stage transition versus a stale full-edit draft
(conflict with draft preserved), switch Development CRM ↔ Secondary Corp, stale reference search
(no foreign record access) and stale form submission (explicit scope-change rejection). These are
normal UI operations, not the unsafe working-database integration scripts. Invitation sending remains mocked.
Synthetic fixture: Deal 1226473b-6368-4b2d-83b5-d94b5b3fed8c, «Проверка стабилизации 04.10.2026»,
in Development CRM. Its native archive confirmation is pending in the handoff browser tab:
the browser API could not accept, dismiss or close the tab (focus-emulation timeout). No browser
archive success is claimed. SQL lifecycle/rollback tests passed. Original Organization selection was restored.

This does not certify production throughput or every role/session race. Existing test:integration
scripts require a dedicated non-production PostgreSQL environment and were not run against working data.


## CRM mutation notifications — 2026-10-04

D057 adds a shared tenant-scoped toast provider without a package or schema change.
Client/Company/Deal create, edit and lifecycle, manual Stage changes and Kanban, Task
create/edit/state/bulk/reminders, comments, Team invitations/status/roles, Pipeline/Stage
configuration, saved views and Organization creation have feedback. Success waits for
server confirmation; Client/Company lifecycle now checks RETURNING to reject zero rows.
Comment lifecycle returns an explicit success/failure state with the original authorization
and atomic persistence preserved. Generic unexpected errors show safe connection feedback.
Field validation stays inline; existing conflict explanations remain visible. Success expires
after four seconds (paused on hover/focus); errors/warnings can be closed manually.
The provider resets with Organization scope. Redirect messages use a fixed allowlist, and
success query parameters are consumed via router.replace to prevent action refresh replay.

Verification: 183/183 tests pass, including six feedback regressions. TypeScript, ESLint
and production build pass. Browser checks used the existing Owner session: saved-view
creation, duplicate-name and invalid-name errors, archival, manual dismissal, success
auto-dismiss, success redirect URL cleanup and no replay after another action/reload.
The smoke-test view “Проверка уведомлений 04.10.2026” remains archived in Development CRM.
Redirect smoke tests injected allowlisted feedback parameters without changing business records.
All other entity mutation paths are connected and covered by existing domain regressions;
a full multi-role browser mutation suite is still outstanding. No real-data integration tests ran.


## Client / Company / Deal history — 2026-10-03

Detail cards now include the shared EntityTimeline with existing Activity/Comment permissions.
Creation, actual allowlisted field changes, archive/restore and both Deal Stage interfaces
record actor, time and a safe field/action label. A technical timestamp/version-only update,
an unmatched conditional update and a same-stage transition do not create history events.
No backfill or copied old/new values; existing records begin accumulating history from now.
Client ↔ Company link events and pagination beyond the latest 50 remain open.

D056 uses AsyncLocalStorage only for a server-derived actor around one awaited business
statement. The Neon adapter submits transaction-local settings and the original Drizzle
statement together; PostgreSQL AFTER triggers compare actual OLD/NEW and insert Activity.
An event insertion error rolls back the record mutation. Existing Deal version, lifecycle,
Stage semantics, permission checks and Task/Comment atomic operations are preserved.
Triggers reject mismatched actor/Organization and inactive Membership/Organization. Seeds
and direct maintenance writes without context intentionally produce no invented history.
This is application history, not a complete database audit or old-value ledger.

Verification: 177/177 normal tests, TypeScript, ESLint and production build pass. New PGlite
tests execute the production adapter, trigger migration and shared Deal transition, covering
RETURNING mappings, no-op/stale writes, lifecycle, tenant/access denial, transaction-local
context, async actor isolation, history failure rollback and restricted timeline reads.
All 17 migration journal hashes match the connected database; migration 0016 is applied and
all three Activity triggers are enabled. Read-only browser checks with the existing Owner
session verified the shared history block on Client, Company and Deal cards. Business record
mutations were tested in isolated PGlite, not against the connected application's records;
full multi-role/multi-session browser mutation workflows remain open.

## Navigation feedback — 2026-10-03

All application Next.js links use `src/components/app-link.tsx`, which forwards Link props
and displays a top progress bar from the real `useLinkStatus` pending state. The indicator
uses a body portal to avoid clipping by cards; no document click interception, timers or
navigation completion guesses are used. Cached instant navigation does not force a delay.
Root/CRM loading boundaries show an accessible spinner and loading text while streaming.
Reduced-motion preferences disable animation. Page authorization/data operations are unchanged.

CRM sidebar links use pathname matching and `aria-current="page"`: Dashboard is exact,
other sections include nested routes with a slash boundary. Active styling includes accent
border, background, icon color and font weight. Permission-driven sidebar visibility stays server-side.

Verification: TypeScript, ESLint and production build pass. Browser checks verified pending
feedback on sidebar and Deal-detail links, cleanup on completion, active Deals/Tasks, and
section preservation on `/crm/tasks/new` and a Deal detail. No new schema or database writes.
The existing 167-test business baseline was not rerun for this presentation-only change.

## Personal saved views — 2026-10-03

D055 adds "Мои представления" to Client/Company lists and the Deal board. Users can name
and save applied filters, open them by a link, archive and restore their personal views.
Views are scoped to current Organization + Membership + entity; underlying read permissions
and rendered mutation scope are enforced server-side. No shared views, editing/renaming,
default selection or saved column/sort settings are implemented yet.

Deal filters now include title, all/mine/unassigned ownership, open/won/lost state and
close-date (all/overdue/next seven days/none). Client/Company filters keep their existing
search/status/active-archive semantics. Page numbers are not saved. Archived or unavailable
Pipeline links are disabled. Filters never store arbitrary URLs, tenant IDs or query expressions.

Migration 0015 adds versioned personal saved_views, tenant Membership FK, validation checks,
active-name uniqueness and lookup index. Production SQL serializes the 50-active-view limit
and lifecycle with advisory locking. Reads bound active/history lists separately to 50 each.
The Deal board now avoids querying hidden Company/Member names in SQL.

Verification: 167 tests passed, TypeScript, ESLint and production build passed. Nine added
isolated PostgreSQL tests cover production persistence SQL, identity/tenant/version boundaries,
duplicate/limit rollback, canonical filters, Deal predicates and related-data query visibility.
Migration 0015 was applied to connected Neon; all 16 migration hashes match, and there are
zero saved-view Membership tenant mismatches. No seed or business record edits were performed.

Browser checks under the existing verified Owner session confirmed Pipeline list/detail rendering,
Organization switching between Development CRM and Secondary Corp, and stale Pipeline form
rejection with context-changed feedback. Original Organization selection was restored.
The Deal filter reduced four records to one; saving "Мои открытые сделки" and reopening its
link restored the matching filters/result. Archive and restore of this view also passed through
the browser UI. This useful personal preference remains in the Owner's Development CRM account.
Full multi-role E2E, onboarding retries, Deal conflict browser tests,
real multi-session configuration/limit races and scale checks remain open.

## Pipeline management — 2026-10-03

Following the user's product priority, D054 adds `/crm/pipelines` and tenant-scoped detail
pages. Configuration viewing uses `pipelines.read`; creation, metadata, default selection,
archive/restore and Stage editing/creation use `pipelines.manage` and rendered tenant scope.
Stage fields are name, type, probability, unique numeric position and optional hex color.
Shared defaults create six stages. Existing Deal/Stage identities and history are preserved.

The domain operation serializes configuration and checks Pipeline versions. It rejects
stale forms, duplicate names/positions, foreign Stage IDs, used Stage type changes,
removal of the last open Stage, and archive of default/last active/actively used Pipelines.
Migration 0014 adds versions and a Deal parent-lock/lifecycle guard, with conflict feedback
for stale Stage transitions and restoration into archived Pipelines.

Verification: 158 tests pass; TypeScript, ESLint and production build pass.
Ten added isolated PostgreSQL/unit checks execute configuration SQL, rollback, tenant/version
guards, lifecycle and valid/stale Deal semantics. Migration 0014 was applied to the connected
Neon database after a read-only preflight found zero inconsistent Deal Stage states.
No development seed or business-data repair was run. Other databases require their own migration.
Authenticated browser/manual workflows and real multi-session Neon concurrency remain unverified.
Stage archive/deletion, automatic order swapping and database-wide default uniqueness remain open.

Next: browser Pipeline/Organization workflows and stale forms, remaining authorization/Deal
conflict coverage, then saved views. Do not recreate Pipeline management.

## Comment persistence stabilization — 2026-10-03

D053 closes the earlier create/edit parent lifecycle pre-check gap. `save-comment.ts` locks an
active, non-deleted parent in the same Organization before creating/editing the comment and
its Activity event in one SQL statement. Editing revalidates comment parent/type, version,
active lifecycle and author or server-derived manage permission. Empty results are not success.
Archive/restore share `comment-target.ts` for the same parent predicates/locking.
Server Actions retain mutation-scope, module read, comment permission and ownership checks.

Verification: 148 tests passed, TypeScript, ESLint and production build passed. Thirty added
PGlite PostgreSQL tests execute production comment SQL for Client, Company, Deal and Task,
including foreign tenant/parent, stale version, non-author/manage policy, archive/deletion,
successful restore and fault-injected rollback of create/edit/archive when event insertion fails.
These tests do not claim real multi-session concurrency or browser coverage.
No schema migration or changes to connected database records were required.

Next: browser Organization onboarding/multi-tab scope, related-data visibility regression coverage,
Deal conflict verification, F12 scaling and structured/paginated history. Do not recreate comment persistence.

## Connected database migration recovery — 2026-10-03

The user reported Organization creation failing with `42P01`: `organization_creations` was absent.
Read-only inspection confirmed the connected database migration journal stopped at 0011.
After a clean integrity preflight, `drizzle-kit migrate` applied 0012 and 0013 successfully.
Post-migration verification confirmed all 14 journal entries/hashes match checked-in migrations,
the Organization creation table exists, assignment scope is NOT NULL, role assignments are consistent
and all 12 integrity audit counts are zero. No development seed or data repair was run.
This verifies the connected database schema; browser Organization creation still needs user retry.
Other deployment databases must be inspected/migrated separately.

## Core database integrity update — 2026-10-03

Decision D052 / migration `0013_tenant_integrity.sql`:
- Composite foreign keys protect Stage Organization/Pipeline, Deal Organization/Pipeline/Stage,
  Client/Company relationships, core owner references, Deal Company and Member/Role assignments.
- Stage type and probability, Deal non-negative finite amount and currency consistency have CHECK constraints.
- Role assignments carry required Organization identity. Provisioning, invitation acceptance,
  Owner-guard writes and development helpers supply the server-derived scope.
- Existing nullable-reference deletion and inactive-owner semantics are preserved.
- A read-only audit command reports counts for 12 invariants; the connected database had zero
  violations on 2026-10-03. No connected database rows or schema were modified.
- The new migration backfills existing assignments from Membership, adds referenced UNIQUE keys
  before foreign keys, and fails transactionally on inconsistent legacy data.

Verification: 118 tests pass (23 new PostgreSQL migration/constraint/assignment tests), TypeScript,
ESLint and production build pass. New tests use isolated PGlite PostgreSQL and actual production
assignment SQL, including invitation rollback and last-Owner protection. The Drizzle migrator
installs the entire journal and can replay safely. Generated schema has no further migration drift.
These checks do not claim browser or live multi-session Neon concurrency coverage.
The normal test runner limits file concurrency to two to bound PGlite memory use;
an unrestricted run alongside the production build exhausted Node memory on this Windows host.

Deployment: the initial implementation did not apply migration 0013; the recovery update above
confirms 0012/0013 are now applied to the connected database.
Audit and apply migrations with CRM writes paused, then activate matching application code;
old assignment writers omit the new required column. See `docs/ai/DATABASE_INTEGRITY.md`.

Remaining: browser tenant/onboarding verification, related-data regression coverage, Deal conflicts,
Task/Comment/Activity relationship constraints, F12 scaling and dedicated PostgreSQL CI.

## Presentation update — 2026-10-03

CRM now uses reference-inspired styling: charcoal navigation with decorative SVG icons,
compact white header, flat colored dashboard metrics, compact panels, tables and form controls.
The stylesheet is scoped to `.crm-shell`; CRM pages retain their existing data, destinations,
permission gates and mutation forms. Only CSS and presentation markup changed. Mobile navigation
uses a horizontally scrollable row; dashboard metrics use two columns on narrow screens.

Verification: 95 tests passed; TypeScript, ESLint and production build passed.
Build used placeholder database/auth configuration. Authenticated browser visual comparison
and mobile workflow verification have not been performed; exact pixel parity is not claimed.

Last updated: 2026-10-03

## Current development update — 2026-09-30

Baseline: main includes Organization selection and mutation scope checks (`d0cdbce`).

Organization selection:
- `/organizations` lists only the verified user's active memberships in active Organizations.
- `/crm` uses a validated HttpOnly cookie preference; there is no fixed development-tenant fallback.
- With no preference and exactly one accessible Organization, entry is automatic.
- Multiple memberships require selection. Invalid/revoked selections go to the chooser without silently choosing another tenant.
- CRM sidebar displays the selected Organization and links to the chooser.
- Every CRM mutation uses `requireMutationPermission` with the organization rendered in its form/tab.
- OrganizationForm covers forms; direct archive/restore buttons and Kanban pass the same scope explicitly.
- Old forms after a tenant switch are rejected before writes. The client scope is compared against the server-authorized context; it never grants access.
- Invitation acceptance opens the chooser; it does not leave the user in an unrelated previously selected tenant.

Organization provisioning (D051):
- `/organizations/new` is available to verified users, including those with no Membership yet.
- Creation atomically adds Organization, Owner/Admin/Manager/Viewer roles, permission bindings,
  creator Membership/Owner assignment, default Pipeline and six Stages.
- The creator identity is read from the verified auth User; browser identity/role fields are not used.
- Durable per-user request keys and a separate transaction lock make retries idempotent.
- Replay does not restore revoked access or reassign Owner after a role change.
- The form retains its name/request key after recoverable errors; successful creation opens CRM.
- Shared permission/role/stage defaults serve onboarding and the development seed.
- Migration `0012_long_cammi.sql` is required (`npm run db:migrate`). It was verified in isolated PGlite;
  it was applied to the connected database during the 2026-10-03 recovery described above.

Verification: 95 tests passed, including isolated PGlite onboarding, rollback, identity and retry tests.
TypeScript, ESLint and production build passed. The build used dummy configuration and did not
connect to the working database. Existing organization-selection tests remain in the normal suite.
Browser onboarding/multi-tab workflows and live multi-session Neon tests remain outstanding.

Next: browser cross-tenant/onboarding workflows, stronger database constraints, structured history
and pagination. Organization provisioning exists; do not recreate it or use the development seed
as a production onboarding mechanism.

The later historical verification sections describe the earlier stabilization baseline.

---

## Source-of-truth note

This file describes the current locally verified development state.

GitHub `main` may temporarily lag local changes until the latest stabilization work is pushed.

The application is not yet production-ready.

---

# Current phase

CRM Core / early v0.2

Current phase:

STABILIZATION BEFORE MORE LARGE FEATURES

The modular-monolith architecture remains appropriate.

---

# Historical stabilization verification

Earlier stabilization verification (current results are in the dated updates above):

- `npm test` — 37 tests passed
- `npm run test:integration` — 23 tests passed
- `npx tsc --noEmit --incremental false` — passed
- `npm run lint` — passed
- `npm run build` — passed

Current automated coverage includes:

- exact canonical email identity
- invitation token and safe redirect behavior
- Owner concurrency
- invitation concurrency
- tenant access lifecycle
- Client ↔ Company lifecycle
- cross-tenant boundaries
- responsible-Member permission policy
- responsible-Member active/inactive Membership semantics

GitHub Actions CI is implemented.

Current CI workflow:

`.github/workflows/ci.yml`

Runs on:

- push to `main`
- pull requests targeting `main`

Current CI checks:

- `npm ci`
- `npx next typegen`
- `npx tsc --noEmit --incremental false`
- `npm run lint`
- `npm test`

The latest pushed CI baseline is passing.

Database integration tests are intentionally not included yet because they require a dedicated non-production PostgreSQL test environment.

---

# Authentication / identity

Implemented:

- Better Auth
- registration
- login
- logout
- session cookies
- server-side session resolution
- email verification
- verification page
- resend verification
- exact canonical email identity lookup

Current CRM gate:

authenticated User
+ verified email
+ active Organization
+ active Membership
+ Permission
→ business access

F01:

FIXED

F02:

FIXED FOR CORE AUTHORIZATION / TRANSACTION FLOW

Implemented:

- dedicated Organization invitation records
- canonical intended email
- cryptographically random opaque token
- SHA-256 token-hash storage
- invitation expiration
- accepted / revoked lifecycle fields
- inviter identity
- one Role per invitation for the current Team UX
- no Membership before invitation acceptance
- authenticated Better Auth acceptance
- verified-email requirement
- exact canonical identity match
- Organization activity revalidation
- Role tenant revalidation during acceptance
- duplicate Membership prevention
- one-time acceptance
- concurrency-safe invitation creation
- concurrency-safe invitation acceptance
- safe same-origin continuation through login/register/email verification
- `/invite` acceptance page

Creation and acceptance share the canonical-email PostgreSQL advisory-lock namespace.

Acceptance also protects reuse of the same token.

Current development limitation:

- production email delivery is not configured
- invitation token/link is currently transferred manually during development
- invitation administration UX for listing/revoking/resending can be improved later

These are operational/product follow-ups, not the original F02 authorization flaw.

Decision:

D047

---

# Organization / RBAC

Implemented:

- Organization membership
- active/inactive Member state
- multiple Roles per Member
- Permissions
- Team listing
- role assignment/update
- Member activation/deactivation
- self-role protection
- self-deactivation protection
- inactive Organization access denial
- stable system Role identity through nullable `roles.systemKey`
- `Owner` machine identity through `systemKey = "owner"`
- concurrency-safe last-Owner protection for role removal
- concurrency-safe last-Owner protection for Member deactivation
- organization-scoped PostgreSQL transaction advisory lock for Owner-reducing mutations

System Role display names are not used as machine security identity.

F07:

FIXED AND INTEGRATION-TESTED FOR CURRENT DEVELOPMENT TENANT MODEL

PostgreSQL coverage verifies:

- inactive Organization is rejected
- inactive Membership is rejected
- active Membership remains allowed

Organization selection now uses verified-session membership and a revalidated cookie preference (D050).

F06:

FIXED AT CURRENT APPLICATION / POSTGRESQL TRANSACTION LEVEL

Owner-reducing Team mutations use:

transaction
→ organization-scoped advisory lock
→ re-read current committed Owner state
→ validate last-Owner invariant
→ mutate

Concurrent destructive Owner requests are serialized and integration-tested.

---

# Companies

Implemented:

- create
- list
- detail
- edit
- archive
- restore
- search
- filters
- pagination
- responsible Member
- linked Clients
- tenant scoping
- RBAC

Responsible Member rules:

- existing owner may remain unchanged even if inactive
- newly assigned owner must be active
- newly assigned owner must belong to the same Organization
- without `members.read`, assignment is limited to self or no owner
- Member email is not included in normal assignment DTOs
- hidden foreign Member names use neutral `Сотрудник`

Shared resolver:

`src/modules/members/owner-assignment.ts`

F08:

FIXED AND POSTGRESQL REGRESSION-TESTED

Verified:

- unchanged inactive owner remains allowed
- new inactive owner is rejected
- inactive owner is rejected during create
- active same-Organization owner is allowed
- active owner from another Organization is rejected
- owner can be cleared even when previous owner is inactive

---

# Client ↔ Company

Implemented:

- many-to-many link
- unlink
- reverse display
- tenant validation
- archived Client lifecycle guard
- cross-tenant denial

Shared mutation module:

`src/modules/clients/client-company-relation.ts`

F11:

FIXED AND INTEGRATION-TESTED

PostgreSQL coverage verifies:

- archived Client cannot create a new Company relationship
- archived Client cannot remove an existing Company relationship
- active Client may remove an existing relationship to an archived Company
- cross-tenant Client/Company relations are rejected

---

# Pipelines / Stages

Implemented in database:

- Pipelines
- ordered Stages
- Stage type
- Stage probability
- Stage color

Implemented in Deal UI:

- Pipeline selection
- Stage selection
- Kanban

Not implemented:

- Pipeline management UI
- Stage management UI

Core Stage/Deal tenant relationship constraints are implemented in migration 0013.
They are applied to the connected database; other deployment environments require separate verification.

---

# Deals

Implemented:

- create
- detail
- edit
- Pipeline change
- Stage change
- Company assignment
- responsible Member assignment
- expected close date
- archive / restore
- archive view
- Kanban
- drag-and-drop
- manual Stage selector
- closedAt rules
- currency-separated totals
- tenant scoping
- RBAC

Shared Stage transition:

`src/modules/deals/transition-deal.ts`

Shared responsible-Member validation:

`src/modules/members/owner-assignment.ts`

F04:

FIXED AT APPLICATION LEVEL

Database-level composite invariant is implemented and isolated-PostgreSQL-tested in migration 0013.
The migration is applied to the connected database; browser conflict verification remains separate.

F10:

FIXED AT CURRENT APPLICATION LEVEL

Optimistic locking uses Deal `version`.

More PostgreSQL/browser verification of stale Deal conflict paths remains a priority.

---

# Deal expectedCloseAt

Current meaning:

date-only calendar value

Storage:

PostgreSQL `date`

Application:

`YYYY-MM-DD`

Implemented:

- strict ISO calendar validation
- leap-year handling
- impossible dates rejected
- empty value becomes null
- display avoids JavaScript Date timezone conversion

F09:

FIXED

Decision:

D044

---

# Related-data permission policy

Responsible Member assignment:

with `members.read`
→ any active Organization Member

without `members.read`
→ self or no owner

Existing owner may remain unchanged even if inactive.

Permission-only logic:

`src/modules/members/owner-assignment-policy.ts`

Tenant + active-Membership resolution:

`src/modules/members/owner-assignment.ts`

Both Company and Deal use the shared resolver.

Member email is excluded from normal owner-selection DTOs.

Related entity visibility:

- Company data in Deal views requires `companies.read`
- linked Client data in Company views requires `clients.read`
- Dashboard aggregates require corresponding module `.read`

F05:

FIXED FOR ASSIGNMENT RULES / PARTIALLY AUTOMATED FOR RELATED-DATA VISIBILITY

Automated coverage now includes both permission-level owner assignment behavior and PostgreSQL active/inactive tenant Membership validation.

More automated related-data visibility coverage is still needed.

Decision:

D045

---

# Health

Public route:

`/api/health/db`

Behavior:

- lightweight `SELECT 1`
- no CRM counters
- generic success/failure
- no raw DB error to anonymous client
- no-store

F03:

FIXED

---

# Testing

Current unit/regression result:

37 / 37 passing.

Coverage includes:

- canonical email lookup
- `_` and `%` literal email identity
- strict Deal calendar dates
- Deal Stage page-version conflicts
- safe same-origin `next`
- invitation token generation/hashing
- responsible Member assignment policy

Current PostgreSQL integration result:

23 / 23 passing.

Coverage includes:

- concurrent Owner-role removal
- concurrent Owner deactivation
- last active Owner invariant
- same-token invitation acceptance concurrency
- separate invitations for same identity
- invitation identity mismatch
- concurrent invitation creation
- expired invitation replacement
- inactive Organization denial
- inactive Membership denial
- archived Client link rejection
- archived Client unlink rejection
- active Client unlink from archived Company
- cross-tenant Client/Company link denial
- cross-tenant relation unlink denial
- cross-tenant invitation inviter denial
- cross-tenant invitation Role denial
- unchanged inactive responsible Member allowed
- new inactive responsible Member rejected
- inactive responsible Member rejected during create
- active same-Organization responsible Member allowed
- foreign-Organization responsible Member rejected
- owner clearing with inactive previous owner

Still needed:

- related-data visibility tests
- Deal conflict PostgreSQL/browser tests
- stronger PostgreSQL invariant tests
- E2E critical workflow suite
- representative scale tests for F12

---

# CI

Implemented for non-database checks.

Current GitHub Actions status for the latest pushed baseline:

PASSING

Current CI:

`npm ci`
→ `next typegen`
→ `npx tsc --noEmit --incremental false`
→ `npm run lint`
→ `npm test`

Database integration tests remain local until a dedicated CI PostgreSQL strategy exists.

Never run destructive integration tests against production data.

---

# Audit stabilization summary

F01 — FIXED

F02 — FIXED FOR CORE AUTHORIZATION / TRANSACTION FLOW

F03 — FIXED

F04 — FIXED AT APPLICATION LEVEL

F05 — FIXED FOR ASSIGNMENT RULES / PARTIALLY AUTOMATED FOR RELATED-DATA VISIBILITY

F06 — FIXED AT CURRENT APPLICATION / POSTGRESQL TRANSACTION LEVEL

F07 — FIXED AND INTEGRATION-TESTED FOR CURRENT DEVELOPMENT TENANT MODEL

F08 — FIXED AND POSTGRESQL REGRESSION-TESTED

F09 — FIXED

F10 — FIXED AT CURRENT APPLICATION LEVEL

F11 — FIXED AND INTEGRATION-TESTED

F12 — OPEN

---

# Major features not yet implemented

- Client / Company / Deal Activity browser/role verification and pagination (D056 implemented)
- Pipeline/Stage management UI
- direct Deal contacts
- Custom Fields
- Saved Views
- Automation
- AI

---

# Current recommended direction

Do not start another large module yet.

Priority:

1. related-data visibility regression tests
2. Deal conflict PostgreSQL/browser verification
3. stronger PostgreSQL invariants
4. F12 scaling
5. dedicated CI database strategy
6. production invitation email delivery and invitation administration UX

After sufficient stabilization:

Task/Activity reliability
→ Organization onboarding and browser tenant workflow verification
→ Verify existing Activity for Client / Company / Deal (D056)
→ Pipeline management
→ direct Deal contacts
