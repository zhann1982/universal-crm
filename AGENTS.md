# AGENTS.md

## Project

Universal CRM is a configurable multi-tenant CRM platform.

The long-term goal is to let organization administrators configure:

- business processes
- pipelines
- stages
- custom fields
- roles
- permissions
- workflows
- automations

AI features come only after the CRM core is stable.

The application must remain industry-neutral.

Possible future use cases include:

- sales
- banking
- collections
- construction
- service businesses
- automotive
- e-commerce

Industry-specific behavior should primarily be implemented through configuration,
not separate application forks.

---

## Current phase

Current development phase:

CRM Core / early v0.2

Phase 0.1 foundations are substantially implemented:

- organizations
- Better Auth authentication
- organization membership
- RBAC
- Team
- Clients
- Companies
- Client ↔ Company relationships

Phase 0.2 is now in progress:

- Pipelines
- Pipeline stages
- Deals
- Kanban
- Deal creation
- Deal detail
- Deal stage transitions

Still planned for v0.2:

- deal editing
- deal archive / restore
- drag-and-drop Kanban
- pipeline management UI
- tasks
- comments
- activity timeline

---

## Current stack

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

---

## Architecture

The application is a modular monolith built with Next.js App Router.

Prefer:

- Server Components by default
- Server Actions for CRM mutations
- PostgreSQL as the primary datastore
- server-side authorization
- organization-scoped business queries
- explicit Zod validation
- simple modules over premature abstractions

Do not introduce additional infrastructure without a concrete requirement.

Avoid while the CRM core is developing:

- Redis
- queues
- microservices
- separate backend services
- paid infrastructure
- AI APIs

Development infrastructure should remain at or close to $0.

---

## Multi-tenancy

Multi-tenancy is a fundamental requirement.

Every tenant-owned business record must belong to an organization.

Primary tenant boundary:

organizationId

Never expose records from one organization to another.

Tenant-owned reads and writes must be scoped server-side.

Never trust organizationId supplied by the browser as authorization proof.

Current organization resolution is still temporary:

src/lib/current-organization.ts

Current development organization slug:

development

A real active-organization selector is not implemented yet.

Future organization selection must always validate membership server-side.

---

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

Never casually modify an already-applied migration.

Create new schema changes through Drizzle migrations.

Current total database table count:

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

Better Auth tables:

- user
- session
- account
- verification

---

## Authentication

Authentication is implemented with Better Auth.

Current authentication method:

email + password

Main files:

src/lib/auth/auth.ts

src/lib/auth/auth-client.ts

src/lib/auth/current-member.ts

src/app/api/auth/[...all]/route.ts

Main auth routes include:

- /register
- /login
- /auth-test
- /no-access

Better Auth provides the authenticated user identity.

The stable Better Auth user ID is stored in:

organization_members.userId

Do not use email as the long-term authorization identity.

Email may be used for:

- lookup
- display
- adding an already-registered user to an organization

Do not spread direct session parsing throughout the application.

Prefer centralized auth helpers.

---

## Authentication and authorization separation

Authentication answers:

Who is the user?

Authorization answers:

What may the user do?

These responsibilities must remain separate.

Authentication:

Better Auth

Authorization:

organization membership + roles + permissions

Current security chain:

Better Auth session
→ authenticated user
→ organization_members
→ active membership
→ member_roles
→ roles
→ role_permissions
→ permissions
→ CRM resource access

Registration alone must never grant organization access.

---

## Authorization / RBAC

Authorization must be enforced server-side.

Client-side visibility checks are UX only.

Main helpers:

src/lib/auth/current-member.ts

src/lib/auth/permissions.ts

Important functions:

- getCurrentMember()
- getCurrentAccessContext()
- hasPermission()
- requirePermission()

Permission denial:

/crm/forbidden

Authenticated user without active membership:

/no-access

---

## Current permissions

Client permissions:

- clients.read
- clients.create
- clients.update
- clients.archive
- clients.delete

Company permissions:

- companies.read
- companies.create
- companies.update
- companies.archive
- companies.delete

Deal permissions:

- deals.read
- deals.create
- deals.update
- deals.archive
- deals.delete

Pipeline permissions:

- pipelines.read
- pipelines.manage

Team permissions:

- members.read
- members.manage

Role permissions:

- roles.read
- roles.manage

Settings:

- settings.manage

---

## Current roles

System roles:

- Owner
- Admin
- Manager
- Viewer

Owner:

all current permissions

Admin:

all current permissions

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

## Team

The Team module currently supports:

- organization member listing
- adding an already-registered Better Auth user by email
- assigning an initial role
- multiple roles per member
- role updates
- member activation
- member deactivation
- active/inactive status display
- server-side permission checks
- organization-scoped role validation
- organization-scoped member validation
- self-role protection
- self-deactivation protection
- last active Owner protection

Role and status management require:

members.manage

Member listing requires:

members.read

Do not physically delete memberships by default.

Prefer deactivation.

The last-owner invariant is currently enforced at application level.

The pre-check and later write are not protected by a serialized database
transaction, so do not describe this as a strict concurrency-proof invariant.

Multiple writes currently use Neon/Drizzle batch operations where appropriate.

