# Universal CRM — Next Development Steps

Last updated: 2026-10-04

## Latest custom-field package — 2026-10-04

D062 implements Client/Company/Deal custom fields. Do not rebuild this module. Read
CUSTOM_FIELDS.md for scope and RELEASE_CHECKLIST.md for rollout. User explicitly selected
isolated verification; connected Neon still has 17/20 migrations, pending 0017/0018/0019.
No backup/write pause or mail provider is configured. Apply the package only after preparing
those deployment conditions, then perform multi-role/browser and invitation delivery checks.
Next product extensions: permission-safe typed custom-field filters/saved views, then CSV
import with preview, validation and deliberate duplicate handling. Select-option evolution and
full core/custom combined editing require explicit semantics. Analytics/automation/AI remain later.

## Latest stabilization update — 2026-10-04

Five-point implementation exists (D058–D061); do not recreate these modules. Roll out 0017/0018
with a backup/branch and paused writes after the 23-invariant audit. Configure mail and verify
a controlled invitation + email verification delivery before calling onboarding production-ready.
See EMAIL_DELIVERY.md. Isolated tests cover permission queries, PostgreSQL references/conflicts
and bounded 4000-Deal/700-event reads. Broader multi-role browser/session coverage and measured
Neon throughput remain deployment validation; dedicated non-production PostgreSQL CI remains open.
Do not point existing integration suites at the connected working database.

## Previous notifications update — 2026-10-04

CRM mutation toast feedback is implemented (D057). Reuse the shared notification hooks
and redirectWithNotice for new actions; never infer success from an unconfirmed/zero-row
mutation. Owner saved-view/browser feedback smoke checks pass; extend multi-role/browser
verification to existing Client/Company/Deal/Task/Comment/Team/configuration operations.

## Previous update — 2026-10-03

Client/Company/Deal Activity rollout is implemented (D056 / migration 0016).
Do not recreate the timeline or event persistence. Next: verify real multi-session/browser
mutations for all roles, add cursor pagination beyond the latest 50 events, and decide
permission-safe structured old/new values only when needed. Client ↔ Company relationship
events remain a separate follow-up. Continue stabilization before custom fields/automation/AI.

Navigation loading feedback and active CRM sidebar sections are implemented and browser-checked.
Use the shared AppLink for new navigation links so pending feedback remains consistent.

Personal saved views for Client/Company lists and the Deal board are implemented (D055).
Do not recreate them. Next: sharing/default/editing semantics only with a concrete product need;
archive pagination beyond the latest 50, broader multi-role browser checks and scale coverage.
Client/Company/Deal Activity exists; custom fields follow stabilization.

Pipeline management is implemented at `/crm/pipelines` (D054), following the user's product
priority. Migration 0014 is applied to the connected database; configuration and Deal guard
SQL are covered by isolated PostgreSQL tests. Next verify authorized/read-only browser flows,
stale forms and real multi-session configuration/Deal races. Do not rebuild the module.
Stage archive/deletion, automatic order swapping and global default uniqueness remain open.
Saved views exist; remaining stabilization/browser verification work still applies.

Core database tenant integrity is implemented (D052 / migration 0013). Do not recreate these
constraints or role-assignment scope. The connected database audit found no violations; the
migration was verified in isolated PostgreSQL and applied to the connected Neon database on 2026-10-03
with missing migration 0012 after an Organization creation error. Other environments need separate verification.
Use `DATABASE_INTEGRITY.md` for the coordinated audit/migration/application release.

Continue with browser onboarding and multi-tab tenant checks, related-data visibility regressions,
Deal conflict coverage. Comment create/edit lifecycle protection is implemented (D053); verify
real multi-session/browser behavior rather than recreating the persistence operation. Task/Comment/Activity database
references still need tenant constraints. F12 scaling and dedicated PostgreSQL CI remain open.
Activity rollout and Pipeline management exist. Do not begin AI integration yet.

