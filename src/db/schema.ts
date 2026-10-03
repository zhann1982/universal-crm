import { user } from "./auth-schema";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  foreignKey,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  unique,
  uuid,
  varchar,
  integer,
  numeric,
} from "drizzle-orm/pg-core";

/*
|--------------------------------------------------------------------------
| Organizations
|--------------------------------------------------------------------------
|
| Каждая компания, использующая CRM, является отдельной организацией.
| Все основные бизнес-данные будут связаны с organizationId.
|
*/

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    name: varchar("name", {
      length: 160,
    }).notNull(),

    slug: varchar("slug", {
      length: 100,
    }).notNull(),

    isActive: boolean(
      "is_active",
    )
      .default(true)
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
  },
  (table) => [
    uniqueIndex(
      "organizations_slug_unique",
    ).on(table.slug),

    index(
      "organizations_created_at_idx",
    ).on(table.createdAt),
  ],
);

/*
|--------------------------------------------------------------------------
| Organization Members
|--------------------------------------------------------------------------
|
| Пользователь может принадлежать одной или нескольким организациям.
|
| userId пока хранится как строка.
| Позже сюда будет записываться ID пользователя из системы авторизации.
|
*/

export const organizationMembers =
  pgTable(
    "organization_members",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      organizationId: uuid(
        "organization_id",
      )
        .notNull()
        .references(
          () =>
            organizations.id,
          {
            onDelete:
              "cascade",
          },
        ),

      userId: varchar(
        "user_id",
        {
          length: 255,
        },
      ).notNull(),

      displayName: varchar(
        "display_name",
        {
          length: 160,
        },
      ),

      email: varchar(
        "email",
        {
          length: 320,
        },
      ),

      status: varchar(
        "status",
        {
          length: 32,
        },
      )
        .default("active")
        .notNull(),

      joinedAt: timestamp(
        "joined_at",
        {
          withTimezone: true,
        },
      )
        .defaultNow()
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
    },
    (table) => [
      unique("organization_members_org_id_unique").on(table.organizationId, table.id),
      uniqueIndex(
        "organization_members_org_user_unique",
      ).on(
        table.organizationId,
        table.userId,
      ),

      index(
        "organization_members_organization_idx",
      ).on(
        table.organizationId,
      ),

      index(
        "organization_members_email_idx",
      ).on(table.email),
    ],
  );

/*
|--------------------------------------------------------------------------
| Roles
|--------------------------------------------------------------------------
|
| Роли создаются внутри конкретной организации.
|
| Например:
|
| Owner
| Admin
| Supervisor
| Manager
| Operator
| Viewer
|
*/

export const roles =
  pgTable(
    "roles",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      organizationId: uuid(
        "organization_id",
      )
        .notNull()
        .references(
          () =>
            organizations.id,
          {
            onDelete:
              "cascade",
          },
        ),

      name: varchar(
        "name",
        {
          length: 80,
        },
      ).notNull(),

      systemKey: varchar(
        "system_key",
        {
          length: 80,
        },
      ),

      description:
        text("description"),

      isSystem: boolean(
        "is_system",
      )
        .default(false)
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
    },
    (table) => [
      unique("roles_org_id_unique").on(table.organizationId, table.id),
      uniqueIndex(
        "roles_org_name_unique",
      ).on(
        table.organizationId,
        table.name,
      ),

      uniqueIndex(
        "roles_org_system_key_unique",
      ).on(
        table.organizationId,
        table.systemKey,
      ),

      index(
        "roles_organization_idx",
      ).on(
        table.organizationId,
      ),
    ],
  );

/*
|--------------------------------------------------------------------------
| Permissions
|--------------------------------------------------------------------------
|
| Общий каталог разрешений.
|
| Например:
|
| clients.read
| clients.create
| clients.update
| clients.delete
| deals.read
| deals.update
| users.manage
|
*/

export const permissions =
  pgTable(
    "permissions",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      key: varchar(
        "key",
        {
          length: 120,
        },
      ).notNull(),

      name: varchar(
        "name",
        {
          length: 160,
        },
      ).notNull(),

      description:
        text("description"),

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
      uniqueIndex(
        "permissions_key_unique",
      ).on(table.key),
    ],
  );

/*
|--------------------------------------------------------------------------
| Role Permissions
|--------------------------------------------------------------------------
|
| Связь многие-ко-многим:
|
| Role <-> Permission
|
*/

export const rolePermissions =
  pgTable(
    "role_permissions",
    {
      roleId: uuid(
        "role_id",
      )
        .notNull()
        .references(
          () => roles.id,
          {
            onDelete:
              "cascade",
          },
        ),

      permissionId: uuid(
        "permission_id",
      )
        .notNull()
        .references(
          () =>
            permissions.id,
          {
            onDelete:
              "cascade",
          },
        ),
    },
    (table) => [
      primaryKey({
        columns: [
          table.roleId,
          table.permissionId,
        ],
      }),

      index(
        "role_permissions_role_idx",
      ).on(
        table.roleId,
      ),

      index(
        "role_permissions_permission_idx",
      ).on(
        table.permissionId,
      ),
    ],
  );

/*
|--------------------------------------------------------------------------
| Member Roles
|--------------------------------------------------------------------------
|
| Один сотрудник может иметь несколько ролей.
|
*/

export const memberRoles =
  pgTable(
    "member_roles",
    {
      organizationId: uuid("organization_id").notNull(),
      memberId: uuid(
        "member_id",
      )
        .notNull()
        .references(
          () =>
            organizationMembers.id,
          {
            onDelete:
              "cascade",
          },
        ),

      roleId: uuid(
        "role_id",
      )
        .notNull()
        .references(
          () => roles.id,
          {
            onDelete:
              "cascade",
          },
        ),
    },
    (table) => [
      foreignKey({
        name: "member_roles_org_member_fk",
        columns: [table.organizationId, table.memberId],
        foreignColumns: [organizationMembers.organizationId, organizationMembers.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "member_roles_org_role_fk",
        columns: [table.organizationId, table.roleId],
        foreignColumns: [roles.organizationId, roles.id],
      }).onDelete("cascade"),
      primaryKey({
        columns: [
          table.memberId,
          table.roleId,
        ],
      }),

      index(
        "member_roles_member_idx",
      ).on(
        table.memberId,
      ),

      index(
        "member_roles_role_idx",
      ).on(
        table.roleId,
      ),
    ],
  );


/*
|--------------------------------------------------------------------------
| Organization Invitations
|--------------------------------------------------------------------------
|
| Приглашение пользователя в Organization.
|
| В базе хранится только hash токена.
| Сам raw token существует только в ссылке приглашения.
|
*/

export const organizationInvitations =
  pgTable(
    "organization_invitations",
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

      emailNormalized: varchar(
        "email_normalized",
        {
          length: 320,
        },
      ).notNull(),

      roleId: uuid(
        "role_id",
      )
        .notNull()
        .references(
          () => roles.id,
          {
            onDelete: "restrict",
          },
        ),

      tokenHash: varchar(
        "token_hash",
        {
          length: 64,
        },
      ).notNull(),

      invitedByMemberId: uuid(
        "invited_by_member_id",
      ).references(
        () => organizationMembers.id,
        {
          onDelete: "set null",
        },
      ),

      acceptedByUserId: varchar(
        "accepted_by_user_id",
        {
          length: 255,
        },
      ),

      expiresAt: timestamp(
        "expires_at",
        {
          withTimezone: true,
        },
      ).notNull(),

      acceptedAt: timestamp(
        "accepted_at",
        {
          withTimezone: true,
        },
      ),

      revokedAt: timestamp(
        "revoked_at",
        {
          withTimezone: true,
        },
      ),

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
    },
    (table) => [
      uniqueIndex(
        "organization_invitations_token_hash_unique",
      ).on(
        table.tokenHash,
      ),

      index(
        "organization_invitations_org_email_idx",
      ).on(
        table.organizationId,
        table.emailNormalized,
      ),

      index(
        "organization_invitations_org_created_at_idx",
      ).on(
        table.organizationId,
        table.createdAt,
      ),

      index(
        "organization_invitations_expires_at_idx",
      ).on(
        table.expiresAt,
      ),
    ],
  );


/*
|--------------------------------------------------------------------------
| Clients
|--------------------------------------------------------------------------
|
| Первая основная бизнес-сущность CRM.
|
*/

