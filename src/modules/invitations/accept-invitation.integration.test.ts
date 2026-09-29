import {
  randomUUID,
} from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import {
  and,
  eq,
} from "drizzle-orm";

import { db } from "@/db";
import {
  memberRoles,
  organizationInvitations,
  organizationMembers,
  organizations,
  roles,
} from "@/db/schema";

import {
  acceptInvitation,
} from "./accept-invitation";
import {
  createInvitationToken,
} from "./invitation-token";

type Fixture = {
  organizationId: string;
  roleId: string;
  email: string;
  userId: string;
  userName: string;
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
          `Invitation integration ${suffix}`,
        slug:
          `invitation-integration-${suffix}`,
      })
      .returning({
        id:
          organizations.id,
      });

  assert.ok(
    organization,
  );

  const [role] =
    await db
      .insert(roles)
      .values({
        organizationId:
          organization.id,

        name:
          `Manager ${suffix}`,

        description:
          "Invitation integration test role",
      })
      .returning({
        id:
          roles.id,
      });

  assert.ok(role);

  return {
    organizationId:
      organization.id,

    roleId:
      role.id,

    email:
      `invitation-${suffix}@example.com`,

    userId:
      `invitation-user-${suffix}`,

    userName:
      `Invitation User ${suffix}`,
  };
}

async function createPendingInvitation(
  fixture: Fixture,
) {
  const {
    token,
    tokenHash,
  } = createInvitationToken();

  const [invitation] =
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

        tokenHash,

        expiresAt:
          new Date(
            Date.now() +
              60 * 60 * 1000,
          ),
      })
      .returning({
        id:
          organizationInvitations.id,
      });

  assert.ok(invitation);

  return {
    invitationId:
      invitation.id,
    token,
  };
}

async function cleanupFixture(
  organizationId: string,
) {
  await db
    .delete(organizations)
    .where(
      eq(
        organizations.id,
        organizationId,
      ),
    );
}

test(
  "the same invitation can be accepted only once under concurrency",
  async () => {
    const fixture =
      await createFixture();

    try {
      const pending =
        await createPendingInvitation(
          fixture,
        );

      const input = {
        token:
          pending.token,

        userId:
          fixture.userId,

        userEmail:
          fixture.email,

        userName:
          fixture.userName,

        emailVerified:
          true,
      } as const;

      const results =
        await Promise.all([
          acceptInvitation(
            input,
          ),
          acceptInvitation(
            input,
          ),
        ]);

      assert.equal(
        results.filter(
          (result) =>
            result.status ===
            "accepted",
        ).length,
        1,
      );

      assert.equal(
        results.filter(
          (result) =>
            result.status ===
            "already-accepted",
        ).length,
        1,
      );

      const members =
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
                organizationMembers.organizationId,
                fixture.organizationId,
              ),
              eq(
                organizationMembers.userId,
                fixture.userId,
              ),
            ),
          );

      assert.equal(
        members.length,
        1,
      );

      const assignedRoles =
        await db
          .select({
            roleId:
              memberRoles.roleId,
          })
          .from(
            memberRoles,
          )
          .where(
            eq(
              memberRoles.memberId,
              members[0].id,
            ),
          );

      assert.deepEqual(
        assignedRoles,
        [
          {
            roleId:
              fixture.roleId,
          },
        ],
      );

      const [storedInvitation] =
        await db
          .select({
            acceptedAt:
              organizationInvitations.acceptedAt,

            acceptedByUserId:
              organizationInvitations.acceptedByUserId,
          })
          .from(
            organizationInvitations,
          )
          .where(
            eq(
              organizationInvitations.id,
              pending.invitationId,
            ),
          )
          .limit(1);

      assert.ok(
        storedInvitation,
      );

      assert.ok(
        storedInvitation.acceptedAt,
      );

      assert.equal(
        storedInvitation.acceptedByUserId,
        fixture.userId,
      );
    } finally {
      await cleanupFixture(
        fixture.organizationId,
      );
    }
  },
);

test(
  "concurrent invitations for the same identity cannot create duplicate membership",
  async () => {
    const fixture =
      await createFixture();

    try {
      const first =
        await createPendingInvitation(
          fixture,
        );

      const second =
        await createPendingInvitation(
          fixture,
        );

      const commonInput = {
        userId:
          fixture.userId,

        userEmail:
          fixture.email,

        userName:
          fixture.userName,

        emailVerified:
          true,
      } as const;

      const results =
        await Promise.all([
          acceptInvitation({
            ...commonInput,
            token:
              first.token,
          }),
          acceptInvitation({
            ...commonInput,
            token:
              second.token,
          }),
        ]);

      assert.equal(
        results.filter(
          (result) =>
            result.status ===
            "accepted",
        ).length,
        1,
      );

      assert.equal(
        results.filter(
          (result) =>
            result.status ===
            "member-exists",
        ).length,
        1,
      );

      const members =
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
                organizationMembers.organizationId,
                fixture.organizationId,
              ),
              eq(
                organizationMembers.userId,
                fixture.userId,
              ),
            ),
          );

      assert.equal(
        members.length,
        1,
      );

      const invitations =
        await db
          .select({
            id:
              organizationInvitations.id,

            acceptedAt:
              organizationInvitations.acceptedAt,
          })
          .from(
            organizationInvitations,
          )
          .where(
            eq(
              organizationInvitations.organizationId,
              fixture.organizationId,
            ),
          );

      assert.equal(
        invitations.length,
        2,
      );

      assert.equal(
        invitations.filter(
          (invitation) =>
            invitation.acceptedAt !==
            null,
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

test(
  "an invitation cannot be accepted by a different email identity",
  async () => {
    const fixture =
      await createFixture();

    try {
      const pending =
        await createPendingInvitation(
          fixture,
        );

      const result =
        await acceptInvitation({
          token:
            pending.token,

          userId:
            fixture.userId,

          userEmail:
            `wrong-${fixture.email}`,

          userName:
            fixture.userName,

          emailVerified:
            true,
        });

      assert.equal(
        result.status,
        "identity-mismatch",
      );

      const members =
        await db
          .select({
            id:
              organizationMembers.id,
          })
          .from(
            organizationMembers,
          )
          .where(
            eq(
              organizationMembers.organizationId,
              fixture.organizationId,
            ),
          );

      assert.equal(
        members.length,
        0,
      );

      const [storedInvitation] =
        await db
          .select({
            acceptedAt:
              organizationInvitations.acceptedAt,

            acceptedByUserId:
              organizationInvitations.acceptedByUserId,
          })
          .from(
            organizationInvitations,
          )
          .where(
            eq(
              organizationInvitations.id,
              pending.invitationId,
            ),
          )
          .limit(1);

      assert.ok(
        storedInvitation,
      );

      assert.equal(
        storedInvitation.acceptedAt,
        null,
      );

      assert.equal(
        storedInvitation.acceptedByUserId,
        null,
      );
    } finally {
      await cleanupFixture(
        fixture.organizationId,
      );
    }
  },
);
