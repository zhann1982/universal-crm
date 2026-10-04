import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { memberRoles, organizationMembers, roles } from "@/db/schema";
// members.manage allows the narrow assignment reference, not arbitrary Role configuration.
export async function readTeamRows(
  organizationId: string,
  permissions: ReadonlySet<string>,
) {
  if (!permissions.has("members.read")) return [];
  const showRoles =
    permissions.has("roles.read") || permissions.has("members.manage");
  const query = db
    .select({
      memberId: organizationMembers.id,
      userId: organizationMembers.userId,
      displayName: organizationMembers.displayName,
      email: organizationMembers.email,
      status: organizationMembers.status,
      joinedAt: organizationMembers.joinedAt,
      roleId: showRoles ? roles.id : sql<null>`NULL`,
      roleName: showRoles ? roles.name : sql<null>`NULL`,
    })
    .from(organizationMembers)
    .$dynamic();
  if (showRoles)
    query
      .leftJoin(
        memberRoles,
        and(
          eq(memberRoles.memberId, organizationMembers.id),
          eq(memberRoles.organizationId, organizationId),
        ),
      )
      .leftJoin(
        roles,
        and(
          eq(roles.id, memberRoles.roleId),
          eq(roles.organizationId, organizationId),
        ),
      );
  return query
    .where(eq(organizationMembers.organizationId, organizationId))
    .orderBy(asc(organizationMembers.displayName), asc(organizationMembers.id));
}
export async function readTeamRoleOptions(
  organizationId: string,
  permissions: ReadonlySet<string>,
) {
  if (!permissions.has("members.manage")) return [];
  return db
    .select({ id: roles.id, name: roles.name, description: sql<null>`NULL` })
    .from(roles)
    .where(eq(roles.organizationId, organizationId))
    .orderBy(asc(roles.name), asc(roles.id));
}
