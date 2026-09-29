import {
  and,
  eq,
} from "drizzle-orm";

import { db } from "@/db";
import {
  organizationMembers,
} from "@/db/schema";

import {
  evaluateOwnerAssignment,
  type OwnerAssignmentMode,
} from "./owner-assignment-policy";

export type ResolveOwnerAssignmentInput = {
  organizationId: string;
  mode: OwnerAssignmentMode;
  currentMemberId: string;
  canReadMembers: boolean;
  requestedOwnerMemberId:
    | string
    | null;
  existingOwnerMemberId?:
    | string
    | null;
};

export type ResolveOwnerAssignmentResult =
  | {
      status: "allowed";
      ownerChanged: boolean;
    }
  | {
      status: "forbidden";
      ownerChanged: boolean;
      reason:
        "foreign-owner-without-members-read";
    }
  | {
      status: "owner-unavailable";
      ownerChanged: true;
    };

export async function resolveOwnerAssignment(
  input: ResolveOwnerAssignmentInput,
): Promise<ResolveOwnerAssignmentResult> {
  const policy =
    evaluateOwnerAssignment({
      mode:
        input.mode,

      currentMemberId:
        input.currentMemberId,

      canReadMembers:
        input.canReadMembers,

      requestedOwnerMemberId:
        input.requestedOwnerMemberId,

      existingOwnerMemberId:
        input.existingOwnerMemberId,
    });

  if (!policy.allowed) {
    return {
      status: "forbidden",
      ownerChanged:
        policy.ownerChanged,
      reason:
        policy.reason,
    };
  }

  /*
   * Keeping the existing owner does not
   * revalidate Membership activity.
   *
   * This preserves F08:
   * an entity may still be edited when
   * its existing owner later became
   * inactive.
   */
  if (!policy.ownerChanged) {
    return {
      status: "allowed",
      ownerChanged: false,
    };
  }

  /*
   * Clearing owner is allowed and does
   * not require a Membership lookup.
   */
  if (
    !input.requestedOwnerMemberId
  ) {
    return {
      status: "allowed",
      ownerChanged: true,
    };
  }

  /*
   * Every NEW non-null owner must be an
   * active Member of the same tenant.
   */
  const [owner] =
    await db
      .select({
        id:
          organizationMembers.id,
      })
      .from(
        organizationMembers,
      )
      .where(
        and(
          eq(
            organizationMembers.id,
            input.requestedOwnerMemberId,
          ),

          eq(
            organizationMembers.organizationId,
            input.organizationId,
          ),

          eq(
            organizationMembers.status,
            "active",
          ),
        ),
      )
      .limit(1);

  if (!owner) {
    return {
      status:
        "owner-unavailable",
      ownerChanged: true,
    };
  }

  return {
    status: "allowed",
    ownerChanged: true,
  };
}
