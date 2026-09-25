# AGENTS.md

## Project

Universal CRM is a configurable multi-tenant CRM platform.

Administrators should eventually be able to configure:

- business processes
- pipelines
- stages
- fields
- roles
- permissions
- workflows
- automations

AI features will be added only after the CRM core is stable.

## Current stack

- Next.js 16.3.6
- React 19
- TypeScript
- Tailwind CSS 4
- PostgreSQL
- Neon
- Drizzle ORM
- drizzle-kit
- Zod
- Better Auth
- npm

## Architecture

The application is a modular monolith built with Next.js App Router.

Use:

- Server Components by default
- Server Actions for normal CRM mutations
- PostgreSQL as the primary datastore
- server-side authorization
- organization-scoped business queries

Do not introduce additional infrastructure without a concrete need.

Avoid adding:

- Redis
- queues
- microservices
- separate backend services
- paid infrastructure
- AI APIs

while the CRM core is still developing.

Development infrastructure should remain at or close to $0.

## Multi-tenancy

Multi-tenancy is a core architectural requirement.

Business entities must belong to an organization.

Never expose records from one organization to another.

Tenant-owned reads and writes must normally be scoped by:

organizationId

Never trust organizationId supplied by the browser as authorization proof.

The current development organization is still resolved through:

src/lib/current-organization.ts

Current organization slug:

development

A real organization selector is not implemented yet.

## Database

Database:

PostgreSQL on Neon.

ORM:

Drizzle ORM.

CRM schema:

src/db/schema.ts

Authentication schema:

src/db/auth-schema.ts

Database connection:

src/db/index.ts

Migrations:

drizzle/

Never manually modify an already-applied migration unless there is a very
specific reason.

Create new schema changes through Drizzle migrations.

Current main tables:

CRM:

- organizations
- organization_members
- roles
- permissions
- role_permissions
- member_roles
- clients

Better Auth:

- user
- session
- account
- verification

## Authentication

Real authentication is implemented with Better Auth.

Current authentication method:

email + password

Main files:

src/lib/auth/auth.ts

src/lib/auth/auth-client.ts

src/lib/auth/current-member.ts

src/app/api/auth/[...all]/route.ts

Routes include:

- /register
- /login
- /auth-test

Better Auth provides the authenticated user identity.

The stable Better Auth user ID is stored in:

organization_members.userId

Do not use email as the authorization identity.

Do not spread direct session parsing throughout the application.

Prefer centralized server helpers.

## Authentication and authorization separation

Authentication answers:

Who is the user?

Authorization answers:

What may the user do?

These responsibilities must remain separate.

Authentication is provided by Better Auth.

Authorization is provided by organization membership, roles and permissions.

Current request security flow:

Better Auth session
→ authenticated user
→ organization_members
→ member_roles
→ roles
→ role_permissions
→ permissions
→ CRM access

## Authorization / RBAC

Authorization must be enforced on the server.

Do not trust client-side role or permission checks as security controls.

Main access helpers:

src/lib/auth/current-member.ts

src/lib/auth/permissions.ts

Important functions:

- getCurrentMember()
- getCurrentAccessContext()
- hasPermission()
- requirePermission()

Permission denial currently redirects to:

/crm/forbidden

Authenticated users without an active CRM membership redirect to:

/no-access

## Security

Never commit:

- .env
- .env.local
- DATABASE_URL
- BETTER_AUTH_SECRET
- passwords
- tokens
- API keys
- private credentials

If a secret is accidentally committed, rotate it.

Do not assume deleting it from a later commit makes the secret safe.

## Validation

Validate external input with Zod before database mutations.

Examples:

- forms
- identifiers
- route parameters
- search parameters
- role selections
- future API payloads

## Current permissions

Current permission keys:

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

## Current roles

Current system roles:

Owner

Admin

Manager

Viewer

Owner and Admin currently have all defined permissions.

Manager currently has:

- clients.read
- clients.create
- clients.update
- clients.archive

Viewer currently has:

- clients.read

Members can have multiple roles.

## Clients

The Clients module currently supports:

- create
- read
- update
- archive
- restore
- search
- status filtering
- active/archive views
- server-side pagination
- RBAC
- tenant scoping

Physical deletion is not part of the normal client workflow.

Archive / restore is currently preferred.

## Team

The Team module currently supports:

- organization member listing
- assigned role display
- multiple roles per member
- role assignment
- server-side permission checks

Role management requires:

members.manage

The current user cannot edit their own roles.

Current role replacement is not yet transactional.

## Development identity

The old development records may still exist:

- local-dev-owner
- local-dev-manager
- local-dev-viewer

They are legacy development records.

They are not the current authentication mechanism.

Do not reintroduce literal development IDs into request authentication.

## Development commands

Start development server:

npm run dev

Generate migration:

npm run db:generate

Apply migrations:

npm run db:migrate

Seed database:

npm run db:seed

Link a Better Auth user to the development organization as Owner:

npm run db:link-owner -- email@example.com

Build:

npm run build

Lint:

npm run lint

## Coding approach

Prefer:

- simple architecture
- Server Components by default
- server-side database access
- Server Actions
- TypeScript strictness
- small reusable components
- explicit validation
- explicit permission checks
- clear database constraints

Avoid premature abstraction.

Do not add a dependency when the current stack reasonably solves the problem.

## AI context protocol

Before significant work, read in this order:

1. AGENTS.md
2. docs/ai/CONTEXT.md
3. docs/ai/STATUS.md
4. docs/ai/NEXT.md
5. docs/ai/DECISIONS.md

After significant development work:

- update docs/ai/STATUS.md
- update docs/ai/NEXT.md
- update docs/ai/DECISIONS.md only when an architectural or product decision changes

Keep these files concise.

Do not turn them into session transcripts.

## Main product roadmap

Phase 0.1:

- organizations
- authentication
- users/members
- roles and permissions
- clients
- companies

Phase 0.2:

- deals
- pipelines
- stages
- tasks
- comments
- activity timeline

Phase 0.3:

- custom fields
- advanced filters
- saved views
- configurable CRM structure

Phase 0.4:

- automation engine
- triggers
- conditions
- actions

Phase 0.5:

- AI assistant
- natural language search
- summaries
- analytics
- controlled AI actions

## Important principle

Build and stabilize the CRM core first.

Do not allow AI features to drive the architecture prematurely.