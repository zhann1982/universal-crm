import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
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
    id: uuid("id").defaultRandom().primaryKey(),

    name: varchar("name", {
      length: 160,
    }).notNull(),

    slug: varchar("slug", {
      length: 100,
    }).notNull(),

    isActive: boolean("is_active")
      .default(true)
      .notNull(),

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
    uniqueIndex("organizations_slug_unique").on(table.slug),
    index("organizations_created_at_idx").on(table.createdAt),
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

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "cascade",
      }),

    userId: varchar("user_id", {
      length: 255,
    }).notNull(),

    displayName: varchar("display_name", {
      length: 160,
    }),

    email: varchar("email", {
      length: 320,
    }),

    status: varchar("status", {
      length: 32,
    })
      .default("active")
      .notNull(),

    joinedAt: timestamp("joined_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

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
    uniqueIndex("organization_members_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),

    index("organization_members_organization_idx").on(
      table.organizationId,
    ),

    index("organization_members_email_idx").on(table.email),
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

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "cascade",
      }),

    name: varchar("name", {
      length: 80,
    }).notNull(),

    description: text("description"),

    isSystem: boolean("is_system")
      .default(false)
      .notNull(),

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
    uniqueIndex("roles_org_name_unique").on(
      table.organizationId,
      table.name,
    ),

    index("roles_organization_idx").on(table.organizationId),
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

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    key: varchar("key", {
      length: 120,
    }).notNull(),

    name: varchar("name", {
      length: 160,
    }).notNull(),

    description: text("description"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("permissions_key_unique").on(table.key),
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

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, {
        onDelete: "cascade",
      }),

    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, {
        onDelete: "cascade",
      }),
  },
  (table) => [
    primaryKey({
      columns: [
        table.roleId,
        table.permissionId,
      ],
    }),

    index("role_permissions_role_idx").on(table.roleId),

    index("role_permissions_permission_idx").on(
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

export const memberRoles = pgTable(
  "member_roles",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => organizationMembers.id, {
        onDelete: "cascade",
      }),

    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, {
        onDelete: "cascade",
      }),
  },
  (table) => [
    primaryKey({
      columns: [
        table.memberId,
        table.roleId,
      ],
    }),

    index("member_roles_member_idx").on(table.memberId),

    index("member_roles_role_idx").on(table.roleId),
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

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, {
        onDelete: "cascade",
      }),

    ownerMemberId: uuid("owner_member_id").references(
      () => organizationMembers.id,
      {
        onDelete: "set null",
      },
    ),

    firstName: varchar("first_name", {
      length: 120,
    }),

    lastName: varchar("last_name", {
      length: 120,
    }),

    middleName: varchar("middle_name", {
      length: 120,
    }),

    email: varchar("email", {
      length: 320,
    }),

    phone: varchar("phone", {
      length: 50,
    }),

    status: varchar("status", {
      length: 50,
    })
      .default("active")
      .notNull(),

    source: varchar("source", {
      length: 100,
    }),

    notes: text("notes"),

    isArchived: boolean("is_archived")
      .default(false)
      .notNull(),

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
    index("clients_organization_idx").on(
      table.organizationId,
    ),

    index("clients_owner_idx").on(
      table.ownerMemberId,
    ),

    index("clients_org_status_idx").on(
      table.organizationId,
      table.status,
    ),

    index("clients_org_created_at_idx").on(
      table.organizationId,
      table.createdAt,
    ),

    index("clients_email_idx").on(table.email),

    index("clients_phone_idx").on(table.phone),
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

export const companies = pgTable(
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
        () => organizations.id,
        {
          onDelete: "cascade",
        },
      ),

    ownerMemberId: uuid(
      "owner_member_id",
    ).references(
      () => organizationMembers.id,
      {
        onDelete: "set null",
      },
    ),

    name: varchar("name", {
      length: 200,
    }).notNull(),

    legalName: varchar(
      "legal_name",
      {
        length: 300,
      },
    ),

    taxId: varchar("tax_id", {
      length: 100,
    }),

    email: varchar("email", {
      length: 320,
    }),

    phone: varchar("phone", {
      length: 50,
    }),

    website: varchar("website", {
      length: 500,
    }),

    industry: varchar("industry", {
      length: 160,
    }),

    address: text("address"),

    status: varchar("status", {
      length: 50,
    })
      .default("active")
      .notNull(),

    notes: text("notes"),

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

export const clientCompanies = pgTable(
  "client_companies",
  {
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

    clientId: uuid(
      "client_id",
    )
      .notNull()
      .references(
        () => clients.id,
        {
          onDelete: "cascade",
        },
      ),

    companyId: uuid(
      "company_id",
    )
      .notNull()
      .references(
        () => companies.id,
        {
          onDelete: "cascade",
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