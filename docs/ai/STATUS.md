# Universal CRM — Current Status

Last updated: 2026-09-27

Verified repository snapshot:

main
c7e35b758ecfbd5421b9c83a800ff0ff2c238c3d

Original technical audit date:

2026-09-26

## Status meaning

This file is the single source of truth for current implementation status.

Use these terms carefully:

Implemented
→ code exists in the repository

Manually working
→ behavior has been manually exercised during development

Automatically verified
→ covered by a repeatable automated check/test

Production-ready
→ do not assume unless explicitly stated

The current application is not yet production-ready.

---

# Current phase

CRM Core / early v0.2

Current phase:

STABILIZATION BEFORE MORE LARGE FEATURES

The modular-monolith architecture remains appropriate.

No rewrite, microservice split, Redis, queue, separate backend or AI backend is
currently required.

The main current objective is to finish the remaining security, lifecycle,
permission, validation and concurrency issues discovered during the
2026-09-26 audit.

---

# Stack

- Next.js 16.3.6
- React 19
- TypeScript
- Tailwind CSS 4
- PostgreSQL
- Neon
- Drizzle ORM
- drizzle-kit
- Zod 4
- Better Auth 1.7.x
- npm
- tsx

Architecture:

- Next.js App Router
- modular monolith
- Server Components by default
- Server Actions for mutations
- PostgreSQL primary datastore
- Neon serverless database access
- server-side authorization
- organization-based multi-tenancy

---

# Verification status

The original 2026-09-26 audit successfully ran:

- npm ci
- ESLint
- next typegen
- TypeScript check

The audited production build compiled and typechecked but stopped during route
data collection because DATABASE_URL was unavailable in the audit environment.

Therefore a complete production build was not verified by that audit.

During the stabilization work after the audit, TypeScript and ESLint checks were
repeatedly run locally after individual changes and reported working.

A fresh complete production build has not yet been recorded after the latest
stabilization commits.

No GitHub Actions CI workflow currently exists.

---

# Authentication

Implemented:

- Better Auth
- registration
- login
- logout
- session cookies
- server-side session resolution
- email verification tokens
- verification page
- resend verification flow

Development verification delivery:

- Better Auth generates verification URLs
- in non-production the verification URL is printed to the server terminal
- production email delivery is intentionally not configured yet

Current CRM rule:

authenticated User
+ verified email
+ active Organization
+ active Membership
→ may proceed to CRM authorization

Better Auth login itself currently does not require verified email.

Instead CRM access is blocked in server authorization for unverified Users.

This is intentional during development so existing development accounts can log
in and complete verification.

Production gap:

- real email delivery is not configured
- full invitation acceptance workflow is not implemented
- Better Auth `requireEmailVerification` is not enabled globally

---

# Email identity lookup

Implemented:

- canonical trim/lowercase
- exact equality lookup
- no LIKE / ILIKE identity matching
- ambiguous normalized matches are rejected
- emailVerified is returned by the identity lookup
- Team add-member uses the shared exact lookup
- development Owner linker uses the shared exact lookup

Regression test exists for:

- trim/lowercase
- `_` treated literally
- `%` treated literally
- case-insensitive canonical equality

Audit finding F01 is considered fixed.

---

# Membership / RBAC

Implemented:

- Organization membership
- active/inactive Member state
- multiple Roles per Member
- Permissions
- permission checks
- Team listing
- adding registered Users to an Organization
- role assignment/update
- Member activation/deactivation
- self-role protection
- self-deactivation protection
- application-level last-Owner protection

Current add-member rule:

- User must exist
- normalized identity lookup must be unique
- User email must be verified before normal membership acquisition

Known limitation:

last-Owner protection is still application-level and is not concurrency-safe.

Owner system identity still depends on the current Role model and needs a stable
system key before production administration becomes more complex.

---

# Organization access

Current development Organization selection is still fixed to:

slug = development

This remains a temporary development limitation.

Implemented:

organizations.isActive is now part of CRM access.

If:

organizations.isActive = false

CRM business access redirects to:

/no-access?reason=organization-inactive

The Organization data is preserved and access returns after reactivation.

This behavior has been manually tested.

Audit finding F07 is considered fixed for the current fixed-Organization model.

Future multi-Organization selection must validate active Membership server-side.

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

Lifecycle:

active
→ archived
→ restored

Normal workflow does not physically delete Clients.

Known audit issue:

F11 remains open.

The UI prevents some relationship mutation for archived Clients, but the
Client ↔ Company mutation Server Action still needs an explicit lifecycle guard.

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

Responsible Member rule has been changed:

- an unchanged inactive current owner may remain assigned
- assigning a new owner requires an active Member

This resolves the code path described by audit finding F08.

The implementation is committed.

