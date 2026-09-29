import {
  randomUUID,
} from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import {
  eq,
} from "drizzle-orm";

import { db } from "@/db";
import {
  organizationMembers,
  organizations,
} from "@/db/schema";

import {
  getMembershipForAccess,
  getOrganizationForAccessBySlug,
} from "./tenant-access";

async function createOrganization(
  isActive: boolean,
) {
  const suffix =
    randomUUID();

  const [organization] =
    await db
      .insert(
        organizations,
      )
      .values({
        name:
          `Tenant access ${suffix}`,
        slug:
          `tenant-access-${suffix}`,
        isActive,
      })
      .returning({
        id:
          organizations.id,
        slug:
          organizations.slug,
      });

  assert.ok(
    organization,
  );

  return organization;
}

async function cleanupOrganization(
  organizationId: string,
) {
  await db
    .delete(
      organizations,
    )
    .where(
      eq(
        organizations.id,
        organizationId,
      ),
    );
}

test(
  "inactive organization is rejected by tenant access resolver",
  async () => {
    const organization =
      await createOrganization(
        false,
      );

    try {
      const result =
        await getOrganizationForAccessBySlug(
          organization.slug,
        );

      assert.deepEqual(
        result,
        {
          status:
            "inactive",
        },
      );
    } finally {
      await cleanupOrganization(
        organization.id,
      );
    }
  },
);

test(
  "inactive membership is rejected while active membership is allowed",
  async () => {
    const organization =
      await createOrganization(
        true,
      );

    const activeUserId =
      `active-${randomUUID()}`;

    const inactiveUserId =
      `inactive-${randomUUID()}`;

    try {
      await db
        .insert(
          organizationMembers,
        )
        .values([
          {
            organizationId:
              organization.id,
            userId:
              activeUserId,
            displayName:
              "Active test member",
            status:
              "active",
          },
          {
            organizationId:
              organization.id,
            userId:
              inactiveUserId,
            displayName:
              "Inactive test member",
            status:
              "inactive",
          },
        ]);

      const activeResult =
        await getMembershipForAccess(
          organization.id,
          activeUserId,
        );

      assert.equal(
        activeResult.status,
        "active",
      );

      const inactiveResult =
        await getMembershipForAccess(
          organization.id,
          inactiveUserId,
        );

      assert.deepEqual(
        inactiveResult,
        {
          status:
            "inactive",
        },
      );

      const missingResult =
        await getMembershipForAccess(
          organization.id,
          `missing-${randomUUID()}`,
        );

      assert.deepEqual(
        missingResult,
        {
          status:
            "not-found",
        },
      );
    } finally {
      await cleanupOrganization(
        organization.id,
      );
    }
  },
);
