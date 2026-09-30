import { sql } from "@/db";
import { buildTaskLifecycleEvent } from "@/modules/activity/task-activity";

export type TaskStateAction = "todo" | "in_progress" | "reopen" | "cancel" | "archive" | "restore";

// Authorization belongs to the calling action; lifecycle, tenant, version and
// event persistence are enforced together here for individual and bulk writes.
export async function changeTaskState(input: {
  organizationId: string; taskId: string; actorMemberId: string;
  expectedVersion: number; action: TaskStateAction;
}) {
  const event = buildTaskLifecycleEvent(input.action);
  const rows = await sql.query(`
    WITH changed AS (
      UPDATE tasks SET
        status = CASE $5::text WHEN 'todo' THEN 'todo' WHEN 'in_progress' THEN 'in_progress'
          WHEN 'reopen' THEN 'in_progress' WHEN 'cancel' THEN 'cancelled' ELSE status END,
        completed_at = CASE WHEN $5::text IN ('todo', 'in_progress', 'reopen', 'cancel')
          THEN NULL ELSE completed_at END,
        is_archived = ($5::text = 'archive'), version = version + 1, updated_at = now()
      WHERE id = $1::uuid AND organization_id = $2::uuid AND version = $3::integer
        AND is_archived = ($5::text = 'restore') AND deleted_at IS NULL
        AND ($5::text <> 'reopen' OR status = 'completed')
      RETURNING id, organization_id
    ), events AS (
      INSERT INTO activity_events (organization_id, entity_type, entity_id, actor_member_id, event_type, summary)
      SELECT organization_id, 'task', id, $4::uuid, $6, $7 FROM changed RETURNING id
    ) SELECT id FROM changed
  `, [input.taskId, input.organizationId, input.expectedVersion, input.actorMemberId, input.action, event.eventType, event.summary]);
  return (rows[0] as { id: string } | undefined) ?? null;
}

export async function dismissReminder(input: {
  organizationId: string; taskId: string; actorMemberId: string; expectedVersion: number;
}) {
  const event = buildTaskLifecycleEvent("reminder_dismissed");
  const rows = await sql.query(`
    WITH writable_task AS MATERIALIZED (
      SELECT id FROM tasks WHERE id = $1::uuid AND organization_id = $2::uuid
        AND NOT is_archived AND deleted_at IS NULL FOR UPDATE
    ), changed AS (
      UPDATE task_schedules s SET reminder_dismissed_at = now(), version = version + 1, updated_at = now()
      FROM writable_task t WHERE s.task_id = t.id AND s.organization_id = $2::uuid
        AND s.version = $3::integer AND s.reminder_dismissed_at IS NULL AND s.reminder_at IS NOT NULL
      RETURNING s.task_id, s.organization_id
    ), events AS (
      INSERT INTO activity_events (organization_id, entity_type, entity_id, actor_member_id, event_type, summary)
      SELECT organization_id, 'task', task_id, $4::uuid, $5, $6 FROM changed RETURNING id
    ) SELECT task_id AS "taskId" FROM changed
  `, [input.taskId, input.organizationId, input.expectedVersion, input.actorMemberId, event.eventType, event.summary]);
  return (rows[0] as { taskId: string } | undefined) ?? null;
}
