# AGENTS.md

## Project

Universal CRM is a multi-tenant CRM platform where administrators can configure
business processes, pipelines, fields, roles, permissions and automations.

AI features will be added after the CRM core is stable.

## Current stack

- Next.js 16
- React
- TypeScript
- Tailwind CSS
- PostgreSQL
- Neon
- Drizzle ORM
- Zod
- npm

## Architecture

The application currently uses a monolithic Next.js architecture.

Do not introduce additional infrastructure unless it is actually required.

Avoid adding:

- Redis
- queues
- microservices
- separate backend services
- paid infrastructure
- AI APIs

until the project needs them.

The development goal is to keep infrastructure cost at or close to $0.

## Multi-tenancy

Multi-tenancy is a core architectural requirement.

Business entities must belong to an organization.

Never expose records from one organization to another.

Queries for CRM business data should normally be scoped by organizationId.

## Database

Database:

PostgreSQL on Neon.

ORM:

Drizzle ORM.

Schema:

src/db/schema.ts

Database connection:

src/db/index.ts

Migrations:

drizzle/

Never manually modify an already-applied migration unless there is a specific
reason to do so.

Create schema changes through Drizzle migrations.

## Security

Never commit:

- .env
- .env.local
- passwords
- tokens
- API keys
- DATABASE_URL
- private credentials

Authorization must be enforced on the server.

Do not trust client-side role or permission checks as security controls.

## Validation

Validate user input with Zod before writing business data.

## Current core entities

- organizations
- organization_members
- roles
- permissions
- role_permissions
- member_roles
- clients

More entities will be added incrementally.

## Authentication

Real authentication is not implemented yet.

The seed currently creates a temporary development user:

local-dev-owner

Do not treat this as production authentication.

## Development commands

Start development server:

npm run dev

Generate migration:

npm run db:generate

Apply migrations:

npm run db:migrate

Seed database:

npm run db:seed

Build:

npm run build

Lint:

npm run lint

## Coding approach

Prefer:

- simple architecture
- Server Components by default
- server-side database access
- TypeScript strictness
- small reusable components
- explicit validation
- explicit permission checks
- clear database constraints

Avoid premature abstraction.

Do not add a dependency when the same task can reasonably be done with the
current stack.

## AI context protocol

Before doing significant work, read in this order:

1. AGENTS.md
2. docs/ai/CONTEXT.md
3. docs/ai/STATUS.md
4. docs/ai/DECISIONS.md

After significant development work:

- update docs/ai/STATUS.md
- update docs/ai/DECISIONS.md only when an architectural/product decision changes

Keep these files concise.

Do not turn them into session transcripts.

## Main product roadmap

Phase 0.1:
- organizations
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

Build the CRM core first.

Do not allow AI features to drive the architecture prematurely.
