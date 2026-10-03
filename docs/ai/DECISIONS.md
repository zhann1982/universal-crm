# Universal CRM — Architecture Decisions

Last updated: 2026-10-03

## Decision ID rule

Decision IDs are permanent.

Existing IDs must never be renumbered or reused.

New decisions use the next unused number.

---

## D001 — Multi-tenancy from the beginning

Status: accepted

Organizations are first-class tenants. Tenant-owned business records use `organizationId`. Browser-supplied `organizationId` is never authorization proof.

---

## D002 — PostgreSQL as primary datastore

Status: accepted

Use PostgreSQL for CRM data.

---

## D003 — Neon during early development

Status: accepted

Use Neon PostgreSQL while the current cost/scale profile remains appropriate.

---

## D004 — Drizzle ORM

Status: accepted

Use Drizzle for schema and normal application database access. Schema changes use new migrations. Do not casually modify already-applied migrations.

---

## D005 — Modular monolith first

Status: accepted

Keep frontend and server business code in the Next.js application. Do not introduce microservices or a separate backend without a concrete requirement.

---

## D006 — Minimize infrastructure

Status: accepted

Do not add Redis, queues, brokers, vector databases or paid infrastructure without demonstrated need.

---

## D007 — Configurable universal CRM

Status: accepted

The core product remains configurable rather than hard-coded for one industry.

---

## D008 — AI after stable CRM core

Status: accepted

AI is a later application layer and must use controlled business operations and normal authorization.

---

## D009 — Better Auth owns authentication

Status: accepted

Better Auth handles identity, password authentication, sessions and email verification tokens.

---

## D010 — Authentication and CRM authorization are separate

Status: accepted

Authentication identifies the User. CRM authorization decides Organization access and Permissions.

---

## D011 — Better Auth user.id is the CRM identity

Status: accepted

`organization_members.userId` stores the stable Better Auth User identifier. Email is not authorization identity.

---

## D012 — Inactive Membership denies CRM access

Status: accepted

An authenticated User must have active Membership for normal CRM access.

---

## D013 — Organization selection must validate Membership

Status: accepted

Future Organization switching must validate real active Membership server-side.

---

## D014 — Company and Client are separate entities

Status: accepted

Client is a person/contact. Company is a business/legal organization.

---

## D015 — Client ↔ Company is many-to-many

Status: accepted

Use `client_companies`.

---

## D016 — Archive / restore is the normal business lifecycle

Status: accepted

Important CRM records prefer archive/restore over normal hard deletion.

---

## D017 — Pipelines and Stages are first-class entities

Status: accepted

Deals use configurable Pipelines and ordered Stages.

---

## D018 — Deal state derives from Stage type

Status: accepted

Stage type is `open`, `won`, or `lost`. Do not maintain an independent won/lost Deal status.

---

## D019 — Deal stores Pipeline and Stage

Status: accepted; composite constraints implemented in migration 0013

Deal stores `pipelineId` and `stageId`. Application validation remains required. D052 adds composite
database foreign keys for Organization/Pipeline/Stage consistency; deployment is tracked in STATUS.

---

## D020 — Money uses PostgreSQL numeric

Status: accepted

Deal amount uses `numeric(14,2)`. Currency remains separate. Different currencies are not summed together.

---

## D021 — Relationship IDs require server authorization

Status: accepted

A valid UUID is not authorization. Validate tenant, Permission, lifecycle and relationship invariants.

---

## D022 — Neon HTTP transaction limitations must be explicit

Status: accepted

Do not assume interactive transaction callbacks are available in the current Neon HTTP path. `db.batch` does not make earlier pre-checks concurrency-safe.

---

## D023 — Kanban is Pipeline-centered

Status: accepted

Kanban shows one selected Pipeline. Drag-and-drop changes Stage only inside that Pipeline.

---

## D024 — Owner protection needs stronger identity and atomic invariant

Status: superseded by D046

This recorded the earlier stabilization requirement for:

- stable Role system identity
- explicit ownership semantics
- concurrency-safe last-Owner protection

D046 records the implemented design.

---

## D025 — Tenant context should become the single entry point for business operations

Status: accepted direction

Target flow:

session
→ verified User
→ active Organization
→ active Membership
→ Permissions
→ module operation

---

## D026 — Important business logic moves into small domain modules

Status: accepted direction

Keep modular monolith. Introduce focused domain modules without a generic repository framework.

---

## D027 — Deal Stage transition becomes one business operation

Status: accepted and implemented

Shared operation:

`src/modules/deals/transition-deal.ts`

It owns validation, tenant scope, lifecycle, Pipeline/Stage rules, `closedAt`, and optimistic concurrency.

