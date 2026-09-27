# Universal CRM — Next Development Steps

Last updated: 2026-09-28

## Current cycle

STABILIZATION BEFORE MORE LARGE FEATURES

Recently completed / materially stabilized:

- F01 exact email identity
- F03 public DB health exposure
- F04 Deal Stage transition race at application level
- F05 related-data and assignment Permission policy
- F07 inactive Organization access
- F08 unchanged inactive owner behavior
- F09 strict date-only Deal expectedCloseAt
- F10 primary Deal optimistic-locking paths
- F11 archived Client relationship mutation at code level

Do not recreate these features.

---

# 1 — F06: Last Owner concurrency and stable Owner identity

This is the next major stabilization task.

Current weakness:

read current Owners
→ validate
→ write

is not concurrency-safe.

Two concurrent administrative requests may both pass a pre-check and remove/deactivate different Owners.

Required design goals:

- stable system identity for Owner Role
- explicit ownership-transfer semantics
- concurrency-safe last-Owner invariant
- no solution based only on another pre-check

Directions to evaluate:

- Role `systemKey`
- explicit ownership transfer operation
- atomic SQL
- PostgreSQL function
- transactional administrative path
- database-supported invariant

Acceptance criteria:

- concurrent administrative operations cannot leave an Organization without required Owner state
- changing Role display name cannot change security identity
- ownership transfer is documented
- integration/concurrency regression test exists

---

# 2 — F02: Production-safe invitation flow

Current development state:

- email verification exists
- normal CRM access requires verified email
- Team add-member rejects unverified identity
- development Owner linker rejects unverified identity

Production-safe target:

administrator creates invitation
→ invitation bound to Organization and intended identity
→ one-time token
→ expiration
→ authenticated acceptance
→ matching verified identity
→ Membership creation/activation

Rules:

- knowing an email address is not sufficient authorization
- token is single-use
- token expires
- accepted User must match intended identity
- replay is rejected
- invitation cannot grant another Organization
- Owner bootstrap policy is explicit

---

# 3 — Regression tests for completed stabilization

Priority tests:

- exact email identity
- verified-email CRM gate
- inactive Membership
- inactive Organization
- cross-tenant entity denial
- unchanged inactive Company owner
- unchanged inactive Deal owner
- Manager owner assignment restriction
- hidden Member data without `members.read`
- Company hidden in Deal without `companies.read`
- linked Clients not queried without `clients.read`
- Dashboard aggregate Permission policy
- archived Client link rejection
- archived Client unlink rejection
- impossible calendar dates
- stale Deal edit version conflict
- Kanban vs stale form
- PostgreSQL/browser verification of page-version conflicts for Kanban and manual Stage changes (unit regression tests now exist)
- Deal Stage/Pipeline validation
- archive/restore lifecycle conflict
- last Owner concurrency

Use real PostgreSQL integration tests when SQL/concurrency behavior matters.

---

# 4 — Add CI

Target GitHub Actions pipeline:

`npm ci`
→ `next typegen`
→ `npx tsc --noEmit --incremental false`
→ `npm run lint`
→ `npm test`
→ `npm run build`

Rules:

- no production `DATABASE_URL`
- no production secrets
- database tests use dedicated test environment
- any TypeScript/lint/test/build failure blocks the workflow

---

# 5 — Strengthen PostgreSQL invariants

Before adding constraints:

inspect data
→ identify invalid rows
→ repair deliberately
→ create new migration

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

---

# 6 — F12 scaling

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

# 7 — Clean up business-operation boundaries

Continue moving genuinely shared rules into focused domain modules.

Existing example:

`src/modules/deals/transition-deal.ts`

High-value candidates:

- Deal lifecycle mutation
- Deal full edit
- Company owner assignment
- Client ↔ Company relation mutation
- Team ownership operations

Target Server Action shape:

parse input
→ obtain trusted access context
→ call domain operation
→ translate result to UI response

Do not create a generic repository abstraction.

---

# Stabilization exit criteria

Before starting the next large module, aim for:

- F06 design/implementation substantially strengthened
- F02 invitation design established
- core regression suite
- CI
- key PostgreSQL invariants planned or partly implemented
- no major unresolved authorization ambiguity

Not every long-term production feature must be complete.

---

# Next major product module — Tasks

After stabilization, Tasks remain the first major product module.

Initial model should consider:

- id
- organizationId
- title
- description
- dueAt
- status
- priority
- ownerMemberId
- createdByMemberId
- completedAt
- createdAt
- updatedAt
- deletedAt
- version if collaborative edits require it

Possible relationships:

- Deal
- Client
- Company

Initial views:

- today
- overdue
- mine
- upcoming
- completed
- Deals without a next action

Authorization must use the same trusted tenant context.

---

# After Tasks

Collaborative Notes
→ Activity Timeline
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
