# Universal CRM — Current Status

Last updated: 2026-09-25

## Current phase

CRM Core / early v0.2

Phase 0.1 foundations are substantially implemented.

Phase 0.2 is now active.

Current functional chain:

Better Auth
→ Organization membership
→ RBAC
→ Clients
→ Companies
→ Client / Company relationships
→ Pipelines
→ Pipeline stages
→ Deals
→ Kanban

---

## Technology

Current stack:

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

Architecture:

- Next.js App Router
- modular monolith
- Server Components by default
- Server Actions for mutations
- PostgreSQL primary datastore
- server-side authentication
- server-side RBAC
- tenant-scoped business operations

No separate backend is currently used.

No Redis, queues, microservices or AI APIs are currently required.

---

# Authentication

Real authentication is implemented with Better Auth.

Method:

email + password

Implemented:

- registration
- login
- logout
- session cookies
- server-side session lookup
- authenticated user identity
- organization membership mapping
- no-access handling
- protected CRM access

Main files:

src/lib/auth/auth.ts

src/lib/auth/auth-client.ts

src/lib/auth/current-member.ts

src/app/api/auth/[...all]/route.ts

Better Auth tables:

- user
- session
- account
- verification

Authenticated Better Auth user ID maps to:

organization_members.userId

Email is not the authorization identity.

---

# Authorization / RBAC

Server-side RBAC is implemented.

Main helpers:

src/lib/auth/current-member.ts

src/lib/auth/permissions.ts

Functions:

- getCurrentMember()
- getCurrentAccessContext()
- hasPermission()
- requirePermission()

Permission failure:

/crm/forbidden

Authenticated user without active membership:

/no-access

UI permission checks are not the security boundary.

Server Actions and server-side reads enforce permissions independently.

---

# Current permissions

Clients:

- clients.read
- clients.create
- clients.update
- clients.archive
- clients.delete

Companies:

- companies.read
- companies.create
- companies.update
- companies.archive
- companies.delete

Deals:

- deals.read
- deals.create
- deals.update
- deals.archive
- deals.delete

Pipelines:

- pipelines.read
- pipelines.manage

Team:

- members.read
- members.manage

Roles:

- roles.read
- roles.manage

Settings:

- settings.manage

---

# Current roles

Owner:

all permissions

Admin:

all permissions

Manager:

- clients.read
- clients.create
- clients.update
- clients.archive
- companies.read
- companies.create
- companies.update
- companies.archive
- deals.read
- deals.create
- deals.update
- deals.archive
- pipelines.read

Viewer:

- clients.read
- companies.read
- deals.read
- pipelines.read

Members may have multiple roles.

---

# Database

Neon PostgreSQL is connected and working.

Drizzle uses:

src/db/schema.ts

and:

src/db/auth-schema.ts

Current table count:

16

CRM tables:

- organizations
- organization_members
- roles
- permissions
- role_permissions
- member_roles
- clients
- companies
- client_companies
- pipelines
- pipeline_stages
- deals

Auth tables:

- user
- session
- account
- verification

Current migrations include the CRM core, Better Auth, Companies,
Client ↔ Company relationships and Deals/Pipelines foundations.

---

# Multi-tenancy

Primary tenant boundary:

organizationId

Current development organization:

development

Current organization selection is still server-side and fixed through:

src/lib/current-organization.ts

The browser is never trusted to establish organization access.

A real multi-organization selector is not implemented yet.

---

# Team

Route:

/crm/team

Implemented:

- organization member list
- add already-registered Better Auth user by email
- stable Better Auth user ID stored as member identity
- initial role assignment
- multiple roles per member
- role replacement
- member activation
- member deactivation
- current-user self-role protection
- current-user self-deactivation protection
- last active Owner protection
- tenant-scoped member validation
- tenant-scoped role validation
- RBAC enforcement

Role/status management requires:

members.manage

Listing requires:

members.read

Role replacement uses:

db.batch([...])

The current Neon HTTP path does not use ordinary interactive transactions.

The last-owner rule is enforced at application level.

Because the pre-check and write are separate operations, the invariant is not
fully serialized against concurrent administrative writes.

---

# Clients

Route:

/crm/clients

Implemented:

- create
- list
- detail
- edit
- archive
- restore
- search
- status filter
- active/archive views
- URL-driven filters
- server-side pagination
- tenant scoping
- RBAC
- Client ↔ Company management

Current statuses:

- active
- lead
- inactive

Pagination:

25 records per page

Normal physical deletion is not used.

---

# Companies

Route:

/crm/companies

Implemented:

- create
- list
- detail
- edit
- archive
- restore
- quick archive from list
- quick restore from archive list
- search
- status filter
- active/archive views
- server-side pagination
- responsible member
- tax ID
- tenant scoping
- RBAC
- linked Clients display

Current statuses:

- active
- prospect
- inactive

Tax ID is unique per organization when non-null.

Normal physical deletion is not used.

---

# Client ↔ Company

Join table:

client_companies

Relationship:

many-to-many

Implemented:

Client detail:
- show linked Companies
- add Company relationship
- remove relationship

Company detail:
- show linked Clients
- navigate to linked Client

All relationship operations are tenant-scoped.

A relationship deletion does not delete either business entity.

---

