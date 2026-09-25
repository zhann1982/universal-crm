# Universal CRM — Current Status

Last updated: 2026-09-25

## Current phase

CRM Core / v0.1

The first functional CRM module, Clients, is substantially implemented.

The project now also has working multi-tenant RBAC foundations and an initial
Team / role-management interface.

The next major objective is real authentication and authenticated member
resolution.

---

## Technology stack

- Next.js 16.3.6
- React 19
- TypeScript
- Tailwind CSS 4
- PostgreSQL
- Neon
- Drizzle ORM
- drizzle-kit
- Zod
- npm

Architecture:

- Next.js App Router
- Server Components by default
- Server Actions for application mutations
- modular monolith
- PostgreSQL as primary datastore
- multi-tenancy from the beginning
- RBAC from the beginning

No separate backend is currently used.

No Redis, queues, microservices or AI APIs are currently required.

---

## Repository

GitHub repository:

zhann1982/universal-crm

Repository visibility:

public

The project is tracked with Git.

Environment files such as `.env.local` are ignored and must never be committed.

Never commit database credentials or other secrets.

---

## Database

Neon PostgreSQL is connected and working.

Drizzle ORM is configured.

Initial migration has been generated and applied.

Drizzle migration tracking is active.

Current tables:

- organizations
- organization_members
- roles
- permissions
- role_permissions
- member_roles
- clients

No new database migration has been required for the recent Clients, RBAC and
Team UI work.

---

## Multi-tenancy

Multi-tenancy is a core architectural requirement.

Business records are scoped by:

organizationId

Current development organization:

development

Current organization resolution is temporary and server-side.

Browser forms must never be trusted to provide organizationId.

All business reads and mutations must remain scoped to the current organization.

Examples already implemented:

- client list
- client detail
- client editing
- client archiving
- client restoring
- role lookup
- member lookup
- team role management

---

## Development identity

Real authentication is not implemented yet.

Current development user:

local-dev-owner

Current development organization:

development

The development user is resolved through:

src/lib/auth/current-member.ts

The hardcoded development identity must remain isolated behind helper
functions and must not be spread throughout the application.

It will later be replaced by the authenticated user's real identity.

---

## Seed

Database seed works and is safe for repeated development use.

Development organization:

Development CRM

Development users:

- local-dev-owner
  - Development Owner
  - Owner role

- local-dev-manager
  - Development Manager
  - Manager role

- local-dev-viewer
  - Development Viewer
  - Viewer role

System roles:

- Owner
- Admin
- Manager
- Viewer

Initial permissions:

- clients.read
- clients.create
- clients.update
- clients.archive
- clients.delete
- members.read
- members.manage
- roles.read
- roles.manage
- settings.manage

Default role permissions:

Owner:

- all current permissions

Admin:

- all current permissions

Manager:

- clients.read
- clients.create
- clients.update
- clients.archive

Viewer:

- clients.read

---

## Authorization / RBAC

Server-side RBAC is implemented.

Main helpers:

src/lib/auth/current-member.ts

src/lib/auth/permissions.ts

Implemented concepts:

- current organization resolution
- current member resolution
- role lookup
- permission lookup
- permission Set generation
- hasPermission()
- requirePermission()

Permission denial redirects to:

/crm/forbidden

A dedicated 403 page exists.

Authorization is enforced on the server.

Client-side UI visibility is not treated as the security boundary.

---

## Client permission enforcement

Clients module now enforces permissions.

### clients.read

Required for:

- clients list
- client detail page

### clients.create

Required for:

- New Client page
- createClient Server Action

### clients.update

Required for:

- Edit Client page
- updateClient Server Action

### clients.archive

Required for:

- archiveClient Server Action
- restoreClient Server Action

UI buttons are also hidden when the current member does not have the required
permission.

Server Actions still enforce permissions independently.

---

## CRM application shell

Implemented:

- `/` redirects to `/crm`
- CRM layout
- sidebar navigation
- dashboard
- permission-aware navigation
- current member display in header
- CRM not-found page
- forbidden / 403 page

Current sidebar sections:

- Dashboard
- Clients
- Deals
- Tasks
- Team
- Settings

Deals, Tasks and Settings are not implemented yet.

Clients visibility depends on `clients.read`.

Team visibility depends on `members.read`.

---

## Database health

Database health endpoint works:

GET /api/health/db

Next.js can query Neon successfully through Drizzle.

This endpoint is currently for development diagnostics.

It should later be restricted or removed for production if unnecessary.

---

# Clients module

## Client list

Route:

/crm/clients

Implemented:

- organization-scoped query
- active clients view
- archived clients view
- server-side search
- status filtering
- URL-driven filter state
- server-side pagination
- 25 records per page
- total count query
- invalid page normalization
- pagination preserving filters
- links to client details

Displayed fields:

- name
- phone
- email
- status
- source
- created date

---

## Client search

Search runs on PostgreSQL through Drizzle.

Searchable fields:

- first name
- last name
- middle name
- phone
- email

Example:

/crm/clients?q=ivanov

Search is not implemented as browser-only filtering.

---

## Client status filters

Current statuses:

- active
- lead
- inactive

Example:

/crm/clients?status=lead

Status filters can be combined with search and archive view.

---

## Active / Archive views

Implemented:

Active:

isArchived = false

Archive:

isArchived = true

Example:

/crm/clients?view=archive

Normal client queries also exclude:

deletedAt IS NOT NULL

Physical deletion is not part of the normal client workflow.

---

## Pagination

Implemented server-side.

Page size:

25

Example:

/crm/clients?page=2

