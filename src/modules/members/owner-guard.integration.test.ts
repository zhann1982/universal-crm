import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { sql } from "@/db";
import {
  replaceMemberRolesWithOwnerGuard,
  updateMemberStatusWithOwnerGuard,
} from "@/modules/members/owner-guard";

type Fixture = {
  organizationId: string;
  ownerRoleId: string;
  managerRoleId: string;
  memberAId: string;
  memberBId: string;
};

async function createFixture(): Promise<Fixture> {
  const organizationId = randomUUID();
  const ownerRoleId = randomUUID();
  const managerRoleId = randomUUID();
  const memberAId = randomUUID();
  const memberBId = randomUUID();
  const suffix = randomUUID();

  await sql.transaction((txn) => [
    txn`
      INSERT INTO organizations (
        id,
        name,
        slug,
        is_active
      )
      VALUES (
        ${organizationId}::uuid,
        'Owner guard integration test',
        ${`owner-guard-${suffix}`},
        true
      )
    `,

    txn`
      INSERT INTO roles (
        id,
        organization_id,
        name,
        system_key,
        is_system
      )
      VALUES
        (
          ${ownerRoleId}::uuid,
          ${organizationId}::uuid,
          'Owner',
          'owner',
          true
        ),
        (
          ${managerRoleId}::uuid,
          ${organizationId}::uuid,
          'Manager',
          'manager',
          true
        )
    `,

    txn`
      INSERT INTO organization_members (
        id,
        organization_id,
        user_id,
        display_name,
        status
      )
      VALUES
        (
          ${memberAId}::uuid,
          ${organizationId}::uuid,
          ${`owner-a-${suffix}`},
          'Integration Owner A',
          'active'
        ),
        (
          ${memberBId}::uuid,
          ${organizationId}::uuid,
          ${`owner-b-${suffix}`},
          'Integration Owner B',
          'active'
        )
    `,

    txn`
      INSERT INTO member_roles (
        organization_id,
        member_id,
        role_id
      )
      VALUES
        (
          ${organizationId}::uuid,
          ${memberAId}::uuid,
          ${ownerRoleId}::uuid
        ),
        (
          ${organizationId}::uuid,
          ${memberAId}::uuid,
          ${managerRoleId}::uuid
        ),
        (
          ${organizationId}::uuid,
          ${memberBId}::uuid,
          ${ownerRoleId}::uuid
        ),
        (
          ${organizationId}::uuid,
          ${memberBId}::uuid,
          ${managerRoleId}::uuid
        )
    `,
  ]);

  return {
    organizationId,
    ownerRoleId,
    managerRoleId,
    memberAId,
    memberBId,
  };
}

async function cleanupFixture(
  organizationId: string,
) {
  await sql`
    DELETE FROM organizations
    WHERE id = ${organizationId}::uuid
  `;
}

async function getActiveOwnerCount(
  organizationId: string,
) {
  const rows = await sql`
    SELECT
      count(DISTINCT om.id)::int AS count
    FROM organization_members om
    INNER JOIN member_roles mr
      ON mr.member_id = om.id
    INNER JOIN roles r
      ON r.id = mr.role_id
    WHERE
      om.organization_id = ${organizationId}::uuid
      AND om.status = 'active'
      AND r.organization_id = ${organizationId}::uuid
      AND r.system_key = 'owner'
  `;

  return Number(
    (rows[0] as { count: number }).count,
  );
}

test(
  "concurrent Owner role removals cannot remove the last active Owner",
  async () => {
    const fixture =
      await createFixture();

    try {
      const results =
        await Promise.all([
          replaceMemberRolesWithOwnerGuard({
            organizationId:
              fixture.organizationId,

            memberId:
              fixture.memberAId,

            roleIds: [
              fixture.managerRoleId,
            ],
          }),

          replaceMemberRolesWithOwnerGuard({
            organizationId:
              fixture.organizationId,

            memberId:
              fixture.memberBId,

            roleIds: [
              fixture.managerRoleId,
            ],
          }),
        ]);

      assert.equal(
        results.filter(
          (result) =>
            result?.allowed === true,
        ).length,
        1,
      );

      assert.equal(
        results.filter(
          (result) =>
            result
              ?.blocked_last_owner ===
            true,
        ).length,
        1,
      );

      assert.equal(
        await getActiveOwnerCount(
          fixture.organizationId,
        ),
        1,
      );
    } finally {
      await cleanupFixture(
        fixture.organizationId,
      );
    }
  },
);

test(
  "concurrent Owner deactivations cannot deactivate the last active Owner",
  async () => {
    const fixture =
      await createFixture();

    try {
      const results =
        await Promise.all([
          updateMemberStatusWithOwnerGuard({
            organizationId:
              fixture.organizationId,

            memberId:
              fixture.memberAId,

            status: "inactive",
          }),

          updateMemberStatusWithOwnerGuard({
            organizationId:
              fixture.organizationId,

            memberId:
              fixture.memberBId,

            status: "inactive",
          }),
        ]);

      assert.equal(
        results.filter(
          (result) =>
            result?.allowed === true &&
            result?.updated === true,
        ).length,
        1,
      );

      assert.equal(
        results.filter(
          (result) =>
            result?.allowed === false &&
            result?.updated === false,
        ).length,
        1,
      );

      assert.equal(
        await getActiveOwnerCount(
          fixture.organizationId,
        ),
        1,
      );
    } finally {
      await cleanupFixture(
        fixture.organizationId,
      );
    }
  },
);
