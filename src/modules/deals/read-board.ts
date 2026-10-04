import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { deals } from "@/db/schema";
import { dealFilters } from "@/modules/saved-views/filters";
import { dealListConditions, dealReferenceFields } from "./list-filter";
export const boardCursor = z.object({ id: z.uuid(), at: z.iso.datetime() });
export type BoardContext = {
  organizationId: string;
  memberId: string;
  memberDisplayName: string | null;
  permissions: ReadonlySet<string>;
};
export type BoardFilters = z.infer<typeof dealFilters>;
export function boardConditions(c: BoardContext, f: BoardFilters) {
  return [
    eq(deals.organizationId, c.organizationId),
    eq(deals.pipelineId, f.pipeline!),
    eq(deals.isArchived, false),
    isNull(deals.deletedAt),
    ...dealListConditions(f, c.organizationId, c.memberId),
  ];
}
export async function readBoardColumn(
  c: BoardContext,
  f: BoardFilters,
  stageId: string,
  cursor?: z.infer<typeof boardCursor>,
) {
  if (!c.permissions.has("deals.read") || !c.permissions.has("pipelines.read"))
    return { rows: [], next: null };
  const refs = dealReferenceFields(c.permissions, c.organizationId);
  const rows = await db
    .select({
      id: deals.id,
      version: deals.version,
      title: deals.title,
      amount: deals.amount,
      currency: deals.currency,
      stageId: deals.stageId,
      expectedCloseAt: deals.expectedCloseAt,
      createdAt: deals.createdAt,
      cursorAt: sql<string>`to_char(${deals.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      companyId: c.permissions.has("companies.read")
        ? deals.companyId
        : sql<null>`NULL`,
      companyName: refs.companyName,
      ownerDisplayName: c.permissions.has("members.read")
        ? refs.ownerDisplayName
        : sql<
            string | null
          >`CASE WHEN ${deals.ownerMemberId}=${c.memberId} THEN ${c.memberDisplayName} WHEN ${deals.ownerMemberId} IS NOT NULL THEN 'Сотрудник' ELSE NULL END`,
    })
    .from(deals)
    .where(
      and(
        ...boardConditions(c, f),
        eq(deals.stageId, stageId),
        cursor
          ? sql`(${deals.createdAt},${deals.id}) < (${cursor.at}::timestamptz,${cursor.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(deals.createdAt), desc(deals.id))
    .limit(21);
  const page = rows.slice(0, 20),
    last = page.at(-1);
  return {
    rows: page,
    next: rows.length > 20 && last ? { id: last.id, at: last.cursorAt } : null,
  };
}
export async function readBoardSummary(c: BoardContext, f: BoardFilters) {
  if (!c.permissions.has("deals.read") || !c.permissions.has("pipelines.read"))
    return [];
  return db
    .select({
      stageId: deals.stageId,
      currency: deals.currency,
      count: sql<number>`count(*)::integer`,
      amount: sql<string | null>`sum(${deals.amount})::text`,
    })
    .from(deals)
    .where(and(...boardConditions(c, f)))
    .groupBy(deals.stageId, deals.currency);
}
