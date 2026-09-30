# Universal CRM — Next Development Steps

Last updated: 2026-09-30

## Immediate development sequence — 2026-09-30

Tasks and Task Activity Stage 2 are already published in `9569de6`; do not recreate them.
User priority: multiple independent companies.

1. Verify Activity access/archived-parent hardening against an isolated PostgreSQL database and browser workflows.
2. Make Task + Schedule + Activity writes atomic, including version checks and reliable recurring task creation.
3. Replace fixed `development` organization selection with validated active Membership-based selection; test two-company workflows and stale forms across tenant switches.
4. Strengthen database tenant constraints and introduce dedicated integration CI.
5. Roll Activity out to Client / Company / Deal using the stabilized event model.
6. Add saved views and Pipeline management; custom fields and automation follow later.

Comment creation/editing still need the same concurrent parent lifecycle protection as archive/restore.
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
Comments and task history are implemented. Existing scheduling and event writes require stabilization before further expansion.

---

# After Tasks

Organization selection / tenant workflow verification
→ Activity for Client / Company / Deal
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
