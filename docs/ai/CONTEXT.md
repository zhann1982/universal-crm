# Universal CRM — Project Context

Last updated: 2026-10-03

## Goal

Universal CRM is an industry-neutral configurable multi-tenant CRM platform.

Long-term configurable areas:

- business processes
- Pipelines
- Stages
- custom fields
- Roles
- Permissions
- saved views
- workflows
- automations

Industry-specific behavior should come primarily from configuration rather than separate application forks.

---

# Product boundary

The application is a modular monolith.

Frontend, server authorization and business logic live in the same Next.js application.

Stack:

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

Not currently required:

- separate backend
- Redis
- queue
- message broker
- microservices
- vector database
- dedicated AI backend

---

# Current phase

CRM Core / early v0.2

Current development phase:

STABILIZATION BEFORE MORE LARGE FEATURES

The major CRM foundation already exists.

Current stabilization focus:

- regression coverage
- related-data visibility
- Deal conflict verification
- PostgreSQL invariants
- F12 scaling
- CI database isolation
- production invitation delivery/admin UX

Tasks and Task Activity Stage 2 are implemented. Current work stabilizes their access and persistence.
The user confirmed multiple independent companies as the target deployment model.

---

# Multi-tenancy

Organization is the tenant boundary.

Tenant-owned CRM data uses:

`organizationId`

Trusted Organization context must come from authenticated server state.

Current security chain:

session
→ verified User
→ active Organization
→ active Membership
→ Permissions
→ business operation

Organization selection is implemented (D050). A cookie stores a preference only;
each request validates the Organization and the authenticated user's active Membership.
One membership without a saved preference opens directly; multiple memberships require `/organizations`.
An invalid selection never silently falls back to another tenant.

All CRM writes must include the rendered organization scope and use `requireMutationPermission`.
Forms use `OrganizationForm`; imperative actions use `useOrganizationId`.
The server compares this untrusted scope against its authorized selection before any mutation.
Organization provisioning is implemented (D051): any verified User can create an Organization
through `/organizations/new`, becoming its initial Owner. Atomic provisioning supplies four
system Roles, Permission bindings and a default Pipeline with six Stages. A per-user request UUID
makes form retries idempotent. Colleagues still join through verified one-time invitations.

Shared tenant-access module:

`src/modules/access/tenant-access.ts`

PostgreSQL regression coverage verifies inactive Organization and inactive Membership denial.

---

# Organization / Membership / Roles

Organization activity has security meaning.

`organizations.isActive = false`
→ CRM business access denied

Organization Member connects Better Auth User to Organization.

Inactive Membership denies normal CRM access.

A Member may have multiple Roles.

Current system Role concepts include:

- Owner
- Admin
- Manager
- Viewer

Stable machine identity uses:

`roles.systemKey`

Owner uses:

`systemKey = "owner"`

System Role display names are not authorization identity.

Last active Owner protection is concurrency-safe through:

`src/modules/members/owner-guard.ts`

It uses an Organization-scoped PostgreSQL transaction advisory lock.

---

# Authentication / identity

Better Auth manages authentication identity and sessions.

Stable identity:

`user.id`

CRM Membership uses:

`organization_members.userId`

Normal CRM access requires:

`session.user.emailVerified = true`

Current email identity lookup:

- trim
- lowercase
- exact equality
- no LIKE / ILIKE identity matching
- ambiguous canonical matches rejected

---

# Organization invitations

Decision `D047` is implemented for the core authorization flow.

Membership onboarding for colleagues uses a verified one-time invitation; the initial creator
becomes Owner through the atomic Organization provisioning operation (D051).

Invitation stores/binds:

- Organization
- canonical intended email
- one Role in the current UX
- SHA-256 token hash
- expiration
- inviter
- accepted/revoked lifecycle

Membership does not exist before successful acceptance.

Acceptance requires:

