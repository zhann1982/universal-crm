# Universal CRM — Current Status

Last updated: 2026-09-27

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
- `npx tsc --noEmit --incremental false`
- `npm run lint`

Recent F05 permission scenarios were also manually checked in the browser and reported working.

A fresh complete production build after all latest local changes has not yet been recorded.

No GitHub Actions CI workflow exists yet.

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

PARTIALLY FIXED / DEVELOPMENT-SAFE INTERMEDIATE STATE

Still missing for production:

- real email delivery
- invitation token
- expiration
- authenticated acceptance
- production onboarding policy

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
- application-level last-Owner protection

F07:

FIXED FOR CURRENT DEVELOPMENT TENANT MODEL

F06:

OPEN

Last-Owner protection is still not concurrency-safe.

Owner system identity still needs a stable `systemKey` or equivalent.

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
- archived Client lifecycle guard inside Server Action

Archived Client:

→ cannot link Company
→ cannot unlink Company

F11:

CODE FIXED

A dedicated stale-UI regression test remains desirable.

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

Automated coverage currently includes:

- canonical email lookup behavior
- `_` and `%` literal email identity behavior
- strict Deal calendar date validation

Still needed:

- cross-tenant regression suite
- inactive Organization automated test
- archived Client relationship test
- owner-assignment RBAC tests
- related-data visibility tests
- Deal conflict integration tests
- last Owner concurrency test
- PostgreSQL invariant tests
- E2E critical workflow suite

---

# CI

Not implemented.

Target:

`npm ci`
→ `next typegen`
→ `npx tsc --noEmit --incremental false`
→ `npm run lint`
→ `npm test`
→ `npm run build`

---

# Audit stabilization summary

F01 — FIXED

F02 — PARTIALLY FIXED / DEVELOPMENT-SAFE INTERMEDIATE STATE

F03 — FIXED

F04 — FIXED AT APPLICATION LEVEL

F05 — FIXED / MANUALLY VERIFIED

F06 — OPEN

F07 — FIXED FOR CURRENT DEVELOPMENT TENANT MODEL

F08 — IMPLEMENTED

F09 — FIXED

F10 — FIXED AT CURRENT APPLICATION LEVEL

F11 — CODE FIXED

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

1. F06 — stable Owner identity + concurrency-safe last-Owner invariant
2. F02 — production invitation / membership acquisition
3. regression tests for completed stabilization work
4. GitHub Actions CI
5. stronger PostgreSQL invariants
6. F12 scaling work as datasets grow

After sufficient stabilization:

Tasks
→ Collaborative Notes
→ Activity Timeline
→ Pipeline management
→ direct Deal contacts
