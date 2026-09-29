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
  resolveOwnerAssignment,
} from "./owner-assignment";

type Fixture = {
  organizationId: string;
  foreignOrganizationId: string;
  currentMemberId: string;
  activeMemberId: string;
  inactiveMemberId: string;
  foreignActiveMemberId: string;
};

async function createFixture():
  Promise<Fixture> {
  const suffix =
    randomUUID();

  const [organization] =
    await db
      .insert(
        organizations,
      )
      .values({
        name:
          `Owner assignment ${suffix}`,
        slug:
          `owner-assignment-${suffix}`,
      })
      .returning({
        id:
          organizations.id,
      });

  assert.ok(
    organization,
  );

  const [foreignOrganization] =
    await db
      .insert(
        organizations,
      )
      .values({
        name:
          `Foreign owner assignment ${suffix}`,
        slug:
          `foreign-owner-assignment-${suffix}`,
      })
      .returning({
        id:
          organizations.id,
      });

  assert.ok(
    foreignOrganization,
  );

  const insertedMembers =
    await db
      .insert(
        organizationMembers,
      )
      .values([
        {
          organizationId:
            organization.id,
          userId:
            `owner-current-${suffix}`,
          displayName:
            "Current Member",
          status:
            "active",
        },
        {
          organizationId:
            organization.id,
          userId:
            `owner-active-${suffix}`,
          displayName:
            "Active Member",
          status:
            "active",
        },
        {
          organizationId:
            organization.id,
          userId:
            `owner-inactive-${suffix}`,
          displayName:
            "Inactive Member",
          status:
            "inactive",
        },
        {
          organizationId:
            foreignOrganization.id,
          userId:
            `owner-foreign-${suffix}`,
          displayName:
            "Foreign Active Member",
          status:
            "active",
        },
      ])
      .returning({
        id:
          organizationMembers.id,
        userId:
          organizationMembers.userId,
      });

  const byUserId =
    new Map(
      insertedMembers.map(
        (member) => [
          member.userId,
          member.id,
        ],
      ),
    );

  const currentMemberId =
    byUserId.get(
      `owner-current-${suffix}`,
    );

  const activeMemberId =
    byUserId.get(
      `owner-active-${suffix}`,
    );

  const inactiveMemberId =
    byUserId.get(
      `owner-inactive-${suffix}`,
    );

  const foreignActiveMemberId =
    byUserId.get(
      `owner-foreign-${suffix}`,
    );

  assert.ok(currentMemberId);
  assert.ok(activeMemberId);
  assert.ok(inactiveMemberId);
  assert.ok(foreignActiveMemberId);

  return {
    organizationId:
      organization.id,

    foreignOrganizationId:
      foreignOrganization.id,

    currentMemberId,
    activeMemberId,
    inactiveMemberId,
    foreignActiveMemberId,
  };
}

async function cleanupFixture(
  fixture: Fixture,
) {
  await db
    .delete(organizations)
    .where(
      eq(
        organizations.id,
        fixture.organizationId,
      ),
    );

  await db
    .delete(organizations)
    .where(
      eq(
        organizations.id,
        fixture.foreignOrganizationId,
      ),
    );
}

test(
  "unchanged inactive owner remains allowed for Company and Deal update semantics",
  async () => {
    const fixture =
      await createFixture();

    try {
      const result =
        await resolveOwnerAssignment({
          organizationId:
            fixture.organizationId,

          mode:
            "update",

          currentMemberId:
            fixture.currentMemberId,

          canReadMembers:
            false,

          requestedOwnerMemberId:
            fixture.inactiveMemberId,

          existingOwnerMemberId:
            fixture.inactiveMemberId,
        });

      assert.deepEqual(
        result,
        {
          status:
            "allowed",
          ownerChanged:
            false,
        },
      );
    } finally {
      await cleanupFixture(
        fixture,
      );
    }
  },
);

test(
  "new inactive owner is rejected",
  async () => {
    const fixture =
      await createFixture();

    try {
      const result =
        await resolveOwnerAssignment({
          organizationId:
            fixture.organizationId,

          mode:
            "update",

          currentMemberId:
            fixture.currentMemberId,

          canReadMembers:
            true,

          requestedOwnerMemberId:
            fixture.inactiveMemberId,

          existingOwnerMemberId:
            fixture.activeMemberId,
        });

      assert.deepEqual(
        result,
        {
          status:
            "owner-unavailable",
          ownerChanged:
            true,
        },
      );
    } finally {
      await cleanupFixture(
        fixture,
      );
    }
  },
);

test(
  "inactive owner is rejected during create",
  async () => {
    const fixture =
      await createFixture();

    try {
      const result =
        await resolveOwnerAssignment({
          organizationId:
            fixture.organizationId,

          mode:
            "create",

          currentMemberId:
            fixture.currentMemberId,

          canReadMembers:
            true,

          requestedOwnerMemberId:
            fixture.inactiveMemberId,
        });

      assert.deepEqual(
        result,
        {
          status:
            "owner-unavailable",
          ownerChanged:
            true,
        },
      );
    } finally {
      await cleanupFixture(
        fixture,
      );
    }
  },
);

test(
  "active owner from the same Organization is allowed",
  async () => {
    const fixture =
      await createFixture();

    try {
      const result =
        await resolveOwnerAssignment({
          organizationId:
            fixture.organizationId,

          mode:
            "update",

          currentMemberId:
            fixture.currentMemberId,

          canReadMembers:
            true,

          requestedOwnerMemberId:
            fixture.activeMemberId,

          existingOwnerMemberId:
            null,
        });

      assert.deepEqual(
        result,
        {
          status:
            "allowed",
          ownerChanged:
            true,
        },
      );
    } finally {
      await cleanupFixture(
        fixture,
      );
    }
  },
);

test(
  "active owner from another Organization is rejected",
  async () => {
    const fixture =
      await createFixture();

    try {
      const result =
        await resolveOwnerAssignment({
          organizationId:
            fixture.organizationId,

          mode:
            "update",

          currentMemberId:
            fixture.currentMemberId,

          canReadMembers:
            true,

          requestedOwnerMemberId:
            fixture.foreignActiveMemberId,

          existingOwnerMemberId:
            null,
        });

      assert.deepEqual(
        result,
        {
          status:
            "owner-unavailable",
          ownerChanged:
            true,
        },
      );
    } finally {
      await cleanupFixture(
        fixture,
      );
    }
  },
);

test(
  "owner may be cleared even when the previous owner is inactive",
  async () => {
    const fixture =
      await createFixture();

    try {
      const result =
        await resolveOwnerAssignment({
          organizationId:
            fixture.organizationId,

          mode:
            "update",

          currentMemberId:
            fixture.currentMemberId,

          canReadMembers:
            false,

          requestedOwnerMemberId:
            null,

          existingOwnerMemberId:
            fixture.inactiveMemberId,
        });

      assert.deepEqual(
        result,
        {
          status:
            "allowed",
          ownerChanged:
            true,
        },
      );
    } finally {
      await cleanupFixture(
        fixture,
      );
    }
  },
);
