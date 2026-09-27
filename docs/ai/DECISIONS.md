# Universal CRM — Architecture Decisions

Last updated: 2026-09-27

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

Status: accepted with strengthening planned

Deal stores `pipelineId` and `stageId`. Application validation exists; stronger database consistency is planned.

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

Status: accepted as current limitation

Target:

- stable Role system identity
- explicit ownership transfer
- concurrency-safe last-Owner protection

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
