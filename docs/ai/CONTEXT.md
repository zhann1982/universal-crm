# Universal CRM — Project Context

Last updated: 2026-09-27

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

- identity safety
- tenant access
- lifecycle rules
- concurrency
- permission semantics
- validation
- database integrity
- regression tests
- CI

After sufficient stabilization, the next major product module is:

Tasks

---

# Multi-tenancy

Organization is the tenant boundary.

Tenant-owned CRM data uses:

`organizationId`

Trusted Organization context must come from authenticated server state.

Current target security chain:

session
→ verified User
→ active Organization
→ active Membership
→ Permissions
→ business operation

Current development version still selects:

`slug = development`

Future Organization switching must validate active Membership server-side.

---

# Organization / Membership / Roles

Organization activity has security meaning.

`organizations.isActive = false`
→ CRM business access denied

Organization Member connects Better Auth User to Organization.

Inactive Membership denies normal CRM access.

A Member may have multiple Roles.

Current system concepts include:

- Owner
- Admin
- Manager
- Viewer

Owner security identity still needs a stable system identifier such as `systemKey`.

---

# Authentication / identity

Better Auth manages authentication identity and sessions.

Stable identity:

`user.id`

CRM Membership uses:

`organization_members.userId`

Email is used only for controlled discovery/invitation flows.

Current email lookup:

- trim
- lowercase
- exact equality
- no LIKE / ILIKE identity matching
- ambiguous canonical matches rejected

Normal CRM access requires:

`session.user.emailVerified = true`

Production email delivery and invitation acceptance are still incomplete.

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

Owner rule:

existing inactive owner
→ may remain unchanged

new owner
→ must be active

---

# Client ↔ Company

Many-to-many via:

`client_companies`

Archived Client relationship mutation is rejected server-side.

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

Database constraints still need stronger Organization/Pipeline/Stage consistency.

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

Different currencies remain separate in totals unless an explicit exchange-rate feature is introduced.

---

# Tasks

Not implemented.

Tasks remain the next major product module after stabilization.

Likely relationships:

- Deal
- Client
- Company
- responsible Member

Likely views:

- today
- overdue
- mine
- upcoming
- completed
- Deals without a next action

---

# Collaborative Notes / Activity

Current entity `notes` fields are descriptions only.

Future collaborative Notes are separate records.

Activity Timeline is also separate and should record structured business events such as:

- Deal created
- Stage changed
- Pipeline changed
- owner changed
- amount changed
- archive/restore
- Task created/completed
- Note created/edited/deleted

Activity is important for collaboration, debugging, analytics, automation and future AI summaries.

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

- F06 last-Owner concurrency and stable Owner identity
- F02 production invitation flow
- regression coverage
- CI
- stronger PostgreSQL invariants
- F12 unbounded loading / scaling

F05, F09 and F11 have been materially addressed in the current local code.