# Pipelines

Tables:

pipelines

pipeline_stages

Seed currently creates:

Основная воронка

Stages:

1. Новая
2. Квалификация
3. Предложение
4. Переговоры
5. Выиграна
6. Проиграна

Stage types:

- open
- won
- lost

Stages also contain:

- position
- probability
- optional color

A pipeline management UI is not implemented yet.

---

# Deals

Route:

/crm/deals

Implemented:

- permission-aware navigation
- pipeline selection
- Kanban stage columns
- Deal counts
- stage Deal counts
- stage monetary summaries
- company display
- responsible member display
- expected close date display
- Deal creation
- server-side Deal validation
- Deal detail page
- manual Deal stage transitions
- tenant scoping
- RBAC

Creation route:

/crm/deals/new

Detail route:

/crm/deals/[id]

Creation validates server-side:

- organization
- pipeline
- stage belongs to pipeline
- company belongs to organization
- owner belongs to organization
- owner is active

---

## Deal state model

Deal state is derived from:

pipeline_stages.type

No independent:

deal.status

field is used for won/lost state.

Stage types:

open
won
lost

When moving to:

won
or
lost

closedAt is set.

When returning to:

open

closedAt is cleared.

---

## Deal money

Amount:

numeric(14,2)

Currency:

three-letter string such as KZT / USD / EUR.

Drizzle returns numeric values as strings.

Persistent monetary values remain PostgreSQL numeric.

---

# CRM navigation

Current working sections:

- Dashboard
- Clients
- Companies
- Deals
- Team

Still placeholder / unfinished:

- Tasks
- Settings

Visibility is permission-aware.

---

# Security properties implemented

- Better Auth sessions
- stable authenticated user IDs
- active membership requirement
- tenant-scoped reads
- tenant-scoped mutations
- server-side Zod validation
- server-side permission enforcement
- permission-aware UI
- tenant-scoped relationship validation
- Client ↔ Company validation
- Deal → Pipeline validation
- Deal → Stage validation
- Deal → Company validation
- Deal → Member validation
- secrets excluded from Git
- browser organizationId is not trusted

---

# Known limitations

## Active organization

The active organization is still fixed to:

development

A membership-validated organization selector is still required for true
multi-organization UX.

---

## Team concurrency

The last-active-Owner rule is implemented as an application-level pre-check.

It is not yet protected by a serialized transaction or database invariant.

Concurrent administrator writes remain a future hardening concern.

---

## Role identity

Some Owner-specific protection still identifies the Owner role by:

roles.name = "Owner"

A stable role key/system identifier would be more robust.

---

## Companies

Company edit currently expects the selected responsible member to be active.

If a Company's current owner later becomes inactive, editing unrelated fields may
require changing or clearing that owner.

This can be improved later.

---

## Cross-tenant database constraints

Application code validates tenant ownership.

PostgreSQL does not yet enforce every cross-tenant relationship with composite
foreign keys.

Server-side organization validation remains mandatory.

---

## Deals

Not yet implemented:

- full Deal editing
- Deal archive / restore UI
- Deal hard-delete policy
- Kanban drag-and-drop
- change pipeline from Deal edit
- pipeline management UI
- stage management UI
- Deal ↔ Client direct relationship
- activity history for stage changes

---

## Authentication production gaps

Current auth is suitable for development, but public production launch still
requires review of:

- email verification
- forgot password
- password reset
- production email delivery
- rate limiting / brute-force protection
- account recovery
- production URL/cookie configuration
- HTTPS
- production secret management

---

# Not implemented yet

Phase 0.2 remaining:

- Tasks
- Comments
- Activity timeline

Phase 0.3:

- custom fields
- advanced filters
- saved views
- configurable business fields

Phase 0.4:

- automation engine
- triggers
- conditions
- actions

Later:

- audit log
- external integrations
- AI assistant

---

# Current checkpoint

Authentication:

Register
→ Login
→ Session
→ Better Auth user
→ Organization member
→ RBAC
→ CRM

Client:

Create
→ Read
→ Update
→ Archive
→ Restore
→ Search
→ Filter
→ Company relationships

Company:

Create
→ Read
→ Update
→ Archive
→ Restore
→ Search
→ Filter
→ Client relationships

Deal:

Pipeline
→ Stage
→ Create Deal
→ Kanban
→ Deal detail
→ Move between stages
→ close/reopen state derived from stage type

The project is now beyond a CRUD-only CRM foundation and has the first working
business process model.

---

# Immediate next development

Primary next step:

Deal editing

Target fields:

- title
- pipeline
- stage
- amount
- currency
- company
- responsible member
- expected close date
- notes

After Deal editing:

1. Deal archive / restore
2. Drag-and-drop Kanban
3. Pipeline / stage management UI
4. Tasks
5. Comments
6. Activity timeline

---

# Important

Before significant implementation work, read:

1. AGENTS.md
2. docs/ai/CONTEXT.md
3. docs/ai/STATUS.md
4. docs/ai/NEXT.md
5. docs/ai/DECISIONS.md

Continue using organizationId as the tenant boundary.

Do not weaken server-side authorization.

Do not trust browser relationship IDs without server-side validation.

Do not introduce unnecessary infrastructure.

Do not add AI before the CRM core is stable.