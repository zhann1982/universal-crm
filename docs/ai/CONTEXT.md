# Universal CRM — Project Context

Last updated: 2026-09-26

## Goal

Universal CRM is an industry-neutral configurable multi-tenant CRM platform.

The product should eventually allow organizations to configure:

- business processes
- pipelines
- stages
- custom fields
- roles
- permissions
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

---

## Product boundary

The application is currently a modular monolith.

Frontend and server-side business code live in the same Next.js application.

The current architecture is intentionally simple:

- Next.js
- TypeScript
- PostgreSQL
- Neon
- Drizzle
- Better Auth
- Zod
- Tailwind

A separate backend, Redis, queues, microservices and AI infrastructure are not
currently required.

---

## Core domain model

### Organization

The tenant boundary.

Tenant-owned CRM data uses:

organizationId

Current development organization selection is still fixed.

Future organization switching must validate active membership.

---

### User

Authentication identity managed by Better Auth.

Stable identity:

user.id

A User does not automatically have CRM access.

---

### Organization Member

Connects a Better Auth User to an Organization.

Membership controls whether the User belongs to the tenant.

Membership also participates in CRM authorization through Roles.

Inactive membership denies CRM access.

---

### Role

Contains CRM Permissions.

Members may have multiple Roles.

Current system concepts include:

- Owner
- Admin
- Manager
- Viewer

The long-term design needs a stable system role identifier instead of relying
only on mutable Role names.

---

### Permission

Granular server-side authorization capability.

Current groups include:

- clients.*
- companies.*
- deals.*
- pipelines.*
- members.*
- roles.*
- settings.manage

Permission semantics for related reference data still need refinement.

---

### Client

Represents a person/contact.

Client is not the same entity as Company.

Lifecycle:

active
→ archived
→ restored

Normal workflow avoids physical deletion.

---

### Company

Represents a legal/business organization.

Company may have a responsible Member.

Lifecycle:

active
→ archived
→ restored

---

### Client ↔ Company

Many-to-many relationship.

Implemented through:

client_companies

A Client may relate to multiple Companies.

A Company may have multiple Client contacts.

---

### Pipeline

Represents a configurable business/sales process.

An Organization may have multiple Pipelines.

Pipeline management UI is not yet implemented.

---

### Pipeline Stage

Ordered Stage within a Pipeline.

Current Stage types:

- open
- won
- lost

Other attributes include:

- name
- position
- probability
- optional color

Stage type defines Deal state semantics.

---

### Deal

Represents an opportunity/business transaction.

A Deal belongs to:

- Organization
- Pipeline
- Stage

A Deal may reference:

- Company
- responsible Member

Current Deal data includes:

- title
- amount
- currency
- expected close date
- actual closedAt
- description/notes
- archive state
- timestamps

Deal status is not duplicated.

Deal state comes from:

pipeline_stages.type

---

## Deal state model

open Stage:

closedAt = null

won/lost Stage:

closedAt is set

Moving a closed Deal back to open clears closedAt.

Current code has multiple paths for Deal transition.

Target architecture is one shared business transition operation.

---

## Money

Deal amount is stored as PostgreSQL:

numeric(14,2)

Currency is stored separately.

Different currencies must remain separate in summaries.

Current Kanban already groups totals by currency.

Currency conversion is not part of the current product.

---

## Description vs collaborative Notes

Existing `notes` text fields on Client / Company / Deal are simple descriptions.

They are not multi-user collaboration.

Future collaborative Notes are separate records with:

- author
- created time
- edited time
- optional last editor
- lifecycle policy

Activity history is a separate structured event system.

---

## Tasks

Tasks are not implemented yet.

Tasks are expected to become the primary daily-work layer.

Likely relationships:

- Deal
- Client
- Company
- responsible Member

Important future views include:

- today
- overdue
- mine
- Deals without a next action

---

## Activity Timeline

Not implemented yet.

Purpose:

- collaboration
- auditability
- debugging
- historical reporting
- automation input
- future AI summaries

Current entity state alone is not sufficient for historical analytics such as
time spent in Pipeline Stages.

---

## Deal contacts

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

Do not restrict Deal contacts only to the selected Company.

---

## Custom fields

Not implemented.

Future custom fields should support typed definitions and server validation.

Core relationships and financial data should remain relational.

JSONB may be appropriate for less frequently queried custom values, with targeted
indexes added only where needed.

---

## Saved views

Not implemented.

Future saved views must never bypass current permissions.

Likely filters:

- owner
- Pipeline
- Stage
- due date
- amount
- activity age

---

## Automation

Not implemented.

Future model:

event
→ conditions
→ allowed operation

Automation will require:

- idempotency
- loop protection
- execution history
- retries
- limits

External guaranteed delivery may later use PostgreSQL outbox.

Do not introduce a broker until requirements justify it.

---

## AI direction

AI is a later layer.

Start with read-oriented capabilities such as:

- Deal summary
- Client summary
- Company summary
- recommended next action
- permission-aware search

AI changes must call the same business operations used by the application.

AI must not have unrestricted database access.

AI must not bypass RBAC or tenant boundaries.

Collaborative Note text must be treated as untrusted input.

---

## Current architecture concern

The current foundation is suitable.

The main architectural debt is not the choice of framework.

The main debt is that important business rules are distributed between:

- pages
- Server Actions
- helper functions

This creates inconsistent implementations.

The next architectural direction is therefore:

central tenant context
+ small business modules
+ shared operations
+ stronger database invariants

without splitting the modular monolith.