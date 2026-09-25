import { and, eq } from "drizzle-orm";

import { db } from "./index";
import {
  memberRoles,
  organizationMembers,
  organizations,
  permissions,
  pipelineStages,
  pipelines,
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
    key: "companies.read",
    name: "Просмотр компаний",
  },
  {
    key: "companies.create",
    name: "Создание компаний",
  },
  {
    key: "companies.update",
    name: "Изменение компаний",
  },
  {
    key: "companies.archive",
    name: "Архивация компаний",
  },
  {
    key: "companies.delete",
    name: "Удаление компаний",
  },
  {
    key: "deals.read",
    name: "Просмотр сделок",
  },
  {
    key: "deals.create",
    name: "Создание сделок",
  },
  {
    key: "deals.update",
    name: "Изменение сделок",
  },
  {
    key: "deals.archive",
    name: "Архивация сделок",
  },
  {
    key: "deals.delete",
    name: "Удаление сделок",
  },
  {
    key: "pipelines.read",
    name: "Просмотр воронок",
  },
  {
    key: "pipelines.manage",
    name: "Управление воронками",
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
    .where(
      eq(
        organizations.slug,
        "development",
      ),
    )
    .limit(1);

  if (!organization) {
    [organization] = await db
      .insert(organizations)
      .values({
        name: "Development CRM",
        slug: "development",
      })
      .returning();

    console.log(
      "Created organization:",
      organization.name,
    );
  } else {
    console.log(
      "Organization already exists:",
      organization.name,
    );
  }

  // --------------------------------------------------
  // Permissions
  // --------------------------------------------------

  const permissionMap =
    new Map<string, string>();

  for (const permission of PERMISSIONS) {
    let [record] = await db
      .select()
      .from(permissions)
      .where(
        eq(
          permissions.key,
          permission.key,
        ),
      )
      .limit(1);

    if (!record) {
      [record] = await db
        .insert(permissions)
        .values(permission)
        .returning();

      console.log(
        "Created permission:",
        record.key,
      );
    }

    permissionMap.set(
      record.key,
      record.id,
    );
  }

  // --------------------------------------------------
  // Roles
  // --------------------------------------------------

  const roleDefinitions = [
    {
      name: "Owner",
      description:
        "Полный доступ к организации",

      permissions:
        PERMISSIONS.map(
          (item) => item.key,
        ),
    },

    {
      name: "Admin",
      description:
        "Администрирование CRM",

      permissions:
        PERMISSIONS.map(
          (item) => item.key,
        ),
    },

    {
      name: "Manager",
      description:
        "Работа с клиентами",

      permissions: [
        "clients.read",
        "clients.create",
        "clients.update",
        "clients.archive",

        "companies.read",
        "companies.create",
        "companies.update",
        "companies.archive",

        "deals.read",
        "deals.create",
        "deals.update",
        "deals.archive",

        "pipelines.read",
      ],
    },

    {
      name: "Viewer",
      description:
        "Только просмотр",

      permissions: [
        "clients.read",
        "companies.read",
        "deals.read",
        "pipelines.read",
      ],
    },
  ] as const;

  const roleMap =
    new Map<string, string>();

  for (
    const roleDefinition of
    roleDefinitions
  ) {
    let [role] = await db
      .select()
      .from(roles)
      .where(
        and(
          eq(
            roles.organizationId,
            organization.id,
          ),

          eq(
            roles.name,
            roleDefinition.name,
          ),
        ),
      )
      .limit(1);

    if (!role) {
      [role] = await db
        .insert(roles)
        .values({
          organizationId:
            organization.id,

          name:
            roleDefinition.name,

          description:
            roleDefinition.description,

          isSystem: true,
        })
        .returning();

      console.log(
        "Created role:",
        role.name,
      );
    }

    roleMap.set(
      role.name,
      role.id,
    );

    for (
      const permissionKey of
      roleDefinition.permissions
    ) {
      const permissionId =
        permissionMap.get(
          permissionKey,
        );

      if (!permissionId) {
        throw new Error(
          `Permission not found: ${permissionKey}`,
        );
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
  // Default pipeline
  // --------------------------------------------------

  let [defaultPipeline] =
    await db
      .select()
      .from(pipelines)
      .where(
        and(
          eq(
            pipelines.organizationId,
            organization.id,
          ),

          eq(
            pipelines.name,
            "Основная воронка",
          ),
        ),
      )
      .limit(1);

  if (!defaultPipeline) {
    [defaultPipeline] =
      await db
        .insert(pipelines)
        .values({
          organizationId:
            organization.id,

          name:
            "Основная воронка",

          description:
            "Стандартная воронка продаж",

          isDefault: true,
        })
        .returning();

    console.log(
      "Created default pipeline:",
      defaultPipeline.name,
    );
  }

  const defaultStages = [
    {
      name: "Новая",
      type: "open",
      position: 10,
      probability: 10,
    },
    {
      name: "Квалификация",
      type: "open",
      position: 20,
      probability: 25,
    },
    {
      name: "Предложение",
      type: "open",
      position: 30,
      probability: 50,
    },
    {
      name: "Переговоры",
      type: "open",
      position: 40,
      probability: 75,
    },
    {
      name: "Выиграна",
      type: "won",
      position: 50,
      probability: 100,
    },
    {
      name: "Проиграна",
      type: "lost",
      position: 60,
      probability: 0,
    },
  ] as const;

  for (
    const stage of
    defaultStages
  ) {
    const [existingStage] =
      await db
        .select({
          id:
            pipelineStages.id,
        })
        .from(
          pipelineStages,
        )
        .where(
          and(
            eq(
              pipelineStages.pipelineId,
              defaultPipeline.id,
            ),

            eq(
              pipelineStages.name,
              stage.name,
            ),
          ),
        )
        .limit(1);

    if (!existingStage) {
      await db
        .insert(
          pipelineStages,
        )
        .values({
          organizationId:
            organization.id,

          pipelineId:
            defaultPipeline.id,

          name:
            stage.name,

          type:
            stage.type,

          position:
            stage.position,

          probability:
            stage.probability,
        });

      console.log(
        "Created pipeline stage:",
        stage.name,
      );
    }
  }

  // --------------------------------------------------
  // Development owner
  // --------------------------------------------------
  //
  // Это временный пользователь до подключения
  // настоящей системы авторизации.
  //

  let [member] = await db
    .select()
    .from(
      organizationMembers,
    )
    .where(
      and(
        eq(
          organizationMembers.organizationId,
          organization.id,
        ),

        eq(
          organizationMembers.userId,
          "local-dev-owner",
        ),
      ),
    )
    .limit(1);

  if (!member) {
    [member] = await db
      .insert(
        organizationMembers,
      )
      .values({
        organizationId:
          organization.id,

        userId:
          "local-dev-owner",

        displayName:
          "Development Owner",

        email:
          "owner@local.dev",
      })
      .returning();

    console.log(
      "Created development owner.",
    );
  } else {
    console.log(
      "Development owner already exists.",
    );
  }

  const ownerRoleId =
    roleMap.get("Owner");

  if (!ownerRoleId) {
    throw new Error(
      "Owner role not found",
    );
  }

  await db
    .insert(memberRoles)
    .values({
      memberId:
        member.id,

      roleId:
        ownerRoleId,
    })
    .onConflictDoNothing();

  // --------------------------------------------------
  // Development test members
  // --------------------------------------------------

  const developmentMembers = [
    {
      userId:
        "local-dev-manager",

      displayName:
        "Development Manager",

      email:
        "manager@local.dev",

      roleName:
        "Manager",
    },

    {
      userId:
        "local-dev-viewer",

      displayName:
        "Development Viewer",

      email:
        "viewer@local.dev",

      roleName:
        "Viewer",
    },
  ] as const;

  for (
    const definition of
    developmentMembers
  ) {
    let [developmentMember] =
      await db
        .select()
        .from(
          organizationMembers,
        )
        .where(
          and(
            eq(
              organizationMembers.organizationId,
              organization.id,
            ),

            eq(
              organizationMembers.userId,
              definition.userId,
            ),
          ),
        )
        .limit(1);

    if (!developmentMember) {
      [developmentMember] =
        await db
          .insert(
            organizationMembers,
          )
          .values({
            organizationId:
              organization.id,

            userId:
              definition.userId,

            displayName:
              definition.displayName,

            email:
              definition.email,
          })
          .returning();

      console.log(
        "Created development member:",
        definition.displayName,
      );
    } else {
      console.log(
        "Development member already exists:",
        definition.displayName,
      );
    }

    const roleId =
      roleMap.get(
        definition.roleName,
      );

    if (!roleId) {
      throw new Error(
        `Role not found: ${definition.roleName}`,
      );
    }

    await db
      .insert(memberRoles)
      .values({
        memberId:
          developmentMember.id,

        roleId,
      })
      .onConflictDoNothing();
  }

  // --------------------------------------------------
  // Finished
  // --------------------------------------------------

  console.log("");
  console.log(
    "Seed completed successfully.",
  );

  console.log(
    "Organization:",
    organization.name,
  );

  console.log(
    "Organization ID:",
    organization.id,
  );

  console.log("");
  console.log(
    "Development users:",
  );

  console.log(
    "- local-dev-owner -> Owner",
  );

  console.log(
    "- local-dev-manager -> Manager",
  );

  console.log(
    "- local-dev-viewer -> Viewer",
  );
}

main()
  .catch((error) => {
    console.error(
      "Seed failed:",
    );

    console.error(error);

    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });