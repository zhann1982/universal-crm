import { and, eq } from "drizzle-orm";

import { db } from "./index";
import {
  memberRoles,
  organizationMembers,
  organizations,
  permissions,
  rolePermissions,
  roles,
} from "./schema";

const PERMISSIONS = [
  {
    key: "clients.read",
    name: "Просмотр клиентов",
  },
  {
    key: "clients.create",
    name: "Создание клиентов",
  },
  {
    key: "clients.update",
    name: "Изменение клиентов",
  },
  {
    key: "clients.archive",
    name: "Архивация клиентов",
  },
  {
    key: "clients.delete",
    name: "Удаление клиентов",
  },
  {
    key: "members.read",
    name: "Просмотр сотрудников",
  },
  {
    key: "members.manage",
    name: "Управление сотрудниками",
  },
  {
    key: "roles.read",
    name: "Просмотр ролей",
  },
  {
    key: "roles.manage",
    name: "Управление ролями",
  },
  {
    key: "settings.manage",
    name: "Управление настройками",
  },
] as const;

async function main() {
  console.log("Starting seed...");

  // --------------------------------------------------
  // Organization
  // --------------------------------------------------

  let [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "development"))
    .limit(1);

  if (!organization) {
    [organization] = await db
      .insert(organizations)
      .values({
        name: "Development CRM",
        slug: "development",
      })
      .returning();

    console.log("Created organization:", organization.name);
  } else {
    console.log("Organization already exists:", organization.name);
  }

  // --------------------------------------------------
  // Permissions
  // --------------------------------------------------

  const permissionMap = new Map<string, string>();

  for (const permission of PERMISSIONS) {
    let [record] = await db
      .select()
      .from(permissions)
      .where(eq(permissions.key, permission.key))
      .limit(1);

    if (!record) {
      [record] = await db
        .insert(permissions)
        .values(permission)
        .returning();

      console.log("Created permission:", record.key);
    }

    permissionMap.set(record.key, record.id);
  }

  // --------------------------------------------------
  // Roles
  // --------------------------------------------------

  const roleDefinitions = [
    {
      name: "Owner",
      description: "Полный доступ к организации",
      permissions: PERMISSIONS.map((item) => item.key),
    },
    {
      name: "Admin",
      description: "Администрирование CRM",
      permissions: PERMISSIONS.map((item) => item.key),
    },
    {
      name: "Manager",
      description: "Работа с клиентами",
      permissions: [
        "clients.read",
        "clients.create",
        "clients.update",
        "clients.archive",
      ],
    },
    {
      name: "Viewer",
      description: "Только просмотр",
      permissions: ["clients.read"],
    },
  ] as const;

  const roleMap = new Map<string, string>();

  for (const roleDefinition of roleDefinitions) {
    let [role] = await db
      .select()
      .from(roles)
      .where(
        and(
          eq(roles.organizationId, organization.id),
          eq(roles.name, roleDefinition.name),
        ),
      )
      .limit(1);

    if (!role) {
      [role] = await db
        .insert(roles)
        .values({
          organizationId: organization.id,
          name: roleDefinition.name,
          description: roleDefinition.description,
          isSystem: true,
        })
        .returning();

      console.log("Created role:", role.name);
    }

    roleMap.set(role.name, role.id);

    for (const permissionKey of roleDefinition.permissions) {
      const permissionId = permissionMap.get(permissionKey);

      if (!permissionId) {
        throw new Error(`Permission not found: ${permissionKey}`);
      }

      await db
        .insert(rolePermissions)
        .values({
          roleId: role.id,
          permissionId,
        })
        .onConflictDoNothing();
    }
  }

  // --------------------------------------------------
  // Development owner
  // --------------------------------------------------
  //
  // Это временный пользователь до подключения настоящей
  // системы авторизации.
  //

  let [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organization.id),
        eq(organizationMembers.userId, "local-dev-owner"),
      ),
    )
    .limit(1);

  if (!member) {
    [member] = await db
      .insert(organizationMembers)
      .values({
        organizationId: organization.id,
        userId: "local-dev-owner",
        displayName: "Development Owner",
        email: "owner@local.dev",
      })
      .returning();

    console.log("Created development owner.");
  }

  const ownerRoleId = roleMap.get("Owner");

  if (!ownerRoleId) {
    throw new Error("Owner role not found");
  }

  await db
    .insert(memberRoles)
    .values({
      memberId: member.id,
      roleId: ownerRoleId,
    })
    .onConflictDoNothing();

  console.log("");
  console.log("Seed completed successfully.");
  console.log("Organization:", organization.name);
  console.log("Organization ID:", organization.id);
}

main()
  .catch((error) => {
    console.error("Seed failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });