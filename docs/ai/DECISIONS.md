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


## D009 — Better Auth for application authentication

Status: accepted

Use Better Auth for application authentication.

Initial authentication method:

email + password

Reason:

The project needs real session-based authentication without introducing a
separate paid authentication service.

Better Auth integrates with the existing:

- Next.js application
- PostgreSQL database
- Drizzle ORM architecture

Authentication data remains in PostgreSQL.

Do not build a parallel custom password/session system unless there is a
specific future requirement that Better Auth cannot satisfy.


## D010 — Authentication and CRM authorization remain separate

Status: accepted

Better Auth is responsible for identity and sessions.

The CRM remains responsible for:

- organization membership
- roles
- permissions
- tenant authorization

Reason:

An authenticated account does not automatically imply access to an
organization.

The security chain is:

authenticated user
→ organization membership
→ roles
→ permissions
→ CRM resources

Registration alone must not grant CRM access.


## D011 — Better Auth user ID is the CRM membership identity

Status: accepted

Store the stable Better Auth:

user.id

inside:

organization_members.userId

Email may be used for lookup and display but must not be the long-term
authorization identity.

Reason:

Email addresses may change.

Stable user IDs are safer for identity relationships and authorization.


## D012 — Inactive membership denies CRM access

Status: accepted

An authenticated user must have an active organization_members record before
receiving CRM access.

Users without an active membership must not receive tenant business data.

Reason:

Authentication and organization access are separate lifecycle concerns.

This also allows future member deactivation without deleting the underlying
user account.


## D013 — Organization selection must be membership-validated

Status: accepted

The current development version uses the fixed development organization.

Future active-organization selection must always validate that the authenticated
user belongs to the selected organization.

Never treat a browser-supplied organization ID as authorization proof.


## D014 — Prefer deactivation over deleting members

Status: accepted

Organization memberships should normally be deactivated rather than physically
deleted.

Reason:

CRM records may reference members historically.

Keeping membership records supports auditability and future ownership history.