A dedicated manual regression scenario for F08 should still be recorded before
marking it fully manually verified.

---

# Client ↔ Company

Implemented:

- many-to-many relationship
- link
- unlink
- reverse display

Table:

client_companies

Known issue:

F11 remains open.

Archived Client immutability is not yet consistently enforced inside the Server
Action itself.

---

# Pipelines / Stages

Implemented in database:

- Pipelines
- ordered Stages
- Stage type
- Stage probability
- Stage color
- Pipeline selection in Deal UI

Seed creates a default Pipeline and standard Stages.

Stage types:

- open
- won
- lost

Not implemented:

- Pipeline management UI
- Stage management UI

Database constraints do not yet fully guarantee all Organization / Pipeline /
Stage consistency.

Application validation currently provides stronger protection than the database
schema for several of these relationships.

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
- description/notes
- archive
- restore
- archive view
- Kanban
- HTML drag-and-drop
- manual Stage selector
- server-side Stage validation
- closedAt handling
- currency-separated totals
- tenant scoping
- RBAC

## Shared Stage transition

Implemented:

src/modules/deals/transition-deal.ts

Both manual Stage movement and Kanban movement use the shared transition
operation.

The operation validates:

- Deal UUID
- Stage UUID
- Organization
- active Deal lifecycle
- current Pipeline
- target Stage belongs to current Pipeline
- Stage type
- expected current Stage
- expected current version

It returns an explicit conflict if the conditional UPDATE changes zero rows.

Audit finding F04 is considered fixed at the application level.

A stronger database-level Pipeline/Stage invariant is still planned.

---

# Deal optimistic locking

Implemented migration:

drizzle/0005_fearless_sheva_callister.sql

Deal now has:

version integer not null default 1

Deal edit form carries the version that was originally loaded.

Full Deal update performs:

WHERE
- Deal id matches
- Organization matches
- Deal is active
- deletedAt is null
- version matches expected version

Successful update:

version = version + 1

Zero updated rows:

→ explicit conflict
→ stale edit is not silently saved

Stage transition also:

- reads current version
- checks current version
- increments version

Archive and restore also increment Deal version.

Manually verified scenarios:

1. same Deal opened in two edit tabs
   → first save succeeds
   → stale second save is rejected

2. Deal edit form remains open while Kanban changes Stage
   → Kanban increments version
   → stale form save is rejected

3. normal sequential edits
   → both succeed

This closes the primary lost-update behavior from F10.

Remaining F10 follow-up:

archive/restore mutations still need an explicit policy for concurrent
archive/restore and affected-row handling.

They currently increment version but do not yet provide the same explicit
conflict result contract as the main edit and Stage transition operations.

---

# Deal state

Deal state is derived from:

pipeline_stages.type

No separate Deal won/lost status exists.

Rules:

open
→ closedAt = null

won/lost
→ closedAt is set

Moving a Deal back to open clears closedAt.

The shared Stage transition owns this rule for Stage movement.

Full Deal editing still contains related closedAt logic and is a candidate for
further consolidation into a Deal business module.

---

# Money

Implemented:

- PostgreSQL numeric(14,2)
- separate currency field
- Deal currency formatting
- Kanban totals grouped by currency

Different currencies are not combined into one total.

Known policy gaps:

- database-level amount/currency consistency is incomplete
- financial database constraints are not yet finalized

---

# Health endpoint

Public route:

/api/health/db

Implemented behavior:

- lightweight `SELECT 1`
- no tenant counters
- no CRM record counts
- generic success response
- generic failure response
- no raw database error returned to client
- no-store cache policy

Audit finding F03 is considered fixed.

---

# Dashboard

Implemented:

basic CRM Dashboard.

Known permission issue:

F05 remains open.

Dashboard aggregate visibility and other related reference data need a single
explicit permission policy.

---

# Collaborative Notes

Not implemented.

Existing Client / Company / Deal `notes` fields are descriptive text only.

They are not collaborative Notes.

Future collaborative Notes require separate records.

---

# Tasks

Not implemented.

Tasks remain the planned first major product module after stabilization.

---

# Activity Timeline / Audit History

Not implemented.

This remains important before advanced analytics, automation and AI.

---

# Direct Deal contacts

Not implemented.

Current Deal may reference a Company but does not directly reference multiple
Client contacts.

Likely future model:

deal_clients

---

# Custom Fields

Not implemented.

---

# Saved Views

Not implemented.

---

# Automation

Not implemented.

---

# AI

Not implemented.

This is intentional.

AI should only be added after:

- tenant boundaries
- RBAC
- business operations
- lifecycle policy
- concurrency
- validation
- activity history

are sufficiently stable.

---

# Audit stabilization status

Original audit findings:

## F01 — exact email identity

