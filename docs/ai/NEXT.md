# Universal CRM — Next Development Steps

Last updated: 2026-09-25

## Current checkpoint

The core identity and CRM entity foundations are working.

Current chain:

Better Auth
→ Organization membership
→ RBAC
→ Clients
→ Companies
→ Client / Company relationships
→ Pipelines
→ Pipeline stages
→ Deals
→ Kanban
→ Deal creation
→ Deal detail
→ Deal stage transitions

The immediate development priority is now:

DEAL LIFECYCLE + KANBAN INTERACTION

Do not start AI features.

---

# Step 1 — Full Deal editing

Add:

/crm/deals/[id]/edit

Editable fields:

- title
- pipeline
- stage
- amount
- currency
- company
- responsible member
- expected close date
- notes / description

Requirements:

- deals.update
- tenant-scoped Deal lookup
- tenant-scoped Pipeline validation
- Stage must belong to selected Pipeline
- Company must belong to current organization
- Company must not be deleted
- selected responsible member must belong to current organization
- selected responsible member should normally be active
- Zod validation
- updatedAt must be updated

If pipeline changes, stage selection must also change to a valid stage in the new
pipeline.

Do not allow a Stage from another Pipeline to be submitted through manipulated
form data.

The current simple `notes` field remains a single description / summary field.

It is not the long-term multi-user Notes system.

---

# Step 2 — Preserve Deal closedAt rules during editing

Deal state continues to come from:

pipeline_stages.type

Rules:

open
→ closedAt = null

won
→ closedAt = existing closedAt or current time

lost
→ closedAt = existing closedAt or current time

If Deal editing changes the Stage, apply the same rules used by manual Stage
movement.

Avoid duplicating this logic in many independent places.

A small reusable server helper may be appropriate once Deal editing is stable.

Do not create a separate Deal status field.

---

# Step 3 — Deal archive / restore

Implement the same lifecycle pattern already used by:

Clients

Companies

Requirements:

- deals.archive
- archive action
- restore action
- tenant scope
- deletedAt remains null
- normal hard deletion is not exposed
- active/archive views or equivalent discoverability
- archived Deals must not appear in the normal Kanban

Archived Deal detail may remain readable if the user has deals.read.

Archived Deals must not be editable or movable between Stages unless they are
first restored.

Prefer archive / restore over physical deletion.

---

# Step 4 — Drag-and-drop Kanban

After manual Stage movement and Deal editing behavior are stable, add
drag-and-drop.

Target UX:

Deal card
→ drag
→ drop into another Stage
→ Server Action
→ validate Deal
→ validate target Stage
→ update stageId
→ update closedAt if required
→ refresh board

Security requirements:

- deals.update
- tenant-scoped Deal
- target Stage belongs to current organization
- target Stage belongs to Deal's current Pipeline

Client-side drag-and-drop state is not an authorization boundary.

The server must validate every move.

Do not allow drag-and-drop to mutate pipelineId implicitly.

Cross-Pipeline movement should happen through explicit Deal editing or a later
dedicated action.

---

# Step 5 — Improve Kanban summaries

Current board shows counts and monetary totals.

Before adding more analytics, handle multiple currencies correctly.

Do not present:

KZT + USD + EUR

as one meaningful financial total.

Prefer grouping totals by currency.

Example:

KZT 1 500 000
USD 4 000
EUR 1 250

Do not implement exchange-rate conversion without a concrete product
requirement.

Persistent monetary values must remain PostgreSQL numeric.

---

# Step 6 — Pipeline management UI

Current database supports multiple Pipelines and Stages.

Current seed creates:

Основная воронка

with standard Stages.

Add administration UI for:

- create Pipeline
- rename Pipeline
- archive Pipeline
- restore Pipeline if needed
- choose default Pipeline
- create Stage
- rename Stage
- reorder Stage
- change Stage probability
- change Stage type
- optional Stage color

Permission:

pipelines.manage

Stage types:

- open
- won
- lost

A Pipeline or Stage currently referenced by Deals must not be casually deleted.

Prefer:

- archive
- controlled migration
- reassignment

over destructive deletion.

---

# Step 7 — Pipeline invariants

Before allowing flexible Pipeline administration, define stronger invariants.

Consider:

- only one default Pipeline per organization
- at least one usable Stage per active Pipeline
- deterministic Stage positions
- whether each Pipeline requires a won Stage
- whether each Pipeline requires a lost Stage
- behavior when archiving a Pipeline containing active Deals
- behavior when archiving a Stage containing Deals
- behavior when changing Stage type from open to won/lost
- behavior when changing Stage type from won/lost to open

