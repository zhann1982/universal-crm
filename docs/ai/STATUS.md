# Universal CRM — Current Status

Last updated: 2026-09-26

Verified repository snapshot:

main
a9333a80d3172e8ce25cc13dc4369c6ab7159f23

Audit date:

2026-09-26

## Status meaning

This file is the single source of truth for current implementation status.

Use these terms carefully:

Implemented
→ code exists in the repository

Manually working
→ behavior has been manually exercised during development

Automatically verified
→ covered by a repeatable automated check/test

Production-ready
→ do not assume unless explicitly stated

The current application is not yet production-ready.

---

# Current phase

CRM Core / early v0.2

The architecture is still a modular monolith.

No rewrite or microservice extraction is currently required.

The current priority is stabilization before adding more major product modules.

---

# Stack

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

---

# Automated/static verification from 2026-09-26 audit

Successful:

- npm ci --ignore-scripts --no-audit --no-fund
- ESLint
- next typegen
- TypeScript tsc --noEmit after typegen

Production build:

Compilation and TypeScript passed.

The audited environment stopped during route data collection because
DATABASE_URL was not configured.

Therefore a complete production build was not verified by that audit.

No GitHub Actions workflows currently exist.

No dependency vulnerability audit was performed.

---

# Implemented capabilities

## Authentication

Implemented:

- Better Auth
- registration
- login
- logout
- session cookies
- server-side session resolution

Authentication method:

email + password

Known production gap:

mandatory email ownership verification is not currently part of the membership
workflow.

---

## Membership / RBAC

Implemented:

- Organization membership
- active/inactive Member state
- multiple Roles per Member
- Permissions
- permission checks
- Team listing
- adding an already-registered User to an Organization
- role assignment/update
- Member activation/deactivation
- self-role protection
- self-deactivation protection
- application-level last-Owner check

Known limitation:

last-Owner protection is not concurrency-safe.

Owner is currently identified by Role name.

---

## Clients

Implemented:

- create
- list
- detail
- edit
- archive
- restore
- search
- filters
- pagination
- tenant scoping
- RBAC

---

## Companies

Implemented:

- create
- list
- detail
- edit
- archive
- restore
- search
- filters
- pagination
- responsible Member
- linked Clients
- tenant scoping
- RBAC

Known inconsistency:

editing a Company with an unchanged inactive responsible Member can be rejected by
the Server Action even though the UI can display that Member.

---

## Client ↔ Company

Implemented:

- many-to-many relationship
- link
- unlink
- reverse display

Known issue:

the unlink Server Action does not currently enforce the same archived-Client
immutability policy as the UI.

---

## Pipelines / Stages

Implemented in database:

- Pipelines
- ordered Stages
- Stage type
- Stage probability
- Stage color
- Pipeline selection in Deals UI

Seed creates a default Pipeline and standard Stages.

Not implemented:

- Pipeline management UI
- Stage management UI

Database invariants are not yet strong enough to guarantee all
organization/Pipeline/Stage relationships.

---

## Deals

Implemented:

- create
- detail
- edit
- Pipeline change
- Stage change
- Company assignment
- responsible Member assignment
- expected close date
- description/notes
- archive
- restore
- archive view
- Kanban
- HTML drag-and-drop
- manual Stage selector
- server-side drag/drop validation
- closedAt handling
- currency-separated totals
- RBAC
- tenant scoping

Not implemented:

- optimistic locking
- shared single transition operation
- direct Deal ↔ Client contacts
- activity history
- next-action Task
- pagination/incremental Kanban loading

---

## Money

Implemented:

- PostgreSQL numeric(14,2)
- currency field
- Kanban totals grouped by currency
- individual Deal currency formatting

Known policy gaps:

- negative amount policy is not explicitly defined
- database-level amount/currency consistency is not fully enforced

---

## Dashboard

Implemented:

basic CRM Dashboard.

Known permission issue:

Dashboard aggregate counts are not yet governed by sufficiently explicit
per-module permission semantics.

---

## Collaborative Notes

Not implemented.

Current `notes` fields are single text descriptions only.

Future Notes require separate records.

---

## Tasks

Not implemented.

---

## Activity Timeline / Audit History

Not implemented.

---

## Custom Fields

Not implemented.

---

## Saved Views

Not implemented.

---

## Automation

Not implemented.

---

## AI

Not implemented.

This is intentional.

---

# Audit findings

Priority definitions:

P1
→ fix before public launch or serious collaborative use

P2
→ fix in the next stabilization cycle

---

## F01 — P1 — Email identity lookup uses ILIKE

Current affected workflows include:

- Team add-member lookup
- development Owner linking helper

Risk:

PostgreSQL LIKE/ILIKE treats `_` as a wildcard.

An email containing `_` can match another email.

Potential result:

wrong Better Auth User can be associated with a CRM membership.

Required fix:

- canonicalize email
- use exact equality
- guarantee unique result
- add regression test with `_`

---

## F02 — P1 — Organization membership can be granted to an unverified email account

Registration is open.

The Team add-member flow can locate an account by email and immediately create
membership.

It does not currently require confirmed email ownership or invitation acceptance.

Risk:

someone may pre-register another person's business email and later receive CRM
access when an administrator adds that address.

Required direction:

- verified email ownership
and/or
- invitation token + acceptance flow

Production Owner bootstrap must also respect verified identity.

---

## F03 — P1 — Public database health endpoint exposes global counters

Current health endpoint returns aggregate counts without authentication or tenant
scope.

Risk:

cross-tenant aggregate information disclosure and unnecessary database load.

Required fix:

public readiness should return only minimal status.

If DB readiness is required, prefer a lightweight connectivity query.

