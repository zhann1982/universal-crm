# Universal CRM — Current Status

Last updated: 2026-09-25

## Current phase

CRM Core / v0.1

The project is currently focused on completing the Clients module before
moving to Companies, Deals and other CRM entities.

## Completed

### Project foundation

- Next.js 16.3.6
- React
- TypeScript
- Tailwind CSS
- PostgreSQL
- Neon
- Drizzle ORM
- Zod
- drizzle-kit
- tsx
- dotenv
- npm

### Repository

GitHub repository:

zhann1982/universal-crm

Repository visibility:

public

The project is tracked with Git.

Environment files such as `.env.local` are ignored and must never be committed.

### Database

Neon PostgreSQL is connected successfully.

Drizzle ORM is configured.

Initial migration has been generated and applied.

Drizzle migration tracking is active.

Current database tables:

- organizations
- organization_members
- roles
- permissions
- role_permissions
- member_roles
- clients

### Seed

Database seed works.

The development seed creates:

- Development CRM organization
- local development owner
- Owner role
- Admin role
- Manager role
- Viewer role
- 10 initial permissions

Development organization slug:

development

Development userId:

local-dev-owner

These are temporary development assumptions only.

### Database health

Database health endpoint works:

GET /api/health/db

Next.js successfully queries Neon through Drizzle.

### CRM application shell

Implemented:

- / redirects to /crm
- CRM layout
- sidebar navigation
- dashboard
- clients navigation
- basic CRM not-found page

Dashboard reads live data from Neon.

### Clients list

Implemented:

/crm/clients

The list currently shows active non-deleted clients.

Displayed data includes:

- client name
- phone
- email
- status
- source
- created date

Client names link to the client detail page.

Client list queries are scoped by organizationId.

### Client creation

Implemented:

/crm/clients/new

Features:

- new client form
- Zod validation
- Server Action
- Drizzle INSERT
- Neon persistence
- server-side organization resolution
- form validation errors
- redirect after successful creation
- dashboard revalidation
- clients list revalidation

organizationId is never accepted from the browser form.

It is resolved on the server.

### Client detail page

Implemented:

/crm/clients/[id]

Features:

- UUID validation
- organization-scoped lookup
- client name
- status
- contact information
- source
- notes
- created date
- updated date
- archived state display

Invalid or inaccessible records use notFound().

Client lookups are scoped by:

- client id
- organizationId
- deletedAt IS NULL

### Client editing

Implemented:

/crm/clients/[id]/edit

Features:

- existing client data loaded into the form
- Zod validation
- Server Action
- Drizzle UPDATE
- updatedAt update
- redirect back to client page
- route revalidation

Updates are scoped by:

- client id
- organizationId
- isArchived = false
- deletedAt IS NULL

Archived clients cannot be edited through the edit page.

### Client archiving

Implemented.

Client records are not physically deleted.

Archiving sets:

isArchived = true

Archive operations are scoped by:

- client id
- organizationId
- isArchived = false
- deletedAt IS NULL

The active clients list excludes archived clients.

The dashboard counts only active clients.

## Multi-tenancy status

Multi-tenancy is already part of the database and query architecture.

Current development organization is resolved using:

development

Business queries must always be scoped by organizationId.

Never trust organizationId supplied from the browser.

Real organization membership resolution will replace the development helper
after authentication is implemented.

## Security status

Already implemented at architecture level:

- organization-scoped client reads
- organization-scoped client updates
- organization-scoped client archiving
- server-side validation
- no client-provided organizationId
- environment secrets excluded from Git

Not yet implemented:

- real authentication
- authorization enforcement
- permission checks
- organization switching
- production user resolution

## Current permissions model

Database permissions already include client operations such as:

- clients.read
- clients.create
- clients.update
- clients.archive
- clients.delete

Roles and permissions exist in the database.

They are not yet enforced by application actions.

## Not implemented yet

### Clients

- server-side search
- status filters
- archived clients view
- restore archived client
- pagination
- physical deletion policy
- responsible employee selection

### Security

- real authentication
- current authenticated user helper
- permission checking helper
- authorization enforcement
- organization membership checks based on authenticated users

### CRM modules

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

## Current checkpoint

The Clients module currently supports:

Create
→ Read
→ Update
→ Archive

All implemented business operations are persisted in Neon PostgreSQL and are
scoped to the current development organization.

The next objective is to complete client discovery and archive management.

## Next planned development

1. Add server-side client search.
2. Add client status filters.
3. Add Active / Archive view switching.
4. Add restore-from-archive functionality.
5. Add client pagination.
6. Add server-side permission helpers.
7. Enforce client permissions.
8. Start Companies module.

## Important

Before significant implementation work, read:

1. AGENTS.md
2. docs/ai/CONTEXT.md
3. docs/ai/STATUS.md
4. docs/ai/NEXT.md
5. docs/ai/DECISIONS.md