Status:

FIXED

Implemented canonical exact lookup and regression test.

---

## F02 — verified identity before membership

Status:

PARTIALLY FIXED / DEVELOPMENT-SAFE INTERMEDIATE STATE

Implemented:

- email verification
- CRM access requires verified email
- Team membership flow rejects unverified account
- development Owner linking rejects unverified account

Still required for production:

- real mail provider
- invitation token
- expiry
- authenticated acceptance
- production onboarding policy

---

## F03 — public health information exposure

Status:

FIXED

Public health now performs only minimal DB readiness.

---

## F04 — Deal Stage/Pipeline race

Status:

FIXED AT APPLICATION LEVEL

Shared Stage transition now uses conditional state/version validation.

Database-level composite invariant is still future work.

---

## F05 — related-data permission inconsistency

Status:

OPEN

Needs explicit policy for:

- assignment directory
- Member names
- Member emails
- Company data shown in Deals
- Dashboard aggregates

---

## F06 — last Owner race

Status:

OPEN

Current application pre-check is not concurrency-safe.

---

## F07 — inactive Organization access

Status:

FIXED FOR CURRENT DEVELOPMENT TENANT MODEL

Inactive Organization blocks CRM access.

Manually tested.

---

## F08 — inactive Company owner blocks unrelated edits

Status:

IMPLEMENTED

Current inactive owner may remain unchanged.

Newly assigned owner must be active.

Dedicated manual regression test still desirable.

---

## F09 — impossible calendar dates

Status:

OPEN

Current Deal date validation still relies on Date.parse.

Examples still requiring rejection:

- 2026-02-29
- 2026-02-31
- 2026-04-31

Date-only vs timestamp semantics are not yet finalized.

---

## F10 — lost Deal updates

Status:

PRIMARY EDIT/STAGE CONFLICT PATH FIXED

Implemented:

- Deal version column
- expected version in edit form
- conditional Deal UPDATE
- explicit stale-edit conflict
- Stage transition version check
- version increment on edit/Stage/archive/restore

Manually tested:

- two-tab stale edit
- Kanban vs stale form
- normal sequential edit

Remaining:

- explicit archive/restore concurrency result policy
- automated integration regression tests

---

## F11 — archived Client relationship mutation

Status:

OPEN

Server-side lifecycle guard still required.

---

## F12 — unbounded loading

Status:

OPEN

Examples:

- all Deals for selected Kanban Pipeline
- Deal archive loading
- large form reference lists
- Company selectors

No measured production performance failure exists yet.

This is a scale limitation to address before datasets become large.

---

# Architectural debt

## Tenant context

The access path is improving:

session
→ verified User
→ active Organization
→ active Membership
→ Permissions

However current Organization selection remains fixed to the development
Organization.

Future multi-tenant switching requires a real active-Organization selection model.

---

## Business logic distribution

Important rules still exist across:

- pages
- Server Actions
- helpers

The first focused business module now exists:

src/modules/deals/transition-deal.ts

Direction:

continue extracting only genuinely shared business operations.

Do not introduce a generic repository framework.

---

## Database invariants

Application rules are still stronger than PostgreSQL constraints in several
areas.

Priority future constraints:

- Stage Organization + Pipeline
- Deal Organization + Pipeline + Stage
- Member + Role tenant consistency
- Client + Company tenant consistency
- Stage probability 0..100
- Stage type values
- amount/currency consistency
- default Pipeline uniqueness if confirmed as policy

---

## Role model

Remaining weaknesses:

- Owner identity still needs a stable system key
- last-Owner protection is not concurrency-safe
- ownership transfer policy is not finalized

---

# Testing

Implemented:

- Node test runner
- tsx devDependency
- `npm test` script
- email identity regression test

Still missing:

- database integration test environment
- cross-tenant regression tests
- inactive Organization automated test
- Deal conflict integration test
- impossible-date regression test
- archived relationship regression test
- RBAC regression suite
- E2E critical workflow suite

---

# CI

Not implemented.

Target:

npm ci
→ next typegen
→ TypeScript
→ lint
→ tests
→ build

CI must not use production secrets or production database.

---

# Operational gaps

Still not production-ready:

- real production email delivery
- invitation acceptance flow
- production password recovery verification
- CI
- test database/environment
- backup restore verification
- structured operational events
- production observability
- complete deployment/runbook documentation

---

# Current recommended direction

Do not start another large product module yet.

Next stabilization priorities:

1. finish Deal archive/restore conflict semantics
2. fix archived Client relationship mutation
3. fix strict calendar-date validation
4. define related-data permission policy
5. add regression tests and CI

After that:

Tasks
→ Collaborative Notes
→ Activity Timeline
→ Pipeline management
→ direct Deal contacts