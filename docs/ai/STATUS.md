# Universal CRM — Current Status

Last updated: 2026-09-29

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

# Verification

Latest complete local verification:

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

The current application still uses the fixed `development` Organization until real Organization selection is introduced.

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

Database relationship constraints still need strengthening.

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

Database-level composite invariant remains future work.

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

- Tasks
- Collaborative Notes
- Activity Timeline
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

Tasks
→ Collaborative Notes
→ Activity Timeline
→ Pipeline management
→ direct Deal contacts
