# Universal CRM — Project Context

Last updated: 2026-09-27

## Goal

Universal CRM is an industry-neutral configurable multi-tenant CRM platform.

The product should eventually allow Organizations to configure:

- business processes
- Pipelines
- Stages
- custom fields
- Roles
- Permissions
- saved views
- workflows
- automations

Potential industries include:

- sales
- banking
- collections
- service
- construction
- automotive
- e-commerce

Industry-specific behavior should primarily come from configuration instead of
separate application forks.

The current objective is not to specialize the product for one industry.

---

# Product boundary

The application is a modular monolith.

Frontend, server-side authorization and business logic currently live in the
same Next.js application.

Current stack:

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
- tsx

Current architecture intentionally avoids unnecessary infrastructure.

Not currently required:

- separate backend service
- Redis
- queue
- message broker
- microservices
- vector database
- dedicated AI backend

Infrastructure should remain inexpensive and simple until product requirements
justify additional components.

---

# Current development phase

The product is in:

CRM Core / early v0.2

Current development phase:

stabilization before more large product modules

The major CRM foundation already exists.

Current work is focused on:

- identity safety
- tenant access
- lifecycle rules
- concurrency
- permission semantics
- validation
- database integrity
- automated tests
- CI

After sufficient stabilization, the next major product module is expected to be:

Tasks

---

# Multi-tenancy

Organization is the tenant boundary.

Tenant-owned CRM data uses:

organizationId

The browser must never be trusted to prove Organization access merely by
submitting an organizationId.

Trusted Organization context must come from authenticated server-side state.

Current target security chain:

session
→ verified User
→ active Organization
→ active Membership
→ Permissions
→ business operation

The current development version still selects one fixed Organization:

slug = development

This is temporary.

Future Organization switching must validate real active Membership server-side.

---

# Organization

Organization represents one CRM tenant.

Important current fields include:

- id
- name
- slug
- isActive
- timestamps

Organization activity has security meaning.

Current behavior:

organizations.isActive = false
→ CRM business access denied

The Organization is not deleted.

Reactivation restores access.

This rule is enforced centrally through the current Organization resolution
path.

---

# User

User is the authentication identity managed by Better Auth.

Stable identity:

user.id

A User does not automatically have CRM access.

Registration alone does not create permission to enter an Organization.

Current authentication method:

email + password

Email verification is now part of the CRM access model.

---

# Email verification

Better Auth handles verification tokens.

Current development behavior:

- verification is generated during signup
- verification URL is printed to the development server terminal
- verification page exists
- resend flow exists

Current CRM access requires:

session.user.emailVerified = true

Better Auth login itself currently remains possible before verification.

This is deliberate during development so existing accounts can log in and
complete verification.

Production email delivery is not yet configured.

A full Organization invitation acceptance workflow is also not yet implemented.

---

# Email identity

Email is not the long-term authorization identity.

Stable authorization identity remains:

Better Auth user.id

Email is used only for controlled identity discovery and future invitation
workflows.

Current email lookup:

- trims whitespace
- lowercases the value
- performs exact equality comparison
- does not use LIKE
- does not use ILIKE
- rejects ambiguous normalized matches

Characters such as:

_
%

are treated literally rather than as SQL pattern wildcards.

---

# Organization Member

Organization Member connects a Better Auth User to an Organization.

Important concepts:

- organizationId
- userId
- displayName
- email
- status

Membership controls whether the User belongs to the tenant.

Inactive Membership denies normal CRM access.

Membership also participates in authorization through Roles.

Current production-safe gap:

membership acquisition still needs a full invitation acceptance flow.

---

# Role

Role contains CRM Permissions.

A Member may have multiple Roles.

Current system concepts include:

- Owner
- Admin
- Manager
- Viewer

Current limitation:

important administrative semantics still rely too much on mutable Role names.

Long-term design requires a stable system role identifier such as:

systemKey

---

# Permission

Permission is a granular server-side authorization capability.

Current groups include:

- clients.*
- companies.*
- deals.*
- pipelines.*
- members.*
- roles.*
- settings.manage

Authorization must be enforced server-side.

Client-side visibility is only UX.

Current permission helpers include:

- getCurrentMember()
- getCurrentAccessContext()
- hasPermission()
- requirePermission()

