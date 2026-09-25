"use server";

import {
  and,
  eq,
  ilike,
  inArray,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  user as authUsers,
} from "@/db/auth-schema";
import {
  memberRoles,
  organizationMembers,
  roles,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth/permissions";
import {
  addMemberSchema,
  updateMemberRolesSchema,
  updateMemberStatusSchema,
} from "@/lib/validation/member";

export async function addMember(
  formData: FormData,
) {
  const {
    organization,
  } = await requirePermission(
    "members.manage",
  );

  const result =
    addMemberSchema.safeParse({
      email: String(
        formData.get("email") ?? "",
      ),

      roleId: String(
        formData.get("roleId") ?? "",
      ),
    });

  if (!result.success) {
    redirect(
      "/crm/team?error=add-invalid",
    );
  }

  const {
    email,
    roleId,
  } = result.data;

  const [authUser] = await db
    .select({
      id: authUsers.id,
      name: authUsers.name,
      email: authUsers.email,
    })
    .from(authUsers)
    .where(
      ilike(
        authUsers.email,
        email,
      ),
    )
    .limit(1);

  if (!authUser) {
    redirect(
      "/crm/team?error=user-not-found",
    );
  }

  const [existingMember] =
    await db
      .select({
        id: organizationMembers.id,
      })
      .from(organizationMembers)
      .where(
        and(
          eq(
            organizationMembers.organizationId,
            organization.id,
          ),

          eq(
            organizationMembers.userId,
            authUser.id,
          ),
        ),
      )
      .limit(1);

  if (existingMember) {
    redirect(
      "/crm/team?error=member-exists",
    );
  }

  const [selectedRole] =
    await db
      .select({
        id: roles.id,
      })
      .from(roles)
      .where(
        and(
          eq(
            roles.id,
            roleId,
          ),

          eq(
            roles.organizationId,
            organization.id,
          ),
        ),
      )
      .limit(1);

  if (!selectedRole) {
    redirect(
      "/crm/team?error=role",
    );
  }

  const [newMember] =
    await db
      .insert(
        organizationMembers,
      )
      .values({
        organizationId:
          organization.id,

        userId:
          authUser.id,

        displayName:
          authUser.name,

        email:
          authUser.email,

        status:
          "active",
      })
      .returning({
        id: organizationMembers.id,
      });

  try {
    await db
      .insert(memberRoles)
      .values({
        memberId:
          newMember.id,

        roleId:
          selectedRole.id,
      });
  } catch (error) {
    await db
      .delete(
        organizationMembers,
      )
      .where(
        and(
          eq(
            organizationMembers.id,
            newMember.id,
          ),

          eq(
            organizationMembers.organizationId,
            organization.id,
          ),
        ),
      );

    throw error;
  }

  revalidatePath(
    "/crm/team",
  );

  redirect(
    "/crm/team?added=1",
  );
}

export async function updateMemberStatus(
  formData: FormData,
) {
  const {
    organization,
    member: currentMember,
  } = await requirePermission(
    "members.manage",
  );

  const result =
    updateMemberStatusSchema.safeParse({
      memberId: String(
        formData.get("memberId") ?? "",
      ),

      status: String(
        formData.get("status") ?? "",
      ),
    });

  if (!result.success) {
    redirect(
      "/crm/team?error=status-invalid",
    );
  }

  const {
    memberId,
    status,
  } = result.data;

  if (
    memberId === currentMember.id
  ) {
    redirect(
      "/crm/team?error=self-status",
    );
  }

  const [targetMember] =
    await db
      .select({
        id: organizationMembers.id,
        status:
          organizationMembers.status,
      })
      .from(organizationMembers)
      .where(
        and(
          eq(
            organizationMembers.id,
            memberId,
          ),

          eq(
            organizationMembers.organizationId,
            organization.id,
          ),
        ),
      )
      .limit(1);

  if (!targetMember) {
    redirect(
      "/crm/team?error=member",
    );
  }

  if (
    status === "inactive" &&
    targetMember.status === "active"
  ) {
    const [targetOwnerRole] =
      await db
        .select({
          roleId:
            memberRoles.roleId,
        })
        .from(memberRoles)
        .innerJoin(
          roles,
          eq(
            memberRoles.roleId,
            roles.id,
          ),
        )
        .where(
          and(
            eq(
              memberRoles.memberId,
              targetMember.id,
            ),

            eq(
              roles.organizationId,
              organization.id,
            ),

            eq(
              roles.name,
              "Owner",
            ),
          ),
        )
        .limit(1);

    if (targetOwnerRole) {
      const activeOwners =
        await db
          .selectDistinct({
            memberId:
              organizationMembers.id,
          })
          .from(
            organizationMembers,
          )
          .innerJoin(
            memberRoles,
            eq(
              memberRoles.memberId,
              organizationMembers.id,
            ),
          )
          .innerJoin(
            roles,
            eq(
              memberRoles.roleId,
              roles.id,
            ),
          )
          .where(
            and(
              eq(
                organizationMembers.organizationId,
                organization.id,
              ),

              eq(
                organizationMembers.status,
                "active",
              ),

              eq(
                roles.organizationId,
                organization.id,
              ),

              eq(
                roles.name,
                "Owner",
              ),
            ),
          );

      if (
        activeOwners.length <= 1
      ) {
        redirect(
          "/crm/team?error=last-owner",
        );
      }
    }
  }

  await db
    .update(
      organizationMembers,
    )
    .set({
      status,
      updatedAt:
        new Date(),
    })
    .where(
      and(
        eq(
          organizationMembers.id,
          targetMember.id,
        ),

        eq(
          organizationMembers.organizationId,
          organization.id,
        ),
      ),
    );

  revalidatePath(
    "/crm/team",
  );

  redirect(
    `/crm/team?statusUpdated=${status}`,
  );
}

export async function updateMemberRoles(
  formData: FormData,
) {
  const {
    organization,
    member: currentMember,
  } = await requirePermission(
    "members.manage",
  );

  const result =
    updateMemberRolesSchema.safeParse({
      memberId: String(
        formData.get("memberId") ?? "",
      ),

      roleIds: formData
        .getAll("roleIds")
        .map(String),
    });

  if (!result.success) {
    redirect(
      "/crm/team?error=invalid",
    );
  }

  const {
    memberId,
    roleIds,
  } = result.data;

  if (
    memberId === currentMember.id
  ) {
    redirect(
      "/crm/team?error=self",
    );
  }

  const [targetMember] =
    await db
      .select({
        id: organizationMembers.id,
      })
      .from(organizationMembers)
      .where(
        and(
          eq(
            organizationMembers.id,
            memberId,
          ),

          eq(
            organizationMembers.organizationId,
            organization.id,
          ),
        ),
      )
      .limit(1);

  if (!targetMember) {
    redirect(
      "/crm/team?error=member",
    );
  }

  const uniqueRoleIds = [
    ...new Set(roleIds),
  ];

  const validRoles = await db
    .select({
      id: roles.id,
    })
    .from(roles)
    .where(
      and(
        eq(
          roles.organizationId,
          organization.id,
        ),

        inArray(
          roles.id,
          uniqueRoleIds,
        ),
      ),
    );

  if (
    validRoles.length !==
    uniqueRoleIds.length
  ) {
    redirect(
      "/crm/team?error=role",
    );
  }

  await db
    .delete(memberRoles)
    .where(
      eq(
        memberRoles.memberId,
        targetMember.id,
      ),
    );

  await db
    .insert(memberRoles)
    .values(
      validRoles.map(
        (role) => ({
          memberId:
            targetMember.id,

          roleId:
            role.id,
        }),
      ),
    )
    .onConflictDoNothing();

  revalidatePath(
    "/crm/team",
  );

  redirect(
    "/crm/team?saved=1",
  );
}