import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { organizationMembers, organizations } from "@/db/schema";

export const ORGANIZATION_COOKIE = "crm-organization";
export const ORGANIZATION_FIELD = "_organizationId";

export function matchesOrganizationScope(currentId: string, submitted: unknown): boolean {
  return typeof submitted === "string" && z.string().uuid().safeParse(submitted).success && submitted === currentId;
}

export async function listAccessibleOrganizations(userId: string) {
  return db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
    .from(organizations).innerJoin(organizationMembers, and(
      eq(organizationMembers.organizationId, organizations.id),
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.status, "active"),
    )).where(eq(organizations.isActive, true))
    .orderBy(asc(organizations.name), asc(organizations.id));
}

// A cookie is only a preference. Revalidate both Organization and Membership
// against the authenticated user on every request, even for an unchanged cookie.
export async function findAccessibleOrganization(userId: string, organizationId: unknown) {
  if (typeof organizationId !== "string" || !z.string().uuid().safeParse(organizationId).success) return null;
  const [row] = await db.select({ organization: organizations })
    .from(organizations).innerJoin(organizationMembers, and(
      eq(organizationMembers.organizationId, organizations.id),
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.status, "active"),
    )).where(and(eq(organizations.id, organizationId), eq(organizations.isActive, true))).limit(1);
  return row?.organization ?? null;
}

export async function resolveSelectedOrganization(userId: string, selectedId: string | undefined) {
  // An invalid/revoked selection must not silently switch a stale request to
  // another tenant, even if only one accessible organization remains.
  if (selectedId !== undefined) return findAccessibleOrganization(userId, selectedId);
  const available = await listAccessibleOrganizations(userId);
  return available.length === 1 ? findAccessibleOrganization(userId, available[0].id) : null;
}
