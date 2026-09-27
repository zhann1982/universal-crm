# AGENTS.md

## Project

Universal CRM is a configurable multi-tenant CRM platform.

The product must remain industry-neutral.

Long-term configurable areas include:

- business processes
- pipelines
- stages
- custom fields
- roles
- permissions
- saved views
- workflows
- automations

AI comes after the CRM core, authorization model and business operations are
stable.

Do not let AI requirements drive the core architecture prematurely.

---

## Source of truth

Before significant work, read in this order:

1. AGENTS.md
2. docs/ai/CONTEXT.md
3. docs/ai/STATUS.md
4. docs/ai/NEXT.md
5. docs/ai/DECISIONS.md

Responsibilities:

AGENTS.md
→ durable implementation rules

CONTEXT.md
→ product goal, domain model and terminology

STATUS.md
→ current implemented state, verified state, known limitations and audit findings

NEXT.md
→ only current development priorities

DECISIONS.md
→ architecture/product decisions and their rationale

Do not duplicate large status lists across these files.

If documentation disagrees with code:

1. inspect the current implementation
2. verify the relevant behavior
3. update STATUS/NEXT
4. do not reimplement an already existing feature

Keep separate meanings for:

- code exists
- manually tested
- automatically tested
- production-ready

Do not describe one as another.

---

## Decision IDs

Architecture Decision IDs are permanent.

Never renumber existing:

D001
D002
...
Dn

Do not reuse deleted or obsolete numbers.

New decisions receive the next unused ID.

Existing decisions may change:

- status
- wording
- implementation notes

without changing their ID.

This rule exists so audit reports, commits, AI agents and historical discussions
can safely reference decisions.

---

## Current stack

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

Architecture:

- Next.js App Router
- modular monolith
- Server Components by default
- Server Actions for application mutations
- PostgreSQL primary datastore
- server-side authorization
- multi-tenancy

Do not add infrastructure without a concrete requirement.

Avoid premature introduction of:

- Redis
- queues
- microservices
- separate backend services
- vector databases
- dedicated AI backend
- paid infrastructure

Development infrastructure should remain close to $0 where practical.

---

## Multi-tenancy

Multi-tenancy is a core invariant.

Every tenant-owned record must belong to an Organization.

Primary tenant key:

organizationId

Never accept a browser-provided organizationId as authorization proof.

Server operations must obtain tenant context from authenticated server state.

Current security flow:

session
→ verified User
→ active Organization
→ active Organization Membership
→ Permissions
→ business operation

The current development version still uses a fixed development Organization.

This is a known temporary limitation.

Future Organization selection must validate Membership server-side.

---

## Active Organization

organizations.isActive has security meaning.

Inactive Organization:

→ no normal CRM business access

Do not bypass the active-Organization check in new business entry points.

Future:

- API routes
- automation
- AI
- Organization switching

must preserve the same invariant.

Deactivating an Organization does not imply deleting its data.

---

## Tenant context rule

Do not introduce new business queries that independently guess or resolve the
Organization if the caller already has an authenticated access context.

Direction for new/refactored business operations:

authenticated context
→ explicit tenant/member/permissions context
→ business module operation

Business data helpers must not become public authorization boundaries by
accident.

Prefer marking server business modules as server-only where appropriate.

---

## Authentication

Better Auth owns:

- user identity
- password authentication
- sessions
- email verification tokens

CRM owns:

- Organization Membership
- Roles
- Permissions
- tenant authorization

Do not build a parallel authentication/session implementation.

Stable identity:

Better Auth user.id

CRM Membership identity:

organization_members.userId

Do not use email as the long-term authorization identity.

Email may be used only for controlled lookup/invitation workflows.

---

## Verified email

Normal CRM access requires verified email ownership.

A valid Better Auth Session alone is not sufficient.

Current CRM rule:

session.user.emailVerified = true

Development login may still be possible before verification so a User can
complete the verification flow.