## Immediate development sequence — 2026-09-30

Tasks and Task Activity Stage 2 are already published in `9569de6`; do not recreate them.
User priority: multiple independent companies.

1. Verify Activity access/archived-parent hardening against an isolated PostgreSQL database and browser workflows.
2. Task + Schedule + Activity atomic writes and recurrence are implemented; follow up with multi-session Neon concurrency and browser verification. Do not recreate the persistence layer.
3. Organization selection/scope (D050) and self-service provisioning (D051) are implemented. Next verify onboarding, retries, tenant switches and stale forms in the browser; add live multi-session Neon creation/retry tests.
4. Verify core database constraints (0013) in other deployment environments; extend tenant constraints to Task/Comment/Activity and introduce dedicated integration CI.
5. Verify existing Client / Company / Deal Activity (D056): live browser/role checks and pagination.
6. Verify existing Pipeline management and saved views; custom fields and automation follow later.

Comment creation/editing now share parent lifecycle protection with archive/restore (D053).
All four entity types have isolated PostgreSQL rollback/lifecycle tests; multi-session/browser checks remain.
Activity pagination and structured old/new Task values remain open.

## Current cycle

STABILIZATION BEFORE MORE LARGE FEATURES

Recently completed / materially stabilized:

- F01 exact email identity
- F02 verified, one-time, transaction-safe Organization invitation flow
- F03 public DB health exposure
- F04 Deal Stage transition race at application level
- F05 responsible-Member assignment Permission policy
- F06 stable Owner identity + concurrency-safe last-Owner protection
- F07 inactive Organization / Membership access with PostgreSQL regression coverage
- F08 inactive-owner preservation + new-owner active Membership validation
- F09 strict date-only Deal expectedCloseAt
- F10 primary Deal optimistic-locking paths
- F11 archived Client relationship mutation with PostgreSQL regression coverage
- cross-tenant Client ↔ Company and invitation boundaries
- shared Company/Deal owner-assignment resolver

Do not recreate these features.

---

# 1 — Regression tests for remaining authorization surfaces

Highest-value next tests:

- hidden Member data without `members.read`
- Company hidden in Deal without `companies.read`
- linked Clients not queried without `clients.read`
- Dashboard aggregate Permission policy
- verified-email CRM gate at application boundary

Already implemented:

- owner-assignment RBAC unit coverage
- owner active/inactive PostgreSQL coverage
- cross-tenant relationship denial
- cross-tenant invitation inviter/Role denial
- inactive Organization/Membership denial

Goal:

turn remaining manually verified permission semantics into automated regressions.

---

# 2 — Deal conflict integration / browser verification

Current application-level optimistic locking is implemented.

Next coverage should verify real workflows such as:

- stale full Deal edit against PostgreSQL
- Kanban Stage move vs stale edit form
- manual Stage selector vs stale version
- archive vs stale edit
- restore/lifecycle conflict behavior
- zero-row conditional update is surfaced as conflict, never success

Use real PostgreSQL where the result depends on committed database state.

Use browser/E2E only where page-rendered version and stale UI behavior matter.

Do not add a second independent Deal mutation path merely for testing.

---

# 3 — Strengthen PostgreSQL invariants

Before adding constraints:

inspect data
→ identify invalid rows
→ repair deliberately
→ create new migration
→ verify against PostgreSQL

Priority invariants:

Items 1–7 below are implemented and isolated-PostgreSQL-tested in 0013, including core owner and
Deal Company references. They are applied to the connected Neon database; verify other environments
separately. Item 8 remains unconfirmed. Task/Comment/Activity
references and invitation reference constraints remain future work; do not call all database integrity complete.

1. Pipeline Stage belongs to same Organization as Pipeline
2. Deal Organization + Pipeline + Stage remain consistent
3. Member ↔ Role remains in one Organization
4. Client ↔ Company remains in one Organization
5. Stage probability is 0..100
6. Stage type is open / won / lost
7. Deal amount/currency consistency
8. one active default Pipeline per Organization if confirmed

