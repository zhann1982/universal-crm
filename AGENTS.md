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
→ only the next 3–5 development priorities

DECISIONS.md
→ accepted or proposed architecture/product decisions and their rationale

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

Every tenant-owned record must belong to an organization.

Primary tenant key:

organizationId

Never accept a browser-provided organizationId as authorization proof.

Server operations must obtain tenant context from authenticated server state.

Target security flow:

session
→ active organization
→ active organization membership
→ permissions
→ business operation

The current development version still uses a fixed development organization.

This is a known temporary limitation.

Future organization selection must validate membership server-side.

---

## Tenant context rule

Do not introduce new business queries that independently guess or resolve the
organization if the caller already has an authenticated access context.

Direction for new/refactored business operations:

authenticated context
→ explicit tenant/member/permissions context
→ business module operation

Business data helpers must not become public authorization boundaries by
accident.

Prefer marking server business modules as server-only.

---

## Authentication

Better Auth owns:

- user identity
- password authentication
- sessions

CRM owns:

- organization membership
- roles
- permissions
- tenant authorization

Do not build a parallel authentication/session implementation.

Stable identity:

Better Auth user.id

CRM membership identity:

organization_members.userId

Do not use email as the long-term authorization identity.

Email may be used only for controlled lookup/invitation workflows.

Identity lookup by email must use exact canonicalized comparison.

Do not use SQL LIKE / ILIKE semantics for identity matching.

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

- current organization
- required permission
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

Check permission semantics for the related data first.

---

## Permission design

Do not assume that one broad permission automatically authorizes every related
directory or field.

Examples that require explicit policy:

- responsible-member picker
- member email visibility
- Dashboard aggregate counts
- company information shown on a Deal
- role assignment
- future exports

If Managers need a limited responsible-member directory, prefer a dedicated
permission or restricted DTO over exposing the complete Team dataset.

Keep permission policy consistent across:

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
- Deal stage transition
- optimistic concurrency
- relationship validation

---

## Deals

Deal state is derived from:

pipeline_stages.type

Valid stage types:

- open
- won
- lost

Do not add an independent Deal status for won/lost state.

Rules:

open
→ closedAt = null

won/lost
→ closedAt is set

Deal stage transitions must use one shared server-side business operation.

The same operation should eventually serve:

- manual stage selector
- Kanban drag-and-drop
- future automation
- future API
- future AI action

Do not allow separate implementations to evolve different transition rules.

A Deal stores:

- organizationId
- pipelineId
- stageId

Stage must belong to the same:

- organization
- pipeline

This must be checked both in application logic and, where practical, by database
constraints.

---

## Concurrency

Do not assume read → validate → write is safe against concurrent requests.

Critical workflows must eventually use optimistic locking, transactional logic or
database-enforced invariants.

Important concurrency-sensitive areas:

- Deal edit
- Deal stage transition
- Deal pipeline change
- archive / restore
- last Owner protection
- future Pipeline changes

For mutable business entities, prefer a version field or equivalent optimistic
locking strategy.

A mutation that updates zero rows because state changed concurrently must not
silently report success.

---

## Database integrity

Application validation remains mandatory, but important invariants should also be
enforced by PostgreSQL where practical.

Priority future constraints include:

- Stage belongs to the same organization and Pipeline
- Deal Stage matches Deal organization + Pipeline
- Client/Company relationships remain in one organization
- Member/Role relationships remain in one organization
- Stage probability is between 0 and 100
- Stage type is one of open/won/lost
- Deal amount/currency consistency
- at most one active default Pipeline per organization if product policy requires it

Composite foreign keys may require corresponding composite unique constraints.

Do not implement unsupported cross-table rules as CHECK constraints with
subqueries.

Validate existing data before adding stricter constraints.

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

Do not describe application pre-checks as concurrency-proof.

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

If archive means immutable, enforce that in Server Actions too.

Do not rely only on UI hiding mutation buttons.

---

## Dates

Do not validate calendar dates using Date.parse alone.

JavaScript may normalize impossible dates.

Required validation must reject examples such as:

- 2026-02-29
- 2026-02-31
- 2026-04-31

For date-only business concepts, prefer a PostgreSQL date model.

Do not invent UTC noon as a permanent timezone solution.

If a timestamp is required, define organization timezone semantics explicitly.

---

## Money

Persistent Deal amounts use PostgreSQL:

numeric(14,2)

Do not use floating point for persisted financial values.

Currency is stored separately.

Money summaries must remain grouped by currency unless an explicit exchange-rate
conversion feature exists.

Do not combine KZT + USD + EUR into one total.

Define negative-amount policy explicitly before production.

---

## Team / Owner

Current Owner-specific rules are not yet concurrency-proof.

Do not use mutable role display names as the long-term system identity.

Target:

stable role systemKey
+ explicit ownership-transfer policy
+ stronger last-Owner invariant

Do not assume members.manage should permanently imply the right to grant every
future privilege.

---

## Health and diagnostics

Public health endpoints must not expose tenant/business counters.

Public readiness should return only minimal service state.

Prefer a lightweight database readiness check such as SELECT 1 if required.

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

---

## Testing direction

New important business rules should have regression tests.

Priority test categories:

- exact email identity lookup
- cross-tenant access denial
- inactive membership denial
- organization inactive denial
- role permissions
- last Owner
- Deal pipeline/stage consistency
- concurrent stage/pipeline changes
- editing while another request archives the record
- impossible dates
- money/currency validation
- archive mutation rules

Prefer PostgreSQL integration tests for database invariants.

Add E2E tests for a small set of critical workflows.

---

## CI direction

Target CI pipeline:

npm ci
→ next typegen
→ TypeScript
→ lint
→ tests
→ build

Do not claim production build success unless the build ran with the required test
configuration/environment.

---

## Accessibility / scale

HTML drag-and-drop is not sufficient as the only interaction.

Keep or add:

- manual Stage selector
- keyboard-friendly alternative
- mobile-friendly alternative

Do not load unbounded datasets indefinitely.

Large collections will require:

- pagination
- search
- incremental loading
- SQL aggregates
- representative performance testing

Optimize indexes after observing real query plans with EXPLAIN ANALYZE.

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

Where consistency matters, entity mutation and event creation should be atomic.

---

## AI

AI must use the same business operations as human UI actions.

AI must never receive unrestricted database access.

Start with read-oriented AI only after core stabilization.

Future AI must respect:

- Better Auth
- active organization
- membership
- permissions
- tenant scope
- normal validation
- business invariants

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

Build:

npm run build

---

## Important principle

Stabilize identity, tenant boundaries, permissions, concurrency and database
invariants before adding more platform complexity.

Do not rewrite the working modular-monolith foundation.