Do not weaken CRM access by treating mere registration as proof of email
ownership.

Production Membership acquisition should eventually use:

verified identity
+ secure invitation acceptance

---

## Email identity lookup

Identity lookup by email must use exact canonicalized comparison.

Do not use:

LIKE
ILIKE

for identity matching.

Current canonicalization:

trim
→ lowercase

Characters such as:

_
%

must be treated literally.

If canonical lookup produces multiple matches:

stop

Do not choose an arbitrary User.

---

## Authorization

Authorization must be enforced server-side.

Client-side visibility is UX only.

Primary helpers currently include:

- getCurrentMember()
- getCurrentAccessContext()
- hasPermission()
- requirePermission()

A valid UUID is never proof that the caller may access the referenced record.

For every relationship ID validate:

- current Organization
- required Permission
- record lifecycle state
- relationship-specific invariants

Examples:

- clientId
- companyId
- dealId
- pipelineId
- stageId
- memberId
- roleId
- future taskId
- future noteId

Do not fetch or serialize related data merely because the parent record is
visible.

Check Permission semantics for the related data first.

---

## Permission design

Do not assume one broad Permission automatically authorizes every related
directory or field.

Examples requiring explicit policy:

- responsible-member picker
- Member email visibility
- Dashboard aggregate counts
- Company information shown on a Deal
- Role assignment
- future exports

If Managers need a limited responsible-member directory, prefer:

- dedicated Permission
or
- restricted assignment DTO

over exposing the complete Team dataset.

Keep Permission policy consistent across:

- create forms
- edit forms
- detail pages
- Dashboard
- Server Actions
- API routes
- future AI tools

---

## Business operations

Do not duplicate important business rules across pages and Server Actions.

Prefer small domain modules inside the same Next.js application.

Target direction:

src/modules/deals/
src/modules/companies/
src/modules/team/
src/modules/clients/

A module may contain:

- operations
- queries
- validation
- domain rules

Server Actions should primarily:

1. parse request/form data
2. obtain authenticated access context
3. call a business operation
4. translate result into UI response / redirect

Do not build a generic repository layer for every entity.

Extract shared code only for rules that are actually shared.

Priority shared rules include:

- tenant context
- responsible-member assignment
- archive lifecycle
- Deal Stage transition
- optimistic concurrency
- relationship validation

---

## Deals

Deal state is derived from:

pipeline_stages.type

Valid Stage types:

- open
- won
- lost

Do not add an independent Deal status for won/lost state.

Rules:

open
→ closedAt = null

won/lost
→ closedAt is set

A Deal stores:

- organizationId
- pipelineId
- stageId

Stage must belong to the same:

- Organization
- Pipeline

This must be checked in application logic and, where practical, by database
constraints.

---

## Deal Stage transition

Deal Stage transition uses the shared business operation:

src/modules/deals/transition-deal.ts

Do not create a second Stage transition implementation.

Current and future callers should reuse this operation or a deliberate successor.

Expected callers include:

- manual Stage selector
- Kanban drag-and-drop
- future automation
- future API
- future AI action

The operation owns:

- tenant validation
- active Deal lifecycle
- current Pipeline validation
- target Stage validation
- Stage type semantics
- closedAt rules
- optimistic concurrency

---

## Deal optimistic locking

Deal has:

version integer not null default 1

Every real Deal business mutation must increment version.

Current examples:

- full edit
- Stage transition
- archive
- restore

A stale mutation must not silently overwrite newer state.

Preferred update pattern:

WHERE id = ?
AND organizationId = ?
AND version = expectedVersion
AND lifecycle conditions...

SET ...
version = version + 1

If zero rows are updated:

→ do not report success
→ return/translate an explicit conflict or deliberate idempotent result

A no-op operation that changes no business state does not need to increment
version.

When adding a new Deal mutation path, verify version handling explicitly.

---