export const clients =
  pgTable(
    "clients",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      organizationId: uuid(
        "organization_id",
      )
        .notNull()
        .references(
          () =>
            organizations.id,
          {
            onDelete:
              "cascade",
          },
        ),

      ownerMemberId: uuid(
        "owner_member_id",
      ).references(
        () =>
          organizationMembers.id,
        {
          onDelete:
            "set null",
        },
      ),

      firstName: varchar(
        "first_name",
        {
          length: 120,
        },
      ),

      lastName: varchar(
        "last_name",
        {
          length: 120,
        },
      ),

      middleName: varchar(
        "middle_name",
        {
          length: 120,
        },
      ),

      email: varchar(
        "email",
        {
          length: 320,
        },
      ),

      phone: varchar(
        "phone",
        {
          length: 50,
        },
      ),

      status: varchar(
        "status",
        {
          length: 50,
        },
      )
        .default("active")
        .notNull(),

      source: varchar(
        "source",
        {
          length: 100,
        },
      ),

      notes:
        text("notes"),

      isArchived: boolean(
        "is_archived",
      )
        .default(false)
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
      unique("clients_org_id_unique").on(table.organizationId, table.id),
      // Keep the single-column SET NULL FK for owner deletion. This FK checks tenant identity.
      foreignKey({
        name: "clients_org_owner_fk",
        columns: [table.organizationId, table.ownerMemberId],
        foreignColumns: [organizationMembers.organizationId, organizationMembers.id],
      }),
      index(
        "clients_organization_idx",
      ).on(
        table.organizationId,
      ),

      index(
        "clients_owner_idx",
      ).on(
        table.ownerMemberId,
      ),

      index(
        "clients_org_status_idx",
      ).on(
        table.organizationId,
        table.status,
      ),

      index(
        "clients_org_created_at_idx",
      ).on(
        table.organizationId,
        table.createdAt,
      ),

      index(
        "clients_email_idx",
      ).on(
        table.email,
      ),

      index(
        "clients_phone_idx",
      ).on(
        table.phone,
      ),
    ],
  );

/* 
|--------------------------------------------------------------------------
| Companies
|--------------------------------------------------------------------------
|
| Организации и юридические лица, с которыми работает CRM.
|
| Company является отдельной бизнес-сущностью и не должна
| моделироваться как Client.
|
*/

export const companies =
  pgTable(
    "companies",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      organizationId: uuid(
        "organization_id",
      )
        .notNull()
        .references(
          () =>
            organizations.id,
          {
            onDelete:
              "cascade",
          },
        ),

      ownerMemberId: uuid(
        "owner_member_id",
      ).references(
        () =>
          organizationMembers.id,
        {
          onDelete:
            "set null",
        },
      ),

      name: varchar(
        "name",
        {
          length: 200,
        },
      ).notNull(),

      legalName: varchar(
        "legal_name",
        {
          length: 300,
        },
      ),

      taxId: varchar(
        "tax_id",
        {
          length: 100,
        },
      ),

      email: varchar(
        "email",
        {
          length: 320,
        },
      ),

      phone: varchar(
        "phone",
        {
          length: 50,
        },
      ),

      website: varchar(
        "website",
        {
          length: 500,
        },
      ),

      industry: varchar(
        "industry",
        {
          length: 160,
        },
      ),

      address:
        text("address"),

      status: varchar(
        "status",
        {
          length: 50,
        },
      )
        .default("active")
        .notNull(),

      notes:
        text("notes"),

      isArchived: boolean(
        "is_archived",
      )
        .default(false)
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
      unique("companies_org_id_unique").on(table.organizationId, table.id),
      foreignKey({
        name: "companies_org_owner_fk",
        columns: [table.organizationId, table.ownerMemberId],
        foreignColumns: [organizationMembers.organizationId, organizationMembers.id],
      }),
      index(
        "companies_organization_idx",
      ).on(
        table.organizationId,
      ),

      index(
        "companies_owner_idx",
      ).on(
        table.ownerMemberId,
      ),

      index(
        "companies_org_status_idx",
      ).on(
        table.organizationId,
        table.status,
      ),

      index(
        "companies_org_created_at_idx",
      ).on(
        table.organizationId,
        table.createdAt,
      ),

      index(
        "companies_name_idx",
      ).on(
        table.name,
      ),

      index(
        "companies_tax_id_idx",
      ).on(
        table.taxId,
      ),

      uniqueIndex(
        "companies_org_tax_id_unique",
      ).on(
        table.organizationId,
        table.taxId,
      ),
    ],
  );

