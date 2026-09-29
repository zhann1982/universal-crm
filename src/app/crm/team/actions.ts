"use server";

import { randomUUID } from "node:crypto";

import {
  and,
  eq,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  memberRoles,
  organizationMembers,
  roles,
} from "@/db/schema";
import {
  findAuthUserByEmail,
} from "@/lib/auth/find-auth-user-by-email";
import { requirePermission } from "@/lib/auth/permissions";
import {
  addMemberSchema,
  updateMemberRolesSchema,
  updateMemberStatusSchema,
} from "@/lib/validation/member";
import {
  replaceMemberRolesWithOwnerGuard,
  updateMemberStatusWithOwnerGuard,
} from "@/modules/members/owner-guard";

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

  const userLookup =
    await findAuthUserByEmail(
      email,
    );

  if (
    userLookup.status ===
    "not-found"
  ) {
    redirect(
      "/crm/team?error=user-not-found",
    );
  }

  if (
    userLookup.status ===
    "ambiguous"
  ) {
    redirect(
      "/crm/team?error=user-ambiguous",
    );
  }

  const authUser =
    userLookup.user;

  if (
    !authUser.emailVerified
  ) {
    redirect(
      "/crm/team?error=user-unverified",
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

  const newMemberId =
    randomUUID();

  await db.batch([
    db
      .insert(
        organizationMembers,
      )
      .values({
        id: newMemberId,

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
      }),

    db
      .insert(memberRoles)
      .values({
        memberId:
          newMemberId,

        roleId:
          selectedRole.id,
      }),
  ]);

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

  const mutation =
    await updateMemberStatusWithOwnerGuard({
      organizationId:
        organization.id,

      memberId,
      status,
    });

  if (
    !mutation ||
    !mutation.member_exists
  ) {
    redirect(
      "/crm/team?error=member",
    );
  }

  if (!mutation.allowed) {
    redirect(
      "/crm/team?error=last-owner",
    );
  }

  if (!mutation.updated) {
    throw new Error(
      "Member status update did not affect the expected row.",
    );
  }

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

  const uniqueRoleIds = [
    ...new Set(roleIds),
  ];

  const mutation =
    await replaceMemberRolesWithOwnerGuard({
      organizationId:
        organization.id,

      memberId,

      roleIds:
        uniqueRoleIds,
    });

  if (
    !mutation ||
    !mutation.member_exists
  ) {
    redirect(
      "/crm/team?error=member",
    );
  }

  if (!mutation.roles_valid) {
    redirect(
      "/crm/team?error=role",
    );
  }

  if (
    mutation.blocked_last_owner ||
    !mutation.allowed
  ) {
    redirect(
      "/crm/team?error=last-owner",
    );
  }

  revalidatePath(
    "/crm/team",
  );

  redirect(
    "/crm/team?saved=1",
  );
}
