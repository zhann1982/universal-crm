import {
  and,
  eq,
  ilike,
} from "drizzle-orm";

import { user } from "./auth-schema";
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

  const [authUser] = await db
    .select()
    .from(user)
    .where(
      ilike(
        user.email,
        email,
      ),
    )
    .limit(1);

  if (!authUser) {
    throw new Error(
      `Better Auth user not found: ${email}`,
    );
  }

  const [organization] = await db
    .select()
    .from(organizations)
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

  const [ownerRole] = await db
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

  let [realMember] = await db
    .select()
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

  if (!realMember) {
    [realMember] = await db
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
    [realMember] = await db
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
    .insert(memberRoles)
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
  .catch((error) => {
    console.error(
      "Failed to link development owner:",
    );

    console.error(error);

    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });