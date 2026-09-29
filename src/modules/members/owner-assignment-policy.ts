export type OwnerAssignmentMode =
  | "create"
  | "update";

export type OwnerAssignmentPolicyInput = {
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

export type OwnerAssignmentPolicyResult =
  | {
      allowed: true;
      ownerChanged: boolean;
    }
  | {
      allowed: false;
      ownerChanged: boolean;
      reason:
        "foreign-owner-without-members-read";
    };

export function evaluateOwnerAssignment(
  input: OwnerAssignmentPolicyInput,
): OwnerAssignmentPolicyResult {
  const ownerChanged =
    input.mode === "create"
      ? input.requestedOwnerMemberId !==
        null
      : input.requestedOwnerMemberId !==
        (input.existingOwnerMemberId ??
          null);

  /*
   * Keeping the current owner is not a
   * new assignment. This preserves the
   * existing inactive-owner rule.
   */
  if (!ownerChanged) {
    return {
      allowed: true,
      ownerChanged: false,
    };
  }

  /*
   * Clearing owner is always allowed by
   * this visibility policy.
   */
  if (
    input.requestedOwnerMemberId ===
    null
  ) {
    return {
      allowed: true,
      ownerChanged: true,
    };
  }

  /*
   * Without members.read, a caller may
   * assign only themselves.
   */
  if (
    !input.canReadMembers &&
    input.requestedOwnerMemberId !==
      input.currentMemberId
  ) {
    return {
      allowed: false,
      ownerChanged: true,
      reason:
        "foreign-owner-without-members-read",
    };
  }

  return {
    allowed: true,
    ownerChanged: true,
  };
}
