# Next Development Steps

## Immediate next step

Complete the Clients module.

### 1. Client detail page

Create:

/crm/clients/[id]

Show:

- name
- phone
- email
- status
- source
- notes
- created date
- responsible member when available

All queries must be scoped by organizationId.

### 2. Client editing

Add:

/crm/clients/[id]/edit

Use:

- Zod
- Server Actions
- Drizzle
- server-side organization checks

### 3. Client archiving

Implement soft archival using:

isArchived = true

Do not physically delete records by default.

### 4. Client search

Search by:

- first name
- last name
- phone
- email

Prefer server-side filtering.

### 5. Client filters

Initial filters:

- active
- lead
- inactive
- archived

## After Clients module

Next modules:

1. Companies
2. Deals
3. Pipelines
4. Tasks
5. Activity timeline

## Current checkpoint

Working:

- CRM layout
- dashboard
- clients list
- client creation
- Zod validation
- Server Action
- Neon persistence
- organization-scoped client queries