Administrative diagnostics must be separately protected.

---

## F04 — P1 — Manual Deal Stage transition has a concurrency race

Current manual Stage movement and Kanban movement do not use exactly the same
update rule.

Possible race:

request A validates Pipeline P1 + Stage S1
→ request B edits Deal to Pipeline P2 + Stage S2
→ request A updates only stageId
→ resulting Deal can become P2 + S1

Required fix:

- one shared transition operation
- conditional update against expected/current Pipeline or version
- verify affected row
- stronger database invariant
- concurrency regression test

---

## F05 — P2 — Related-data permission policy is inconsistent

Examples:

- Manager lacks members.read
- some Company forms still expose active Member names/emails
- Deal assignment uses a different rule
- Dashboard exposes broad counters
- Deals board serializes owner email/company name without a fully explicit related-data permission policy

This is not a confirmed cross-tenant leak.

It is an inconsistent permission model.

Required fix:

define explicit policy for:

- responsible-member directory
- member email visibility
- Dashboard aggregates
- related Company visibility

Check permissions before query/serialization, not only before showing a link.

---

## F06 — P2 — Last Owner protection is race-prone

Current protection:

read current Owners
→ validate
→ later write

Two concurrent administrators may both pass the pre-check.

db.batch does not include the earlier read in the same serialized operation.

Required fix:

design a database/transactional ownership update operation.

---

## F07 — P2 — Organization isActive is not part of access context

organizations.isActive exists.

Current access flow checks active membership but does not consistently reject an
inactive Organization.

Required fix:

define isActive semantics and enforce it in the central tenant context.

---

## F08 — P2 — Inactive Company owner blocks unrelated Company edits

UI can preserve the current inactive owner.

Server validation requires active owner even when unchanged.

Required fix:

use the same pattern already used in Deal editing:

- existing relationship may remain
- a newly assigned responsible Member must be active

---

## F09 — P2 — Impossible dates pass Deal validation

Confirmed examples:

- 2026-02-29
- 2026-02-31
- 2026-04-31

Date.parse normalizes invalid dates.

Current artificial noon-UTC conversion also does not represent a stable
date-only business model across every timezone.

Required fix:

- strict calendar validation
- decide whether expectedCloseAt is a date or timestamp
- if date-only, prefer PostgreSQL date
- if timestamp, define organization timezone semantics

---

## F10 — P2 — Concurrent edits can overwrite newer state

Current Deal edit submits the full record without optimistic locking.

Possible effects:

- lost updates
- Stage overwrite
- responsible Member overwrite
- notes/description overwrite
- stale closedAt calculation

Another issue:

if a Deal is archived between read and update, zero affected rows may still lead
to an apparent successful redirect.

Required fix:

- add version / optimistic locking
- update using expected version
- atomically increase version
- treat zero updated rows as conflict
- define archive/restore idempotency behavior

---

## F11 — P2 — Archived Client relation can still be mutated server-side

UI hides unlinking for archived Client.

Server Action does not enforce the same archive condition.

Required fix:

if archived records are immutable, add the lifecycle condition to the server
mutation itself.

---

## F12 — P2 — Unbounded loading

Current structural limits include:

- all Deals for selected Pipeline loaded into Kanban
- full Deal archive without pagination
- complete reference lists in several forms
- potentially all active Companies loaded for relationship selectors

This is not currently a measured performance failure.

It is a scaling limit.

Required direction:

- pagination
- per-column incremental loading
- searchable reference pickers
- SQL counts/aggregates
- representative performance test
- EXPLAIN ANALYZE before index tuning

---

# Architectural debt

## Business logic distribution

Important rules currently exist in multiple:

- pages
- Server Actions
- helpers

Deal actions are especially large.

Target:

small domain modules inside the same modular monolith.

---

## Tenant context

Current entity helpers may resolve the fixed development Organization internally.

Pages currently often check access first, but this contract is easy to misuse in
future API/AI code.

Target:

authenticated tenant context as explicit input to business operations.

---

## Database invariants

Current application validation is stronger than current database relationship
constraints.

Priority future database protection:

- Organization ↔ Pipeline ↔ Stage
- Deal Pipeline ↔ Stage
- Organization ↔ Company/Client/Member relations
- Member ↔ Role
- Stage type
- Stage probability
- amount/currency consistency
- single default Pipeline if chosen as a product invariant

---

## Role model

Owner uses mutable name identity.

organization_members.userId does not currently have a fully designed lifecycle
FK relationship to Better Auth user.

Development seed still creates legacy fake Members.

These need deliberate cleanup rather than blind deletion.

---

# Operational gaps

Not yet implemented or confirmed:

- CI workflow
- automated regression suite
- PostgreSQL integration tests
- E2E tests
- production email flow
- production password recovery
- verified backup restore procedure
- structured operational error events
- production observability
- complete project README/bootstrap guide
- .env.example
- separate test environment

tsx should eventually be an explicit devDependency because scripts use it.

---

# Minor improvements

Future cleanup:

- deterministic secondary Client sorting by id when createdAt ties
- shared money formatter
- lang="ru"
- real metadata
- responsive navigation
- mobile/keyboard alternative to DnD

Manual Stage movement already provides a non-DnD alternative.

---

# Current recommended direction

Do not immediately add another large product feature.

First stabilize:

1. identity lookup and account ownership
2. public health exposure
3. Deal transition concurrency
4. permission semantics
5. validation and optimistic concurrency

Then strengthen tenant context, business operations, database constraints and
tests.

After that continue product development with:

Tasks
→ Collaborative Notes
→ Activity Timeline
→ Pipeline management
→ Deal contacts