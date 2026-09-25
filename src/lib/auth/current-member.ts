import {
  and,
  eq,
} from "drizzle-orm";

import { db } from "@/db";
import {
  organizationMembers,
} from "@/db/schema";
import { getCurrentOrganization } from "@/lib/current-organization";

const DEVELOPMENT_USER_ID =
  "local-dev-owner";

export async function getCurrentMember() {
  const organization =
    await getCurrentOrganization();

  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(
          organizationMembers.organizationId,
          organization.id,
        ),

        eq(
          organizationMembers.userId,
          DEVELOPMENT_USER_ID,
        ),

        eq(
          organizationMembers.status,
          "active",
        ),
      ),
    )
    .limit(1);

  if (!member) {
    throw new Error(
      "Current development member not found",
    );
  }

  return {
    organization,
    member,
  };
}