---

## D028 — Optimistic locking for mutable collaborative records

Status: accepted and implemented for Deal

Deal uses:

`version integer not null default 1`

Real mutations include expected version and increment version.

---

## D029 — Important tenant invariants also belong in PostgreSQL

Status: accepted direction

Application validation remains required. Add database constraints where practical.

---

## D030 — Exact email comparison for identity workflows

Status: accepted and implemented

Identity lookup uses trim + lowercase + exact equality. LIKE/ILIKE are not allowed for identity matching.

---

## D031 — Organization activity is part of tenant access

Status: accepted and implemented for current tenant model

Inactive Organization means no normal CRM business access.

---

## D032 — Related reference data needs explicit permission semantics

Status: superseded by D045

D045 defines the implemented assignment/reference-data policy.

---

## D033 — Date-only business values should use date semantics

Status: superseded by D044

D044 records the accepted Deal `expectedCloseAt` semantics.

---

## D034 — Existing notes fields remain descriptions

Status: accepted

Client/Company/Deal `notes` are simple descriptive text, not future collaborative Notes.

---

## D035 — Collaborative Notes and Activity are separate concepts

Status: proposed

Notes are human-authored collaboration. Activity is structured business history.

---

## D036 — Activity should be introduced before advanced analytics/automation

Status: proposed

Historical structured events are needed for collaboration, debugging, analytics, automation and future AI summaries.

---

## D037 — Tasks are the next major product module after stabilization

Status: accepted direction

Tasks turn the CRM into a daily operational work system.

---

## D038 — Direct Deal contacts should use a flexible relationship model

Status: proposed

Prefer future `deal_clients` with multiple contacts, roles and primary-contact semantics over a single `deal.clientId`.

---

## D039 — Scale with incremental loading, not premature infrastructure

Status: accepted direction

Prefer pagination, searchable selectors, incremental loading, SQL aggregates and query-plan-guided indexing.

---

## D040 — AI uses the same module operations as the UI

Status: accepted direction

Future AI must respect Better Auth, verified identity, tenant context, RBAC, validation, optimistic locking, database invariants, lifecycle policy and Activity logging.

---

## D041 — Verified email is required for normal CRM access

Status: accepted and implemented

A Better Auth Session alone is insufficient. Normal CRM access requires `session.user.emailVerified = true`.

---

## D042 — Existing inactive responsible Member may remain unchanged

Status: accepted and implemented for Company and Deal editing patterns

An existing owner may remain if later deactivated. Assigning a new owner requires an active Member.

---

## D043 — Deal version changes on every real Deal mutation

Status: accepted

Every successful Deal business-state mutation increments `version`. A no-op Stage transition does not.

---

## D044 — Deal expectedCloseAt is a date-only calendar value

Status: accepted and implemented

`Deal.expectedCloseAt` represents a calendar day, not an exact timestamp.

Storage:

PostgreSQL `date`

Application representation:

`YYYY-MM-DD`

Rules:

- strict calendar validation
- reject impossible dates
- do not rely on `Date.parse` normalization
- do not convert through JavaScript `Date` for normal display
- do not apply timezone conversion

Examples:

`2026-02-28`
→ valid

`2028-02-29`
→ valid

`2026-02-29`
→ invalid

`2026-02-31`
→ invalid

`2026-04-31`
→ invalid

Reason:

`expectedCloseAt` is a planned business day, and timestamp/timezone semantics add ambiguity without product value.

---

## D045 — Assignment directory is permission-limited

Status: accepted and implemented

Responsible-Member assignment and related reference data must not implicitly expose the complete Team dataset.

Current policy:

`members.read`
→ may view and assign active Members in the Organization

without `members.read`
→ may assign only self or no responsible Member

Existing responsible Member:

- may remain unchanged
- may remain even if inactive
- may remain even when the current User cannot otherwise browse that Member

Assignment DTOs do not include Member email unless a future product requirement explicitly needs it.

Related-data visibility follows the target module permission.

Examples:

`companies.read`
→ Company information may be shown inside Deal views

without `companies.read`
→ Company name/details are not exposed through Deal views

`clients.read`
→ linked Client information may be shown inside Company views

without `clients.read`
→ linked Client data is not queried or rendered

Dashboard aggregates require the corresponding module read permission.

Responsible Member display:

- with `members.read` → real display name may be shown
- without `members.read`, self → own display name may be shown
- without `members.read`, another Member → neutral label such as `Сотрудник`

Server mutations enforce assignment restrictions independently of UI controls.

Reason:

reference selectors and related-record displays are authorization surfaces. Users should receive only the related information required by their granted module Permissions.

---

## D046 — System Roles use stable systemKey and last-Owner mutations are serialized

Status: accepted and implemented

System Role security identity is separate from the human-readable Role name.

Schema:

`roles.systemKey`

Rules:

- `systemKey` is nullable
- custom Roles may keep `systemKey = null`
- system Role keys are stable machine identifiers
- `Owner` uses `systemKey = "owner"`
- seeded system Roles also use stable keys such as `admin`, `manager`, and `viewer`
- `(organizationId, systemKey)` is unique for non-null values
- Role display names must not be used as authorization identity

Last-Owner invariant:

Any Team mutation that can reduce the number of active Owners must use the shared Owner-guard business operation.

Current implementation:

`src/modules/members/owner-guard.ts`

Flow:

PostgreSQL transaction
→ acquire organization-scoped transaction advisory lock
→ read current committed Member/Role state
→ evaluate whether the mutation would remove or deactivate the last active Owner
→ reject if it would
→ otherwise mutate inside the same transaction

The same organization-scoped lock is used for both:

- removing/changing Owner roles
- deactivating an active Owner Member

This ensures two concurrent destructive requests for different Owners cannot both pass an earlier stale pre-check and leave the Organization with zero active Owners.

The current Neon HTTP implementation uses the raw Neon SQL transaction API for this focused operation; normal application queries continue to use Drizzle.

Verification:

- Team UI scenarios manually verified
- concurrent Owner-role removal tested against real PostgreSQL
- concurrent Owner deactivation tested against real PostgreSQL
- integration tests assert that one destructive operation succeeds, the other is blocked, and one active Owner remains

An explicit ownership-transfer UI may be added later for better administration UX, but it is not required for the current invariant.

Reason:

Role names are editable/display-oriented labels, while authorization requires stable machine identity. The last-Owner rule is a concurrency invariant and cannot be protected reliably by a separate read/check/write sequence.

---

## D047 — Organization Membership is acquired through verified one-time invitations

Status: accepted and implemented for the core authorization flow

Normal Team onboarding no longer creates Membership merely because an administrator knows an email address.

Invitation model:

- invitation belongs to one Organization
- intended identity is stored as canonical normalized email
- initial policy assigns one Role per invitation
- raw invitation token is generated from cryptographically secure random bytes
- only the SHA-256 token hash is stored in PostgreSQL
- invitation has an expiration timestamp
- invitation records acceptedAt / revokedAt lifecycle
- Membership does not exist before successful acceptance

Acceptance requires:

authenticated Better Auth User
→ verified email
→ exact canonical identity match
→ valid non-expired non-revoked invitation
→ Organization still active
→ Role still belongs to that Organization
→ no existing Membership
→ atomic Membership + Role creation
→ invitation marked accepted

Invitation acceptance never trusts browser-supplied userId, email or organizationId.

The authenticated Better Auth Session is the authoritative User identity.

Concurrency:

Invitation creation and invitation acceptance use the shared canonical-email advisory-lock namespace:

`universal-crm-invitation-email`

Acceptance additionally serializes reuse of the same token.

This prevents:

- two concurrent create requests from producing multiple active invitations for the same Organization/email
- two concurrent accept requests from accepting the same token twice
- separate invitations for the same identity from creating duplicate Memberships
- invitation creation racing past Membership acquisition

The implementation uses focused raw Neon SQL transactions where concurrency ordering is required. Normal database access remains Drizzle-based.

Redirect continuation:

Authentication onboarding accepts only validated same-origin application paths through `getSafeNextPath`.

External and protocol-relative redirect targets are rejected.

Current development delivery:

The raw invitation token can be surfaced manually because a production email provider is not yet configured.

Real email delivery is an operational follow-up and does not change the authorization model.

Verification:

- invitation token unit tests
- safe redirect unit tests
- concurrent same-token acceptance integration test
- concurrent invitations for the same identity integration test
- wrong-email rejection integration test
- concurrent invitation creation integration test
- expired invitation replacement integration test

Reason:

Knowledge of an email address is not proof of ownership. CRM Membership is an authorization boundary and therefore requires authenticated, verified and transaction-safe acceptance of a credential bound to the intended identity.

## D048 — Activity preserves underlying content permissions

Date: 2026-09-30

`activity.read` permits entity history, but does not imply `comments.read` or `members.read`.
Without comment read permission, filter events with a comment ID or a `comment.` event type
in SQL before pagination. The type check also covers comment FKs cleared by deletion.
Do not load member directory names without member read permission.

Comment archive/restore requires an active, non-deleted parent in the same Organization.
Lock that parent within the statement that conditionally updates the versioned comment
and inserts its event. Zero changed rows are not success.
Creation/update parent locking and atomic Task history remain separate follow-up work.

Follow-up: D049 implements atomic Task history; D053 implements comment creation/update parent locking.

Query regressions cover permission combinations and mutation predicates. PostgreSQL concurrency
verification is still required; query-level tests must not be described as integration coverage.


## D049 — Task persistence and history commit together

Date: 2026-09-30

Task create/edit, completion with recurrence, lifecycle and reminder dismissal use focused,
parameterized PostgreSQL statements with data-modifying CTEs. This works over Neon HTTP
without interactive transactions. Errors propagate; no compensating hard-delete or best-effort
history writer is used. A failed schedule/event/successor write rolls back the whole statement.

Full edits lock the Task and existing Schedule, checking the expected versions before writing.
The expected Schedule version is read by the action, while the Task version comes from the form.
Reminder dismissal uses the same parent-first lock order and preserves the Task version.
An unchanged reminder retains dismissal; a changed reminder resets it.

Single and bulk completion share the same operation. An existing next series sequence is reused
rather than duplicated when a Task is reopened and completed again. The existing unique series
index remains the final conflict guard. Bulk atomicity is per Task, not across the selection.

The same SQL runs in PGlite tests using all checked-in migrations. Fault-injection tests cover
rollback of task, schedule, successor and event writes. This enables isolated CI verification,
but is not proof of multi-session Neon concurrency behavior; those tests remain necessary.


## D050 — Organization selection and mutation scope are separate from authorization

Date: 2026-09-30

A verified session can choose among active Organizations with an active Membership.
The HttpOnly, SameSite=Lax cookie is a preference; server lookups revalidate it on each request.
No preference + one membership allows direct CRM entry. Multiple memberships require explicit
selection. An invalid or revoked preference redirects to the chooser without implicit fallback.

CRM forms carry `_organizationId` from their rendered OrganizationProvider. Imperative buttons
and Kanban send the same scope explicitly. All CRM Server Actions use requireMutationPermission:
authenticated/verified User → selected active Organization → active Membership → matching submitted
scope → Permission. Client scope never replaces tenant authorization or entity tenant predicates.
An old tab submitted after another tab switches organizations must fail before writes.

Switching revalidates the CRM layout and returns to the dashboard. The provider is keyed by
Organization ID to avoid retaining form state across organizations. Invitation acceptance opens
the chooser. Provisioning a new Organization remains a separate workflow.

Tests cover active memberships, multiple choices, forged/malformed selection, revocation,
inactive Organizations, scope mismatch and server-rendered form fields. Multi-tab browser
verification remains necessary; these tests do not claim full end-to-end coverage.


## D051 — Verified self-service Organization creation is atomic and idempotent

Date: 2026-09-30

Any verified User may create an Organization. No existing tenant Membership is required.
This operation bootstraps only the creator's Owner Membership; normal colleague onboarding
continues through verified invitations. The User ID comes from the server session; the mutation
rechecks email_verified in PostgreSQL and reads the creator's name/email from the auth table.
Browser-supplied user IDs, emails and roles are never accepted.

Organization, four system Roles, Permission bindings, Owner Membership/assignment, default Pipeline,
six Stages and the durable request mapping commit in one Neon HTTP transaction. A data-modifying
CTE handles provisioning. Failure rolls everything back; no compensating cleanup is needed.
Permission keys and initial Roles/Stages share a catalog with the development seed. New tenants
receive only catalogued permissions; arbitrary pre-existing global permission keys are not granted.
Existing global Permission labels and existing tenant Roles are not overwritten by onboarding.

Migration 0012 adds organization_creations with (user_id, request_id) as primary key, a unique
organization_id, and foreign keys to the auth User and Organization. The form keeps its UUID and
name on a recoverable error. A separate advisory-lock statement serializes the per-user request
before the READ COMMITTED provisioning snapshot. Retrying a committed request returns the same
Organization only while it and the creator's Membership remain active. It never recreates Member
access or reassigns Owner. A fresh form/request represents a separate intended Organization.

After creation the verified tenant preference is selected and CRM opens. Generated opaque slugs
avoid name collisions and do not expose user-selected routing/identity fields.

Isolated PGlite tests execute all migrations and production transaction SQL, covering defaults,
auth identity, unverified/missing users, retries, separate creators, revoked access, changed roles,
validation and fault-injected full rollback. This does not claim live multi-session Neon concurrency
or end-to-end browser coverage. Apply the migration before using this feature in a deployed app.

## D052 — Core relationships enforce tenant identity in PostgreSQL

Date: 2026-10-03

