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
- notes

Requirements:

- deals.update
- tenant-scoped Deal lookup
- tenant-scoped Pipeline validation
- Stage must belong to selected Pipeline
- Company must belong to current organization
- Company must not be deleted
- selected responsible member must belong to current organization
- selected responsible member should be active
- Zod validation
- updatedAt must be updated

If pipeline changes, stage selection must also change to a valid stage in the new
pipeline.

Do not allow a stage from another pipeline to be submitted through manipulated
form data.

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

If Deal editing changes the stage, apply the same rules used by manual stage
movement.

Avoid duplicating this logic in many independent places.

A small reusable server helper may be appropriate once Deal editing is added.

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
- archived Deals should not appear in the normal Kanban

Decide whether archived Deal detail remains readable.

Prefer archive / restore over physical deletion.

---

# Step 4 — Drag-and-drop Kanban

After manual stage movement and edit behavior are stable, add drag-and-drop.

Target UX:

Deal card
→ drag
→ drop into another stage
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

Do not allow drag/drop to mutate pipelineId implicitly.

Cross-pipeline movement should happen through explicit Deal editing or a later
dedicated action.

---

# Step 5 — Improve Kanban summaries

Current board shows counts and monetary totals.

Before adding more analytics, decide how to handle multiple currencies.

Current simple total:

Number(deal.amount)

is acceptable only as a temporary display when data is effectively one currency.

Do not present:

KZT + USD + EUR

as one meaningful financial total.

Possible next approach:

group stage totals by currency.

Example:

KZT 1 500 000
USD 4 000

Do not implement exchange-rate conversion without a concrete product requirement.

---

# Step 6 — Pipeline management UI

Current database supports multiple Pipelines and Stages.

Current seed creates:

Основная воронка

with standard stages.

Add administration UI for:

- create Pipeline
- rename Pipeline
- archive Pipeline
- choose default Pipeline
- create Stage
- rename Stage
- reorder Stage
- probability
- type: open / won / lost
- optional color

Permission:

pipelines.manage

Important constraints:

A Pipeline or Stage currently referenced by Deals must not be casually deleted.

Prefer archive / controlled migration over destructive deletion.

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

Current database does not enforce all of these.

Do not add constraints until the desired product behavior is clear.

---

# Step 8 — Deal relationships

Current Deal directly supports:

- Company
- responsible Member

Current Deal does not directly reference a Client/contact.

After basic Deal lifecycle is complete, decide whether Deals need:

- one primary Client
- many Client contacts
- reuse of client_companies
- dedicated deal_clients join table

Do not add a single clientId without deciding the desired CRM relationship model.

For a universal CRM, a many-to-many Deal ↔ Client relationship may eventually be
more flexible.

---

# Step 9 — Tasks

After Deals and Pipeline interaction are stable, begin Tasks.

Likely Task fields:

- title
- description
- dueAt
- status
- priority
- ownerMemberId
- createdByMemberId
- completedAt
- organizationId
- createdAt
- updatedAt

Tasks should eventually be linkable to business entities such as:

- Client
- Company
- Deal

Do not over-generalize the first implementation before the real workflow is
tested.

---

# Step 10 — Comments and activity timeline

After Tasks:

Comments

Activity timeline

Likely tracked Deal events:

- Deal created
- Stage changed
- Pipeline changed
- amount changed
- responsible member changed
- archived
- restored

Activity history will later be important for:

- CRM auditability
- analytics
- automations
- AI summaries

Design history data before introducing AI summaries.

---

# Step 11 — Team hardening

Team is working, but some design debt remains.

Improve later:

- replace role-name checks such as "Owner" with a stable role key/system identity
- review last-owner concurrency guarantees
- improve production invitation flow
- add pending invitations if needed
- member detail page
- custom role management UI
- permission editor UI

Do not block current Deal development on these improvements unless security work
touches the same code.

---

# Step 12 — Active organization

Current active organization remains:

development

Before real multi-organization UX, design:

authenticated user
→ memberships
→ selected organization
→ validated active membership
→ member
→ roles
→ permissions

Never trust an arbitrary organizationId supplied by the browser.

Possible storage for selected organization may be:

- signed/server-controlled cookie
- URL context plus server validation
- another server-managed preference

The exact design is not decided yet.

---

# Step 13 — Production authentication gaps

Before public production release, address:

- email verification
- forgot password
- password reset
- production email delivery
- rate limiting
- brute-force protection
- account recovery
- HTTPS
- production cookie settings
- secret management

These are important but should not block the current local CRM core milestone.

---

# Later roadmap

After Phase 0.2:

Phase 0.3:

- custom fields
- advanced filters
- saved views
- configurable entity fields
- configurable CRM structure

Phase 0.4:

- automation engine
- triggers
- conditions
- actions

Later:

- audit log
- external integrations

Phase 0.5:

- AI assistant
- natural-language search
- summaries
- analytics
- controlled AI actions

---

# Architectural rules

## Authentication

Better Auth owns authentication.

Do not build a second password/session system.

---

## Authorization

CRM authorization remains application-owned.

Use:

getCurrentMember()

getCurrentAccessContext()

hasPermission()

requirePermission()

Server-side authorization is mandatory.

---

## Multi-tenancy

Every tenant-owned operation must use the authenticated member's organization.

Never use browser organizationId as proof of authorization.

---

## Relationships

All submitted relationship IDs must be revalidated.

Examples:

clientId
companyId
pipelineId
stageId
ownerMemberId

UUID validity alone is not authorization.

---

## Validation

Use Zod for external input.

---

## Database

Use Drizzle migrations.

Never casually edit an already-applied migration.

---

## Neon

The current Neon HTTP driver does not use normal interactive transaction
callbacks.

Use supported patterns such as db.batch where appropriate.

Do not overstate concurrency guarantees.

---

## Frontend

Prefer Server Components.

Use Client Components only for actual interaction such as:

- dynamic dependent selects
- drag-and-drop
- confirmation interaction

---

## Infrastructure

Do not introduce without a real requirement:

- Redis
- queues
- microservices
- separate backend
- paid infrastructure
- AI API dependencies

---

# Immediate next task

Implement:

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
→ return to Deal detail

After that:

Deal archive / restore
→ drag-and-drop Kanban
→ Pipeline management
→ Tasks
→ Comments
→ Activity timeline