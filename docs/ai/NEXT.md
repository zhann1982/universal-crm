# Universal CRM — Next Development Steps

Last updated: 2026-09-25

## Current objective

Finish the Clients module before starting Companies.

The basic client lifecycle already works:

Create
→ View
→ Edit
→ Archive

The next work should focus on finding, filtering and managing client records.

---

## Step 1 — Client search

Implement server-side client search on:

/crm/clients

Search should support:

- first name
- last name
- middle name
- phone
- email

Use PostgreSQL filtering through Drizzle.

Do not load all clients into the browser and filter them only with JavaScript.

Search state should be stored in URL search parameters.

Example:

/crm/clients?q=ivanov

All queries must remain scoped by organizationId.

---

## Step 2 — Status filters

Add client filtering by status.

Current statuses:

- active
- lead
- inactive

Example URLs:

/crm/clients?status=active

/crm/clients?status=lead

/crm/clients?status=inactive

Support combining status and search:

/crm/clients?q=ivanov&status=lead

The server must validate filter values.

---

## Step 3 — Active / Archive views

Add a view selector:

Active | Archive

Active view:

isArchived = false

Archive view:

isArchived = true

Example:

/crm/clients?view=active

/crm/clients?view=archive

deletedAt IS NULL must remain part of normal client queries.

Do not physically delete archived records.

---

## Step 4 — Restore archived clients

Add a restore action for archived clients.

Restore should set:

isArchived = false

Requirements:

- validate client UUID
- resolve organization server-side
- scope UPDATE by organizationId
- ensure deletedAt IS NULL
- revalidate relevant pages

Archived records should not be editable until restored.

---

## Step 5 — Pagination

After search and filters work, add server-side pagination.

Suggested initial page size:

25 clients

URL example:

/crm/clients?page=2

Pagination must work together with:

- search
- status
- active/archive view

Example:

/crm/clients?q=ivanov&status=lead&view=active&page=2

Do not retrieve thousands of CRM records for a single page.

---

## Step 6 — Permission helpers

After the Clients UI is functionally complete, start enforcing permissions.

Existing permissions include:

clients.read
clients.create
clients.update
clients.archive
clients.delete

Create server-side helpers for:

- resolving the current member
- resolving member roles
- resolving permissions
- checking a required permission

Desired conceptual API:

requirePermission("clients.read")

requirePermission("clients.create")

requirePermission("clients.update")

requirePermission("clients.archive")

Authorization checks must run on the server.

Client-side permission checks may control UI visibility but must never be the
security boundary.

---

## Step 7 — Authentication

Real authentication is still not implemented.

Current development identity:

local-dev-owner

Current development organization:

development

Do not spread these development values across the codebase.

Keep them isolated behind helper functions so they can later be replaced by
authenticated user and membership resolution.

---

## Step 8 — Companies module

Start Companies only after the Clients module has:

- creation
- detail page
- editing
- archiving
- restore
- search
- filtering
- pagination
- permission enforcement

Initial Companies design should be discussed before creating its database table.

Do not assume a company is just another client.

A future client/contact should be able to be associated with a company.

---

## Later CRM roadmap

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

---

## Architectural rules for the next work

Always scope business data by organizationId.

Validate external input with Zod.

Prefer Server Components for data reading.

Prefer Server Actions for simple application mutations.

Do not expose database credentials to the browser.

Do not introduce:

- Redis
- queues
- microservices
- separate backend
- AI APIs
- paid infrastructure

unless there is a concrete requirement.

Keep the architecture simple while the product core is still being developed.

---

## Immediate next task

Implement together:

1. client search
2. status filter
3. Active / Archive selector

Target page:

/crm/clients

Expected URL-driven state:

?q=
&status=
&view=

After this works, implement restore from archive.