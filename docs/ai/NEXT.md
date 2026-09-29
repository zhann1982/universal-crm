# Universal CRM — Next Development Steps

Last updated: 2026-09-29

## Current cycle

STABILIZATION BEFORE MORE LARGE FEATURES

Recently completed / materially stabilized:

- F01 exact email identity
- F02 verified, one-time, transaction-safe Organization invitation flow
- F03 public DB health exposure
- F04 Deal Stage transition race at application level
- F05 related-data and assignment Permission policy
- F06 stable Owner identity + concurrency-safe last-Owner protection
- F07 inactive Organization access
- F08 unchanged inactive owner behavior
- F09 strict date-only Deal expectedCloseAt
- F10 primary Deal optimistic-locking paths
- F11 archived Client relationship mutation at code level

Do not recreate these features.

---

# 1 — F02 follow-up: invitation delivery and administration

The core F02 authorization problem is fixed.

Implemented:

administrator creates invitation
→ invitation is bound to Organization + canonical email + Role
→ random raw token is generated
→ only SHA-256 hash is stored
→ invitation expires
→ User authenticates
→ User verifies email
→ authenticated identity must match invitation
→ current Organization and Role are revalidated
→ Membership + Role are created atomically
→ invitation becomes accepted

Concurrency protection exists for:

- duplicate active invitation creation
- same-token replay
- separate invitation acceptance for the same identity
- Membership acquisition racing with invitation creation

Current automated verification:

- 30 unit/regression tests
- 7 PostgreSQL integration tests
- TypeScript
- ESLint
- production build

Remaining invitation work is operational/product work rather than the original security defect:

- real production email provider
- full invitation URL delivery instead of manual development transfer
- pending invitation list
- revoke invitation UI
- resend/reissue UX
- cleanup/reporting for old expired invitations

Do not revert to direct Membership creation by administrator-supplied email.

Decision:

D047

---

# 2 — Regression tests for completed stabilization

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
- PostgreSQL/browser verification of page-version conflicts for Kanban and manual Stage changes
- Deal Stage/Pipeline validation
- archive/restore lifecycle conflict
- Owner system identity behavior
- last Owner concurrency

Already implemented:

- real PostgreSQL integration test for concurrent Owner-role removal
- real PostgreSQL integration test for concurrent Owner deactivation
- assertion that one active Owner remains
- separate `npm run test:integration` command
- same-token concurrent invitation acceptance
- separate invitations for the same identity cannot create duplicate Memberships
- wrong-email invitation acceptance rejection
- concurrent invitation creation produces one active invitation
- expired invitation does not block a new invitation

Use real PostgreSQL integration tests when SQL/concurrency behavior matters.

Do not point integration tests at production data.

---

# 3 — Expand CI safely

Basic GitHub Actions CI is implemented and passing.

Current workflow:

`.github/workflows/ci.yml`

Current checks:

`npm ci`
→ `next typegen`
→ `npx tsc --noEmit --incremental false`
→ `npm run lint`
→ `npm test`

Current design deliberately excludes database integration tests.

Reason:

- integration tests mutate PostgreSQL fixtures
- they currently use `DATABASE_URL`
- production database credentials must never be used in CI
- a dedicated disposable/test PostgreSQL environment is required first

Next CI step:

1. keep current non-database CI fast and deterministic
2. create dedicated CI PostgreSQL strategy
3. add `npm run test:integration` only after isolation is guaranteed
4. optionally add production build once safe build-time environment handling is established

---

# 4 — Strengthen PostgreSQL invariants

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

For Member ↔ Role, the new system Role identity does not replace tenant-consistency validation.

---

# 5 — F12 scaling

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

# 6 — Clean up business-operation boundaries

Continue moving genuinely shared rules into focused domain modules.

Existing examples:

`src/modules/deals/transition-deal.ts`

`src/modules/members/owner-guard.ts`

High-value candidates:

- Deal lifecycle mutation
- Deal full edit
- Company owner assignment
- Client ↔ Company relation mutation
- invitation acceptance
- ownership transfer if a dedicated UX is later added

Target Server Action shape:

parse input
→ obtain trusted access context
→ call domain operation
→ translate result to UI response

Do not create a generic repository abstraction.

---

# F06 completed design

Current Owner invariant implementation:

stable Role identity
→ `roles.systemKey`

Owner machine identity
→ `systemKey = "owner"`

Owner-reducing Team mutation
→ start PostgreSQL transaction
→ acquire organization-scoped transaction advisory lock
→ evaluate current committed Owner state
→ reject mutation if it would remove/deactivate the last active Owner
→ otherwise mutate

Current coverage:

- Team UI manually verified
- concurrent Owner-role removal integration tested
- concurrent Owner deactivation integration tested
- one active Owner remains after concurrent destructive requests

Custom Roles may use `systemKey = null`.

Display name such as `Owner` is no longer the security identity.

A dedicated ownership-transfer UI may still improve administration later, but the current invariant no longer depends on a sequential pre-check.

---

# Stabilization exit criteria

Before starting the next large module, aim for:

- F02 invitation authorization and concurrency flow implemented and integration-tested
- broader core regression suite
- CI
- key PostgreSQL invariants planned or partly implemented
- no major unresolved authorization ambiguity

F06 no longer blocks stabilization exit.

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
