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

If documentation disagrees with code, inspect the current implementation, verify behavior, then update STATUS/NEXT.

Do not reimplement an already existing feature.

Keep separate meanings for:

- code exists
- manually tested
- automatically tested
- production-ready

---

## Decision IDs

Decision IDs are permanent.

Never renumber or reuse existing IDs.

Current latest decision:

`D056`

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
- Organization-based multi-tenancy

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

Organization selection is implemented (D050). The `crm-organization` cookie is a preference,
not authorization. Revalidate active Organization + authenticated user's active Membership.
Never silently fall back from an invalid/revoked selection to another tenant.

All CRM mutations must use `requireMutationPermission` and supply the rendered organization scope.
Use `OrganizationForm` for forms and `useOrganizationId` for imperative action callers.
Never trust the client field as authorization; compare it against the server-selected context.
Keep read-only permission checks separate from mutation-scope checks.

Important access code:

- `src/modules/access/tenant-access.ts`
- `src/lib/current-organization.ts`
- `src/lib/auth/current-member.ts`
- `src/lib/auth/permissions.ts`

---

## Authentication / identity

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

Stable User identity:

`user.id`

CRM mapping:

`organization_members.userId`

Email is not authorization identity.

Normal CRM access requires verified email ownership.

Canonical email identity lookup:

trim
→ lowercase
→ exact equality

Never use LIKE/ILIKE for identity matching.

`_` and `%` are literal.

Ambiguous canonical identity matches must be rejected.

---

## Organization invitations

Decision:

`D047`

Normal Team onboarding uses verified one-time invitations.

Rules:

- invitation belongs to one Organization
- intended identity is canonical normalized email
- raw token is cryptographically random
- only SHA-256 token hash is stored
- invitation expires
- accepted/revoked lifecycle is explicit
- no Membership exists before successful acceptance
- acceptance requires authenticated Better Auth User
- authenticated email must be verified
- canonical authenticated email must exactly match invitation identity
- Organization and Role are revalidated during acceptance
- Membership + Role creation and invitation acceptance are atomic
- browser userId/email/organizationId are never authorization proof

Creation and acceptance share the canonical-email advisory-lock namespace:

`universal-crm-invitation-email`

Do not revert to direct Membership creation from administrator-supplied email.

Production email delivery and invitation administration are product/operations follow-ups.

---

## Authorization

Authorization is server-side.

Client-side visibility is UX only.

A valid UUID is never proof of access.

For relationship IDs validate:

- current Organization
- required Permission
- lifecycle state
- relationship-specific invariants

Do not fetch or serialize related data merely because the parent entity is visible.

---

## Responsible Member policy

Decision:

`D045`

With `members.read`:

→ may assign any active Member in the Organization

Without `members.read`:

→ may assign only self or no owner

Existing owner:

- may remain unchanged
- may remain if inactive
- may remain even if current User cannot browse that Member

Assignment/reference DTOs must not expose Member email unless explicitly required.

Responsible Member display:

- with `members.read` → real display name
- self → own display name
- hidden foreign Member → `Сотрудник`

Shared modules:

- `src/modules/members/owner-assignment-policy.ts`
- `src/modules/members/owner-assignment.ts`

`owner-assignment-policy.ts` owns permission rules.

`owner-assignment.ts` adds:

- same-Organization validation
- active Membership validation for new non-null owners
- unchanged inactive-owner preservation

Company and Deal owner mutations use the shared resolver.

---

## Existing inactive owner semantics

Decision:

`D042`

unchanged inactive owner
→ allowed

new inactive owner
→ rejected

new owner from another Organization
→ rejected

clear owner
→ allowed

Do not block unrelated edits because an existing owner later became inactive.

---

## Team / Owner

Decision:

`D046`

System Role machine identity uses:

`roles.systemKey`

Owner:

`systemKey = "owner"`

Do not use Role display names as security identity.

Any Team mutation reducing active Owners must use:

`src/modules/members/owner-guard.ts`

Flow:

PostgreSQL transaction
→ Organization-scoped transaction advisory lock
→ read current committed Owner state
→ reject removal/deactivation of last active Owner
→ mutate

F06 is fixed at the current application/PostgreSQL transaction level.

---

## Client ↔ Company

Relationship:

many-to-many via `client_companies`

Shared mutation module:

`src/modules/clients/client-company-relation.ts`

Rules:

- archived Client cannot link Company
- archived Client cannot unlink Company
- same-tenant validation is mandatory
- cross-tenant link/unlink attempts are rejected

Do not rely on UI hiding alone.

---

## Deals

Deal stores:

- organizationId
- pipelineId
- stageId

Stage types:

- open
- won
- lost

Deal state derives from Stage type.

open
→ `closedAt = null`

won/lost
→ `closedAt` set

Stage must belong to the same Organization and Pipeline.

---

## Shared Deal Stage transition

Use:

`src/modules/deals/transition-deal.ts`

Do not create a second independent Stage-transition implementation.

The shared operation owns:

- tenant validation
- active Deal lifecycle
- current Pipeline validation
- target Stage validation
- Stage type semantics
- `closedAt`
- optimistic concurrency

Manual Stage selector, Kanban, future API, automation and AI should reuse the same operation.

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

Stale mutations must not silently overwrite newer state.

Preferred conditional update validates:

- id
- organizationId
- expected version
- lifecycle state
- deletedAt state

Zero affected rows must not be reported as success.

---

## Deal expectedCloseAt

Decision:

`D044`

Semantics:

date-only calendar value

Storage:

PostgreSQL `date`

Application:

`YYYY-MM-DD`

Rules:

- strict calendar validation
- reject impossible dates
- do not use `Date.parse` normalization
- do not use JavaScript Date timezone conversion for normal display

---

## Concurrency

Never assume:

read
→ validate
→ write

is concurrency-safe.

Use:

- optimistic locking
- atomic SQL
- focused transactional logic
- database constraints

Already protected:

- last active Owner invariant
- invitation creation/acceptance
- primary Deal optimistic-locking paths

---

## Database integrity

Application validation remains required.

Implemented PostgreSQL invariants (D052, migration `0013_tenant_integrity.sql`):

- Stage Organization + Pipeline consistency
- Deal Organization + Pipeline + Stage consistency
- Member + Role tenant consistency
- Client + Company tenant consistency
- Stage probability bounds
- Stage type values
- Deal amount/currency consistency

Core relationship invariants use composite foreign keys, not independent ID checks.
`member_roles.organizationId` is required on every assignment write; derive it from the
authorized server context or the created Membership, never from unvalidated browser data.
Retain existing nullable owner/company SET NULL deletion behavior and inactive-owner semantics.
Amount may be absent with a valid currency; a non-null amount requires a valid currency.

Run `npm run db:audit-integrity` before deploying migration 0013. The audit is read-only.
The migration backfills role-assignment tenant identity from Membership; it does not repair
invalid relationships. Invalid rows must cause transactional failure, never silent reassignment.
Deploy with CRM writes paused: old assignment writers omit the required new column.
The migration is tested in isolated PostgreSQL; do not describe it as applied to Neon without verification.

Remaining invariants include Task/Comment/Activity references and default Pipeline uniqueness
if the product rule is confirmed. Database constraints do not replace authorization or lifecycle checks.

Do not casually edit already-applied migrations.

Before adding a new invariant:

inspect data
→ repair invalid rows deliberately
→ create new migration
→ verify against PostgreSQL

---

## Neon transactions

Current database access uses Neon serverless HTTP.

Do not assume ordinary interactive transaction callbacks are available.

`db.batch()` does not make earlier pre-checks concurrency-safe.

Critical invariants may use focused raw Neon SQL transactions where ordering/locking is required.

---

## Lifecycle

Important CRM records prefer:

archive
→ restore

over hard deletion.

If archived means immutable, enforce it server-side.

---

## Money

Persistent Deal amount:

PostgreSQL `numeric(14,2)`

Currency is separate.

Do not sum KZT + USD + EUR without an explicit exchange-rate feature.

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

Earlier stabilization baseline (current branch verification lives in docs/ai/STATUS.md):

- `npm test` — 37 / 37
- `npm run test:integration` — 23 / 23
- TypeScript — passed
- ESLint — passed
- production build — passed

Current automated coverage includes:

- canonical email identity
- invitation token/safe redirect behavior
- last-Owner concurrency
- invitation concurrency
- inactive Organization/Membership access
- Client ↔ Company lifecycle
- cross-tenant boundaries
- owner-assignment RBAC
- active/inactive owner Membership semantics

Priority additions:

- related-data visibility tests
- Deal conflict PostgreSQL/browser tests
- PostgreSQL invariant tests
- E2E critical workflow suite
- F12 representative scale tests

Use PostgreSQL integration tests when PostgreSQL/concurrency behavior matters.

Never point integration tests at production data.

---

## CI

GitHub Actions CI exists and is passing for non-database checks.

Current CI:

`npm ci`
→ `next typegen`
→ `npx tsc --noEmit --incremental false`
→ `npm run lint`
→ `npm test`