Current database does not enforce all of these.

Do not add constraints until the desired product behavior is clear.

---

# Step 8 — Deal relationships

Current Deal directly supports:

- Company
- responsible Member

Current Deal does not directly reference a Client/contact.

After the basic Deal lifecycle is complete, decide whether Deals need:

- one primary Client
- many Client contacts
- dedicated deal_clients join table
- reuse of Company-related Client contacts

Do not add a single clientId without deciding the intended CRM relationship
model.

For a universal CRM, a many-to-many Deal ↔ Client relationship may eventually
be more flexible.

Possible future model:

deal_clients

- organizationId
- dealId
- clientId
- relationshipType
- isPrimary
- createdAt

Do not implement this until the real workflow requires it.

---

# Step 9 — Tasks

After Deals and Pipeline interaction are stable, begin Tasks.

Likely Task fields:

- id
- organizationId
- title
- description
- dueAt
- status
- priority
- ownerMemberId
- createdByMemberId
- completedAt
- createdAt
- updatedAt
- deletedAt

Possible statuses:

- open
- in_progress
- completed
- cancelled

Possible priorities:

- low
- normal
- high
- urgent

Tasks should eventually be linkable to business entities such as:

- Client
- Company
- Deal

Do not over-generalize the first implementation before the real workflow is
tested.

Task authorization must remain tenant-scoped and server-side.

---

# Step 10 — Collaborative Notes / Comments

Current Client, Company and Deal entities contain a simple `notes` text field.

Keep this field for now as a single persistent description / summary field.

Do not use it as the long-term collaborative Notes system.

Add a separate multi-user Notes / Comments system.

Target UX:

Entity detail
→ Notes section
→ chronological list of Notes
→ author
→ creation date/time
→ last edit date/time
→ optional last editor
→ create Note
→ edit allowed Note
→ soft-delete allowed Note

Examples of supported parent entities:

- Client
- Company
- Deal
- later Task

A typical UI should look conceptually like:

Ivan Petrov
25.09.2026 14:32

Client asked to call again after 18:00.

---

Anna Sadykova
25.09.2026 16:10
Edited: 25.09.2026 16:22

Commercial proposal sent.

Each Note should eventually contain at least:

- id
- organizationId
- authorMemberId
- lastEditedByMemberId if applicable
- body
- createdAt
- updatedAt
- deletedAt

authorMemberId must remain immutable.

If another authorized user edits a Note:

- preserve the original author
- update updatedAt
- record lastEditedByMemberId

Do not physically delete Notes by default.

Prefer soft deletion so future history and audit data are preserved.

---

## Notes authorization

Viewing a Note must require access to the parent CRM entity.

Knowing a Note UUID must never be sufficient to read it.

Examples:

Deal Note:

organization membership
→ deals.read
→ Deal belongs to current organization
→ Note belongs to that Deal
→ Note may be read

Company Note:

organization membership
→ companies.read
→ Company belongs to current organization
→ Note belongs to that Company
→ Note may be read

Client Note:

organization membership
→ clients.read
→ Client belongs to current organization
→ Note belongs to that Client
→ Note may be read

For the first version, prefer:

- authenticated member can create Notes when they can access the parent entity
- author can edit their own Note
- author can soft-delete their own Note
- authorized administrators may manage other users' Notes

Exact permissions must be defined before implementation.

Possible future permission family:

- comments.create
- comments.update
- comments.delete
- comments.manage

or:

- notes.create
- notes.update
- notes.delete
- notes.manage

Choose one naming convention and use it consistently.

Do not rely on client-side author checks.

All authorship, tenant and permission checks must be enforced server-side.

---

## Notes data model decision

Do not choose a polymorphic relationship casually.

A generic model such as:

entityType
entityId

is flexible but prevents a normal PostgreSQL foreign key from entityId to the
actual Client, Company, Deal or Task table.

Before implementation, explicitly compare the following approaches.

### Option A — Entity-specific tables

Examples:

client_notes

company_notes

deal_notes

task_notes

Advantages:

- strong foreign keys
- simple tenant validation
- clear queries
- strong referential integrity

Disadvantages:

- repeated table structure
- repeated application code

### Option B — Shared Notes table with explicit nullable parent columns

Example:

notes

- id
- organizationId
- clientId nullable
- companyId nullable
- dealId nullable
- taskId nullable
- authorMemberId
- lastEditedByMemberId
- body
- createdAt
- updatedAt
- deletedAt

