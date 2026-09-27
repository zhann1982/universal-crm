# Universal CRM — Next Development Steps

Last updated: 2026-09-27

## Current cycle

STABILIZATION BEFORE MORE LARGE FEATURES

The CRM core already includes:

- authentication
- verified-email gate for CRM access
- Organization membership
- RBAC
- Clients
- Companies
- Client ↔ Company relationships
- Deals
- Pipelines / Stages in the database
- Deal Kanban
- manual Deal Stage movement
- archive / restore
- exact email identity lookup
- minimal public DB health check
- active Organization access enforcement
- shared Deal Stage transition
- Deal optimistic locking

Do not recreate these features.

The next work should finish the remaining lifecycle, validation, permission,
concurrency and automated-test gaps before starting another major product module.

---

# 1 — Finish remaining lifecycle and concurrency stabilization

## F11 — Archived Client relationship mutation

Current problem:

the UI treats archived Clients as immutable, but the server-side
Client ↔ Company relationship mutation does not yet enforce the same rule.

Required behavior:

archived Client
→ relationship mutations rejected server-side

This must apply even if the Server Action is called directly rather than through
the normal UI.

Acceptance criteria:

- archived Client cannot link a Company
- archived Client cannot unlink a Company
- active Client behavior remains unchanged
- tenant scope remains enforced
- regression test exists

---

## Deal archive / restore concurrency follow-up

The main Deal edit and Stage transition now use optimistic locking.

Archive and restore already increment Deal.version.

Remaining work:

define and enforce explicit affected-row / conflict semantics for concurrent
archive and restore operations.

Examples:

request A archives Deal
request B attempts archive or edit

and:

request A restores Deal
request B changes lifecycle state concurrently

must not silently report success when the expected state no longer exists.

Preferred direction:

conditional UPDATE
→ RETURNING
→ zero rows means stale/lifecycle conflict or already-completed idempotent state

The exact user-facing behavior should be defined deliberately.

Acceptance criteria:

- no false-success redirect after zero-row mutation
- lifecycle state is checked inside the write condition
- conflict/idempotency behavior is documented
- Deal.version remains incremented on real mutation

---

# 2 — Fix validation semantics

## F09 — Strict calendar-date validation

Current Deal date validation still uses Date.parse.

JavaScript can normalize impossible calendar dates.

Examples that must be rejected:

- 2026-02-29
- 2026-02-31
- 2026-04-31

Examples that must be accepted when valid:

- 2026-02-28
- 2028-02-29
- normal valid ISO calendar dates

Do not rely on Date.parse alone.

---

## Decide expectedCloseAt semantics

Before changing the database type, decide whether Deal.expectedCloseAt means:

A calendar date

or:

an exact timestamp

Current product behavior looks closer to a calendar date.

Preferred direction if confirmed:

PostgreSQL date

instead of:

timestamp with time zone
+ artificial noon UTC

Do not perform a database type migration until the product meaning is explicit.

Acceptance criteria:

- strict parser rejects impossible dates
- automated regression test exists
- chosen date semantics are documented
- future database migration, if needed, is created as a new migration

---

# 3 — Standardize related-data permission policy

## F05 — Responsible Member / related-data permissions

Current permission behavior is not yet uniform between:

- Company forms
- Deal forms
- Team
- Dashboard
- related Company data
- responsible Member selectors

This is not currently classified as a confirmed cross-tenant leak.

The issue is inconsistent authorization semantics.

Define one explicit policy for assignment/reference data.

Questions the policy must answer:

- who may see Member names?
- who may see Member email addresses?
- who may assign another Member?
- should assignment require members.read?
- should there be a smaller assignment-directory permission?
- what Member fields are safe for assignment selectors?
- what Company fields may appear inside Deals?
- which Dashboard aggregates require module-specific read permission?

Preferred direction:

do not expose the complete Team dataset merely to populate an owner picker.

A restricted assignment DTO is a strong candidate, for example:

- member id
- display name
- active/inactive state when required

Email should only be included when product behavior actually requires it.

Acceptance criteria:

- Company and Deal assignment rules are consistent
- query authorization happens before related data is serialized
- Manager behavior is explicitly defined
- Viewer behavior is explicitly defined
- Dashboard counts respect module permissions
- regression tests cover representative roles

---

# 4 — Strengthen Owner and administrative invariants

## F06 — Last Owner concurrency

Current last-Owner protection uses application-level:

read
→ validate
→ write

This is not concurrency-safe.

Two requests may both observe more than one Owner and then remove/deactivate
different Owners concurrently.

Required design:

- stable Owner/system role identity
- explicit ownership-transfer policy
- concurrency-safe invariant

Do not solve this only by adding another pre-check.

Possible implementation directions:

- transactional driver for the administrative operation
- atomic SQL / PostgreSQL function
- database-supported ownership invariant
- explicit ownership-transfer operation

Acceptance criteria:

- two concurrent administrative operations cannot leave an Organization without
  the required Owner state
- mutable Role display name is not the long-term security identity
- ownership-transfer behavior is documented
- regression/integration test exists

---

# 5 — Finish production-safe membership acquisition

## F02 — Invitation workflow

Current development protection already includes:

- email verification
- unverified User cannot enter normal CRM access
- Team membership flow rejects unverified User
- development Owner linker rejects unverified User

This is an acceptable development intermediate state.

Production-safe membership acquisition still needs:

registered User
→ verified email
→ Organization invitation
→ one-time invitation token
→ expiration
→ authenticated acceptance
→ Membership creation

The invitation must be bound to the intended Organization and identity.

Do not treat knowledge of an email address as sufficient proof of authorization.

Acceptance criteria:

- administrator creates invitation rather than directly granting access by email
  alone
- invitation token is single-use
- invitation expires
- authenticated User must match the intended identity
- acceptance creates or activates the correct Membership
- replay is rejected
- production Owner bootstrap follows an explicit safe rule

Real production email delivery may be implemented together with or before this
flow.

---

# 6 — Add database-level invariants

Application checks are currently stronger than several database relationships.

Before creating constraints:

inspect existing data
→ identify invalid rows
→ repair deliberately
→ create new migration

Do not edit migrations that have already been applied.

Priority database invariants:

1. Pipeline Stage belongs to the same Organization as Pipeline
2. Deal Organization + Pipeline + Stage remain consistent
3. Member ↔ Role belongs to one Organization
4. Client ↔ Company relationship stays within one Organization
5. Stage probability is between 0 and 100
6. Stage type is open / won / lost
7. Deal amount/currency consistency
8. one active default Pipeline per Organization if confirmed as product policy

Composite foreign keys may require matching composite unique constraints.

Do not attempt unsupported cross-table CHECK constraints with subqueries.

Acceptance criteria:

- invalid cross-tenant/cross-Pipeline relationships are rejected by PostgreSQL
- application validation remains in place
- migrations are additive and reversible where practical
- integration tests verify the important constraints

---

# 7 — Build the first serious regression suite

Current automated coverage is minimal.

Existing automated test:

email canonicalization / literal `_` and `%`

Add tests for the stabilization work already completed.

Priority tests:

- exact email identity lookup
- verified identity requirement
- inactive Membership denial
- inactive Organization denial
- cross-tenant entity denial
- Company unchanged inactive owner
- archived Client relationship mutation
- impossible calendar dates
- Deal Stage/Pipeline conflict
- stale Deal edit version conflict
- Kanban transition version conflict
- archive during stale Deal edit
- Deal lifecycle archive/restore concurrency
- role permissions
- last Owner behavior

Use PostgreSQL integration tests for rules that depend on real database
constraints or concurrency.

Do not pretend mocked query-builder tests prove PostgreSQL invariants.

---

# 8 — Add CI

After the regression test command is stable, add GitHub Actions.

Target pipeline:

npm ci
→ next typegen
→ npx tsc --noEmit --incremental false
→ npm run lint
→ npm test
→ npm run build

CI must use:

- test configuration
- test database when required
- non-production credentials

Never use the production database.

Never commit secrets.

Acceptance criteria:

