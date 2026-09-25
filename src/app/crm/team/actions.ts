"use server";

import {
  and,
  eq,
  inArray,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  memberRoles,
  organizationMembers,
  roles,
} from "@/db/schema";
import { requirePermission } from "@/lib/auth/permissions";
import { updateMemberRolesSchema } from "@/lib/validation/member";

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

  // Пока запрещаем изменять собственные роли,
  // чтобы Development Owner случайно
  // не заблокировал сам себе доступ.
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
      validRoles.map((role) => ({
        memberId:
          targetMember.id,

        roleId:
          role.id,
      })),
    )
    .onConflictDoNothing();

  revalidatePath("/crm/team");

  redirect(
    "/crm/team?saved=1",
  );
}