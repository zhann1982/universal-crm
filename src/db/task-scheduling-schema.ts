import {
  index,
  foreignKey,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { organizations, tasks } from "./schema";

/*
|--------------------------------------------------------------------------
| Task Schedules
|--------------------------------------------------------------------------
|
| Дополнительные данные планирования Task.
|
| Таблица вынесена отдельно, чтобы reminders/recurrence не раздували
| базовую сущность Task и могли развиваться независимо.
|
*/
export const taskSchedules = pgTable(
  "task_schedules",
  {
    taskId: uuid("task_id")
      .primaryKey()
      .references(() => tasks.id, {
        onDelete: "cascade",
      }),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "cascade",
      }),

    reminderAt: timestamp("reminder_at", {
      withTimezone: true,
    }),

    reminderDismissedAt: timestamp("reminder_dismissed_at", {
      withTimezone: true,
    }),

    recurrenceFrequency: varchar("recurrence_frequency", {
      length: 32,
    })
      .default("none")
      .notNull(),

    recurrenceInterval: integer("recurrence_interval").default(1).notNull(),

    recurrenceEndAt: timestamp("recurrence_end_at", {
      withTimezone: true,
    }),

    recurrenceSeriesId: uuid("recurrence_series_id"),

    recurrenceSequence: integer("recurrence_sequence").default(1).notNull(),

    version: integer("version").default(1).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "task_schedules_org_task_fk",
      columns: [table.organizationId, table.taskId],
      foreignColumns: [tasks.organizationId, tasks.id],
    }).onDelete("cascade"),
    index("task_schedules_org_reminder_idx").on(
      table.organizationId,
      table.reminderAt,
    ),

    index("task_schedules_org_task_idx").on(table.organizationId, table.taskId),

    index("task_schedules_org_series_idx").on(
      table.organizationId,
      table.recurrenceSeriesId,
    ),

    uniqueIndex("task_schedules_org_series_sequence_unique").on(
      table.organizationId,
      table.recurrenceSeriesId,
      table.recurrenceSequence,
    ),
  ],
);