- pull request / main checks run automatically
- TypeScript failure blocks the workflow
- lint failure blocks the workflow
- test failure blocks the workflow
- build failure blocks the workflow
- database integration tests cannot modify production data

---

# 9 — Address scaling limits before datasets become large

## F12 — Unbounded loading

Current structural scale limitations include:

- Kanban loading all Deals in selected Pipeline
- Deal archive loading without sufficient pagination
- large reference lists
- active Company selectors
- Member selectors

This is not currently a measured production outage.

Do not introduce Redis or microservices to solve ordinary query/UI scaling.

Preferred direction:

- pagination
- searchable selectors
- incremental loading
- per-column Kanban loading
- SQL counts/aggregates
- representative dataset tests

Only tune indexes after inspecting real query plans with:

EXPLAIN ANALYZE

---

# 10 — Clean up business-operation boundaries

The first shared Deal operation now exists:

src/modules/deals/transition-deal.ts

Continue moving genuinely shared rules into focused domain modules.

High-value candidates:

- Deal lifecycle mutation
- Deal full edit operation
- Company owner assignment rule
- Client ↔ Company relationship mutation
- Team ownership operations

Target Server Action shape:

parse input
→ obtain authenticated access context
→ call domain operation
→ translate result into UI response

Do not create a generic repository abstraction merely for architectural
symmetry.

Do not perform a broad rewrite.

---

# Stabilization exit criteria

Do not start the next large product module until most of these conditions are
true:

- F11 fixed
- strict date validation fixed
- related-data permission policy defined
- Deal lifecycle conflict behavior defined
- last-Owner design strengthened or clearly isolated
- production membership invitation design established
- core regression suite exists
- CI exists
- high-value database invariants are planned or partly implemented

Not every long-term production feature must be complete before product work
continues.

The objective is to remove the most dangerous ambiguity from identity,
authorization, lifecycle and concurrency.

---

# Next major product module — Tasks

After stabilization, Tasks remain the first major product feature.

Purpose:

turn CRM from primarily a record system into a daily-work system.

Initial Task model should consider:

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
- version if collaborative edits require it

Possible relationships:

- Deal
- Client
- Company

Initial views:

- today
- overdue
- mine
- upcoming
- completed
- Deals without a next action

Authorization must use the same trusted tenant context as the rest of CRM.

---

# After Tasks

## Collaborative Notes

Existing entity `notes` fields remain descriptions.

Collaborative Notes are separate records.

Required concepts include:

- Organization
- author
- parent business record
- createdAt
- updatedAt
- optional lastEditedBy
- soft deletion

Do not silently replace current description fields with collaborative Notes.

---

## Activity Timeline

Activity should be introduced early in the collaboration phase.

Initial useful events include:

- Deal created
- Stage changed
- Pipeline changed
- owner changed
- amount changed
- Deal archived
- Deal restored
- Note created
- Note edited
- Note deleted
- Task created
- Task completed

Activity is required later for:

- collaboration
- debugging
- historical reporting
- Pipeline duration analytics
- automations
- AI summaries

Where consistency requires it, business mutation and Activity creation should be
atomic.

---

# Later roadmap

After stabilization and collaboration:

1. Pipeline / Stage management UI
2. direct Deal contacts (`deal_clients`)
3. saved views
4. custom fields
5. CSV import and duplicate handling
6. Pipeline/history analytics
7. Organization settings and switching
8. automation engine
9. integrations
10. read-first AI assistant

---

# AI remains later

Do not prioritize AI implementation yet.

Future AI should begin with read-oriented functionality:

- Deal summary
- Client summary
- Company summary
- permission-aware search
- recommended next action

AI mutations, when eventually introduced, must use the same domain operations as
the normal UI.

AI must never bypass:

- Better Auth
- active Organization
- active Membership
- RBAC
- tenant scope
- validation
- optimistic locking
- database invariants
- Activity logging

---

# Not next

Do not prioritize:

- microservices
- Redis
- message broker
- vector database
- separate AI backend
- broad automation engine
- advanced analytics before Activity history
- premature infrastructure optimization