# Universal CRM — Project Context

## Goal

Build a configurable multi-tenant CRM platform.

An organization administrator should eventually be able to configure:

- CRM fields
- pipelines
- stages
- roles
- permissions
- workflows
- automations

AI will later assist users with CRM data and operations.

## Product direction

The CRM should not be tied to one industry.

Examples of possible use:

- sales
- banking
- collections
- service businesses
- construction
- automotive
- e-commerce

Industry-specific requirements should primarily be implemented through
configuration rather than separate application forks.

## Cost strategy

Development infrastructure should remain as close to $0 as possible.

Current approach:

- local Next.js development
- Neon free PostgreSQL
- GitHub
- open-source libraries

Additional infrastructure is introduced only when justified by real usage.

## Technical stack

Frontend / backend:
Next.js + TypeScript

Database:
PostgreSQL

Database provider:
Neon

ORM:
Drizzle

Validation:
Zod

Styling:
Tailwind CSS

## Architecture direction

Start as a modular monolith.

Do not split frontend/backend into separate deployments without a concrete need.

Multi-tenancy exists from the beginning.

Every business record must be scoped to an organization.

## Current database model

organizations

organization_members

roles

permissions

role_permissions

member_roles

clients

## Permissions model

Permissions are granular strings such as:

clients.read
clients.create
clients.update
clients.archive
clients.delete

Roles contain permissions.

Members can have multiple roles.

## Planned important systems

- companies
- deals
- configurable pipelines
- tasks
- activity timeline
- custom fields
- saved filters/views
- automation engine
- audit log
- external integrations
- AI assistant

## AI architecture direction

AI should never receive unrestricted database access.

Future AI operations should use controlled tools/functions such as:

searchClients()
readClient()
readDeals()
createTask()
updateDeal()

Every AI action must still pass organization and permission checks.