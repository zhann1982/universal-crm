import {
  and,
  eq,
} from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  memberRoles,
  permissions,
  rolePermissions,
  roles,
} from "@/db/schema";

import { getCurrentMember } from "./current-member";

export type PermissionKey =
  | "clients.read"
  | "clients.create"
  | "clients.update"
  | "clients.archive"
  | "clients.delete"
  | "companies.read"
  | "companies.create"
  | "companies.update"
  | "companies.archive"
  | "companies.delete"
  | "members.read"
  | "members.manage"
  | "roles.read"
  | "roles.manage"
  | "settings.manage";

export async function getCurrentAccessContext() {
  const current =
    await getCurrentMember();

  const permissionRows = await db
    .selectDistinct({
      key: permissions.key,
    })
    .from(memberRoles)
    .innerJoin(
      roles,
      eq(
        memberRoles.roleId,
        roles.id,
      ),
    )
    .innerJoin(
      rolePermissions,
      eq(
        rolePermissions.roleId,
        roles.id,
      ),
    )
    .innerJoin(
      permissions,
      eq(
        rolePermissions.permissionId,
        permissions.id,
      ),
    )
    .where(
      and(
        eq(
          memberRoles.memberId,
          current.member.id,
        ),

        eq(
          roles.organizationId,
          current.organization.id,
        ),
      ),
    );

  const permissionSet =
    new Set(
      permissionRows.map(
        (row) => row.key,
      ),
    );

  return {
    ...current,
    permissions: permissionSet,
  };
}

export async function hasPermission(
  permission: PermissionKey,
) {
  const context =
    await getCurrentAccessContext();

  return context.permissions.has(
    permission,
  );
}

export async function requirePermission(
  permission: PermissionKey,
) {
  const context =
    await getCurrentAccessContext();

  if (
    !context.permissions.has(
      permission,
    )
  ) {
    redirect("/crm/forbidden");
  }

  return context;
}