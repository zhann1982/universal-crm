# AGENTS.md

## Project

Universal CRM is a configurable multi-tenant CRM platform.

The product must remain industry-neutral. Long-term configurable areas include:

- business processes
- Pipelines
- Stages
- custom fields
- Roles
- Permissions
- saved views
- workflows
- automations

AI comes after the CRM core, authorization model and business operations are stable.

---

## Source of truth

Before significant work, read in this order:

1. `AGENTS.md`
2. `docs/ai/CONTEXT.md`
3. `docs/ai/STATUS.md`
4. `docs/ai/NEXT.md`
5. `docs/ai/DECISIONS.md`

Responsibilities:

- `AGENTS.md` — durable implementation rules
- `CONTEXT.md` — product goal, domain model and terminology
- `STATUS.md` — current implementation and verification state
- `NEXT.md` — current development priorities
- `DECISIONS.md` — architecture/product decisions and rationale

If documentation disagrees with code, inspect the current implementation, verify behavior, then update STATUS/NEXT. Do not reimplement an already existing feature.

Keep separate meanings for:

- code exists
- manually tested
- automatically tested
- production-ready

---

## Decision IDs

Decision IDs are permanent.

Never renumber or reuse existing IDs. New decisions receive the next unused ID.

Current latest decision: `D045`.

---

## Stack

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
- Server Actions for mutations
- PostgreSQL primary datastore
- server-side authorization
- organization-based multi-tenancy

Do not add Redis, queues, microservices, a separate backend, vector databases, a dedicated AI backend, or paid infrastructure without a concrete requirement.

---

## Multi-tenancy and access

Organization is the tenant boundary.

Tenant-owned business records use `organizationId`.

Never trust browser-provided `organizationId` as authorization proof.

Current access chain:

session
→ verified User
→ active Organization
→ active Membership
→ Permissions
→ business operation

Current development still uses the fixed Organization:

`slug = development`

Future Organization switching must validate active Membership server-side.

---

## Authentication

Better Auth owns:

- User identity
- password authentication
- sessions
- email verification tokens

CRM owns:

- Organization Membership
- Roles
- Permissions
- tenant authorization

Stable User identity is Better Auth `user.id`.

`organization_members.userId` maps CRM Membership to the Better Auth User.

Email is not the long-term authorization identity.

Normal CRM access requires verified email ownership.

---

## Email identity

Identity lookup by email uses canonical exact comparison:

trim
→ lowercase
→ exact equality

Never use `LIKE` or `ILIKE` for identity matching.

Characters such as `_` and `%` are literal.

Ambiguous canonical matches must be rejected.

---

## Authorization

Authorization is enforced server-side.

Client-side visibility is only UX.

Primary helpers:

- `getCurrentMember()`
- `getCurrentAccessContext()`
- `hasPermission()`
- `requirePermission()`

A valid UUID is never proof of access.

For every relationship ID validate:

- current Organization
- required Permission
- lifecycle state
- relationship-specific invariants

Do not fetch or serialize related data merely because the parent record is visible.

---

## Related-data / assignment policy

Accepted decision: `D045`.

Responsible Member assignment:

- with `members.read`: may assign any active Member in the Organization
- without `members.read`: may assign only self or no owner

Existing responsible Member:

- may remain unchanged
- may remain if inactive
- may remain if the current User cannot otherwise browse that Member

Assignment DTOs must not include Member email unless product behavior explicitly requires it.

Responsible Member display:

- with `members.read`: real display name may be shown
- without `members.read`, self: own display name may be shown
- without `members.read`, another Member: use neutral `Сотрудник`

Related entity visibility follows the target module read permission:

- Company data in Deal views requires `companies.read`
- linked Client data in Company views requires `clients.read`
- Dashboard aggregates require the corresponding module `.read`

Server mutations enforce assignment rules independently of UI controls.

---

## Existing inactive relationships

Current pattern:

unchanged inactive owner
→ may remain

new owner assignment
→ new owner must be active

Do not block unrelated record edits because the already-existing owner became inactive.

---

## Deals

Deal state derives from `pipeline_stages.type`.

Valid Stage types:

- open
- won
- lost

Rules:

open
→ `closedAt = null`

won/lost
→ `closedAt` set

A Deal stores:

- organizationId
- pipelineId
- stageId

