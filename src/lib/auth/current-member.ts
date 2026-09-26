import {
  and,
  eq,
} from "drizzle-orm";
import {
  headers,
} from "next/headers";
import {
  redirect,
} from "next/navigation";

import { db } from "@/db";
import {
  organizationMembers,
} from "@/db/schema";
import {
  auth,
} from "@/lib/auth/auth";
import {
  getCurrentOrganization,
} from "@/lib/current-organization";

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

  const [member] =
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
            session.user.id,
          ),

          eq(
            organizationMembers.status,
            "active",
          ),
        ),
      )
      .limit(1);

  if (!member) {
    redirect(
      "/no-access",
    );
  }

  return {
    organization,
    member,

    user:
      session.user,

    session:
      session.session,
  };
}