/*
|--------------------------------------------------------------------------
| Client Companies
|--------------------------------------------------------------------------
|
| Связь многие-ко-многим:
|
| Client <-> Company
|
| Один клиент может быть связан с несколькими компаниями.
| Одна компания может иметь несколько клиентов/контактов.
|
*/

export const clientCompanies =
  pgTable(
    "client_companies",
    {
      organizationId: uuid(
        "organization_id",
      )
        .notNull()
        .references(
          () =>
            organizations.id,
          {
            onDelete:
              "cascade",
          },
        ),

      clientId: uuid(
        "client_id",
      )
        .notNull()
        .references(
          () => clients.id,
          {
            onDelete:
              "cascade",
          },
        ),

      companyId: uuid(
        "company_id",
      )
        .notNull()
        .references(
          () =>
            companies.id,
          {
            onDelete:
              "cascade",
          },
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
      foreignKey({
        name: "client_companies_org_client_fk",
        columns: [table.organizationId, table.clientId],
        foreignColumns: [clients.organizationId, clients.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "client_companies_org_company_fk",
        columns: [table.organizationId, table.companyId],
        foreignColumns: [companies.organizationId, companies.id],
      }).onDelete("cascade"),
      primaryKey({
        columns: [
          table.clientId,
          table.companyId,
        ],
      }),

      index(
        "client_companies_org_client_idx",
      ).on(
        table.organizationId,
        table.clientId,
      ),

      index(
        "client_companies_org_company_idx",
      ).on(
        table.organizationId,
        table.companyId,
      ),
    ],
  );

/*
|--------------------------------------------------------------------------
| Pipelines
|--------------------------------------------------------------------------
|
| Воронки продаж.
|
| Одна организация может иметь несколько независимых воронок.
|
*/

export const pipelines =
  pgTable(
    "pipelines",
    {
      version: integer("version").notNull().default(1),
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      organizationId: uuid(
        "organization_id",
      )
        .notNull()
        .references(
          () =>
            organizations.id,
          {
            onDelete:
              "cascade",
          },
        ),

      name: varchar(
        "name",
        {
          length: 160,
        },
      ).notNull(),

      description:
        text(
          "description",
        ),

      isDefault: boolean(
        "is_default",
      )
        .default(false)
        .notNull(),

      isArchived: boolean(
        "is_archived",
      )
        .default(false)
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
    },
    (table) => [
      unique("pipelines_org_id_unique").on(table.organizationId, table.id),
      uniqueIndex(
        "pipelines_org_name_unique",
      ).on(
        table.organizationId,
        table.name,
      ),

      index(
        "pipelines_organization_idx",
      ).on(
        table.organizationId,
      ),
    ],
  );

/*
|--------------------------------------------------------------------------
| Pipeline Stages
|--------------------------------------------------------------------------
|
| Этапы конкретной воронки.
|
| type:
| open
| won
| lost
|
*/

export const pipelineStages =
  pgTable(
    "pipeline_stages",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      organizationId: uuid(
        "organization_id",
      )
        .notNull()
        .references(
          () =>
            organizations.id,
          {
            onDelete:
              "cascade",
          },
        ),

      pipelineId: uuid(
        "pipeline_id",
      )
        .notNull()
        .references(
          () =>
            pipelines.id,
          {
            onDelete:
              "cascade",
          },
        ),

      name: varchar(
        "name",
        {
          length: 160,
        },
      ).notNull(),

      type: varchar(
        "type",
        {
          length: 20,
        },
      )
        .default("open")
        .notNull(),

      position: integer(
        "position",
      ).notNull(),

      probability: integer(
        "probability",
      )
        .default(0)
        .notNull(),

      color: varchar(
        "color",
        {
          length: 32,
        },
      ),

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
    },
    (table) => [
      unique("pipeline_stages_org_pipeline_id_unique").on(table.organizationId, table.pipelineId, table.id),
      foreignKey({
        name: "pipeline_stages_org_pipeline_fk",
        columns: [table.organizationId, table.pipelineId],
        foreignColumns: [pipelines.organizationId, pipelines.id],
      }).onDelete("cascade"),
      check("pipeline_stages_type_check", sql`${table.type} IN ('open', 'won', 'lost')`),
      check("pipeline_stages_probability_check", sql`${table.probability} BETWEEN 0 AND 100`),
      uniqueIndex(
        "pipeline_stages_pipeline_position_unique",
      ).on(
        table.pipelineId,
        table.position,
      ),

      uniqueIndex(
        "pipeline_stages_pipeline_name_unique",
      ).on(
        table.pipelineId,
        table.name,
      ),

      index(
        "pipeline_stages_org_pipeline_idx",
      ).on(
        table.organizationId,
        table.pipelineId,
      ),
    ],
  );

/*
|--------------------------------------------------------------------------
| Deals
|--------------------------------------------------------------------------
|
| Сделки CRM.
|
*/

export const deals =
  pgTable(
    "deals",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      organizationId: uuid(
        "organization_id",
      )
        .notNull()
        .references(
          () =>
            organizations.id,
          {
            onDelete:
              "cascade",
          },
        ),

      pipelineId: uuid(
        "pipeline_id",
      )
        .notNull()
        .references(
          () =>
            pipelines.id,
          {
            onDelete:
              "restrict",
          },
        ),

      stageId: uuid(
        "stage_id",
      )
        .notNull()
        .references(
          () =>
            pipelineStages.id,
          {
            onDelete:
              "restrict",
          },
        ),

      ownerMemberId: uuid(
        "owner_member_id",
      ).references(
        () =>
          organizationMembers.id,
        {
          onDelete:
            "set null",
        },
      ),

      companyId: uuid(
        "company_id",
      ).references(
        () =>
          companies.id,
        {
          onDelete:
            "set null",
        },
      ),

      title: varchar(
        "title",
        {
          length: 240,
        },
      ).notNull(),

      amount: numeric(
        "amount",
        {
          precision: 14,
          scale: 2,
        },
      ),

      currency: varchar(
        "currency",
        {
          length: 3,
        },
      ),

      /*
      * Это именно календарная дата,
      * а не момент времени.
      *
      * Например:
      * 2026-10-15
      *
      * Часовой пояс здесь не нужен.
      */
      expectedCloseAt:
        date(
          "expected_close_at",
        ),

      closedAt: timestamp(
        "closed_at",
        {
          withTimezone: true,
        },
      ),

      notes:
        text("notes"),

      isArchived: boolean(
        "is_archived",
      )
        .default(false)
        .notNull(),

      /*
       * Optimistic locking.
       *
       * Каждая успешная мутация
       * Deal должна увеличивать
       * version.
       *
       * Клиент передаёт версию,
       * которую он редактировал,
       * а UPDATE проверяет её.
       */
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
      foreignKey({
        name: "deals_org_pipeline_fk",
        columns: [table.organizationId, table.pipelineId],
        foreignColumns: [pipelines.organizationId, pipelines.id],
      }).onDelete("restrict"),
      foreignKey({
        name: "deals_org_pipeline_stage_fk",
        columns: [table.organizationId, table.pipelineId, table.stageId],
        foreignColumns: [pipelineStages.organizationId, pipelineStages.pipelineId, pipelineStages.id],
      }).onDelete("restrict"),
      foreignKey({
        name: "deals_org_company_fk",
        columns: [table.organizationId, table.companyId],
        foreignColumns: [companies.organizationId, companies.id],
      }),
      foreignKey({
        name: "deals_org_owner_fk",
        columns: [table.organizationId, table.ownerMemberId],
        foreignColumns: [organizationMembers.organizationId, organizationMembers.id],
      }),
      check("deals_amount_currency_check", sql`(${table.amount} IS NULL OR (${table.amount} >= 0 AND ${table.amount} <> 'NaN'::numeric AND ${table.currency} IS NOT NULL)) AND (${table.currency} IS NULL OR ${table.currency} ~ '^[A-Z]{3}$')`),
      index(
        "deals_organization_idx",
      ).on(
        table.organizationId,
      ),

      index(
        "deals_org_pipeline_idx",
      ).on(
        table.organizationId,
        table.pipelineId,
      ),

      index(
        "deals_org_stage_idx",
      ).on(
        table.organizationId,
        table.stageId,
      ),

      index(
        "deals_owner_idx",
      ).on(
        table.ownerMemberId,
      ),

      index(
        "deals_company_idx",
      ).on(
        table.companyId,
      ),

      index(
        "deals_org_created_at_idx",
      ).on(
        table.organizationId,
        table.createdAt,
      ),
    ],
  );

  /*
|--------------------------------------------------------------------------
| Tasks
|--------------------------------------------------------------------------
|
| Рабочие задачи CRM.
|
| Задача может быть связана с Client, Company и Deal.
| Все связи являются необязательными.
|
*/