## Concurrency

Do not assume:

read
→ validate
→ write

is safe against concurrent requests.

Critical workflows must use:

- optimistic locking
- atomic SQL
- transactional logic
- database-enforced invariant

as appropriate.

Important concurrency-sensitive areas include:

- Deal edit
- Deal Stage transition
- Deal Pipeline change
- archive / restore
- last Owner protection
- future Pipeline changes

A mutation that updates zero rows because expected state changed must not silently
report success.

Do not describe pre-checks alone as concurrency-proof.

---

## Existing inactive relationships

If an already-existing responsible Member later becomes inactive, unrelated
record editing should generally remain possible.

Current pattern:

unchanged inactive owner
→ may remain

new owner assignment
→ new owner must be active

Use this pattern deliberately where historical references must remain stable.

Do not silently generalize this rule to every relationship without checking the
domain semantics.

---

## Database integrity

Application validation remains mandatory.

Important invariants should also be enforced by PostgreSQL where practical.

Priority future constraints include:

- Stage belongs to same Organization and Pipeline
- Deal Stage matches Deal Organization + Pipeline
- Client/Company relationships remain in one Organization
- Member/Role relationships remain in one Organization
- Stage probability is between 0 and 100
- Stage type is open/won/lost
- Deal amount/currency consistency
- at most one active default Pipeline per Organization if product policy
  confirms it

Composite foreign keys may require corresponding composite unique constraints.

Do not implement unsupported cross-table rules as CHECK constraints with
subqueries.

Validate existing data before adding stricter constraints.

Do not edit already-applied migrations.

Create a new migration.

---

## Neon / transactions

Current database access uses Neon serverless HTTP.

Do not assume ordinary interactive:

db.transaction(async (tx) => ...)

is available in the current path.

db.batch([...]) can group supported writes but does not make earlier pre-checks
part of the same serialized transaction.

For invariants requiring locking or serialized checks, explicitly design one of:

- suitable atomic SQL operation
- PostgreSQL function/procedure
- transactional driver for that operation
- database constraint
- optimistic locking

---

## Lifecycle

Important CRM records normally use:

archive
→ restore

instead of physical deletion.

Current examples:

- Clients
- Companies
- Deals

Future likely examples:

- Tasks
- Notes

If archive means immutable, enforce that in Server Actions/business operations.

Do not rely only on UI hiding mutation buttons.

Direct Server Action/API calls must obey the same lifecycle rules.

---

## Dates

Do not validate calendar dates using Date.parse alone.

JavaScript may normalize impossible dates.

Required validation must reject examples such as:

- 2026-02-29
- 2026-02-31
- 2026-04-31

For date-only business concepts, prefer PostgreSQL date.

Do not invent UTC noon as a permanent timezone solution.

If timestamp semantics are required, define Organization timezone semantics
explicitly.

---

## Money

Persistent Deal amounts use PostgreSQL:

numeric(14,2)

Do not use floating point for persisted financial values.

Currency is stored separately.

Money summaries must remain grouped by currency unless an explicit exchange-rate
conversion feature exists.

Do not combine KZT + USD + EUR into one total.

Define database-level amount/currency consistency before production.

---

## Team / Owner

Current Owner-specific rules are not yet concurrency-proof.

Do not use mutable Role display names as the long-term system identity.

Target:

stable Role systemKey
+ explicit ownership-transfer policy
+ stronger last-Owner invariant

Do not assume members.manage should permanently imply the right to grant every
future privilege.

---

## Health and diagnostics

Public health endpoints must not expose tenant/business counters.

Public database readiness uses a lightweight connectivity query.

Public readiness should return only minimal service state.

Do not return raw database error text to anonymous clients.

Administrative diagnostics must be separately protected.

---

## Validation

Validate external input with Zod.

Examples:

- forms
- route parameters
- search parameters
- relationship IDs
- Server Action payloads
- future API inputs