authenticated Better Auth User
→ verified email
→ exact canonical identity match
→ active Organization
→ valid same-Organization Role
→ no existing Membership
→ atomic Membership + Role creation
→ invitation accepted

Creation and acceptance use focused PostgreSQL transaction/advisory-lock protection.

Current remaining invitation work:

- production email provider
- real URL delivery
- pending invitation administration
- revoke/resend/reissue UX

These are product/operations follow-ups, not the original authorization defect.

---

# Permissions

Current Permission groups include:

- `clients.*`
- `companies.*`
- `deals.*`
- `pipelines.*`
- `members.*`
- `roles.*`
- `settings.manage`

Authorization is enforced server-side.

A relationship UUID is never authorization proof.

---

# Related-data policy

Decision `D045` is implemented.

Responsible Member assignment:

with `members.read`
→ any active Organization Member

without `members.read`
→ self or no owner

Existing responsible Member may remain unchanged even if inactive.

Normal assignment/reference DTOs do not include Member email.

Responsible Member display:

- `members.read` → real display name
- self → own display name
- another hidden Member → `Сотрудник`

Related entity display requires the target module read permission.

Examples:

- Company information in Deal views requires `companies.read`
- linked Client information in Company views requires `clients.read`
- Dashboard module counts require that module `.read`

Shared owner-assignment code:

- `src/modules/members/owner-assignment-policy.ts`
- `src/modules/members/owner-assignment.ts`

The first module owns the permission policy.

The second adds same-tenant and active-Membership validation.

---

# Existing inactive owner semantics

Decision `D042` is implemented and PostgreSQL regression-tested.

existing inactive owner
→ may remain unchanged

new inactive owner
→ rejected

new owner from another Organization
→ rejected

new active owner from same Organization
→ allowed when Permission policy permits

clear owner
→ allowed

Company and Deal use the same shared owner-assignment resolver.

---

# Client

Client is a person/contact.

Lifecycle:

active
→ archived
→ restored

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

# Company

Company is a business/legal organization separate from Client.

Implemented:

- create
- list
- detail
- edit
- archive
- restore
- responsible Member
- linked Clients
- search
- filters
- pagination
- tenant scoping
- RBAC

Responsible Member changes use:

`src/modules/members/owner-assignment.ts`

---

# Client ↔ Company

Many-to-many via:

`client_companies`

Shared mutation module:

`src/modules/clients/client-company-relation.ts`

Archived Client relationship mutation is rejected server-side.

Cross-tenant link/unlink attempts are rejected.

This applies to direct Server Action calls, not only the visible UI.

---

# Pipeline / Stage

Pipeline is a configurable process.

Pipeline Stage has:

- name
- position
- type
- probability
- optional color

Stage types:

- open
- won
- lost

Pipeline/Stage management UI is not yet implemented.

Migration 0013 adds composite Organization/Pipeline/Stage foreign keys and Stage type/probability
checks. The migration is verified in isolated PGlite PostgreSQL and was applied to the connected
Neon database on 2026-10-03 together with the previously missing Organization provisioning migration 0012.

---

# Deal

Deal belongs to:

- Organization
- Pipeline
- Stage

Deal may reference:

- Company
- responsible Member

Deal data includes:

- title
- amount
- currency
- expectedCloseAt
- closedAt
- notes/description
- archive state
- version
- timestamps

Deal state derives from Stage type.

Responsible Member changes use the same owner-assignment resolver as Company.

---

# Deal transition

Shared business operation:

`src/modules/deals/transition-deal.ts`

Used by manual Stage movement and Kanban.

Responsibilities:

- Deal validation
- tenant validation
- active lifecycle
- current Pipeline
- target Stage
- Stage type
- closedAt
- optimistic concurrency

Future API/automation/AI Stage movement must reuse the same operation or a deliberate successor.

---

# Deal optimistic locking

Deal has:

`version integer not null default 1`

Real Deal mutations increment version.

Current examples:

- full edit
- Stage transition
- archive
- restore

Stale edit paths are rejected rather than silently overwriting newer data.

