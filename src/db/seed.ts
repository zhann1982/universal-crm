import { PERMISSIONS } from "@/modules/access/permission-catalog";
import { DEFAULT_ROLES, DEFAULT_STAGES } from "@/modules/organizations/defaults";
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

  const roleDefinitions = DEFAULT_ROLES;

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
            roles.systemKey,
            roleDefinition.systemKey,
          ),
        ),
      )
      .limit(1);

    /*
     * Совместимость с ролями,
     * созданными до появления systemKey.
     */
    if (!role) {
      const [legacyRole] =
        await db
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

      if (legacyRole) {
        if (
          legacyRole.systemKey &&
          legacyRole.systemKey !==
            roleDefinition.systemKey
        ) {
          throw new Error(
            `Role ${legacyRole.name} already has another systemKey: ${legacyRole.systemKey}`,
          );
        }

        [role] = await db
          .update(roles)
          .set({
            systemKey:
              roleDefinition.systemKey,

            isSystem: true,

            updatedAt:
              new Date(),
          })
          .where(
            eq(
              roles.id,
              legacyRole.id,
            ),
          )
          .returning();

        console.log(
          "Updated system role:",
          role.name,
          role.systemKey,
        );
      }
    }

    if (!role) {
      [role] = await db
        .insert(roles)
        .values({
          organizationId:
            organization.id,

          name:
            roleDefinition.name,

          systemKey:
            roleDefinition.systemKey,

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
      roleDefinition.systemKey,
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

  const defaultStages = DEFAULT_STAGES;

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
    roleMap.get("owner");

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

      roleSystemKey:
        "manager",
    },

    {
      userId:
        "local-dev-viewer",

      displayName:
        "Development Viewer",

      email:
        "viewer@local.dev",

      roleSystemKey:
        "viewer",
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
        definition.roleSystemKey,
      );

    if (!roleId) {
      throw new Error(
        `Role not found: ${definition.roleSystemKey}`,
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
