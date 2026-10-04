import { eq, ilike, isNull, sql } from "drizzle-orm";
import { deals } from "@/db/schema";
import type { z } from "zod";
import type { dealFilters } from "@/modules/saved-views/filters";

export function dealListConditions(
  filters: z.infer<typeof dealFilters>,
  organizationId: string,
  memberId: string,
) {
  return [
    filters.q ? ilike(deals.title, `%${filters.q}%`) : undefined,
    filters.owner === "mine"
      ? eq(deals.ownerMemberId, memberId)
      : filters.owner === "unassigned"
        ? isNull(deals.ownerMemberId)
        : undefined,
    filters.state !== "all"
      ? sql`${deals.stageId} IN (SELECT id FROM pipeline_stages WHERE organization_id=${organizationId} AND pipeline_id=${filters.pipeline} AND type=${filters.state})`
      : undefined,
    filters.close === "none"
      ? isNull(deals.expectedCloseAt)
      : filters.close === "overdue"
        ? sql`${deals.expectedCloseAt} < CURRENT_DATE`
        : filters.close === "week"
          ? sql`${deals.expectedCloseAt} >= CURRENT_DATE AND ${deals.expectedCloseAt} < CURRENT_DATE + 7`
          : undefined,
  ];
}

export function dealReferenceFields(
  permissions: ReadonlySet<string>,
  organizationId: string,
) {
  return {
    companyName: permissions.has("companies.read")
      ? sql<
          string | null
        >`(SELECT name FROM companies WHERE id=${deals.companyId} AND organization_id=${organizationId} AND deleted_at IS NULL)`
      : sql<null>`NULL`,
    ownerDisplayName: permissions.has("members.read")
      ? sql<
          string | null
        >`(SELECT display_name FROM organization_members WHERE id=${deals.ownerMemberId} AND organization_id=${organizationId})`
      : sql<null>`NULL`,
  };
}
