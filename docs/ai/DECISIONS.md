# Universal CRM — Architecture Decisions

Last updated: 2026-09-27

## Decision ID rule

Decision IDs are permanent.

Existing IDs must never be renumbered or reused.

If a new decision is added, use the next unused number.

Changing the status or wording of an existing decision does not change its ID.

---

## D001 — Multi-tenancy from the beginning

Status: accepted

Organizations are first-class tenants.

Tenant-owned business records use organizationId.

Browser-supplied organizationId is never authorization proof.

Reason:

Retrofitting multi-tenancy later would require major schema and authorization
changes.

---

## D002 — PostgreSQL as primary datastore

Status: accepted

Use PostgreSQL for CRM data.

Reason:

The product has relational data, cross-entity integrity requirements, indexing
needs and transactional business rules.

---

## D003 — Neon during early development

Status: accepted

Use Neon PostgreSQL while the current cost/scale profile remains appropriate.

Reason:

PostgreSQL compatibility and low development cost.

---

## D004 — Drizzle ORM

Status: accepted

Use Drizzle for schema and normal application database access.

Schema changes use new migrations.

Do not casually modify already-applied migrations.

---

## D005 — Modular monolith first

Status: accepted

Keep frontend and server business code in the Next.js application.

Do not introduce microservices or a separate backend without a concrete
requirement.

Reason:

Current product scale does not justify distributed-system complexity.

---

## D006 — Minimize infrastructure

Status: accepted

Do not add Redis, queues, brokers, vector databases or paid infrastructure
without a demonstrated requirement.

---

## D007 — Configurable universal CRM

Status: accepted

The core product must remain configurable instead of hard-coded for one
industry.

Target configurable areas include:

- fields
- Pipelines
- Stages
- Roles
- Permissions
- views
- automations

---

## D008 — AI after stable CRM core

Status: accepted

AI is a later application layer.

AI must use controlled business operations and normal authorization.

AI never receives unrestricted database access.

---

## D009 — Better Auth owns authentication

Status: accepted

Better Auth handles:

- account identity
- password authentication
- sessions
- email verification tokens

The CRM does not maintain a parallel password/session system.

---

## D010 — Authentication and CRM authorization are separate

Status: accepted

Authentication answers:

Who is the User?

CRM authorization answers:

Which Organization does the User belong to and what may they do?

Current security chain:

User
→ verified identity
→ active Organization
→ active Membership
→ Roles
→ Permissions
→ business operation

Registration alone does not grant tenant access.

---

## D011 — Better Auth user.id is the CRM identity

Status: accepted

organization_members.userId stores the stable Better Auth User identifier.

Email is not the authorization identity.

Consequence:

email lookup is only a controlled discovery/invitation mechanism.

---

## D012 — Inactive Membership denies CRM access

Status: accepted

An authenticated User must have an active Membership for CRM access.

Prefer Membership deactivation over deletion because historical records may
reference Members.

---

## D013 — Organization selection must validate Membership

Status: accepted

Current development still uses a fixed Organization.

Future Organization switching must validate real active Membership server-side.

---

## D014 — Company and Client are separate entities

Status: accepted

Client:

person/contact

Company:

business/legal organization

Do not model Company as a Client subtype.

---

## D015 — Client ↔ Company is many-to-many

Status: accepted

Use client_companies.

A Client may relate to multiple Companies.

A Company may contain multiple Client contacts.

---

## D016 — Archive / restore is the normal business lifecycle

Status: accepted

Important CRM records prefer:

archive
→ restore

over normal hard deletion.

Reason:

history and future references must be preserved.

---

## D017 — Pipelines and Stages are first-class entities

Status: accepted

Deals use configurable Pipelines and Stages.

Stage attributes include:

- position
- type
- probability
- optional color

---

## D018 — Deal state derives from Stage type

Status: accepted

Do not add a second independent Deal won/lost status.

Stage type is:

- open
- won
- lost

Rules:

open
→ closedAt null

won/lost
→ closedAt set

---

## D019 — Deal stores Pipeline and Stage

Status: accepted with strengthening planned

