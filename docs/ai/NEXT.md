# Universal CRM — Next Development Steps

Last updated: 2026-09-25

## Current checkpoint

The Clients module is now substantially complete for CRM Core v0.1.

Implemented client capabilities:

- create
- view
- edit
- archive
- restore
- server-side search
- status filtering
- active/archive views
- server-side pagination
- tenant scoping
- RBAC enforcement

The Team module now supports:

- viewing organization members
- viewing assigned roles
- assigning multiple roles
- server-side permission enforcement

Server-side permission helpers are implemented.

Current permissions are resolved through member roles stored in PostgreSQL.

The biggest missing foundation is now:

REAL AUTHENTICATION

---

# Immediate objective

Replace the temporary development identity with a real authenticated user while
preserving the existing multi-tenant and RBAC architecture.

Current temporary identity:

local-dev-owner

Current development organization:

development

Do not remove the current permission architecture.

Authentication should provide identity.

RBAC should continue deciding authorization.

These are separate responsibilities.

---

# Step 1 — Design authentication before coding

Before installing an authentication library or creating new database tables,
decide the authentication model.

The design must answer:

1. How users register or are created.
2. How users log in.
3. Whether authentication uses:
   - email/password
   - external providers
   - magic links
   - another method
4. How sessions are stored and verified.
5. How an authenticated user maps to organization_members.userId.
6. How users with multiple organizations select the active organization.
7. How logout works.
8. How disabled organization members are prevented from accessing CRM data.
9. How account recovery works if passwords are used.

Do not implement multiple authentication strategies at once.

Start with the smallest approach that supports the product requirements.

---

# Step 2 — Preserve the existing membership model

Current organization membership table:

organization_members

Important fields:

- id
- organizationId
- userId
- displayName
- email
- status

Currently:

userId

is a temporary string.

Later it should reference or correspond to the authenticated user's stable ID.

Do not use email as the long-term authorization identity if a stable user ID is
available.

---

# Step 3 — Replace current-member development logic

Current helper:

src/lib/auth/current-member.ts

Currently it resolves:

local-dev-owner

The goal is to change this helper so callers do not need major rewrites.

Desired conceptual flow:

authenticated user
→ userId
→ organization membership
→ active organization
→ current member
→ roles
→ permissions

Existing application code should continue using helpers rather than reading
sessions directly everywhere.

---

# Step 4 — Preserve RBAC

Current access layer:

src/lib/auth/permissions.ts

Important functions:

- getCurrentAccessContext()
- hasPermission()
- requirePermission()

Do not bypass these helpers after authentication is added.

Authentication answers:

Who is this user?

Authorization answers:

What may this user do?

Both checks are required.

---

# Step 5 — Login

Implement a login route/page after the authentication design is decided.

Possible route:

/login

After successful login, a user with a valid CRM membership should be able to
enter:

/crm

Unauthorized users must not receive CRM business data.

Do not rely only on hidden navigation items.

---

# Step 6 — Logout

Implement logout.

After logout:

- session must be invalidated
- protected CRM routes must no longer be accessible
- protected Server Actions must fail authorization
- stale browser state must not grant access

---

# Step 7 — Authenticated organization membership

After login, resolve organization membership from the authenticated user.

Do not trust:

organizationId from forms
organizationId from arbitrary browser state

The selected organization must belong to the authenticated user.

Current development organization helper can then be replaced or refactored.

---

# Step 8 — Multiple organizations

The database already supports the concept that one user can belong to multiple
organizations.

Do not hardcode the architecture to a single organization.

The first authentication implementation may initially support one organization
per user in the UI, but helpers should not make multiple organizations
impossible later.

A future active-organization selector may be needed.

---

# Step 9 — Test RBAC with real identities

Once authentication works, create or connect real test accounts representing:

Owner

Admin

Manager

Viewer

Expected client access:

Owner:
- read
- create
- update
- archive
- delete permission exists

Admin:
- same current permission set as Owner

Manager:
- clients.read
- clients.create
- clients.update
- clients.archive