Require exactly one parent reference.

Advantages:

- one Note model
- normal PostgreSQL foreign keys remain possible
- easier shared UI and permissions

Disadvantages:

- more nullable parent columns
- requires a constraint ensuring exactly one parent

This may be a strong candidate for the first universal CRM Notes model.

### Option C — Generic entityType + entityId

Advantages:

- highly generic
- easy to attach Notes to new entity types

Disadvantages:

- weak database referential integrity
- harder database constraints
- easier to create dangling references
- heavier application validation

Do not choose Option C merely because it looks more generic.

Prefer referential integrity and clear tenant enforcement over premature generic
abstraction.

Make the final decision immediately before implementing Notes.

---

## Notes editing history

Initial implementation only needs:

- original author
- createdAt
- updatedAt
- optional lastEditedByMemberId

Later, if complete text history is required, add immutable Note revisions.

Possible table:

note_versions

Fields:

- id
- organizationId
- noteId
- body
- editedByMemberId
- createdAt

Possible flow:

Note created
→ version 1

Note edited
→ current Note body changes
→ version 2 recorded

Do not build complete revision history before there is a real product
requirement.

However, the main Notes design should not make adding revision history difficult
later.

---

# Step 11 — Activity Timeline

After collaborative Notes are stable, implement a general Activity Timeline.

The Activity Timeline is separate from Notes.

Notes represent human-written collaboration.

Activities represent structured events that happened in the CRM.

Likely tracked events:

- Client created
- Client updated
- Client archived
- Client restored
- Company created
- Company updated
- Company archived
- Company restored
- Client linked to Company
- Client unlinked from Company
- Deal created
- Deal updated
- Deal Stage changed
- Deal Pipeline changed
- Deal amount changed
- Company on Deal changed
- responsible Member changed
- Deal archived
- Deal restored
- Note created
- Note edited
- Note deleted
- Task created
- Task completed

Activity records should include at least:

- id
- organizationId
- actorMemberId
- eventType
- createdAt
- structured metadata
- parent entity relationship

Examples:

deal.stage_changed

deal.owner_changed

deal.amount_changed

note.created

company.archived

task.completed

Structured metadata may contain:

- previous value
- new value
- relevant IDs
- short display snapshot

Do not store secrets or unnecessary sensitive data in activity metadata.

---

## Activity Timeline UX

A Deal detail page may eventually show:

25.09.2026 10:15
Ivan created the Deal

25.09.2026 11:42
Ivan moved Stage:
New → Qualification

25.09.2026 14:30
Anna added a Note

25.09.2026 16:00
Anna changed responsible Member:
Ivan → Anna

This gives users a reliable history of the business process.

---

## Activity Timeline purpose

Activity history will support:

- CRM auditability
- team collaboration
- troubleshooting
- analytics
- automations
- future notifications
- future AI summaries

Do not create Activity Timeline primarily for AI.

The primary purpose is reliable CRM history.

AI may consume this data later through controlled application functions.

---

# Step 12 — Team hardening

Team is working, but some design debt remains.

Improve later:

- replace role-name checks such as "Owner" with a stable role key/system identity
- review last-owner concurrency guarantees
- improve production invitation flow
- add pending invitations if needed
- member detail page
- custom role management UI
- permission editor UI
- better display of inactive members
- ownership reassignment workflows before deactivation where required

Do not block current Deal development on these improvements unless security work
touches the same code.

---

# Step 13 — Active organization

Current active organization remains:

development

Before real multi-organization UX, design:

authenticated user
→ memberships
→ selected organization
→ validated active membership
→ Member
→ roles
→ permissions

Never trust an arbitrary organizationId supplied by the browser.

Possible storage for selected organization may be:

- signed/server-controlled cookie
- URL context plus server validation
- another server-managed preference

The exact design is not decided yet.

Organization switching must never allow access to an organization without a
valid active membership.

---

# Step 14 — Production authentication gaps

Before public production release, address:

- email verification
- forgot password
- password reset
- production email delivery
- login rate limiting
- brute-force protection
- account recovery
- HTTPS
- production cookie settings
- BETTER_AUTH_URL configuration
- secret management
- security logging

These are important but should not block the current local CRM core milestone.

---

# Later roadmap

## Phase 0.3

After Phase 0.2:

- custom fields
- advanced filters
- saved views
- configurable entity fields
- configurable CRM structure

Custom fields are especially important for the universal CRM goal.

