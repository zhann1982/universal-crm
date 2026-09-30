import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, sql } from "@/db";
import { tasks } from "@/db/schema";
import { taskSchedules } from "@/db/task-scheduling-schema";
import { buildTaskLifecycleEvent } from "@/modules/activity/task-activity";
import type { ActivityEventDraft } from "@/modules/activity/event-draft";
import { getNextRecurrenceDueAt, getNextReminderAt, shouldCreateNextOccurrence, type TaskRecurrenceFrequency } from "./recurrence";

export type TaskFields = {
  title: string;
  description: string | null;
  status: string;
  priority: string;
  ownerMemberId: string | null;
  clientId: string | null;
  companyId: string | null;
  dealId: string | null;
  dueAt: Date | null;
};

export type ScheduleFields = {
  reminderAt: Date | null;
  recurrenceFrequency: string;
  recurrenceInterval: number;
  recurrenceEndAt: Date | null;
  recurrenceSeriesId: string | null;
  recurrenceSequence: number;
};

// Call only after server authorization, schema and relationship validation.
// All writes (including recurrence and history) share one PostgreSQL statement.
// A null version means creation, not "skip concurrency validation" on update.
export async function saveTask(input: {
  taskId: string;
  organizationId: string;
  actorMemberId: string;
  expectedVersion: number | null;
  expectedScheduleVersion: number | null;
  task: TaskFields;
  schedule: ScheduleFields;
  events: ActivityEventDraft[];
  createNextOccurrence: boolean;
}): Promise<{ id: string; nextTaskId: string | null } | null> {
  const { task, schedule } = input;
  const enabled = schedule.recurrenceFrequency !== "none";
  let next: { id: string; dueAt: Date; reminderAt: Date | null } | null = null;
  if (input.createNextOccurrence && task.status === "completed" && task.dueAt && enabled) {
    const dueAt = getNextRecurrenceDueAt({
      dueAt: task.dueAt,
      frequency: schedule.recurrenceFrequency as TaskRecurrenceFrequency,
      interval: schedule.recurrenceInterval,
    });
    if (dueAt && shouldCreateNextOccurrence({ nextDueAt: dueAt, recurrenceEndAt: schedule.recurrenceEndAt })) {
      next = {
        id: randomUUID(), dueAt,
        reminderAt: getNextReminderAt({ dueAt: task.dueAt, reminderAt: schedule.reminderAt, nextDueAt: dueAt }),
      };
    }
  }

  // The only SQL interpolation below selects one of two constant statements.
  // All application values are parameters, including the event payload.
  const mutation = input.expectedVersion === null ? `
    changed_task AS (
      INSERT INTO tasks (id, organization_id, created_by_member_id, owner_member_id,
        client_id, company_id, deal_id, title, description, status, priority, due_at, completed_at)
      SELECT id, organization_id, $4::uuid, owner_member_id, client_id, company_id,
        deal_id, title, description, status, priority, due_at,
        CASE WHEN status = 'completed' THEN now() ELSE NULL END FROM task_input
      RETURNING *
    )` : `
    locked_task AS MATERIALIZED (
      SELECT t.* FROM tasks t, task_input i
      WHERE t.id = i.id AND t.organization_id = i.organization_id
        AND t.version = $3::integer AND NOT t.is_archived AND t.deleted_at IS NULL
      FOR UPDATE OF t
    ), locked_schedule AS MATERIALIZED (
      SELECT s.* FROM task_schedules s JOIN locked_task t ON s.task_id = t.id
      FOR UPDATE OF s
    ), eligible_task AS (
      SELECT t.id FROM locked_task t WHERE
        ($5::integer IS NULL AND NOT EXISTS (SELECT 1 FROM locked_schedule)) OR
        EXISTS (SELECT 1 FROM locked_schedule s WHERE s.version = $5::integer
          AND s.organization_id = t.organization_id)
    ), changed_task AS (
      UPDATE tasks t SET title = i.title, description = i.description, status = i.status,
        priority = i.priority, owner_member_id = i.owner_member_id,
        client_id = i.client_id, company_id = i.company_id, deal_id = i.deal_id,
        due_at = i.due_at, completed_at = CASE WHEN i.status = 'completed'
          THEN COALESCE(t.completed_at, now()) ELSE NULL END,
        version = t.version + 1, updated_at = now()
      FROM task_input i, eligible_task e
      WHERE t.id = e.id AND t.id = i.id AND t.organization_id = i.organization_id
        AND t.version = $3::integer AND NOT t.is_archived AND t.deleted_at IS NULL
      RETURNING t.*
    )`;

  const rows = await sql.query(`
    WITH request_versions AS (SELECT $3::integer AS task_version, $5::integer AS schedule_version),
    task_input AS (SELECT * FROM jsonb_populate_record(NULL::tasks, $1::jsonb)),
    schedule_input AS (SELECT * FROM jsonb_populate_record(NULL::task_schedules, $2::jsonb)),
    ${mutation},
    changed_schedule AS (
      INSERT INTO task_schedules (task_id, organization_id, reminder_at, recurrence_frequency,
        recurrence_interval, recurrence_end_at, recurrence_series_id, recurrence_sequence)
      SELECT t.id, t.organization_id, s.reminder_at, s.recurrence_frequency,
        s.recurrence_interval, s.recurrence_end_at, s.recurrence_series_id, s.recurrence_sequence
      FROM changed_task t CROSS JOIN schedule_input s
      ON CONFLICT (task_id) DO UPDATE SET
        reminder_at = EXCLUDED.reminder_at,
        reminder_dismissed_at = CASE WHEN task_schedules.reminder_at IS DISTINCT FROM EXCLUDED.reminder_at
          THEN NULL ELSE task_schedules.reminder_dismissed_at END,
        recurrence_frequency = EXCLUDED.recurrence_frequency,
        recurrence_interval = EXCLUDED.recurrence_interval,
        recurrence_end_at = EXCLUDED.recurrence_end_at,
        recurrence_series_id = EXCLUDED.recurrence_series_id,
        recurrence_sequence = EXCLUDED.recurrence_sequence,
        version = task_schedules.version + 1, updated_at = now()
      RETURNING *
    ), next_task AS (
      INSERT INTO tasks (id, organization_id, created_by_member_id, owner_member_id,
        client_id, company_id, deal_id, title, description, status, priority, due_at)
      SELECT ($7::jsonb->>'id')::uuid, t.organization_id, t.created_by_member_id, t.owner_member_id,
        t.client_id, t.company_id, t.deal_id, t.title, t.description, 'todo', t.priority,
        ($7::jsonb->>'dueAt')::timestamptz
      FROM changed_task t JOIN changed_schedule s ON s.task_id = t.id
      WHERE $7::jsonb IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM task_schedules existing WHERE existing.organization_id = t.organization_id
          AND existing.recurrence_series_id = s.recurrence_series_id
          AND existing.recurrence_sequence = s.recurrence_sequence + 1
      )
      RETURNING *
    ), next_schedule AS (
      INSERT INTO task_schedules (task_id, organization_id, reminder_at, recurrence_frequency,
        recurrence_interval, recurrence_end_at, recurrence_series_id, recurrence_sequence)
      SELECT n.id, n.organization_id, ($7::jsonb->>'reminderAt')::timestamptz,
        s.recurrence_frequency, s.recurrence_interval, s.recurrence_end_at,
        s.recurrence_series_id, s.recurrence_sequence + 1
      FROM next_task n CROSS JOIN changed_schedule s
      RETURNING task_id
    ), written_events AS (
      INSERT INTO activity_events (organization_id, entity_type, entity_id, actor_member_id,
        event_type, summary, details)
      SELECT t.organization_id, 'task', t.id, $4::uuid, e."eventType", e.summary, e.details
      FROM changed_task t CROSS JOIN jsonb_to_recordset($6::jsonb)
        AS e("eventType" text, summary text, details text)
      UNION ALL
      SELECT n.organization_id, 'task', n.id, $4::uuid, 'task.created',
        'Создана повторяющаяся задача', NULL
      FROM next_task n JOIN next_schedule s ON s.task_id = n.id
      UNION ALL
      SELECT t.organization_id, 'task', t.id, $4::uuid, 'task.recurrence_next_created',
        'Создана следующая задача серии', NULL
      FROM changed_task t WHERE EXISTS (SELECT 1 FROM next_schedule)
      RETURNING id
    )
    SELECT id, (SELECT task_id FROM next_schedule) AS "nextTaskId" FROM changed_task
  `, [
    JSON.stringify({
      id: input.taskId, organization_id: input.organizationId,
      title: task.title, description: task.description, status: task.status,
      priority: task.priority, owner_member_id: task.ownerMemberId,
      client_id: task.clientId, company_id: task.companyId, deal_id: task.dealId, due_at: task.dueAt,
    }),
    JSON.stringify({
      reminder_at: schedule.reminderAt, recurrence_frequency: schedule.recurrenceFrequency,
      recurrence_interval: enabled ? schedule.recurrenceInterval : 1,
      recurrence_end_at: enabled ? schedule.recurrenceEndAt : null,
      recurrence_series_id: enabled ? schedule.recurrenceSeriesId ?? input.taskId : null,
      recurrence_sequence: enabled ? schedule.recurrenceSequence : 1,
    }),
    input.expectedVersion, input.actorMemberId, input.expectedScheduleVersion,
    JSON.stringify(input.events), next ? JSON.stringify(next) : null,
  ]);
  return (rows[0] as { id: string; nextTaskId: string | null } | undefined) ?? null;
}

export async function completeTaskRecord(input: {
  organizationId: string;
  actorMemberId: string;
  taskId: string;
  expectedVersion: number;
}) {
  const [current] = await db.select({ task: tasks, schedule: taskSchedules })
    .from(tasks).leftJoin(taskSchedules, and(
      eq(taskSchedules.taskId, tasks.id),
      eq(taskSchedules.organizationId, tasks.organizationId),
    )).where(and(
      eq(tasks.id, input.taskId), eq(tasks.organizationId, input.organizationId),
      eq(tasks.version, input.expectedVersion), eq(tasks.isArchived, false), isNull(tasks.deletedAt),
    )).limit(1);
  if (!current || current.task.status === "completed") return null;
  return saveTask({
    ...input,
    task: { ...current.task, status: "completed" },
    expectedScheduleVersion: current.schedule?.version ?? null,
    schedule: current.schedule ?? {
      reminderAt: null, recurrenceFrequency: "none", recurrenceInterval: 1,
      recurrenceEndAt: null, recurrenceSeriesId: null, recurrenceSequence: 1,
    },
    events: [buildTaskLifecycleEvent("complete")],
    createNextOccurrence: true,
  });
}
