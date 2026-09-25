# Universal CRM — Current Status

Last updated: 2026-09-25

## Current phase

CRM Core / v0.1

The application now has working foundations for:

- multi-tenancy
- authentication
- organization membership
- RBAC
- Clients
- Team management

The current major authentication milestone is complete.

The next immediate work is to validate real RBAC identities, improve Team
membership management and then harden role management.

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
- Better Auth 1.7.x
- npm

Architecture:

- Next.js App Router
- Server Components by default
- Server Actions for application mutations
- modular monolith
- PostgreSQL primary datastore
- multi-tenancy
- Better Auth authentication
- server-side RBAC

No separate backend is currently used.

No Redis, queues, microservices or AI APIs are currently required.

---

# Authentication

Real authentication is implemented.

Authentication library:

Better Auth

Authentication method:

email + password

Implemented:

- Better Auth database schema
- Better Auth API route
- registration page
- login page
- logout
- session cookies
- server-side session lookup
- authenticated user ID
- mapping authenticated users to organization_members
- redirect unauthenticated users to /login
- redirect authenticated users without active membership to /no-access

Better Auth tables:

- user
- session
- account
- verification

Authentication schema:

src/db/auth-schema.ts

Authentication configuration:

src/lib/auth/auth.ts

Client auth helper:

src/lib/auth/auth-client.ts

Current-member resolver:

src/lib/auth/current-member.ts

Authentication API:

src/app/api/auth/[...all]/route.ts

---

## Authentication security path

Current request path:

Better Auth session
→ session.user.id
→ organization_members.userId
→ active member
→ roles
→ permissions
→ CRM

The previous hardcoded runtime identity:

local-dev-owner

is no longer used by getCurrentMember().

Legacy development records may remain in the database for development purposes.

They must not be used as production identity.

---

# Database

Neon PostgreSQL is connected and working.

Drizzle ORM is configured with both:

- src/db/schema.ts
- src/db/auth-schema.ts

Applied CRM tables:

- organizations
- organization_members
- roles
- permissions
- role_permissions
- member_roles
- clients

Applied Better Auth tables:

- user
- session
- account
- verification

Better Auth migration has been generated and applied successfully.

Current database table count:

11

---

# Multi-tenancy

Multi-tenancy remains a core requirement.

Business records are scoped by:

organizationId

Current organization:

development

Current organization resolution is still temporary and server-side through:

src/lib/current-organization.ts

The browser must never be trusted to provide organizationId as authorization
proof.

A multi-organization selector is not yet implemented.

---

# Organization membership

Authenticated Better Auth users are mapped to CRM memberships through:

organization_members.userId

The value is the stable Better Auth:

user.id

Email is not used as the long-term authorization identity.

Only active organization members may enter the CRM.

An authenticated user without a valid active membership is redirected to:

/no-access

A development helper exists for connecting an existing Better Auth account to
the development organization as Owner:

npm run db:link-owner -- email@example.com

---

# RBAC

Server-side RBAC is implemented.

Main helpers:

src/lib/auth/current-member.ts

src/lib/auth/permissions.ts

Implemented functions:

- getCurrentMember()
- getCurrentAccessContext()
- hasPermission()
- requirePermission()

Permission failure redirects to:

/crm/forbidden

Authorization remains server-side.

UI visibility is only a UX layer and is not treated as the security boundary.

---

# Current roles

System roles:

- Owner
- Admin
- Manager
- Viewer

Current permissions:

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

Owner:

all current permissions

Admin:

all current permissions

Manager:

- clients.read
- clients.create
- clients.update
- clients.archive

Viewer:

- clients.read

Members may have multiple roles.

---

# CRM shell

Implemented:

- /
- /register
- /login
- /auth-test
- /no-access
- /crm
- /crm/forbidden
- permission-aware CRM navigation
- authenticated member display

CRM sidebar sections:

- Dashboard
- Clients
- Deals
- Tasks
- Team
- Settings

Deals, Tasks and Settings are placeholders.

Clients visibility depends on:

clients.read

Team visibility depends on:

members.read

---

# Clients module

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
- permission enforcement

Search fields:

- first name
- last name
- middle name
- phone
- email

Current client statuses:

- active
- lead
- inactive

Pagination:

25 records per page

Pagination uses:

- COUNT
- LIMIT
- OFFSET