A valid UUID is never proof of authorization.

Submitted relationship IDs must be checked against:

- current Organization
- lifecycle state
- required Permissions
- relationship-specific invariants

---

# Related reference data

The application still needs a more explicit policy for related data such as:

- responsible Member picker
- Member names
- Member email
- Company data shown inside Deals
- Dashboard aggregate counts

The issue is not currently classified as a confirmed tenant boundary failure.

The problem is inconsistent permission semantics.

Future design should distinguish between:

full Team access

and:

restricted assignment/reference-directory access

---

# Client

Client represents a person/contact.

Client is not the same entity as Company.

Lifecycle:

active
→ archived
→ restored

Normal workflow avoids physical deletion.

Current functionality includes:

- create
- list
- detail
- edit
- archive
- restore
- search
- filters
- pagination

---

# Company

Company represents a business/legal organization.

Company is a separate entity from Client.

Company may reference a responsible Organization Member.

Lifecycle:

active
→ archived
→ restored

Current owner assignment rule:

existing inactive owner
→ may remain unchanged

newly selected owner
→ must be active

This avoids blocking unrelated Company edits merely because the existing
responsible Member later became inactive.

---

# Client ↔ Company

Client and Company have a many-to-many relationship.

Implemented through:

client_companies

A Client may relate to multiple Companies.

A Company may contain multiple Client contacts.

Remaining lifecycle issue:

server-side relationship mutations still need explicit rejection for archived
Clients if archive means immutable.

UI restrictions alone are not sufficient.

---

# Pipeline

Pipeline represents a configurable business or sales process.

An Organization may have multiple Pipelines.

Current database supports Pipelines.

Current UI supports selecting Pipelines when working with Deals.

Pipeline management UI is not yet implemented.

---

# Pipeline Stage

Pipeline Stage is an ordered Stage within a Pipeline.

Current Stage types:

- open
- won
- lost

Other fields include:

- name
- position
- probability
- optional color

Stage type defines Deal state semantics.

Current database does not yet enforce every Organization + Pipeline + Stage
relationship strongly enough.

Application validation currently provides additional protection.

---

# Deal

Deal represents an opportunity or business transaction.

A Deal belongs to:

- Organization
- Pipeline
- Stage

A Deal may reference:

- Company
- responsible Organization Member

Current Deal data includes:

- title
- amount
- currency
- expectedCloseAt
- closedAt
- description/notes
- archive state
- version
- timestamps

Deal status is not duplicated.

State derives from:

pipeline_stages.type

---

# Deal state model

Stage type:

open
→ closedAt = null

won
→ closedAt is set

lost
→ closedAt is set

Moving a closed Deal back to an open Stage clears closedAt.

Do not introduce a separate won/lost Deal status field unless the product model
is deliberately changed.

---

# Shared Deal Stage transition

A shared Deal transition business module now exists:

src/modules/deals/transition-deal.ts

It is used for Stage movement.

Its responsibilities include:

- Deal input validation
- tenant scope validation
- active lifecycle validation
- current Pipeline validation
- target Stage validation
- Stage type validation
- closedAt handling
- optimistic concurrency protection

Conditional transition checks include:

- Deal id
- Organization
- current version
- current Pipeline
- current Stage
- active archive state
- deletedAt

Zero-row update means conflict rather than silent success.

Future automation, API and AI Stage changes should reuse the same business
operation instead of reimplementing Stage rules.

---

# Deal optimistic locking

Deal has:

version integer not null default 1

Purpose:

prevent stale collaborative edits from silently overwriting newer state.

Edit flow:

Deal loaded
→ version N

User submits edit
→ expected version N

Server UPDATE requires:

version = N

Successful mutation:

version = version + 1

If zero rows are updated:

→ conflict

Current version changes on:

- full Deal edit
- Stage transition
- archive
- restore

Manually verified behavior includes:

- stale second browser tab cannot overwrite first save
- Kanban Stage movement invalidates an already-open stale edit form
- normal sequential editing continues to work

---

# Deal lifecycle

Deals use:

archive
→ restore

instead of normal hard deletion.

Archived Deal mutations should be rejected where archive means immutable.

Archive and restore currently increment Deal.version.

The exact concurrency/idempotency contract for repeated or competing
archive/restore actions still needs further strengthening.

---

