# Universal CRM — Architecture Decisions

## D001 — Multi-tenancy from the beginning

Status: accepted

Organizations are first-class entities.

Business records must be associated with an organization.

Reason:

Adding multi-tenancy later would require major schema and authorization changes.


## D002 — PostgreSQL

Status: accepted

Use PostgreSQL as the main database.

Reason:

CRM data contains many relationships and benefits from relational constraints,
transactions and indexing.


## D003 — Neon

Status: accepted

Use Neon PostgreSQL during development.

Reason:

Low cost, PostgreSQL compatibility and suitable free development tier.


## D004 — Drizzle ORM

Status: accepted

Use Drizzle ORM for schema and application database access.

Migrations are stored in the repository.


## D005 — Modular monolith first

Status: accepted

Frontend and backend initially live inside Next.js.

Do not introduce microservices without a concrete requirement.


## D006 — Infrastructure cost minimization

Status: accepted

Avoid paid infrastructure during early development where possible.

Do not add Redis, queues or separate services prematurely.


## D007 — Configurable CRM

Status: accepted

The application should evolve toward administrator-configurable:

- fields
- pipelines
- stages
- roles
- permissions
- automations

Avoid hard-coding one industry's workflow into the core architecture.


## D008 — AI comes after CRM core

Status: accepted

AI functionality will be introduced after the underlying CRM data model,
permissions and workflows are reliable.

AI will operate through controlled application tools rather than unrestricted
database access.