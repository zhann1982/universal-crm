Universal CRM — Comments + Activity Stage 2
===========================================

Purpose
-------
Adds full Task activity history on top of Comments + Activity Stage 1.

New Task events
---------------
- task.created
- task.title_changed
- task.description_changed
- task.status_changed
- task.owner_changed
- task.priority_changed
- task.due_at_changed
- task.relations_changed
- task.completed
- task.reopened
- task.cancelled
- task.archived
- task.restored
- task.reminder_changed
- task.reminder_dismissed
- task.recurrence_changed
- task.recurrence_next_created

Also included
-------------
- generic activity recorder for CRM entity events;
- unit tests for task activity diff/lifecycle logic;
- one-time backfill for task.created events on existing tasks;
- Timeline now renders details for non-comment events;
- npm test is extended with task-activity.test.ts by the installer.

Installation
------------
1. Extract this archive into the universal-crm project root, preserving folders.
2. Run:

   node .\apply-comments-activity-stage-2.mjs

3. No database migration is required.
4. Backfill historical creation events for existing tasks:

   node --env-file=.env.local --import tsx src/db/backfill-task-activity.ts

5. Verify:

   npm test
   npx tsc --noEmit --incremental false
   npm run lint
   npm run build
   npm run dev

Runtime checks
--------------
Open a Task and verify "История и комментарии" after:
- editing title or description;
- changing status/priority/owner/due date;
- changing CRM relations;
- changing reminder or recurrence;
- completing/reopening;
- archiving/restoring;
- bulk status/archive actions;
- dismissing a reminder;
- completing a recurring task (new occurrence + series event).

Notes
-----
- Stage 2 reuses the existing activity_events table from Stage 1.
- Activity logging is best-effort: a logging failure is reported to the server console but does not roll back a successful CRM mutation.
- Existing historical Task mutations cannot be reconstructed. The backfill only creates the original task.created event from tasks.created_at when it is missing.
