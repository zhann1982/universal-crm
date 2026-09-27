"use server";

import { randomUUID } from "node:crypto";

import {
  and,
  eq,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  db,
  sql,
} from "@/db";
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

type StatusGuardRow = {
  member_exists: boolean;
  allowed: boolean;
  updated: boolean;
};

type RolesGuardRow = {
  member_exists: boolean;
  roles_valid: boolean;
  blocked_last_owner: boolean;
  allowed: boolean;
};

async function updateMemberStatusWithOwnerGuard(input: {
  organizationId: string;
  memberId: string;
  status: "active" | "inactive";
}) {
  const {
    organizationId,
    memberId,
    status,
  } = input;

  const transactionResult =
    await sql.transaction(
      (txn) => [
        /*
         * Все операции, способные уменьшить число активных Owners,
         * сериализуются одним advisory lock на организацию.
         *
         * Второй параллельный запрос дождётся завершения первого,
         * а затем увидит уже зафиксированное состояние.
         */
        txn`
          SELECT pg_advisory_xact_lock(
            hashtext('universal-crm-owner-guard'),
            hashtext(${organizationId})
          )
        `,

        txn`
          WITH target AS MATERIALIZED (
            SELECT
              om.id,
              om.status,

              EXISTS (
                SELECT 1
                FROM member_roles mr
                INNER JOIN roles r
                  ON r.id = mr.role_id
                WHERE
                  mr.member_id = om.id
                  AND r.organization_id = ${organizationId}::uuid
                  AND r.system_key = 'owner'
              ) AS is_owner

            FROM organization_members om
            WHERE
              om.id = ${memberId}::uuid
              AND om.organization_id = ${organizationId}::uuid
          ),

          decision AS MATERIALIZED (
            SELECT
              target.id,

              NOT (
                ${status}::text = 'inactive'
                AND target.status = 'active'
                AND target.is_owner

                AND NOT EXISTS (
                  SELECT 1
                  FROM organization_members other_member
                  INNER JOIN member_roles other_member_role
                    ON other_member_role.member_id = other_member.id
                  INNER JOIN roles other_role
                    ON other_role.id = other_member_role.role_id
                  WHERE
                    other_member.organization_id = ${organizationId}::uuid
                    AND other_member.status = 'active'
                    AND other_member.id <> target.id
                    AND other_role.organization_id = ${organizationId}::uuid
                    AND other_role.system_key = 'owner'
                )
              ) AS allowed

            FROM target
          ),

          updated AS (
            UPDATE organization_members om
            SET
              status = ${status},
              updated_at = now()
            FROM decision
            WHERE
              om.id = decision.id
              AND decision.allowed
            RETURNING om.id
          )

          SELECT
            EXISTS(
              SELECT 1
              FROM target
            ) AS member_exists,

            COALESCE(
              (
                SELECT allowed
                FROM decision
                LIMIT 1
              ),
              false
            ) AS allowed,

            EXISTS(
              SELECT 1
              FROM updated
            ) AS updated
        `,
      ],
    );

  const rows =
    transactionResult[1] as
      StatusGuardRow[];

  return rows[0];
}

async function replaceMemberRolesWithOwnerGuard(input: {
  organizationId: string;
  memberId: string;
  roleIds: string[];
}) {
  const {
    organizationId,
    memberId,
    roleIds,
  } = input;

  const requestedRolesJson =
    JSON.stringify(roleIds);

  const transactionResult =
    await sql.transaction(
      (txn) => [
        txn`
          SELECT pg_advisory_xact_lock(
            hashtext('universal-crm-owner-guard'),
            hashtext(${organizationId})
          )
        `,

        txn`
          WITH target AS MATERIALIZED (
            SELECT
              om.id,
              om.status
            FROM organization_members om
            WHERE
              om.id = ${memberId}::uuid
              AND om.organization_id = ${organizationId}::uuid
          ),

          requested_input AS MATERIALIZED (
            SELECT DISTINCT
              value::uuid AS id
            FROM jsonb_array_elements_text(
              ${requestedRolesJson}::jsonb
            )
          ),

          valid_roles AS MATERIALIZED (
            SELECT
              r.id,
              r.system_key
            FROM roles r
            INNER JOIN requested_input requested
              ON requested.id = r.id
            WHERE
              r.organization_id = ${organizationId}::uuid
          ),

          facts AS MATERIALIZED (
            SELECT
              EXISTS(
                SELECT 1
                FROM target
              ) AS member_exists,

              (
                SELECT count(*)
                FROM requested_input
              ) = (
                SELECT count(*)
                FROM valid_roles
              ) AS roles_valid,

              COALESCE(
                (
                  SELECT target.status
                  FROM target
                  LIMIT 1
                ),
                ''
              ) AS target_status,

              EXISTS(
                SELECT 1
                FROM member_roles mr
                INNER JOIN roles assigned_role
                  ON assigned_role.id = mr.role_id
                WHERE
                  mr.member_id = ${memberId}::uuid
                  AND assigned_role.organization_id = ${organizationId}::uuid
                  AND assigned_role.system_key = 'owner'
              ) AS current_owner,

              EXISTS(
                SELECT 1
                FROM valid_roles
                WHERE system_key = 'owner'
              ) AS will_remain_owner,

              EXISTS(
                SELECT 1
                FROM organization_members other_member
                INNER JOIN member_roles other_member_role
                  ON other_member_role.member_id = other_member.id
                INNER JOIN roles other_role
                  ON other_role.id = other_member_role.role_id
                WHERE
                  other_member.organization_id = ${organizationId}::uuid
                  AND other_member.status = 'active'
                  AND other_member.id <> ${memberId}::uuid
                  AND other_role.organization_id = ${organizationId}::uuid
                  AND other_role.system_key = 'owner'
              ) AS other_active_owner
          ),

          decision AS MATERIALIZED (
            SELECT
              facts.*,

              (
                facts.member_exists
                AND facts.roles_valid

                AND NOT (
                  facts.target_status = 'active'
                  AND facts.current_owner
                  AND NOT facts.will_remain_owner
                  AND NOT facts.other_active_owner
                )
              ) AS allowed

            FROM facts
          ),

          deleted AS (
            DELETE FROM member_roles mr
            USING decision
            WHERE
              mr.member_id = ${memberId}::uuid
              AND decision.allowed
            RETURNING mr.member_id
          ),

          delete_done AS MATERIALIZED (
            SELECT count(*) AS deleted_count
            FROM deleted
          ),

          inserted AS (
            INSERT INTO member_roles (
              member_id,
              role_id
            )
            SELECT
              ${memberId}::uuid,
              valid_roles.id
            FROM valid_roles
            CROSS JOIN decision
            CROSS JOIN delete_done
            WHERE decision.allowed
            RETURNING member_id
          )

          SELECT
            decision.member_exists,
            decision.roles_valid,

            (
              decision.target_status = 'active'
              AND decision.current_owner
              AND NOT decision.will_remain_owner
              AND NOT decision.other_active_owner
            ) AS blocked_last_owner,

            decision.allowed

          FROM decision
        `,
      ],
    );

  const rows =
    transactionResult[1] as
      RolesGuardRow[];

  return rows[0];
}

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
