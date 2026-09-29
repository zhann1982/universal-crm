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

Repeated local checks during stabilization:

- `npm test`
- `npm run test:integration`
- `npx tsc --noEmit --incremental false`
- `npm run lint`

Latest complete local verification after regression coverage expansion:

- `npm test` — 30 tests passed
- `npm run test:integration` — 12 tests passed
- `npx tsc --noEmit --incremental false` — passed
- `npm run lint` — passed
- `npm run build` — passed

Current PostgreSQL integration coverage includes Owner invariants, invitation concurrency, tenant access lifecycle, and Client ↔ Company relationship lifecycle rules.

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

The first GitHub Actions run completed successfully.

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

Concurrency uses PostgreSQL transaction advisory locks.

Creation and acceptance share the canonical-email lock namespace so Membership acquisition cannot race with creation of another active invitation.

Acceptance also protects reuse of the same token.

Current development limitation:

- production email delivery is not configured
- invitation token/link is currently transferred manually during development
- invitation administration UX for listing/revoking/resending invitations can be improved later

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
- adding registered Users
- role assignment/update
- Member activation/deactivation
- self-role protection
- self-deactivation protection
- inactive Organization access denial
- stable system Role identity through nullable `roles.systemKey`
- `Owner` security identity through `systemKey = "owner"`
- concurrency-safe last-Owner protection for role removal
- concurrency-safe last-Owner protection for Member deactivation
- organization-scoped PostgreSQL transaction advisory lock for Owner-reducing mutations

System Role display names are no longer used as machine security identity.

Custom Roles may keep `systemKey = null`.

F07:

FIXED AND INTEGRATION-TESTED FOR CURRENT DEVELOPMENT TENANT MODEL

Automated PostgreSQL coverage verifies:

- inactive Organization is rejected by the tenant access resolver
- inactive Membership is rejected
- active Membership remains allowed

The current application still uses the fixed `development` Organization until real Organization selection is introduced.

F06:

FIXED AT CURRENT APPLICATION / POSTGRESQL TRANSACTION LEVEL

The previous sequential read-check-write race has been replaced for Owner-reducing Team mutations by:

transaction
→ organization-scoped advisory lock
→ re-read current committed Owner state
→ validate last-Owner invariant
→ mutate

Two concurrent attempts to remove/deactivate the final two active Owners are serialized. Integration tests verify that only one destructive mutation succeeds and one active Owner remains.

Current note:

An explicit dedicated ownership-transfer workflow is still a possible future UX improvement, but it is no longer required for the current last-Owner race fix.

---

# Clients

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
- tenant scoping
- RBAC

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

Responsible Member rule:

- existing owner may remain unchanged even if inactive
- newly assigned owner must be active
- without `members.read`, assignment is limited to self or no owner
- Member email is not included in normal assignment DTOs
- hidden foreign Member names use neutral `Сотрудник`

F08:

IMPLEMENTED

---

# Client ↔ Company

Implemented:

- many-to-many link
- unlink
- reverse display
- tenant validation
- archived Client lifecycle guard in shared domain operation
- shared Client ↔ Company relationship mutation module

Archived Client:

→ cannot link Company
→ cannot unlink Company

F11:

FIXED AND INTEGRATION-TESTED

PostgreSQL regression coverage verifies:

- archived Client cannot create a new Company relationship
- archived Client cannot remove an existing Company relationship
- active Client may remove an existing relationship to an archived Company

The Server Actions delegate relationship lifecycle rules to:

`src/modules/clients/client-company-relation.ts`

A browser-level stale-UI test remains a possible additional layer, but the direct server-side mutation rule is now automatically covered.

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
- notes/description
- archive
- restore
- archive view
- Kanban
- drag-and-drop
- manual Stage selector
- closedAt rules
- currency-separated totals
- tenant scoping
- RBAC

Shared transition module:

`src/modules/deals/transition-deal.ts`

F04:

FIXED AT APPLICATION LEVEL

Database-level composite invariant remains future work.

---

# Deal optimistic locking

Implemented:

- `version integer not null default 1`
- expected version in edit flow
- conditional full Deal update
- conditional Stage transition
- page-rendered expected version from Kanban and manual Stage selector
- stale Stage requests rejected before no-op handling
- version increment on edit
- version increment on Stage transition
- version increment on archive
- version increment on restore
- explicit conflict behavior for primary stale mutation paths

Manual scenarios already verified:

