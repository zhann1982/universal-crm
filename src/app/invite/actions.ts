"use server";

import {
  headers,
} from "next/headers";
import {
  redirect,
} from "next/navigation";

import {
  auth,
} from "@/lib/auth/auth";
import {
  findAuthUserByEmail,
} from "@/lib/auth/find-auth-user-by-email";
import {
  acceptInvitation,
} from "@/modules/invitations/accept-invitation";

function invitePath(
  token: string,
) {
  return `/invite?token=${encodeURIComponent(
    token,
  )}`;
}

export async function acceptInvitationAction(
  formData: FormData,
) {
  const token = String(
    formData.get("token") ?? "",
  ).trim();

  if (!token) {
    redirect(
      "/invite?error=invalid",
    );
  }

  /*
   * Invitation acceptance cannot use
   * requirePermission()/getCurrentMember():
   * the invited User does not have a
   * Membership yet.
   */
  const session =
    await auth.api.getSession({
      headers:
        await headers(),
    });

  if (!session) {
    const next =
      invitePath(token);

    redirect(
      `/login?next=${encodeURIComponent(
        next,
      )}`,
    );
  }

  if (
    !session.user.emailVerified
  ) {
    redirect(
      `/verify-email?next=${encodeURIComponent(
        invitePath(token),
      )}`,
    );
  }

  /*
   * Session User is authoritative,
   * but canonical-email ambiguity is
   * still rejected before Membership
   * creation.
   */
  const userLookup =
    await findAuthUserByEmail(
      session.user.email,
    );

  if (
    userLookup.status !== "found" ||
    userLookup.user.id !==
      session.user.id
  ) {
    redirect(
      `${invitePath(
        token,
      )}&error=identity`,
    );
  }

  const result =
    await acceptInvitation({
      token,

      userId:
        session.user.id,

      userEmail:
        session.user.email,

      userName:
        session.user.name,

      emailVerified:
        session.user.emailVerified,
    });

  switch (result.status) {
    case "accepted":
      redirect(
        "/crm?joined=1",
      );

    case "email-unverified":
      redirect(
        `/verify-email?next=${encodeURIComponent(
          invitePath(token),
        )}`,
      );

    case "identity-mismatch":
      redirect(
        `${invitePath(
          token,
        )}&error=email-mismatch`,
      );

    case "already-accepted":
      redirect(
        `${invitePath(
          token,
        )}&error=already-accepted`,
      );

    case "revoked":
      redirect(
        `${invitePath(
          token,
        )}&error=revoked`,
      );

    case "expired":
      redirect(
        `${invitePath(
          token,
        )}&error=expired`,
      );

    case "organization-inactive":
      redirect(
        `${invitePath(
          token,
        )}&error=organization-inactive`,
      );

    case "role-invalid":
      redirect(
        `${invitePath(
          token,
        )}&error=role-invalid`,
      );

    case "member-exists":
      redirect(
        `${invitePath(
          token,
        )}&error=member-exists`,
      );

    case "invalid-input":
    case "not-found":
      redirect(
        "/invite?error=invalid",
      );

    case "conflict":
      redirect(
        `${invitePath(
          token,
        )}&error=conflict`,
      );
  }
}