export const tasks =
  pgTable(
    "tasks",
    {
      id: uuid("id")
        .defaultRandom()
        .primaryKey(),

      organizationId: uuid(
        "organization_id",
      )
        .notNull()
        .references(
          () =>
            organizations.id,
          {
            onDelete:
              "cascade",
          },
        ),

      /*
       * Ответственный за задачу.
       */
      ownerMemberId: uuid(
        "owner_member_id",
      ).references(
        () =>
          organizationMembers.id,
        {
          onDelete:
            "set null",
        },
      ),

      /*
       * Кто создал задачу.
       *
       * Если Membership когда-нибудь
       * будет удалена, сама Task
       * должна сохраниться.
       */
      createdByMemberId: uuid(
        "created_by_member_id",
      ).references(
        () =>
          organizationMembers.id,
        {
          onDelete:
            "set null",
        },
      ),

      clientId: uuid(
        "client_id",
      ).references(
        () => clients.id,
        {
          onDelete:
            "set null",
        },
      ),

      companyId: uuid(
        "company_id",
      ).references(
        () =>
          companies.id,
        {
          onDelete:
            "set null",
        },
      ),

      dealId: uuid(
        "deal_id",
      ).references(
        () => deals.id,
        {
          onDelete:
            "set null",
        },
      ),

      title: varchar(
        "title",
        {
          length: 240,
        },
      ).notNull(),

      description:
        text("description"),

      /*
       * Initial statuses:
       *
       * todo
       * in_progress
       * completed
       * cancelled
       */
      status: varchar(
        "status",
        {
          length: 32,
        },
      )
        .default("todo")
        .notNull(),

      /*
       * Initial priorities:
       *
       * low
       * normal
       * high
       * urgent
       */
      priority: varchar(
        "priority",
        {
          length: 32,
        },
      )
        .default("normal")
        .notNull(),

      /*
       * Task deadline is an exact
       * point in time, unlike the
       * Deal expectedCloseAt date.
       */
      dueAt: timestamp(
        "due_at",
        {
          withTimezone: true,
        },
      ),

      completedAt: timestamp(
        "completed_at",
        {
          withTimezone: true,
        },
      ),

      isArchived: boolean(
        "is_archived",
      )
        .default(false)
        .notNull(),

      /*
       * Optimistic locking.
       */
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
        "tasks_organization_idx",
      ).on(
        table.organizationId,
      ),

      index(
        "tasks_org_status_due_at_idx",
      ).on(
        table.organizationId,
        table.status,
        table.dueAt,
      ),

      index(
        "tasks_org_owner_status_idx",
      ).on(
        table.organizationId,
        table.ownerMemberId,
        table.status,
      ),

      index(
        "tasks_client_idx",
      ).on(
        table.clientId,
      ),

      index(
        "tasks_company_idx",
      ).on(
        table.companyId,
      ),

      index(
        "tasks_deal_idx",
      ).on(
        table.dealId,
      ),

      index(
        "tasks_org_created_at_idx",
      ).on(
        table.organizationId,
        table.createdAt,
      ),
    ],
  );
// Durable idempotency for organization onboarding; keys are scoped to the creator.
export const organizationCreations = pgTable("organization_creations", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  requestId: uuid("request_id").notNull(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.requestId] }),
  uniqueIndex("organization_creations_organization_unique").on(table.organizationId),
]);
