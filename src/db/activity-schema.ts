import {
  boolean,
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
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    organizationId: uuid(
      "organization_id",
    )
      .notNull()
      .references(
        () => organizations.id,
        {
          onDelete: "cascade",
        },
      ),

    entityType: varchar(
      "entity_type",
      {
        length: 32,
      },
    ).notNull(),

    entityId: uuid(
      "entity_id",
    ).notNull(),

    authorMemberId: uuid(
      "author_member_id",
    ).references(
      () => organizationMembers.id,
      {
        onDelete: "set null",
      },
    ),

    body: text("body")
      .notNull(),

    isArchived: boolean(
      "is_archived",
    )
      .default(false)
      .notNull(),

    version: integer(
      "version",
    )
      .default(1)
      .notNull(),

    createdAt: timestamp(
      "created_at",
      {
        withTimezone: true,
      },
    )
      .defaultNow()
      .notNull(),

    updatedAt: timestamp(
      "updated_at",
      {
        withTimezone: true,
      },
    )
      .defaultNow()
      .notNull(),

    deletedAt: timestamp(
      "deleted_at",
      {
        withTimezone: true,
      },
    ),
  },
  (table) => [
    index(
      "comments_org_entity_created_idx",
    ).on(
      table.organizationId,
      table.entityType,
      table.entityId,
      table.createdAt,
    ),

    index(
      "comments_org_author_idx",
    ).on(
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
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    organizationId: uuid(
      "organization_id",
    )
      .notNull()
      .references(
        () => organizations.id,
        {
          onDelete: "cascade",
        },
      ),

    entityType: varchar(
      "entity_type",
      {
        length: 32,
      },
    ).notNull(),

    entityId: uuid(
      "entity_id",
    ).notNull(),

    actorMemberId: uuid(
      "actor_member_id",
    ).references(
      () => organizationMembers.id,
      {
        onDelete: "set null",
      },
    ),

    commentId: uuid(
      "comment_id",
    ).references(
      () => comments.id,
      {
        onDelete: "set null",
      },
    ),

    eventType: varchar(
      "event_type",
      {
        length: 80,
      },
    ).notNull(),

    summary: varchar(
      "summary",
      {
        length: 240,
      },
    ).notNull(),

    details: text(
      "details",
    ),

    createdAt: timestamp(
      "created_at",
      {
        withTimezone: true,
      },
    )
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index(
      "activity_events_org_entity_created_idx",
    ).on(
      table.organizationId,
      table.entityType,
      table.entityId,
      table.createdAt,
    ),

    index(
      "activity_events_org_actor_idx",
    ).on(
      table.organizationId,
      table.actorMemberId,
    ),

    index(
      "activity_events_comment_idx",
    ).on(
      table.commentId,
    ),
  ],
);