---

## Clients

The Clients module supports:

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
- company relationship display and management

Current client statuses:

- active
- lead
- inactive

Normal client workflow does not physically delete records.

Prefer archive / restore.

---

## Companies

Companies are a separate business entity.

Do not model Company as a Client.

The Companies module supports:

- create
- read
- update
- archive
- restore
- search
- status filtering
- active/archive views
- server-side pagination
- responsible member
- tenant-scoped duplicate tax ID validation
- RBAC
- tenant scoping
- linked client display

Current company statuses:

- active
- prospect
- inactive

Tax identifier is intentionally generic in the schema:

taxId

UI may display:

БИН / налоговый ID

Normal company workflow prefers archive / restore.

---

## Client ↔ Company relationship

Clients and Companies have a many-to-many relationship through:

client_companies

A Client may belong to multiple Companies.

A Company may have multiple Clients / contacts.

The join table contains:

- organizationId
- clientId
- companyId
- createdAt

Do not replace this relationship with a single clients.companyId field.

All relationship mutations must validate both Client and Company against the
current organization.

Deleting a relationship removes only the relationship, not the Client or Company.

---

## Pipelines

Pipelines are organization-owned.

Tables:

pipelines

pipeline_stages

A pipeline contains ordered stages.

Current stage types:

- open
- won
- lost

Stages have:

- name
- type
- position
- probability
- optional color

The seed currently creates:

Основная воронка

with stages:

- Новая
- Квалификация
- Предложение
- Переговоры
- Выиграна
- Проиграна

---

## Deals

Deals are organization-owned.

Main Deal relationships:

- organization
- pipeline
- stage
- responsible member
- optional company

Deal fields currently include:

- title
- amount
- currency
- expectedCloseAt
- closedAt
- notes
- archive state
- timestamps

The Deals module currently supports:

- Kanban board
- pipeline selection
- pipeline stage columns
- stage counts
- stage totals
- company display
- responsible member display
- deal creation
- deal detail page
- manual stage transition
- RBAC
- tenant scoping

Deal editing is not implemented yet.

Deal archive / restore is not implemented yet.

Kanban drag-and-drop is not implemented yet.

---

## Deal stage rules

Do not add a duplicate deal status field for:

open / won / lost

Deal state is derived from:

pipeline_stages.type

Valid stage types:

open
won
lost

When a deal moves to:

won or lost

closedAt must be set if it is not already set.

When a deal moves back to:

open

closedAt must become null.

A Deal stores both:

pipelineId
stageId

Application code must validate that the selected stage:

- belongs to the current organization
- belongs to the selected pipeline

The database does not currently enforce all cross-tenant and pipeline/stage
consistency through composite foreign keys.

Server-side validation is mandatory.

---

## Money

Deal amounts are stored as PostgreSQL:

numeric(14,2)

Drizzle returns numeric values as strings.

Do not casually convert money storage to floating point.

Formatting to JavaScript Number is acceptable for current display summaries,
but persistent monetary values must remain numeric/decimal in PostgreSQL.

Currency uses a three-letter code such as:

- KZT
- USD
- EUR

---

## Validation

Validate external input with Zod.

Examples:

- forms
- identifiers
- route parameters
- search parameters
- relationship IDs
- role selections
- pipeline IDs
- stage IDs
- future API payloads

Never trust hidden form fields as proof that a record belongs to the tenant.

Always revalidate relationships server-side.

---

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

Do not assume deleting it from a later commit makes it safe.

---

## Neon / Drizzle constraint

The current application uses the Neon serverless HTTP driver.

Do not assume ordinary interactive:

db.transaction(async (tx) => ...)

is available in the current execution path.

Use supported Drizzle / Neon patterns.

For grouped writes, db.batch([...]) is currently used where appropriate.

Do not claim application-level pre-checks are concurrency-proof when the check
and write are separate operations.

---

## Development identity

Historical development records may still exist:

- local-dev-owner
- local-dev-manager
- local-dev-viewer

They are legacy development fixtures.

They are not the current authentication mechanism.

Never reintroduce literal development IDs into request authentication.

Real users are Better Auth users linked through:

organization_members.userId

---

## Development commands

Start development server:

npm run dev

Generate migration:

npm run db:generate

Apply migrations:

npm run db:migrate

Seed database:

npm run db:seed

Link an existing Better Auth user to the development organization as Owner:

npm run db:link-owner -- email@example.com

Build:

npm run build

Lint:

npm run lint

---

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
- explicit tenant checks
- clear database constraints

Avoid premature abstraction.

Do not add a dependency when the existing stack can reasonably solve the
problem.

---

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

Keep these files concise and factual.

Do not turn them into conversation transcripts.

---

## Product roadmap

Phase 0.1:

- organizations
- authentication
- members
- roles and permissions
- clients
- companies
- client/company relationships

Status:

substantially implemented

Phase 0.2:

- deals
- pipelines
- stages
- tasks
- comments
- activity timeline

Status:

in progress

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
- natural-language search
- summaries
- analytics
- controlled AI actions

---

## Important principle

Build and stabilize the CRM core first.

Do not allow AI features to drive the architecture prematurely.