Core relationships use composite foreign keys containing Organization identity, with Pipeline
identity included in the Deal-to-Stage key. Referenced tables expose matching composite UNIQUE
constraints. PostgreSQL rejects invalid direct inserts, updates and moves of referenced parents.
This supplements server authorization, permission policies, lifecycle and optimistic locking.

Member/Role assignments gain a required `organization_id`, backfilled from the existing Membership.
All assignment writers derive it from their authorized context or created Membership. Two composite
foreign keys bind the assignment to a Member and Role of that same Organization. No trigger supplies
missing scope and no default is used; omitting scope fails closed.

Nullable core owners and Deal Company retain their single-column SET NULL foreign keys plus composite
NO ACTION tenant checks. This preserves deletion semantics without nulling the record's Organization.
Inactive Membership is permitted as an existing reference; new-assignment policy remains in application code.

CHECK constraints limit Stage type/probability and enforce finite non-negative Deal amount with currency.
Currency is absent or an uppercase three-letter code; amount may be absent with currency, matching the form.
Default Pipeline uniqueness remains deferred until that product rule is confirmed.

Migration 0013 adds the assignment column nullable, backfills it, sets NOT NULL, creates UNIQUE keys
before foreign keys and validates existing rows. A read-only audit produces counts without personal
data. Invalid legacy relationships cause transactional migration failure; deliberate repair is separate.
No existing applied migration is edited. Release requires pausing writes while migrating and activating
the matching application because old assignment writers omit the new column.

Verification includes populated upgrade, full Drizzle journal/replay, direct invalid writes, parent moves,
nullable deletion, inactive owners and actual invitation/Owner-guard SQL with fault-injected rollback
in isolated PGlite PostgreSQL. This is not proof of live multi-session Neon or browser behavior.

## D053 — Comment persistence shares parent locking and atomic history

Date: 2026-10-03

Creating/editing comments uses `save-comment.ts`. Its parameterized statement locks the active,
non-deleted parent in the authorized Organization before the comment write and Activity insertion.
Archive/restore reuse `comment-target.ts` so all four operations have the same parent predicates.
Only allowlisted entity table names enter SQL; record identity and content remain bound parameters.

Server Actions keep verified tenant scope, comment permissions, parent read and ownership checks.
Editing additionally rechecks the comment's tenant/parent/type, expected version, active lifecycle
and author or server-granted manage permission within SQL. Zero changed rows are not success.
Earlier parent reads are UX pre-checks and cannot authorize a write past concurrent archival.
Event insertion failure rolls back the comment mutation; do not introduce separate/best-effort logging.

Thirty added isolated PGlite PostgreSQL tests run production SQL for all four entity types,
covering successful writes, conflict/lifecycle/tenant policy and fault-injected rollback.
This verifies SQL behavior; real multi-session Neon races and browser workflows remain separate checks.

## D054 — Tenant-scoped Pipeline configuration and lifecycle protection

Date: 2026-10-03

The user prioritized Pipeline management as the next product increment. `/crm/pipelines`
provides read-only configuration with `pipelines.read`; writes require `pipelines.manage`
and the rendered Organization scope. Shared provisioning defaults create the initial stages.

`manage-pipeline.ts` serializes configuration by an Organization advisory lock, then locks
its Pipeline rows in ID order in a separate statement. Pipeline `version` guards every
configuration mutation, including Stage changes. Duplicate names/order roll back all writes.
Default switching atomically clears other defaults and selects an active expected target.
This enforces the rule for application management writes; a global unique default constraint
is still deferred, and direct SQL/legacy defaults are not automatically repaired.

A default/last active Pipeline or one with active non-deleted Deals cannot be archived.
Archived Deals retain their history; restoring them requires restoring their Pipeline first.
Changing a Stage type is prohibited while non-deleted Deals (including archived) reference it.
At least one open Stage remains. Stage IDs are stable; deletion/archive of Stages is deferred.
Numeric Stage positions remain unique; an occupied position is rejected rather than swapped.

Migration 0014 adds Pipeline versions and a focused Deal trigger. Insert, relationship change
and restore share Pipeline/Stage locks and revalidate active Pipeline and Stage/closedAt
consistency. It rejects stale configuration rather than implementing Stage transitions;
`transition-deal.ts` remains the shared application operation. Existing metadata/archive writes
are unaffected. Guard rejection becomes conflict feedback for transitions and restore.

Isolated PostgreSQL tests execute the production configuration SQL and migration, covering
tenant/version boundaries, rollback, defaults, lifecycle, used Stage protection and valid/stale
Deal state. They do not verify real multi-session Neon concurrency or browser workflows.
