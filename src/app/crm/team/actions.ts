"use server";

import { deliverInvitation, type EmailDelivery } from "@/lib/email/delivery";
import { changeInvitation } from "@/modules/invitations/change-invitation";

import { redirectWithNotice } from "@/modules/notifications/redirect";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireMutationPermission } from "@/lib/auth/permissions";
import { createInvitation } from "@/modules/invitations/create-invitation";
import {
  replaceMemberRolesWithOwnerGuard,
  updateMemberStatusWithOwnerGuard,
} from "@/modules/members/owner-guard";

export type InviteMemberState =
  | { status: "revoked"; message: string }
  | {
      status: "idle";
    }
  | {
      status: "created";

      invitationId: string;
      email: string;
      token: string;
      link: string | null;
      delivery: EmailDelivery;
      expiresAt: string;
    }
  | {
      status: "error";
      message: string;
    };

export async function inviteMember(
  previousState: InviteMemberState,
  formData: FormData,
): Promise<InviteMemberState> {
  void previousState;

  const { organization, member: currentMember } =
    await requireMutationPermission("members.manage", formData);

  const email = String(formData.get("email") ?? "");

  const roleId = String(formData.get("roleId") ?? "");

  try {
    const result = await createInvitation({
      organizationId: organization.id,

      invitedByMemberId: currentMember.id,

      email,
      roleId,
    });

    switch (result.status) {
      case "created": {
        const delivered = await deliverInvitation({
          invitationId: result.invitationId,
          email: result.emailNormalized,
          token: result.token,
          organizationName: organization.name,
        });
        revalidatePath("/crm/team");

        return {
          status: "created",
          ...delivered,

          invitationId: result.invitationId,

          email: result.emailNormalized,

          token: result.token,

          expiresAt: result.expiresAt.toISOString(),
        };
      }

      case "invalid-input":
        return {
          status: "error",
          message: "Проверьте email и выбранную роль.",
        };

      case "inviter-invalid":
        return {
          status: "error",
          message: "Текущий сотрудник больше не может создавать приглашения.",
        };

      case "role-not-found":
        return {
          status: "error",
          message: "Выбранная роль недоступна в этой организации.",
        };

      case "identity-ambiguous":
        return {
          status: "error",
          message:
            "Найдено несколько учётных записей с одинаковым email после нормализации.",
        };

      case "member-exists":
        return {
          status: "error",
          message: "Этот пользователь уже состоит в организации.",
        };

      case "already-pending":
        return {
          status: "error",
          message: "Для этого email уже существует действующее приглашение.",
        };

      case "conflict":
        return {
          status: "error",
          message:
            "Приглашение изменилось во время обработки. Попробуйте ещё раз.",
        };
    }
  } catch (error) {
    console.error("Failed to create organization invitation.", error);

    return {
      status: "error",
      message: "Не удалось создать приглашение.",
    };
  }
}

export async function updateMemberStatus(formData: FormData) {
  const { organization, member: currentMember } =
    await requireMutationPermission("members.manage", formData);

  const memberId = String(formData.get("memberId") ?? "");

  const status = String(formData.get("status") ?? "");

  if (status !== "active" && status !== "inactive") {
    redirect("/crm/team?error=status-invalid");
  }

  if (memberId === currentMember.id) {
    redirect("/crm/team?error=self-status");
  }

  const mutation = await updateMemberStatusWithOwnerGuard({
    organizationId: organization.id,

    memberId,

    status,
  });

  if (!mutation || !mutation.member_exists) {
    redirect("/crm/team?error=member");
  }

  if (!mutation.allowed) {
    redirect("/crm/team?error=last-owner");
  }

  if (!mutation.updated) {
    throw new Error("Member status update did not affect the expected row.");
  }

  revalidatePath("/crm/team");

  redirectWithNotice(`/crm/team?statusUpdated=${status}`, "member-status");
}

export async function updateMemberRoles(formData: FormData) {
  const { organization, member: currentMember } =
    await requireMutationPermission("members.manage", formData);

  const memberId = String(formData.get("memberId") ?? "");

  const roleIds = formData.getAll("roleIds").map(String);

  if (!memberId || roleIds.length === 0) {
    redirect("/crm/team?error=invalid");
  }

  if (memberId === currentMember.id) {
    redirect("/crm/team?error=self");
  }

  const uniqueRoleIds = [...new Set(roleIds)];

  const mutation = await replaceMemberRolesWithOwnerGuard({
    organizationId: organization.id,

    memberId,

    roleIds: uniqueRoleIds,
  });

  if (!mutation || !mutation.member_exists) {
    redirect("/crm/team?error=member");
  }

  if (!mutation.roles_valid) {
    redirect("/crm/team?error=role");
  }

  if (mutation.blocked_last_owner || !mutation.allowed) {
    redirect("/crm/team?error=last-owner");
  }

  revalidatePath("/crm/team");

  redirectWithNotice("/crm/team?saved=1", "member-roles");
}
export async function manageInvitation(
  previous: InviteMemberState,
  formData: FormData,
): Promise<InviteMemberState> {
  void previous;
  const { organization, member } = await requireMutationPermission(
    "members.manage",
    formData,
  );
  const operation = formData.get("operation");
  if (operation !== "revoke" && operation !== "reissue")
    return { status: "error", message: "Некорректное действие." };
  const result = await changeInvitation({
    organizationId: organization.id,
    memberId: member.id,
    invitationId: String(formData.get("invitationId") ?? ""),
    expectedExpiresAt: String(formData.get("expectedExpiresAt") ?? ""),
    operation,
  });
  if (!result)
    return {
      status: "error",
      message: "Приглашение изменилось или уже недоступно. Обновите страницу.",
    };
  revalidatePath("/crm/team");
  if (!result.token)
    return {
      status: "revoked",
      message: "Приглашение отозвано. Старая ссылка больше не действует.",
    };
  const delivered = await deliverInvitation({
    invitationId: result.id,
    email: result.email_normalized,
    token: result.token,
    organizationName: organization.name,
  });
  return {
    status: "created",
    invitationId: result.id,
    email: result.email_normalized,
    token: result.token,
    expiresAt: new Date(result.expires_at).toISOString(),
    ...delivered,
  };
}
