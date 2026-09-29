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
  getCurrentOrganization,
} from "@/lib/current-organization";
import {
  getMembershipForAccess,
} from "@/modules/access/tenant-access";

export async function getCurrentMember() {
  const session =
    await auth.api.getSession({
      headers:
        await headers(),
    });

  if (!session) {
    redirect(
      "/login",
    );
  }

  /*
   * Пользователь может иметь
   * Better Auth account и Session,
   * но CRM требует подтверждённое
   * владение email.
   */
  if (
    !session.user.emailVerified
  ) {
    redirect(
      "/verify-email",
    );
  }

  const organization =
    await getCurrentOrganization();

  const membership =
    await getMembershipForAccess(
      organization.id,
      session.user.id,
    );

  if (
    membership.status !==
    "active"
  ) {
    redirect(
      "/no-access",
    );
  }

  return {
    organization,
    member:
      membership.member,

    user:
      session.user,

    session:
      session.session,
  };
}