Schema validation is not authorization.

Authorization and tenant checks must follow separately.

---

## Security

Never commit:

- .env
- .env.local
- DATABASE_URL
- BETTER_AUTH_SECRET
- passwords
- tokens
- API keys
- private credentials

If a secret is committed, rotate it.

Deleting it from a later commit is not sufficient.

Do not log complete forms or secrets in production error logs.

Development verification URLs must never become the production email-delivery
mechanism.

---

## Testing direction

New important business rules should have regression tests.

Current automated coverage is still small.

Priority test categories include:

- exact email identity lookup
- verified identity access
- cross-tenant access denial
- inactive Membership denial
- inactive Organization denial
- Role Permissions
- last Owner
- Company unchanged inactive owner
- Deal Pipeline/Stage consistency
- stale Deal version
- concurrent Stage changes
- archive during stale edit
- archive/restore lifecycle
- impossible dates
- money/currency validation
- archived relationship mutation rules

Prefer PostgreSQL integration tests for database invariants.

Add E2E tests for a small set of critical workflows.

---

## CI direction

Target CI pipeline:

npm ci
→ next typegen
→ npx tsc --noEmit --incremental false
→ npm run lint
→ npm test
→ npm run build

Do not claim production build success unless the build ran with the required
test configuration/environment.

Never point CI integration tests at the production database.

---

## Accessibility / scale

HTML drag-and-drop is not sufficient as the only interaction.

Keep:

- manual Stage selector
- keyboard-friendly path
- mobile-friendly path

Do not load unbounded datasets indefinitely.

Large collections will require:

- pagination
- search
- incremental loading
- SQL aggregates
- representative performance testing

Optimize indexes after observing real query plans with:

EXPLAIN ANALYZE

---

## Collaborative Notes and Activity

Current entity `notes` fields are descriptions, not collaborative Notes.

Future collaborative Notes must be separate records with:

- author
- created time
- updated time
- optional last editor
- soft-delete policy

Activity Timeline is separate from Notes.

Business state changes should eventually record structured events.

Where consistency matters, entity mutation and Activity event creation should be
atomic.

---

## Tasks

Tasks are expected to be the next major product module after stabilization.

Do not begin a large Tasks implementation while critical authorization,
lifecycle and concurrency issues are still unresolved.

Tasks should use the same:

- tenant context
- RBAC
- relationship validation
- lifecycle rules
- concurrency discipline

as existing CRM entities.

---

## AI

AI must use the same business operations as human UI actions.

AI must never receive unrestricted database access.

Start with read-oriented AI only after core stabilization.

Future AI must respect:

- Better Auth
- verified User identity
- active Organization
- active Membership
- Permissions
- tenant scope
- validation
- business invariants
- optimistic locking
- Activity logging

Treat Note/comment text as untrusted input.

Minimize data sent to external AI services.

---

## Development commands

Development:

npm run dev

Generate migration:

npm run db:generate

Apply migrations:

npm run db:migrate

Seed:

npm run db:seed

Link development Owner:

npm run db:link-owner -- email@example.com

Type generation:

npx next typegen

TypeScript check:

npx tsc --noEmit --incremental false

Lint:

npm run lint

Tests:

npm test

Build:

npm run build

---

## Documentation maintenance

After significant implementation work:

update:

docs/ai/STATUS.md

and:

docs/ai/NEXT.md

Update:

docs/ai/DECISIONS.md

only when:

- a new architectural/product decision is made
- a proposed decision becomes accepted
- the implementation status of an existing decision materially changes

Update:

docs/ai/CONTEXT.md

when the product/domain model materially changes.

Do not update documentation merely to make timestamps newer.

---

## Important principle

Stabilize:

identity
→ tenant boundaries
→ Permissions
→ lifecycle
→ concurrency
→ database invariants
→ tests

before adding more platform complexity.

Do not rewrite the working modular-monolith foundation.