Possible future custom field types:

- text
- textarea
- number
- decimal
- currency
- date
- datetime
- checkbox
- select
- multi-select
- email
- phone
- URL
- user/member
- entity reference

Do not implement custom fields until the standard CRM entity lifecycle is
stable.

---

## Phase 0.4

Automation engine:

- triggers
- conditions
- actions

Possible triggers:

- Deal created
- Stage changed
- Task overdue
- Note added
- Client created
- Company archived

Possible conditions:

- Stage equals X
- amount greater than X
- owner equals X
- custom field value
- status

Possible actions:

- create Task
- update field
- assign Member
- move Deal
- create notification
- call future integration

Do not introduce a queue until actual automation workload requires one.

---

## Later infrastructure

Possible future systems:

- audit log
- notifications
- external integrations
- import/export
- webhooks
- API access

Add infrastructure only when justified by real requirements.

---

## Phase 0.5 — AI

AI comes after the CRM core is stable.

Potential AI capabilities:

- natural-language search
- Deal summaries
- Client summaries
- Company summaries
- Note summaries
- Activity Timeline summaries
- suggested Tasks
- analytics
- controlled CRM actions

AI must never have unrestricted database access.

Future AI operations must go through controlled application tools.

Examples:

searchClients()

readClient()

searchCompanies()

readCompany()

readDeal()

readDealNotes()

readDealActivity()

createTask()

updateDeal()

Every AI operation must still pass:

- Better Auth authentication
- active organization membership
- RBAC
- tenant scoping
- input validation
- normal CRM business rules

---

# Architectural rules

## Authentication

Better Auth owns authentication.

Do not build a second password/session system.

Do not manually parse authentication independently throughout the application.

Use centralized helpers.

---

## Authorization

CRM authorization remains application-owned.

Use:

getCurrentMember()

getCurrentAccessContext()

hasPermission()

requirePermission()

Server-side authorization is mandatory.

UI permission checks are only UX.

---

## Multi-tenancy

Every tenant-owned operation must use the authenticated Member's organization.

Never use browser-supplied organizationId as proof of authorization.

---

## Relationships

All submitted relationship IDs must be revalidated.

Examples:

clientId

companyId

dealId

pipelineId

stageId

ownerMemberId

future taskId

future noteId

UUID validity alone is not authorization.

Every relationship must be validated against the current organization.

---

## Validation

Use Zod for external input.

Validate:

- forms
- route parameters
- search parameters
- relationship IDs
- Server Action data
- future API payloads

---

## Database

Use Drizzle ORM.

Generate migrations for schema changes.

Never casually edit an already-applied migration.

Prefer explicit relational constraints where practical.

Do not replace strong relational modeling with generic abstractions without a
clear benefit.

---

## Neon

The current Neon HTTP driver does not use normal interactive transaction
callbacks.

Use supported patterns such as:

db.batch([...])

where appropriate.

Do not overstate concurrency guarantees.

Application-level pre-check followed by a write is not automatically a fully
serialized invariant.

---

## Frontend

Prefer Server Components.

Use Client Components only when actual browser interaction requires them.

Examples:

- dynamic dependent selects
- drag-and-drop
- confirmation interaction
- optimistic UI where justified

Do not convert entire modules to Client Components unnecessarily.

---

## Business record lifecycle

Prefer:

archive
→ restore

over physical deletion for important CRM entities.

This applies especially to:

- Clients
- Companies
- Deals
- Tasks
- Notes

Historical CRM data will later support:

- Activity Timeline
- auditability
- analytics
- automations
- AI summaries

---

## Infrastructure

Do not introduce without a real requirement:

- Redis
- queues
- microservices
- separate backend
- paid infrastructure
- AI API dependencies

Continue with the modular monolith while it remains sufficient.

---

# Immediate next task

Implement and stabilize:

/crm/deals/[id]/edit

Expected flow:

Deal detail
→ Edit
→ validate form
→ validate Pipeline
→ validate Stage belongs to Pipeline
→ validate Company
→ validate responsible Member
→ update Deal
→ apply closedAt rules
→ update updatedAt
→ return to Deal detail

After Deal editing:

1. Deal archive / restore
2. Drag-and-drop Kanban
3. improve multi-currency Kanban totals
4. Pipeline / Stage management
5. Tasks
6. Collaborative Notes / Comments
7. Activity Timeline

The Notes system must support multiple users and show:

- original author
- created time
- edited time
- optional last editor

Do not replace this requirement with a single text field.