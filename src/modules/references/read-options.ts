import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { clients, companies, deals, organizationMembers } from "@/db/schema";
export type ReferenceKind = "client" | "company" | "deal" | "member";
export type ReferenceContext = {
  organizationId: string;
  memberId: string;
  memberDisplayName: string | null;
  permissions: ReadonlySet<string>;
};
export async function readReferenceOptions(
  context: ReferenceContext,
  kind: ReferenceKind,
  query: string,
) {
  const q = query.trim().slice(0, 160),
    pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const { organizationId, permissions } = context;
  if (kind === "member" && !permissions.has("members.read"))
    return [{ id: context.memberId, label: context.memberDisplayName || "Я" }];
  const permission = {
    client: "clients.read",
    company: "companies.read",
    deal: "deals.read",
    member: "members.read",
  }[kind];
  if (!permissions.has(permission)) return [];
  if (kind === "member")
    return db
      .select({
        id: organizationMembers.id,
        label: sql<string>`coalesce(${organizationMembers.displayName},'Сотрудник')`,
      })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.status, "active"),
          q ? ilike(organizationMembers.displayName, pattern) : undefined,
        ),
      )
      .orderBy(
        asc(organizationMembers.displayName),
        asc(organizationMembers.id),
      )
      .limit(50);
  if (kind === "client")
    return db
      .select({
        id: clients.id,
        label: sql<string>`coalesce(nullif(trim(concat_ws(' ',${clients.lastName},${clients.firstName})),''),${clients.phone},'Клиент')`,
      })
      .from(clients)
      .where(
        and(
          eq(clients.organizationId, organizationId),
          eq(clients.isArchived, false),
          isNull(clients.deletedAt),
          q
            ? or(
                ilike(clients.firstName, pattern),
                ilike(clients.lastName, pattern),
                ilike(clients.phone, pattern),
              )
            : undefined,
        ),
      )
      .orderBy(asc(clients.lastName), asc(clients.firstName), asc(clients.id))
      .limit(50);
  if (kind === "company")
    return db
      .select({ id: companies.id, label: companies.name })
      .from(companies)
      .where(
        and(
          eq(companies.organizationId, organizationId),
          eq(companies.isArchived, false),
          isNull(companies.deletedAt),
          q ? ilike(companies.name, pattern) : undefined,
        ),
      )
      .orderBy(asc(companies.name), asc(companies.id))
      .limit(50);
  return db
    .select({ id: deals.id, label: deals.title })
    .from(deals)
    .where(
      and(
        eq(deals.organizationId, organizationId),
        eq(deals.isArchived, false),
        isNull(deals.deletedAt),
        q ? ilike(deals.title, pattern) : undefined,
      ),
    )
    .orderBy(asc(deals.title), asc(deals.id))
    .limit(50);
}