Pagination works with:

- q
- status
- view

Example:

/crm/clients?q=ivan&status=lead&view=archive&page=2

The application uses:

- COUNT
- LIMIT
- OFFSET

It does not load the complete client dataset into the browser.

---

## Client creation

Route:

/crm/clients/new

Implemented:

- client form
- Zod validation
- Server Action
- Drizzle INSERT
- Neon persistence
- permission enforcement
- server-side organization resolution
- form errors
- redirect after successful creation
- path revalidation

organizationId is resolved server-side.

It is never accepted from the client form as trusted input.

---

## Client detail

Route:

/crm/clients/[id]

Implemented:

- UUID validation
- tenant-scoped lookup
- clients.read enforcement
- status display
- archive state display
- contact information
- source
- notes
- created date
- updated date
- permission-aware action buttons

Invalid or inaccessible client records use notFound().

---

## Client editing

Route:

/crm/clients/[id]/edit

Implemented:

- existing values loaded into form
- Zod validation
- clients.update enforcement
- Server Action
- tenant-scoped UPDATE
- updatedAt update
- redirect after successful update
- route revalidation

Archived clients cannot be edited.

---

## Client archiving

Implemented.

Archive operation sets:

isArchived = true

Requirements enforced:

- valid client UUID
- current organization
- clients.archive permission
- client organization match
- currently not archived
- deletedAt IS NULL

Records are not physically deleted.

---

## Client restore

Implemented.

Restore operation sets:

isArchived = false

Requirements enforced:

- valid client UUID
- current organization
- clients.archive permission
- client organization match
- currently archived
- deletedAt IS NULL

Archived clients have a Restore action in their detail page when permitted.

---

# Team module

## Team page

Route:

/crm/team

Implemented.

The page displays organization members with:

- display name
- email
- userId
- status
- joined date
- assigned roles

The query is scoped to the current organization.

Access requires:

members.read

---

## Role management

Members can have multiple roles.

The Team page allows authorized users to assign one or more roles to another
member.

Role-management action requires:

members.manage

The action validates:

- member UUID
- role UUIDs
- member belongs to current organization
- every selected role belongs to current organization
- at least one role is selected

Current member cannot edit their own roles.

This restriction is temporary protection against locking the development owner
out of the CRM.

The current implementation replaces the selected member's role assignments with
the submitted role set.

---

## Current security properties

Implemented:

- tenant-scoped business queries
- tenant-scoped business mutations
- server-side input validation
- server-side permission enforcement
- permission-aware UI
- no browser-supplied trusted organizationId
- organization-scoped role validation
- organization-scoped member validation
- development identity isolated in auth helper
- environment secrets excluded from Git

---

## Known temporary limitations

### Authentication

Real authentication does not exist yet.

The application always resolves:

local-dev-owner

as the current development user.

The Manager and Viewer seed users exist in the database but are not real login
accounts yet.

---

### Organization selection

There is no real organization switcher.

The current organization is:

development

Real organization membership resolution must later derive the organization from
the authenticated user and selected organization.

---

### Role updates

Role replacement currently performs:

1. delete existing member roles
2. insert selected roles

This is not yet wrapped in a database transaction.

Before production-hardening role management, consider making this operation
atomic.

---

### Cross-tenant foreign-key consistency

The database contains organizationId on tenant-owned entities, but PostgreSQL
does not yet enforce every possible cross-tenant relationship at the composite
foreign-key level.

Application code must continue validating organization ownership.

---

### Client deletion

clients.delete exists as a permission but physical deletion is not implemented
in the ordinary UI.

Archive / restore is the preferred current lifecycle.

---

## Not implemented yet

### Authentication

- real user accounts
- login
- logout
- sessions
- authenticated current-user resolution
- password or external identity flow
- account recovery
- real organization selection

### Team

- invite member
- create member from UI
- deactivate member
- reactivate member
- member detail page
- custom role creation UI
- custom permission editing UI
- transactional role replacement

### Clients

- responsible employee selector
- client activity timeline
- comments
- duplicate detection
- bulk actions
- saved views
- custom fields

### CRM entities

- companies
- deals
- pipelines
- pipeline stages
- tasks
- activity timeline
- custom fields
- saved views
- automation engine
- audit log
- integrations
- AI assistant

---

## Current checkpoint

Clients currently support:

Create
→ Read
→ Update
→ Archive
→ Restore
→ Search
→ Filter
→ Paginate

Clients are protected by server-side RBAC.

Team currently supports:

Read members
→ View roles
→ Assign multiple roles

Team management is also protected by server-side RBAC.

The application now has a usable foundation for:

Multi-tenancy
+
RBAC
+
CRM data

The main missing identity layer is real authentication.

---

## Next planned development

1. Design the real authentication model.
2. Choose authentication implementation compatible with the current architecture.
3. Add login and logout.
4. Replace `local-dev-owner` with authenticated user resolution.
5. Resolve organization membership from the authenticated user.
6. Preserve the existing RBAC helpers on top of real authentication.
7. Test Owner / Admin / Manager / Viewer with real sessions.
8. Harden Team role updates.
9. Update AI documentation.
10. Begin Companies module.

---

## Important

Before significant implementation work, read:

1. AGENTS.md
2. docs/ai/CONTEXT.md
3. docs/ai/STATUS.md
4. docs/ai/NEXT.md
5. docs/ai/DECISIONS.md

Do not assume a feature is missing without checking STATUS.md and the current
repository.

Do not introduce unnecessary infrastructure.

Continue using organizationId as the tenant boundary.

Never weaken server-side permission enforcement when adding authentication.