import {
  randomUUID,
} from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import {
  and,
  eq,
  gt,
  isNull,
} from "drizzle-orm";

import { db } from "@/db";
import {
  organizationInvitations,
  organizationMembers,
  organizations,
  roles,
} from "@/db/schema";

import {
  createInvitation,
} from "./create-invitation";
import {
  createInvitationToken,
} from "./invitation-token";

type Fixture = {
  organizationId: string;
  inviterMemberId: string;
  roleId: string;
  email: string;
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
          `Create invitation ${suffix}`,
        slug:
          `create-invitation-${suffix}`,
      })
      .returning({
        id:
          organizations.id,
      });

  assert.ok(
    organization,
  );

  const [inviter] =
    await db
      .insert(
        organizationMembers,
      )
      .values({
        organizationId:
          organization.id,

        userId:
          `inviter-${suffix}`,

        displayName:
          "Invitation Test Inviter",

        email:
          `inviter-${suffix}@example.com`,

        status:
          "active",
      })
      .returning({
        id:
          organizationMembers.id,
      });

  assert.ok(
    inviter,
  );

  const [role] =
    await db
      .insert(roles)
      .values({
        organizationId:
          organization.id,

        name:
          `Manager ${suffix}`,
      })
      .returning({
        id:
          roles.id,
      });

  assert.ok(role);

  return {
    organizationId:
      organization.id,

    inviterMemberId:
      inviter.id,

    roleId:
      role.id,

    email:
      `new-member-${suffix}@example.com`,
  };
}

async function cleanupFixture(
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
  "concurrent creation produces only one active invitation for the same organization and email",
  async () => {
    const fixture =
      await createFixture();

    try {
      const input = {
        organizationId:
          fixture.organizationId,

        invitedByMemberId:
          fixture.inviterMemberId,

        email:
          fixture.email,

        roleId:
          fixture.roleId,
      };

      const results =
        await Promise.all([
          createInvitation(
            input,
          ),
          createInvitation(
            input,
          ),
        ]);

      assert.equal(
        results.filter(
          (result) =>
            result.status ===
            "created",
        ).length,
        1,
      );

      assert.equal(
        results.filter(
          (result) =>
            result.status ===
            "already-pending",
        ).length,
        1,
      );

      const activeInvitations =
        await db
          .select({
            id:
              organizationInvitations.id,
          })
          .from(
            organizationInvitations,
          )
          .where(
            and(
              eq(
                organizationInvitations.organizationId,
                fixture.organizationId,
              ),

              eq(
                organizationInvitations.emailNormalized,
                fixture.email,
              ),

              isNull(
                organizationInvitations.acceptedAt,
              ),

              isNull(
                organizationInvitations.revokedAt,
              ),

              gt(
                organizationInvitations.expiresAt,
                new Date(),
              ),
            ),
          );

      assert.equal(
        activeInvitations.length,
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
  "an expired invitation does not block creation of a new invitation",
  async () => {
    const fixture =
      await createFixture();

    try {
      const expiredToken =
        createInvitationToken();

      await db
        .insert(
          organizationInvitations,
        )
        .values({
          organizationId:
            fixture.organizationId,

          emailNormalized:
            fixture.email,

          roleId:
            fixture.roleId,

          tokenHash:
            expiredToken.tokenHash,

          invitedByMemberId:
            fixture.inviterMemberId,

          expiresAt:
            new Date(
              Date.now() -
                60 * 60 * 1000,
            ),
        });

      const result =
        await createInvitation({
          organizationId:
            fixture.organizationId,

          invitedByMemberId:
            fixture.inviterMemberId,

          email:
            fixture.email,

          roleId:
            fixture.roleId,
        });

      assert.equal(
        result.status,
        "created",
      );

      const invitations =
        await db
          .select({
            id:
              organizationInvitations.id,

            expiresAt:
              organizationInvitations.expiresAt,
          })
          .from(
            organizationInvitations,
          )
          .where(
            and(
              eq(
                organizationInvitations.organizationId,
                fixture.organizationId,
              ),

              eq(
                organizationInvitations.emailNormalized,
                fixture.email,
              ),
            ),
          );

      assert.equal(
        invitations.length,
        2,
      );

      assert.equal(
        invitations.filter(
          (invitation) =>
            invitation.expiresAt >
            new Date(),
        ).length,
        1,
      );
    } finally {
      await cleanupFixture(
        fixture.organizationId,
      );
    }
  },
);