- two-tab stale edit
- Kanban invalidates stale edit form
- normal sequential edits

F10:

FIXED AT CURRENT APPLICATION LEVEL

Nuance:

Stage transitions now require the version observed on the page. Unit regression
tests execute the shared transition operation with mocked database boundaries,
including a stale no-op and zero affected rows after a concurrent write. These
are not PostgreSQL integration or browser tests.

archive/restore currently read current version at mutation time, so strict page-rendered stale-button intent protection is not identical to edit-form optimistic locking.

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
- display avoids JS Date timezone conversion
- migration to date semantics

F09:

FIXED

Decision:

D044

---

# Related-data permission policy

Implemented policy:

Responsible Member assignment:

with `members.read`
→ any active Organization Member

without `members.read`
→ self or no owner

Existing owner may remain unchanged even if inactive.

Member email is excluded from normal owner-selection DTOs.

Responsible Member display:

with `members.read`
→ real display name

without `members.read`, self
→ own display name

without `members.read`, another Member
→ `Сотрудник`

Related entity visibility:

- Company data in Deal views requires `companies.read`
- linked Client data in Company views requires `clients.read`
- Dashboard aggregates require corresponding module `.read`

Queries are gated before related data is serialized where relevant.

Deal edit without `companies.read` preserves the existing relationship using a neutral label `Текущая компания`.

Representative Manager/Viewer-style browser checks passed.

F05:

FIXED / MANUALLY VERIFIED

Decision:

D045

---

# Dashboard

Implemented:

basic CRM Dashboard

Current aggregate policy:

- Client count requires `clients.read`
- Member count requires `members.read`
- Role count requires `roles.read`
- Organization card remains visible in normal CRM context

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

Automated unit/regression coverage currently includes:

- canonical email lookup behavior
- `_` and `%` literal email identity behavior
- strict Deal calendar date validation
- Deal Stage page-version conflict behavior
- safe same-origin `next` redirect validation
- invitation token generation and hashing

PostgreSQL integration coverage currently includes:

- concurrent Owner-role removal
- concurrent Owner deactivation
- last active Owner invariant after concurrent destructive requests
- concurrent acceptance of the same invitation
- concurrent acceptance of separate invitations for the same identity
- invitation identity mismatch rejection
- concurrent invitation creation for the same Organization/email
- replacement after an expired invitation
- inactive Organization access rejection
- inactive Membership access rejection
- archived Client link rejection
- archived Client unlink rejection
- active Client unlink from archived Company

Current result:

12 / 12 integration tests passing.

Commands:

- `npm test`
- `npm run test:integration`

The Owner integration suite creates an isolated temporary Organization and deletes it after each test. It uses the configured development/test PostgreSQL connection and therefore must not be treated as a production CI database strategy.

Still needed:

- cross-tenant regression suite
- owner-assignment RBAC tests
- related-data visibility tests
- Deal conflict integration tests
- PostgreSQL invariant tests
- E2E critical workflow suite

---

# CI

Implemented for non-database checks.

Current workflow:

`.github/workflows/ci.yml`

Current GitHub Actions status:

PASSING

Database integration tests remain local until a dedicated CI PostgreSQL strategy is introduced.

Target:

`npm ci`
→ `next typegen`
→ `npx tsc --noEmit --incremental false`
→ `npm run lint`
→ `npm test`
→ database integration tests against a dedicated test database
→ `npm run build`

Do not run destructive integration tests against production data.

---

# Audit stabilization summary

F01 — FIXED

F02 — FIXED FOR CORE AUTHORIZATION / TRANSACTION FLOW

F03 — FIXED

F04 — FIXED AT APPLICATION LEVEL

F05 — FIXED / MANUALLY VERIFIED

F06 — FIXED AT CURRENT APPLICATION / POSTGRESQL TRANSACTION LEVEL

F07 — FIXED AND INTEGRATION-TESTED FOR CURRENT DEVELOPMENT TENANT MODEL

F08 — IMPLEMENTED

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

1. broader regression tests for completed stabilization work
2. stronger PostgreSQL invariants
3. F12 scaling work as datasets grow
4. dedicated CI database strategy for integration tests
5. production invitation email delivery and invitation administration UX
6. continue extracting genuinely shared business operations into focused modules

After sufficient stabilization:

Tasks
→ Collaborative Notes
→ Activity Timeline
→ Pipeline management
→ direct Deal contacts
