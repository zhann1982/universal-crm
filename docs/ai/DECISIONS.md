# Universal CRM — Architecture Decisions

Last updated: 2026-09-25

## D001 — Multi-tenancy from the beginning

Status: accepted

Organizations are first-class entities.

Business records must be associated with an organization.

Primary tenant boundary:

organizationId

Reason:

Adding multi-tenancy later would require major schema and authorization changes.

---

## D002 — PostgreSQL

Status: accepted

Use PostgreSQL as the main database.

Reason:

CRM data contains many relationships and benefits from relational constraints,
transactions and indexing.

---

## D003 — Neon

Status: accepted

Use Neon PostgreSQL during development.

Reason:

Low cost, PostgreSQL compatibility and suitable free development tier.

---

## D004 — Drizzle ORM

Status: accepted

Use Drizzle ORM for schema and application database access.

Migrations are stored in the repository.

Do not casually edit migrations that have already been applied.

---

## D005 — Modular monolith first

Status: accepted

Frontend and backend initially live inside Next.js.

Use:

- Server Components by default
- Server Actions for mutations

Do not introduce microservices or a separate backend without a concrete
requirement.

---

## D006 — Infrastructure cost minimization

Status: accepted

Avoid paid infrastructure during early development where possible.

Do not add Redis, queues or separate services prematurely.

---

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

---

## D008 — AI comes after CRM core

Status: accepted

AI functionality will be introduced after the underlying CRM data model,
permissions and workflows are reliable.

Future AI functionality must operate through controlled application tools rather
than unrestricted database access.

---

## D009 — Better Auth for authentication

Status: accepted

Use Better Auth for application authentication.

Initial authentication method:

email + password

Reason:

The project needs real session-based authentication without introducing a
separate paid authentication service.

Better Auth integrates with:

- Next.js
- PostgreSQL
- Drizzle ORM

Do not build a parallel custom password/session system unless a future concrete
requirement cannot be handled by Better Auth.

---

## D010 — Authentication and CRM authorization remain separate

Status: accepted

Better Auth is responsible for:

- identity
- sessions

CRM is responsible for:

- organization membership
- roles
- permissions
- tenant authorization

Security chain:

authenticated user
→ organization membership
→ roles
→ permissions
→ CRM resources

Registration alone does not grant organization access.

---

## D011 — Better Auth user ID is the membership identity

Status: accepted

Store Better Auth:

user.id

inside:

organization_members.userId

Email may be used for lookup and display.

Email must not be the long-term authorization identity.

Reason:

Email can change.

Stable user IDs are more appropriate for identity relationships.

---

## D012 — Inactive membership denies CRM access

Status: accepted

An authenticated user must have an active organization_members record before
receiving CRM access.

Inactive members must not receive tenant business data.

Reason:

Authentication and organization access have separate lifecycles.

This also allows access revocation without deleting the Better Auth account.

---

## D013 — Organization selection must be membership-validated

Status: accepted

The current development version uses the fixed:

development

organization.

Future active-organization selection must validate that the authenticated user
belongs to the selected organization.

Never treat browser-supplied organizationId as authorization proof.

---

## D014 — Prefer member deactivation over deletion

Status: accepted

Organization memberships should normally be deactivated rather than physically
deleted.

Reason:

CRM records may reference members historically.

Keeping memberships supports future auditability and ownership history.

---

## D015 — Company is a separate business entity from Client

Status: accepted

Client represents a person/contact.

Company represents a business/legal organization.

Do not represent Companies as special Clients.

Reason:

Companies and people have different attributes, relationships and lifecycle
requirements.

---

## D016 — Client ↔ Company is many-to-many

Status: accepted

Use:

client_companies

as the relationship table.

A Client may be related to multiple Companies.

A Company may contain multiple Client contacts.

The relationship itself is tenant-owned through:

organizationId

Reason:

A single clients.companyId field would unnecessarily restrict the CRM model and
create migration debt for real-world cases.

---