# Money

Deal amount is stored using PostgreSQL:

numeric(14,2)

Currency is stored separately.

Different currencies must remain separate in totals unless an explicit exchange
rate conversion feature is introduced.

Current Kanban totals remain grouped by currency.

Persisted financial calculations must not use floating-point values as the
source of truth.

---

# Dates

Deal expectedCloseAt currently uses timestamp storage.

Current validation still uses Date.parse-style validation.

This is a known issue because JavaScript can normalize impossible dates.

Examples that must eventually be rejected:

- 2026-02-29
- 2026-02-31
- 2026-04-31

Product semantics still need to decide whether expectedCloseAt represents:

- calendar date
or
- exact timestamp

If it is a date-only business value, PostgreSQL date is the preferred future
direction.

Artificial noon UTC should not become the permanent timezone model.

---

# Description vs collaborative Notes

Existing `notes` fields on:

- Client
- Company
- Deal

are simple descriptive text fields.

They are not multi-user collaborative Notes.

Future collaborative Notes should be separate records.

Likely concepts:

- organizationId
- author Member
- parent business record
- createdAt
- updatedAt
- lastEditedBy
- deletedAt

---

# Tasks

Tasks are not implemented yet.

Tasks are expected to become the next major product module after stabilization.

Purpose:

turn CRM from mainly a record catalog into a daily operational work system.

Likely relationships:

- Deal
- Client
- Company
- responsible Member

Important future views:

- today
- overdue
- mine
- upcoming
- completed
- Deals without a next action

---

# Activity Timeline

Activity Timeline is not implemented.

It is expected to contain structured business events.

Examples:

- Deal created
- Stage changed
- Pipeline changed
- owner changed
- amount changed
- archived
- restored
- Task created
- Task completed
- Note created
- Note edited
- Note deleted

Activity is separate from collaborative Notes.

Activity is important for:

- collaboration
- debugging
- historical reporting
- Pipeline analytics
- automation
- future AI summaries

Current entity state alone cannot reconstruct historical Stage duration reliably.

---

# Deal contacts

Direct Deal ↔ Client relationship is not implemented.

Future likely direction:

deal_clients

Potential fields:

- organizationId
- dealId
- clientId
- role
- isPrimary
- createdAt

A Deal should be able to reference multiple contacts.

Contacts should not necessarily be restricted only to the Deal's selected
Company.

---

# Custom fields

Not implemented.

Future custom fields should support typed definitions and server validation.

Core relational and financial data should remain relational.

JSONB may be appropriate for less frequently queried custom values.

Indexes should be added only for demonstrated query requirements.

---

# Saved views

Not implemented.

Saved views must never bypass current Permissions.

Likely filters include:

- owner
- Pipeline
- Stage
- due date
- amount
- activity age

---

# Automation

Not implemented.

Future model:

event
→ conditions
→ allowed operation

Automation will require:

- idempotency
- loop protection
- execution history
- retry policy
- limits

External guaranteed delivery may later use a PostgreSQL outbox.

Do not introduce a message broker until requirements justify it.

---

# AI direction

AI is a later application layer.

Start with read-oriented capabilities such as:

- Deal summary
- Client summary
- Company summary
- recommended next action
- permission-aware search

AI must use the same business operations used by normal application workflows.

AI must never receive unrestricted database access.

AI must respect:

- Better Auth
- verified identity
- active Organization
- active Membership
- Permissions
- tenant scope
- validation
- optimistic locking
- lifecycle rules
- database constraints
- Activity history

Human-authored Notes must be treated as untrusted input.

---

# Current architecture direction

The current modular-monolith foundation remains suitable.

The primary architectural debt is not the choice of framework.

The main debt is that important rules are still distributed across:

- pages
- Server Actions
- helpers

The first important shared business module now exists:

src/modules/deals/transition-deal.ts

Future direction:

central trusted access context
+ small business modules
+ shared operations
+ stronger PostgreSQL invariants

without splitting the application into microservices.

---

# Current stabilization gaps

Major remaining areas include:

- archived Client relationship mutation
- strict calendar-date validation
- related-data Permission policy
- last-Owner concurrency
- production invitation flow
- database-level relationship invariants
- automated regression coverage
- CI
- scaling of large collections

These should be addressed before broad automation or AI work.