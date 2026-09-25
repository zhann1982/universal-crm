# Universal CRM — Next Development Steps

Last updated: 2026-09-26

## Priority

The next cycle is:

STABILIZATION BEFORE MORE LARGE FEATURES

Current Deals functionality already includes:

- create
- edit
- archive / restore
- manual Stage movement
- drag-and-drop Kanban
- currency-separated totals

Do not recreate these features.

---

# 1 — Fix P1 identity and exposure issues

## F01 — Exact email identity lookup

Replace identity lookup based on:

ILIKE(email, input)

with canonicalized exact matching.

Affected areas include:

- Team add-member
- development Owner linker

Acceptance criteria:

- `a_b@example.com` cannot match `acb@example.com`
- lookup returns the exact account only
- regression test exists
- identity behavior is consistent with Better Auth email normalization

---

## F02 — Verified membership acquisition

Do not treat registration with an email address as proof that the User owns that
address.

Design the production-safe organization membership flow.

Preferred direction:

registered User
→ verified email
→ invitation
→ one-time token
→ expiration
→ authenticated acceptance
→ membership creation

A simpler intermediate verified-email-only flow is acceptable during development,
but document it clearly.

Acceptance criteria:

- an unverified account cannot receive normal production organization access by
  merely pre-registering someone else's email
- Owner bootstrap has an explicitly safe identity rule

---

## F03 — Minimal public health endpoint

Remove global CRM counters from public health/readiness response.

Public endpoint should expose only minimal service state.

If DB readiness is required, use a lightweight connectivity check.

Acceptance criteria:

- anonymous response contains no Organization/Member/Role/Client counts
- endpoint does not expose tenant aggregates
- administrative diagnostics, if retained, require authorization

---

# 2 — Unify Deal mutations and add concurrency protection

## Shared Deal transition

Create one server-side Deal transition operation used by:

- Deal detail manual Stage movement
- Kanban drag-and-drop
- future automation
- future API
- future AI

The operation must validate:

- authenticated tenant context
- deals.update
- Deal belongs to Organization
- Deal is active/not archived
- target Stage belongs to Organization
- target Stage belongs to current Deal Pipeline
- closedAt rules

Do not keep separate transition implementations with different rules.

---

## Prevent Pipeline/Stage race

A Stage update must be conditional on the expected/current Pipeline or record
version.

Acceptance criteria:

concurrent:

Pipeline P1 → P2

and:

Stage change in P1

cannot produce:

Pipeline P2 + Stage from P1

The mutation must detect conflict instead of silently succeeding.

---

## Add optimistic locking

Add an explicit version strategy for mutable business records, starting with
Deals.

Possible model:

version integer not null default 1

Mutation:

WHERE id = ?
AND organizationId = ?
AND version = expectedVersion

SET ...
version = version + 1

If zero rows update:

return conflict

Acceptance criteria:

- stale Deal edit cannot silently overwrite a newer edit
- archive during edit produces conflict, not fake success
- Stage transition conflict is detectable

---

# 3 — Standardize tenant and permission boundaries

## Active Organization

Make Organization activity part of the central authenticated tenant context.

Target:

session
→ active Organization
→ active Membership
→ permissions

Acceptance criteria:

organizations.isActive = false
→ CRM access denied

---

## Related-data permission policy

Define one consistent policy for:

- responsible Member picker
- Member names
- Member email visibility
- Company information inside Deals
- Dashboard aggregates

Possible direction:

introduce a limited assignment-directory permission or safe Member DTO.

Do not expose full Team data merely to populate responsible-person selectors.

Acceptance criteria:

- Company and Deal forms use the same assignment rule
- Dashboard queries are permission-aware
- related data is filtered before serialization
- tests cover Manager and Viewer behavior

---

## Company inactive owner rule

Match Deal behavior:

- unchanged inactive owner may remain
- newly selected owner must be active

Acceptance criteria:

editing Company phone/address does not require changing an unchanged inactive
owner.

---

## Archived Client relationship rule

If archive means immutable:

unlink Client ↔ Company must reject archived Client on the server.

Acceptance criteria:

direct Server Action call cannot mutate archived Client relationships.

---

# 4 — Strengthen validation, database invariants and tests

## Strict calendar dates

Replace Date.parse-based date validation.

Reject impossible dates.

Decide whether expectedCloseAt is:

- date-only
or
- timestamp with Organization timezone

Prefer PostgreSQL date for a date-only business concept.

Acceptance criteria:

rejected:

- 2026-02-29
- 2026-02-31
- 2026-04-31

accepted:

- 2026-02-28
- valid leap dates

---

## Database constraints

After checking existing data, design migrations for priority invariants.

Priority:

1. Stage Organization + Pipeline consistency
2. Deal Organization + Pipeline + Stage consistency
3. Member ↔ Role tenant consistency
4. Client ↔ Company tenant consistency
5. probability 0..100
6. Stage type open/won/lost
7. amount/currency consistency
8. one active default Pipeline per Organization if confirmed as product policy

Do not edit already-applied migrations.

Generate new migrations.

---

## Automated tests

Add the first real regression suite.

Minimum schema/business tests:

- email `_` identity case
- impossible dates
- cross-tenant access
- inactive Member
- inactive Organization
- archived relation mutation
- Deal Stage/Pipeline conflict
- stale Deal version conflict

Add PostgreSQL integration tests for DB-dependent invariants.

---

## CI

Add GitHub Actions:

npm ci
→ next typegen
→ tsc
→ lint
→ tests
→ build

Use a safe test environment/configuration.

Do not use production secrets or production database.

---

# 5 — Begin collaboration layer after stabilization

After priorities 1–4 are sufficiently stable, continue with product features.

Order:

## Tasks

First collaboration/product module.

Goal:

make CRM useful as a daily work system.

Initial Task concepts:

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
- deletedAt/version as needed

Relationships:

- Deal
- Client
- Company

Important views:

- today
- overdue
- mine
- Deals without next action

---

## Collaborative Notes

Keep existing entity `notes` as a description.

Create separate multi-user Notes.

Each Note should show:

- author
- created time
- edited time
- optional last editor

Prefer soft deletion.

Do not use generic entityType/entityId unless the loss of database foreign-key
integrity is deliberately accepted.

A shared Notes table with explicit nullable parent foreign keys is a strong
candidate.

---

## Activity Timeline

Do not postpone all activity history to the end of the roadmap.

Start a minimal structured event model during the collaboration phase.

Initial Deal events:

- created
- Stage changed
- Pipeline changed
- owner changed
- amount changed
- archived
- restored
- Note created/edited/deleted
- Task created/completed

Where required for consistency, entity mutation and Activity event creation
should be atomic.

This history is required later for:

- collaboration
- debugging
- historical reporting
- Pipeline analytics
- automation
- AI summaries

---

# Not next

Do not prioritize yet:

- microservices
- Redis
- message broker
- vector database
- separate AI backend
- broad automation engine
- advanced analytics without event history

---

# Later roadmap

After stabilization + collaboration:

1. Pipeline / Stage management UI
2. direct Deal contacts (`deal_clients`)
3. saved views
4. custom fields
5. CSV import / duplicate handling
6. Pipeline/history analytics
7. Organization settings
8. automation engine
9. integrations
10. read-first AI assistant

Performance work should be introduced before datasets become large:

- Kanban incremental loading
- Deal archive pagination
- searchable reference selectors
- SQL aggregates
- query-plan analysis