## D017 — Prefer archive / restore for business records

Status: accepted

Clients and Companies use:

isArchived

for normal removal from active workflows.

Physical deletion is not part of normal UI flows.

Deals should follow the same lifecycle direction.

Reason:

CRM records may later be referenced by:

- activities
- tasks
- history
- analytics
- audit logs

Archive / restore preserves history.

---

## D018 — Pipelines and Stages are first-class entities

Status: accepted

Deals must use configurable:

pipelines

and:

pipeline_stages

rather than hard-coded application status values.

Each Stage contains:

- name
- position
- type
- probability
- optional color

Current stage types:

open
won
lost

Reason:

Different organizations and processes require different sales/business stages.

---

## D019 — Deal state is derived from Stage type

Status: accepted

Do not store a second independent:

deal.status

for open/won/lost state.

Deal state comes from:

pipeline_stages.type

Reason:

Duplicating state would allow contradictory data such as:

stage = Переговоры
status = won

Rules:

open
→ closedAt = null

won
→ closedAt is set

lost
→ closedAt is set

Moving a closed Deal back to an open Stage clears closedAt.

---

## D020 — Deal keeps both Pipeline ID and Stage ID

Status: accepted

Deals store:

pipelineId

and:

stageId

Application code must validate that the Stage belongs to the selected Pipeline.

Reason:

Storing pipelineId makes filtering and Kanban queries straightforward, while
stageId identifies the specific business state.

Current PostgreSQL schema does not enforce every pipeline/stage/organization
relationship through composite foreign keys.

Therefore server-side relationship validation is mandatory.

---

## D021 — Relationship IDs must be authorized server-side

Status: accepted

Never treat a valid UUID from the browser as proof of access.

For mutations, validate relationship targets against the authenticated
organization.

Examples:

- Client
- Company
- Pipeline
- Stage
- responsible Member
- future Tasks and related records

Reason:

Hidden fields, route parameters and request payloads are user-controlled input.

---

## D022 — Deal money uses PostgreSQL numeric

Status: accepted

Deal amount uses:

numeric(14,2)

Do not store persistent monetary values as floating-point numbers.

Currency is stored separately as a three-character code.

Reason:

Floating point is inappropriate for exact persistent financial values.

---

## D023 — Neon HTTP execution constraints are explicit

Status: accepted

The application currently uses the Neon serverless HTTP execution path.

Do not assume normal interactive:

db.transaction(async (tx) => ...)

callbacks are available.

Use supported Drizzle/Neon mechanisms such as:

db.batch([...])

where appropriate.

Application-level pre-checks followed by writes must not be described as fully
serialized concurrency guarantees.

---

## D024 — Last active Owner is protected at application level

Status: accepted with limitation

Team role/status mutations attempt to prevent removal or deactivation of the
last active Owner.

Current Owner identity is based on:

roles.name = "Owner"

Current protection is application-level.

Reason:

The organization must not accidentally lose administrative ownership.

Known limitation:

The check and subsequent mutation are not protected by a serialized database
invariant, so concurrent administrative requests could require future hardening.

Future improvement:

Use a stable system role key and review stronger concurrency protection.

---

## D025 — Deal Kanban is Pipeline-centered

Status: accepted

The main Deals view is organized as:

selected Pipeline
→ ordered Pipeline Stages
→ Deal cards

Deal movement between Stages occurs inside the current Pipeline.

Cross-Pipeline movement should be explicit through Deal editing or another
purpose-built action.

Reason:

A Kanban column represents a Stage belonging to one specific Pipeline.

Implicitly changing both pipeline and stage during drag-and-drop would make
authorization and state transitions less clear.

---

## D026 — AI must use normal CRM authorization

Status: accepted

Future AI operations must use the same authorization model as human-driven CRM
operations.

AI must not bypass:

- Better Auth
- organization membership
- permissions
- tenant boundaries
- input validation
- business rules

Reason:

AI is an application actor, not a privileged database administrator.