Deal stores:

pipelineId
stageId

Current application code validates the relationship.

Future database design should also enforce:

Organization
+ Pipeline
+ Stage

consistency with composite constraints/FKs where practical.

---

## D020 — Money uses PostgreSQL numeric

Status: accepted

Deal amount uses numeric(14,2).

Currency remains separate.

Different currencies are not added into one financial total.

---

## D021 — Relationship IDs require server authorization

Status: accepted

A valid UUID is not authorization.

Every submitted relationship must be checked against:

- authenticated tenant
- Permissions
- lifecycle state
- relationship invariants

---

## D022 — Neon HTTP transaction limitations must be explicit

Status: accepted

Do not assume normal interactive transaction callbacks are available through the
current Neon HTTP path.

db.batch does not make earlier pre-checks concurrency-safe.

Critical invariants require deliberate atomic design.

---

## D023 — Kanban is Pipeline-centered

Status: accepted

Kanban shows one selected Pipeline.

Drag-and-drop changes Stage only inside that Pipeline.

Cross-Pipeline movement is an explicit Deal edit/business operation.

---

## D024 — Owner protection needs a stronger identity and atomic invariant

Status: accepted as current limitation

Target: planned

Current behavior:

- last active Owner is protected by application pre-check
- Owner is still identified through the current Role model

Target:

- stable Role systemKey
- explicit ownership transfer
- concurrency-safe last-Owner protection

Reason:

mutable display names and separate pre-check/write steps are too weak for a
critical administrative invariant.

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

Business functions should receive trusted server-created context.

They should not independently derive tenant identity when unnecessary.

Reason:

this reduces accidental authorization gaps in future API, automation and AI
entry points.

---

## D026 — Important business logic moves into small domain modules

Status: accepted direction

Keep the modular monolith.

Introduce focused modules such as:

modules/deals
modules/companies
modules/team
modules/clients

Server Actions should become thin adapters where practical.

Do not create a generic repository framework.

Reason:

important business rules should not diverge between pages, Actions and future
entry points.

---

## D027 — Deal Stage transition becomes one business operation

Status: accepted and implemented

Current implementation:

src/modules/deals/transition-deal.ts

The shared transition operation serves current Stage movement workflows and is
the required path for future automation/API/AI Stage movement.

It owns:

- input validation
- tenant validation
- active Deal lifecycle
- current Pipeline
- target Stage validation
- closedAt rule
- optimistic concurrency rule

Reason:

separate implementations can diverge and create invalid Pipeline/Stage state.

---

## D028 — Optimistic locking for mutable collaborative records

Status: accepted and implemented for Deal

Deal uses:

version integer not null default 1

Mutation includes expected version.

Successful mutation increments version.

Zero affected rows means conflict.

Current version-changing Deal mutations include:

- full edit
- Stage transition
- archive
- restore

Reason:

multiple Users may edit, archive or move the same record concurrently.

Silent last-write-wins is not acceptable for important CRM state.

Future mutable collaborative records should evaluate whether they also require
version-based optimistic locking.

---

## D029 — Important tenant invariants also belong in PostgreSQL

Status: accepted direction

Application validation remains required.

Where feasible, add database constraints for:

- Stage Organization/Pipeline
- Deal Organization/Pipeline/Stage
- Member/Role tenant consistency
- Client/Company tenant consistency
- probability bounds
- Stage type values
- amount/currency consistency
- default Pipeline uniqueness if confirmed

Reason:

application code alone cannot protect every race or future entry point.

---

## D030 — Exact email comparison for identity workflows

Status: accepted and implemented

Identity lookup by email uses canonicalized exact equality.

LIKE/ILIKE pattern semantics are not allowed for identity matching.

Current canonicalization:

- trim
- lowercase

Ambiguous canonical matches are rejected.

Characters such as `_` and `%` are literal.

Production Membership creation still requires stronger invitation semantics.

---

## D031 — Organization activity is part of tenant access

Status: accepted and implemented for current tenant model

organizations.isActive has security meaning.

Current rule:

inactive Organization
→ no CRM business access

