import {
  and,
  eq,
} from "drizzle-orm";

import {
  findAuthUserByEmail,
} from "../lib/auth/find-auth-user-by-email";

import { db } from "./index";
import {
  memberRoles,
  organizationMembers,
  organizations,
  roles,
} from "./schema";

async function main() {
  const email =
    process.argv[2]?.trim();

  if (!email) {
    throw new Error(
      "Usage: npm run db:link-owner -- your@email.com",
    );
  }

  const userLookup =
    await findAuthUserByEmail(
      email,
    );

  if (
    userLookup.status ===
    "not-found"
  ) {
    throw new Error(
      `Better Auth user not found: ${userLookup.canonicalEmail}`,
    );
  }

  if (
    userLookup.status ===
    "ambiguous"
  ) {
    throw new Error(
      `Multiple Better Auth users match canonical email: ${userLookup.canonicalEmail}`,
    );
  }

  const authUser =
    userLookup.user;

  if (
    !authUser.emailVerified
  ) {
    throw new Error(
      `Better Auth user email is not verified: ${authUser.email}`,
    );
  }  

  const [organization] =
    await db
      .select()
      .from(
        organizations,
      )
      .where(
        eq(
          organizations.slug,
          "development",
        ),
      )
      .limit(1);

  if (!organization) {
    throw new Error(
      "Development organization not found",
    );
  }

  const [ownerRole] =
    await db
      .select()
      .from(roles)
      .where(
        and(
          eq(
            roles.organizationId,
            organization.id,
          ),

          eq(
            roles.name,
            "Owner",
          ),
        ),
      )
      .limit(1);

  if (!ownerRole) {
    throw new Error(
      "Owner role not found",
    );
  }

  let [realMember] =
    await db
      .select()
      .from(
        organizationMembers,
      )
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

  if (!realMember) {
    [realMember] =
      await db
        .insert(
          organizationMembers,
        )
        .values({
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
        })
        .returning();

    console.log(
      "Created authenticated organization member.",
    );
  } else {
    [realMember] =
      await db
        .update(
          organizationMembers,
        )
        .set({
          displayName:
            authUser.name,

          email:
            authUser.email,

          status:
            "active",

          updatedAt:
            new Date(),
        })
        .where(
          eq(
            organizationMembers.id,
            realMember.id,
          ),
        )
        .returning();

    console.log(
      "Authenticated organization member already exists.",
    );
  }

  await db
    .insert(
      memberRoles,
    )
    .values({
      memberId:
        realMember.id,

      roleId:
        ownerRole.id,
    })
    .onConflictDoNothing();

  const [legacyMember] =
    await db
      .select()
      .from(
        organizationMembers,
      )
      .where(
        and(
          eq(
            organizationMembers.organizationId,
            organization.id,
          ),

          eq(
            organizationMembers.userId,
            "local-dev-owner",
          ),
        ),
      )
      .limit(1);

  if (
    legacyMember &&
    legacyMember.id !==
      realMember.id
  ) {
    await db
      .update(
        organizationMembers,
      )
      .set({
        status:
          "inactive",

        updatedAt:
          new Date(),
      })
      .where(
        eq(
          organizationMembers.id,
          legacyMember.id,
        ),
      );

    console.log(
      "Legacy development owner deactivated.",
    );
  }

  console.log("");

  console.log(
    "Owner account linked successfully.",
  );

  console.log(
    "Email:",
    authUser.email,
  );

  console.log(
    "User ID:",
    authUser.id,
  );

  console.log(
    "Organization:",
    organization.name,
  );

  console.log(
    "Role:",
    ownerRole.name,
  );
}

main()
  .catch(
    (error) => {
      console.error(
        "Failed to link development owner:",
      );

      console.error(
        error,
      );

      process.exit(1);
    },
  )
  .finally(() => {
    process.exit(0);
  });