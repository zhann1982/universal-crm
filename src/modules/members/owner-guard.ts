import { sql } from "@/db";

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

export async function updateMemberStatusWithOwnerGuard(input: {
  organizationId: string;
  memberId: string;
  status: "active" | "inactive";
}) {
  const { organizationId, memberId, status } = input;

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
            EXISTS(SELECT 1 FROM target) AS member_exists,
            COALESCE(
              (SELECT allowed FROM decision LIMIT 1),
              false
            ) AS allowed,
            EXISTS(SELECT 1 FROM updated) AS updated
        `,
      ],
    );

  const rows =
    transactionResult[1] as StatusGuardRow[];

  return rows[0];
}

export async function replaceMemberRolesWithOwnerGuard(input: {
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
              EXISTS(SELECT 1 FROM target) AS member_exists,

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
              organization_id,
              member_id,
              role_id
            )
            SELECT
              ${organizationId}::uuid,
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
    transactionResult[1] as RolesGuardRow[];

  return rows[0];
}
