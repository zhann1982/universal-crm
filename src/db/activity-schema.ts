import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  check,
  unique,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  organizationMembers,
  clients,
  companies,
  deals,
  tasks,
  organizations,
} from "./schema";

/*
|--------------------------------------------------------------------------
| Comments
|--------------------------------------------------------------------------
|
| Универсальные комментарии к CRM-сущностям.
|
| entityType:
| client | company | deal | task
|
| entityId намеренно не имеет FK: одна колонка может ссылаться на разные
| бизнес-таблицы. Tenant boundary и доступ проверяются на уровне приложения.
|
*/
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    clientTargetId: uuid("client_target_id").generatedAlwaysAs(
      sql`CASE WHEN entity_type = 'client' THEN entity_id END`,
    ),
    companyTargetId: uuid("company_target_id").generatedAlwaysAs(
      sql`CASE WHEN entity_type = 'company' THEN entity_id END`,
    ),
    dealTargetId: uuid("deal_target_id").generatedAlwaysAs(
      sql`CASE WHEN entity_type = 'deal' THEN entity_id END`,
    ),
    taskTargetId: uuid("task_target_id").generatedAlwaysAs(
      sql`CASE WHEN entity_type = 'task' THEN entity_id END`,
    ),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "cascade",
      }),

    entityType: varchar("entity_type", {
      length: 32,
    }).notNull(),

    entityId: uuid("entity_id").notNull(),

    authorMemberId: uuid("author_member_id").references(
      () => organizationMembers.id,
      {
        onDelete: "set null",
      },
    ),

    body: text("body").notNull(),

    isArchived: boolean("is_archived").default(false).notNull(),

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

    deletedAt: timestamp("deleted_at", {
      withTimezone: true,
    }),
  },
  (table) => [
    check(
      "comments_entity_type_check",
      sql`${table.entityType} IN ('client','company','deal','task')`,
    ),
    foreignKey({
      name: "comments_org_client_fk",
      columns: [table.organizationId, table.clientTargetId],
      foreignColumns: [clients.organizationId, clients.id],
    }),
    foreignKey({
      name: "comments_org_company_fk",
      columns: [table.organizationId, table.companyTargetId],
      foreignColumns: [companies.organizationId, companies.id],
    }),
    foreignKey({
      name: "comments_org_deal_fk",
      columns: [table.organizationId, table.dealTargetId],
      foreignColumns: [deals.organizationId, deals.id],
    }),
    foreignKey({
      name: "comments_org_task_fk",
      columns: [table.organizationId, table.taskTargetId],
      foreignColumns: [tasks.organizationId, tasks.id],
    }),
    foreignKey({
      name: "comments_org_member_fk",
      columns: [table.organizationId, table.authorMemberId],
      foreignColumns: [
        organizationMembers.organizationId,
        organizationMembers.id,
      ],
    }),
    unique("comments_org_entity_id_unique").on(
      table.organizationId,
      table.entityType,
      table.entityId,
      table.id,
    ),
    index("comments_org_entity_created_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId,
      table.createdAt,
      table.id,
    ),

    index("comments_org_author_idx").on(
      table.organizationId,
      table.authorMemberId,
    ),
  ],
);

/*
|--------------------------------------------------------------------------
| Activity Events
|--------------------------------------------------------------------------
|
| Неподменяемая история действий CRM.
| На Stage 1 сюда пишутся события комментариев.
| На следующих этапах сюда будут добавлены изменения Client/Company/Deal/Task.
|
*/
export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    clientTargetId: uuid("client_target_id").generatedAlwaysAs(
      sql`CASE WHEN entity_type = 'client' THEN entity_id END`,
    ),
    companyTargetId: uuid("company_target_id").generatedAlwaysAs(
      sql`CASE WHEN entity_type = 'company' THEN entity_id END`,
    ),
    dealTargetId: uuid("deal_target_id").generatedAlwaysAs(
      sql`CASE WHEN entity_type = 'deal' THEN entity_id END`,
    ),
    taskTargetId: uuid("task_target_id").generatedAlwaysAs(
      sql`CASE WHEN entity_type = 'task' THEN entity_id END`,
    ),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "cascade",
      }),

    entityType: varchar("entity_type", {
      length: 32,
    }).notNull(),

    entityId: uuid("entity_id").notNull(),

    actorMemberId: uuid("actor_member_id").references(
      () => organizationMembers.id,
      {
        onDelete: "set null",
      },
    ),

    commentId: uuid("comment_id").references(() => comments.id, {
      onDelete: "set null",
    }),

    eventType: varchar("event_type", {
      length: 80,
    }).notNull(),

    summary: varchar("summary", {
      length: 240,
    }).notNull(),

    details: text("details"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "activity_events_entity_type_check",
      sql`${table.entityType} IN ('client','company','deal','task')`,
    ),
    foreignKey({
      name: "activity_events_org_client_fk",
      columns: [table.organizationId, table.clientTargetId],
      foreignColumns: [clients.organizationId, clients.id],
    }),
    foreignKey({
      name: "activity_events_org_company_fk",
      columns: [table.organizationId, table.companyTargetId],
      foreignColumns: [companies.organizationId, companies.id],
    }),
    foreignKey({
      name: "activity_events_org_deal_fk",
      columns: [table.organizationId, table.dealTargetId],
      foreignColumns: [deals.organizationId, deals.id],
    }),
    foreignKey({
      name: "activity_events_org_task_fk",
      columns: [table.organizationId, table.taskTargetId],
      foreignColumns: [tasks.organizationId, tasks.id],
    }),
    foreignKey({
      name: "activity_events_org_member_fk",
      columns: [table.organizationId, table.actorMemberId],
      foreignColumns: [
        organizationMembers.organizationId,
        organizationMembers.id,
      ],
    }),
    foreignKey({
      name: "activity_events_org_comment_target_fk",
      columns: [
        table.organizationId,
        table.entityType,
        table.entityId,
        table.commentId,
      ],
      foreignColumns: [
        comments.organizationId,
        comments.entityType,
        comments.entityId,
        comments.id,
      ],
    }),
    index("activity_events_org_entity_created_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId,
      table.createdAt,
      table.id,
    ),

    index("activity_events_org_actor_idx").on(
      table.organizationId,
      table.actorMemberId,
    ),

    index("activity_events_comment_idx").on(table.commentId),
  ],
);