Stage must belong to the same Organization and Pipeline.

---

## Shared Deal Stage transition

Use:

`src/modules/deals/transition-deal.ts`

Do not create another independent Stage-transition implementation.

The shared operation owns:

- tenant validation
- active Deal lifecycle
- current Pipeline validation
- target Stage validation
- Stage type semantics
- `closedAt`
- optimistic concurrency

Manual selector, Kanban and future automation/API/AI Stage changes should use the same operation.

---

## Deal optimistic locking

Deal has:

`version integer not null default 1`

Every real Deal mutation increments version.

Current mutation examples:

- full edit
- Stage transition
- archive
- restore

A stale mutation must not silently overwrite newer state.

Preferred conditional update:

- id
- organizationId
- expected version
- lifecycle state
- deletedAt state

Zero affected rows must not be reported as success.

A no-op that changes no business state does not need to increment version.

---

## Deal expectedCloseAt

Accepted decision: `D044`.

`expectedCloseAt` is a date-only calendar value.

Storage:

PostgreSQL `date`

Application representation:

`YYYY-MM-DD`

Rules:

- strict calendar validation
- reject impossible dates
- do not validate with `Date.parse` normalization
- do not route normal display through JavaScript `Date`
- do not apply timezone conversion

---

## Client ↔ Company lifecycle

Client/Company is many-to-many via `client_companies`.

Archived Client relationship mutations are rejected server-side.

Do not rely only on UI button hiding.

---

## Concurrency

Do not assume:

read
→ validate
→ write

is concurrency-safe.

Use one or more of:

- optimistic locking
- atomic SQL
- transactional logic
- database constraint

Key remaining concurrency issue:

`F06` last Owner protection.

---

## Team / Owner

Current last-Owner protection is not concurrency-safe.

Target:

- stable Role `systemKey`
- explicit ownership-transfer policy
- concurrency-safe last-Owner invariant

Do not use mutable Role display names as long-term security identity.

---

## Database integrity

Application validation remains required.

Priority future PostgreSQL invariants include:

- Stage Organization + Pipeline consistency
- Deal Organization + Pipeline + Stage consistency
- Member + Role tenant consistency
- Client + Company tenant consistency
- Stage probability bounds
- Stage type values
- Deal amount/currency consistency
- default Pipeline uniqueness if confirmed

Do not edit already-applied migrations casually. Create new migrations.

---

## Neon transactions

Current database access uses Neon serverless HTTP.

Do not assume ordinary interactive transaction callbacks are available.

`db.batch()` does not make earlier pre-checks concurrency-safe.

For critical invariants deliberately choose atomic SQL, PostgreSQL function, transactional driver, database constraint, or optimistic locking.

---

## Lifecycle

Important CRM records prefer:

archive
→ restore

over hard deletion.

If archived means immutable, enforce that in Server Actions/domain operations, not only in the UI.

---

## Money

Persistent Deal amounts use PostgreSQL `numeric(14,2)`.

Currency is separate.

Do not combine KZT + USD + EUR into one total without an explicit exchange-rate feature.

---

## Security

Never commit:

- `.env`
- `.env.local`
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- passwords
- tokens
- API keys
- private credentials

If a secret is committed, rotate it.

---

## Testing

Current automated coverage includes:

- exact canonical email behavior
- `_` and `%` literal identity behavior
- strict Deal calendar-date validation

Priority additions:

- inactive Organization
- cross-tenant denial
- archived Client relationship mutation
- owner-assignment RBAC
- related-data visibility
- stale Deal conflicts
- last Owner concurrency
- PostgreSQL invariants
- E2E critical flows

Use PostgreSQL integration tests for PostgreSQL/concurrency invariants.

---

## CI

Target:

`npm ci`
→ `next typegen`
→ `npx tsc --noEmit --incremental false`
→ `npm run lint`
→ `npm test`
→ `npm run build`

Never point CI integration tests at production data.

---

## Roadmap discipline

Do not start another large product module while dangerous identity, authorization, lifecycle and concurrency ambiguity remains.

Next major product module after stabilization remains:

Tasks

Then:

Collaborative Notes
→ Activity Timeline
→ Pipeline management
→ direct Deal contacts
→ saved views
→ custom fields
→ automation
→ read-first AI
