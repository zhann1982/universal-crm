# Universal CRM — Project Context

Last updated: 2026-09-25

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

AI is not part of the current CRM core milestone.

---

## Product direction

The CRM should not be tied to one industry.

Possible use cases include:

- sales
- banking
- collections
- service businesses
- construction
- automotive
- e-commerce

Industry-specific requirements should primarily be implemented through
configuration rather than separate application forks.

---

## Cost strategy

Development infrastructure should remain as close to $0 as possible.

Current approach:

- local Next.js development
- Neon free PostgreSQL
- GitHub
- open-source libraries

Additional infrastructure is introduced only when justified by real usage.

---

## Technical stack

Application:

Next.js 16.3.6 + React 19 + TypeScript

Database:

PostgreSQL

Database provider:

Neon

ORM:

Drizzle ORM

Validation:

Zod 4

Authentication:

Better Auth

Styling:

Tailwind CSS 4

Package manager:

npm

---

## Architecture direction

The application is a modular monolith.

Frontend and backend currently live inside the same Next.js application.

Use Server Components by default.

Use Server Actions for ordinary CRM mutations.

Do not split frontend and backend into separate deployments without a concrete
need.

Do not introduce Redis, queues, microservices or AI infrastructure prematurely.

---

## Multi-tenancy

Multi-tenancy exists from the beginning.

Every tenant-owned business record must belong to an organization.

Primary tenant boundary:

organizationId

Browser-supplied organizationId must never be trusted as authorization proof.

The current development organization is resolved server-side and is still fixed
to:

development

A real active-organization selector is planned later.

---

## Authentication model

Better Auth handles:

- user identity
- email/password login
- sessions

CRM authorization is separate.

The stable Better Auth:

user.id

is stored in:

organization_members.userId

Security path:

Better Auth user
→ organization membership
→ active member
→ roles
→ permissions
→ tenant resources

Registration alone does not grant CRM access.

---

## Current database model

CRM:

organizations

organization_members

roles

permissions

role_permissions

member_roles

clients

companies

client_companies

pipelines

pipeline_stages

deals

Authentication:

user

session

account

verification

Current total:

16 tables

---

## Current business model

### Client

Represents a person/contact.

Supports archive / restore instead of normal physical deletion.

### Company

Represents a company, legal entity or business organization.

Company is a separate entity from Client.

### Client ↔ Company

Many-to-many through:

client_companies

A Client may be associated with multiple Companies.

A Company may have multiple Client contacts.

### Pipeline

Represents a sales/business process pipeline.

An organization may eventually have multiple pipelines.

### Pipeline Stage

Ordered stage inside a pipeline.

Stage types currently are:

open
won
lost

### Deal

A Deal belongs to:

- organization
- pipeline
- pipeline stage

A Deal may optionally belong to:

- company
- responsible member

Deal status is derived from the stage type rather than duplicated in a separate
deal status field.

---

## Current permissions model

Permissions are granular strings.

Main groups:

clients.*

companies.*

deals.*

pipelines.*

members.*

roles.*

settings.manage

Roles contain permissions.

Members may have multiple roles.

Current system roles:

- Owner
- Admin
- Manager
- Viewer

---

## Current CRM capabilities

Implemented foundations:

- authentication
- organization membership
- RBAC
- Team management
- Clients
- Companies
- Client ↔ Company relationships
- Pipelines
- Pipeline stages
- Deals
- Deal Kanban
- Deal creation
- Deal detail
- Deal stage transitions

Still under development:

- deal editing
- deal archive / restore
- Kanban drag-and-drop
- pipeline/stage management UI
- tasks
- comments
- activity timeline
- custom fields
- saved views
- automations

---

## Data integrity direction

Application code must always validate tenant ownership.

This is especially important for relationships such as:

Client ↔ Company

Deal → Company

Deal → Member

Deal → Pipeline

Deal → Stage

The database does not yet enforce every cross-tenant relationship through
composite foreign keys.

Application-level organization validation is therefore mandatory.

---

## Deals direction

Deal state is derived from:

pipeline_stages.type

Do not create a second independent field such as:

deal.status = won

because it could contradict the stage.

When moving to won/lost:

closedAt is set.

When moving back to an open stage:

closedAt is cleared.

Deal money is stored as PostgreSQL numeric rather than floating point.

---

## Planned systems

Current phase:

early v0.2

Next systems after the current Deals milestone:

- deal editing
- Kanban drag-and-drop
- pipeline management
- tasks
- comments
- activity timeline
- custom fields
- saved filters/views
- automation engine
- audit log
- external integrations
- AI assistant

---

## AI architecture direction

AI must never receive unrestricted database access.

Future AI operations should use controlled application tools/functions such as:

searchClients()

readClient()

searchCompanies()

readCompany()

readDeals()

createTask()

updateDeal()

Every AI action must still pass:

- authentication
- organization membership
- tenant scoping
- permission checks
- input validation

AI must use the same authorization rules as normal application users.