Database integration tests remain local until a dedicated non-production PostgreSQL CI environment exists.

Do not add production `DATABASE_URL` to GitHub Actions.

---

## Roadmap discipline

Do not start another large product module while important authorization, integrity and scale gaps remain.

Current stabilization priorities:

1. related-data visibility regression coverage
2. Deal conflict integration/browser coverage
3. stronger PostgreSQL invariants
4. F12 scaling
5. dedicated CI PostgreSQL strategy
6. production invitation email delivery/admin UX

Tasks, collaborative Comments and Task Activity Stage 2 already exist.
Do not recreate these modules. Task/Schedule/Activity atomic persistence is implemented (D049).
Organization provisioning is implemented (D051). Prioritize browser/multi-session tenant verification next.

The user targets multiple independent companies. Membership-based selection is implemented.
Browser cross-tenant workflow verification remains open; do not recreate Organization provisioning.

Activity for Client/Company/Deal, Pipeline management and saved views exist. Then: custom fields
→ automation → read-first AI.

Pipeline management is implemented (D054), following the user's product priority.
Use `src/modules/pipelines/manage-pipeline.ts`; mutations require `pipelines.manage`
and rendered Organization scope. Pipeline versions also protect Stage edits.
Lock Organization configuration, then Pipeline rows; Deal writes share parent locks
through migration 0014. Do not bypass used-Stage type or Pipeline archive protections.
Stage archive/deletion and automatic position swapping remain follow-ups.

Saved views are implemented (D055). They are private to the current Membership
inside its Organization, not shared configuration. Read and write require the
underlying entity read permission; writes also require rendered Organization scope.
Use `src/modules/saved-views/persistence.ts` and allowlisted filter schemas.
Never accept arbitrary stored URLs, Organization IDs or SQL/filter expressions.
Deal references must not query Company/Member names without their read permissions.

## Activity permissions

D056: Client/Company/Deal business writes use `recordMutation` from
`src/modules/activity/mutation-context.ts` around one awaited Drizzle INSERT/UPDATE,
after `requireMutationPermission`, with the server-selected Organization and Member.
The Neon adapter sets transaction-local actor/scope and migration 0016 triggers insert
Activity in the same transaction. Do not add separate/best-effort logging. Shared Deal
transition requires `actorMemberId` from authorized context; both selector and Kanban use it.
Only allowlisted field labels enter these events; do not copy related names or private
old/new values into history. Task/Comment atomic SQL remains unchanged. Maintenance/seed
writes without context are intentionally unaudited; this is application history, not a
complete immutable database audit. Existing records are not backfilled.

Decision D048: `activity.read` never grants access to comment contents.
Exclude comment events in SQL without `comments.read`, including events with a null comment FK.
Do not query Member display names without `members.read`.
Comment archive/restore must validate a writable tenant parent inside the mutation statement.

D053: comment create/edit must use `src/modules/activity/save-comment.ts`.
All comment writes share `comment-target.ts` for tenant/lifecycle predicates and parent-first locking.
Keep comment + Activity event atomic; no independent writes or best-effort event logging.
Edit checks expected version and author/`comments.manage` in SQL as well as the Server Action.
Parent pre-checks are UX only. Zero changed rows are a conflict/unavailable target, never success.

## Task persistence

D049: use `src/modules/tasks/save-task.ts` and `change-task-state.ts` for Task mutations.
Do not write Task, Schedule and Activity in separate calls or reintroduce best-effort event logging.
Completion, its successor and their events form one operation. Preserve optimistic Task/Schedule versions.
Bulk operations are atomic per Task, not across the entire selection.

The normal test suite includes isolated PGlite PostgreSQL rollback/migration tests.
It does not need DATABASE_URL secrets; real multi-session Neon tests remain separate.
Historical archive installers are not the source of truth and must not overwrite current source files.


## Organization provisioning

D051: verified users create their own Organizations through `/organizations/new`.
This initial Owner bootstrap is separate from invitation-based onboarding of colleagues.
Use `src/modules/organizations/create-organization.ts`; never create the Organization,
Owner, Roles, Permission bindings and initial Pipeline in separate requests.
The operation rechecks the verified auth User in PostgreSQL and derives identity there.
The request UUID is an idempotency key scoped to that authenticated User, not an access token.
Serialize it with a transaction advisory lock in a separate statement before the READ COMMITTED
creation statement. Replay must never restore revoked Membership, Organization access or Owner roles.
Shared Permission/Role/Stage defaults also serve the development seed; do not duplicate them.
Migration `0012_long_cammi.sql` is required. Never run the development seed for production onboarding.