Application validation remains required.

Do not edit already-applied migrations casually.

---

# 4 — F12 scaling

Current structural scale limitations include:

- Kanban loads all Deals in selected Pipeline
- Deal archive is unbounded
- large reference lists
- Company selectors
- Member selectors

Preferred direction:

- pagination
- searchable selectors
- incremental loading
- per-column Kanban loading
- SQL aggregates
- representative dataset tests
- `EXPLAIN ANALYZE` before index tuning

Do not introduce Redis or microservices for ordinary query/UI scaling.

---

# 5 — Expand CI safely

Basic GitHub Actions CI is implemented and passing.

Current CI:

`npm ci`
→ `next typegen`
→ `npx tsc --noEmit --incremental false`
→ `npm run lint`
→ `npm test`

Current local verification additionally includes:

- `npm run test:integration` — 23 PostgreSQL tests
- `npm run build`

Database integration tests are deliberately excluded from CI because they mutate PostgreSQL fixtures and currently use `DATABASE_URL`.

Next CI step:

1. keep non-database CI fast and deterministic
2. create a dedicated non-production PostgreSQL CI strategy
3. add `npm run test:integration` only after isolation is guaranteed
4. add production build only after safe build-time environment handling is established

Never use production database credentials for destructive CI tests.

---

# 6 — F02 product/operations follow-up

The core invitation authorization flow is fixed and integration-tested.

Remaining work:

- real production email provider
- full invitation URL delivery
- pending invitation list
- revoke invitation UI
- resend/reissue UX
- cleanup/reporting for old expired invitations

Do not revert to direct Membership creation by administrator-supplied email.

Decision:

D047

---

# 7 — Business-operation boundaries

Continue moving genuinely shared rules into focused domain modules.

Current examples:

`src/modules/deals/transition-deal.ts`

`src/modules/members/owner-guard.ts`

`src/modules/members/owner-assignment-policy.ts`

`src/modules/members/owner-assignment.ts`

`src/modules/access/tenant-access.ts`

`src/modules/clients/client-company-relation.ts`

`src/modules/invitations/create-invitation.ts`

`src/modules/invitations/accept-invitation.ts`

Target Server Action shape:

parse input
→ obtain trusted access context
→ call domain operation
→ translate result to UI response

Potential future extractions should be justified by duplicated business rules, not abstraction for its own sake.

Do not create a generic repository framework.

---

# Current automated verification

Locally verified:

- 37 / 37 unit/regression tests
- 23 / 23 PostgreSQL integration tests
- TypeScript passed
- ESLint passed
- production build passed

Current PostgreSQL coverage includes:

- Owner concurrency
- invitation concurrency
- inactive tenant access
- Client ↔ Company lifecycle
- cross-tenant boundaries
- responsible-Member active/inactive Membership semantics

---

# Stabilization exit criteria

Before starting the next large module, aim for:

- remaining related-data authorization semantics automated
- important Deal stale-write paths verified against PostgreSQL/browser behavior
- key PostgreSQL invariants implemented or deliberately deferred with rationale
- F12 initial scale limits addressed for representative data
- no major unresolved authorization ambiguity

Not every long-term production feature must be complete.

---

# Existing Tasks / Activity foundation

Tasks already include CRM links, owners, filters, pagination, bulk actions, reminders and recurrence.
Task writes and their events now share atomic SQL operations. PGlite tests verify rollback and stale versions.
Comments and task history exist; structured history values and pagination remain open.

---

# After Tasks

Organization provisioning / browser tenant workflow verification
→ Verify existing Activity for Client / Company / Deal (D056)
→ Pipeline/Stage management UI
→ direct Deal contacts
→ saved views
→ custom fields
→ import
→ analytics
→ automation
→ integrations
→ read-first AI

AI remains later and must use the same domain operations and RBAC as the normal UI.
