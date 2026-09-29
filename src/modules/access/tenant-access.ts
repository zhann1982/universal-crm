import {
  and,
  eq,
} from "drizzle-orm";

import { db } from "@/db";
import {
  organizationMembers,
  organizations,
} from "@/db/schema";

type Organization =
  typeof organizations.$inferSelect;

type OrganizationMember =
  typeof organizationMembers.$inferSelect;

export type OrganizationAccessResult =
  | {
      status: "active";
      organization: Organization;
    }
  | {
      status: "inactive";
    }
  | {
      status: "not-found";
    };

export async function getOrganizationForAccessBySlug(
  slug: string,
): Promise<OrganizationAccessResult> {
  const [organization] =
    await db
      .select()
      .from(organizations)
      .where(
        eq(
          organizations.slug,
          slug,
        ),
      )
      .limit(1);

  if (!organization) {
    return {
      status: "not-found",
    };
  }

  if (!organization.isActive) {
    return {
      status: "inactive",
    };
  }

  return {
    status: "active",
    organization,
  };
}

export type MembershipAccessResult =
  | {
      status: "active";
      member: OrganizationMember;
    }
  | {
      status: "inactive";
    }
  | {
      status: "not-found";
    };

export async function getMembershipForAccess(
  organizationId: string,
  userId: string,
): Promise<MembershipAccessResult> {
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
            organizationId,
          ),
          eq(
            organizationMembers.userId,
            userId,
          ),
        ),
      )
      .limit(1);

  if (!member) {
    return {
      status: "not-found",
    };
  }

  if (
    member.status !==
    "active"
  ) {
    return {
      status: "inactive",
    };
  }

  return {
    status: "active",
    member,
  };
}