Viewer:
- clients.read only

Expected Team access:

Owner:
- members.read
- members.manage

Admin:
- members.read
- members.manage

Manager:
- no Team access with current seed permissions

Viewer:
- no Team access with current seed permissions

Verify both:

UI visibility

and:

direct server access / Server Actions

The server remains the security boundary.

---

# Step 10 — Harden role management

Current Team role update performs:

DELETE old member roles
→ INSERT selected member roles

This should eventually become atomic.

Recommended improvement:

use a PostgreSQL transaction if supported cleanly by the chosen Drizzle / Neon
execution path.

Requirements must remain:

- members.manage permission
- target member belongs to current organization
- selected roles belong to current organization
- at least one role remains
- current user cannot accidentally remove their own administrative access

Do not weaken these checks for UI convenience.

---

# Step 11 — Team improvements after authentication

After real login works, useful Team improvements include:

- invite/create member
- deactivate member
- reactivate member
- member detail page
- role display improvements
- custom role management
- role permission management

These are not required before proving authentication.

---

# Step 12 — Companies module

Start Companies after authentication and real member resolution are stable.

Before creating the companies table, design the entity.

Questions to resolve:

- company name
- legal name
- BIN / tax identifier where applicable
- website
- phone
- email
- address
- industry
- notes
- ownerMemberId
- archive state
- relation between company and contacts/clients
- whether one client can belong to zero, one or multiple companies

Do not model Companies as merely another Client record.

Clients/contacts and Companies should remain distinct concepts.

---

# Later CRM roadmap

After Companies:

1. Deals
2. Pipelines
3. Pipeline stages
4. Tasks
5. Activity timeline
6. Comments
7. Custom fields
8. Saved views
9. Automation engine
10. Audit log
11. External integrations
12. AI assistant

AI remains intentionally later in the roadmap.

The CRM core and permission model should be stable before AI receives tools for
business actions.

---

# Architectural rules

## Multi-tenancy

Every tenant-owned business query must remain scoped by:

organizationId

Never accept organizationId from the browser as authorization proof.

---

## Authentication

Authentication identifies the user.

Do not spread session parsing across every component.

Prefer centralized server helpers.

---

## Authorization

Continue using server-side permission checks.

UI checks may improve UX but do not replace authorization.

---

## Validation

Validate external input with Zod.

This includes:

- forms
- route parameters
- search parameters
- identifiers
- role selections
- future API payloads

---

## Database

PostgreSQL / Neon remains the primary source of truth.

Use Drizzle for database access.

Do not manually modify an already-applied migration.

Generate a new migration when the schema actually changes.

---

## Mutations

Tenant-owned mutations must include tenant scoping.

For updates, manually update:

updatedAt

where appropriate.

---

## Frontend

Prefer Server Components for data reading.

Use Client Components only when browser interactivity is needed.

Prefer Server Actions for ordinary CRM mutations.

---

## Infrastructure

Do not introduce without a concrete requirement:

- Redis
- queues
- microservices
- separate backend
- paid infrastructure
- AI API dependencies

Keep the modular monolith architecture while the CRM core is still developing.

---

# Security rules

Never commit:

- DATABASE_URL
- passwords
- API keys
- session secrets
- authentication secrets

`.env.local` must remain untracked.

If a secret is ever pushed to GitHub, rotate the secret.

Do not treat deleting it from the latest commit as sufficient.

---

# Current development test members

Seed currently creates:

local-dev-owner
→ Development Owner
→ Owner

local-dev-manager
→ Development Manager
→ Manager

local-dev-viewer
→ Development Viewer
→ Viewer

These are development records.

They are not yet real login accounts.

Do not build production authentication around these literal IDs.

---

# Immediate next task

Do not start coding Companies yet.

First:

1. decide the authentication approach
2. define the user/session model
3. define how authenticated user IDs map to organization_members.userId
4. define active-organization resolution

Then implement the smallest working authentication flow.

After authentication works:

authenticated user
→ membership
→ organization
→ roles
→ permissions
→ CRM

should become the standard request security path.