Current client permission model:

clients.read:
- list
- detail

clients.create:
- create page
- create Server Action

clients.update:
- edit page
- update Server Action

clients.archive:
- archive
- restore

clients.delete exists but physical deletion is not part of the current normal
workflow.

---

# Team module

Route:

/crm/team

Implemented stable functionality:

- list organization members
- show display name
- show email
- show userId
- show status
- show joined date
- show assigned roles
- multiple role assignments
- update another member's roles
- members.read enforcement
- members.manage enforcement
- organization-scoped member validation
- organization-scoped role validation

Current user cannot edit their own roles.

This prevents accidental administrative lockout.

The role replacement flow currently performs:

DELETE existing member roles
→ INSERT submitted roles

It is not yet transactional.

---

# Development users

Historical seed records:

local-dev-owner
→ Owner

local-dev-manager
→ Manager

local-dev-viewer
→ Viewer

These records are development fixtures.

They are not Better Auth login accounts.

Real RBAC testing should increasingly use Better Auth accounts connected to
organization_members.

---

# Security properties already implemented

- Better Auth sessions
- server-side session resolution
- tenant-scoped business queries
- tenant-scoped business mutations
- server-side Zod validation
- server-side permission enforcement
- permission-aware UI
- stable authenticated user IDs
- active membership requirement
- organization-scoped role validation
- organization-scoped member validation
- secrets excluded from Git
- browser organizationId is not trusted

---

# Known temporary limitations

## Organization selection

There is still no active organization selector.

The current organization is resolved as:

development

Future authenticated users may belong to multiple organizations.

The organization selector must validate membership server-side.

---

## Team membership workflow

The full production invitation lifecycle is not implemented yet.

Missing or still being developed:

- invitation emails
- pending invitations
- accept invitation
- deactivate member
- reactivate member
- member detail
- custom role creation UI
- role permission editing UI

A simple workflow for adding already-registered users is the current next Team
improvement.

---

## Role updates

Role replacement is not transactional yet.

A failure between DELETE and INSERT could leave a member without roles.

This must be hardened before production use.

---

## Cross-tenant database consistency

Application code validates tenant ownership.

PostgreSQL does not yet enforce every possible cross-tenant relationship with
composite foreign keys.

Application-level organization validation must remain mandatory.

---

## Account lifecycle

Not implemented:

- email verification workflow
- forgot password
- password reset email
- account lockout policy
- production email provider
- external identity providers

These are not required for the current local CRM milestone but are required
before a production launch with public users.

---

# Not implemented yet

CRM entities:

- companies
- deals
- pipelines
- pipeline stages
- tasks
- comments
- activity timeline
- custom fields
- saved views
- automation engine
- audit log
- integrations
- AI assistant

Client improvements:

- responsible employee selector
- activity timeline
- comments
- duplicate detection
- bulk actions
- saved views
- custom fields

Team improvements:

- production invitation lifecycle
- deactivate/reactivate
- member detail
- custom roles
- custom permission editor
- transactional role replacement

---

# Current checkpoint

Authentication:

Register
→ Login
→ Session
→ Better Auth user
→ Organization membership
→ RBAC
→ CRM

Clients:

Create
→ Read
→ Update
→ Archive
→ Restore
→ Search
→ Filter
→ Paginate

Team:

Read members
→ View roles
→ Assign roles

The project now has a functional identity and authorization chain rather than a
hardcoded runtime user.

---

# Next planned development

1. Add convenient logout directly to CRM shell.
2. Add already-registered Better Auth users to an organization from Team.
3. Create real Manager and Viewer Better Auth test accounts.
4. Verify RBAC with real sessions.
5. Remove dependence on legacy development-member fixtures.
6. Make member role replacement atomic.
7. Add member activation/deactivation.
8. Review active-organization strategy.
9. Update AI documentation after Team hardening.
10. Begin Companies module.

---

# Important

Before significant implementation work, read:

1. AGENTS.md
2. docs/ai/CONTEXT.md
3. docs/ai/STATUS.md
4. docs/ai/NEXT.md
5. docs/ai/DECISIONS.md

Continue using organizationId as the tenant boundary.

Do not weaken server-side permission enforcement.

Do not introduce unnecessary infrastructure.

Do not reintroduce hardcoded development identities into authentication.