The check is part of current Organization resolution.

Future Organization switching must preserve the same rule.

---

## D032 — Related reference data needs explicit permission semantics

Status: proposed

Responsible-member selection and related display data should not implicitly
require or expose full Team information.

Introduce either:

- dedicated permission
or
- deliberately restricted directory DTO

as product design requires.

Reason:

current Company, Deal and Dashboard policies remain inconsistent.

---

## D033 — Date-only business values should use date semantics

Status: proposed

If expectedCloseAt represents a calendar day, prefer PostgreSQL date.

Do not rely on Date.parse overflow behavior or artificial noon UTC.

If an exact timestamp is required instead, define Organization timezone
semantics explicitly.

---

## D034 — Existing `notes` fields remain descriptions

Status: accepted

Client/Company/Deal `notes` fields are simple descriptive text.

They are not the future collaborative Notes system.

Collaborative Notes will be separate records.

---

## D035 — Collaborative Notes and Activity are separate concepts

Status: proposed

Note:

human-authored collaboration

Activity:

structured business event

Future Note fields may include:

- author
- createdAt
- updatedAt
- lastEditedBy
- deletedAt

Future Activity includes events such as:

- Stage changed
- owner changed
- archive/restore
- Task state change

Reason:

free-form collaboration and structured history have different requirements.

---

## D036 — Activity should be introduced before advanced analytics/automation

Status: proposed

Do not postpone all Activity history to the end of the roadmap.

Historical events are required for:

- debugging
- collaboration
- Pipeline duration analytics
- automation
- future AI summaries

Current state alone cannot reconstruct historical transitions reliably.

---

## D037 — Tasks are the next major product module after stabilization

Status: accepted direction

After security/concurrency stabilization, prioritize Tasks before broad
configuration features.

Reason:

Tasks and next actions turn the CRM from a record catalog into a daily
operational tool.

---

## D038 — Direct Deal contacts should use a flexible relationship model

Status: proposed

Do not add a single Deal.clientId by default.

Likely future model:

deal_clients

Support:

- multiple contacts
- contact role
- primary contact

Contacts do not need to be restricted to the Deal's selected Company.

---

## D039 — Scale with incremental loading, not premature infrastructure

Status: accepted direction

As datasets grow, prefer:

- pagination
- searchable selectors
- per-column incremental Kanban loading
- SQL aggregates
- query-plan-guided indexes

Do not solve ordinary query/DOM scaling with microservices or Redis by default.

---

## D040 — AI uses the same module operations as the UI

Status: accepted direction

Future AI mutations must call the same domain operations used by human
workflows.

AI must respect:

- Better Auth
- verified identity
- tenant context
- RBAC
- validation
- optimistic locking
- database invariants
- lifecycle policy
- Activity logging

Start AI with read-only/read-mostly use cases.

---

## D041 — Verified email is required for normal CRM access

Status: accepted and implemented

A valid Better Auth Session alone is not sufficient for CRM access.

Normal CRM access requires:

session.user.emailVerified = true

Development login may still succeed before verification.

The CRM authorization layer redirects unverified Users to the verification
workflow.

Reason:

registration with an email address is not proof that the User controls that
identity.

Production email delivery and invitation acceptance are still separate future
requirements.

---

## D042 — Existing inactive responsible Member may remain unchanged

Status: accepted and implemented for Company and Deal editing patterns

An existing relationship to a responsible Member may remain when that Member
later becomes inactive.

Changing unrelated fields must not require replacing the responsible Member.

However:

assigning a new responsible Member
→ target Member must be active

Reason:

historical/business relationships should not make the entire record impossible
to edit merely because a staff Member was later deactivated.

---

## D043 — Deal version changes on every real Deal mutation

Status: accepted

Deal.version represents collaborative state freshness.

Every successful mutation that changes Deal business state must increment
version.

Current examples:

- full edit
- Stage transition
- archive
- restore

A no-op Stage transition does not increment version.

Future Deal mutation paths must preserve this invariant.

Reason:

if one mutation path fails to increment version, stale forms may incorrectly
remain valid and overwrite newer state.