Current application-level protection is implemented.

More PostgreSQL/browser conflict coverage remains valuable. Composite database constraints protect
Deal Organization/Pipeline/Stage, Company and owner identity independently of application checks.

---

# Deal expected close date

Decision `D044` is implemented.

`expectedCloseAt` is a calendar date, not a timestamp.

Storage:

PostgreSQL `date`

Application:

`YYYY-MM-DD`

Strict validation rejects impossible dates and avoids timezone conversion.

---

# Money

Deal amount uses:

PostgreSQL `numeric(14,2)`

Currency is separate.

Migration 0013 enforces non-negative finite amounts and uppercase three-letter currency codes.
A non-null amount requires currency; amount may be absent with a valid currency, matching the form.

Different currencies remain separate in totals unless an explicit exchange-rate feature is introduced.

---

# Testing state

Earlier stabilization verification baseline (see STATUS.md for the current branch):

- 37 unit/regression tests
- 23 PostgreSQL integration tests
- TypeScript passed
- ESLint passed
- production build passed

Integration coverage includes:

- last-Owner concurrency
- invitation concurrency
- inactive Organization/Membership access
- Client ↔ Company lifecycle
- cross-tenant boundaries
- owner-assignment active/inactive Membership behavior

GitHub Actions runs the non-database verification suite.

Integration tests remain local until a dedicated non-production PostgreSQL CI environment exists.

---

# Tasks

Implemented: lifecycle and optimistic versions, owner assignment, Client/Company/Deal links,
filters and pagination, bulk actions, reminders and recurring schedules.
Task, schedule and event writes share one atomic SQL statement. Completion includes the next recurrence.
Lifecycle and reminder writes also persist their events atomically. Bulk actions are atomic per Task.

---

# Collaborative Comments / Activity

Entity description fields remain separate from collaborative comments.
Comments and activity tables exist. Task detail renders the timeline; Stage 2 records task changes.
Task event logging is atomic with its mutation; many changes still lack structured old/new values.

Activity permission does not grant comment content access. Timeline queries must enforce
both entity access and the content permission. Member directory data needs `members.read`.
All comment writes lock a writable tenant parent inside the mutation statement (D053).
Create/edit use `save-comment.ts`; archive/restore reuse the same parent-lock SQL helper.
Comment and Activity event commit atomically. Editing rechecks version, parent identity, archive/deletion
and authorship/manage permission in SQL. Earlier parent reads provide UX messages only.
Isolated PostgreSQL tests cover rollback and denied writes for all four entity types;
live multi-session and browser verification remain open.

---

# AI direction

AI is intentionally later.

Start with read-oriented capabilities:

- Deal summary
- Client summary
- Company summary
- permission-aware search
- recommended next action

AI must use the same business operations and authorization path as the normal UI.

AI must never receive unrestricted database access.

---

# Current remaining stabilization gaps

Major remaining areas:

- related-data visibility regression tests
- Deal optimistic-conflict PostgreSQL/browser verification
- remaining PostgreSQL invariants for Task/Comment/Activity references; verify 0013 in other deployment environments
- F12 unbounded loading / scaling
- dedicated CI PostgreSQL strategy
- production invitation email delivery/admin UX

F01–F11 are materially addressed at their documented current scope.

F12 remains open.

## Core database integrity (D052)

The schema includes composite foreign keys for core Stage/Deal relationships, Client/Company links,
nullable responsible Members, and Member/Role assignments. Assignment writers now include the
server-derived `member_roles.organizationId`. Existing inactive owners remain valid references;
deleting an owner or Deal Company retains SET NULL behavior through existing single-column FKs.

`npm run db:audit-integrity` checks existing data without returning personal records or modifying rows.
Migration 0013 backfills assignment scope from Membership before enabling constraints. It fails
transactionally on invalid legacy relationships; repairs must be reviewed explicitly.
Default Pipeline uniqueness has not been introduced without a confirmed product rule.
