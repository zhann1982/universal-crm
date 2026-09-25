# Universal CRM — Next Development Steps

Last updated: 2026-09-25

## Current checkpoint

The authentication foundation is now working.

Implemented:

Better Auth
→ email/password registration
→ login
→ session
→ stable authenticated user ID
→ organization membership
→ roles
→ permissions
→ CRM

The previous runtime dependency on:

local-dev-owner

has been removed from current-member resolution.

Clients and Team already use the same RBAC layer.

The immediate priority is now:

REAL MEMBER MANAGEMENT + REAL RBAC TESTING

Do not start Companies yet.

---

# Step 1 — Finish CRM logout UX

The CRM should provide logout directly from the application shell.

Logout must:

- invalidate the Better Auth session
- redirect to /login
- make protected CRM routes inaccessible
- prevent Server Actions from executing without a valid session

Do not rely only on the temporary /auth-test page for logout.

---

# Step 2 — Add registered users to the organization

Current authentication allows anyone using the development application to create
a Better Auth account.

Registration alone must NOT grant CRM access.

A user needs an active organization_members record.

Implement a simple first Team workflow:

Owner/Admin
→ enters registered user's email
→ application finds Better Auth user
→ creates organization_members row
→ stores Better Auth user.id in organization_members.userId
→ assigns initial role

Requirements:

- members.manage
- user must exist in Better Auth
- target organization is resolved server-side
- selected role must belong to current organization
- duplicate membership must be rejected
- email may be used for lookup
- stable user.id must be stored as identity

Do not use email itself as the membership identity.

---

# Step 3 — Test Manager with a real session

Create a real Better Auth account representing Manager.

Connect it to the development organization.

Assign:

Manager

Expected permissions:

- clients.read
- clients.create
- clients.update
- clients.archive

Expected restrictions:

- no members.read
- no members.manage
- Team navigation hidden
- direct /crm/team access denied
- no administrative role management

Verify both UI behavior and direct server authorization.

---

# Step 4 — Test Viewer with a real session

Create a real Better Auth account representing Viewer.

Assign:

Viewer

Expected:

- can view Clients
- cannot create Client
- cannot edit Client
- cannot archive Client
- cannot restore Client
- cannot access Team

Again verify:

UI
+
direct protected routes
+
Server Actions

The server is the security boundary.

---

# Step 5 — Reduce legacy development fixtures

The seed currently contains historical development members:

- local-dev-owner
- local-dev-manager
- local-dev-viewer

They were useful before real authentication.

Do not delete them blindly if they are still useful for database development.

However:

- runtime authentication must not depend on them
- production assumptions must not reference them
- real RBAC tests should use Better Auth identities

Eventually simplify the seed around real development scenarios.

---

# Step 6 — Harden role replacement

Current member role update:

DELETE current assignments
→ INSERT new assignments

This is not atomic.

Failure after DELETE can leave a member without roles.

Target behavior:

BEGIN
→ validate target
→ validate roles
→ delete old roles
→ insert new roles
→ COMMIT

If the current Neon/Drizzle execution path supports transactions cleanly, use
one.

Preserve all existing checks:

- members.manage
- target member organization
- role organization
- at least one role
- no own-role accidental lockout

---

# Step 7 — Prevent last-owner lockout

Current protection prevents a user from changing their own roles.

This is useful but incomplete.

Future role management should also ensure that an organization cannot
accidentally lose its last Owner-equivalent administrator.

Before allowing broader Owner/Admin management, define the invariant.

Possible rule:

Every active organization must have at least one active member with an Owner
role.

Do not implement destructive administrative workflows without this protection.

---

# Step 8 — Member lifecycle

After real-role tests are successful, add:

- deactivate member
- reactivate member

An inactive member must not pass getCurrentMember().

Current member resolution already requires:

status = active

Do not physically delete memberships by default.

Deactivation is safer and preserves historical ownership references.

---

# Step 9 — Production authentication gaps

Current auth is sufficient for local development but not yet complete for public
production.

Before public launch address:

- email verification
- forgot password
- password reset
- production email delivery
- rate limiting / brute-force strategy
- account recovery
- secure production BETTER_AUTH_URL
- deployment cookie behavior
- HTTPS
- secret management

Do not block CRM core development on all of these yet.

---

# Step 10 — Active organization design

Current organization is still:

development

The database already supports one authenticated user belonging to multiple
organizations.

Before multi-organization UI is required, design:

authenticated user
→ memberships
→ active organization
→ member
→ permissions

Possible future active organization state must always be validated against real
membership.

Never trust arbitrary organizationId from the browser.

---

# Step 11 — Companies module

Begin Companies only after:

- real Owner works
- real Manager works
- real Viewer works
- member addition works
- membership security is stable
- role management is hardened enough

Before schema creation, design Companies as a distinct entity.

Potential fields:

- name
- legalName
- tax identifier / BIN
- website
- phone
- email
- address
- industry
- notes
- ownerMemberId
- isArchived
- deletedAt
- createdAt
- updatedAt

Resolve the Client ↔ Company relationship deliberately.

Do not model Company as merely another Client.

---

# Later roadmap

After Companies:

1. Deals
2. Pipelines
3. Stages
4. Tasks
5. Comments
6. Activity timeline
7. Custom fields
8. Saved views
9. Automation engine
10. Audit log
11. Integrations
12. AI assistant

---

# Architectural rules

## Authentication

Better Auth owns authentication.

Do not create a parallel custom password/session system.

Do not parse authentication independently in every page.

Use centralized helpers.

## Authorization

CRM permissions remain application-owned.

Better Auth identifies users.

Better Auth does not replace CRM RBAC.

Use:

getCurrentMember()

getCurrentAccessContext()

hasPermission()

requirePermission()

## Multi-tenancy

Every tenant-owned operation must be scoped to the authenticated member's
organization.

Never accept browser-supplied organizationId as proof of access.

## Validation

Use Zod for external input.

## Database

Use Drizzle.

Generate migrations for schema changes.

Never edit an already-applied migration casually.

## Frontend

Prefer Server Components.

Use Client Components only when interaction requires them.

## Infrastructure

Do not add without a concrete requirement:

- Redis
- queues
- microservices
- separate backend
- paid infrastructure
- AI API dependencies

---

# Immediate next task

Finish the Team identity workflow.

Target:

Owner login
→ Team
→ add already-registered user
→ assign Manager or Viewer
→ logout
→ login as new user
→ verify real permission behavior

Once this works reliably:

Better Auth
→ membership
→ RBAC
→ tenant data

will be proven end-to-end for multiple real identities.